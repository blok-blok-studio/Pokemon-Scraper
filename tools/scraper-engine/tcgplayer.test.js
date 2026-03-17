const { lookupPriceRateLimited } = require('./tcgplayer');
const db = require('../db/database');

const database = db.init();

(async () => {
  const cards = ['Charizard VMAX', 'Pikachu VMAX'];

  for (const card of cards) {
    console.log(`\nLooking up: ${card}...`);
    try {
      const result = await lookupPriceRateLimited(card);
      console.log(JSON.stringify(result, null, 2));

      if (result && result.marketPrice) {
        db.insertPriceHistory(database, {
          card_name: card,
          source: 'tcgplayer',
          price: result.marketPrice
        });
        console.log(`  Stored in price_history`);
      }
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
    }
  }

  database.close();
  console.log('\nTCGPlayer test complete');
})();
