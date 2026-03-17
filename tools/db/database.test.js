const path = require('path');
const fs = require('fs');
const db = require('./database');

const testDbPath = path.join(__dirname, '..', '..', 'data', 'test.db');

// Clean up any existing test db
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const database = db.init(testDbPath);

try {
  // Test insertListing
  console.log('Testing insertListing...');
  db.insertListing(database, {
    source: 'ebay', card_name: 'Charizard VMAX', set_name: 'Darkness Ablaze',
    condition: 'Near Mint', price: 45.00, tcg_market_price: 120.00,
    discount_percent: 62.5, url: 'https://ebay.com/charizard-1',
    seller_name: 'cardguy99'
  });
  db.insertListing(database, {
    source: 'ebay', card_name: 'Pikachu VMAX', set_name: 'Vivid Voltage',
    condition: 'Near Mint', price: 70.00, tcg_market_price: 80.00,
    discount_percent: 12.5, url: 'https://ebay.com/pikachu-1',
    seller_name: 'pokefan'
  });
  console.log('  ✓ Listings inserted');

  // Test dedup
  console.log('Testing dedup...');
  const dupResult = db.insertListing(database, {
    source: 'ebay', card_name: 'Charizard VMAX', price: 45.00,
    url: 'https://ebay.com/charizard-1'
  });
  console.log(`  ✓ Dedup works (changes: ${dupResult.changes})`);

  // Test getUnalertedDeals
  console.log('Testing getUnalertedDeals...');
  const deals = db.getUnalertedDeals(database, 15);
  console.log(`  ✓ Found ${deals.length} deals above 15% discount`);
  if (deals.length !== 1 || deals[0].card_name !== 'Charizard VMAX') {
    throw new Error('Expected 1 deal (Charizard VMAX)');
  }

  // Test markAsAlerted
  console.log('Testing markAsAlerted...');
  db.markAsAlerted(database, [deals[0].id]);
  const dealsAfter = db.getUnalertedDeals(database, 15);
  if (dealsAfter.length !== 0) {
    throw new Error('Expected 0 unalerted deals after marking');
  }
  console.log('  ✓ Marked as alerted');

  // Test insertOutreach
  console.log('Testing insertOutreach...');
  db.insertOutreach(database, {
    target_name: 'Test Shop', target_type: 'card_shop',
    contact_method: 'email', contact_info: 'test@test.com',
    message_sent: 'Hello!'
  });
  console.log('  ✓ Outreach logged');

  // Test getOutreachHistory
  console.log('Testing getOutreachHistory...');
  const history = db.getOutreachHistory(database, 'test@test.com', 30);
  if (history.length !== 1) {
    throw new Error('Expected 1 outreach entry');
  }
  console.log('  ✓ Outreach history works');

  // Test cooldown logic
  console.log('Testing outreach cooldown...');
  const recentHistory = db.getOutreachHistory(database, 'test@test.com', 30);
  const noHistory = db.getOutreachHistory(database, 'nobody@test.com', 30);
  if (recentHistory.length !== 1 || noHistory.length !== 0) {
    throw new Error('Cooldown logic failed');
  }
  console.log('  ✓ Cooldown logic works');

  // Test price history
  console.log('Testing insertPriceHistory...');
  db.insertPriceHistory(database, { card_name: 'Charizard VMAX', source: 'tcgplayer', price: 120.00 });
  db.insertPriceHistory(database, { card_name: 'Charizard VMAX', source: 'tcgplayer', price: 115.00 });
  const avg = db.getAveragePrice(database, 'Charizard VMAX', 30);
  console.log(`  ✓ Average price: $${avg.avg_price} (${avg.count} records)`);

  // Test API usage
  console.log('Testing logApiUsage...');
  db.logApiUsage(database, { service: 'anthropic', tokens_in: 500, tokens_out: 200, estimated_cost_usd: 0.004 });
  db.logApiUsage(database, { service: 'resend', estimated_cost_usd: 0.001 });
  const spend = db.getDailyApiSpend(database);
  console.log(`  ✓ Daily spend: $${spend.total_spend} (${spend.total_calls} calls)`);

  // Test getStats
  console.log('Testing getStats...');
  const stats = db.getStats(database);
  console.log(`  ✓ Stats: ${JSON.stringify(stats)}`);

  console.log('\nAll database tests passed ✓');
} catch (err) {
  console.error('Test failed:', err.message);
  process.exit(1);
} finally {
  database.close();
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}
