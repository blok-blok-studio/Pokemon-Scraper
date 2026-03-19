const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');
const proxyManager = require('./proxyManager');
const { launchBrowser, setupPage, dismissPopups, randomDelay } = require('./browserLauncher');

const log = createChildLogger('tcgplayer');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupPrice(cardName, setName) {
  let browser;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const proxy = proxyManager.getProxy();
    try {
      attempts++;
      log.info(`Looking up price for "${cardName}"${setName ? ` (${setName})` : ''} — attempt ${attempts}${proxy ? ` via ${proxy.label}` : ' (direct)'}`);

      browser = await launchBrowser(proxy ? proxy.server : null);
      const page = await setupPage(browser, proxy);
      await dismissPopups(page);

      const searchQuery = setName ? `${cardName} ${setName}` : cardName;
      const searchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(searchQuery)}&view=grid`;

      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await randomDelay(2000, 4000);

      // Block detection
      if (await proxyManager.detectBlock(page)) {
        log.warn('Block detected on TCGPlayer');
        if (proxy) proxyManager.reportBlocked(proxy._proxyUrl);
        if (attempts < maxAttempts) {
          await browser.close().catch(() => {});
          browser = null;
          await sleep(Math.pow(3, attempts) * 1000);
          continue;
        }
      }

      if (proxy) proxyManager.reportSuccess(proxy._proxyUrl);

      // Find the first product link on search results
      const productUrl = await page.evaluate(() => {
        const link = document.querySelector('a[href*="/product/"]');
        return link ? link.href : null;
      });

      if (!productUrl) {
        log.warn(`No product found on TCGPlayer for "${cardName}"`);
        await browser.close();
        browser = null;
        if (attempts < maxAttempts) {
          await sleep(Math.pow(3, attempts) * 1000);
          continue;
        }
        return null;
      }

      // Navigate to the product page for accurate market price
      log.info(`Navigating to product page: ${productUrl}`);
      await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await randomDelay(2000, 4000);

      // Block detection on product page
      if (await proxyManager.detectBlock(page)) {
        log.warn('Block detected on TCGPlayer product page');
        if (proxy) proxyManager.reportBlocked(proxy._proxyUrl);
        if (attempts < maxAttempts) {
          await browser.close().catch(() => {});
          browser = null;
          await sleep(Math.pow(3, attempts) * 1000);
          continue;
        }
      }

      const result = await page.evaluate(() => {
        const allText = document.body.innerText;

        // Get the main market price (first "Market Price" on the product page)
        // Handle formats: "Market Price\n\t\n$1,822.24" and "Market Price:$270.55"
        const marketMatches = allText.match(/Market Price[\s:]*\$([\d,]+\.?\d*)/gi) || [];

        let marketPrice = null;
        if (marketMatches.length > 0) {
          const firstMatch = marketMatches[0].match(/\$([\d,]+\.?\d*)/);
          if (firstMatch) {
            marketPrice = parseFloat(firstMatch[1].replace(/,/g, ''));
          }
        }

        // Get product name from h1
        const h1 = document.querySelector('h1');
        const foundName = h1 ? h1.innerText.trim() : null;

        return { marketPrice, productUrl: window.location.href, foundName };
      });

      await browser.close();
      browser = null;

      if (result.marketPrice) {
        log.info(`Found price for "${cardName}": $${result.marketPrice}`);
        return {
          cardName,
          setName: setName || null,
          marketPrice: result.marketPrice,
          url: result.productUrl || productUrl,
          source: 'tcgplayer'
        };
      }

      log.warn(`No market price found on product page for "${cardName}"`);

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
