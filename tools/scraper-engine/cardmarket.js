const { launchBrowser } = require('./browserLauncher');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

const log = createChildLogger('cardmarket-scraper');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeCardMarket({ query, maxPrice, condition, maxPages = 2 }) {
  let browser;
  try {
    log.info(`Searching CardMarket for: "${query}" (max $${maxPrice || 'none'})`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    const url = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(query)}&sortBy=price_asc`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000 + Math.random() * 2000);

    // Accept cookies if prompted
    try {
      const cookieBtn = await page.$('#onetrust-accept-btn-handler, [id*="accept"], button[class*="cookie"]');
      if (cookieBtn) await cookieBtn.click();
      await sleep(1000);
    } catch {}

    const listings = await page.evaluate((maxP) => {
      const results = [];
      const items = document.querySelectorAll('.table-body .row, .product-row, [class*="ProductRow"]');

      for (const item of items) {
        if (results.length >= 50) break;

        const nameEl = item.querySelector('.name a, [class*="Name"] a, a[href*="/Products/"]');
        const priceEl = item.querySelector('.price, [class*="Price"], .text-right');
        const linkEl = item.querySelector('a[href*="/Products/"]');

        if (!nameEl) continue;

        const name = nameEl.textContent.trim();
        let price = null;

        if (priceEl) {
          // CardMarket uses EUR with comma — "1,50 €"
          const priceText = priceEl.textContent.replace('€', '').replace(',', '.').replace(/[^0-9.]/g, '').trim();
          price = parseFloat(priceText);
          // Rough EUR to USD conversion
          if (!isNaN(price)) price = Math.round(price * 1.08 * 100) / 100;
        }

        const href = linkEl ? `https://www.cardmarket.com${linkEl.getAttribute('href')}` : null;

        if (!name || !price || isNaN(price) || price <= 0) continue;
        if (maxP && price > maxP) continue;

        results.push({
          card_name: name,
          price,
          url: href || '',
          source: 'cardmarket',
          seller_name: 'CardMarket Seller',
          condition: 'Not specified',
        });
      }
      return results;
    }, maxPrice);

    log.info(`Total listings found for "${query}" on CardMarket: ${listings.length}`);
    return listings;
  } catch (err) {
    log.error(`CardMarket scrape failed: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function scrapeCardMarketRateLimited(params) {
  return scraperQueue.add(() => scrapeCardMarket(params));
}

module.exports = { scrapeCardMarket, scrapeCardMarketRateLimited };
