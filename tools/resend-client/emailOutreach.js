const { Resend } = require('resend');
const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { createFollowUpTask } = require('../automation/engine');
const { createChildLogger } = require('../logger');

dotenv.config({ override: true });

const log = createChildLogger('email-outreach');
const anthropic = new Anthropic();

const SELLER_CONTEXT = {
  card_shop: {
    tone: 'knowledgeable collector-to-dealer',
    context: 'They know Pokemon TCG. Use card-specific language. Mention sets, conditions, specific cards. They respect serious buyers.',
    approach: 'Ask about inventory, willingness to hold cards, bulk pricing. Show you know the market.',
  },
  pawn_shop: {
    tone: 'friendly and educational',
    context: 'They may not know Pokemon card values. Keep it simple. Explain these cards are collectible and worth money. They get random items from customers.',
    approach: 'Ask them to set aside any Pokemon cards that come in. Offer to buy sight-unseen at fair price. Make it easy for them.',
  },
  thrift_store: {
    tone: 'warm and casual',
    context: 'Thrift stores get donated items including card collections. Staff may not sort through them. Cards could be in toy bins, game sections, or miscellaneous.',
    approach: 'Ask if they get Pokemon cards in their donations. Offer to check regularly or be called when cards come in. Keep it simple.',
  },
  storage_unit: {
    tone: 'professional and straightforward',
    context: 'Storage auction buyers find abandoned collections. They want to flip everything quickly. They may have bulk lots with hidden gems.',
    approach: 'Ask if they have any Pokemon card lots from recent auctions. Offer to buy the whole lot to make it easy for them.',
  },
  antique_mall: {
    tone: 'respectful and knowledgeable',
    context: 'Antique malls have individual vendor booths. Vendors may have cards mixed in with vintage toys/games. They price based on perceived rarity.',
    approach: 'Ask about vintage Pokemon cards, first edition, Base Set. They understand collectible value. Mention specific eras.',
  },
  flea_market: {
    tone: 'casual and friendly',
    context: 'Flea market sellers have mixed inventory. Cards might be in boxes they haven not sorted. Good chance of finding undervalued cards.',
    approach: 'Keep it short. Ask if they have Pokemon cards. Mention you buy collections and singles. Offer to come look in person.',
  },
  comic_book_store: {
    tone: 'fellow nerd energy',
    context: 'Comic shops often carry TCG products. They understand collectibles. Some have dedicated Pokemon sections, others just carry a few items.',
    approach: 'Ask about their Pokemon TCG selection. Mention specific cards. Ask if they buy collections from customers.',
  },
  estate_sale: {
    tone: 'respectful and patient',
    context: 'Estate sale companies liquidate entire households. Pokemon cards could be from kids who grew up. They price to move everything.',
    approach: 'Ask to be notified when they find Pokemon card collections. Offer to buy entire lots. Be respectful of the situation.',
  },
  facebook_seller: {
    tone: 'casual marketplace chat',
    context: 'FB sellers are individuals clearing out collections. They may not know exact values. Some are parents selling kids old cards.',
    approach: 'Keep it brief and conversational. Ask about specific cards. Offer fair price. Mention local pickup if possible.',
  },
  online_seller: {
    tone: 'professional buyer',
    context: 'Online sellers know the market. They have storefronts on eBay, TCGPlayer, etc. They understand grading and pricing.',
    approach: 'Be specific about what you want. Mention conditions you accept. Ask about bulk deals or regular inventory updates.',
  },
  garage_sale: {
    tone: 'friendly neighbor',
    context: 'Garage sale organizers are clearing out stuff. Pokemon cards could be in boxes of old toys. They price to sell, not for market value.',
    approach: 'Super casual. Ask if they have any Pokemon cards in their sale. Offer to take entire boxes of cards.',
  },
  secondhand_store: {
    tone: 'friendly regular customer',
    context: 'Secondhand shops like Goodwill, Salvation Army get random donations. Cards end up in toy sections or behind the counter.',
    approach: 'Ask if they set aside collectible cards. Offer to be a regular buyer. Keep it simple and friendly.',
  },
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

// Warm-up schedule: ramp daily limit over 4 weeks
function getWarmupLimit(config) {
  const startDatePath = path.join(__dirname, '..', '..', 'data', '.email-warmup-start');
  let startDate;
  try {
    startDate = new Date(fs.readFileSync(startDatePath, 'utf8').trim());
  } catch {
    // First run — create warmup start date
    startDate = new Date();
    try {
      fs.writeFileSync(startDatePath, startDate.toISOString());
    } catch {}
  }

  const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / 86400000);
  const maxDaily = config.maxDailyEmails || 20;

  if (daysSinceStart < 7) return Math.min(5, maxDaily);      // Week 1: 5/day
  if (daysSinceStart < 14) return Math.min(10, maxDaily);     // Week 2: 10/day
  if (daysSinceStart < 21) return Math.min(15, maxDaily);     // Week 3: 15/day
  return maxDaily;                                             // Week 4+: full limit
}

// Check if we've sent too many to the same email domain today
function getDomainSendCount(database, email) {
  const domain = email.split('@')[1];
  if (!domain) return 0;
  try {
    const result = database.prepare(`
      SELECT COUNT(*) as c FROM outreach_log
      WHERE contact_info LIKE ? AND date(sent_at) = date('now') AND contact_method = 'email'
    `).get(`%@${domain}`);
    return result.c;
  } catch {
    return 0;
  }
}

// === Per-ISP Rate Limits (adapted from EasyReach) ===
const ISP_HOURLY_LIMITS = {
  'gmail.com': 80,
  'googlemail.com': 80,
  'yahoo.com': 40,
  'yahoo.co.uk': 40,
  'outlook.com': 200,
  'hotmail.com': 200,
  'live.com': 200,
  'icloud.com': 150,
  'me.com': 150,
  'aol.com': 100,
  '_default': 300,
};

function getIspFromEmail(email) {
  const domain = (email || '').split('@')[1]?.toLowerCase();
  if (!domain) return '_default';
  for (const isp of Object.keys(ISP_HOURLY_LIMITS)) {
    if (domain === isp) return isp;
  }
  return '_default';
}

function getIspSendCount(database, ispDomain) {
  try {
    const likePattern = ispDomain === '_default' ? '%' : `%@${ispDomain}`;
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const result = database.prepare(`
      SELECT COUNT(*) as c FROM outreach_log
      WHERE contact_info LIKE ? AND sent_at >= ? AND contact_method = 'email'
    `).get(likePattern, hourAgo);
    return result.c;
  } catch {
    return 0;
  }
}

// === Engagement Scoring (adapted from EasyReach) ===
// Determines how fast to send follow-ups
function getEngagementTier(database, email) {
  try {
    const history = database.prepare(`
      SELECT status, sent_at FROM outreach_log
      WHERE contact_info = ? AND contact_method = 'email'
      ORDER BY sent_at DESC LIMIT 10
    `).all(email);

    if (history.length === 0) return 'new';

    const replied = history.some(h => h.status === 'replied');
    const delivered = history.filter(h => h.status === 'delivered').length;
    const totalSent = history.length;

    if (replied) return 'hot';
    if (delivered > 0 && totalSent <= 2) return 'warm';
    if (totalSent >= 3 && delivered === 0) return 'ice';
    return 'cold';
  } catch {
    return 'new';
  }
}

// Delay between emails based on engagement tier
function getEngagementDelay(tier) {
  switch (tier) {
    case 'hot': return 200 + Math.random() * 300;           // 200-500ms (fast)
    case 'warm': return 500 + Math.random() * 1000;          // 500-1500ms
    case 'new': return 1000 + Math.random() * 2000;          // 1-3s
    case 'cold': return 2000 + Math.random() * 3000;         // 2-5s
    case 'ice': return 5000 + Math.random() * 5000;          // 5-10s
    default: return 1000 + Math.random() * 2000;
  }
}

// === Humanized Burst Pattern (adapted from EasyReach) ===
// Send 3-7 emails, then pause. Looks more human than steady drip.
let burstCount = 0;
const BURST_SIZE = 3 + Math.floor(Math.random() * 5); // 3-7

function getStaggerDelay() {
  burstCount++;
  if (burstCount >= BURST_SIZE) {
    burstCount = 0;
    // Long pause between bursts (5-15 minutes)
    return (300 + Math.floor(Math.random() * 600)) * 1000;
  }
  // Short delay within burst (2-8 minutes)
  return (120 + Math.floor(Math.random() * 360)) * 1000;
}

// === Bounce Trend Detection (adapted from EasyReach) ===
function checkBounceHealth(database) {
  try {
    const stats = database.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN status = 'complained' THEN 1 ELSE 0 END) as complained
      FROM outreach_log
      WHERE contact_method = 'email' AND sent_at >= datetime('now', '-7 days')
    `).get();

    if (stats.total === 0) return { healthy: true, bounceRate: 0, complaintRate: 0 };

    const bounceRate = (stats.bounced / stats.total) * 100;
    const complaintRate = (stats.complained / stats.total) * 100;

    return {
      healthy: bounceRate < 2 && complaintRate < 0.1,
      bounceRate: Math.round(bounceRate * 100) / 100,
      complaintRate: Math.round(complaintRate * 100) / 100,
      totalSent: stats.total,
      shouldPause: bounceRate >= 5 || complaintRate >= 0.5,
      warning: bounceRate >= 2 ? 'Bounce rate above 2% — reduce sending' : null,
    };
  } catch {
    return { healthy: true, bounceRate: 0, complaintRate: 0 };
  }
}

async function generateEmail(target, database) {
  const watchlistNames = getWatchlistNames();
  const sellerCtx = SELLER_CONTEXT[target.type] || SELLER_CONTEXT.card_shop;

  const systemPrompt = `You write short outreach emails from a real person who collects Pokemon cards. You sound like a normal human texting a local shop, not a marketer.

Rules:
- Keep emails under 120 words
- Sound like a real person talking. Casual. Conversational. The way you'd actually email someone.
- NO bullet points, NO dashes, NO lists, NO em dashes, NO formatting
- NO "Best regards", NO "Sincerely", NO formal sign-offs. Just end naturally.
- NO "[Your name]" placeholder. Just end the email.
- NEVER say "I came across your shop" or "I noticed your inventory" — that sounds like a bot
- Mention 2-3 specific cards naturally in a sentence, not as a list
- Write in short paragraphs, 1-2 sentences each
- Subject line should be lowercase and casual, like a real email subject
- Respond as JSON: {"subject": "...", "body": "..."}
- The email should feel like it was typed on a phone in 30 seconds`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Write an outreach email to "${target.name}" which is a ${target.type.replace(/_/g, ' ')}.

Seller context:
- Tone: ${sellerCtx.tone}
- About them: ${sellerCtx.context}
- Our approach: ${sellerCtx.approach}
${target.location ? `- Location: ${target.location}` : ''}
${target.notes ? `- Notes: ${target.notes}` : ''}

Cards we're hunting: ${watchlistNames}

Write a natural, personalized email that fits this specific type of seller.`
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

  let rawText = response.content[0].text.trim();
  // Strip markdown code blocks if Claude wrapped the JSON
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) rawText = jsonMatch[1].trim();
  const emailData = JSON.parse(rawText);

  // Add opt-out (no dashes, casual tone)
  emailData.body += '\n\nIf you don\'t want to hear from me again just let me know, no worries at all.';

  return { ...emailData, estimatedCost };
}

async function sendEmail(target, database) {
  try {
    const config = getConfig();
    const spendCap = parseFloat(process.env.DAILY_API_SPEND_CAP_USD || '5.00');

    // Check blocklist
    try {
      const { isBlocklisted } = require('./webhookHandler');
      if (target.email && isBlocklisted(target.email)) {
        log.warn(`Skipping ${target.email} — on blocklist`);
        return { skipped: true, reason: 'blocklisted' };
      }
    } catch {
      // webhookHandler may not be loaded yet, continue
    }

    // Check spend cap
    const currentSpend = db.getDailyApiSpend(database);
    if (currentSpend.total_spend >= spendCap) {
      log.warn('Daily spend cap reached. Skipping email.');
      return { skipped: true, reason: 'spend_cap_reached' };
    }

    // Check daily email limit (with warm-up)
    const todayEmails = db.getTodayOutreachCount(database, 'email');
    const dailyLimit = getWarmupLimit(config);
    if (todayEmails >= dailyLimit) {
      log.warn(`Daily email limit reached (${todayEmails}/${dailyLimit}). Warm-up active.`);
      return { skipped: true, reason: 'daily_limit_reached' };
    }

    // Check bounce health — auto-pause if reputation is tanking
    const health = checkBounceHealth(database);
    if (health.shouldPause) {
      log.error(`PAUSING emails — bounce rate ${health.bounceRate}%, complaint rate ${health.complaintRate}%`);
      return { skipped: true, reason: 'reputation_pause', health };
    }
    if (health.warning) {
      log.warn(health.warning);
    }

    // Check per-ISP hourly rate limit
    if (target.email) {
      const isp = getIspFromEmail(target.email);
      const ispCount = getIspSendCount(database, isp === '_default' ? '_default' : isp);
      const ispLimit = ISP_HOURLY_LIMITS[isp] || ISP_HOURLY_LIMITS._default;
      if (ispCount >= ispLimit) {
        log.info(`ISP throttle: ${ispCount}/${ispLimit} to ${isp} this hour`);
        return { skipped: true, reason: 'isp_throttle', isp };
      }
    }

    // Check domain throttle (max 3 per domain per day)
    if (target.email) {
      const domainCount = getDomainSendCount(database, target.email);
      if (domainCount >= 3) {
        log.info(`Domain throttle: already sent ${domainCount} to ${target.email.split('@')[1]} today`);
        return { skipped: true, reason: 'domain_throttle' };
      }
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
    const outreachResult = db.insertOutreach(database, {
      target_name: target.name,
      target_type: target.type,
      contact_method: 'email',
      contact_info: target.email,
      subject: emailData.subject,
      message_sent: emailData.body,
      status: 'sent'
    });

    // Auto-create follow-up task to check for reply
    createFollowUpTask(database, {
      targetName: target.name,
      contactMethod: 'email',
      contactInfo: target.email,
      analysis: { interested: false, followUpNeeded: true, hasCards: false, callbackRequested: false, notes: 'Check for email reply' },
      outreachId: outreachResult.lastInsertRowid,
    });

    log.info(`Email sent to ${target.name} (${target.email})`);

    return {
      success: true,
      to: target.email,
      subject: emailData.subject,
      resendId: result.data?.id
    };
  } catch (err) {
    log.error(`Failed to send email to ${target.name} (${target.email}): ${err.message}`);

    // Still log failed outreach attempt so we don't retry immediately
    try {
      db.insertOutreach(database, {
        target_name: target.name,
        target_type: target.type,
        contact_method: 'email',
        contact_info: target.email,
        subject: `Failed: Email to ${target.name}`,
        message_sent: `Error: ${err.message}`,
        status: 'failed'
      });
    } catch (logErr) {
      log.error(`Failed to log failed outreach: ${logErr.message}`);
    }

    return { error: true, reason: err.message };
  }
}

async function getEmailStats(database) {
  const todayCount = db.getTodayOutreachCount(database, 'email');
  const monthCount = database.prepare(`
    SELECT COUNT(*) as count FROM outreach_log
    WHERE contact_method = 'email' AND strftime('%Y-%m', sent_at) = strftime('%Y-%m', 'now')
  `).get().count;

  return { sentToday: todayCount, sentThisMonth: monthCount };
}

/**
 * Send emails to multiple contacts with staggered timing
 */
async function sendEmailBatch(contacts, database) {
  const results = { sent: 0, skipped: 0, failed: 0, details: [] };

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const result = await sendEmail(contact, database);

    if (result.success) {
      results.sent++;
      results.details.push({ name: contact.name, status: 'sent' });
    } else if (result.skipped) {
      results.skipped++;
      results.details.push({ name: contact.name, status: 'skipped', reason: result.reason });
    } else {
      results.failed++;
      results.details.push({ name: contact.name, status: 'failed', reason: result.reason });
    }

    // Stagger between emails (2-10 min random delay)
    if (i < contacts.length - 1 && result.success) {
      const delay = getStaggerDelay();
      log.info(`Stagger: waiting ${Math.round(delay / 1000)}s before next email...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  log.info(`Batch complete: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);
  return results;
}

module.exports = {
  generateEmail,
  sendEmail,
  sendEmailBatch,
  getEmailStats,
  getWarmupLimit,
  checkBounceHealth,
  getEngagementTier,
  SELLER_CONTEXT,
};
