const dotenv = require('dotenv');
const axios = require('axios');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

dotenv.config({ override: true });

const log = createChildLogger('cloud-sync');

const CRM_URL = process.env.CRM_SYNC_URL;
const API_KEY = process.env.CRM_SYNC_API_KEY;
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

const TABLES = [
  { name: 'card_listings', sqliteTable: 'card_listings', endpoint: 'listings' },
  { name: 'outreach_log', sqliteTable: 'outreach_log', endpoint: 'outreach' },
  { name: 'price_history', sqliteTable: 'price_history', endpoint: 'prices' },
  { name: 'api_usage', sqliteTable: 'api_usage', endpoint: 'usage' },
  { name: 'automation_tasks', sqliteTable: 'automation_tasks', endpoint: 'tasks' },
  { name: 'agent_memory', sqliteTable: 'agent_memory', endpoint: 'memory' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(fn, context) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNABORTED' ||
        (err.response && err.response.status >= 500);

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log.warn(`${context}: attempt ${attempt} failed (${err.message}), retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

async function getCursors() {
  return fetchWithRetry(async () => {
    const res = await axios.get(`${CRM_URL}/api/sync/status`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 10000,
    });
    return res.data;
  }, 'getCursors');
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
    const res = await fetchWithRetry(async () => {
      return axios.post(
        `${CRM_URL}/api/sync/${table.endpoint}`,
        { records: batch },
        {
          headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 30000,
        }
      );
    }, `sync ${table.name}`);

    if (res.data.synced !== batch.length) {
      log.warn(`${table.name}: expected ${batch.length} synced but CRM reported ${res.data.synced}`);
    }
    totalSynced += res.data.synced;
    log.info(`${table.name}: synced ${res.data.synced} records (cursor: ${res.data.cursor})`);

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
      try {
        const synced = await syncTable(database, table, cursors[table.name] || 0);
        totalSynced += synced;
      } catch (err) {
        log.error(`Failed to sync ${table.name} after ${MAX_RETRIES} attempts: ${err.message}`);
      }
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
