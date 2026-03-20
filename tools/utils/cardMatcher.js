const { createChildLogger } = require('../logger');

const log = createChildLogger('card-matcher');

// Set number patterns to strip
const SET_NUMBER_PATTERNS = [
  /\d{3}\/\d{3}/g,
  /sv\d{2,3}\/sv\d{2,3}/gi,
  /swsh\d+/gi,
  /tg\d{2}\/tg\d{2}/gi,
  /\b\d{3,}\b/g,
];

// Filler words to remove (as whole words)
const FILLER_WORDS = [
  'pokemon', 'tcg', 'card', 'cards', 'trading', 'game',
  'holo', 'holographic', 'rare', 'ultra rare', 'secret rare', 'full art',
  'nm', 'lp', 'mp', 'hp', 'dmg',
  'near mint', 'lightly played', 'moderately played', 'heavily played', 'damaged',
  'psa', 'cgc', 'bgs', 'graded', 'mint', 'gem mint', 'pristine',
  'english', 'japanese', 'korean',
  'single', 'singles', 'official', 'authentic', 'genuine', 'brand new', 'new',
  'free shipping', 'fast shipping', 'ships today', 'usa seller',
  'look', 'see photos', 'see pics', 'check photos', 'read description',
];

// Accessory / non-card detection categories
const ACCESSORY_CATEGORIES = {
  sleeve: ['sleeve', 'sleeves', 'binder', 'top loader', 'toploader', 'penny sleeve', 'card saver', 'card protector', 'deck box', 'storage box', 'portfolio'],
  lot: ['lot of', 'card lot', 'bulk lot', 'bundle of', 'collection of', 'set of', 'x cards', 'random cards', 'mystery pack', 'repack', 'repacks', 'grab bag'],
  non_card: ['playmat', 'play mat', 'coin', 'dice', 'pin', 'figure', 'plush', 'jumbo card', 'oversized', 'poster', 'art print', 'sticker'],
  code: ['code card', 'online code', 'ptcgo', 'ptcgl', 'digital code', 'tcg live code', 'tcg online code'],
  fake: ['custom', 'proxy', 'proxies', 'replica', 'fake', 'fan art', 'fan made', 'orica', 'not real', 'unofficial'],
  grading: ['grading service', 'submission', 'slab only', 'empty slab', 'case only'],
};

function normalizeCardName(rawTitle) {
  if (!rawTitle) return '';

  let name = rawTitle.toLowerCase();

  // Remove special characters except hyphens and spaces
  name = name.replace(/[^a-z0-9\s\-]/g, '');

  // Remove set numbers
  for (const pattern of SET_NUMBER_PATTERNS) {
    name = name.replace(pattern, '');
  }

  // Remove filler words (longer phrases first to avoid partial matches)
  const sortedFillers = [...FILLER_WORDS].sort((a, b) => b.length - a.length);
  for (const word of sortedFillers) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    name = name.replace(regex, '');
  }

  // Collapse whitespace and trim
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function matchesWatchlist(rawTitle, watchlist) {
  if (!rawTitle || !watchlist || watchlist.length === 0) {
    return { matched: false, watchlistEntry: null, confidence: 0, normalizedTitle: '', normalizedTarget: '', method: null };
  }

  const normalizedTitle = normalizeCardName(rawTitle);

  let bestMatch = null;
  let bestScore = 0;
  let bestMethod = null;
  let bestNormalizedTarget = '';

  for (const entry of watchlist) {
    const normalizedTarget = normalizeCardName(entry.name);
    if (!normalizedTarget) continue;

    // Method A: Exact substring containment
    let scoreA = 0;
    if (normalizedTitle.includes(normalizedTarget)) {
      scoreA = 100;
    }

    // Method B: All-words containment
    const targetWords = normalizedTarget.split(/\s+/);
    const matchedWords = targetWords.filter(w => normalizedTitle.includes(w));
    const scoreB = (matchedWords.length / targetWords.length) * 100;

    // Method C: Levenshtein distance (scale penalty by target length for fairness)
    const distance = levenshteinDistance(normalizedTitle, normalizedTarget);
    const maxLen = Math.max(normalizedTitle.length, normalizedTarget.length);
    const scoreC = maxLen > 0 ? Math.max(0, (1 - distance / maxLen) * 100) : 0;

    // Levenshtein can give false positives for short card variants (e.g. "Charizard V" vs "Charizard VMAX")
    // If word matching is below 70%, cap levenshtein to not exceed word score + 10
    const cappedScoreC = scoreB < 70 ? Math.min(scoreC, scoreB + 10) : scoreC;

    // Take best method
    let score = scoreA;
    let method = 'exact';
    if (scoreB > score) { score = scoreB; method = 'words'; }
    if (cappedScoreC > score) { score = cappedScoreC; method = 'levenshtein'; }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
      bestMethod = method;
      bestNormalizedTarget = normalizedTarget;
    }
  }

  return {
    matched: bestScore >= 70,
    watchlistEntry: bestScore >= 70 ? bestMatch : null,
    confidence: Math.round(bestScore),
    normalizedTitle,
    normalizedTarget: bestNormalizedTarget,
    method: bestMethod,
  };
}

function isAccessoryOrFake(rawTitle) {
  if (!rawTitle) return { isAccessory: false, reason: null, keyword: null };

  const lower = rawTitle.toLowerCase();

  for (const [reason, keywords] of Object.entries(ACCESSORY_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return { isAccessory: true, reason, keyword };
      }
    }
  }

  return { isAccessory: false, reason: null, keyword: null };
}

function classifyListing(rawTitle, watchlist) {
  // Step 1: Check if it's an accessory or fake
  const accessoryCheck = isAccessoryOrFake(rawTitle);
  if (accessoryCheck.isAccessory) {
    return {
      skip: true,
      reason: `Accessory: ${accessoryCheck.reason} (${accessoryCheck.keyword})`,
      accessoryCheck,
      watchlistMatch: null,
      normalized: normalizeCardName(rawTitle),
    };
  }

  // Step 2: Check watchlist match
  const watchlistCheck = matchesWatchlist(rawTitle, watchlist);
  if (!watchlistCheck.matched) {
    return {
      skip: true,
      reason: `No watchlist match (confidence: ${watchlistCheck.confidence}%)`,
      accessoryCheck,
      watchlistMatch: watchlistCheck,
      normalized: watchlistCheck.normalizedTitle,
    };
  }

  // Step 3: Good candidate
  return {
    skip: false,
    reason: null,
    accessoryCheck,
    watchlistMatch: watchlistCheck,
    normalized: watchlistCheck.normalizedTitle,
  };
}

module.exports = {
  normalizeCardName,
  matchesWatchlist,
  isAccessoryOrFake,
  classifyListing,
  levenshteinDistance,
};
