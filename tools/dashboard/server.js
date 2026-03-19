const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

dotenv.config({ override: true });

const log = createChildLogger('dashboard');
const startTime = Date.now();

function createServer() {
  const app = express();
  const database = db.init();
  const port = parseInt(process.env.AGENT_PORT || '3847');

  app.use(express.static(path.join(__dirname, 'public')));

  // Mount webhook handler
  try {
    const webhookHandler = require('../resend-client/webhookHandler');
    app.use('/webhook', webhookHandler);
    log.info('Webhook handler mounted at /webhook/email-reply');
  } catch (err) {
    log.warn(`Webhook handler not loaded: ${err.message}`);
  }

  app.get('/api/status', (req, res) => {
    try {
      const { getHealthReport } = require('../maintenance/healthCheck');
      const health = getHealthReport(database);
      const uptime = Date.now() - startTime;
      const hours = Math.floor(uptime / 3600000);
      const minutes = Math.floor((uptime % 3600000) / 60000);
      res.json({
        running: true,
        paused: false,
        uptime: `${hours}h ${minutes}m`,
        lastScrape: health.lastScrapeAt || null,
        nextScrape: health.lastScrapeAt ? new Date(new Date(health.lastScrapeAt).getTime() + 1800000).toISOString() : null,
        health,
      });
    } catch {
      const uptime = Date.now() - startTime;
      const hours = Math.floor(uptime / 3600000);
      const minutes = Math.floor((uptime % 3600000) / 60000);
      res.json({ running: true, uptime: `${hours}h ${minutes}m` });
    }
  });

  app.get('/api/stats', (req, res) => {
    try {
      const stats = db.getStats(database);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/deals', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const deals = db.getRecentDeals(database, limit);
      res.json(deals);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/outreach', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const outreach = db.getRecentOutreach(database, limit);
      res.json(outreach);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/price-history', (req, res) => {
    try {
      const card = req.query.card;
      if (!card) return res.status(400).json({ error: 'card parameter required' });
      const history = db.getPriceHistory(database, card);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/spend', (req, res) => {
    try {
      const spend = db.getSpendByService(database);
      const dailyTotal = spend.today.reduce((sum, s) => sum + s.spend, 0);
      const monthlyTotal = spend.month.reduce((sum, s) => sum + s.spend, 0);
      const cap = parseFloat(process.env.DAILY_API_SPEND_CAP_USD || '5.00');
      res.json({ ...spend, dailyTotal, monthlyTotal, cap });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/watchlist', (req, res) => {
    try {
      const watchlistPath = path.join(__dirname, '..', '..', 'config', 'watchlist.json');
      if (fs.existsSync(watchlistPath)) {
        const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
        res.json(watchlist);
      } else {
        res.json([]);
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return { app, port, database };
}

function start(background = false) {
  const { app, port } = createServer();

  const server = app.listen(port, '127.0.0.1', () => {
    log.info(`Dashboard running at http://localhost:${port}`);
    console.log(`Dashboard running at http://localhost:${port}`);

    if (background) {
      console.log(`PID: ${process.pid}`);
    }
  });

  return server;
}

module.exports = { createServer, start };
