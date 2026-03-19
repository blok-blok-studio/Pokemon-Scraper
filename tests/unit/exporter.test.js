import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';

const { getTestDb, cleanupTestDb } = require('../helpers/testDb');
const { sampleListings, sampleOutreach } = require('../helpers/mockData');
const db = require('../../tools/db/database');
const { exportDealsCSV, exportOutreachCSV, exportPriceHistoryCSV } = require('../../tools/export/exporter');

let database;

beforeEach(() => {
  database = getTestDb();
});

afterAll(() => {
  if (database) database.close();
  cleanupTestDb();
});

describe('Exporter', () => {
  it('should export deals to CSV', () => {
    for (const listing of sampleListings.slice(0, 5)) {
      db.insertListing(database, listing);
    }

    const result = exportDealsCSV(database, {});
    expect(result.rowCount).toBeGreaterThanOrEqual(5);
    expect(fs.existsSync(result.filePath)).toBe(true);

    const content = fs.readFileSync(result.filePath, 'utf8');
    expect(content).toContain('Card Name');
    expect(content).toContain('Charizard VMAX');

    // Cleanup
    fs.unlinkSync(result.filePath);
  });

  it('should export outreach to CSV', () => {
    for (const outreach of sampleOutreach) {
      db.insertOutreach(database, outreach);
    }

    const result = exportOutreachCSV(database, {});
    expect(result.rowCount).toBe(5);
    expect(fs.existsSync(result.filePath)).toBe(true);

    // Cleanup
    fs.unlinkSync(result.filePath);
  });

  it('should export price history to CSV', () => {
    db.insertPriceHistory(database, { card_name: 'Charizard VMAX', source: 'tcgplayer', price: 100 });
    db.insertPriceHistory(database, { card_name: 'Charizard VMAX', source: 'tcgplayer', price: 105 });

    const result = exportPriceHistoryCSV(database, 'Charizard VMAX', 30);
    expect(result.rowCount).toBe(2);
    expect(fs.existsSync(result.filePath)).toBe(true);

    // Cleanup
    fs.unlinkSync(result.filePath);
  });

  it('should handle empty results gracefully', () => {
    const result = exportDealsCSV(database, {});
    expect(result.rowCount).toBe(0);

    // Cleanup
    if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
  });
});
