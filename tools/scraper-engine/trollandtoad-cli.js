const { scrapeTrollAndToad } = require('./trollandtoad');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== 'search' || args.length < 2) {
    console.error('Usage: node trollandtoad-cli.js search "<query>" [--max-price <number>]');
    process.exit(1);
  }

  const query = args[1];
  let maxPrice = null;

  const priceIdx = args.indexOf('--max-price');
  if (priceIdx !== -1 && args[priceIdx + 1]) {
    maxPrice = parseFloat(args[priceIdx + 1]);
  }

  const results = await scrapeTrollAndToad({ query, maxPrice });
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
