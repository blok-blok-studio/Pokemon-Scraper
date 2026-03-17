const telegram = require('./telegram');
const dotenv = require('dotenv');

dotenv.config();

const command = process.argv[2];
const args = process.argv.slice(3);

(async () => {
  try {
    switch (command) {
      case 'send-deal': {
        const listing = JSON.parse(args[0]);
        await telegram.sendDealAlert(listing);
        console.log(JSON.stringify({ success: true, type: 'deal_alert' }));
        break;
      }
      case 'send-summary': {
        const stats = JSON.parse(args[0]);
        await telegram.sendDailySummary(stats);
        console.log(JSON.stringify({ success: true, type: 'daily_summary' }));
        break;
      }
      case 'send-message': {
        const text = args.join(' ');
        await telegram.sendMessage(text);
        console.log(JSON.stringify({ success: true, type: 'message' }));
        break;
      }
      case 'send-error': {
        const error = args.join(' ');
        await telegram.sendError(error);
        console.log(JSON.stringify({ success: true, type: 'error' }));
        break;
      }
      case 'listen': {
        console.log('Starting Telegram bot listener...');
        telegram.startListener();
        // Keep process running
        break;
      }
      default:
        console.error('Usage:');
        console.error('  node telegram-cli.js send-deal \'<listing JSON>\'');
        console.error('  node telegram-cli.js send-summary \'<stats JSON>\'');
        console.error('  node telegram-cli.js send-message "<text>"');
        console.error('  node telegram-cli.js send-error "<error text>"');
        console.error('  node telegram-cli.js listen');
        process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
})();
