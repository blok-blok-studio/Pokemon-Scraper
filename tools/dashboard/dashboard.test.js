const { createServer } = require('./server');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config();

const { app, port } = createServer();

const server = app.listen(0, '127.0.0.1', () => {
  const testPort = server.address().port;
  console.log(`Test dashboard running on port ${testPort}`);

  http.get(`http://127.0.0.1:${testPort}/api/status`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const status = JSON.parse(data);
        if (status.running === true) {
          console.log('✓ /api/status returns valid JSON');
          console.log(`  Status: ${JSON.stringify(status)}`);
        } else {
          console.error('✗ Status check failed');
        }
      } catch (err) {
        console.error('✗ Invalid JSON response:', err.message);
      }

      server.close(() => {
        console.log('✓ Server shut down cleanly');
        console.log('\nDashboard test passed');
        process.exit(0);
      });
    });
  }).on('error', (err) => {
    console.error('✗ Request failed:', err.message);
    server.close();
    process.exit(1);
  });
});
