const { scrapeEbay } = require('./ebay');

const command = process.argv[2];
const query = process.argv[3];

if (command !== 'search' || !query) {
  console.error('Usage: node ebay-cli.js search "<query>" [--max-price <number>] [--buy-it-now]');
  process.exit(1);
}

let maxPrice = null;
const maxPriceIndex = process.argv.indexOf('--max-price');
if (maxPriceIndex !== -1 && process.argv[maxPriceIndex + 1]) {
  maxPrice = parseFloat(process.argv[maxPriceIndex + 1]);
}

(async () => {
  try {
    const results = await scrapeEbay({ query, maxPrice });
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
})();
