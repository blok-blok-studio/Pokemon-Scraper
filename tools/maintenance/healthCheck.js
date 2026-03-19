const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const db = require('../db/database');
const { getAllStatus } = require('../utils/circuitBreaker');
const { createChildLogger } = require('../logger');

const log = createChildLogger('health-check');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'agent.log');
const HEARTBEAT_FILE = path.join(DATA_DIR, '.heartbeat');

const startTime = Date.now();

function getDiskFreeGB() {
  try {
    const output = execSync(`df -k "${DATA_DIR}" | tail -1`, { encoding: 'utf8' });
    const parts = output.trim().split(/\s+/);
    const availKB = parseInt(parts[3]);
    return Math.round(availKB / 1024 / 1024 * 10) / 10;
  } catch {
    return null;
  }
}

function getMemoryUsageMB() {
  const usage = process.memoryUsage();
  return Math.round(usage.rss / 1024 / 1024);
}

function getFileSizeMB(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    return Math.round(fs.statSync(filePath).size / 1024 / 1024 * 10) / 10;
  } catch {
    return 0;
  }
}

function getUptimeHours() {
  return Math.round((Date.now() - startTime) / 3600000 * 10) / 10;
}

function getLastScrapeTime(database) {
  try {
    const result = database.prepare(`SELECT MAX(found_at) as last FROM card_listings`).get();
    return result.last || null;
  } catch {
    return null;
  }
}

function getLastSyncTime(database) {
  try {
    const result = database.prepare(`SELECT MAX(called_at) as last FROM api_usage WHERE service = 'sync'`).get();
    return result?.last || null;
  } catch {
    return null;
  }
}

function writeHeartbeat() {
  try {
    fs.writeFileSync(HEARTBEAT_FILE, new Date().toISOString());
  } catch {}
}

function getHealthReport(database) {
  const diskFreeGB = getDiskFreeGB();
  const memoryUsageMB = getMemoryUsageMB();
  const dbSizeMB = getFileSizeMB(path.join(DATA_DIR, 'agent.db'));
  const logFileSizeMB = getFileSizeMB(LOG_FILE);
  const uptimeHours = getUptimeHours();
  const lastScrapeAt = getLastScrapeTime(database);
  const lastSyncAt = getLastSyncTime(database);
  const circuitBreakers = getAllStatus();

  const warnings = [];

  if (diskFreeGB !== null && diskFreeGB < 1) warnings.push(`Low disk space: ${diskFreeGB}GB free`);
  if (memoryUsageMB > 512) warnings.push(`High memory usage: ${memoryUsageMB}MB`);
  if (dbSizeMB > 500) warnings.push(`Large database: ${dbSizeMB}MB — consider running data pruning`);
  if (logFileSizeMB > 100) warnings.push(`Large log file: ${logFileSizeMB}MB — consider log rotation`);

  // Check for stale data (no new listings in 2 hours during business hours)
  if (lastScrapeAt) {
    const hoursSinceLastScrape = (Date.now() - new Date(lastScrapeAt).getTime()) / 3600000;
    const currentHour = new Date().getHours();
    if (hoursSinceLastScrape > 2 && currentHour >= 8 && currentHour <= 22) {
      warnings.push(`No new listings in ${Math.round(hoursSinceLastScrape)}h — scrapers may be blocked`);
    }
  }

  // Check for open circuit breakers
  for (const [name, status] of Object.entries(circuitBreakers)) {
    if (status.state === 'OPEN') warnings.push(`Circuit breaker ${name} is OPEN`);
  }

  const status = warnings.length === 0 ? 'healthy' : (diskFreeGB !== null && diskFreeGB < 0.5 ? 'critical' : 'warning');

  writeHeartbeat();

  return {
    diskFreeGB,
    memoryUsageMB,
    databaseSizeMB: dbSizeMB,
    logFileSizeMB,
    uptimeHours,
    lastScrapeAt,
    lastSyncAt,
    circuitBreakers,
    status,
    warnings,
  };
}

module.exports = { getHealthReport, writeHeartbeat, getDiskFreeGB, getMemoryUsageMB };
