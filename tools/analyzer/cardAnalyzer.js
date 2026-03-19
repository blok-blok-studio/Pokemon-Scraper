const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');
const db = require('../db/database');
const { autoAdvancePipeline } = require('../automation/engine');
const { createChildLogger } = require('../logger');

dotenv.config();

const log = createChildLogger('card-analyzer');
const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert Pokemon TCG card market analyst. You evaluate card listings for legitimacy, pricing accuracy, and deal quality. You know:
- Pokemon TCG card conditions: Raw, PSA 1-10, CGC, BGS grading scales
- Common scam patterns: stock photos, suspiciously low prices on high-value cards, new sellers with no feedback
- What makes cards rare: alt arts, first editions, error cards, limited print runs
- Fair market pricing relative to TCGPlayer market values

For each listing provided, return your analysis as a JSON array. Each item must have:
{
  "url": "the listing url",
  "isLegitimate": true or false,
  "matchesTarget": true or false,
  "dealGrade": "must-buy" or "good-deal" or "fair" or "overpriced" or "suspicious",
  "summary": "Brief 1-2 sentence assessment",
  "redFlags": ["list of concerns"] or []
}

Respond ONLY with valid JSON. No markdown, no backticks, no preamble.`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeBatch(listings, database) {
  const spendCap = parseFloat(process.env.DAILY_API_SPEND_CAP_USD || '5.00');
  const currentSpend = db.getDailyApiSpend(database);

  if (currentSpend.total_spend >= spendCap) {
    log.warn(`Daily spend cap reached ($${currentSpend.total_spend}/$${spendCap}). Skipping analysis.`);
    return { skipped: true, reason: 'spend_cap_reached' };
  }

  const listingSummaries = listings.map(l => ({
    card_name: l.card_name,
    price: l.price,
    tcg_market_price: l.tcg_market_price,
    url: l.url,
    seller_name: l.seller_name,
    condition: l.condition,
    source: l.source,
    discount_percent: l.discount_percent
  }));

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      log.info(`Analyzing batch of ${listings.length} listings — attempt ${attempts}`);

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Analyze these Pokemon card listings:\n${JSON.stringify(listingSummaries, null, 2)}`
        }]
      });

      const tokensIn = response.usage?.input_tokens || 0;
      const tokensOut = response.usage?.output_tokens || 0;
      const estimatedCost = (tokensIn * 3 / 1000000) + (tokensOut * 15 / 1000000);

      // Log API usage
      db.logApiUsage(database, {
        service: 'anthropic',
        endpoint: 'messages.create',
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        estimated_cost_usd: Math.round(estimatedCost * 1000000) / 1000000
      });

      log.info(`API usage: ${tokensIn} in, ${tokensOut} out, ~$${estimatedCost.toFixed(6)}`);

      const responseText = response.content[0].text.trim();
      let analyses;
      try {
        analyses = JSON.parse(responseText);
      } catch (parseErr) {
        log.error(`JSON parse failed. Raw response: ${responseText.substring(0, 500)}`);
        throw parseErr;
      }

      if (!Array.isArray(analyses)) {
        log.error(`Expected array, got ${typeof analyses}. Raw: ${responseText.substring(0, 200)}`);
        throw new Error('Response is not an array');
      }

      // Update database with results
      for (const analysis of analyses) {
        if (!analysis.url || !analysis.dealGrade) {
          log.warn(`Skipping incomplete analysis: ${JSON.stringify(analysis).substring(0, 100)}`);
          continue;
        }
        db.updateListingAnalysis(database, analysis.url, {
          deal_grade: analysis.dealGrade,
          ai_summary: analysis.summary || '',
          red_flags: JSON.stringify(analysis.redFlags || [])
        });
      }

      // Auto-advance pipeline based on AI grade
      const advanced = autoAdvancePipeline(database, analyses);
      if (advanced > 0) {
        log.info(`Auto-advanced ${advanced} deals in pipeline`);
      }

      return { analyses, tokensIn, tokensOut, estimatedCost, pipelineAdvanced: advanced };

    } catch (err) {
      log.error(`Analysis failed: ${err.message}`);
      if (attempts < maxAttempts) {
        const delay = Math.pow(3, attempts) * 1000;
        log.warn(`Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }

  log.error(`Failed to analyze batch after ${maxAttempts} attempts`);
  return { error: 'max_retries_exceeded' };
}

async function analyzeUngraded(database) {
  const ungraded = db.getUngradedListings(database);
  log.info(`Found ${ungraded.length} ungraded listings`);

  if (ungraded.length === 0) {
    return { analyzed: 0, results: [] };
  }

  const allResults = [];
  const batchSize = 10;

  for (let i = 0; i < ungraded.length; i += batchSize) {
    const batch = ungraded.slice(i, i + batchSize);
    const result = await analyzeBatch(batch, database);

    if (result.skipped) {
      log.warn('Stopping analysis — spend cap reached');
      break;
    }
    if (result.analyses) {
      allResults.push(...result.analyses);
    }
  }

  const suspicious = allResults.filter(r => r.dealGrade === 'suspicious').length;
  const mustBuy = allResults.filter(r => r.dealGrade === 'must-buy').length;
  const goodDeal = allResults.filter(r => r.dealGrade === 'good-deal').length;

  log.info(`Analysis complete: ${allResults.length} analyzed, ${mustBuy} must-buy, ${goodDeal} good-deal, ${suspicious} suspicious`);

  return { analyzed: allResults.length, mustBuy, goodDeal, suspicious, results: allResults };
}

module.exports = { analyzeBatch, analyzeUngraded };
