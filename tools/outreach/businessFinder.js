const axios = require('axios');
const dotenv = require('dotenv');
const { createChildLogger } = require('../logger');

dotenv.config({ override: true });

const log = createChildLogger('business-finder');
const YELP_API_KEY = process.env.YELP_API_KEY;
const YELP_BASE = 'https://api.yelp.com/v3';

// Search terms mapped to our seller types
const SEARCH_QUERIES = {
  card_shop: ['pokemon cards', 'trading card store', 'TCG store', 'collectibles store'],
  comic_book_store: ['comic book store'],
  pawn_shop: ['pawn shop'],
  thrift_store: ['thrift store'],
  secondhand_store: ['consignment shop', 'resale shop'],
  antique_mall: ['antique mall', 'antique store'],
  flea_market: ['flea market'],
  estate_sale: ['estate sale'],
  game_store: ['game store', 'hobby shop'],
};

// Yelp category → our type
const CATEGORY_MAP = {
  'tradingcardstores': 'card_shop',
  'hobbyshops': 'card_shop',
  'comicbooks': 'comic_book_store',
  'pawn': 'pawn_shop',
  'thrift_stores': 'thrift_store',
  'vintage': 'antique_mall',
  'antiques': 'antique_mall',
  'fleamarkets': 'flea_market',
  'estatesales': 'estate_sale',
  'gamestores': 'card_shop',
  'collectibles': 'card_shop',
  'toys': 'card_shop',
  'usedbooks': 'secondhand_store',
  'consignment': 'secondhand_store',
};

function classifyBusiness(name, yelpCategories) {
  // Check Yelp categories first
  for (const cat of (yelpCategories || [])) {
    const alias = cat.alias || '';
    if (CATEGORY_MAP[alias]) return CATEGORY_MAP[alias];
  }

  // Fallback to name matching
  const text = (name || '').toLowerCase();
  if (text.includes('pawn')) return 'pawn_shop';
  if (text.includes('thrift') || text.includes('goodwill') || text.includes('salvation army')) return 'thrift_store';
  if (text.includes('comic')) return 'comic_book_store';
  if (text.includes('antique') || text.includes('vintage')) return 'antique_mall';
  if (text.includes('card') || text.includes('tcg') || text.includes('pokemon')) return 'card_shop';
  if (text.includes('game') || text.includes('hobby')) return 'card_shop';
  if (text.includes('flea') || text.includes('swap')) return 'flea_market';
  if (text.includes('estate')) return 'estate_sale';
  if (text.includes('consign')) return 'secondhand_store';
  return 'secondhand_store';
}

/**
 * Search Yelp Fusion API for businesses
 */
async function searchBusinesses(query, location, { maxResults = 20, sortBy = 'best_match' } = {}) {
  if (!YELP_API_KEY) {
    log.error('YELP_API_KEY not set in .env');
    return [];
  }

  try {
    log.info(`Yelp API: "${query}" in ${location}`);

    const response = await axios.get(`${YELP_BASE}/businesses/search`, {
      headers: { Authorization: `Bearer ${YELP_API_KEY}` },
      params: {
        term: query,
        location: location,
        limit: Math.min(maxResults, 50),
        sort_by: sortBy,
      },
      timeout: 15000,
    });

    const businesses = (response.data.businesses || []).map(biz => ({
      name: biz.name,
      type: classifyBusiness(biz.name, biz.categories),
      address: biz.location ? [biz.location.address1, biz.location.city, biz.location.state].filter(Boolean).join(', ') : null,
      phone: biz.phone || biz.display_phone || null,
      website: null, // Yelp API doesn't return websites in search, need detail call
      rating: biz.rating,
      reviews: biz.review_count,
      categories: (biz.categories || []).map(c => c.title),
      yelpUrl: biz.url,
      yelpId: biz.id,
      location: `${biz.location?.city || ''}, ${biz.location?.state || ''}`.trim(),
      source: 'yelp_api',
    }));

    log.info(`Found ${businesses.length} businesses for "${query}" in ${location}`);
    return businesses;
  } catch (err) {
    if (err.response?.status === 429) {
      log.warn('Yelp API rate limit hit — waiting 60s');
      await new Promise(r => setTimeout(r, 60000));
    }
    log.error(`Yelp search failed: ${err.response?.data?.error?.description || err.message}`);
    return [];
  }
}

/**
 * Get business details (website, hours, etc.) from Yelp
 */
async function getBusinessDetails(yelpId) {
  if (!YELP_API_KEY || !yelpId) return null;

  try {
    const response = await axios.get(`${YELP_BASE}/businesses/${yelpId}`, {
      headers: { Authorization: `Bearer ${YELP_API_KEY}` },
      timeout: 10000,
    });

    const biz = response.data;
    return {
      website: biz.url, // Yelp page (actual website not always available via API)
      phone: biz.phone || biz.display_phone,
      hours: biz.hours?.[0]?.open || [],
      photos: (biz.photos || []).slice(0, 3),
      isClosed: biz.is_closed,
    };
  } catch (err) {
    log.warn(`Yelp detail fetch failed for ${yelpId}: ${err.message}`);
    return null;
  }
}

/**
 * Search for multiple business types in a location
 */
async function findAllBusinessTypes(location, { types = null, maxPerType = 10 } = {}) {
  const targetTypes = types || Object.keys(SEARCH_QUERIES);
  const allBusinesses = [];
  const seen = new Set();

  for (const type of targetTypes) {
    const queries = SEARCH_QUERIES[type];
    if (!queries) {
      log.warn(`Unknown type: ${type}`);
      continue;
    }

    // Use first (most specific) query
    const query = queries[0];
    const results = await searchBusinesses(query, location, { maxResults: maxPerType });

    for (const biz of results) {
      const key = biz.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        biz.type = type; // Override with the type we searched for
        allBusinesses.push(biz);
      }
    }

    // Polite 1s delay between API calls
    await new Promise(r => setTimeout(r, 1000));
  }

  log.info(`Total unique businesses found: ${allBusinesses.length}`);
  return allBusinesses;
}

module.exports = { searchBusinesses, getBusinessDetails, findAllBusinessTypes, classifyBusiness, SEARCH_QUERIES };
