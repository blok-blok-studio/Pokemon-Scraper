const fs = require('fs');
const path = require('path');
const { createChildLogger } = require('../logger');

const log = createChildLogger('proxy-manager');

const PROXIES_PATH = path.join(__dirname, '..', '..', 'config', 'proxies.json');
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONSECUTIVE_BLOCKS = 5;

let proxyStates = [];

function loadProxies() {
  try {
    if (!fs.existsSync(PROXIES_PATH)) {
      const examplePath = PROXIES_PATH.replace('.json', '.example.json');
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, PROXIES_PATH);
      } else {
        log.warn('⚠️ No proxies configured. Scraping without proxies will result in IP blocks within hours. Add proxies to config/proxies.json. Recommended providers: Bright Data, Oxylabs, SmartProxy (all pay-as-you-go).');
        proxyStates = [];
        return;
      }
    }

    const raw = JSON.parse(fs.readFileSync(PROXIES_PATH, 'utf8'));

    if (!Array.isArray(raw) || raw.length === 0) {
      log.warn('⚠️ No proxies configured. Scraping without proxies will result in IP blocks within hours. Add proxies to config/proxies.json. Recommended providers: Bright Data, Oxylabs, SmartProxy (all pay-as-you-go).');
      proxyStates = [];
      return;
    }

    proxyStates = raw.map(p => ({
      url: p.url,
      label: p.label || p.url,
      type: p.type || 'unknown',
      status: 'available',
      cooldownUntil: null,
      totalRequests: 0,
      totalBlocks: 0,
      consecutiveBlocks: 0,
      lastUsed: null,
    }));

    log.info(`Loaded ${proxyStates.length} proxies`);
  } catch (err) {
    log.error(`Failed to load proxies: ${err.message}`);
    proxyStates = [];
  }
}

function parseProxyUrl(proxyUrl) {
  try {
    // Handle socks5:// by temporarily replacing for URL parsing
    const normalized = proxyUrl.replace(/^socks5:\/\//, 'http://');
    const parsed = new URL(normalized);
    const isSocks = proxyUrl.startsWith('socks5://');

    return {
      server: `${isSocks ? 'socks5' : parsed.protocol}//${parsed.hostname}:${parsed.port}`,
      username: parsed.username || null,
      password: parsed.password || null,
    };
  } catch {
    return { server: proxyUrl, username: null, password: null };
  }
}

function getProxy() {
  if (proxyStates.length === 0) return null;

  const now = Date.now();

  // Reset cooled-down proxies
  for (const proxy of proxyStates) {
    if (proxy.status === 'cooling_down' && proxy.cooldownUntil && now >= proxy.cooldownUntil) {
      proxy.status = 'available';
      proxy.cooldownUntil = null;
      log.info(`Proxy ${proxy.label} cooldown expired, now available`);
    }
  }

  // Filter available
  const available = proxyStates.filter(p => p.status === 'available');

  if (available.length === 0) {
    log.warn('No proxies available (all cooling down or dead)');
    return null;
  }

  // Select least-used proxy
  available.sort((a, b) => a.totalRequests - b.totalRequests);
  const selected = available[0];

  selected.totalRequests++;
  selected.lastUsed = new Date();

  const parsed = parseProxyUrl(selected.url);

  return {
    server: parsed.server,
    username: parsed.username,
    password: parsed.password,
    label: selected.label,
    _proxyUrl: selected.url,
  };
}

function reportBlocked(proxyUrl) {
  const proxy = proxyStates.find(p => p.url === proxyUrl);
  if (!proxy) return;

  proxy.totalBlocks++;
  proxy.consecutiveBlocks++;

  if (proxy.consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
    proxy.status = 'dead';
    proxy.cooldownUntil = null;
    log.error(`Proxy ${proxy.label} marked as dead after ${MAX_CONSECUTIVE_BLOCKS} consecutive blocks`);
  } else {
    proxy.status = 'cooling_down';
    proxy.cooldownUntil = Date.now() + COOLDOWN_MS;
    log.warn(`Proxy ${proxy.label} blocked, cooling down for 30 minutes (${proxy.consecutiveBlocks}/${MAX_CONSECUTIVE_BLOCKS})`);
  }
}

function reportSuccess(proxyUrl) {
  const proxy = proxyStates.find(p => p.url === proxyUrl);
  if (!proxy) return;

  proxy.consecutiveBlocks = 0;
  proxy.status = 'available';
}

function getProxyStats() {
  return {
    total: proxyStates.length,
    available: proxyStates.filter(p => p.status === 'available').length,
    coolingDown: proxyStates.filter(p => p.status === 'cooling_down').length,
    dead: proxyStates.filter(p => p.status === 'dead').length,
    proxies: proxyStates.map(p => ({
      label: p.label,
      status: p.status,
      totalRequests: p.totalRequests,
      totalBlocks: p.totalBlocks,
      consecutiveBlocks: p.consecutiveBlocks,
    })),
  };
}

function resetAllProxies() {
  for (const proxy of proxyStates) {
    proxy.status = 'available';
    proxy.cooldownUntil = null;
    proxy.consecutiveBlocks = 0;
  }
  log.info('All proxies reset to available');
}

// Block detection for scraped pages
async function detectBlock(page) {
  try {
    const url = page.url().toLowerCase();
    if (/captcha|challenge|verify|blocked/.test(url)) return true;

    const content = await page.content();
    const blockSignals = [
      'Access Denied',
      'Please verify you are a human',
      'unusual traffic',
      'automated access',
      'Robot Check',
      'Enter the characters you see below',
      "Sorry, we just need to make sure you're not a robot",
    ];

    for (const signal of blockSignals) {
      if (content.includes(signal)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Load proxies on module init
loadProxies();

module.exports = {
  getProxy,
  reportBlocked,
  reportSuccess,
  getProxyStats,
  resetAllProxies,
  detectBlock,
  loadProxies,
  // Exposed for testing
  _getStates: () => proxyStates,
  _setStates: (states) => { proxyStates = states; },
};
