const { scrapeEbay } = require('./ebay');
const { lookupPriceRateLimited } = require('./tcgplayer');
const db = require('../db/database');

const database = db.init();

(async () => {
  console.log('Searching eBay for "Pokemon Charizard VMAX" under $100, Buy It Now...\n');

  try {
    const listings = await scrapeEbay({ query: 'Pokemon Charizard VMAX', maxPrice: 100 });
    console.log(`Found ${listings.length} listings\n`);

    let dealCount = 0;

    for (const listing of listings.slice(0, 5)) { // Process first 5 for test
      console.log(`  ${listing.card_name} — $${listing.price}`);

      // Look up TCG market price
      try {
        const tcgResult = await lookupPriceRateLimited(listing.card_name);
        if (tcgResult && tcgResult.marketPrice) {
          listing.tcg_market_price = tcgResult.marketPrice;
          listing.discount_percent = ((tcgResult.marketPrice - listing.price) / tcgResult.marketPrice) * 100;
          listing.discount_percent = Math.round(listing.discount_percent * 100) / 100;

          console.log(`    TCG Market: $${tcgResult.marketPrice} | Discount: ${listing.discount_percent}%`);

          if (listing.discount_percent > 15) dealCount++;

          // Store price history
          db.insertPriceHistory(database, {
            card_name: listing.card_name,
            source: 'tcgplayer',
            price: tcgResult.marketPrice
          });
        }
      } catch (err) {
        console.log(`    TCG lookup failed: ${err.message}`);
      }

      // Store listing in database
      db.insertListing(database, listing);
    }

    console.log(`\nSummary: Found ${listings.length} listings, ${dealCount} are deals (>15% discount)`);
  } catch (err) {
    console.error('Test failed:', err.message);
  } finally {
    database.close();
  }
})();
