import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const { getTestDb, cleanupTestDb } = require('../helpers/testDb');
const { sampleListings, sampleOutreach, sampleApiUsage } = require('../helpers/mockData');
const db = require('../../tools/db/database');

let database;

beforeAll(() => {
  database = getTestDb();
});

afterAll(() => {
  if (database) database.close();
  cleanupTestDb();
});

describe('Database', () => {
  it('should create all tables on initialization', () => {
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    expect(tables).toContain('card_listings');
    expect(tables).toContain('outreach_log');
    expect(tables).toContain('price_history');
    expect(tables).toContain('api_usage');
    expect(tables).toContain('automation_tasks');
  });

  it('should insert a listing successfully', () => {
    const result = db.insertListing(database, sampleListings[0]);
    expect(result.changes).toBe(1);

    const rows = database.prepare('SELECT * FROM card_listings').all();
    expect(rows.length).toBe(1);
    expect(rows[0].card_name).toBe('Charizard VMAX');
    expect(rows[0].price).toBe(65);
  });

  it('should deduplicate listings by URL', () => {
    db.insertListing(database, sampleListings[0]);
    db.insertListing(database, sampleListings[0]); // Same URL

    const count = database.prepare('SELECT COUNT(*) as count FROM card_listings').get().count;
    expect(count).toBe(1);
  });

  it('should return unalerted deals above threshold', () => {
    // Insert more listings (dedup will ignore already-inserted ones)
    for (const listing of sampleListings.slice(0, 5)) {
      db.insertListing(database, listing);
    }

    const deals = db.getUnalertedDeals(database, 15);
    expect(deals.length).toBeGreaterThan(0);
    deals.forEach(d => {
      expect(d.discount_percent).toBeGreaterThanOrEqual(15);
      expect(d.alerted).toBe(0);
    });
  });

  it('should mark deals as alerted', () => {
    const dealsBefore = db.getUnalertedDeals(database, 0);
    expect(dealsBefore.length).toBeGreaterThan(0);

    const idsToMark = dealsBefore.slice(0, 1).map(d => d.id);
    db.markAsAlerted(database, idsToMark);

    const dealsAfter = db.getUnalertedDeals(database, 0);
    expect(dealsAfter.length).toBe(dealsBefore.length - 1);
  });

  it('should enforce outreach cooldown', () => {
    db.insertOutreach(database, sampleOutreach[0]);

    // Within 30 days — should find the entry
    const history = db.getOutreachHistory(database, 'gamestop@test.com', 30);
    expect(history.length).toBe(1);

    // No match for a different email
    const noMatch = db.getOutreachHistory(database, 'nonexistent@test.com', 30);
    expect(noMatch.length).toBe(0);
  });

  it('should calculate daily API spend correctly', () => {
    for (const usage of sampleApiUsage) {
      db.logApiUsage(database, usage);
    }

    const spend = db.getDailyApiSpend(database);
    const expected = sampleApiUsage.reduce((sum, u) => sum + u.estimated_cost_usd, 0);
    expect(spend.total_spend).toBeCloseTo(expected, 4);
    expect(spend.total_calls).toBe(sampleApiUsage.length);
  });

  it('should return correct aggregate stats', () => {
    const statsBefore = db.getStats(database);

    // Insert new outreach entries
    db.insertOutreach(database, { target_name: 'Stats Test', target_type: 'card_shop', contact_method: 'email', contact_info: 'statstest@test.com', message_sent: 'Test' });

    const statsAfter = db.getStats(database);
    expect(statsAfter.totalListings).toBeGreaterThan(0);
    expect(statsAfter.totalOutreach).toBe(statsBefore.totalOutreach + 1);
  });

  it('should track price history and calculate averages', () => {
    const prices = [100, 110, 105, 95, 90];
    for (const price of prices) {
      db.insertPriceHistory(database, { card_name: 'Charizard VMAX', source: 'tcgplayer', price });
    }

    const avg = db.getAveragePrice(database, 'Charizard VMAX', 30);
    expect(avg.avg_price).toBe(100);
    expect(avg.count).toBe(5);
  });

  it('should handle automation tasks', () => {
    db.insertAutomationTask(database, {
      task_type: 'follow_up',
      entity_type: 'outreach',
      title: 'Follow up with test',
      priority: 'high',
      due_date: new Date().toISOString(),
    });

    const pending = db.getPendingAutomationTasks(database);
    expect(pending.length).toBe(1);
    expect(pending[0].title).toBe('Follow up with test');

    db.completeAutomationTask(database, pending[0].id);

    const afterComplete = db.getPendingAutomationTasks(database);
    expect(afterComplete.length).toBe(0);
  });
});
