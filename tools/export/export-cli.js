const db = require('../db/database');
const { exportDealsCSV, exportOutreachCSV, exportPriceHistoryCSV, generateDealReport } = require('./exporter');

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--min-discount' && args[i + 1]) { opts.minDiscount = parseFloat(args[++i]); }
    else if (args[i] === '--days' && args[i + 1]) { opts.days = parseInt(args[++i]); }
    else if (args[i] === '--grade' && args[i + 1]) { opts.gradeFilter = args[++i].split(','); }
    else if (args[i] === '--status' && args[i + 1]) { opts.status = args[++i]; }
    else if (args[i] === '--method' && args[i + 1]) { opts.method = args[++i]; }
    else if (args[i] === '--all') { opts.all = true; }
  }
  return opts;
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const opts = parseArgs(args.slice(1));
  const days = opts.days || 30;

  const database = db.init();

  try {
    if (command === 'deals') {
      const startDate = new Date(Date.now() - days * 86400000).toISOString();
      const result = exportDealsCSV(database, {
        minDiscount: opts.minDiscount || 0,
        startDate,
        gradeFilter: opts.gradeFilter || null,
      });
      console.log(`Exported ${result.rowCount} rows to ${result.filePath} (${result.fileSize} bytes)`);
    }
    else if (command === 'outreach') {
      const startDate = new Date(Date.now() - days * 86400000).toISOString();
      const result = exportOutreachCSV(database, {
        startDate,
        status: opts.status || null,
        method: opts.method || null,
      });
      console.log(`Exported ${result.rowCount} rows to ${result.filePath} (${result.fileSize} bytes)`);
    }
    else if (command === 'prices') {
      const cardName = opts.all ? '*' : args[1];
      if (!cardName) {
        console.error('Usage: export-cli.js prices "<card name>" --days <N>');
        console.error('       export-cli.js prices --all --days <N>');
        process.exit(1);
      }
      const result = exportPriceHistoryCSV(database, cardName, days);
      console.log(`Exported ${result.rowCount} rows to ${result.filePath} (${result.fileSize} bytes)`);
    }
    else if (command === 'report') {
      const result = generateDealReport(database, days);
      console.log(result.report);
      console.log(`\nSaved to: ${result.savedTo}`);
    }
    else {
      console.error('Usage:');
      console.error('  export-cli.js deals [--min-discount <N>] [--days <N>] [--grade must-buy,good-deal]');
      console.error('  export-cli.js outreach [--days <N>] [--status replied] [--method email]');
      console.error('  export-cli.js prices "<card name>" [--days <N>]');
      console.error('  export-cli.js prices --all [--days <N>]');
      console.error('  export-cli.js report [--days <N>]');
      process.exit(1);
    }
  } finally {
    database.close();
  }
}

main();
