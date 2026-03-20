---
name: pokemon-scraper
description: Scrape Pokemon card listings from eBay, TCGPlayer, Troll and Toad, and other marketplaces. Use this skill to find cards for sale, hunt for deals, and build a listing database. This is the primary data collection skill.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# Pokemon Card Scraper

## Description
Scrapes multiple online marketplaces for Pokemon TCG card listings. Supports eBay, TCGPlayer, Troll and Toad, and manual Facebook Marketplace leads.

## Tools
- **Full cycle (preferred)**: `node tools/scraper-engine/scrapeAll-cli.js cycle`
  Runs watchlist + broad search terms across all enabled sources.
- **Single search**: `node tools/scraper-engine/scrapeAll-cli.js search "<query>" --max-price <N>`
  Searches all sources for a specific query.
- **Price verify**: `node tools/scraper-engine/scrapeAll-cli.js verify [max]`
  Looks up TCGPlayer market prices for listings missing them.
- **Individual scrapers** (fallback):
  - eBay: `node tools/scraper-engine/ebay-cli.js search "<query>" --max-price <N>`
  - TCGPlayer: `node tools/scraper-engine/tcgplayerListings-cli.js search "<query>" --max-price <N>`
  - Troll and Toad: `node tools/scraper-engine/trollandtoad-cli.js search "<query>" --max-price <N>`
  - TCG price check: `node tools/scraper-engine/tcg-cli.js lookup "<card name>"`
- Database stats: `node tools/db/cli.js get-stats`

## Instructions
When running a scrape cycle:
1. Use the unified orchestrator: `node tools/scraper-engine/scrapeAll-cli.js cycle`
   This automatically:
   - Loads watchlist from `config/watchlist.json`
   - Loads broad search terms from `config/config.json`
   - Scrapes all enabled sources (eBay, TCGPlayer, Troll and Toad)
   - Inserts results into database (dedup by URL)
   - Reports per-source stats
2. After scraping, hand off to card-analyzer skill for AI analysis
3. After analysis, the analyzer auto-runs price verification on good deals

## Source Configuration
Sources are configured in `config/config.json`:
```json
{
  "sources": {
    "ebay": { "enabled": true, "maxPages": 3 },
    "tcgplayer": { "enabled": true, "maxPages": 2 },
    "trollandtoad": { "enabled": true, "maxPages": 2 }
  }
}
```

## Facebook Marketplace
No auto-scraper (FB blocks bots). Manual entry via Telegram:
`/lead <url> <price> <card name>`
Inserts with source: "facebook", auto-looks up TCGPlayer market price.

## Autonomous Behavior
- Run the full cycle every scrapingIntervalMinutes from config (default 30 min)
- If a previous scrape is still running, skip
- If daily API spend is above 80% of cap, reduce to watchlist-only (skip broad searches)
- If one source fails (e.g. eBay blocked), continue with other sources
- Log all errors but never stop the cycle

## Rules
- Never scrape more than 3 pages per search query per source
- Always respect rate limits (1 request per 3 seconds)
- Always check daily spend before starting a cycle
- Always deduplicate via the database before alerting
- Run sources sequentially to avoid overwhelming the machine
