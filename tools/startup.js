const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const db = require('./db/database');
const { createChildLogger } = require('./logger');
const log = createChildLogger('startup');

const REQUIRED_KEYS = {
  ANTHROPIC_API_KEY: 'https://console.anthropic.com',
  TELEGRAM_BOT_TOKEN: 'Create via @BotFather on Telegram',
  TELEGRAM_CHAT_ID: 'Get via @userinfobot on Telegram',
  RESEND_API_KEY: 'https://resend.com',
  BLAND_API_KEY: 'https://bland.ai'
};

function validateKeys() {
  let missing = false;
  for (const [key, help] of Object.entries(REQUIRED_KEYS)) {
    if (!process.env[key] || process.env[key].startsWith('your_')) {
      console.error(`  ✗ ${key} is missing — Get it at: ${help}`);
      missing = true;
    }
  }
  return !missing;
}

function ensureConfigs() {
  const configDir = path.join(__dirname, '..', 'config');
  const pairs = [
    ['config.example.json', 'config.json'],
    ['watchlist.example.json', 'watchlist.json'],
    ['contacts.example.json', 'contacts.json']
  ];

  for (const [example, actual] of pairs) {
    const actualPath = path.join(configDir, actual);
    const examplePath = path.join(configDir, example);
    if (!fs.existsSync(actualPath) && fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, actualPath);
      log.info(`Created ${actual} from ${example}`);
    }
  }
}

function loadConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { scrapingIntervalMinutes: 30, outreachTimeHour: 10 };
  }
}

function loadWatchlist() {
  try {
    const watchlistPath = path.join(__dirname, '..', 'config', 'watchlist.json');
    return JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
  } catch {
    return [];
  }
}

async function main() {
  console.log('');
  console.log('  Validating API keys...');

  if (!validateKeys()) {
    console.error('\n  ✗ Missing required API keys. Please update your .env file.');
    process.exit(1);
  }
  console.log('  ✓ All API keys present');

  // Initialize database
  console.log('  Initializing database...');
  const database = db.init();
  console.log('  ✓ Database ready');

  // Ensure config files exist
  ensureConfigs();

  const config = loadConfig();
  const watchlist = loadWatchlist();
  const port = process.env.AGENT_PORT || '3847';
  const cap = process.env.DAILY_API_SPEND_CAP_USD || '5.00';

  // Print startup banner
  console.log('');
  console.log('  ═══════════════════════════════════════════════════');
  console.log('  🃏 Pokemon Card Agent v1.0.0');
  console.log('  🦞 Running on OpenClaw');
  console.log('  ═══════════════════════════════════════════════════');
  console.log(`  📋 Watchlist: ${watchlist.length} cards loaded`);
  console.log(`  🔍 Scrape interval: every ${config.scrapingIntervalMinutes || 30} minutes`);
  console.log(`  📧 Outreach: daily at ${config.outreachTimeHour || 10}am`);
  console.log(`  📊 Dashboard: http://localhost:${port}`);
  console.log(`  💰 Daily spend cap: $${cap}`);
  console.log('  ═══════════════════════════════════════════════════');
  console.log('');

  // Start dashboard
  console.log('  Starting dashboard...');
  try {
    const { start } = require('./dashboard/server');
    start(true);
    console.log(`  ✓ Dashboard running at http://localhost:${port}`);
  } catch (err) {
    log.error(`Dashboard failed to start: ${err.message}`);
    console.error(`  ✗ Dashboard failed: ${err.message}`);
  }

  // Send Telegram startup message
  console.log('  Sending startup notification...');
  try {
    const telegram = require('./telegram-client/telegram');
    await telegram.sendMessage('🃏 Pokemon Card Agent is online');
    console.log('  ✓ Telegram notification sent');
  } catch (err) {
    log.error(`Telegram notification failed: ${err.message}`);
    console.error(`  ✗ Telegram failed: ${err.message}`);
  }

  log.info('Pokemon Card Agent started successfully');
  database.close();
}

main().catch(err => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
