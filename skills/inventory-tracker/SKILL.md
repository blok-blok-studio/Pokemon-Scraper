---
name: inventory-tracker
description: Track card purchases, sales, portfolio value, and ROI. Responds to /buy, /sell, /portfolio, /inventory Telegram commands.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# Inventory Tracker

## Description
Records card purchases and sales, tracks portfolio value against current market prices, and calculates ROI.

## Tools
- Record purchase: `node tools/db/purchase-cli.js buy --listing-id <id> --price <amount>`
- Record sale: `node tools/db/purchase-cli.js sell --id <id> --price <amount>`
- Portfolio summary: `node tools/db/purchase-cli.js portfolio`
- View inventory: `node tools/db/purchase-cli.js inventory`

## Instructions
When the operator buys a card:
1. Record the purchase with /buy <listing-id> <price>
2. This automatically moves the listing to "purchased" pipeline stage
3. Market prices auto-update on each scrape cycle

When the operator sells a card:
1. Record with /sell <purchase-id> <price>
2. Calculates profit after shipping and fees

Autonomously:
- Update current_market_price for all inventory cards during scrape cycles
- Alert via Telegram if a card drops >20% below purchase price
- Alert if a card rises >50% above purchase price

## Rules
- Never auto-buy cards — always wait for operator confirmation
- Keep market prices updated at least daily
- Include shipping and fees in profit calculations
