const dotenv = require('dotenv');
const axios = require('axios');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

dotenv.config();

const log = createChildLogger('cloud-sync');

const CRM_URL = process.env.CRM_SYNC_URL;
const API_KEY = process.env.CRM_SYNC_API_KEY;
const BATCH_SIZE = 100;

const TABLES = [
  { name: 'card_listings', sqliteTable: 'card_listings', endpoint: 'listings' },
  { name: 'outreach_log', sqliteTable: 'outreach_log', endpoint: 'outreach' },
  { name: 'price_history', sqliteTable: 'price_history', endpoint: 'prices' },
  { name: 'api_usage', sqliteTable: 'api_usage', endpoint: 'usage' },
];

async function getCursors() {
  const res = await axios.get(`${CRM_URL}/api/sync/status`, {
    headers: { Authorization: `Bearer ${API_KEY}` }
  });
  return res.data;
}

async function syncTable(database, table, cursor) {
  const lastId = cursor || 0;
  const rows = database.prepare(
    `SELECT *, id as local_id FROM ${table.sqliteTable} WHERE id > ? ORDER BY id ASC LIMIT ?`
  ).all(lastId, BATCH_SIZE);

  if (rows.length === 0) {
    log.info(`${table.name}: already up to date`);
    return 0;
  }

  let totalSynced = 0;
  let batch = rows;

  while (batch.length > 0) {
    const res = await axios.post(
      `${CRM_URL}/api/sync/${table.endpoint}`,
      { records: batch },
      { headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' } }
    );

    totalSynced += res.data.synced;
    log.info(`${table.name}: synced ${res.data.synced} records (cursor: ${res.data.cursor})`);

    // Check for more
    const nextRows = database.prepare(
      `SELECT *, id as local_id FROM ${table.sqliteTable} WHERE id > ? ORDER BY id ASC LIMIT ?`
    ).all(res.data.cursor, BATCH_SIZE);

    batch = nextRows;
  }

  return totalSynced;
}

async function main() {
  if (!CRM_URL || !API_KEY) {
    console.error('CRM_SYNC_URL and CRM_SYNC_API_KEY must be set in .env');
    process.exit(1);
  }

  log.info('Starting cloud sync...');
  const database = db.init();

  try {
    const cursors = await getCursors();
    log.info(`Current cursors: ${JSON.stringify(cursors)}`);

    let totalSynced = 0;
    for (const table of TABLES) {
      const synced = await syncTable(database, table, cursors[table.name] || 0);
      totalSynced += synced;
    }

    log.info(`Cloud sync complete: ${totalSynced} total records synced`);
    console.log(JSON.stringify({ success: true, totalSynced }));
  } catch (err) {
    log.error(`Cloud sync failed: ${err.message}`);
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  } finally {
    database.close();
  }
}

main();
