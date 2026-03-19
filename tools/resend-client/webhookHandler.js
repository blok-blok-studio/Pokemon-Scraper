const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db/database');
const telegram = require('../telegram-client/telegram');
const { createChildLogger } = require('../logger');
const fs = require('fs');
const path = require('path');

const log = createChildLogger('webhook-handler');
const router = express.Router();

const BLOCKLIST_PATH = path.join(__dirname, '..', '..', 'config', 'email-blocklist.json');

function loadBlocklist() {
  try {
    if (!fs.existsSync(BLOCKLIST_PATH)) {
      fs.writeFileSync(BLOCKLIST_PATH, '[]');
      return [];
    }
    return JSON.parse(fs.readFileSync(BLOCKLIST_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function addToBlocklist(email) {
  const blocklist = loadBlocklist();
  if (!blocklist.includes(email)) {
    blocklist.push(email);
    fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(blocklist, null, 2));
  }
}

function isBlocklisted(email) {
  return loadBlocklist().includes(email);
}

async function analyzeReply(targetName, targetType, subject, bodyText) {
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: 'You analyze email replies to a Pokemon card collector\'s outreach. Extract information from the reply. Respond ONLY as JSON.',
      messages: [{
        role: 'user',
        content: `Original outreach was to a ${targetType} called ${targetName} asking about Pokemon card inventory. They replied with:
Subject: ${subject}
Body: ${(bodyText || '').substring(0, 500)}

Analyze: { "hasCards": true/false, "interested": true/false, "wantsFollowUp": true/false, "cardsMentioned": ["list of specific cards if mentioned"], "sentiment": "positive/neutral/negative", "summary": "1-2 sentence summary of their response" }`
      }],
    });

    const text = response.content[0].text;
    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { hasCards: false, interested: false, wantsFollowUp: false, cardsMentioned: [], sentiment: 'neutral', summary: text.substring(0, 200) };
  } catch (err) {
    log.error(`Reply analysis failed: ${err.message}`);
    return { hasCards: false, interested: false, wantsFollowUp: false, cardsMentioned: [], sentiment: 'unknown', summary: 'Analysis failed' };
  }
}

// Handle Resend webhook events
router.post('/email-reply', express.json(), async (req, res) => {
  const database = db.init();

  try {
    const signature = req.headers['resend-webhook-signature'];
    if (!signature) {
      log.warn('Webhook received without Resend-Webhook-Signature header');
    }

    const payload = req.body;
    const eventType = payload.type;

    log.info(`Webhook received: ${eventType}`);

    // Handle delivery events
    if (eventType === 'email.delivered') {
      const email = payload.data?.to?.[0] || payload.data?.email;
      if (email) {
        try {
          database.prepare(`UPDATE outreach_log SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE contact_info = ? AND status = 'sent'`).run(email);
          log.info(`Email to ${email} delivered`);
        } catch (err) {
          log.error(`Failed to update delivery status: ${err.message}`);
        }
      }
    }

    // Handle bounce events
    else if (eventType === 'email.bounced') {
      const email = payload.data?.to?.[0] || payload.data?.email;
      const reason = payload.data?.bounce?.description || 'unknown reason';
      if (email) {
        try {
          database.prepare(`UPDATE outreach_log SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE contact_info = ?`).run(email);
          log.warn(`Email to ${email} bounced: ${reason}`);
          await telegram.sendMessage(`⚠️ Email to ${email} bounced: ${reason}`);
        } catch (err) {
          log.error(`Failed to handle bounce: ${err.message}`);
        }
      }
    }

    // Handle spam complaints
    else if (eventType === 'email.complained') {
      const email = payload.data?.to?.[0] || payload.data?.email;
      if (email) {
        try {
          database.prepare(`UPDATE outreach_log SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE contact_info = ?`).run(email);
          addToBlocklist(email);
          log.error(`Email to ${email} marked as spam — added to blocklist`);
          await telegram.sendMessage(`🚫 ${email} marked our email as spam — blocklisted`);
        } catch (err) {
          log.error(`Failed to handle spam complaint: ${err.message}`);
        }
      }
    }

    // Handle inbound replies
    else if (payload.from || payload.text || payload.html) {
      const senderEmail = payload.from || payload.data?.from;
      const subject = payload.subject || payload.data?.subject || '(no subject)';
      const bodyText = payload.text || payload.data?.text || '';

      log.info(`Inbound reply from ${senderEmail}: ${subject}`);

      // Look up sender in outreach log
      const outreachEntry = database.prepare(`
        SELECT * FROM outreach_log WHERE contact_info = ? ORDER BY sent_at DESC LIMIT 1
      `).get(senderEmail);

      if (outreachEntry) {
        // Update outreach status
        database.prepare(`UPDATE outreach_log SET status = 'replied', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(outreachEntry.id);

        // AI analysis
        const analysis = await analyzeReply(
          outreachEntry.target_name,
          outreachEntry.target_type,
          subject,
          bodyText
        );

        // Log API usage
        db.logApiUsage(database, {
          service: 'anthropic',
          endpoint: 'reply-analysis',
          estimated_cost_usd: 0.005,
        });

        // Send Telegram alert
        const alertMessage = [
          `📬 *REPLY RECEIVED*`,
          `From: ${outreachEntry.target_name} (${senderEmail})`,
          `Original outreach: ${outreachEntry.sent_at}`,
          '',
          `Their reply: "${bodyText.substring(0, 200)}"`,
          '',
          `🤖 Analysis:`,
          `Has cards: ${analysis.hasCards ? '✅' : '❌'}`,
          `Interested: ${analysis.interested ? '✅' : '❌'}`,
          `Follow up needed: ${analysis.wantsFollowUp ? '✅' : '❌'}`,
          `Cards mentioned: ${analysis.cardsMentioned?.length > 0 ? analysis.cardsMentioned.join(', ') : 'none'}`,
          `Summary: ${analysis.summary}`,
        ].join('\n');

        await telegram.sendMessage(alertMessage);

        if (analysis.interested || analysis.wantsFollowUp) {
          const cards = analysis.cardsMentioned?.length > 0 ? analysis.cardsMentioned.join(', ') : 'your watchlist cards';
          await telegram.sendMessage(`💡 Suggested action: Reply to ${senderEmail} about ${cards}`);
        }
      } else {
        // Unmatched reply
        log.info(`Unmatched reply from ${senderEmail}`);
        await telegram.sendMessage(`📬 Unmatched reply from ${senderEmail} — may be from a forwarded email or manual outreach`);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    log.error(`Webhook handler error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    database.close();
  }
});

module.exports = router;
module.exports.isBlocklisted = isBlocklisted;
module.exports.loadBlocklist = loadBlocklist;
module.exports.addToBlocklist = addToBlocklist;
