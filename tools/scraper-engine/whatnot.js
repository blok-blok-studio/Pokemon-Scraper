const { launchBrowser } = require('./browserLauncher');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

const log = createChildLogger('whatnot-scraper');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeWhatnot({ query, maxPrice, condition, maxPages = 2 }) {
  let browser;
  try {
    log.info(`Searching Whatnot for: "${query}" (max $${maxPrice || 'none'})`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Whatnot has a marketplace section for fixed-price listings
    const url = `https://www.whatnot.com/search?q=${encodeURIComponent(query)}&category=pokemon`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000 + Math.random() * 2000);

    const listings = await page.evaluate((maxP) => {
      const results = [];
      const items = document.querySelectorAll('[class*="ProductCard"], [class*="ListingCard"], a[href*="/product/"]');

      for (const item of items) {
        if (results.length >= 50) break;

        const nameEl = item.querySelector('[class*="title"], [class*="name"], h3, h4, span');
        const priceEl = item.querySelector('[class*="price"], [class*="Price"]');
        const linkEl = item.tagName === 'A' ? item : item.querySelector('a');

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
          source: 'whatnot',
          seller_name: 'Whatnot Seller',
          condition: 'Not specified',
        });
      }
      return results;
    }, maxPrice);

    log.info(`Total listings found for "${query}" on Whatnot: ${listings.length}`);
    return listings;
  } catch (err) {
    log.error(`Whatnot scrape failed: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function scrapeWhatnotRateLimited(params) {
  return scraperQueue.add(() => scrapeWhatnot(params));
}

module.exports = { scrapeWhatnot, scrapeWhatnotRateLimited };
