const { analyzeBatch, analyzeUngraded } = require('./cardAnalyzer');
const db = require('../db/database');
const dotenv = require('dotenv');

dotenv.config();

const database = db.init();
const command = process.argv[2];

(async () => {
  try {
    switch (command) {
      case 'analyze': {
        const listings = JSON.parse(process.argv[3]);
        const arrayListings = Array.isArray(listings) ? listings : [listings];
        const result = await analyzeBatch(arrayListings, database);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'analyze-ungraded': {
        const result = await analyzeUngraded(database);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      default:
        console.error('Usage:');
        console.error('  node analyzer-cli.js analyze \'[{"card_name":"...","price":XX,...}]\'');
        console.error('  node analyzer-cli.js analyze-ungraded');
        process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  } finally {
    database.close();
  }
})();
