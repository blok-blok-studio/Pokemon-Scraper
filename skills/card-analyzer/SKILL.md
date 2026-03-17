---
name: card-analyzer
description: Use AI to analyze Pokemon card listings for legitimacy, deal quality, and red flags. Grades deals from must-buy to suspicious. Call this after scraping new listings.
metadata:
  openclaw:
    requires:
      bins: ["node"]
      env: ["ANTHROPIC_API_KEY"]
---

# Card Analyzer

## Description
AI-powered analysis of Pokemon card listings. Determines if listings are legitimate, grades deal quality, and identifies red flags like scams or fakes.

## Tools
- Analyze ungraded: `node tools/analyzer/analyzer-cli.js analyze-ungraded`
  Pulls all listings without a deal_grade from the database, analyzes them in batches of 10, updates the database with results. Returns JSON summary.
- Check spend: `node tools/db/cli.js get-daily-spend`

## Instructions
When called to analyze listings:
1. First check daily API spend: `node tools/db/cli.js get-daily-spend`
2. If spend is above DAILY_API_SPEND_CAP_USD from .env, skip analysis and report "Spend cap reached, skipping AI analysis"
3. Run: `node tools/analyzer/analyzer-cli.js analyze-ungraded`
4. Report results: how many analyzed, how many flagged suspicious, how many graded as must-buy or good-deal
5. Hand off must-buy and good-deal listings to the deal-alerts skill for Telegram notification

## Deal Grades
- must-buy: >30% below market, legitimate listing, no red flags
- good-deal: 15-30% below market, legitimate
- fair: within 15% of market price
- overpriced: above market price
- suspicious: red flags present (new seller + very low price, stock photos, vague description)

## Rules
- Never analyze the same listing URL twice (check DB cache first)
- Batch listings in groups of 10 to minimize API calls
- Always log token usage and estimated cost
- If API errors persist after 3 retries, skip the batch and alert via Telegram
