---
name: pokemon-scraper
description: Scrape Pokemon card listings from eBay and other marketplaces. Use this skill to find cards for sale, hunt for deals, and build a listing database. This is the primary data collection skill.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# Pokemon Card Scraper

## Description
Scrapes online marketplaces for Pokemon TCG card listings. Currently supports eBay with Buy It Now listings.

## Tools
- eBay search: `node tools/scraper-engine/ebay-cli.js search "<query>" --max-price <number> --buy-it-now`
  Returns JSON array of listings.
- Database insert: `node tools/db/cli.js insert-listing '<JSON>'`
- Database stats: `node tools/db/cli.js get-stats`
- TCG price check: `node tools/scraper-engine/tcg-cli.js lookup "<card name>"`

## Instructions
When running a scrape cycle:
1. Load the watchlist: `cat config/watchlist.json`
2. Load broad search terms from: `cat config/config.json` (field: broadSearchTerms)
3. For each watchlist card, run an eBay search with the card name and maxPrice from watchlist
4. For each broad search term, run an eBay search
5. For each listing found:
   a. Look up TCGPlayer market price using tcg-price-check tool
   b. Calculate discount_percent = ((tcgMarketPrice - listingPrice) / tcgMarketPrice) * 100
   c. Insert into database via insert-listing (dedup handles repeats automatically)
   d. Insert into price_history via insert-price-history
6. After all searches complete, log a summary: total scraped, new listings, deals found (discount > minDiscountPercent from config)
7. Report the summary and hand off new listings to card-analyzer skill for AI analysis

## Autonomous Behavior
- Run this scrape cycle every scrapingIntervalMinutes from config (default 30 min)
- If a previous scrape is still running, skip
- If daily API spend is above 80% of cap, reduce to watchlist-only (skip broad searches)
- Log all errors but never stop — if one search fails, continue with the next

## Rules
- Never scrape more than 3 pages per search query
- Always respect rate limits (1 request per 3 seconds)
- Always check daily spend before starting a cycle
- Always deduplicate via the database before alerting
