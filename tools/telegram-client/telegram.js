const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { telegramQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

dotenv.config();

const log = createChildLogger('telegram');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function createBot(polling = false) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set in .env');
  if (!CHAT_ID) throw new Error('TELEGRAM_CHAT_ID not set in .env');
  return new TelegramBot(BOT_TOKEN, { polling });
}

async function sendMessage(text) {
  const bot = createBot();
  return telegramQueue.add(async () => {
    log.info(`Sending message: ${text.substring(0, 50)}...`);
    const result = await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
    return result;
  });
}

async function sendDealAlert(listing) {
  const gradeEmoji = {
    'must-buy': '🔥', 'good-deal': '✅', 'fair': '➡️',
    'overpriced': '⬆️', 'suspicious': '⚠️'
  };

  const emoji = gradeEmoji[listing.deal_grade] || '🃏';
  const redFlags = listing.red_flags ? JSON.parse(listing.red_flags || '[]') : [];

  const message = [
    `${emoji} *${(listing.deal_grade || 'UNGRADED').toUpperCase()}* — ${listing.card_name}`,
    `💰 Price: $${listing.price}${listing.tcg_market_price ? ` (Market: $${listing.tcg_market_price})` : ''}`,
    listing.discount_percent ? `📉 Discount: ${Math.round(listing.discount_percent)}% off` : '',
    listing.condition ? `📦 Condition: ${listing.condition}` : '',
    `🏪 Source: ${listing.source}${listing.seller_name ? ` | Seller: ${listing.seller_name}` : ''}`,
    `🔗 [View Listing](${listing.url})`,
    listing.ai_summary ? `🤖 AI: "${listing.ai_summary}"` : '',
    redFlags.length > 0 ? `⚠️ Red flags: ${redFlags.join(', ')}` : '⚠️ Red flags: none'
  ].filter(Boolean).join('\n');

  return sendMessage(message);
}

async function sendDailySummary(stats) {
  const message = [
    '📊 *Daily Summary*',
    `Cards scanned: ${stats.totalScraped || 0}`,
    `New deals found: ${stats.dealsFound || 0}`,
    stats.bestDeal ? `Best deal: ${stats.bestDeal}` : '',
    `Outreach sent: ${stats.emailsSent || 0} emails, ${stats.callsMade || 0} calls`,
    `API spend today: $${(stats.apiSpend || 0).toFixed(2)}`,
    stats.uptime ? `Agent uptime: ${stats.uptime}` : ''
  ].filter(Boolean).join('\n');

  return sendMessage(message);
}

async function sendOutreachUpdate(outreach) {
  const message = `📬 *Outreach Update*\n${outreach.target_name} (${outreach.contact_method}): ${outreach.status}\n${outreach.notes || ''}`;
  return sendMessage(message);
}

async function sendError(error) {
  const message = `🚨 *Error*\n${error}`;
  return sendMessage(message);
}

function startListener() {
  const bot = createBot(true);
  const db = require('../db/database');
  const database = db.init();

  log.info('Telegram bot listener started');

  bot.onText(/\/status/, async (msg) => {
    try {
      const stats = db.getStats(database);
      const spend = db.getDailyApiSpend(database);
      const cap = parseFloat(process.env.DAILY_API_SPEND_CAP_USD || '5.00');

      const response = [
        '🃏 *Agent Status*',
        `Status: ✅ Running`,
        `Total listings: ${stats.totalListings}`,
        `Total deals: ${stats.totalDeals}`,
        `Today outreach: ${stats.todayOutreach}`,
        `API spend: $${spend.total_spend.toFixed(2)} / $${cap.toFixed(2)}`
      ].join('\n');

      await bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/status error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/deals/, async (msg) => {
    try {
      const deals = db.getRecentDeals(database, 5);
      if (deals.length === 0) {
        await bot.sendMessage(msg.chat.id, 'No deals found yet.');
        return;
      }

      const response = deals.map((d, i) =>
        `${i + 1}. *${d.card_name}* — $${d.price}${d.discount_percent ? ` (${Math.round(d.discount_percent)}% off)` : ''}\n   [View](${d.url})`
      ).join('\n\n');

      await bot.sendMessage(msg.chat.id, `🃏 *Top Deals*\n\n${response}`, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/deals error: ${err.message}`);
    }
  });

  bot.onText(/\/watchlist/, async (msg) => {
    try {
      const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');
      const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));

      const response = watchlist.map((c, i) =>
        `${i + 1}. *${c.name}* — ${c.set || 'Any set'} (max $${c.maxPrice})`
      ).join('\n');

      await bot.sendMessage(msg.chat.id, `📋 *Watchlist*\n\n${response}`, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/watchlist error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error reading watchlist: ${err.message}`);
    }
  });

  bot.onText(/\/add (.+)/, async (msg, match) => {
    try {
      const cardName = match[1].trim();
      const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');
      const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));

      if (watchlist.length >= 50) {
        await bot.sendMessage(msg.chat.id, 'Watchlist is at maximum capacity (50 cards).');
        return;
      }

      watchlist.push({ name: cardName, set: null, maxPrice: 100 });
      fs.writeFileSync(watchlistPath, JSON.stringify(watchlist, null, 2));

      await bot.sendMessage(msg.chat.id, `✅ Added *${cardName}* to watchlist with max price $100`, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/add error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/remove (.+)/, async (msg, match) => {
    try {
      const cardName = match[1].trim().toLowerCase();
      const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');
      const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));

      const index = watchlist.findIndex(c => c.name.toLowerCase().includes(cardName));
      if (index === -1) {
        await bot.sendMessage(msg.chat.id, `Card "${match[1].trim()}" not found on watchlist.`);
        return;
      }

      const removed = watchlist.splice(index, 1)[0];
      fs.writeFileSync(watchlistPath, JSON.stringify(watchlist, null, 2));

      await bot.sendMessage(msg.chat.id, `✅ Removed *${removed.name}* from watchlist`, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/remove error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/spend/, async (msg) => {
    try {
      const spendData = db.getSpendByService(database);
      const cap = parseFloat(process.env.DAILY_API_SPEND_CAP_USD || '5.00');
      const dailyTotal = spendData.today.reduce((sum, s) => sum + s.spend, 0);
      const monthlyTotal = spendData.month.reduce((sum, s) => sum + s.spend, 0);

      let response = `💰 *API Spend*\n\n*Today ($${dailyTotal.toFixed(2)} / $${cap.toFixed(2)}):*\n`;
      for (const s of spendData.today) {
        response += `  ${s.service}: ${s.calls} calls, $${s.spend.toFixed(4)}\n`;
      }
      response += `\n*This Month: $${monthlyTotal.toFixed(2)}*\n`;
      for (const s of spendData.month) {
        response += `  ${s.service}: ${s.calls} calls, $${s.spend.toFixed(4)}\n`;
      }

      await bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/spend error: ${err.message}`);
    }
  });

  bot.onText(/\/help/, async (msg) => {
    const helpText = [
      '🃏 *Pokemon Card Agent Commands*',
      '',
      '/status — Agent status and overview',
      '/deals — Top 5 recent deals',
      '/watchlist — Show current watchlist',
      '/add <card name> — Add card to watchlist',
      '/remove <card name> — Remove card from watchlist',
      '/spend — API spend breakdown',
      '/help — Show this help message'
    ].join('\n');

    await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
  });

  return bot;
}

module.exports = { sendMessage, sendDealAlert, sendDailySummary, sendOutreachUpdate, sendError, startListener };
