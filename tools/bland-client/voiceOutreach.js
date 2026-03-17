const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

dotenv.config();

const log = createChildLogger('voice-outreach');
const anthropic = new Anthropic();

const BLAND_API_URL = 'https://api.bland.ai/v1';

function getWatchlistNames(limit = 3) {
  try {
    const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');
    const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
    return watchlist.slice(0, limit).map(c => c.name).join(', ');
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
  if (!timezone) return true; // If no timezone, assume OK
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

async function analyzeTranscript(transcript, database) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'Analyze this phone call transcript between an AI caller and a store. Return JSON only: {"interested": true/false, "hasCards": true/false, "followUpNeeded": true/false, "callbackRequested": true/false, "notes": "brief summary"}',
      messages: [{
        role: 'user',
        content: `Analyze this call transcript:\n${transcript}`
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
  log.info(`Calling ${target.name} at ${target.phone}...`);

  // Make call via Bland.ai
  const callResponse = await axios.post(`${BLAND_API_URL}/calls`, {
    phone_number: target.phone,
    task: script,
    voice: 'maya',
    max_duration: 120,
    record: true,
    wait_for_greeting: true
  }, {
    headers: {
      'Authorization': process.env.BLAND_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  const callId = callResponse.data?.call_id;
  if (!callId) {
    throw new Error('No call_id returned from Bland.ai');
  }

  log.info(`Call initiated: ${callId}`);

  // Estimate cost ($0.09/min, assume 2 min average)
  const estimatedCallCost = 0.18;
  db.logApiUsage(database, {
    service: 'bland',
    endpoint: 'calls',
    estimated_cost_usd: estimatedCallCost
  });

  // Wait for call to complete (poll every 10s, max 3 min)
  let transcript = null;
  let callStatus = 'in_progress';
  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 10000));

    try {
      const statusRes = await axios.get(`${BLAND_API_URL}/calls/${callId}`, {
        headers: { 'Authorization': process.env.BLAND_API_KEY }
      });

      callStatus = statusRes.data?.status || 'unknown';
      if (callStatus === 'completed' || callStatus === 'failed') {
        transcript = statusRes.data?.transcript || statusRes.data?.concatenated_transcript;
        break;
      }
    } catch (err) {
      log.warn(`Poll error: ${err.message}`);
    }
  }

  // Analyze transcript
  let analysis = { interested: false, hasCards: false, followUpNeeded: false, notes: 'No transcript available' };
  if (transcript) {
    analysis = await analyzeTranscript(transcript, database);
  }

  // Log outreach
  db.insertOutreach(database, {
    target_name: target.name,
    target_type: target.type,
    contact_method: 'voice',
    contact_info: target.phone,
    message_sent: script,
    status: callStatus
  });

  log.info(`Call to ${target.name} completed: ${callStatus}`);

  return {
    success: true,
    callId,
    status: callStatus,
    analysis,
    transcript: transcript ? transcript.substring(0, 500) : null
  };
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
