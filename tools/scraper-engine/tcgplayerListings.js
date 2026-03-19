const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');
const proxyManager = require('./proxyManager');
const { launchBrowser, setupPage, dismissPopups, randomDelay } = require('./browserLauncher');

const log = createChildLogger('tcgplayer-listings');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTcgplayerListings({ query, maxPrice, condition, maxPages = 3 }) {
  let browser;
  let allListings = [];
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const proxy = proxyManager.getProxy();
    try {
      attempts++;
      allListings = [];
      log.info(`Searching TCGPlayer listings for "${query}" (max $${maxPrice || 'any'}) — attempt ${attempts}${proxy ? ` via ${proxy.label}` : ' (direct)'}`);

      browser = await launchBrowser(proxy ? proxy.server : null);
      const page = await setupPage(browser, proxy);
      await dismissPopups(page);

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const searchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(query)}&view=grid${pageNum > 1 ? `&page=${pageNum}` : ''}`;

        await scraperQueue.add(async () => {
          log.info(`Scraping page ${pageNum}: ${searchUrl}`);
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await randomDelay(2000, 4000);
        });

        // Block detection
        if (await proxyManager.detectBlock(page)) {
          log.warn('Block detected on TCGPlayer listings');
          if (proxy) proxyManager.reportBlocked(proxy._proxyUrl);
          break;
        }

        if (proxy) proxyManager.reportSuccess(proxy._proxyUrl);

        const pageListings = await page.evaluate(() => {
          const items = [];
          const results = document.querySelectorAll('.search-result, .product-card, [class*="search-result"]');

          results.forEach(item => {
            try {
              const titleEl = item.querySelector('.search-result__title, .product-card__title, a[href*="/product/"]');
              const priceEl = item.querySelector('.search-result__market-price--value, [class*="price"], .product-card__market-price');
              const listingPriceEl = item.querySelector('.search-result__listing-price, [class*="listing-price"], .product-card__price');
              const sellerEl = item.querySelector('.search-result__seller, [class*="seller"]');
              const linkEl = item.querySelector('a[href*="/product/"]');

              const title = titleEl?.textContent?.trim();
              const link = linkEl?.href || titleEl?.href;

              if (!title || !link) return;

              // Get listing price (what seller is asking)
              let price = null;
              const listingPriceText = listingPriceEl?.textContent?.trim() || '';
              const listingPriceMatch = listingPriceText.match(/\$([\d,]+\.?\d*)/);
              if (listingPriceMatch) {
                price = parseFloat(listingPriceMatch[1].replace(/,/g, ''));
              }

              // Get market price
              let tcgMarketPrice = null;
              const marketText = priceEl?.textContent?.trim() || '';
              const marketMatch = marketText.match(/\$([\d,]+\.?\d*)/);
              if (marketMatch) {
                tcgMarketPrice = parseFloat(marketMatch[1].replace(/,/g, ''));
              }

              // If no listing price, use market price
              if (!price && tcgMarketPrice) price = tcgMarketPrice;
              if (!price) return;

              const seller = sellerEl?.textContent?.trim() || 'unknown';

              // Calculate discount
              let discountPercent = null;
              if (tcgMarketPrice && price < tcgMarketPrice) {
                discountPercent = ((tcgMarketPrice - price) / tcgMarketPrice) * 100;
              }

              items.push({
                card_name: title,
                price,
                tcg_market_price: tcgMarketPrice,
                discount_percent: discountPercent ? Math.round(discountPercent * 10) / 10 : null,
                condition: 'Not specified',
                seller_name: seller,
                url: link.split('?')[0],
                source: 'tcgplayer_listing',
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
          return !!document.querySelector('a[aria-label="Next"], [class*="pagination"] a:last-child');
        });
        if (!hasNextPage) break;
      }

      await browser.close();
      browser = null;

      log.info(`Total listings found for "${query}" on TCGPlayer: ${allListings.length}`);
      return allListings;

    } catch (err) {
      log.error(`Error scraping TCGPlayer listings for "${query}": ${err.message}`);
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

  log.error(`Failed to scrape TCGPlayer listings for "${query}" after ${maxAttempts} attempts`);
  return allListings;
}

module.exports = { scrapeTcgplayerListings };
