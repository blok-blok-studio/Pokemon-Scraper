const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');
const proxyManager = require('./proxyManager');
const { launchBrowser, setupPage, dismissPopups, randomDelay } = require('./browserLauncher');

const log = createChildLogger('ebay-scraper');

const MAX_PROXY_SWITCHES = 3;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeEbay({ query, maxPrice, condition, sortBy, maxPages = 3 }) {
  let browser;
  let allListings = [];
  let attempts = 0;
  const maxAttempts = 3;
  let proxySwitches = 0;

  while (attempts < maxAttempts) {
    let proxy = proxyManager.getProxy();
    try {
      attempts++;
      allListings = [];
      log.info(`Searching eBay for "${query}" (max $${maxPrice || 'any'}) — attempt ${attempts}${proxy ? ` via ${proxy.label}` : ' (direct)'}`);

      browser = await launchBrowser(proxy ? proxy.server : null);
      const page = await setupPage(browser, proxy);
      await dismissPopups(page);

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
          await randomDelay(2000, 4000);
        });

        // Block detection with proxy switching
        if (await proxyManager.detectBlock(page)) {
          log.warn(`Block detected on eBay page ${pageNum}`);
          if (proxy) proxyManager.reportBlocked(proxy._proxyUrl);

          if (proxySwitches < MAX_PROXY_SWITCHES) {
            proxySwitches++;
            const newProxy = proxyManager.getProxy();
            if (newProxy) {
              log.info(`Switching to proxy ${newProxy.label}`);
              await browser.close().catch(() => {});
              proxy = newProxy;
              const retryArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
              retryArgs.push(`--proxy-server=${proxy.server}`);
              browser = await puppeteer.launch({ headless: 'new', args: retryArgs });
              const retryPage = await browser.newPage();
              if (proxy.username) await retryPage.authenticate({ username: proxy.username, password: proxy.password });
              await retryPage.setUserAgent(USER_AGENT);
              await retryPage.setViewport({ width: 1920, height: 1080 });
              await retryPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
              // Re-assign page for the evaluate below — but we can't reassign const, so just continue to next attempt
              continue;
            }
          }
          log.error('Block detected and no proxy available, skipping remaining pages');
          break;
        }

        if (proxy) proxyManager.reportSuccess(proxy._proxyUrl);

        const pageListings = await page.evaluate(() => {
          const items = [];

          // Try new eBay layout (.s-card) first, fall back to legacy (.s-item)
          let results = document.querySelectorAll('.s-card');
          let isNewLayout = results.length > 0;

          if (!isNewLayout) {
            results = document.querySelectorAll('.s-item, [class*="s-item"]');
          }

          results.forEach(item => {
            try {
              let title, priceText, link, seller, cond;

              if (isNewLayout) {
                // New eBay layout (2025+)
                const titleEl = item.querySelector('.s-card__title, [class*="s-card__title"]');
                const priceEl = item.querySelector('.s-card__price, [class*="s-card__price"]');
                const linkEl = item.querySelector('.s-card__link, a[href*="ebay.com/itm/"]');
                const subtitleEl = item.querySelector('.s-card__subtitle, [class*="s-card__subtitle"]');

                title = titleEl?.textContent?.trim();
                priceText = priceEl?.textContent?.trim();
                link = linkEl?.href;
                seller = 'unknown';
                cond = subtitleEl?.textContent?.trim() || 'Not specified';
              } else {
                // Legacy eBay layout
                const titleEl = item.querySelector('.s-item__title, [class*="s-item__title"]');
                const priceEl = item.querySelector('.s-item__price, [class*="s-item__price"]');
                const linkEl = item.querySelector('.s-item__link, a[href*="ebay.com/itm/"]');
                const sellerEl = item.querySelector('.s-item__seller-info-text, [class*="seller"]');
                const conditionEl = item.querySelector('.SECONDARY_INFO, [class*="condition"]');

                title = titleEl?.textContent?.trim();
                priceText = priceEl?.textContent?.trim();
                link = linkEl?.href;
                seller = sellerEl?.textContent?.trim() || 'unknown';
                cond = conditionEl?.textContent?.trim() || 'Not specified';
              }

              if (!title || title === 'Shop on eBay' || !priceText || !link) return;

              // Clean eBay suffix from title
              const cleanTitle = title.replace(/\.?\s*Opens in a new window or tab\s*$/i, '').trim();

              // Extract numeric price
              const priceMatch = priceText.match(/\$([\d,]+\.?\d*)/);
              if (!priceMatch) return;
              const price = parseFloat(priceMatch[1].replace(/,/g, ''));

              // Skip if it looks like a range (auction)
              if (priceText.includes(' to ')) return;

              items.push({
                card_name: cleanTitle,
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
          return !!document.querySelector('.pagination__next, [class*="pagination__next"], a[aria-label="Next page"], [class*="pagination"] a:last-child');
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
