const { launchBrowser } = require('./browserLauncher');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

const log = createChildLogger('amazon-scraper');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeAmazon({ query, maxPrice, condition, maxPages = 1 }) {
  let browser;
  try {
    log.info(`Searching Amazon for: "${query}" (max $${maxPrice || 'none'})`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    const params = new URLSearchParams({
      k: query + ' pokemon tcg',
      s: 'price-asc-rank',
    });
    if (maxPrice) params.set('rh', `p_36:${Math.round(maxPrice * 100)}`);

    const url = `https://www.amazon.com/s?${params}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000 + Math.random() * 2000);

    const listings = await page.evaluate((maxP) => {
      const results = [];
      const items = document.querySelectorAll('[data-component-type="s-search-result"]');

      for (const item of items) {
        if (results.length >= 30) break;

        // Skip sponsored
        if (item.querySelector('[data-component-type="sp-sponsored-result"]')) continue;

        const nameEl = item.querySelector('h2 a span, .a-text-normal');
        const priceWhole = item.querySelector('.a-price-whole');
        const priceFrac = item.querySelector('.a-price-fraction');
        const linkEl = item.querySelector('h2 a');

        if (!nameEl || !priceWhole) continue;

        const name = nameEl.textContent.trim();
        const price = parseFloat((priceWhole.textContent.replace(',', '') || '0') + '.' + (priceFrac?.textContent || '00'));
        const href = linkEl ? 'https://www.amazon.com' + linkEl.getAttribute('href') : null;

        if (!name || isNaN(price) || price <= 0) continue;
        if (maxP && price > maxP) continue;

        // Extract seller/brand if visible
        const sellerEl = item.querySelector('.a-size-base-plus, [class*="merchantName"]');
        const seller = sellerEl ? sellerEl.textContent.trim() : 'Amazon';

        results.push({
          card_name: name,
          price,
          url: href || '',
          source: 'amazon',
          seller_name: seller,
          condition: 'New',
        });
      }
      return results;
    }, maxPrice);

    log.info(`Total listings found for "${query}" on Amazon: ${listings.length}`);
    return listings;
  } catch (err) {
    log.error(`Amazon scrape failed: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function scrapeAmazonRateLimited(params) {
  return scraperQueue.add(() => scrapeAmazon(params));
}

module.exports = { scrapeAmazon, scrapeAmazonRateLimited };
