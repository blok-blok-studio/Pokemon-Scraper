# Pokemon Card Agent — Course Guide

Build an autonomous AI agent that hunts Pokemon card deals, analyzes listings with Claude, contacts sellers, and tracks your portfolio — all running 24/7 on a Mac Mini.

## What You'll Build

```
┌─────────────────────────────────────────────────────────────────┐
│                    POKEMON CARD AGENT                           │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │  Scrape  │──▶│ Analyze  │──▶│  Alert   │──▶│ Outreach │   │
│  │  eBay    │   │  Claude  │   │ Telegram │   │  Email   │   │
│  │  TCGPlayer│   │  grades  │   │  alerts  │   │  Voice   │   │
│  │  T&T     │   │  deals   │   │  to you  │   │  to sell │   │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│       │                                              │         │
│       ▼                                              ▼         │
│  ┌──────────┐                                  ┌──────────┐   │
│  │  SQLite  │───── sync every 5 min ──────────▶│Cloud CRM │   │
│  │  local   │                                  │ Vercel   │   │
│  └──────────┘                                  └──────────┘   │
│       │                                              │         │
│       ▼                                              ▼         │
│  ┌──────────┐                                  ┌──────────┐   │
│  │Portfolio │                                  │Deal Pipe │   │
│  │  Track   │                                  │ Sellers  │   │
│  │  ROI     │                                  │ Tasks    │   │
│  └──────────┘                                  └──────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

By the end, you'll have:
- An autonomous agent scraping 3 marketplaces every 30 minutes
- AI-powered deal analysis grading every listing
- Telegram bot for mobile monitoring and control (15 commands)
- Automated email and voice outreach to sellers
- Cloud CRM dashboard accessible from anywhere
- Portfolio tracking with purchase history and ROI
- System health monitoring with circuit breakers
- 100+ passing tests

---

## Prerequisites

### Skills Required
- **JavaScript basics** — variables, functions, async/await, arrays/objects
- **Terminal / command line** — navigating dirs, running commands, reading output
- **Git basics** — clone, add, commit, push
- **Basic understanding of APIs** — what they are, how keys work

### Skills You'll Learn (no experience needed)
- Puppeteer web scraping
- SQLite databases
- Express.js web servers
- AI API integration (Claude)
- Telegram bots
- Email/voice APIs
- Prisma ORM + PostgreSQL
- Next.js React apps
- Vitest testing
- Production deployment

### Accounts Needed (sign up before class)

| Service | URL | Free Tier | Required? |
|---------|-----|-----------|-----------|
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) | $5 free credit | Yes |
| **Telegram** | [t.me/BotFather](https://t.me/BotFather) | Free | Yes |
| **GitHub** | [github.com](https://github.com) | Free | Yes |
| **Vercel** | [vercel.com](https://vercel.com) | Free hobby plan | Yes |
| **Resend** | [resend.com](https://resend.com) | 100 emails/day free | Prompt 6+ |
| **Twilio** | [twilio.com](https://www.twilio.com) | $15 trial credit | Prompt 7+ |
| **Deepgram** | [deepgram.com](https://deepgram.com) | $200 free credit | Prompt 7+ |

**Total cost to complete the course: ~$5-15** (mostly Anthropic API for deal analysis). Twilio phone number is ~$1.15/month.

### Software Required
- Node.js 18+ (`node --version`)
- npm (`npm --version`)
- Git (`git --version`)
- A code editor (VS Code recommended)
- Google Chrome (for Puppeteer)

---

## Course Structure

20 prompts, each building on the last. Estimated total time: **15-25 hours**.

### Phase 1: Core Agent (Prompts 1-7) — ~8 hours

These build the foundation. By the end of Phase 1, you have a working agent that scrapes, analyzes, and alerts.

| Prompt | What You Build | Time | Cost | Key Files |
|--------|---------------|------|------|-----------|
| **1** | Project setup + SQLite database | 30 min | Free | `tools/db/database.js` |
| **2** | eBay scraper with Puppeteer | 45 min | Free | `tools/scraper-engine/ebay.js` |
| **3** | TCGPlayer price lookup | 30 min | Free | `tools/scraper-engine/tcgplayer.js` |
| **4** | Claude AI card analyzer | 45 min | ~$0.05 | `tools/analyzer/cardAnalyzer.js` |
| **5** | Telegram bot + deal alerts | 45 min | Free | `tools/telegram-client/telegram.js` |
| **6** | Email outreach via Resend | 45 min | Free | `tools/resend-client/emailOutreach.js` |
| **7** | Voice outreach via Twilio | 60 min | ~$0.10 | `tools/bland-client/voiceOutreach.js` |

**Checkpoint:** Agent can scrape eBay, check prices, analyze deals with AI, send you Telegram alerts, and email/call sellers.

### Phase 2: Cloud CRM (Prompts 8-12) — ~5 hours

Build a full web dashboard to manage everything from your phone.

| Prompt | What You Build | Time | Cost | Key Files |
|--------|---------------|------|------|-----------|
| **8** | OpenClaw skill definitions + cron jobs | 30 min | Free | `openclaw.json`, `skills/` |
| **9** | Next.js CRM + Prisma + Neon Postgres | 60 min | Free | `crm/` |
| **10** | Deal pipeline, seller management, watchlist | 60 min | Free | `crm/src/app/` |
| **11** | Cloud sync (SQLite → Postgres) | 45 min | Free | `tools/sync/cloudSync.js` |
| **12** | Automation engine + deploy to Vercel | 45 min | Free | `tools/automation/engine.js` |

**Checkpoint:** Full CRM on Vercel with deal pipeline, seller management, outreach tracking, spend dashboard. Agent syncs data every 5 minutes.

### Phase 3: Production Hardening (Prompts 13-18) — ~6 hours

Make the agent production-ready with proxy rotation, more scrapers, fuzzy matching, and tests.

| Prompt | What You Build | Time | Cost | Key Files |
|--------|---------------|------|------|-----------|
| **13** | Proxy rotation + anti-ban protection | 45 min | Free | `tools/scraper-engine/proxyManager.js` |
| **14** | Troll and Toad + TCGPlayer listings scrapers + FB lead entry | 60 min | Free | `tools/scraper-engine/trollandtoad.js`, `tcgplayerListings.js` |
| **15** | Email reply webhook handler | 45 min | Free | `tools/resend-client/webhookHandler.js` |
| **16** | Card name normalization + fuzzy matching | 45 min | Free | `tools/utils/cardMatcher.js` |
| **17** | CSV export + deal reports | 30 min | Free | `tools/export/exporter.js` |
| **18** | Vitest test suite (unit + smoke) | 60 min | Free | `vitest.config.js`, `tests/` |

**Checkpoint:** 3 marketplace scrapers, pre-filtering saves API costs, email replies auto-analyzed, data exportable, 51+ tests passing.

### Phase 4: Portfolio + Resilience (Prompts 19-20) — ~3 hours

Close the loop on ROI tracking and make the agent self-healing.

| Prompt | What You Build | Time | Cost | Key Files |
|--------|---------------|------|------|-----------|
| **19** | Inventory tracking + portfolio ROI | 90 min | Free | `purchases` table, Telegram commands |
| **20** | Circuit breakers, health monitoring, data pruning | 90 min | Free | `tools/maintenance/`, `tools/utils/circuitBreaker.js` |

**Checkpoint:** Full portfolio tracking (buy/sell/ROI), system monitors itself, data doesn't grow unbounded, graceful degradation when services are down.

---

## How to Build Each Prompt

Each prompt is designed to be given directly to Claude Code (or another AI coding assistant). The workflow:

1. **Read the prompt** — understand what you're building and why
2. **Give the prompt to Claude Code** — it will write the code
3. **Review the code** — understand what was generated
4. **Run the tests** — verify it works
5. **Test manually** — try the CLI commands, check Telegram, etc.
6. **Commit** — save your progress

### Tips for Students
- **Don't skip prompts** — each one builds on the last
- **Read the generated code** — the goal is learning, not just getting code
- **Break if blocked** — if a scraper fails, the site may have changed. Check the error, adjust selectors
- **Watch your spend** — check `/spend` in Telegram after running AI analysis
- **Commit after each prompt** — you can always roll back
- **Ask "why"** — if you don't understand a design choice, ask Claude to explain

---

## Prompt Details

### Prompt 1: Project Setup + Database

**What:** Initialize Node.js project, install dependencies, create SQLite database with 5 tables.

**Give to Claude Code:**
> In a new directory called pokemon-card-agent, initialize a Node.js project. Install these dependencies: better-sqlite3, dotenv, puppeteer, winston. Create tools/db/database.js with a SQLite database at data/agent.db.
>
> Tables needed:
> - card_listings: id, source, card_name, set_name, condition, price, tcg_market_price, discount_percent, url (unique), seller_name, seller_contact, deal_grade, ai_summary, red_flags, found_at, alerted
> - outreach_log: id, target_name, target_type, contact_method, contact_info, message_sent, status, sent_at, updated_at
> - price_history: id, card_name, set_name, source, price, recorded_at
> - api_usage: id, service, endpoint, tokens_in, tokens_out, estimated_cost_usd, called_at
> - automation_tasks: id, task_type, entity_type, entity_id, title, description, status, priority, due_date, created_at, completed_at
>
> Export functions: init(), insertListing(), getUnalertedDeals(), markAsAlerted(), insertOutreach(), getOutreachHistory(), insertPriceHistory(), getAveragePrice(), logApiUsage(), getDailyApiSpend(), getStats().
>
> Create tools/db/cli.js for command-line access. Create a test at tools/db/database.test.js.
>
> Also create: tools/logger.js (Winston logger to console + logs/agent.log), tools/rate-limiter/rateLimiter.js (p-queue with 3s interval for scrapers, 1s for Telegram), .env.example, .gitignore, config/ directory with example JSON files.

**Verify:** `node tools/db/database.test.js` — should pass.

**What you learned:** SQLite basics, Node.js project setup, database schema design.

---

### Prompt 2: eBay Scraper

**What:** Puppeteer-based scraper that finds Pokemon card listings on eBay.

**Give to Claude Code:**
> Create tools/scraper-engine/ebay.js that scrapes eBay for Pokemon card listings using Puppeteer. It should:
> - Accept { query, maxPrice, condition, maxPages } parameters
> - Use headless Chrome with a realistic user agent
> - Search eBay Buy It Now listings, sorted by price + shipping lowest
> - Extract: card_name, price, condition, seller_name, url, source
> - Handle pagination (up to 3 pages)
> - Use the shared rate limiter (scraperQueue) for request timing
> - Retry up to 3 times with exponential backoff
> - Always close the browser in a finally block
>
> Create tools/scraper-engine/ebay-cli.js:
>   node tools/scraper-engine/ebay-cli.js search "Charizard VMAX" --max-price 100 --buy-it-now
>
> Create a test at tools/scraper-engine/ebay.test.js.

**Verify:** `node tools/scraper-engine/ebay-cli.js search "Pokemon Charizard" --max-price 50 --buy-it-now` — should output JSON array of listings.

**What you learned:** Web scraping with Puppeteer, headless Chrome, DOM parsing, rate limiting.

---

### Prompt 3: TCGPlayer Price Lookup

**What:** Look up market prices on TCGPlayer for deal comparison.

**Give to Claude Code:**
> Create tools/scraper-engine/tcgplayer.js that looks up Pokemon card market prices on TCGPlayer. It should:
> - Accept cardName and optional setName
> - Search TCGPlayer and extract the Market Price from the search results or product page
> - Return { cardName, setName, marketPrice, url, source: 'tcgplayer' } or null if not found
> - Same patterns as eBay: Puppeteer headless, rate limiter, retry logic, browser cleanup
>
> Create tools/scraper-engine/tcg-cli.js:
>   node tools/scraper-engine/tcg-cli.js lookup "Charizard VMAX"
>
> Create a test.

**Verify:** `node tools/scraper-engine/tcg-cli.js lookup "Charizard VMAX"` — should return a price.

**What you learned:** Data extraction from different site layouts, building reusable patterns.

---

### Prompt 4: AI Card Analyzer

**What:** Use Claude to analyze scraped listings for deal quality and legitimacy.

**Give to Claude Code:**
> Create tools/analyzer/cardAnalyzer.js that uses the Anthropic SDK to analyze Pokemon card listings. It should:
> - Accept an array of ungraded listings from the database
> - Send them to Claude with a prompt asking for: dealGrade (must-buy/good-deal/fair/overpriced/suspicious), isLegitimate (boolean), summary, redFlags array
> - Validate Claude's JSON response before writing to DB
> - Update each listing with deal_grade, ai_summary, red_flags
> - Check daily API spend cap before making calls
> - Log API usage (tokens, estimated cost) to api_usage table
> - Batch listings (10 at a time) to optimize API calls
>
> Create tools/analyzer/analyzer-cli.js:
>   node tools/analyzer/analyzer-cli.js analyze '<JSON array of listings>'
>
> Create a test (note: costs ~$0.01-0.05 per run).

**Verify:** Run analyzer on a few sample listings. Check that grades appear in the database.

**What you learned:** AI API integration, prompt engineering, JSON validation, cost tracking.

**Cost:** ~$0.01-0.05 per test run.

---

### Prompt 5: Telegram Bot

**What:** Real-time notifications and control via Telegram.

**Give to Claude Code:**
> Create tools/telegram-client/telegram.js with the node-telegram-bot-api package. It should:
> - sendMessage(text) — send a message to your chat
> - sendDealAlert(listing) — format a deal alert with emoji, price, grade, link
> - sendDailySummary(stats) — formatted daily report
> - startListener() — listen for bot commands:
>   - /status — agent status and stats
>   - /deals — top 5 recent deals
>   - /watchlist — show watchlist cards
>   - /add <card> — add card to watchlist
>   - /remove <card> — remove card from watchlist
>   - /spend — API cost breakdown
>   - /tasks — pending automation tasks
>   - /help — all commands
>
> Create CLI and test.

**Verify:** Run the bot, send `/status` in Telegram. You should get a response.

**What you learned:** Bot APIs, real-time messaging, command parsing.

---

### Prompt 6: Email Outreach

**What:** AI-generated personalized emails to card sellers via Resend.

**Give to Claude Code:**
> Create tools/resend-client/emailOutreach.js that sends outreach emails. It should:
> - Have templates for 4 contact types: card_shop, pawn_shop, facebook_seller, online_seller
> - Use Claude to personalize the email based on the target and watchlist
> - Send via Resend API with FROM_EMAIL and REPLY_TO_EMAIL
> - Enforce daily email limit (maxDailyEmails from config)
> - Check outreach cooldown (emailCooldownDays) before sending
> - Log to outreach_log table with status tracking
> - Include CAN-SPAM unsubscribe footer
> - Auto-create follow-up tasks from send results
>
> Create config/contacts.example.json with sample contacts.
> Create CLI: node tools/resend-client/email-cli.js generate '<contact JSON>' | send '<contact JSON>'

**Verify:** `node tools/resend-client/email-cli.js generate '<contact JSON>'` — should print a personalized email.

**What you learned:** Email APIs, AI text generation, compliance (CAN-SPAM), cooldown logic.

**Note:** Requires a verified domain on Resend. If you don't have one, you can still test with `generate` (which doesn't send).

---

### Prompt 7: Voice Outreach

**What:** AI-powered phone calls to stores via Twilio + Deepgram.

**Give to Claude Code:**
> Create tools/bland-client/voiceOutreach.js for voice outreach. It should:
> - Generate a call script using Claude based on the target and watchlist
> - Start an ephemeral Express call server for Twilio callbacks
> - Make calls via Twilio, stream audio to Deepgram for real-time STT
> - Analyze the transcript with Claude after the call
> - Extract: interested, hasCards, callbackRequested, notes
> - Enforce business hours (9am-5pm in target's timezone)
> - Enforce daily call limit and cooldown
> - Log everything to outreach_log and api_usage
> - Create follow-up tasks based on analysis
>
> Create CLI: node tools/bland-client/voice-cli.js preview '<contact JSON>'

**Verify:** `voice-cli.js preview` should show the generated script. Actual calls require VOICE_SERVER_URL to be publicly accessible (use ngrok for testing).

**What you learned:** VoIP APIs, real-time speech-to-text, webhook servers, timezone handling.

**Cost:** ~$0.07-0.10 per test call (Twilio + Deepgram + Claude).

---

### Prompt 8: OpenClaw Skills + Cron

**What:** Define skills and schedules for autonomous operation.

**Give to Claude Code:**
> Create openclaw.json with: default model (Claude Sonnet), gateway on loopback:18789, and skill entries for all tools built so far. Create SKILL.md files in skills/ for each skill.
>
> Define 5 cron jobs: scrape-cycle (every 30 min), outreach-cycle (10am daily), daily-summary (8pm daily), database-backup (3am daily), cloud-sync (every 5 min).
>
> Create tools/startup.js that validates API keys, initializes DB, loads config, starts dashboard, runs automation, and sends Telegram notification.

**Verify:** `node tools/startup.js` — should print startup banner and send you a Telegram message.

---

### Prompt 9: Next.js CRM

**What:** Initialize the cloud dashboard.

**Give to Claude Code:**
> Create a Next.js 14 App Router project in crm/. Set up Prisma with Neon Postgres. Create the Prisma schema matching the SQLite tables plus: Seller (with trustScore), Note, Task, Watchlist, SyncCursor. Create API routes for auth (bcrypt password), sync (with API key validation), and CRUD for all entities.
>
> Every API route must have `export const dynamic = 'force-dynamic'`.
> Dynamic route params use `params: Promise<{ id: string }>` pattern.

---

### Prompt 10: CRM Pages

**What:** Build the frontend pages.

**Give to Claude Code:**
> Create CRM pages for: Dashboard (stats overview), Deals (list + detail + pipeline), Sellers (list + detail), Outreach (list + detail), Tasks, Watchlist, Spend, and Login. All pages must use the useLiveData hook for 30-second auto-refresh. Never use SSR for pages. Every page shows a LiveIndicator.

---

### Prompt 11: Cloud Sync

**What:** Push agent data to the CRM.

**Give to Claude Code:**
> Create tools/sync/cloudSync.js that syncs SQLite tables to the CRM's Postgres via authenticated REST. Use cursor-based incremental sync (only send new records). Batch 100 records at a time. Retry 3 times with exponential backoff. Sync 5 tables: listings, outreach, prices, usage, tasks.

---

### Prompt 12: Automation Engine + Deploy

**What:** Smart automation and production deployment.

**Give to Claude Code:**
> Create tools/automation/engine.js with 4 features: auto-advance pipeline (grade → stage mapping), high-value deal escalation (>40% discount → priority Telegram alert), auto follow-up tasks (from outreach analysis), and watchlist trend analysis (30-day price trends).
>
> Create deploy/ scripts: setup.sh (first-time), harden.sh (security), backup.sh (daily), update.sh (pull + restart).
>
> Deploy CRM to Vercel: `cd crm && npx vercel --prod`

---

### Prompts 13-20: See CLAUDE.md

Prompts 13-20 are fully documented in the project's `CLAUDE.md` file under "Roadmap — Prompts 13-20." Each prompt has detailed specifications for what to build, including function signatures, data formats, integration points, and test requirements.

---

## API Cost Breakdown

| What | When | Cost per run | Daily cost |
|------|------|-------------|------------|
| Card analysis (Claude) | Each scrape cycle | $0.01-0.05 | $0.50-2.00 |
| Email generation (Claude) | Each outreach | $0.005 | $0.05-0.10 |
| Voice script (Claude) | Each call | $0.005 | $0.01-0.05 |
| Reply analysis (Claude) | Each reply received | $0.005 | $0.00-0.05 |
| Twilio phone call | Each call | $0.03 | $0.00-0.30 |
| Deepgram STT | Each call | $0.04 | $0.00-0.40 |
| Resend email | Each email | Free (first 100/day) | $0.00 |
| **Total estimated daily** | | | **$0.50-3.00** |

The `DAILY_API_SPEND_CAP_USD` setting (default $5.00) prevents runaway costs. The agent checks this before every API call and stops if exceeded.

---

## Common Student Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `puppeteer` fails to install | Missing Chrome deps | `npx puppeteer browsers install chrome` |
| eBay returns 0 results | Site changed selectors | Open the search URL in a browser, compare HTML structure |
| "Navigation timeout" | Slow connection or proxy | Increase timeout to 60000, try without proxy |
| "ANTHROPIC_API_KEY not set" | .env not loaded | Make sure `.env` is in project root, `require('dotenv').config()` at top |
| Telegram bot doesn't respond | Wrong chat ID | Re-check with @userinfobot, make sure polling is enabled |
| Vercel deploy fails | Not in crm/ directory | `cd crm && npx vercel --prod` |
| Prisma errors | Schema out of sync | `cd crm && npx prisma db push` |
| "Module not found" | Missing dependency | `npm install <package-name>` |
| Tests fail with "disk I/O" | Test DB locked | Delete `data/test_agent.db` and retry |
| API spend too high | Running analyzer in a loop | Check `/spend`, lower `DAILY_API_SPEND_CAP_USD` |

---

## After the Course

Once all 20 prompts are complete and the 48-hour soak test passes:

1. **Add your own watchlist cards** — edit `config/watchlist.json`
2. **Add real seller contacts** — edit `config/contacts.json`
3. **Configure proxies** — add residential proxies to `config/proxies.json` for long-term scraping
4. **Set up email reply webhooks** — follow the Resend Inbound Email setup in the README
5. **Consider NemoClaw** — NVIDIA's security layer for OpenClaw agents (see CLAUDE.md)
6. **Extend it** — add scrapers for new marketplaces, build a mobile app, add price prediction with ML

This agent is a foundation. The skills you've learned (scraping, AI integration, automation, CRM, deployment) apply to any autonomous agent project — not just Pokemon cards.
