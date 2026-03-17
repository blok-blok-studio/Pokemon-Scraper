const { analyzeBatch } = require('./cardAnalyzer');
const db = require('../db/database');
const dotenv = require('dotenv');

dotenv.config();

const database = db.init();

const sampleListings = [
  {
    card_name: 'Charizard VMAX',
    price: 45.00,
    tcg_market_price: 120.00,
    url: 'https://ebay.com/test/charizard-great-deal',
    seller_name: 'established_seller_5star',
    condition: 'Near Mint',
    source: 'ebay',
    discount_percent: 62.5
  },
  {
    card_name: 'Pikachu VMAX',
    price: 78.00,
    tcg_market_price: 80.00,
    url: 'https://ebay.com/test/pikachu-fair',
    seller_name: 'pokecollector',
    condition: 'Near Mint',
    source: 'ebay',
    discount_percent: 2.5
  },
  {
    card_name: 'Pokemon Card Sleeve Protector 100 Pack',
    price: 8.99,
    tcg_market_price: null,
    url: 'https://ebay.com/test/sleeve-protector',
    seller_name: 'supplyshop',
    condition: 'New',
    source: 'ebay',
    discount_percent: null
  },
  {
    card_name: 'Umbreon VMAX Alt Art',
    price: 5.00,
    tcg_market_price: 200.00,
    url: 'https://ebay.com/test/umbreon-suspicious',
    seller_name: 'newuser_0reviews',
    condition: 'Not specified',
    source: 'ebay',
    discount_percent: 97.5
  },
  {
    card_name: 'Pidgey Base Set Common',
    price: 15.00,
    tcg_market_price: 0.50,
    url: 'https://ebay.com/test/pidgey-overpriced',
    seller_name: 'casual_seller',
    condition: 'Lightly Played',
    source: 'ebay',
    discount_percent: -2900
  }
];

// Insert test listings into DB first
for (const listing of sampleListings) {
  db.insertListing(database, listing);
}

(async () => {
  console.log('Analyzing 5 sample listings...\n');

  try {
    const result = await analyzeBatch(sampleListings, database);

    if (result.analyses) {
      for (const analysis of result.analyses) {
        console.log(`\n${analysis.url}`);
        console.log(`  Grade: ${analysis.dealGrade}`);
        console.log(`  Legitimate: ${analysis.isLegitimate}`);
        console.log(`  Summary: ${analysis.summary}`);
        if (analysis.redFlags.length > 0) {
          console.log(`  Red Flags: ${analysis.redFlags.join(', ')}`);
        }
      }
      console.log(`\nTokens: ${result.tokensIn} in, ${result.tokensOut} out`);
      console.log(`Estimated cost: $${result.estimatedCost.toFixed(6)}`);
    } else {
      console.log('Result:', JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('Test failed:', err.message);
  } finally {
    database.close();
  }
})();
