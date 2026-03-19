const { stringify } = require('csv-stringify/sync');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

const log = createChildLogger('exporter');

const EXPORTS_DIR = path.join(__dirname, '..', '..', 'data', 'exports');

function ensureExportsDir() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:\-T]/g, '').split('.')[0];
}

function exportDealsCSV(database, options = {}) {
  const {
    minDiscount = 0,
    startDate = new Date(Date.now() - 30 * 86400000).toISOString(),
    endDate = new Date().toISOString(),
    source = null,
    gradeFilter = null,
    outputPath = null,
  } = options;

  ensureExportsDir();

  let query = `SELECT * FROM card_listings WHERE found_at >= ? AND found_at <= ?`;
  const params = [startDate, endDate];

  if (minDiscount > 0) {
    query += ` AND discount_percent >= ?`;
    params.push(minDiscount);
  }
  if (source) {
    query += ` AND source = ?`;
    params.push(source);
  }
  if (gradeFilter && gradeFilter.length > 0) {
    query += ` AND deal_grade IN (${gradeFilter.map(() => '?').join(',')})`;
    params.push(...gradeFilter);
  }

  query += ` ORDER BY found_at DESC`;

  const rows = database.prepare(query).all(...params);

  const csvData = rows.map(r => ({
    'Card Name': r.card_name,
    'Set': r.set_name || '',
    'Price ($)': r.price,
    'Market Price ($)': r.tcg_market_price || '',
    'Discount (%)': r.discount_percent ? Math.round(r.discount_percent * 10) / 10 : '',
    'Deal Grade': r.deal_grade || '',
    'AI Summary': r.ai_summary || '',
    'Red Flags': r.red_flags || '',
    'Condition': r.condition || '',
    'Source': r.source,
    'Seller': r.seller_name || '',
    'Listing URL': r.url,
    'Found Date': r.found_at,
  }));

  const csv = stringify(csvData, { header: true });
  const filePath = outputPath || path.join(EXPORTS_DIR, `deals_${timestamp()}.csv`);
  fs.writeFileSync(filePath, csv);

  const fileSize = fs.statSync(filePath).size;
  log.info(`Exported ${rows.length} deals to ${filePath} (${fileSize} bytes)`);

  return { rowCount: rows.length, filePath, fileSize };
}

function exportOutreachCSV(database, options = {}) {
  const {
    startDate = new Date(Date.now() - 30 * 86400000).toISOString(),
    endDate = new Date().toISOString(),
    status = null,
    method = null,
    outputPath = null,
  } = options;

  ensureExportsDir();

  let query = `SELECT * FROM outreach_log WHERE sent_at >= ? AND sent_at <= ?`;
  const params = [startDate, endDate];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (method) {
    query += ` AND contact_method = ?`;
    params.push(method);
  }

  query += ` ORDER BY sent_at DESC`;

  const rows = database.prepare(query).all(...params);

  const csvData = rows.map(r => ({
    'Target Name': r.target_name,
    'Target Type': r.target_type,
    'Contact Method': r.contact_method,
    'Contact Info': r.contact_info,
    'Status': r.status,
    'Message Sent': (r.message_sent || '').substring(0, 200),
    'Sent Date': r.sent_at,
    'Updated Date': r.updated_at || '',
  }));

  const csv = stringify(csvData, { header: true });
  const filePath = outputPath || path.join(EXPORTS_DIR, `outreach_${timestamp()}.csv`);
  fs.writeFileSync(filePath, csv);

  const fileSize = fs.statSync(filePath).size;
  log.info(`Exported ${rows.length} outreach records to ${filePath} (${fileSize} bytes)`);

  return { rowCount: rows.length, filePath, fileSize };
}

function exportPriceHistoryCSV(database, cardName, days = 30, outputPath = null) {
  ensureExportsDir();

  let query, params;
  if (!cardName || cardName === '*') {
    query = `SELECT * FROM price_history WHERE recorded_at >= datetime('now', '-' || ? || ' days') ORDER BY card_name, recorded_at DESC`;
    params = [days];
  } else {
    query = `SELECT * FROM price_history WHERE card_name LIKE ? AND recorded_at >= datetime('now', '-' || ? || ' days') ORDER BY recorded_at DESC`;
    params = [`%${cardName}%`, days];
  }

  const rows = database.prepare(query).all(...params);

  const csvData = rows.map(r => ({
    'Card Name': r.card_name,
    'Set': r.set_name || '',
    'Source': r.source,
    'Price ($)': r.price,
    'Recorded Date': r.recorded_at,
  }));

  const csv = stringify(csvData, { header: true });
  const label = cardName && cardName !== '*' ? cardName.replace(/\s+/g, '_') : 'all';
  const filePath = outputPath || path.join(EXPORTS_DIR, `prices_${label}_${timestamp()}.csv`);
  fs.writeFileSync(filePath, csv);

  const fileSize = fs.statSync(filePath).size;
  log.info(`Exported ${rows.length} price records to ${filePath} (${fileSize} bytes)`);

  return { rowCount: rows.length, filePath, fileSize };
}

function generateDealReport(database, days = 7) {
  ensureExportsDir();

  const startDate = new Date(Date.now() - days * 86400000).toISOString();

  // Total listings
  const totalListings = database.prepare(`SELECT COUNT(*) as count FROM card_listings WHERE found_at >= ?`).get(startDate).count;

  // Deals by grade
  const gradeRows = database.prepare(`
    SELECT deal_grade, COUNT(*) as count FROM card_listings
    WHERE found_at >= ? AND deal_grade IS NOT NULL
    GROUP BY deal_grade
  `).all(startDate);
  const grades = {};
  for (const r of gradeRows) grades[r.deal_grade] = r.count;

  // Top 10 deals
  const topDeals = database.prepare(`
    SELECT card_name, price, tcg_market_price, discount_percent
    FROM card_listings
    WHERE found_at >= ? AND discount_percent > 0
    ORDER BY discount_percent DESC
    LIMIT 10
  `).all(startDate);

  // Average discount
  const avgDiscount = database.prepare(`
    SELECT AVG(discount_percent) as avg FROM card_listings
    WHERE found_at >= ? AND discount_percent > 0
  `).get(startDate).avg || 0;

  // Most active source
  const topSource = database.prepare(`
    SELECT source, COUNT(*) as count FROM card_listings
    WHERE found_at >= ?
    GROUP BY source ORDER BY count DESC LIMIT 1
  `).get(startDate);

  // Outreach summary
  const emailsSent = database.prepare(`SELECT COUNT(*) as count FROM outreach_log WHERE contact_method = 'email' AND sent_at >= ?`).get(startDate).count;
  const callsMade = database.prepare(`SELECT COUNT(*) as count FROM outreach_log WHERE contact_method = 'voice' AND sent_at >= ?`).get(startDate).count;
  const replies = database.prepare(`SELECT COUNT(*) as count FROM outreach_log WHERE status = 'replied' AND sent_at >= ?`).get(startDate).count;

  // API spend
  const spend = database.prepare(`SELECT COALESCE(SUM(estimated_cost_usd), 0) as total FROM api_usage WHERE called_at >= ?`).get(startDate).total;

  // Build report
  const lines = [
    `📊 Deal Report — Last ${days} Days`,
    `Period: ${new Date(startDate).toLocaleDateString()} — ${new Date().toLocaleDateString()}`,
    '',
    `📦 Total listings found: ${totalListings}`,
    '',
    '🏷️ Deals by Grade:',
    `  🔥 Must-buy: ${grades['must-buy'] || 0}`,
    `  ✅ Good-deal: ${grades['good-deal'] || 0}`,
    `  ➡️ Fair: ${grades['fair'] || 0}`,
    `  ⬆️ Overpriced: ${grades['overpriced'] || 0}`,
    `  ⚠️ Suspicious: ${grades['suspicious'] || 0}`,
    '',
    `📉 Average discount: ${avgDiscount.toFixed(1)}%`,
    topSource ? `🏪 Most active source: ${topSource.source} (${topSource.count} listings)` : '',
    '',
    '🏆 Top 10 Deals:',
  ];

  topDeals.forEach((d, i) => {
    lines.push(`  ${i + 1}. ${d.card_name} — $${d.price} (Market: $${d.tcg_market_price || '?'}, ${Math.round(d.discount_percent)}% off)`);
  });

  lines.push('');
  lines.push('📬 Outreach Summary:');
  lines.push(`  Emails sent: ${emailsSent}`);
  lines.push(`  Calls made: ${callsMade}`);
  lines.push(`  Replies received: ${replies}`);
  lines.push('');
  lines.push(`💰 API spend: $${spend.toFixed(2)}`);

  const report = lines.filter(l => l !== undefined).join('\n');
  const filePath = path.join(EXPORTS_DIR, `report_${timestamp()}.txt`);
  fs.writeFileSync(filePath, report);

  log.info(`Generated deal report (${days} days) → ${filePath}`);
  return { report, savedTo: filePath };
}

module.exports = { exportDealsCSV, exportOutreachCSV, exportPriceHistoryCSV, generateDealReport };
