const { Resend } = require('resend');
const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

dotenv.config();

const log = createChildLogger('email-outreach');
const anthropic = new Anthropic();

const TEMPLATES = {
  card_shop: 'Hey [name], I\'m a Pokemon TCG collector hunting for some specific cards. Wondering if you currently have or regularly get any of these in stock: [watchlist]. Happy to buy at fair market price.',
  pawn_shop: 'Hi [name], I collect Pokemon cards and I know sometimes cool stuff comes through pawn shops. If you ever get Pokemon TCG cards in, I\'d love to hear about it. Specifically looking for: [watchlist].',
  facebook_seller: 'Hey [name], saw your Pokemon card post. Do you happen to have any of these: [watchlist]? Also interested in any rare or vintage cards you might have.',
  online_seller: 'Hi [name], noticed your shop online. Looking for specific Pokemon TCG cards: [watchlist]. Do you have any in stock or can you source them?'
};

function getWatchlistNames(limit = 5) {
  try {
    const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');
    const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
    return watchlist.slice(0, limit).map(c => c.name).join(', ');
  } catch {
    return 'Charizard VMAX, Pikachu VMAX, Umbreon VMAX Alt Art';
  }
}

function getConfig() {
  try {
    const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { maxDailyEmails: 20, emailCooldownDays: 30 };
  }
}

async function generateEmail(target, database) {
  const watchlistNames = getWatchlistNames();
  const template = TEMPLATES[target.type] || TEMPLATES.card_shop;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: 'You write short, friendly outreach emails from a Pokemon card collector to potential sellers. Keep emails under 150 words. Be casual and genuine, not corporate or spammy. Always include the specific cards we\'re looking for. Generate a short natural subject line too. Respond as JSON: {"subject": "...", "body": "..."}',
    messages: [{
      role: 'user',
      content: `Write an outreach email for a ${target.type} called ${target.name}. We're a Pokemon TCG collector looking for these specific cards: ${watchlistNames}. Template tone: ${template.replace('[name]', target.name).replace('[watchlist]', watchlistNames)}`
    }]
  });

  const tokensIn = response.usage?.input_tokens || 0;
  const tokensOut = response.usage?.output_tokens || 0;
  const estimatedCost = (tokensIn * 3 / 1000000) + (tokensOut * 15 / 1000000);

  if (database) {
    db.logApiUsage(database, {
      service: 'anthropic',
      endpoint: 'email-generation',
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      estimated_cost_usd: estimatedCost
    });
  }

  const emailData = JSON.parse(response.content[0].text.trim());

  // Add CAN-SPAM footer
  emailData.body += '\n\n---\nIf you\'d prefer not to receive messages from me, just reply and let me know.';

  return { ...emailData, estimatedCost };
}

async function sendEmail(target, database) {
  const config = getConfig();
  const spendCap = parseFloat(process.env.DAILY_API_SPEND_CAP_USD || '5.00');

  // Check spend cap
  const currentSpend = db.getDailyApiSpend(database);
  if (currentSpend.total_spend >= spendCap) {
    log.warn('Daily spend cap reached. Skipping email.');
    return { skipped: true, reason: 'spend_cap_reached' };
  }

  // Check daily email limit
  const todayEmails = db.getTodayOutreachCount(database, 'email');
  if (todayEmails >= config.maxDailyEmails) {
    log.warn(`Daily email limit reached (${todayEmails}/${config.maxDailyEmails}).`);
    return { skipped: true, reason: 'daily_limit_reached' };
  }

  // Check cooldown
  const history = db.getOutreachHistory(database, target.email, config.emailCooldownDays);
  if (history.length > 0) {
    log.info(`Skipping ${target.email} — contacted ${history.length} time(s) within ${config.emailCooldownDays} days`);
    return { skipped: true, reason: 'cooldown' };
  }

  // Generate email
  const emailData = await generateEmail(target, database);
  log.info(`Generated email for ${target.name}: "${emailData.subject}"`);

  // Send via Resend
  const resend = new Resend(process.env.RESEND_API_KEY);

  const result = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: target.email,
    replyTo: process.env.REPLY_TO_EMAIL,
    subject: emailData.subject,
    text: emailData.body
  });

  // Log Resend API usage
  db.logApiUsage(database, {
    service: 'resend',
    endpoint: 'emails.send',
    estimated_cost_usd: 0.001 // Approximate per-email cost
  });

  // Log outreach
  db.insertOutreach(database, {
    target_name: target.name,
    target_type: target.type,
    contact_method: 'email',
    contact_info: target.email,
    message_sent: `Subject: ${emailData.subject}\n\n${emailData.body}`,
    status: 'sent'
  });

  log.info(`Email sent to ${target.name} (${target.email})`);

  return {
    success: true,
    to: target.email,
    subject: emailData.subject,
    resendId: result.data?.id
  };
}

async function getEmailStats(database) {
  const todayCount = db.getTodayOutreachCount(database, 'email');
  const monthCount = database.prepare(`
    SELECT COUNT(*) as count FROM outreach_log
    WHERE contact_method = 'email' AND strftime('%Y-%m', sent_at) = strftime('%Y-%m', 'now')
  `).get().count;

  return { sentToday: todayCount, sentThisMonth: monthCount };
}

module.exports = { generateEmail, sendEmail, getEmailStats };
