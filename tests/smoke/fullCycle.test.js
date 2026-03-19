import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';

const { getTestDb, cleanupTestDb } = require('../helpers/testDb');
const { sampleListings, sampleWatchlist, sampleOutreach, sampleApiUsage } = require('../helpers/mockData');
const db = require('../../tools/db/database');
const { classifyListing } = require('../../tools/utils/cardMatcher');
const { exportDealsCSV, exportOutreachCSV } = require('../../tools/export/exporter');

let database;

beforeAll(() => {
  database = getTestDb();
});

afterAll(() => {
  if (database) database.close();
  cleanupTestDb();
});

describe('Full Cycle Smoke Test', () => {
  it('Step 1-2: Initialize DB and insert listings', () => {
    for (const listing of sampleListings) {
      db.insertListing(database, listing);
    }
    const count = database.prepare('SELECT COUNT(*) as count FROM card_listings').get().count;
    expect(count).toBe(10);
  });

  it('Step 3: Dedup works', () => {
    db.insertListing(database, sampleListings[0]); // duplicate URL
    const count = database.prepare('SELECT COUNT(*) as count FROM card_listings').get().count;
    expect(count).toBe(10);
  });

  it('Step 4: classifyListing identifies accessories and matches', () => {
    // Sleeves = accessory
    const sleeves = classifyListing(sampleListings[5].card_name, sampleWatchlist);
    expect(sleeves.skip).toBe(true);
    expect(sleeves.reason).toContain('Accessory');

    // Lot = accessory
    const lot = classifyListing(sampleListings[6].card_name, sampleWatchlist);
    expect(lot.skip).toBe(true);

    // Fake = accessory
    const fake = classifyListing(sampleListings[7].card_name, sampleWatchlist);
    expect(fake.skip).toBe(true);

    // Code card = accessory
    const code = classifyListing(sampleListings[9].card_name, sampleWatchlist);
    expect(code.skip).toBe(true);

    // Real card matches
    const real = classifyListing(sampleListings[0].card_name, sampleWatchlist);
    expect(real.skip).toBe(false);
    expect(real.watchlistMatch.watchlistEntry.name).toBe('Charizard VMAX');
  });

  it('Step 5-6: Simulate AI grading and check unalerted deals', () => {
    // Grades already set in sample data via insertListing
    const deals = db.getUnalertedDeals(database, 15);
    expect(deals.length).toBeGreaterThan(0);
    deals.forEach(d => {
      expect(d.discount_percent).toBeGreaterThanOrEqual(15);
    });
  });

  it('Step 7-9: Mark as alerted and verify cleared', () => {
    const deals = db.getUnalertedDeals(database, 15);
    const ids = deals.map(d => d.id);
    db.markAsAlerted(database, ids);

    const after = db.getUnalertedDeals(database, 15);
    expect(after.length).toBe(0);
  });

  it('Step 10-11: Outreach and cooldown', () => {
    for (const outreach of sampleOutreach) {
      db.insertOutreach(database, outreach);
    }
    const history = db.getOutreachHistory(database, 'gamestop@test.com', 30);
    expect(history.length).toBe(1);
  });

  it('Step 12-13: API spend tracking', () => {
    for (const usage of sampleApiUsage) {
      db.logApiUsage(database, usage);
    }
    const spend = db.getDailyApiSpend(database);
    expect(spend.total_spend).toBeGreaterThan(0);
  });

  it('Step 14: Stats are correct', () => {
    const stats = db.getStats(database);
    expect(stats.totalListings).toBe(10);
    expect(stats.totalOutreach).toBe(5);
    expect(stats.dailySpend).toBeGreaterThan(0);
  });

  it('Step 15-16: CSV exports work', () => {
    const dealsExport = exportDealsCSV(database, {});
    expect(dealsExport.rowCount).toBe(10);
    expect(fs.existsSync(dealsExport.filePath)).toBe(true);

    const outreachExport = exportOutreachCSV(database, {});
    expect(outreachExport.rowCount).toBe(5);
    expect(fs.existsSync(outreachExport.filePath)).toBe(true);

    // Cleanup exports
    fs.unlinkSync(dealsExport.filePath);
    fs.unlinkSync(outreachExport.filePath);
  });
});
