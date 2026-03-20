const { launchBrowser } = require('./browserLauncher');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

const log = createChildLogger('offerup-scraper');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeOfferUp({ query, maxPrice, condition, maxPages = 2 }) {
  let browser;
  try {
    log.info(`Searching OfferUp for: "${query}" (max $${maxPrice || 'none'})`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    const params = new URLSearchParams({
      q: query,
      sort: 'price_asc',
      delivery_param: 'all',
    });
    if (maxPrice) params.set('price_max', maxPrice);

    const url = `https://offerup.com/search?${params}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000 + Math.random() * 2000);

    const listings = await page.evaluate((maxP) => {
      const results = [];
      const items = document.querySelectorAll('[class*="ItemTile"], [data-testid*="listing"], a[href*="/item/"]');

      for (const item of items) {
        if (results.length >= 50) break;

        const nameEl = item.querySelector('[class*="title"], [class*="Title"], span');
        const priceEl = item.querySelector('[class*="price"], [class*="Price"]');
        const linkEl = item.tagName === 'A' ? item : item.querySelector('a[href*="/item/"]');

        if (!nameEl || !priceEl) continue;

        const name = nameEl.textContent.trim();
        const priceText = priceEl.textContent.replace(/[^0-9.]/g, '');
        const price = parseFloat(priceText);
        const href = linkEl ? linkEl.href : null;

        if (!name || isNaN(price) || price <= 0) continue;
        if (maxP && price > maxP) continue;

        results.push({
          card_name: name,
          price,
          url: href || '',
          source: 'offerup',
          seller_name: 'OfferUp Seller',
          condition: 'Not specified',
        });
      }
      return results;
    }, maxPrice);

    log.info(`Total listings found for "${query}" on OfferUp: ${listings.length}`);
    return listings;
  } catch (err) {
    log.error(`OfferUp scrape failed: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function scrapeOfferUpRateLimited(params) {
  return scraperQueue.add(() => scrapeOfferUp(params));
}

module.exports = { scrapeOfferUp, scrapeOfferUpRateLimited };
