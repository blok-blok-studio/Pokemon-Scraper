const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

const log = createChildLogger('data-pruner');

const EXPORTS_DIR = path.join(__dirname, '..', '..', 'data', 'exports');

function getRetentionConfig() {
  try {
    const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config.retentionDays || {};
  } catch {
    return {};
  }
}

function pruneOldListings(database, days = 90) {
  const result = database.prepare(`
    DELETE FROM card_listings
    WHERE found_at < datetime('now', '-' || ? || ' days')
    AND pipeline_stage NOT IN ('purchased', 'reviewing', 'approved')
  `).run(days);

  log.info(`Pruned ${result.changes} old listings (>${days} days, not purchased/reviewing/approved)`);
  return result.changes;
}

function aggregatePriceHistory(database, days = 180) {
  // Get old raw records that should be aggregated into weekly averages
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const oldRecords = database.prepare(`
    SELECT card_name, set_name, source,
           strftime('%Y-%W', recorded_at) as week,
           AVG(price) as avg_price,
           COUNT(*) as count
    FROM price_history
    WHERE recorded_at < ?
    GROUP BY card_name, set_name, source, week
    HAVING count > 1
  `).all(cutoff);

  if (oldRecords.length === 0) {
    log.info('No price history to aggregate');
    return 0;
  }

  let aggregated = 0;

  for (const record of oldRecords) {
    // Delete individual records for this group
    const deleted = database.prepare(`
      DELETE FROM price_history
      WHERE card_name = ? AND (set_name = ? OR (set_name IS NULL AND ? IS NULL))
      AND source = ? AND strftime('%Y-%W', recorded_at) = ?
      AND recorded_at < ?
    `).run(record.card_name, record.set_name, record.set_name, record.source, record.week, cutoff);

    // Insert single aggregated record
    database.prepare(`
      INSERT INTO price_history (card_name, set_name, source, price, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(record.card_name, record.set_name, record.source, record.avg_price, cutoff);

    aggregated += deleted.changes - 1; // Net reduction
  }

  log.info(`Aggregated price history: ${aggregated} records compressed`);
  return aggregated;
}

function pruneApiUsage(database, days = 90) {
  // First save monthly summaries
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const result = database.prepare(`
    DELETE FROM api_usage
    WHERE called_at < ?
  `).run(cutoff);

  log.info(`Pruned ${result.changes} old API usage records (>${days} days)`);
  return result.changes;
}

function pruneCompletedTasks(database, days = 30) {
  const result = database.prepare(`
    DELETE FROM automation_tasks
    WHERE status = 'completed'
    AND completed_at < datetime('now', '-' || ? || ' days')
  `).run(days);

  log.info(`Pruned ${result.changes} completed tasks (>${days} days)`);
  return result.changes;
}

function cleanupExports(days = 30) {
  if (!fs.existsSync(EXPORTS_DIR)) return 0;

  const cutoff = Date.now() - days * 86400000;
  let cleaned = 0;

  const files = fs.readdirSync(EXPORTS_DIR);
  for (const file of files) {
    const filePath = path.join(EXPORTS_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch {}
  }

  if (cleaned > 0) log.info(`Cleaned up ${cleaned} old export files (>${days} days)`);
  return cleaned;
}

function runAll(database) {
  const retention = getRetentionConfig();

  log.info('Starting data pruning...');

  const results = {
    listings: pruneOldListings(database, retention.listings || 90),
    priceHistory: aggregatePriceHistory(database, retention.priceHistoryRaw || 180),
    apiUsage: pruneApiUsage(database, retention.apiUsage || 90),
    tasks: pruneCompletedTasks(database, retention.completedTasks || 30),
    exports: cleanupExports(retention.exports || 30),
  };

  log.info(`Data pruning complete: ${JSON.stringify(results)}`);
  return results;
}

// CLI support
if (require.main === module) {
  const database = db.init();
  try {
    const results = runAll(database);
    console.log('Data pruning results:', JSON.stringify(results, null, 2));
  } finally {
    database.close();
  }
}

module.exports = { runAll, pruneOldListings, aggregatePriceHistory, pruneApiUsage, pruneCompletedTasks, cleanupExports };
