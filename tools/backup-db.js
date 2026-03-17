const fs = require('fs');
const path = require('path');
const { createChildLogger } = require('./logger');

const log = createChildLogger('backup');

const dataDir = path.join(__dirname, '..', 'data');
const backupDir = path.join(dataDir, 'backups');
const dbPath = path.join(dataDir, 'agent.db');

// Create backup directory if needed
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  console.log('No database found at data/agent.db');
  log.warn('Backup skipped — no database file');
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace('T', '_').split('.')[0];
const backupFile = path.join(backupDir, `agent_${timestamp}.db`);

// Copy database
fs.copyFileSync(dbPath, backupFile);
const stats = fs.statSync(backupFile);
const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

console.log(`✓ Backup created: ${backupFile} (${sizeMB} MB)`);
log.info(`Backup created: ${backupFile} (${sizeMB} MB)`);

// Keep only last 7 backups
const backups = fs.readdirSync(backupDir)
  .filter(f => f.startsWith('agent_') && f.endsWith('.db'))
  .sort()
  .reverse();

if (backups.length > 7) {
  const toDelete = backups.slice(7);
  for (const file of toDelete) {
    fs.unlinkSync(path.join(backupDir, file));
    log.info(`Deleted old backup: ${file}`);
  }
  console.log(`  Deleted ${toDelete.length} old backup(s). ${Math.min(backups.length, 7)} retained.`);
}
