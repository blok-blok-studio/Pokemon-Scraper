const { launchBrowser } = require('./browserLauncher');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

const log = createChildLogger('gamestop-scraper');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeGameStop({ query, maxPrice, condition, maxPages = 1 }) {
  let browser;
  try {
    log.info(`Searching GameStop for: "${query}" (max $${maxPrice || 'none'})`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    const url = `https://www.gamestop.com/search/?q=${encodeURIComponent(query + ' pokemon')}&lang=default&sort=price-low-to-high`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000 + Math.random() * 2000);

    const listings = await page.evaluate((maxP) => {
      const results = [];
      const items = document.querySelectorAll('.product-tile, [class*="ProductTile"], .grid-tile');

      for (const item of items) {
        if (results.length >= 30) break;

        const nameEl = item.querySelector('.product-name a, .title a, [class*="productName"]');
        const priceEl = item.querySelector('.actual-price, [class*="actual-price"], .price span');
        const linkEl = item.querySelector('a[href*="/products/"]');

        if (!nameEl) continue;

        const name = nameEl.textContent.trim();
        let price = null;

        if (priceEl) {
          const priceText = priceEl.textContent.replace(/[^0-9.]/g, '');
          price = parseFloat(priceText);
        }

        const href = linkEl ? linkEl.href : null;

        if (!name || !price || isNaN(price) || price <= 0) continue;
        if (maxP && price > maxP) continue;

        results.push({
          card_name: name,
          price,
          url: href || '',
          source: 'gamestop',
          seller_name: 'GameStop',
          condition: 'New',
        });
      }
      return results;
    }, maxPrice);

    log.info(`Total listings found for "${query}" on GameStop: ${listings.length}`);
    return listings;
  } catch (err) {
    log.error(`GameStop scrape failed: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function scrapeGameStopRateLimited(params) {
  return scraperQueue.add(() => scrapeGameStop(params));
}

module.exports = { scrapeGameStop, scrapeGameStopRateLimited };
