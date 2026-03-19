const db = require('../db/database');
const telegram = require('../telegram-client/telegram');
const { createChildLogger } = require('../logger');
const fs = require('fs');
const path = require('path');

const log = createChildLogger('automation');

// ── Feature 1: Auto-advance deal pipeline based on AI grade ──

const GRADE_TO_STAGE = {
  'must-buy': 'reviewing',
  'good-deal': 'reviewing',
  'suspicious': 'passed',
  'overpriced': 'passed',
  'fair': 'new',
};

function autoAdvancePipeline(database, analyses) {
  let advanced = 0;

  for (const analysis of analyses) {
    const stage = GRADE_TO_STAGE[analysis.dealGrade];
    if (!stage || stage === 'new') continue;

    try {
      db.updateListingPipelineStage(database, analysis.url, stage);
      advanced++;
      log.info(`Pipeline: ${analysis.url} → "${stage}" (grade: ${analysis.dealGrade})`);
    } catch (err) {
      log.error(`Pipeline advance failed for ${analysis.url}: ${err.message}`);
    }
  }

  if (advanced > 0) {
    log.info(`Auto-advanced ${advanced} deals in pipeline`);
  }

  return advanced;
}

// ── Feature 2: High-value deal escalation with priority Telegram alerts ──

async function escalateHighValueDeals(database) {
  const deals = db.getHighValueDeals(database, 40);

  if (deals.length === 0) {
    log.info('No high-value deals to escalate');
    return 0;
  }

  let escalated = 0;

  for (const deal of deals) {
    try {
      await sendPriorityAlert(deal);
      db.markAsAlerted(database, [deal.id]);
      escalated++;
    } catch (err) {
      log.error(`Failed to escalate deal ${deal.id}: ${err.message}`);
    }
  }

  log.info(`Escalated ${escalated} high-value deals`);
  return escalated;
}

async function sendPriorityAlert(listing) {
  const discount = listing.discount_percent ? Math.round(listing.discount_percent) : 0;
  let redFlags = [];
  if (listing.red_flags) {
    try { redFlags = JSON.parse(listing.red_flags); } catch { redFlags = []; }
  }

  const message = [
    `🚨🔥 *PRIORITY DEAL ALERT* 🔥🚨`,
    ``,
    `*${listing.card_name}*`,
    `💰 *$${listing.price}*${listing.tcg_market_price ? ` (Market: $${listing.tcg_market_price})` : ''}`,
    discount >= 40 ? `📉 *${discount}% OFF* — Act fast!` : '',
    listing.deal_grade === 'must-buy' ? `🏆 Grade: *MUST-BUY*` : `✅ Grade: ${listing.deal_grade}`,
    listing.condition ? `📦 ${listing.condition}` : '',
    `🏪 ${listing.source}${listing.seller_name ? ` — ${listing.seller_name}` : ''}`,
    `🔗 [Buy Now](${listing.url})`,
    listing.ai_summary ? `\n🤖 ${listing.ai_summary}` : '',
    redFlags.length > 0 ? `⚠️ Flags: ${redFlags.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return telegram.sendMessage(message);
}

// ── Feature 3: Auto-create follow-up tasks from outreach analysis ──

function createFollowUpTask(database, { targetName, contactMethod, contactInfo, analysis, outreachId }) {
  const tasks = [];

  if (analysis.interested) {
    tasks.push({
      task_type: 'follow_up',
      entity_type: 'outreach',
      entity_id: outreachId || null,
      title: `Follow up with ${targetName} — showed interest`,
      description: `${targetName} expressed interest via ${contactMethod}. ${analysis.notes || ''}`,
      priority: 'high',
      due_date: getFutureDate(2),
    });
  }

  if (analysis.callbackRequested) {
    tasks.push({
      task_type: 'callback',
      entity_type: 'outreach',
      entity_id: outreachId || null,
      title: `Call back ${targetName} — requested callback`,
      description: `${targetName} (${contactInfo}) asked for a callback. ${analysis.notes || ''}`,
      priority: 'high',
      due_date: getFutureDate(1),
    });
  }

  if (analysis.hasCards && !analysis.interested) {
    tasks.push({
      task_type: 'follow_up',
      entity_type: 'outreach',
      entity_id: outreachId || null,
      title: `Re-contact ${targetName} — has cards but undecided`,
      description: `${targetName} has cards but didn't commit. Try again in a week. ${analysis.notes || ''}`,
      priority: 'normal',
      due_date: getFutureDate(7),
    });
  }

  if (analysis.followUpNeeded && tasks.length === 0) {
    tasks.push({
      task_type: 'follow_up',
      entity_type: 'outreach',
      entity_id: outreachId || null,
      title: `Follow up with ${targetName}`,
      description: `Follow-up needed. ${analysis.notes || ''}`,
      priority: 'normal',
      due_date: getFutureDate(3),
    });
  }

  let created = 0;
  for (const task of tasks) {
    try {
      db.insertAutomationTask(database, task);
      created++;
      log.info(`Auto-task created: "${task.title}" (priority: ${task.priority}, due: ${task.due_date})`);
    } catch (err) {
      log.error(`Failed to create task "${task.title}": ${err.message}`);
    }
  }

  return created;
}

// ── Feature 4: Smart watchlist suggestions based on price trends ──

async function analyzeWatchlistTrends(database) {
  const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');

  let watchlist;
  try {
    watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
  } catch {
    log.warn('No watchlist.json found — skipping trend analysis');
    return { suggestions: [] };
  }

  const suggestions = [];

  for (const card of watchlist) {
    const trend = db.getPriceTrend(database, card.name, 30);
    if (!trend) continue;

    // If avg price is consistently above maxPrice, suggest removing
    if (card.maxPrice && trend.avg > card.maxPrice * 1.3) {
      suggestions.push({
        card: card.name,
        action: 'remove',
        reason: `Avg price $${trend.avg.toFixed(2)} is 30%+ above your max ($${card.maxPrice}). ${trend.dataPoints} data points over 30 days.`,
        trend: trend.changePercent.toFixed(1) + '%',
      });
    }

    // If price is trending down significantly, suggest watching closer
    if (trend.changePercent < -15 && trend.dataPoints >= 3) {
      suggestions.push({
        card: card.name,
        action: 'watch_closer',
        reason: `Price dropped ${Math.abs(trend.changePercent).toFixed(1)}% over 30 days ($${trend.first.toFixed(2)} → $${trend.last.toFixed(2)}). Good buying opportunity soon.`,
        trend: trend.changePercent.toFixed(1) + '%',
      });
    }

    // If price is trending up fast, suggest buying now
    if (trend.changePercent > 20 && trend.dataPoints >= 3) {
      suggestions.push({
        card: card.name,
        action: 'buy_now',
        reason: `Price up ${trend.changePercent.toFixed(1)}% in 30 days ($${trend.first.toFixed(2)} → $${trend.last.toFixed(2)}). May keep rising.`,
        trend: trend.changePercent.toFixed(1) + '%',
      });
    }
  }

  // Send Telegram summary if there are suggestions
  if (suggestions.length > 0) {
    await sendWatchlistSuggestions(suggestions);
  }

  log.info(`Watchlist analysis: ${suggestions.length} suggestions from ${watchlist.length} cards`);
  return { suggestions };
}

async function sendWatchlistSuggestions(suggestions) {
  const actionEmoji = { remove: '❌', watch_closer: '👀', buy_now: '🛒' };
  const actionLabel = { remove: 'Consider Removing', watch_closer: 'Watch Closely', buy_now: 'Buy Now' };

  const lines = suggestions.map(s =>
    `${actionEmoji[s.action] || '📊'} *${s.card}* — ${actionLabel[s.action] || s.action}\n   ${s.reason}`
  );

  const message = [
    `📊 *Smart Watchlist Report*`,
    ``,
    ...lines,
  ].join('\n');

  return telegram.sendMessage(message);
}

// ── Helpers ──

function getFutureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Run all automation ──

async function runAll(database) {
  log.info('Running automation engine...');
  const results = {};

  // Feature 2: Escalate high-value deals
  try {
    results.escalated = await escalateHighValueDeals(database);
  } catch (err) {
    log.error(`Escalation failed: ${err.message}`);
    results.escalated = 0;
  }

  // Feature 4: Watchlist trends
  try {
    const watchlistResult = await analyzeWatchlistTrends(database);
    results.watchlistSuggestions = watchlistResult.suggestions.length;
  } catch (err) {
    log.error(`Watchlist analysis failed: ${err.message}`);
    results.watchlistSuggestions = 0;
  }

  // Feature 3: Check for pending follow-up tasks and notify
  try {
    const pending = db.getPendingAutomationTasks(database);
    const dueSoon = pending.filter(t => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      const now = new Date();
      const diffHours = (due - now) / (1000 * 60 * 60);
      return diffHours <= 24 && diffHours > 0;
    });

    if (dueSoon.length > 0) {
      const taskList = dueSoon.map(t => `• ${t.title} (${t.priority})`).join('\n');
      await telegram.sendMessage(`📋 *Tasks Due Soon*\n\n${taskList}`);
    }
    results.tasksDueSoon = dueSoon.length;
  } catch (err) {
    log.error(`Task notification failed: ${err.message}`);
    results.tasksDueSoon = 0;
  }

  log.info(`Automation complete: ${JSON.stringify(results)}`);
  return results;
}

module.exports = {
  autoAdvancePipeline,
  escalateHighValueDeals,
  sendPriorityAlert,
  createFollowUpTask,
  analyzeWatchlistTrends,
  runAll,
};
