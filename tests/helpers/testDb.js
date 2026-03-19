const path = require('path');
const fs = require('fs');
const db = require('../../tools/db/database');

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test_agent.db');

let currentDb = null;

function getTestDb() {
  // Close previous DB before deleting
  if (currentDb) {
    try { currentDb.close(); } catch {}
    currentDb = null;
  }
  cleanupTestDb();
  currentDb = db.init(TEST_DB_PATH);
  return currentDb;
}

function cleanupTestDb() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Also clean WAL/SHM files
    if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
    if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
  } catch {
    // Ignore cleanup errors
  }
}

module.exports = { getTestDb, cleanupTestDb, TEST_DB_PATH };
