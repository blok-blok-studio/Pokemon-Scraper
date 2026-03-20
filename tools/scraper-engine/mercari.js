const { launchBrowser } = require('./browserLauncher');
const { scraperQueue } = require('../rate-limiter/rateLimiter');
const { createChildLogger } = require('../logger');

const log = createChildLogger('mercari-scraper');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeMercari({ query, maxPrice, condition, maxPages = 2 }) {
  let browser;
  try {
    log.info(`Searching Mercari for: "${query}" (max $${maxPrice || 'none'})`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Mercari search URL — add "pokemon" to ensure card results
    const searchQuery = query.toLowerCase().includes('pokemon') ? query : `Pokemon ${query}`;
    const url = `https://www.mercari.com/search/?keyword=${encodeURIComponent(searchQuery)}&status=on_sale&sort=price_asc`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000 + Math.random() * 2000);

    // Dismiss cookie banner
    try {
      const gotIt = await page.$('button');
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('Got it')) { await btn.click(); break; }
      }
    } catch {}
    await sleep(1000);

    const listings = await page.evaluate((maxP, searchTerm) => {
      const results = [];
      const links = document.querySelectorAll('a[href*="/item/"]');

      for (const link of links) {
        if (results.length >= 50) break;

        const parent = link.closest('div') || link;
        const allText = parent.innerText || '';
        const lines = allText.split('\n').filter(l => l.trim());

        // Find price
        const priceMatch = allText.match(/\$([\d,.]+)/);
        if (!priceMatch) continue;
        const price = parseFloat(priceMatch[1].replace(',', ''));

        // First non-empty line that isn't a price is likely the title
        let name = '';
        for (const line of lines) {
          if (!line.match(/^\$/) && line.length > 5 && !line.match(/^(Free|Shipping|New|Like|Used)/i)) {
            name = line;
            break;
          }
        }

        if (!name) continue;
        if (maxP && price > maxP) continue;

        // Filter: must be Pokemon-related
        const combined = (name + ' ' + allText).toLowerCase();
        if (!combined.includes('pokemon') && !combined.includes('charizard') && !combined.includes('pikachu') && !combined.includes('vmax') && !combined.includes('tcg') && !combined.includes('booster')) {
          continue;
        }

        results.push({
          card_name: name,
          price,
          url: link.href,
          source: 'mercari',
          seller_name: 'Mercari Seller',
          condition: 'Not specified',
        });
      }
      return results;
    }, maxPrice, query);

    log.info(`Total listings found for "${query}" on Mercari: ${listings.length}`);
    return listings;
  } catch (err) {
    log.error(`Mercari scrape failed: ${err.message}`);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function scrapeMercariRateLimited(params) {
  return scraperQueue.add(() => scrapeMercari(params));
}

module.exports = { scrapeMercari, scrapeMercariRateLimited };
