const { generateEmail, sendEmail, getEmailStats } = require('./emailOutreach');
const db = require('../db/database');
const dotenv = require('dotenv');

dotenv.config();

const database = db.init();
const command = process.argv[2];
const args = process.argv.slice(3);

(async () => {
  try {
    switch (command) {
      case 'generate': {
        const target = JSON.parse(args[0]);
        const email = await generateEmail(target, database);
        console.log(JSON.stringify(email, null, 2));
        break;
      }
      case 'send': {
        const target = JSON.parse(args[0]);
        const result = await sendEmail(target, database);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'stats': {
        const stats = await getEmailStats(database);
        console.log(JSON.stringify(stats, null, 2));
        break;
      }
      default:
        console.error('Usage:');
        console.error('  node email-cli.js generate \'<target JSON>\'');
        console.error('  node email-cli.js send \'<target JSON>\'');
        console.error('  node email-cli.js stats');
        process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  } finally {
    database.close();
  }
})();
