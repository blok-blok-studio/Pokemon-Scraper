const db = require('./database');

const database = db.init();
const command = process.argv[2];
const args = process.argv.slice(3);

function output(data) {
  console.log(JSON.stringify(data, null, 2));
}

try {
  switch (command) {
    case 'insert-listing': {
      const data = JSON.parse(args[0]);
      const result = db.insertListing(database, data);
      output({ success: true, changes: result.changes });
      break;
    }
    case 'get-unalerted-deals': {
      const minDiscount = parseFloat(args[0]) || 15;
      const deals = db.getUnalertedDeals(database, minDiscount);
      output(deals);
      break;
    }
    case 'mark-alerted': {
      const ids = JSON.parse(args[0]);
      const result = db.markAsAlerted(database, ids);
      output({ success: true, changes: result.changes });
      break;
    }
    case 'insert-outreach': {
      const data = JSON.parse(args[0]);
      const result = db.insertOutreach(database, data);
      output({ success: true, id: result.lastInsertRowid });
      break;
    }
    case 'get-outreach-history': {
      const contactInfo = args[0];
      const days = parseInt(args[1]) || 30;
      const history = db.getOutreachHistory(database, contactInfo, days);
      output(history);
      break;
    }
    case 'insert-price-history': {
      const data = JSON.parse(args[0]);
      const result = db.insertPriceHistory(database, data);
      output({ success: true, id: result.lastInsertRowid });
      break;
    }
    case 'get-average-price': {
      const cardName = args[0];
      const days = parseInt(args[1]) || 30;
      const result = db.getAveragePrice(database, cardName, days);
      output(result);
      break;
    }
    case 'log-api-usage': {
      const data = JSON.parse(args[0]);
      const result = db.logApiUsage(database, data);
      output({ success: true, id: result.lastInsertRowid });
      break;
    }
    case 'get-daily-spend': {
      const spend = db.getDailyApiSpend(database);
      output(spend);
      break;
    }
    case 'get-stats': {
      const stats = db.getStats(database);
      output(stats);
      break;
    }
    case 'get-ungraded': {
      const listings = db.getUngradedListings(database);
      output(listings);
      break;
    }
    case 'update-analysis': {
      const url = args[0];
      const data = JSON.parse(args[1]);
      const result = db.updateListingAnalysis(database, url, data);
      output({ success: true, changes: result.changes });
      break;
    }
    case 'get-recent-deals': {
      const limit = parseInt(args[0]) || 20;
      const deals = db.getRecentDeals(database, limit);
      output(deals);
      break;
    }
    case 'get-recent-outreach': {
      const limit = parseInt(args[0]) || 20;
      const outreach = db.getRecentOutreach(database, limit);
      output(outreach);
      break;
    }
    case 'get-price-history': {
      const cardName = args[0];
      const history = db.getPriceHistory(database, cardName);
      output(history);
      break;
    }
    case 'get-spend-by-service': {
      const spend = db.getSpendByService(database);
      output(spend);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Available commands: insert-listing, get-unalerted-deals, mark-alerted, insert-outreach, get-outreach-history, insert-price-history, get-average-price, log-api-usage, get-daily-spend, get-stats, get-ungraded, update-analysis, get-recent-deals, get-recent-outreach, get-price-history, get-spend-by-service');
      process.exit(1);
  }
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
} finally {
  database.close();
}
