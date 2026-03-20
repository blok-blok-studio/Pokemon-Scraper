const { scrapeEbay } = require('./ebay');
const { scrapeTcgplayerListings } = require('./tcgplayerListings');
const { scrapeTrollAndToad } = require('./trollandtoad');
const { scrapeMercari } = require('./mercari');
const { scrapeOfferUp } = require('./offerup');
const { scrapeWhatnot } = require('./whatnot');
const { scrapeCardMarket } = require('./cardmarket');
const { scrapeAmazon } = require('./amazon');
const { scrapeGameStop } = require('./gamestop');
const { lookupPriceRateLimited } = require('./tcgplayer');
const { isAccessoryOrFake, normalizeCardName } = require('../utils/cardMatcher');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

const log = createChildLogger('scrape-all');

const DEFAULT_SOURCES = {
  ebay: { enabled: true, maxPages: 3 },
  tcgplayer: { enabled: true, maxPages: 2 },
  trollandtoad: { enabled: true, maxPages: 2 },
  mercari: { enabled: true, maxPages: 2 },
  offerup: { enabled: true, maxPages: 2 },
  whatnot: { enabled: true, maxPages: 2 },
  cardmarket: { enabled: true, maxPages: 2 },
  amazon: { enabled: true, maxPages: 1 },
  gamestop: { enabled: true, maxPages: 1 },
};

// Map source names to scrape functions
const SCRAPER_MAP = {
  ebay: scrapeEbay,
  tcgplayer: scrapeTcgplayerListings,
  trollandtoad: scrapeTrollAndToad,
  mercari: scrapeMercari,
  offerup: scrapeOfferUp,
  whatnot: scrapeWhatnot,
  cardmarket: scrapeCardMarket,
  amazon: scrapeAmazon,
  gamestop: scrapeGameStop,
};

/**
 * Run a single scraper with error handling — never let one source kill the whole cycle
 */
async function runSource(name, scrapeFn, query, maxPrice, maxPages) {
  try {
    log.info(`[${name}] Scraping: "${query}" (max $${maxPrice})`);
    const results = await scrapeFn({ query, maxPrice, maxPages });
    log.info(`[${name}] Found ${results.length} listings`);
    return { source: name, listings: results, error: null };
  } catch (err) {
    log.error(`[${name}] Failed: ${err.message}`);
    return { source: name, listings: [], error: err.message };
  }
}

/**
 * Scrape all enabled sources for a single query
 */
async function scrapeAllSources({ query, maxPrice = 500, sources = DEFAULT_SOURCES }) {
  const results = [];
  const errors = [];

  // Run each enabled source sequentially to respect rate limits
  for (const [name, config] of Object.entries(sources)) {
    if (config.enabled === false) continue;

    const scrapeFn = SCRAPER_MAP[name];
    if (!scrapeFn) {
      log.warn(`Unknown source: ${name} — skipping`);
      continue;
    }

    const r = await runSource(name, scrapeFn, query, maxPrice, config.maxPages || 2);
    results.push(...r.listings);
    if (r.error) errors.push({ source: name, error: r.error });

    // 3-5 second delay between sources to avoid IP issues
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
  }

  return { listings: results, errors };
}

/**
 * Full scrape cycle: watchlist + broad search terms → all sources → insert to DB
 */
async function runFullCycle(database, config, watchlist) {
  const startTime = Date.now();
  const sources = config.sources || DEFAULT_SOURCES;
  const maxPrice = config.maxPriceUSD || 500;

  let totalNew = 0;
  let totalDupes = 0;
  let totalFiltered = 0;
  let totalErrors = [];
  const sourceStats = { ebay: 0, tcgplayer: 0, trollandtoad: 0 };

  // 1. Scrape watchlist cards
  log.info(`=== Starting full scrape cycle ===`);
  log.info(`Watchlist: ${watchlist.length} cards, Broad terms: ${(config.broadSearchTerms || []).length}`);

  for (const card of watchlist) {
    const cardMaxPrice = card.maxPrice || maxPrice;
    const query = card.set ? `${card.name} ${card.set}` : card.name;

    const { listings, errors } = await scrapeAllSources({ query, maxPrice: cardMaxPrice, sources });
    totalErrors.push(...errors);

    for (const listing of listings) {
      const rawName = listing.card_name || listing.title || query;

      // Filter out accessories, fakes, empty boxes, sleeves, etc.
      const junkCheck = isAccessoryOrFake(rawName);
      if (junkCheck.isAccessory) {
        totalFiltered++;
        continue;
      }

      // Clean up the card name
      const cleanName = normalizeCardName(rawName) || rawName;

      const result = db.insertListing(database, {
        source: listing.source || 'unknown',
        card_name: cleanName,
        title: rawName,
        set_name: listing.set_name || card.set || null,
        condition: listing.condition || null,
        price: listing.price,
        tcg_market_price: listing.tcg_market_price || null,
        discount_percent: listing.discount_percent || null,
        url: listing.url,
        seller_name: listing.seller_name || null,
        seller_contact: listing.seller_contact || null,
      });

      if (result.changes > 0) {
        totalNew++;
        sourceStats[listing.source] = (sourceStats[listing.source] || 0) + 1;
      } else {
        totalDupes++;
      }
    }
  }

  // 2. Scrape broad search terms
  for (const term of (config.broadSearchTerms || [])) {
    const { listings, errors } = await scrapeAllSources({ query: term, maxPrice, sources });
    totalErrors.push(...errors);

    for (const listing of listings) {
      const rawName = listing.card_name || listing.title || term;

      // Filter out accessories, fakes, empty boxes, sleeves, etc.
      const junkCheck = isAccessoryOrFake(rawName);
      if (junkCheck.isAccessory) {
        totalFiltered++;
        continue;
      }

      const cleanName = normalizeCardName(rawName) || rawName;

      const result = db.insertListing(database, {
        source: listing.source || 'unknown',
        card_name: cleanName,
        title: rawName,
        set_name: listing.set_name || null,
        condition: listing.condition || null,
        price: listing.price,
        tcg_market_price: listing.tcg_market_price || null,
        discount_percent: listing.discount_percent || null,
        url: listing.url,
        seller_name: listing.seller_name || null,
        seller_contact: listing.seller_contact || null,
      });

      if (result.changes > 0) {
        totalNew++;
        sourceStats[listing.source] = (sourceStats[listing.source] || 0) + 1;
      } else {
        totalDupes++;
      }
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  const summary = {
    newListings: totalNew,
    duplicates: totalDupes,
    filtered: totalFiltered,
    bySource: sourceStats,
    errors: totalErrors,
    durationSeconds: duration,
  };

  log.info(`=== Scrape cycle complete ===`);
  log.info(`New: ${totalNew}, Dupes: ${totalDupes}, Filtered junk: ${totalFiltered}, Duration: ${duration}s`);
  log.info(`By source: eBay=${sourceStats.ebay || 0}, TCGPlayer=${sourceStats.tcgplayer || 0}, T&T=${sourceStats.trollandtoad || 0}`);
  if (totalErrors.length > 0) {
    log.warn(`Errors: ${totalErrors.map(e => `${e.source}: ${e.error}`).join('; ')}`);
  }

  return summary;
}

/**
 * Price-verify good deals — lookup TCGPlayer market price for listings missing it
 */
async function verifyPrices(database, { maxVerifications = 20 } = {}) {
  const needsPrice = database.prepare(`
    SELECT id, card_name, set_name, price, deal_grade FROM card_listings
    WHERE tcg_market_price IS NULL
      AND deal_grade IN ('must-buy', 'good-deal', 'fair')
    ORDER BY
      CASE deal_grade WHEN 'must-buy' THEN 1 WHEN 'good-deal' THEN 2 ELSE 3 END
    LIMIT ?
  `).all(maxVerifications);

  if (needsPrice.length === 0) {
    log.info('No listings need price verification');
    return { verified: 0 };
  }

  log.info(`Price-verifying ${needsPrice.length} listings...`);
  let verified = 0;

  for (const listing of needsPrice) {
    try {
      const priceData = await lookupPriceRateLimited(listing.card_name, listing.set_name);
      if (priceData && priceData.marketPrice) {
        const discount = ((priceData.marketPrice - listing.price) / priceData.marketPrice) * 100;
        database.prepare(`
          UPDATE card_listings
          SET tcg_market_price = ?, discount_percent = ?
          WHERE id = ?
        `).run(priceData.marketPrice, Math.round(discount * 100) / 100, listing.id);
        verified++;
        log.info(`[${listing.card_name}] Market: $${priceData.marketPrice}, Listed: $${listing.price}, Discount: ${discount.toFixed(1)}%`);
      }
    } catch (err) {
      log.warn(`Price lookup failed for "${listing.card_name}": ${err.message}`);
    }
  }

  log.info(`Price verification complete: ${verified}/${needsPrice.length} verified`);
  return { verified, total: needsPrice.length };
}

module.exports = { scrapeAllSources, runFullCycle, verifyPrices, DEFAULT_SOURCES };
