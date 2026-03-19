const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { telegramQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

dotenv.config({ override: true });

const log = createChildLogger('telegram');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function createBot(polling = false) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set in .env');
  if (!CHAT_ID) throw new Error('TELEGRAM_CHAT_ID not set in .env');
  return new TelegramBot(BOT_TOKEN, { polling });
}

async function sendMessage(text) {
  try {
    const bot = createBot();
    return await telegramQueue.add(async () => {
      log.info(`Sending message: ${text.substring(0, 50)}...`);
      const result = await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
      return result;
    });
  } catch (err) {
    log.error(`Failed to send Telegram message: ${err.message}`);
    return null;
  }
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

  bot.onText(/\/tasks/, async (msg) => {
    try {
      const pending = db.getPendingAutomationTasks(database);
      if (pending.length === 0) {
        await bot.sendMessage(msg.chat.id, 'No pending automation tasks.');
        return;
      }

      const priorityEmoji = { high: '🔴', normal: '🟡', low: '🟢' };
      const response = pending.slice(0, 10).map((t, i) =>
        `${i + 1}. ${priorityEmoji[t.priority] || '⚪'} ${t.title}${t.due_date ? `\n   Due: ${t.due_date}` : ''}`
      ).join('\n\n');

      await bot.sendMessage(msg.chat.id, `📋 *Pending Tasks* (${pending.length})\n\n${response}`, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/tasks error: ${err.message}`);
    }
  });

  bot.onText(/\/buy (.+)/, async (msg, match) => {
    try {
      const parts = match[1].trim().split(/\s+/);
      let listingId = null;
      let price = null;
      let cardName = null;

      // Try: /buy <listing-id> <price> or /buy --card "Name" --price <price>
      if (parts.length >= 2 && !isNaN(parseInt(parts[0]))) {
        listingId = parseInt(parts[0]);
        price = parseFloat(parts[1]);
        // Get card name from listing
        const listing = database.prepare('SELECT card_name, set_name, seller_name, source FROM card_listings WHERE id = ?').get(listingId);
        if (listing) {
          cardName = listing.card_name;
          const result = db.insertPurchase(database, {
            listing_id: listingId,
            card_name: listing.card_name,
            set_name: listing.set_name,
            purchase_price: price,
            purchase_source: listing.source,
            seller_name: listing.seller_name,
          });
          await bot.sendMessage(msg.chat.id, `✅ Purchased *${listing.card_name}* for $${price.toFixed(2)}`, { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(msg.chat.id, `Listing #${listingId} not found.`);
        }
      } else {
        await bot.sendMessage(msg.chat.id, 'Usage: /buy <listing-id> <price>');
      }
    } catch (err) {
      log.error(`/buy error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/sell (.+)/, async (msg, match) => {
    try {
      const parts = match[1].trim().split(/\s+/);
      if (parts.length < 2) {
        await bot.sendMessage(msg.chat.id, 'Usage: /sell <purchase-id> <price>');
        return;
      }
      const purchaseId = parseInt(parts[0]);
      const soldPrice = parseFloat(parts[1]);

      const purchase = database.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
      if (!purchase) {
        await bot.sendMessage(msg.chat.id, `Purchase #${purchaseId} not found.`);
        return;
      }

      db.sellPurchase(database, purchaseId, { sold_price: soldPrice });
      const profit = soldPrice - purchase.purchase_price - (purchase.shipping_cost || 0) - (purchase.fees || 0);

      await bot.sendMessage(msg.chat.id, `✅ Sold *${purchase.card_name}* for $${soldPrice.toFixed(2)}\n💰 Profit: $${profit.toFixed(2)}`, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/sell error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/portfolio/, async (msg) => {
    try {
      const summary = db.getPortfolioSummary(database);

      if (summary.totalPurchases === 0) {
        await bot.sendMessage(msg.chat.id, '📊 No purchases recorded yet. Use /buy to record a purchase.');
        return;
      }

      const response = [
        '📊 *Portfolio Summary*',
        '',
        `Total purchases: ${summary.totalPurchases}`,
        `In collection: ${summary.unsoldCount} | Sold: ${summary.soldCount}`,
        `💰 Total invested: $${summary.totalInvested.toFixed(2)}`,
        `📈 Current value: $${summary.currentValue.toFixed(2)}`,
        `${summary.unrealizedGain >= 0 ? '🟢' : '🔴'} Unrealized: $${summary.unrealizedGain.toFixed(2)}`,
        `💵 Realized profit: $${summary.totalProfit.toFixed(2)}`,
        `📊 ROI: ${summary.roiPercent.toFixed(1)}%`,
        summary.bestPerformer ? `\n🏆 Best: ${summary.bestPerformer.card_name} (+${summary.bestPerformer.gainPercent.toFixed(0)}%)` : '',
        summary.worstPerformer && summary.worstPerformer !== summary.bestPerformer ? `📉 Worst: ${summary.worstPerformer.card_name} (${summary.worstPerformer.gainPercent.toFixed(0)}%)` : '',
      ].filter(Boolean).join('\n');

      await bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/portfolio error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/inventory/, async (msg) => {
    try {
      const inventory = db.getUnsoldInventory(database);
      if (inventory.length === 0) {
        await bot.sendMessage(msg.chat.id, '📦 No cards in inventory.');
        return;
      }

      const lines = inventory.slice(0, 10).map((p, i) => {
        const value = p.current_market_price ? `$${p.current_market_price}` : '?';
        const gain = p.current_market_price ? ((p.current_market_price - p.purchase_price) / p.purchase_price * 100).toFixed(0) + '%' : '?';
        return `${i + 1}. *${p.card_name}* — Paid $${p.purchase_price} | Now ${value} (${gain})`;
      });

      const response = `📦 *Inventory* (${inventory.length} cards)\n\n${lines.join('\n')}`;
      await bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/inventory error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/lead (.+)/, async (msg, match) => {
    try {
      const parts = match[1].trim().split(/\s+/);
      if (parts.length < 3) {
        await bot.sendMessage(msg.chat.id, 'Usage: /lead <url> <price> <card name>');
        return;
      }

      const url = parts[0];
      const price = parseFloat(parts[1]);
      const cardName = parts.slice(2).join(' ');

      if (!url.startsWith('http')) {
        await bot.sendMessage(msg.chat.id, 'URL must start with http. Usage: /lead <url> <price> <card name>');
        return;
      }
      if (isNaN(price) || price <= 0) {
        await bot.sendMessage(msg.chat.id, 'Price must be a positive number. Usage: /lead <url> <price> <card name>');
        return;
      }
      if (!cardName) {
        await bot.sendMessage(msg.chat.id, 'Card name is required. Usage: /lead <url> <price> <card name>');
        return;
      }

      // Insert listing into database
      db.insertListing(database, {
        source: 'facebook',
        card_name: cardName,
        price,
        url,
        seller_name: 'Facebook Marketplace',
      });

      // Try to look up market price
      let marketPrice = null;
      let discountPercent = null;
      try {
        const { lookupPriceRateLimited } = require('../scraper-engine/tcgplayer');
        const priceResult = await lookupPriceRateLimited(cardName);
        if (priceResult && priceResult.marketPrice) {
          marketPrice = priceResult.marketPrice;
          discountPercent = ((marketPrice - price) / marketPrice * 100).toFixed(1);
        }
      } catch (e) {
        log.warn(`Could not look up market price for lead "${cardName}": ${e.message}`);
      }

      let response = [
        '📋 *Lead Entered*',
        `🃏 Card: ${cardName}`,
        `💰 Price: $${price.toFixed(2)}${marketPrice ? ` (Market: $${marketPrice.toFixed(2)})` : ' (Market: unknown)'}`,
        discountPercent && parseFloat(discountPercent) > 0 ? `📉 Discount: ${discountPercent}%` : '',
        `🔗 [Link](${url})`,
      ].filter(Boolean).join('\n');

      if (!marketPrice) {
        response += '\nℹ️ Could not find TCG market price — manual review recommended';
      }

      await bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/lead error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/health/, async (msg) => {
    try {
      const { getHealthReport } = require('../maintenance/healthCheck');
      const report = getHealthReport(database);

      const statusEmoji = { healthy: '🟢', warning: '🟡', critical: '🔴' };
      const lines = [
        `${statusEmoji[report.status] || '❓'} *Agent Health: ${report.status.toUpperCase()}*`,
        '',
        `💾 Disk free: ${report.diskFreeGB !== null ? report.diskFreeGB + 'GB' : 'unknown'}`,
        `🧠 Memory: ${report.memoryUsageMB}MB`,
        `📁 Database: ${report.databaseSizeMB}MB`,
        `📝 Log file: ${report.logFileSizeMB}MB`,
        `⏱️ Uptime: ${report.uptimeHours}h`,
        report.lastScrapeAt ? `🔍 Last scrape: ${new Date(report.lastScrapeAt).toLocaleString()}` : '',
      ];

      // Circuit breaker status
      const cbEntries = Object.entries(report.circuitBreakers);
      if (cbEntries.length > 0) {
        lines.push('', '🔌 *Circuit Breakers:*');
        for (const [name, status] of cbEntries) {
          const emoji = status.state === 'CLOSED' ? '✅' : status.state === 'OPEN' ? '🔴' : '🟡';
          lines.push(`  ${emoji} ${name}: ${status.state} (${status.failures} failures)`);
        }
      }

      if (report.warnings.length > 0) {
        lines.push('', '⚠️ *Warnings:*');
        report.warnings.forEach(w => lines.push(`  • ${w}`));
      }

      await bot.sendMessage(msg.chat.id, lines.filter(Boolean).join('\n'), { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/health error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/proxies/, async (msg) => {
    try {
      const proxyManager = require('../scraper-engine/proxyManager');
      const stats = proxyManager.getProxyStats();

      if (stats.total === 0) {
        await bot.sendMessage(msg.chat.id, '🔄 *Proxy Status*\n\nNo proxies configured. Add proxies to config/proxies.json.', { parse_mode: 'Markdown' });
        return;
      }

      const statusEmoji = { available: '✅', cooling_down: '⏳', dead: '💀' };
      const proxyList = stats.proxies.map(p =>
        `${statusEmoji[p.status] || '❓'} ${p.label}: ${p.status} (${p.totalRequests} req, ${p.totalBlocks} blocks)`
      ).join('\n');

      const response = [
        '🔄 *Proxy Status*',
        `Total: ${stats.total} | Available: ${stats.available} | Cooling: ${stats.coolingDown} | Dead: ${stats.dead}`,
        '',
        proxyList,
      ].join('\n');

      await bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    } catch (err) {
      log.error(`/proxies error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/export (.+)/, async (msg, match) => {
    try {
      const parts = match[1].trim().split(/\s+/);
      const type = parts[0];
      const days = parseInt(parts[1]) || 30;
      const { exportDealsCSV, exportOutreachCSV } = require('../export/exporter');
      const startDate = new Date(Date.now() - days * 86400000).toISOString();

      let result;
      if (type === 'deals') {
        result = exportDealsCSV(database, { startDate });
      } else if (type === 'outreach') {
        result = exportOutreachCSV(database, { startDate });
      } else {
        await bot.sendMessage(msg.chat.id, 'Usage: /export deals [days] or /export outreach [days]');
        return;
      }

      if (result.rowCount === 0) {
        await bot.sendMessage(msg.chat.id, `📊 No ${type} data found for the last ${days} days.`);
        return;
      }

      await bot.sendDocument(msg.chat.id, result.filePath, {
        caption: `📊 Exported ${result.rowCount} ${type} from the last ${days} days`,
      });
    } catch (err) {
      log.error(`/export error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/report(?:\s+(\d+))?$/, async (msg, match) => {
    try {
      const days = parseInt(match[1]) || 7;
      const { generateDealReport } = require('../export/exporter');
      const result = generateDealReport(database, days);

      if (result.report.length <= 4096) {
        await bot.sendMessage(msg.chat.id, result.report, { parse_mode: undefined });
      } else {
        await bot.sendDocument(msg.chat.id, result.savedTo, {
          caption: `📊 Deal report for the last ${days} days`,
        });
      }
    } catch (err) {
      log.error(`/report error: ${err.message}`);
      await bot.sendMessage(msg.chat.id, `Error: ${err.message}`);
    }
  });

  bot.onText(/\/help/, async (msg) => {
    const helpText = [
      '🃏 *Pokemon Card Agent Commands*',
      '',
      '/status — Agent status and overview',
      '/deals — Top 5 recent deals',
      '/tasks — View pending automation tasks',
      '/watchlist — Show current watchlist',
      '/add <card name> — Add card to watchlist',
      '/remove <card name> — Remove card from watchlist',
      '/spend — API spend breakdown',
      '/proxies — Proxy pool status',
      '/buy <listing-id> <price> — Record a purchase',
      '/sell <purchase-id> <price> — Record a sale',
      '/portfolio — Portfolio summary & ROI',
      '/inventory — Cards in collection',
      '/lead <url> <price> <card> — Manual lead entry (FB Marketplace)',
      '/export deals [days] — Send deals CSV',
      '/export outreach [days] — Send outreach CSV',
      '/report [days] — Deal summary report',
      '/health — System health & circuit breakers',
      '/help — Show this help message'
    ].join('\n');

    await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
  });

  return bot;
}

module.exports = { sendMessage, sendDealAlert, sendDailySummary, sendOutreachUpdate, sendError, startListener };
