const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');
const db = require('../db/database');
const { createChildLogger } = require('../logger');

dotenv.config({ override: true });

const log = createChildLogger('memory');
const client = new Anthropic();

const MEMORY_CATEGORIES = {
  SELLER: 'seller_insight',
  MARKET: 'market_trend',
  SCRAPING: 'scraping_pattern',
  STRATEGY: 'strategy_learning',
  PRICING: 'pricing_insight',
  WARNING: 'warning',
};

const EXTRACTION_PROMPT = `You are the memory system for an autonomous Pokemon card trading agent. Your job is to extract ACTIONABLE lessons from the agent's recent activity.

You will receive a summary of what happened in the last cycle (scrape results, analysis grades, seller patterns, price data). Extract memories that will make the agent SMARTER next time.

Categories:
- seller_insight: "Seller X consistently lists fakes", "Seller Y has good prices on ETBs"
- market_trend: "Prismatic Evolutions prices dropping this week", "Charizard VMAX stabilizing around $45"
- scraping_pattern: "eBay blocks between 1-4pm", "TCGPlayer has more listings on weekends"
- strategy_learning: "Empty boxes keep getting scraped — should filter 'empty' in titles", "Japanese cards often mislabeled"
- pricing_insight: "ETBs under $30 are usually good deals", "Booster boxes above $100 from eBay are often overpriced"
- warning: "Seller scalper123 had 3 fake listings", "TCGPlayer was down for 2 hours"

Rules:
1. Each memory must be a single, clear, actionable sentence
2. Set importance: "critical" (act on this NOW), "high" (remember every cycle), "normal" (useful context), "low" (minor note)
3. Set expires_at for temporary observations (e.g. "eBay down right now" expires in 24h). Use null for permanent lessons.
4. Don't duplicate — if the insight is obvious or already well-known, skip it
5. Return 3-10 memories per cycle. Quality over quantity.

Respond with a JSON array:
[
  {
    "category": "seller_insight",
    "content": "The lesson in one clear sentence",
    "importance": "normal",
    "expires_days": null
  }
]

Respond ONLY with valid JSON. No markdown, no backticks.`;

/**
 * Extract memories from a completed scrape/analysis cycle
 */
async function extractMemories(database, cycleData) {
  try {
    // Get existing memories for dedup context
    const existingMemories = db.getMemoriesForContext(database, 20);
    const existingText = existingMemories.map(m => `- [${m.category}] ${m.content}`).join('\n');

    const prompt = `Here is what happened in the latest agent cycle:

## Scrape Results
- Source: ${cycleData.source || 'multiple'}
- New listings found: ${cycleData.newListings || 0}
- Total analyzed: ${cycleData.analyzed || 0}

## Analysis Summary
- Must-buy: ${cycleData.mustBuy || 0}
- Good deals: ${cycleData.goodDeal || 0}
- Fair: ${cycleData.fair || 0}
- Overpriced: ${cycleData.overpriced || 0}
- Suspicious: ${cycleData.suspicious || 0}

## Seller Patterns
${cycleData.sellerPatterns || 'No notable patterns'}

## Price Observations
${cycleData.priceObservations || 'No notable observations'}

## Issues Encountered
${cycleData.issues || 'None'}

## Top Deals Found
${cycleData.topDeals || 'None'}

## Existing Memories (DO NOT duplicate these):
${existingText || 'No existing memories yet'}

Extract actionable memories from this cycle. Remember: quality over quantity, and don't repeat what's already stored.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });

    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;
    const cost = (tokensIn * 3 / 1000000) + (tokensOut * 15 / 1000000);

    db.logApiUsage(database, {
      service: 'anthropic',
      endpoint: 'memory.extract',
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      estimated_cost_usd: Math.round(cost * 1000000) / 1000000
    });

    const text = response.content[0].text.trim();
    let memories;
    try {
      memories = JSON.parse(text);
    } catch (e) {
      log.error(`Memory extraction JSON parse failed: ${text.substring(0, 200)}`);
      return { stored: 0, error: 'parse_failed' };
    }

    if (!Array.isArray(memories)) {
      log.error('Memory extraction did not return array');
      return { stored: 0, error: 'not_array' };
    }

    // Convert and store
    const toStore = memories.map(m => ({
      category: m.category || 'strategy_learning',
      content: m.content,
      context: JSON.stringify(cycleData.source ? { source: cycleData.source } : {}),
      importance: m.importance || 'normal',
      source_event: 'cycle_extraction',
      expires_at: m.expires_days ? new Date(Date.now() + m.expires_days * 86400000).toISOString() : null,
    }));

    if (toStore.length > 0) {
      db.storeMemories(database, toStore);
      log.info(`Stored ${toStore.length} new memories from cycle`);
    }

    return { stored: toStore.length, memories: toStore.map(m => m.content), cost };
  } catch (err) {
    log.error(`Memory extraction failed: ${err.message}`);
    return { stored: 0, error: err.message };
  }
}

/**
 * Build a memory context string for injection into analysis prompts
 */
function buildMemoryContext(database) {
  const memories = db.getMemoriesForContext(database, 25);

  if (memories.length === 0) return '';

  const grouped = {};
  for (const m of memories) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  let context = '\n\n## Agent Memory (learned from past cycles)\n';
  for (const [cat, items] of Object.entries(grouped)) {
    const label = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    context += `\n### ${label}\n`;
    for (const m of items) {
      const importance = m.importance === 'critical' ? '🚨 ' : m.importance === 'high' ? '⚠️ ' : '';
      context += `- ${importance}${m.content}\n`;
    }
  }

  return context;
}

/**
 * Store a single quick memory (for use in scrapers, outreach, etc.)
 */
function remember(database, category, content, importance = 'normal', expiresDays = null) {
  db.storeMemory(database, {
    category,
    content,
    importance,
    source_event: 'manual',
    expires_at: expiresDays ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null,
  });
  log.info(`Stored memory: [${category}] ${content}`);
}

/**
 * Build cycle data from current database state for memory extraction
 */
function buildCycleData(database, analysisResult, scrapeResult) {
  const data = {
    source: scrapeResult?.source || 'ebay',
    newListings: scrapeResult?.newListings || 0,
    analyzed: analysisResult?.analyzed || 0,
    mustBuy: analysisResult?.mustBuy || 0,
    goodDeal: analysisResult?.goodDeal || 0,
    fair: 0,
    overpriced: 0,
    suspicious: analysisResult?.suspicious || 0,
    sellerPatterns: '',
    priceObservations: '',
    issues: '',
    topDeals: '',
  };

  // Count grades
  if (analysisResult?.results) {
    data.fair = analysisResult.results.filter(r => r.dealGrade === 'fair').length;
    data.overpriced = analysisResult.results.filter(r => r.dealGrade === 'overpriced').length;
  }

  // Seller patterns
  try {
    const sellers = database.prepare(`
      SELECT seller_name, COUNT(*) as c,
        SUM(CASE WHEN deal_grade = 'suspicious' THEN 1 ELSE 0 END) as suspicious_count
      FROM card_listings
      WHERE seller_name IS NOT NULL AND seller_name != 'unknown'
      GROUP BY seller_name HAVING c > 1
      ORDER BY c DESC LIMIT 5
    `).all();
    if (sellers.length > 0) {
      data.sellerPatterns = sellers.map(s =>
        `${s.seller_name}: ${s.c} listings, ${s.suspicious_count} suspicious`
      ).join('\n');
    }
  } catch {}

  // Top deals
  if (analysisResult?.results) {
    const top = analysisResult.results
      .filter(r => r.dealGrade === 'must-buy' || r.dealGrade === 'good-deal')
      .slice(0, 3);
    if (top.length > 0) {
      data.topDeals = top.map(t => `${t.dealGrade}: ${t.summary || t.url}`).join('\n');
    }
  }

  return data;
}

module.exports = {
  extractMemories,
  buildMemoryContext,
  remember,
  buildCycleData,
  MEMORY_CATEGORIES,
};
