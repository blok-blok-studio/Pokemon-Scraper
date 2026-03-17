const puppeteer = require('puppeteer');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

const log = createChildLogger('ebay-scraper');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeEbay({ query, maxPrice, condition, sortBy, maxPages = 3 }) {
  let browser;
  let allListings = [];
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      log.info(`Searching eBay for "${query}" (max $${maxPrice || 'any'}) — attempt ${attempts}`);

      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.setViewport({ width: 1920, height: 1080 });

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const params = new URLSearchParams({
          _nkw: query,
          LH_BIN: '1',        // Buy It Now only
          _sop: '15',         // Sort by price + shipping lowest first
        });
        if (maxPrice) params.set('_udhi', maxPrice.toString());
        if (pageNum > 1) params.set('_pgn', pageNum.toString());

        const url = `https://www.ebay.com/sch/i.html?${params.toString()}`;

        await scraperQueue.add(async () => {
          log.info(`Scraping page ${pageNum}: ${url}`);
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(2000);
        });

        const pageListings = await page.evaluate(() => {
          const items = [];
          const results = document.querySelectorAll('.s-item, [class*="s-item"]');

          results.forEach(item => {
            try {
              const titleEl = item.querySelector('.s-item__title, [class*="s-item__title"]');
              const priceEl = item.querySelector('.s-item__price, [class*="s-item__price"]');
              const linkEl = item.querySelector('.s-item__link, a[href*="ebay.com/itm/"]');
              const sellerEl = item.querySelector('.s-item__seller-info-text, [class*="seller"]');
              const conditionEl = item.querySelector('.SECONDARY_INFO, [class*="condition"]');

              const title = titleEl?.textContent?.trim();
              const priceText = priceEl?.textContent?.trim();
              const link = linkEl?.href;
              const seller = sellerEl?.textContent?.trim() || 'unknown';
              const cond = conditionEl?.textContent?.trim() || 'Not specified';

              if (!title || title === 'Shop on eBay' || !priceText || !link) return;

              // Extract numeric price
              const priceMatch = priceText.match(/\$(\d+[\.,]?\d*)/);
              if (!priceMatch) return;
              const price = parseFloat(priceMatch[1].replace(',', ''));

              // Skip if it looks like a range (auction)
              if (priceText.includes(' to ')) return;

              items.push({
                card_name: title,
                price,
                condition: cond,
                seller_name: seller,
                url: link.split('?')[0], // clean URL
                source: 'ebay'
              });
            } catch (e) {
              // Skip malformed items
            }
          });

          return items;
        });

        log.info(`Page ${pageNum}: found ${pageListings.length} listings`);
        allListings = allListings.concat(pageListings);

        // Check if there are more pages
        const hasNextPage = await page.evaluate(() => {
          return !!document.querySelector('.pagination__next, [class*="pagination__next"]');
        });
        if (!hasNextPage) break;
      }

      await browser.close();
      browser = null;

      log.info(`Total listings found for "${query}": ${allListings.length}`);
      return allListings;

    } catch (err) {
      log.error(`Error scraping eBay for "${query}": ${err.message}`);
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }
      if (attempts < maxAttempts) {
        const delay = Math.pow(3, attempts) * 1000;
        log.warn(`Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }

  log.error(`Failed to scrape eBay for "${query}" after ${maxAttempts} attempts`);
  return allListings;
}

module.exports = { scrapeEbay };
