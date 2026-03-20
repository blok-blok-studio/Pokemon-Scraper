#!/usr/bin/env node
const dotenv = require('dotenv');
dotenv.config({ override: true });

const { scrapeAllSources, runFullCycle, verifyPrices } = require('./scrapeAll');
const db = require('../db/database');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

function loadConfig() {
  const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
  return fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : {};
}

function loadWatchlist() {
  const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');
  return fs.existsSync(watchlistPath) ? JSON.parse(fs.readFileSync(watchlistPath, 'utf-8')) : [];
}

async function main() {
  if (command === 'search') {
    // Single query across all sources
    const query = args[1];
    const maxPriceIdx = args.indexOf('--max-price');
    const maxPrice = maxPriceIdx > -1 ? parseFloat(args[maxPriceIdx + 1]) : 500;

    if (!query) {
      console.error('Usage: node scrapeAll-cli.js search "<query>" [--max-price <N>]');
      process.exit(1);
    }

    console.log(`Scraping all sources for: "${query}" (max $${maxPrice})`);
    const { listings, errors } = await scrapeAllSources({ query, maxPrice });
    console.log(`\nResults: ${listings.length} listings found`);
    console.log(JSON.stringify({ listings, errors }, null, 2));

  } else if (command === 'cycle') {
    // Full scrape cycle using config + watchlist
    const database = db.init();
    const config = loadConfig();
    const watchlist = loadWatchlist();

    console.log(`Running full scrape cycle...`);
    console.log(`Watchlist: ${watchlist.length} cards`);
    console.log(`Broad terms: ${(config.broadSearchTerms || []).length}`);

    const result = await runFullCycle(database, config, watchlist);
    console.log('\nCycle complete:', JSON.stringify(result, null, 2));
    database.close();

  } else if (command === 'verify') {
    // Price verification
    const database = db.init();
    const max = args[1] ? parseInt(args[1]) : 20;

    console.log(`Price-verifying up to ${max} listings...`);
    const result = await verifyPrices(database, { maxVerifications: max });
    console.log('Verification:', JSON.stringify(result, null, 2));
    database.close();

  } else {
    console.log(`Usage:
  node scrapeAll-cli.js search "<query>" [--max-price <N>]   Search all sources
  node scrapeAll-cli.js cycle                                  Full watchlist + broad search cycle
  node scrapeAll-cli.js verify [max]                           Price-verify unpriced listings`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
