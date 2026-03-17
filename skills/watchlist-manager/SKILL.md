---
name: watchlist-manager
description: Manage the Pokemon card watchlist. Add cards, remove cards, view the current watchlist, and update max prices. Responds to Telegram commands /watchlist, /add, /remove.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# Watchlist Manager

## Description
Manages config/watchlist.json — the list of Pokemon cards being actively hunted by the agent.

## Tools
- View watchlist: `cat config/watchlist.json`
- Write updated watchlist: write the updated JSON array to config/watchlist.json (ensure valid JSON formatting)
- Get average price from history: `node tools/db/cli.js get-average-price "<card name>" <days>`
- Get stats: `node tools/db/cli.js get-stats`

## Instructions
- When user sends /watchlist or asks "show watchlist": read and display config/watchlist.json in a formatted list showing name, set, maxPrice for each card
- When user sends /add <card name> or says "add <card> to watchlist":
  1. Ask for the set name and maxPrice if not provided
  2. Check price_history for recent average price to suggest a maxPrice
  3. Add the new entry to watchlist.json
  4. Confirm: "Added [card name] to watchlist with max price $[X]"
- When user sends /remove <card name>:
  1. Find the matching entry (case-insensitive partial match is fine)
  2. Remove it from watchlist.json
  3. Confirm: "Removed [card name] from watchlist"
- When user says "update max price for <card> to <price>": update the maxPrice field for that card

## Rules
- Always confirm changes with the user before writing the file
- Keep the JSON formatted and valid (pretty-print with 2-space indent)
- If a card name is ambiguous (partial match hits multiple), ask for clarification
- Maximum 50 cards on the watchlist to keep scraping manageable
