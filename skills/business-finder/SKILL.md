---
name: business-finder
description: Find local businesses (card shops, pawn shops, thrift stores, etc.) and extract their contact info for outreach. Uses Yelp Fusion API for business search and Puppeteer for email extraction from websites. Use this skill to build your seller contact list.
metadata:
  openclaw:
    requires:
      bins: ["node"]
      env: ["YELP_API_KEY"]
---

# Business Finder & Contact Discovery

## Description
Searches for local businesses that might sell or have Pokemon cards — card shops, pawn shops, thrift stores, comic book stores, antique malls, flea markets, estate sales, and more. Extracts their contact info (phone, email, website) and adds them to the outreach contact list.

## Tools
- **Find businesses in a city**: `node tools/outreach/contact-cli.js find "Denver, CO" --types pawn_shop,card_shop,thrift_store`
- **Find online sellers**: `node tools/outreach/contact-cli.js find-online --query "pokemon card store"`
- **Extract email from a website**: `node tools/outreach/contact-cli.js extract-email "https://example.com"`
- **List all contacts**: `node tools/outreach/contact-cli.js list`

## Supported Business Types
- `card_shop` — Pokemon/TCG stores, collectibles, hobby shops
- `comic_book_store` — Comic shops with TCG sections
- `pawn_shop` — Pawn shops that get random card collections
- `thrift_store` — Goodwill, Salvation Army, donation shops
- `secondhand_store` — Consignment, resale shops
- `antique_mall` — Antique malls with vendor booths
- `flea_market` — Flea markets and swap meets
- `estate_sale` — Estate sale companies
- `game_store` — Game/hobby stores

## Instructions
When discovering new contacts:
1. Search by city + business types: `node tools/outreach/contact-cli.js find "City, State" --types type1,type2`
2. The pipeline automatically:
   - Searches Yelp for matching businesses
   - Extracts emails from their websites (if found)
   - Deduplicates against existing contacts
   - Saves new contacts to `config/contacts.json`
3. Businesses without emails go to "needs manual email" — agent can try voice outreach or skip
4. After discovery, hand off to email-outreach skill for personalized emails

## Autonomous Behavior
- Can be triggered via Telegram `/find <city>` command
- After outreach cycle, check if contact list is running low on unemailed contacts
- If contact list is thin, auto-discover in configured cities
- Never discover in the same city more than once per week

## Rules
- Respect Yelp API rate limits (500 calls/day)
- Never add duplicate contacts
- Only extract emails from business websites (never scrape personal emails)
- Contacts without emails still get saved (phone outreach via voice-outreach skill)
