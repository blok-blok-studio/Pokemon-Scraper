const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createChildLogger } = require('../logger');

const log = createChildLogger('browser');

// Apply stealth plugin — hides puppeteer fingerprints from bot detection
puppeteer.use(StealthPlugin());

// Rotate user agents to look like different real browsers
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Random delay between min and max ms (human-like timing)
function randomDelay(minMs = 1000, maxMs = 3000) {
  return new Promise(resolve => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)));
}

async function launchBrowser(proxyServer = null) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1920,1080',
  ];

  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args,
  });

  return browser;
}

async function setupPage(browser, proxy = null) {
  const page = await browser.newPage();
  const userAgent = getRandomUserAgent();

  // Authenticate proxy if needed
  if (proxy && proxy.username) {
    await page.authenticate({ username: proxy.username, password: proxy.password });
  }

  await page.setUserAgent(userAgent);
  await page.setViewport({ width: 1920, height: 1080 });

  // Set realistic browser properties
  await page.evaluateOnNewDocument(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Add realistic plugins array
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Add languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  // Block unnecessary resources to speed up page loads
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    // Block images, fonts, and media to speed up scraping
    if (['image', 'font', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  log.info(`Browser page ready (UA: ${userAgent.substring(0, 30)}...)`);
  return page;
}

// Dismiss cookie banners and popups
async function dismissPopups(page) {
  try {
    const dismissSelectors = [
      'button[id*="accept"]',
      'button[class*="accept"]',
      'button[id*="consent"]',
      'button[class*="consent"]',
      '[aria-label*="Accept"]',
      '[aria-label*="accept"]',
      'button[id*="cookie"]',
      '#onetrust-accept-btn-handler',
      '.cookie-consent-accept',
    ];

    for (const selector of dismissSelectors) {
      const button = await page.$(selector);
      if (button) {
        await button.click();
        log.info('Dismissed popup/cookie banner');
        await randomDelay(500, 1000);
        break;
      }
    }
  } catch {
    // Popups are best-effort
  }
}

module.exports = {
  launchBrowser,
  setupPage,
  dismissPopups,
  randomDelay,
  getRandomUserAgent,
  USER_AGENTS,
};
