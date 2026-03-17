const puppeteer = require('puppeteer');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

const log = createChildLogger('tcgplayer');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupPrice(cardName, setName) {
  let browser;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      log.info(`Looking up price for "${cardName}"${setName ? ` (${setName})` : ''} — attempt ${attempts}`);

      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.setViewport({ width: 1920, height: 1080 });

      const searchQuery = setName ? `${cardName} ${setName}` : cardName;
      const searchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(searchQuery)}&view=grid`;

      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);

      // Try to find product listings and market price
      const result = await page.evaluate((targetCard) => {
        // Look for search results
        const listings = document.querySelectorAll('.search-result__content, .product-card, [class*="product"]');

        // Try to find the market price from the page
        const priceElements = document.querySelectorAll('.product-card__market-price, [class*="market-price"], [class*="MarketPrice"], .price-point__data');

        let marketPrice = null;
        let productUrl = null;
        let foundName = null;

        // Try first product link
        const firstLink = document.querySelector('.search-result__content a, .product-card a, a[href*="/product/"]');
        if (firstLink) {
          productUrl = firstLink.href;
          foundName = firstLink.textContent?.trim();
        }

        // Try to find market price text
        const allText = document.body.innerText;
        const marketMatch = allText.match(/Market Price:?\s*\$(\d+\.?\d*)/i) ||
                           allText.match(/Market\s*\$(\d+\.?\d*)/i);
        if (marketMatch) {
          marketPrice = parseFloat(marketMatch[1]);
        }

        // Also try price elements
        if (!marketPrice) {
          for (const el of priceElements) {
            const text = el.textContent;
            const match = text.match(/\$(\d+\.?\d*)/);
            if (match) {
              marketPrice = parseFloat(match[1]);
              break;
            }
          }
        }

        return { marketPrice, productUrl, foundName };
      }, cardName);

      await browser.close();
      browser = null;

      if (result.marketPrice) {
        log.info(`Found price for "${cardName}": $${result.marketPrice}`);
        return {
          cardName,
          setName: setName || null,
          marketPrice: result.marketPrice,
          url: result.productUrl || searchUrl,
          source: 'tcgplayer'
        };
      }

      // If no market price on search page, try clicking into first result
      log.warn(`No market price found on search page for "${cardName}"`);

      if (attempts < maxAttempts) {
        log.warn(`Retrying in ${Math.pow(3, attempts)}s...`);
        await sleep(Math.pow(3, attempts) * 1000);
      }

    } catch (err) {
      log.error(`Error looking up "${cardName}": ${err.message}`);
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

  log.error(`Failed to find price for "${cardName}" after ${maxAttempts} attempts`);
  return null;
}

async function lookupPriceRateLimited(cardName, setName) {
  return scraperQueue.add(() => lookupPrice(cardName, setName));
}

module.exports = { lookupPrice, lookupPriceRateLimited };
