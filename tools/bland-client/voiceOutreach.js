const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { createFollowUpTask } = require('../automation/engine');
const { createChildLogger } = require('../logger');
const { createCallServer } = require('./callServer');

dotenv.config();

const log = createChildLogger('voice-outreach');
const anthropic = new Anthropic();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function getWatchlistNames(limit = 3) {
  try {
    const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');
    const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
    return watchlist.slice(0, limit).map(c => c.name || c.cardName).join(', ');
  } catch {
    return 'Charizard VMAX, Pikachu VMAX, Umbreon VMAX';
  }
}

function getConfig() {
  try {
    const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { maxDailyVoiceCalls: 10, voiceCooldownDays: 14 };
  }
}

function getScript(target) {
  const agentName = process.env.AGENT_NAME || 'a Pokemon card collector';
  const watchlist = getWatchlistNames();

  const scripts = {
    card_shop: `Hi, my name is ${agentName}. I'm a Pokemon card collector looking for some specific cards. I was wondering if your shop carries Pokemon TCG cards, and if you might have any of these: ${watchlist}. If you get them in, I'd love to be notified. Can I leave my email with you?`,
    pawn_shop: `Hi, I'm ${agentName} and I collect Pokemon cards. I know pawn shops sometimes get trading card collections. If Pokemon cards ever come through your shop, I'd really appreciate a heads up. I'm specifically looking for ${watchlist}. Can I leave my contact info with you?`
  };

  return scripts[target.type] || scripts.card_shop;
}

function isBusinessHours(timezone) {
  if (!timezone) return true;
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false
    });
    const hour = parseInt(formatter.format(now));
    return hour >= 9 && hour < 17;
  } catch {
    return true;
  }
}

async function analyzeTranscript(transcriptEntries, database) {
  const formatted = transcriptEntries
    .map(e => `${e.role === 'agent' ? 'Agent' : 'Seller'}: ${e.text}`)
    .join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'Analyze this phone call transcript between an AI caller and a store. Return JSON only: {"interested": true/false, "hasCards": true/false, "followUpNeeded": true/false, "callbackRequested": true/false, "notes": "brief summary"}',
      messages: [{
        role: 'user',
        content: `Analyze this call transcript:\n${formatted}`
      }]
    });

    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;
    const estimatedCost = (tokensIn * 3 / 1000000) + (tokensOut * 15 / 1000000);

    db.logApiUsage(database, {
      service: 'anthropic',
      endpoint: 'transcript-analysis',
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      estimated_cost_usd: estimatedCost
    });

    return JSON.parse(response.content[0].text.trim());
  } catch (err) {
    log.error(`Transcript analysis failed: ${err.message}`);
    return { interested: false, hasCards: false, followUpNeeded: false, callbackRequested: false, notes: 'Analysis failed' };
  }
}

async function makeCall(target, database) {
  const config = getConfig();
  const spendCap = parseFloat(process.env.DAILY_API_SPEND_CAP_USD || '5.00');

  // Check business hours
  if (!isBusinessHours(target.timezone)) {
    log.info(`Skipping ${target.name} — outside business hours for ${target.timezone}`);
    return { skipped: true, reason: 'outside_business_hours' };
  }

  // Check spend cap
  const currentSpend = db.getDailyApiSpend(database);
  if (currentSpend.total_spend >= spendCap) {
    log.warn('Daily spend cap reached. Skipping call.');
    return { skipped: true, reason: 'spend_cap_reached' };
  }

  // Check daily limit
  const todayCalls = db.getTodayOutreachCount(database, 'voice');
  if (todayCalls >= config.maxDailyVoiceCalls) {
    log.warn(`Daily call limit reached (${todayCalls}/${config.maxDailyVoiceCalls}).`);
    return { skipped: true, reason: 'daily_limit_reached' };
  }

  // Check cooldown
  const history = db.getOutreachHistory(database, target.phone, config.voiceCooldownDays);
  if (history.length > 0) {
    log.info(`Skipping ${target.phone} — called within ${config.voiceCooldownDays} days`);
    return { skipped: true, reason: 'cooldown' };
  }

  const script = getScript(target);
  const agentName = process.env.AGENT_NAME || 'a Pokemon card collector';
  log.info(`Calling ${target.name} at ${target.phone}...`);

  // Start the real-time call server
  const callSrv = createCallServer({ script, maxDuration: 120, agentName });
  const port = await callSrv.start();

  // Twilio needs a publicly reachable URL for the TwiML webhook.
  // Set VOICE_SERVER_URL to your public URL (e.g. via ngrok or server IP).
  const serverBaseUrl = process.env.VOICE_SERVER_URL || `http://localhost:${port}`;
  const twimlUrl = `${serverBaseUrl}/twiml`;

  try {
    // Initiate outbound call via Twilio
    const call = await twilioClient.calls.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: target.phone,
      url: twimlUrl,
      method: 'POST',
      timeout: 30,
    });

    log.info(`Call initiated: ${call.sid}`);

    // Log costs: Twilio ~$0.014/min + Deepgram STT ~$0.0043/min + TTS ~$0.015/min
    // Assume ~2 min average call = ~$0.07 total
    db.logApiUsage(database, {
      service: 'twilio',
      endpoint: 'calls',
      estimated_cost_usd: 0.03
    });
    db.logApiUsage(database, {
      service: 'deepgram',
      endpoint: 'stt+tts',
      estimated_cost_usd: 0.04
    });

    // Wait for call to complete (max 3 minutes)
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Call timeout')), 180000)
    );

    try {
      await Promise.race([callSrv.waitForCallEnd(), timeout]);
    } catch (timeoutErr) {
      // On timeout, terminate the Twilio call to prevent orphaned calls
      log.warn(`Call timed out, terminating Twilio call ${call.sid}`);
      try {
        await twilioClient.calls(call.sid).update({ status: 'completed' });
      } catch (killErr) {
        log.error(`Failed to terminate Twilio call: ${killErr.message}`);
      }
      throw timeoutErr;
    }

    const transcriptEntries = callSrv.getTranscript();
    const callStatus = transcriptEntries.length > 1 ? 'completed' : 'no_answer';

    // Analyze transcript if we got a conversation
    let analysis = { interested: false, hasCards: false, followUpNeeded: false, notes: 'No conversation' };
    if (transcriptEntries.length > 1) {
      analysis = await analyzeTranscript(transcriptEntries, database);
    }

    // Format transcript for logging
    const fullTranscript = transcriptEntries
      .map(e => `${e.role === 'agent' ? 'Agent' : 'Seller'}: ${e.text}`)
      .join('\n');

    // Log outreach with full transcript + analysis
    const messageParts = [`--- SCRIPT ---\n${script}`];
    if (fullTranscript) messageParts.push(`\n--- TRANSCRIPT ---\n${fullTranscript}`);
    if (analysis.notes) messageParts.push(`\n--- AI ANALYSIS ---\n${analysis.notes}`);

    const outreachResult = db.insertOutreach(database, {
      target_name: target.name,
      target_type: target.type,
      contact_method: 'voice',
      contact_info: target.phone,
      subject: `Voice call to ${target.name} (${target.type})`,
      message_sent: messageParts.join('\n'),
      status: callStatus
    });

    // Auto-create follow-up tasks based on analysis
    if (analysis.interested || analysis.followUpNeeded || analysis.callbackRequested || analysis.hasCards) {
      const tasksCreated = createFollowUpTask(database, {
        targetName: target.name,
        contactMethod: 'voice',
        contactInfo: target.phone,
        analysis,
        outreachId: outreachResult.lastInsertRowid,
      });
      log.info(`Auto-created ${tasksCreated} follow-up task(s) for ${target.name}`);
    }

    log.info(`Call to ${target.name} completed: ${callStatus}`);

    return {
      success: true,
      callSid: call.sid,
      status: callStatus,
      analysis,
      transcript: fullTranscript ? fullTranscript.substring(0, 500) : null
    };
  } catch (err) {
    log.error(`Call failed: ${err.message}`);

    db.insertOutreach(database, {
      target_name: target.name,
      target_type: target.type,
      contact_method: 'voice',
      contact_info: target.phone,
      subject: `Voice call to ${target.name} (failed)`,
      message_sent: `--- SCRIPT ---\n${script}\n\n--- ERROR ---\n${err.message}`,
      status: 'failed'
    });

    return { success: false, error: err.message };
  } finally {
    await callSrv.stop();
  }
}

function previewScript(target) {
  return {
    target: target.name,
    type: target.type,
    phone: target.phone,
    script: getScript(target),
    businessHours: isBusinessHours(target.timezone),
    timezone: target.timezone
  };
}

async function getCallStats(database) {
  const todayCount = db.getTodayOutreachCount(database, 'voice');
  const monthCount = database.prepare(`
    SELECT COUNT(*) as count FROM outreach_log
    WHERE contact_method = 'voice' AND strftime('%Y-%m', sent_at) = strftime('%Y-%m', 'now')
  `).get().count;
  const interestedCount = database.prepare(`
    SELECT COUNT(*) as count FROM outreach_log
    WHERE contact_method = 'voice' AND status = 'interested'
  `).get().count;

  return { callsToday: todayCount, callsThisMonth: monthCount, interestedCount };
}

module.exports = { makeCall, previewScript, getCallStats, getScript, isBusinessHours };
