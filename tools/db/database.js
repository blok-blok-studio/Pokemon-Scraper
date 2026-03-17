const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let dbPath = path.join(dataDir, 'agent.db');

function getDb(customPath) {
  const p = customPath || dbPath;
  const db = new Database(p);
  db.pragma('journal_mode = WAL');
  return db;
}

function init(customPath) {
  const db = getDb(customPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS card_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      card_name TEXT NOT NULL,
      set_name TEXT,
      condition TEXT,
      price REAL NOT NULL,
      tcg_market_price REAL,
      discount_percent REAL,
      url TEXT UNIQUE NOT NULL,
      seller_name TEXT,
      seller_contact TEXT,
      deal_grade TEXT,
      ai_summary TEXT,
      red_flags TEXT,
      found_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      alerted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS outreach_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_name TEXT NOT NULL,
      target_type TEXT NOT NULL,
      contact_method TEXT NOT NULL,
      contact_info TEXT NOT NULL,
      message_sent TEXT,
      status TEXT DEFAULT 'sent',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_name TEXT NOT NULL,
      set_name TEXT,
      source TEXT NOT NULL,
      price REAL NOT NULL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT NOT NULL,
      endpoint TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      estimated_cost_usd REAL,
      called_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function insertListing(db, data) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO card_listings (source, card_name, set_name, condition, price, tcg_market_price, discount_percent, url, seller_name, seller_contact, deal_grade, ai_summary, red_flags)
    VALUES (@source, @card_name, @set_name, @condition, @price, @tcg_market_price, @discount_percent, @url, @seller_name, @seller_contact, @deal_grade, @ai_summary, @red_flags)
  `);
  return stmt.run({
    source: data.source || null,
    card_name: data.card_name || null,
    set_name: data.set_name || null,
    condition: data.condition || null,
    price: data.price || null,
    tcg_market_price: data.tcg_market_price || null,
    discount_percent: data.discount_percent || null,
    url: data.url,
    seller_name: data.seller_name || null,
    seller_contact: data.seller_contact || null,
    deal_grade: data.deal_grade || null,
    ai_summary: data.ai_summary || null,
    red_flags: data.red_flags || null
  });
}

function getUnalertedDeals(db, minDiscountPercent) {
  return db.prepare(`
    SELECT * FROM card_listings
    WHERE alerted = 0 AND discount_percent >= ?
    ORDER BY discount_percent DESC
  `).all(minDiscountPercent);
}

function markAsAlerted(db, ids) {
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`UPDATE card_listings SET alerted = 1 WHERE id IN (${placeholders})`).run(...ids);
}

function insertOutreach(db, data) {
  return db.prepare(`
    INSERT INTO outreach_log (target_name, target_type, contact_method, contact_info, message_sent, status)
    VALUES (@target_name, @target_type, @contact_method, @contact_info, @message_sent, @status)
  `).run({
    target_name: data.target_name,
    target_type: data.target_type,
    contact_method: data.contact_method,
    contact_info: data.contact_info,
    message_sent: data.message_sent || null,
    status: data.status || 'sent'
  });
}

function getOutreachHistory(db, contactInfo, days) {
  return db.prepare(`
    SELECT * FROM outreach_log
    WHERE contact_info = ? AND sent_at >= datetime('now', '-' || ? || ' days')
    ORDER BY sent_at DESC
  `).all(contactInfo, days);
}

function insertPriceHistory(db, data) {
  return db.prepare(`
    INSERT INTO price_history (card_name, set_name, source, price)
    VALUES (@card_name, @set_name, @source, @price)
  `).run({
    card_name: data.card_name,
    set_name: data.set_name || null,
    source: data.source,
    price: data.price
  });
}

function getAveragePrice(db, cardName, days) {
  const result = db.prepare(`
    SELECT AVG(price) as avg_price, COUNT(*) as count
    FROM price_history
    WHERE card_name LIKE ? AND recorded_at >= datetime('now', '-' || ? || ' days')
  `).get(`%${cardName}%`, days);
  return result;
}

function logApiUsage(db, data) {
  return db.prepare(`
    INSERT INTO api_usage (service, endpoint, tokens_in, tokens_out, estimated_cost_usd)
    VALUES (@service, @endpoint, @tokens_in, @tokens_out, @estimated_cost_usd)
  `).run({
    service: data.service,
    endpoint: data.endpoint || null,
    tokens_in: data.tokens_in || null,
    tokens_out: data.tokens_out || null,
    estimated_cost_usd: data.estimated_cost_usd || 0
  });
}

function getDailyApiSpend(db) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(estimated_cost_usd), 0) as total_spend,
           COUNT(*) as total_calls
    FROM api_usage
    WHERE date(called_at) = date('now')
  `).get();
  return result;
}

function getStats(db) {
  const listings = db.prepare('SELECT COUNT(*) as count FROM card_listings').get();
  const deals = db.prepare("SELECT COUNT(*) as count FROM card_listings WHERE deal_grade IN ('must-buy', 'good-deal')").get();
  const outreach = db.prepare('SELECT COUNT(*) as count FROM outreach_log').get();
  const todayOutreach = db.prepare("SELECT COUNT(*) as count FROM outreach_log WHERE date(sent_at) = date('now')").get();
  const spend = getDailyApiSpend(db);
  const monthlySpend = db.prepare(`
    SELECT COALESCE(SUM(estimated_cost_usd), 0) as total
    FROM api_usage
    WHERE strftime('%Y-%m', called_at) = strftime('%Y-%m', 'now')
  `).get();

  return {
    totalListings: listings.count,
    totalDeals: deals.count,
    totalOutreach: outreach.count,
    todayOutreach: todayOutreach.count,
    dailySpend: spend.total_spend,
    dailyCalls: spend.total_calls,
    monthlySpend: monthlySpend.total
  };
}

function getUngradedListings(db) {
  return db.prepare(`
    SELECT * FROM card_listings WHERE deal_grade IS NULL
  `).all();
}

function updateListingAnalysis(db, url, data) {
  return db.prepare(`
    UPDATE card_listings
    SET deal_grade = @deal_grade, ai_summary = @ai_summary, red_flags = @red_flags
    WHERE url = @url
  `).run({
    url,
    deal_grade: data.deal_grade || null,
    ai_summary: data.ai_summary || null,
    red_flags: data.red_flags || null
  });
}

function getRecentDeals(db, limit) {
  return db.prepare(`
    SELECT * FROM card_listings
    ORDER BY discount_percent DESC
    LIMIT ?
  `).all(limit);
}

function getRecentOutreach(db, limit) {
  return db.prepare(`
    SELECT * FROM outreach_log
    ORDER BY sent_at DESC
    LIMIT ?
  `).all(limit);
}

function getPriceHistory(db, cardName) {
  return db.prepare(`
    SELECT * FROM price_history
    WHERE card_name LIKE ?
    ORDER BY recorded_at DESC
  `).all(`%${cardName}%`);
}

function getSpendByService(db) {
  const today = db.prepare(`
    SELECT service, COUNT(*) as calls, COALESCE(SUM(estimated_cost_usd), 0) as spend
    FROM api_usage
    WHERE date(called_at) = date('now')
    GROUP BY service
  `).all();

  const month = db.prepare(`
    SELECT service, COUNT(*) as calls, COALESCE(SUM(estimated_cost_usd), 0) as spend
    FROM api_usage
    WHERE strftime('%Y-%m', called_at) = strftime('%Y-%m', 'now')
    GROUP BY service
  `).all();

  return { today, month };
}

function getTodayOutreachCount(db, method) {
  return db.prepare(`
    SELECT COUNT(*) as count FROM outreach_log
    WHERE contact_method = ? AND date(sent_at) = date('now')
  `).get(method).count;
}

module.exports = {
  init,
  getDb,
  insertListing,
  getUnalertedDeals,
  markAsAlerted,
  insertOutreach,
  getOutreachHistory,
  insertPriceHistory,
  getAveragePrice,
  logApiUsage,
  getDailyApiSpend,
  getStats,
  getUngradedListings,
  updateListingAnalysis,
  getRecentDeals,
  getRecentOutreach,
  getPriceHistory,
  getSpendByService,
  getTodayOutreachCount
};
