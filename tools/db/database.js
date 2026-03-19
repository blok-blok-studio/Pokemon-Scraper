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

    CREATE TABLE IF NOT EXISTS automation_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      due_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER,
      card_name TEXT NOT NULL,
      set_name TEXT,
      purchase_price REAL NOT NULL,
      purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      purchase_source TEXT,
      seller_name TEXT,
      condition TEXT,
      current_market_price REAL,
      market_price_updated_at DATETIME,
      status TEXT DEFAULT 'in_collection',
      sold_price REAL,
      sold_date DATETIME,
      sold_to TEXT,
      shipping_cost REAL DEFAULT 0,
      fees REAL DEFAULT 0,
      notes TEXT
    );

    -- Add columns if they don't exist (safe migrations)
    -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we catch errors
  `);

  // Safe column additions
  const safeAddColumn = (table, column, type) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`) } catch {}
  }
  safeAddColumn('card_listings', 'pipeline_stage', "TEXT DEFAULT 'new'")
  safeAddColumn('card_listings', 'title', 'TEXT')
  safeAddColumn('outreach_log', 'subject', 'TEXT')
  safeAddColumn('outreach_log', 'pipeline_stage', "TEXT DEFAULT 'pending'")
  safeAddColumn('outreach_log', 'approved', 'INTEGER DEFAULT 0')

  // Performance indexes
  const safeCreateIndex = (name, table, columns) => {
    try { db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${table} (${columns})`) } catch {}
  }
  safeCreateIndex('idx_listings_source', 'card_listings', 'source')
  safeCreateIndex('idx_listings_card_name', 'card_listings', 'card_name')
  safeCreateIndex('idx_listings_deal_grade', 'card_listings', 'deal_grade')
  safeCreateIndex('idx_listings_found_at', 'card_listings', 'found_at DESC')
  safeCreateIndex('idx_listings_pipeline', 'card_listings', 'pipeline_stage')
  safeCreateIndex('idx_outreach_contact', 'outreach_log', 'contact_info')
  safeCreateIndex('idx_outreach_sent_at', 'outreach_log', 'sent_at DESC')
  safeCreateIndex('idx_outreach_pipeline', 'outreach_log', 'pipeline_stage')
  safeCreateIndex('idx_prices_card', 'price_history', 'card_name')
  safeCreateIndex('idx_prices_recorded', 'price_history', 'recorded_at DESC')
  safeCreateIndex('idx_usage_service', 'api_usage', 'service')
  safeCreateIndex('idx_usage_called', 'api_usage', 'called_at')
  safeCreateIndex('idx_tasks_status', 'automation_tasks', 'status')
  safeCreateIndex('idx_tasks_priority', 'automation_tasks', 'priority')
  safeCreateIndex('idx_tasks_due', 'automation_tasks', 'due_date, status')
  safeCreateIndex('idx_purchases_status', 'purchases', 'status')
  safeCreateIndex('idx_purchases_card', 'purchases', 'card_name')
  safeCreateIndex('idx_purchases_date', 'purchases', 'purchase_date DESC')

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
    price: data.price ?? null,
    tcg_market_price: data.tcg_market_price ?? null,
    discount_percent: data.discount_percent ?? null,
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
  if (!ids || ids.length === 0) return { changes: 0 };
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`UPDATE card_listings SET alerted = 1 WHERE id IN (${placeholders})`).run(...ids);
}

function insertOutreach(db, data) {
  return db.prepare(`
    INSERT INTO outreach_log (target_name, target_type, contact_method, contact_info, subject, message_sent, status, pipeline_stage, approved)
    VALUES (@target_name, @target_type, @contact_method, @contact_info, @subject, @message_sent, @status, @pipeline_stage, @approved)
  `).run({
    target_name: data.target_name,
    target_type: data.target_type,
    contact_method: data.contact_method,
    contact_info: data.contact_info,
    subject: data.subject || null,
    message_sent: data.message_sent || null,
    status: data.status || 'sent',
    pipeline_stage: data.pipeline_stage || 'pending',
    approved: data.approved || 0
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
    tokens_in: data.tokens_in ?? null,
    tokens_out: data.tokens_out ?? null,
    estimated_cost_usd: data.estimated_cost_usd ?? 0
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

function updateListingPipelineStage(db, url, stage) {
  return db.prepare(`
    UPDATE card_listings SET pipeline_stage = @stage WHERE url = @url
  `).run({ url, stage });
}

function getHighValueDeals(db, minDiscount = 40) {
  return db.prepare(`
    SELECT * FROM card_listings
    WHERE (discount_percent >= ? OR deal_grade = 'must-buy')
      AND alerted = 0
    ORDER BY discount_percent DESC
  `).all(minDiscount);
}

function insertAutomationTask(db, data) {
  return db.prepare(`
    INSERT INTO automation_tasks (task_type, entity_type, entity_id, title, description, status, priority, due_date)
    VALUES (@task_type, @entity_type, @entity_id, @title, @description, @status, @priority, @due_date)
  `).run({
    task_type: data.task_type,
    entity_type: data.entity_type || null,
    entity_id: data.entity_id || null,
    title: data.title,
    description: data.description || null,
    status: data.status || 'pending',
    priority: data.priority || 'normal',
    due_date: data.due_date || null
  });
}

function getPendingAutomationTasks(db, taskType) {
  if (taskType) {
    return db.prepare(`
      SELECT * FROM automation_tasks WHERE status = 'pending' AND task_type = ? ORDER BY priority DESC, created_at ASC
    `).all(taskType);
  }
  return db.prepare(`
    SELECT * FROM automation_tasks WHERE status = 'pending' ORDER BY priority DESC, created_at ASC
  `).all();
}

function completeAutomationTask(db, id) {
  return db.prepare(`
    UPDATE automation_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(id);
}

function getPriceTrend(db, cardName, days = 30) {
  const prices = db.prepare(`
    SELECT price, recorded_at FROM price_history
    WHERE card_name LIKE ? AND recorded_at >= datetime('now', '-' || ? || ' days')
    ORDER BY recorded_at ASC
  `).all(`%${cardName}%`, days);

  if (prices.length < 2) return null;

  const first = prices[0].price;
  const last = prices[prices.length - 1].price;
  const avg = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
  const changePercent = ((last - first) / first) * 100;

  return { first, last, avg, changePercent, dataPoints: prices.length };
}

function insertPurchase(db, data) {
  const result = db.prepare(`
    INSERT INTO purchases (listing_id, card_name, set_name, purchase_price, purchase_source, seller_name, condition, current_market_price, notes)
    VALUES (@listing_id, @card_name, @set_name, @purchase_price, @purchase_source, @seller_name, @condition, @current_market_price, @notes)
  `).run({
    listing_id: data.listing_id || null,
    card_name: data.card_name,
    set_name: data.set_name || null,
    purchase_price: data.purchase_price,
    purchase_source: data.purchase_source || null,
    seller_name: data.seller_name || null,
    condition: data.condition || null,
    current_market_price: data.current_market_price || null,
    notes: data.notes || null,
  });

  // If linked to a listing, update pipeline stage
  if (data.listing_id) {
    try {
      db.prepare(`UPDATE card_listings SET pipeline_stage = 'purchased' WHERE id = ?`).run(data.listing_id);
    } catch {}
  }

  return result;
}

function sellPurchase(db, id, data) {
  return db.prepare(`
    UPDATE purchases SET status = 'sold', sold_price = @sold_price, sold_date = CURRENT_TIMESTAMP,
    sold_to = @sold_to, shipping_cost = @shipping_cost, fees = @fees
    WHERE id = @id
  `).run({
    id,
    sold_price: data.sold_price,
    sold_to: data.sold_to || null,
    shipping_cost: data.shipping_cost || 0,
    fees: data.fees || 0,
  });
}

function updatePurchaseMarketPrice(db, id, marketPrice) {
  return db.prepare(`
    UPDATE purchases SET current_market_price = ?, market_price_updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(marketPrice, id);
}

function getPortfolioSummary(db) {
  const all = db.prepare(`SELECT * FROM purchases`).all();
  const unsold = all.filter(p => p.status === 'in_collection' || p.status === 'listed_for_sale');
  const sold = all.filter(p => p.status === 'sold');

  const totalInvested = all.reduce((sum, p) => sum + p.purchase_price, 0);
  const currentValue = unsold.reduce((sum, p) => sum + (p.current_market_price || p.purchase_price), 0);
  const totalSoldRevenue = sold.reduce((sum, p) => sum + (p.sold_price || 0), 0);
  const totalSoldCosts = sold.reduce((sum, p) => sum + p.purchase_price + (p.shipping_cost || 0) + (p.fees || 0), 0);
  const totalProfit = totalSoldRevenue - totalSoldCosts;

  // Find best and worst
  const withGain = unsold.map(p => ({
    ...p,
    gain: (p.current_market_price || p.purchase_price) - p.purchase_price,
    gainPercent: p.current_market_price ? ((p.current_market_price - p.purchase_price) / p.purchase_price * 100) : 0,
  })).sort((a, b) => b.gainPercent - a.gainPercent);

  return {
    totalPurchases: all.length,
    unsoldCount: unsold.length,
    soldCount: sold.length,
    totalInvested,
    currentValue,
    unrealizedGain: currentValue - unsold.reduce((sum, p) => sum + p.purchase_price, 0),
    totalProfit,
    roiPercent: totalInvested > 0 ? ((totalProfit + (currentValue - unsold.reduce((s, p) => s + p.purchase_price, 0))) / totalInvested * 100) : 0,
    bestPerformer: withGain[0] || null,
    worstPerformer: withGain[withGain.length - 1] || null,
  };
}

function getUnsoldInventory(db) {
  return db.prepare(`SELECT * FROM purchases WHERE status IN ('in_collection', 'listed_for_sale') ORDER BY purchase_date DESC`).all();
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
  getTodayOutreachCount,
  updateListingPipelineStage,
  getHighValueDeals,
  insertAutomationTask,
  getPendingAutomationTasks,
  completeAutomationTask,
  getPriceTrend,
  insertPurchase,
  sellPurchase,
  updatePurchaseMarketPrice,
  getPortfolioSummary,
  getUnsoldInventory,
};
