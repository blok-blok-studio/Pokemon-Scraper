---
name: tcg-price-check
description: Look up Pokemon TCG card market prices on TCGPlayer. Use when the user asks for a card's market value, or when another skill needs a price reference.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# TCG Price Check

## Description
Looks up current market prices for Pokemon TCG cards on TCGPlayer.

## Tools
- Shell command: `node tools/scraper-engine/tcg-cli.js lookup "<card name>" [--set "<set name>"]`
- Returns JSON: { cardName, setName, marketPrice, url, source }
- Returns null if card not found

## Instructions
When you need to check a Pokemon card's market price:
1. Run the lookup command with the card name
2. Parse the JSON response
3. If the card isn't found, try simplifying the name (remove "Alt Art", etc.) and retry once
4. Store the price in price_history: `node tools/db/cli.js insert-price-history '{"card_name":"...","source":"tcgplayer","price":XX.XX}'`
5. Return the market price to the calling context

## Rules
- Always store price lookups in price_history for trend tracking
- Rate limit: don't look up more than 20 cards per session
- If TCGPlayer is down or blocking, log it and report "price unavailable"

## Examples
- "What's the market price of Charizard VMAX?" → lookup and respond
- "Check prices for my watchlist" → iterate watchlist, lookup each card
