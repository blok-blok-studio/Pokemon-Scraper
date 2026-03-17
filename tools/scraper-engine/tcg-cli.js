const { lookupPriceRateLimited } = require('./tcgplayer');

const command = process.argv[2];
const cardName = process.argv[3];

if (command !== 'lookup' || !cardName) {
  console.error('Usage: node tcg-cli.js lookup "<card name>" [--set "<set name>"]');
  process.exit(1);
}

let setName = null;
const setIndex = process.argv.indexOf('--set');
if (setIndex !== -1 && process.argv[setIndex + 1]) {
  setName = process.argv[setIndex + 1];
}

(async () => {
  try {
    const result = await lookupPriceRateLimited(cardName, setName);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
})();
