const { makeCall, previewScript, getCallStats } = require('./voiceOutreach');
const db = require('../db/database');
const dotenv = require('dotenv');

dotenv.config({ override: true });

const database = db.init();
const command = process.argv[2];
const args = process.argv.slice(3);

(async () => {
  try {
    switch (command) {
      case 'preview': {
        const target = JSON.parse(args[0]);
        const preview = previewScript(target);
        console.log(JSON.stringify(preview, null, 2));
        break;
      }
      case 'call': {
        const target = JSON.parse(args[0]);
        const result = await makeCall(target, database);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'stats': {
        const stats = await getCallStats(database);
        console.log(JSON.stringify(stats, null, 2));
        break;
      }
      default:
        console.error('Usage:');
        console.error('  node voice-cli.js preview \'<target JSON>\'');
        console.error('  node voice-cli.js call \'<target JSON>\'');
        console.error('  node voice-cli.js stats');
        process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  } finally {
    database.close();
  }
})();
