const puppeteer = require('puppeteer');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');
const proxyManager = require('./proxyManager');

const log = createChildLogger('trollandtoad-scraper');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTrollAndToad({ query, maxPrice, condition, maxPages = 3 }) {
  let browser;
  let allListings = [];
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const proxy = proxyManager.getProxy();
    try {
      attempts++;
      allListings = [];
      log.info(`Searching Troll and Toad for "${query}" (max $${maxPrice || 'any'}) — attempt ${attempts}${proxy ? ` via ${proxy.label}` : ' (direct)'}`);

      const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
      if (proxy) launchArgs.push(`--proxy-server=${proxy.server}`);

      browser = await puppeteer.launch({ headless: 'new', args: launchArgs });
      const page = await browser.newPage();
      if (proxy && proxy.username) {
        await page.authenticate({ username: proxy.username, password: proxy.password });
      }
      await page.setUserAgent(USER_AGENT);
      await page.setViewport({ width: 1920, height: 1080 });

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const searchUrl = `https://www.trollandtoad.com/category.php?selected-cat=0&search-words=${encodeURIComponent(query)}&is-search=Y${pageNum > 1 ? `&page-no=${pageNum}` : ''}`;

        await scraperQueue.add(async () => {
          log.info(`Scraping page ${pageNum}: ${searchUrl}`);
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(2000);
        });

        // Block detection
        if (await proxyManager.detectBlock(page)) {
          log.warn('Block detected on Troll and Toad');
          if (proxy) proxyManager.reportBlocked(proxy._proxyUrl);
          break;
        }

        if (proxy) proxyManager.reportSuccess(proxy._proxyUrl);

        const pageListings = await page.evaluate(() => {
          const items = [];
          const results = document.querySelectorAll('.product-col, .card-container, [class*="product"]');

          results.forEach(item => {
            try {
              const titleEl = item.querySelector('.product-info a, .card-text a, a[href*="/product/"]');
              const priceEl = item.querySelector('.product-price, .price, [class*="price"]');
              const conditionEl = item.querySelector('.product-condition, [class*="condition"]');

              const title = titleEl?.textContent?.trim();
              const priceText = priceEl?.textContent?.trim();
              const link = titleEl?.href;
              const cond = conditionEl?.textContent?.trim() || 'Not specified';

              if (!title || !priceText || !link) return;

              const priceMatch = priceText.match(/\$([\d,]+\.?\d*)/);
              if (!priceMatch) return;
              const price = parseFloat(priceMatch[1].replace(/,/g, ''));

              items.push({
                card_name: title,
                price,
                condition: cond,
                seller_name: 'Troll and Toad',
                url: link,
                source: 'trollandtoad',
              });
            } catch (e) {
              // Skip malformed items
            }
          });

          return items;
        });

        log.info(`Page ${pageNum}: found ${pageListings.length} listings`);

        // Filter by maxPrice
        const filtered = maxPrice
          ? pageListings.filter(l => l.price <= maxPrice)
          : pageListings;

        allListings = allListings.concat(filtered);

        // Check for next page
        const hasNextPage = await page.evaluate(() => {
          return !!document.querySelector('a[rel="next"], .pagination a:last-child');
        });
        if (!hasNextPage) break;
      }

      await browser.close();
      browser = null;

      log.info(`Total listings found for "${query}" on Troll and Toad: ${allListings.length}`);
      return allListings;

    } catch (err) {
      log.error(`Error scraping Troll and Toad for "${query}": ${err.message}`);
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

  log.error(`Failed to scrape Troll and Toad for "${query}" after ${maxAttempts} attempts`);
  return allListings;
}

module.exports = { scrapeTrollAndToad };
