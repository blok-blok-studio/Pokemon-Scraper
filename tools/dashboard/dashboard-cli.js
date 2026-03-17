const dotenv = require('dotenv');
dotenv.config();

const command = process.argv[2];

switch (command) {
  case 'start': {
    const background = process.argv.includes('--background');
    const { start } = require('./server');
    start(background);
    break;
  }
  case 'status': {
    const port = parseInt(process.env.AGENT_PORT || '3847');
    const http = require('http');
    const req = http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const status = JSON.parse(data);
          console.log(JSON.stringify({ running: true, ...status }, null, 2));
        } catch {
          console.log(JSON.stringify({ running: false, error: 'Invalid response' }));
        }
      });
    });
    req.on('error', () => {
      console.log(JSON.stringify({ running: false, error: 'Dashboard not running' }));
    });
    req.setTimeout(3000, () => {
      req.destroy();
      console.log(JSON.stringify({ running: false, error: 'Timeout' }));
    });
    break;
  }
  default:
    console.error('Usage:');
    console.error('  node dashboard-cli.js start [--background]');
    console.error('  node dashboard-cli.js status');
    process.exit(1);
}
