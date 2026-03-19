# Pokemon Card Agent — OpenClaw Project

## Architecture

- **Agent** (local): Node.js tools orchestrated by OpenClaw. SQLite database at `data/agent.db`.
- **CRM** (cloud): Next.js 14 App Router on Vercel. Neon Postgres via Prisma.
- **Sync**: Every 5 minutes, `tools/sync/cloudSync.js` pushes new SQLite records → CRM Postgres via authenticated REST.

## CRM Conventions

### All pages MUST use live data
Every CRM page is a `'use client'` component that uses the `useLiveData` hook for 30-second auto-refresh. **Never use SSR (`async function Page()` with direct Prisma calls) for pages.**

Pattern:
```tsx
'use client'
import { useLiveData, LiveIndicator } from '@/hooks/use-live-data'

export default function MyPage() {
  const { data, loading, error, lastUpdated, refresh } = useLiveData<MyType>('/api/my-endpoint')
  // render with data, show <LiveIndicator lastUpdated={lastUpdated} />
}
```

- Every page shows `<LiveIndicator />` in its header
- Every page that mutates data calls `refresh()` after the mutation — **never use `router.refresh()`**
- Components that mutate data should accept an `onUpdate` callback prop wired to `refresh()`
- Data flows: Agent → SQLite → cloudSync → CRM API → Postgres → useLiveData polls → UI updates
- Reusable components (e.g. NotesSection) must also use `useLiveData`, not manual `useEffect` fetching

### API routes
- **ALL** API routes MUST have `export const dynamic = 'force-dynamic'` — no exceptions
- Sync endpoints validate auth via `validateSyncKey()` from `@/lib/sync-auth`
- Rate limiting via `@/lib/rate-limit` for public-facing endpoints
- Dynamic route params use `params: Promise<{ id: string }>` with `const { id } = await params` (Next.js 14+)
- PATCH/DELETE handlers receiving `id` from request body must `parseInt()` — Prisma expects integers, clients may send strings
- POST handlers must validate all IDs (e.g. `entityId`) as integers before passing to Prisma

### New features checklist
When adding a new entity/feature:
1. Add SQLite table in `tools/db/database.js`
2. Add sync entry in `tools/sync/cloudSync.js` TABLES array
3. Add Prisma model in `crm/prisma/schema.prisma`
4. Add sync API route at `crm/src/app/api/sync/{name}/route.ts` (with `force-dynamic`)
5. Add CRUD API route at `crm/src/app/api/{name}/route.ts` (with `force-dynamic`)
6. Add client page using `useLiveData` hook (never SSR)
7. Run `prisma db push` to update Neon schema
8. For [id] routes: use `params: Promise<{ id: string }>` pattern

## Agent Tools

| Tool | Purpose |
|------|---------|
| `tools/scraper-engine/` | Pokemon card scrapers (eBay, TCGPlayer) |
| `tools/analyzer/cardAnalyzer.js` | Claude-powered deal analysis + grading |
| `tools/resend-client/emailOutreach.js` | Email outreach via Resend (stores subject + body separately) |
| `tools/bland-client/voiceOutreach.js` | Voice outreach via Twilio + Deepgram (stores script + transcript + AI analysis) |
| `tools/automation/engine.js` | Auto pipeline advance, escalations, follow-ups, watchlist trends |
| `tools/sync/cloudSync.js` | SQLite → CRM Postgres sync (5 tables: listings, outreach, prices, usage, tasks) |
| `tools/telegram-client/telegram.js` | Telegram bot for mobile monitoring |
| `tools/logger.js` | Winston logger to console + `logs/agent.log` |
| `tools/rate-limiter/rateLimiter.js` | Shared rate limiter for scraper requests |
| `tools/backup-db.js` | Database backup to `data/backups/` |
| `tools/dashboard/server.js` | Local Bootstrap dashboard on port 3847 |
| `tools/startup.js` | Agent boot sequence (validate → init DB → config → dashboard → automation) |

### Automation Engine (`tools/automation/engine.js`)

Runs on startup and via cron. Four features:

**1. Auto-advance Pipeline** — maps AI grades to deal stages:
- `must-buy` / `good-deal` → `reviewing`
- `suspicious` / `overpriced` → `passed`
- `fair` → stays at `new`

**2. High-value Deal Escalation** — deals with >40% discount get priority Telegram alerts with `🚨🔥 PRIORITY DEAL ALERT` formatting

**3. Auto Follow-up Tasks** — creates tasks from outreach analysis:
- Callback requested → due in 1 day (high priority)
- Interested → due in 2 days (high priority)
- Has cards but undecided → due in 7 days (normal)
- Generic follow-up needed → due in 3 days (normal)

**4. Watchlist Trend Analysis** — 30-day rolling price trends:
- Avg >30% above maxPrice → suggest removing card
- Price dropped >15% (3+ data points) → suggest watching closer (buying opportunity)
- Price up >20% (3+ data points) → suggest buying now (may keep rising)

### Startup Sequence (`tools/startup.js`)
1. Validate all 12 required API keys (exits with helpful URLs if any missing)
2. Initialize SQLite database
3. Copy `config/*.example.json` → `config/*.json` if missing
4. Load `config.json` and `watchlist.json`
5. Print startup banner with watchlist count, scrape interval, spend cap
6. Start local dashboard on `AGENT_PORT` (default 3847)
7. Send Telegram startup notification
8. Run automation engine (`runAll`: escalations, watchlist trends, due task alerts)
9. Close database and exit (OpenClaw manages the ongoing lifecycle)

### Logging Convention
```javascript
const { createChildLogger } = require('./logger');
const log = createChildLogger('my-module');
log.info('message');
log.warn('warning');
log.error('error details');
```
- Format: `TIMESTAMP LEVEL [module] message`
- Outputs to console AND `logs/agent.log`
- Always use `createChildLogger` with a module name for traceable logs

## Environment Variables

### Agent (.env) — All Required
- `ANTHROPIC_API_KEY` — Claude API key
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — Telegram notifications
- `RESEND_API_KEY` — Email sending
- `FROM_EMAIL` / `REPLY_TO_EMAIL` — Email sender addresses
- `DEEPGRAM_API_KEY` — Speech-to-text for voice calls
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — Voice calls
- `CRM_SYNC_URL` — Vercel CRM URL (e.g. https://crm-kohl-phi.vercel.app)
- `CRM_SYNC_API_KEY` — Must match CRM's `SYNC_API_KEY`

### Agent (.env) — Optional
- `AGENT_NAME` — Name used in voice calls (default: "a Pokemon card collector")
- `AGENT_PORT` — Local dashboard port (default: 3847)
- `VOICE_SERVER_URL` — Public URL for Twilio callbacks (default: localhost — won't work in prod)
- `DAILY_API_SPEND_CAP_USD` — Daily API spend limit (default: 5.00)
- `TEST_EMAIL` — Your email for testing outreach
- `TEST_PHONE` — Your phone for testing voice calls

### CRM (crm/.env.local + Vercel)
- `SYNC_API_KEY` — Must match agent's `CRM_SYNC_API_KEY`
- `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING` — Neon connection strings

## Configuration Files (`config/`)

All runtime configs are gitignored. Example files are committed. On first startup, examples are auto-copied.

### `config/config.json`
```json
{
  "broadSearchTerms": ["Pokemon rare card lot under $50", ...],
  "minDiscountPercent": 15,
  "maxPriceUSD": 500,
  "scrapingIntervalMinutes": 30,
  "outreachTimeHour": 10,
  "dailySummaryHour": 20,
  "maxDailyEmails": 20,
  "maxDailyVoiceCalls": 10,
  "emailCooldownDays": 30,
  "voiceCooldownDays": 14
}
```

### `config/watchlist.json`
```json
[
  { "name": "Charizard VMAX", "set": "Darkness Ablaze", "maxPrice": 150 },
  { "name": "Pikachu VMAX", "set": "Vivid Voltage", "maxPrice": 80 }
]
```

### `config/contacts.json`
```json
[
  { "name": "Store Name", "email": "x@y.com", "type": "card_shop|pawn_shop|facebook_seller|online_seller", "phone": "+15551234567", "timezone": "America/Denver" }
]
```

## CRM API Routes

### Sync Routes (agent → CRM, auth via `validateSyncKey()`)
| Route | Purpose |
|-------|---------|
| `/api/sync/listings` | Sync `card_listings` |
| `/api/sync/outreach` | Sync `outreach_log` |
| `/api/sync/prices` | Sync `price_history` |
| `/api/sync/usage` | Sync `api_usage` |
| `/api/sync/tasks` | Sync `automation_tasks` |
| `/api/sync/status` | Sync status check |

### CRUD Routes (CRM frontend, session auth)
| Route | Purpose |
|-------|---------|
| `/api/auth` | Login/session |
| `/api/deals` + `/api/deals/[id]` | Deal pipeline CRUD |
| `/api/deals/[id]/prices` | Price history for a deal |
| `/api/sellers` + `/api/sellers/[id]` | Seller management |
| `/api/outreach` + `/api/outreach/[id]` | Outreach log |
| `/api/watchlist` + `/api/watchlist/[id]` | Watchlist CRUD |
| `/api/tasks` + `/api/tasks/[id]` | Automation tasks |
| `/api/notes` | Notes (CRM-only, no sync back) |
| `/api/spend` | API spend tracking |
| `/api/search` | Global search |
| `/api/dashboard` | Dashboard aggregate data |
| `/api/agent-status` | Agent health/status |
| `/api/automation-tasks` | Automation task management |

### CRM Middleware (`crm/src/middleware.ts`)
- **Auth routes**: 5 req/min per IP (strict)
- **Sync routes**: 30 req/min per IP
- **General API**: 60 req/min per IP
- Session cookie: `crm_session=authenticated` required for all non-sync, non-auth routes
- Unauthenticated requests redirect to `/login`
- In-memory rate limit store, cleaned every 5 minutes

## Gotchas Found in Past Sessions
- `.ts` files containing JSX must be renamed to `.tsx` (e.g. `use-live-data.tsx`)
- SQLite has no `ALTER TABLE ... IF NOT EXISTS` — use try/catch wrapper: `try { db.exec('ALTER TABLE ...') } catch {}`
- Vercel deploy must run from `crm/` dir, not project root
- `crm/.env.local` SYNC_API_KEY must also be set in Vercel env (all environments) via `npx vercel env add`
- Optimistic UI updates (e.g. pipeline drag) must revert state on PATCH failure

## Agent Tool Error Handling Rules
- All outreach functions (`sendEmail`, `makeCall`) must wrap entire body in try-catch and log failed attempts to DB
- `cardAnalyzer.js`: always validate Claude JSON response is an array with required fields (`url`, `dealGrade`) before DB writes
- `telegram.js` `sendMessage()`: must catch errors — callers don't expect throws
- `cloudSync.js`: log warning if CRM `synced` count doesn't match sent batch size

## Known Limitations
- Facebook Marketplace scraper is referenced but not yet built (Prompt 14C adds manual lead entry via Telegram as workaround)
- Notes are CRM-only; they don't sync back to the agent
- Voice calls require `VOICE_SERVER_URL` to be a public URL (ngrok or deployed server)
- No proxy rotation yet — scrapers will get IP-blocked under heavy use (Prompt 13 addresses this)
- No fuzzy matching pre-filter — all listings go to Claude for analysis, costing more API spend (Prompt 16 addresses this)
- No CSV export or reporting — deal/outreach data only viewable in CRM or raw DB (Prompt 17 addresses this)
- No formal test framework — existing `.test.js` files are standalone scripts, not vitest (Prompt 18 addresses this)
- No inventory/purchase tracking — pipeline ends at "purchased" stage but no actual cost/ROI recorded (Prompt 19 addresses this)
- No seller reputation scoring — CRM has `trustScore` field but no calculation logic (Prompt 19G addresses this)
- No data pruning — SQLite and logs grow unbounded, will fill Mac Mini disk over time (Prompt 20A addresses this)
- No log rotation — `logs/agent.log` grows forever (Prompt 20B addresses this)
- No health monitoring — no disk/memory/uptime checks, agent can silently fail (Prompt 20C addresses this)
- No circuit breakers — if eBay/Anthropic is down, agent retries until timeout (Prompt 20D addresses this)
- Dashboard `/api/status` returns hardcoded data, not real uptime/scrape times (Prompt 20C fixes this)

## Roadmap — Prompts 13-20 (Not Yet Built)

These prompts fill gaps in the current agent. Build in order after prompts 1-12 are stable.

| Prompt | Feature | Key Files to Create | Dependencies |
|--------|---------|---------------------|--------------|
| **13** | Proxy rotation & anti-ban | `tools/scraper-engine/proxyManager.js`, `config/proxies.json` | None |
| **14** | Additional scrapers (Troll and Toad, TCGPlayer listings, FB lead entry) | `tools/scraper-engine/trollandtoad.js`, `tcgplayerListings.js` + CLIs | Prompt 13 (proxy support) |
| **15** | Email reply webhook handler | `tools/resend-client/webhookHandler.js`, `skills/reply-handler/SKILL.md` | Dashboard server running |
| **16** | Card name normalization & fuzzy matching | `tools/utils/cardMatcher.js` | None (but integrate into scrapers) |
| **17** | Data export & reporting (CSV) | `tools/export/exporter.js`, `tools/export/export-cli.js`, `skills/data-export/SKILL.md` | `csv-stringify` package |
| **18** | Vitest test suite (unit/integration/smoke) | `vitest.config.js`, `tests/` directory, `TESTING.md` | `vitest` dev dependency |
| **19** | Inventory tracking & ROI | `purchases` table, `purchase-cli.js`, CRM portfolio page | Prompt 18 (tests for new code) |
| **20** | System resilience & data lifecycle | `tools/maintenance/`, `tools/utils/circuitBreaker.js` | `winston-daily-rotate-file` package |

### Prompt 13: Proxy Manager Pattern
- `config/proxies.json` — array of `{ url, type, label }` proxy entries
- `proxyManager.getProxy()` → returns least-used available proxy or `null`
- `proxyManager.reportBlocked(url)` → cooldown 30min, dead after 5 consecutive blocks
- `proxyManager.reportSuccess(url)` → resets consecutive block counter
- Integrate into all scrapers: `ebay.js`, `tcgplayer.js`, new scrapers
- Block detection: check for CAPTCHA, 403/429/503, "Access Denied" text
- Telegram `/proxies` command for status

### Prompt 14: New Scrapers
- **Troll and Toad** (`trollandtoad.js`): search `trollandtoad.com`, 3 pages max, rate limited
- **TCGPlayer Listings** (`tcgplayerListings.js`): actual for-sale listings (separate from price lookup), extracts seller + listing price + market price
- **Facebook Marketplace**: NO scraper — manual `/lead <url> <price> <card name>` via Telegram instead
- All new scrapers follow same pattern: puppeteer headless, proxy support, block detection, retry with backoff, winston logging, proper browser cleanup in `finally`

### Prompt 15: Email Reply Webhook
- Mount at `/webhook/email-reply` on dashboard server
- Handles: `email.delivered`, `email.bounced`, `email.complained`, inbound replies
- Spam complaints → add to `config/email-blocklist.json` + Telegram alert
- Replies → AI analysis (sentiment, has cards, interested, wants follow-up) + Telegram alert
- `emailOutreach.js` must check blocklist before sending

### Prompt 16: Card Matcher (Pre-filter)
- `normalizeCardName(title)` — lowercase, strip set numbers, remove filler words
- `matchesWatchlist(title, watchlist)` — 3 methods: exact substring, all-words containment, Levenshtein distance; threshold 70%
- `isAccessoryOrFake(title)` — flag sleeves, sealed product, lots, non-cards, code cards, fakes
- `classifyListing(title, watchlist)` — combined pre-filter, runs BEFORE Claude analysis to save API costs
- Integrate into all scrapers: skip accessories, tag non-matches, only send candidates to analyzer

### Prompt 17: Data Export
- `exportDealsCSV(options)`, `exportOutreachCSV(options)`, `exportPriceHistoryCSV(card, days)`
- `generateDealReport(days)` — text summary with top deals, source stats, spend, suggested actions
- CLI: `node tools/export/export-cli.js deals|outreach|prices|report`
- Telegram: `/export deals [days]`, `/export outreach [days]`, `/report [days]`
- Export dir: `data/exports/` (gitignored), auto-cleanup >30 days

### Prompt 18: Test Suite
- Framework: **vitest** (not jest)
- Structure: `tests/unit/` (free, no network), `tests/integration/` (real APIs, costs money), `tests/smoke/` (full cycle with mocks)
- Helpers: `tests/helpers/testDb.js` (temp DB at `data/test_agent.db`), `tests/helpers/mockData.js` (10 sample listings, watchlist, contacts, outreach, api_usage)
- Test port: 3848 (avoid collision with dev on 3847)
- Integration tests cost ~$0.05-0.50 per run — run selectively

### Prompt 19: Inventory Tracking & ROI (Not Yet Built)

The pipeline currently ends at `pipeline_stage = 'purchased'` but there's no record of actual purchases, costs, or portfolio value. This prompt closes the loop from "found a deal" to "made a profit."

**Part A: SQLite `purchases` table** in `tools/db/database.js`:
```sql
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER REFERENCES card_listings(id),
  card_name TEXT NOT NULL,
  set_name TEXT,
  purchase_price REAL NOT NULL,
  purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  purchase_source TEXT,
  seller_name TEXT,
  condition TEXT,
  current_market_price REAL,
  market_price_updated_at DATETIME,
  status TEXT DEFAULT 'in_collection',
  sold_price REAL,
  sold_date DATETIME,
  sold_to TEXT,
  shipping_cost REAL DEFAULT 0,
  fees REAL DEFAULT 0,
  notes TEXT
);
```
- `status` values: `in_collection`, `listed_for_sale`, `sold`, `traded`, `gifted`
- `listing_id` links back to the original scraped listing (nullable — manual purchases won't have one)

**Part B: Database functions**:
- `insertPurchase(db, data)` — record a purchase, auto-set `pipeline_stage = 'purchased'` on linked listing
- `updatePurchaseMarketPrice(db, id, marketPrice)` — update current value
- `sellPurchase(db, id, { soldPrice, soldTo, shippingCost, fees })` — mark as sold, calculate profit
- `getPortfolioSummary(db)` — returns: total invested, current market value, total profit, ROI %, best/worst performers
- `getPortfolioByCard(db)` — group purchases by card name with avg cost, count, total value
- `getProfitHistory(db, days)` — daily profit/loss over time for charting
- `getUnsoldInventory(db)` — everything with status `in_collection` or `listed_for_sale`

**Part C: CLI** — `tools/db/purchase-cli.js`:
```bash
node tools/db/purchase-cli.js buy --listing-id 42 --price 65.00
node tools/db/purchase-cli.js buy --card "Charizard VMAX" --price 65.00 --source ebay --seller "CardKing99"
node tools/db/purchase-cli.js sell --id 1 --price 110.00 --sold-to "Local shop" --shipping 5.50 --fees 3.30
node tools/db/purchase-cli.js portfolio
node tools/db/purchase-cli.js inventory
```

**Part D: Auto-price update** — add to automation engine:
- On each scrape cycle, update `current_market_price` for all `in_collection` purchases using latest TCGPlayer data
- If market price drops >20% below purchase price, send Telegram alert: "📉 Charizard VMAX dropped to $X (you paid $Y) — consider selling"
- If market price rises >50% above purchase price, send alert: "📈 Charizard VMAX now at $X (you paid $Y) — nice gain!"

**Part E: Telegram commands**:
- `/buy <listing-id> <price>` — quick-record a purchase from a deal alert
- `/sell <purchase-id> <price>` — record a sale
- `/portfolio` — summary: total invested, current value, ROI, top 3 gainers/losers
- `/inventory` — list of unsold cards with current values

**Part F: CRM integration**:
1. Add `Purchase` Prisma model in `crm/prisma/schema.prisma`
2. Add sync in `cloudSync.js` TABLES array
3. Add `/api/sync/purchases` route
4. Add `/api/purchases` CRUD route
5. Add purchases page with portfolio dashboard (chart: investment vs market value over time)
6. Add "Mark as Purchased" button on deal detail page → creates purchase record
7. Add "Mark as Sold" flow on inventory page

**Part G: Seller reputation integration**:
- When recording a purchase, increment the seller's `successful_deals` count
- When a purchase turns out to be misgraded/fake, decrement seller trust
- Calculate seller `trustScore` = (successful_deals / total_deals) * 100, weighted by recency
- Store reasoning in `trustReasoning` (Prisma Seller model already has both fields)

Git commit: "Add inventory tracking, portfolio ROI, and seller reputation scoring"

### Prompt 20: System Resilience & Data Lifecycle (Not Yet Built)

The agent runs 24/7 on a Mac Mini. Without these safeguards, it will silently fail, fill the disk, or waste resources retrying dead services.

**Part A: Data Pruning** — `tools/maintenance/dataPruner.js`:

Retention policies (configurable in `config.json`):
- `card_listings`: delete if >90 days old AND `pipeline_stage` NOT IN ('purchased', 'reviewing', 'approved')
- `price_history`: after 180 days, aggregate into weekly averages (keep raw data for 180 days, summaries forever)
- `api_usage`: delete individual records >90 days, keep monthly summaries
- `outreach_log`: keep all (business records), but compress `message_sent` to first 200 chars after 60 days
- `automation_tasks`: delete completed tasks >30 days old
- `data/exports/`: delete CSV files >30 days old
- `data/backups/`: already handled (keeps last 7)

Functions:
- `pruneOldListings(db, days)` — returns count deleted
- `aggregatePriceHistory(db, days)` — compress old prices into weekly averages
- `pruneApiUsage(db, days)` — delete old records, insert monthly summary rows
- `pruneCompletedTasks(db, days)` — delete old completed tasks
- `cleanupExports(dir, days)` — delete old CSV files
- `runAll(db)` — runs all pruning, returns summary

Add to OpenClaw cron — run weekly at Sunday 4am:
```json
"data-pruning": {
  "schedule": "0 4 * * 0",
  "task": "Run data pruning: node tools/maintenance/dataPruner.js"
}
```

Add config.json fields:
```json
{
  "retentionDays": {
    "listings": 90,
    "priceHistoryRaw": 180,
    "apiUsage": 90,
    "completedTasks": 30,
    "exports": 30
  }
}
```

**Part B: Log Rotation** — `tools/maintenance/logRotator.js`:
- Rotate `logs/agent.log` when it exceeds 50MB
- Keep last 5 rotated files: `agent.log.1`, `agent.log.2`, etc.
- Compress old logs with gzip: `agent.log.2.gz`
- Run daily at 4:30am (after pruning)
- OR: switch Winston to `winston-daily-rotate-file` transport (simpler):
  ```
  npm install winston-daily-rotate-file
  ```
  Configure: daily rotation, keep 14 days, compress archives, max 500MB total

**Part C: Health Monitor** — `tools/maintenance/healthCheck.js`:

Checks to run (on startup + every 30 min):
1. **Disk space**: `df -h` on data directory. Alert if <1GB free. Halt scraping if <500MB.
2. **Memory usage**: `process.memoryUsage()`. Alert if RSS >512MB. Force GC if >768MB.
3. **Database size**: `stat data/agent.db`. Alert if >500MB (suggests pruning isn't running).
4. **Log file size**: `stat logs/agent.log`. Alert if >100MB (suggests rotation isn't running).
5. **Stale data**: Check `card_listings` — if no new listings in >2 hours during business hours, alert "Scrapers may be blocked."
6. **Process uptime**: Track `process.uptime()`. Report in `/status`.
7. **Last successful scrape**: Track timestamp, expose in dashboard status.
8. **API connectivity**: Quick HEAD request to `api.anthropic.com` — if fails, log warning but don't alert (transient).

Export `getHealthReport()` returning:
```json
{
  "diskFreeGB": 45.2,
  "memoryUsageMB": 128,
  "databaseSizeMB": 12.3,
  "logFileSizeMB": 5.1,
  "uptimeHours": 72.5,
  "lastScrapeAt": "2026-03-19T14:30:00Z",
  "lastSyncAt": "2026-03-19T14:35:00Z",
  "status": "healthy",
  "warnings": []
}
```

Integrate into:
- Dashboard `/api/status` — replace hardcoded data with real health report
- Telegram `/status` — include disk, memory, uptime
- CRM `/api/agent-status` — full health report for cloud dashboard

**Part D: Circuit Breaker** — `tools/utils/circuitBreaker.js`:

Pattern for all external service calls:
```javascript
const breaker = new CircuitBreaker({
  name: 'ebay-scraper',
  failureThreshold: 3,      // 3 consecutive failures → open
  resetTimeout: 300000,      // 5 min before trying again
  halfOpenMaxAttempts: 1     // 1 test request in half-open state
});

// Usage:
const result = await breaker.execute(() => scrapePage(url));
```

States:
- **CLOSED** (normal): requests flow through. Failures increment counter.
- **OPEN** (tripped): all requests immediately fail without executing. After `resetTimeout`, transitions to HALF_OPEN.
- **HALF_OPEN** (testing): allows 1 request through. If succeeds → CLOSED. If fails → OPEN again.

Apply circuit breakers to:
- eBay scraper (and all future scrapers)
- TCGPlayer price lookup
- Anthropic API (card analyzer)
- Resend API (email sending)
- Twilio API (voice calls)
- Telegram API (notifications — degrade gracefully, log locally if Telegram is down)
- Cloud sync (CRM may be down)

Export `getCircuitStatus()` for monitoring:
```json
{
  "ebay-scraper": { "state": "CLOSED", "failures": 0, "lastFailure": null },
  "anthropic": { "state": "HALF_OPEN", "failures": 3, "lastFailure": "2026-03-19T14:00:00Z" },
  "telegram": { "state": "CLOSED", "failures": 0, "lastFailure": null }
}
```

Telegram command: `/health` — returns health report + circuit breaker status

**Part E: Graceful Degradation Priority**:

When services are down, agent should degrade gracefully in this priority order:
1. **Telegram down**: Log locally, queue messages, retry when back. Don't lose alerts.
2. **Anthropic down**: Skip analysis, still scrape and store raw listings. Mark as `deal_grade = 'pending_analysis'` for later.
3. **Scrapers blocked**: Reduce to working scrapers. If all blocked, wait for proxy cooldown. Log but don't alert repeatedly.
4. **CRM sync down**: Queue locally, sync will catch up via cursors when back online (already works this way).
5. **Resend/Twilio down**: Skip outreach cycle, try again next day. Don't lose contact cooldown tracking.
6. **Disk full**: Halt all scraping immediately. Send emergency alert (Telegram if available, log if not). Run emergency pruning.

**Part F: Watchdog** — add to startup.js:
- If any cron cycle takes >10 minutes, kill the subprocess and log error
- If main process memory exceeds 1GB, force restart via `process.exit(1)` (systemd/OpenClaw will restart)
- Heartbeat file: write timestamp to `data/.heartbeat` every 5 minutes. External monitor can check staleness.

Git commit: "Add data pruning, log rotation, health monitoring, circuit breakers, and graceful degradation"

## Agent Tool Conventions

### CLI Pattern (all tools follow this)
Every tool has a companion `-cli.js` file for direct invocation:
```bash
node tools/scraper-engine/ebay-cli.js search "<query>" --max-price <N> --buy-it-now
node tools/scraper-engine/tcg-cli.js lookup "<card name>"
node tools/analyzer/analyzer-cli.js analyze '<JSON array>'
node tools/db/cli.js insert-listing '<JSON>' | get-stats
node tools/telegram-client/telegram-cli.js send-message "<text>" | send-deal '<JSON>'
node tools/resend-client/email-cli.js generate '<JSON>' | send '<JSON>'
node tools/bland-client/voice-cli.js preview '<JSON>'
node tools/dashboard/dashboard-cli.js start
```

### Scraper Pattern (all scrapers follow this)
1. Puppeteer in headless `'new'` mode
2. Rate limited (1 request per 3 seconds via shared rate limiter)
3. Proxy support via `proxyManager.getProxy()` (when built)
4. Block detection + retry with exponential backoff (up to 3 attempts)
5. Browser cleanup in `finally` block — never leave zombie Chrome processes
6. Winston logging via shared `tools/logger.js`
7. Return JSON array of `{ card_name, price, url, source, seller_name, condition }`

### Telegram Commands (current)
| Command | Description |
|---------|-------------|
| `/status` | Agent status + uptime |
| `/deals` | Recent unalerted deals |
| `/watchlist` | Current watchlist cards |
| `/spend` | Today's API spend |
| `/help` | All available commands |

### Telegram Commands (planned, Prompts 13-20)
| Command | Description | Prompt |
|---------|-------------|--------|
| `/proxies` | Proxy pool status | 13 |
| `/lead <url> <price> <name>` | Manual FB Marketplace lead entry | 14 |
| `/export deals [days]` | Send deals CSV via Telegram | 17 |
| `/export outreach [days]` | Send outreach CSV via Telegram | 17 |
| `/report [days]` | Deal summary report | 17 |
| `/buy <listing-id> <price>` | Quick-record a purchase from a deal alert | 19 |
| `/sell <purchase-id> <price>` | Record a sale | 19 |
| `/portfolio` | Portfolio summary: invested, value, ROI, gainers/losers | 19 |
| `/inventory` | List unsold cards with current values | 19 |
| `/health` | Health report + circuit breaker status | 20 |

## OpenClaw Cron Schedule
- **Every 30 min**: Scrape cycle (eBay + TCGPlayer, analyze, alert) + health check + portfolio price update
- **10:00 AM daily**: Outreach cycle (email/voice to contacts)
- **8:00 PM daily**: Daily summary via Telegram (includes portfolio snapshot)
- **3:00 AM daily**: Database backup
- **4:00 AM Sunday**: Data pruning (old listings, price aggregation, task cleanup)
- **4:30 AM daily**: Log rotation
- **Every 5 min**: Cloud sync (SQLite → CRM Postgres)

## Testing (Current State)

Current tests are standalone scripts in each tool directory (e.g., `tools/db/database.test.js`). Run individually:
```bash
npm run test:db        # Database operations
npm run test:tcg       # TCGPlayer price lookup (needs network)
npm run test:ebay      # eBay scraper (needs network)
npm run test:analyzer  # Card analyzer (costs ~$0.01-0.05)
npm run test:telegram  # Telegram send (needs bot token)
npm run test:email     # Email outreach (needs Resend key)
npm run test:voice     # Voice outreach (needs Twilio)
npm run test:dashboard # Dashboard API
```

After Prompt 18, these move to vitest under `tests/` with proper structure.

## Manual Testing Checklist (Pre-Deployment)

### Phase 1: Unit (free, no API keys)
- [ ] All individual test scripts pass
- [ ] Database dedup works (insert same URL twice, count stays 1)

### Phase 2: Individual Tools (needs network + API keys)
- [ ] TCG lookup returns price JSON
- [ ] eBay search returns listings array
- [ ] DB insert + get-stats work
- [ ] Telegram message arrives
- [ ] Email generates and sends
- [ ] Analyzer returns grades
- [ ] Dashboard loads at localhost:3847

### Phase 3: End-to-End
- [ ] `node tools/startup.js` runs without errors
- [ ] Telegram `/status`, `/deals`, `/watchlist`, `/spend` all respond
- [ ] Dashboard shows data across all tabs
- [ ] Cloud sync pushes to CRM

### Phase 4: Inventory & Resilience (after Prompts 19-20)
- [ ] `/buy` records purchase, links to listing, updates pipeline stage
- [ ] `/sell` calculates profit correctly (soldPrice - purchasePrice - shipping - fees)
- [ ] `/portfolio` shows correct totals
- [ ] Market prices auto-update on scrape cycle
- [ ] Health check reports real disk/memory/uptime
- [ ] Circuit breakers trip after 3 failures, reset after 5 min
- [ ] Data pruning removes old listings (>90 days), keeps purchased
- [ ] Log rotation kicks in at 50MB, keeps 14 days
- [ ] Agent survives Anthropic API being unreachable for 1 hour

### Phase 5: 48-Hour Soak Test (on Mac Mini — final validation)
- [ ] Scrapes every 30 min (check `logs/agent.log`)
- [ ] Daily summary at 8pm (check Telegram)
- [ ] Outreach at 10am (check Telegram + outreach tab)
- [ ] API spend tracking correct (`/spend`)
- [ ] 3am backup creates file (`ls data/backups/`)
- [ ] Sunday 4am pruning runs (`grep "pruning" logs/agent.log`)
- [ ] No errors in logs (`grep ERROR logs/agent.log`)
- [ ] Memory usage stable — not growing (`/health`)
- [ ] Disk usage stable — not growing (`/health`)
- [ ] Dashboard still loads with fresh data
- [ ] All circuit breakers in CLOSED state (`/health`)
- [ ] Portfolio prices updated at least once (`/portfolio`)

## Build & Deploy

```bash
# CRM local dev
cd crm && npm run dev

# CRM build check
cd crm && npx next build

# Deploy to Vercel
cd crm && npx vercel --prod

# Push schema changes
cd crm && npx prisma db push

# Run agent locally
node tools/startup.js
```

### Deploy Scripts (`deploy/`)

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `setup.sh` | First-time setup: checks Node/Git/Chromium, installs OpenClaw, copies config examples, runs health checks (DB, Telegram, Anthropic) | Once on new hardware |
| `harden.sh` | Security hardening: UFW firewall, custom SSH port, disable root login, fail2ban, dedicated agent user | Once on new hardware |
| `backup.sh` | Timestamped SQLite backup to `data/backups/`, auto-prunes to last 7 | Daily via 3am cron |
| `update.sh` | Pull latest code, reinstall deps, restart agent | After pushing to GitHub |

### Mac Mini Deployment Sequence
```bash
# 1. Initial setup
git clone <repo> && cd pokemon-card-agent
bash deploy/setup.sh
cp .env.example .env  # Fill in real API keys

# 2. Security hardening
bash deploy/harden.sh

# 3. OpenClaw deployment
openclaw onboard --install-daemon
openclaw gateway status  # Verify running

# 4. NemoClaw security layer (recommended)
# See "NemoClaw Security" section below

# 5. Verify
node tools/startup.js  # Test locally first
# Then let OpenClaw manage via cron
```

## OpenClaw Configuration (`openclaw.json`)

- **Model**: `anthropic/claude-sonnet-4-20250514`
- **Gateway**: loopback only, port 18789
- **9 skills** enabled: pokemon-scraper, tcg-price-check, card-analyzer, deal-alerts, email-outreach, voice-outreach, watchlist-manager, spend-tracker, agent-dashboard
- **5 cron jobs**: scrape-cycle (30min), outreach-cycle (10am), daily-summary (8pm), database-backup (3am), cloud-sync (5min)
- Skills with API keys pass them via `env` mapping in `openclaw.json` (e.g., voice-outreach maps Twilio keys)

## NemoClaw Security (Future — Layer on Before Soak Test)

NVIDIA NemoClaw is an open-source security stack for OpenClaw agents, announced at GTC 2026. Installs in a single command on top of OpenClaw.

### Why it matters for the Mac Mini
This agent runs autonomously 24/7, scrapes untrusted web content, holds API keys worth real money, and sends emails/calls on your behalf. NemoClaw adds defense-in-depth:

### Three security controls:
1. **Kernel-level sandbox** (deny-by-default) — agent can't touch files/network/APIs outside its allowed scope. If a scraped eBay page injects something malicious, it can't reach your `.env`, other files, or network services.
2. **Out-of-process policy engine** (OpenShell) — YAML-based permission rules the agent cannot override even if compromised. Example policies:
   - Agent can only write to `data/`, `logs/`, `config/`
   - Agent can only make HTTP requests to: `ebay.com`, `tcgplayer.com`, `trollandtoad.com`, `api.anthropic.com`, `api.resend.com`, `api.twilio.com`, `api.telegram.org`, `api.deepgram.com`, CRM_SYNC_URL
   - Agent cannot execute arbitrary shell commands
3. **Privacy router** — routes sensitive data (seller contacts, pricing strategies) to local Nemotron models while sending only deal analysis reasoning to Claude. Could reduce API costs AND keep PII local.

### When to add it
- **Not now** — get prompts 13-18 built and feature-complete first
- **Before 48-hour soak test** — layer NemoClaw on, configure OpenShell policies, then run the soak test with security enabled
- **Definitely before** running for other collectors or as a service

### Resources
- [NVIDIA NemoClaw announcement](https://nvidianews.nvidia.com/news/nvidia-announces-nemoclaw)
- [NemoClaw product page](https://www.nvidia.com/en-us/ai/nemoclaw/)

## Version Control

### Gitignored (never commit)
- `.env` — API keys and secrets
- `*.db` — SQLite databases
- `/data` — agent data, backups, exports
- `/logs` — agent logs
- `config/config.json`, `config/watchlist.json`, `config/contacts.json` — runtime configs (commit only `.example` versions)
- `crm/.env.local` — CRM secrets
- `crm/.next` — Next.js build output
- `node_modules`

### Must commit
- `config/*.example.json` — config templates
- `.env.example` — env var template
- `deploy/` scripts
- `skills/` — OpenClaw skill definitions
- `openclaw.json` — agent configuration

## Audit Checklist (run after major changes)
1. `grep -rL 'force-dynamic' crm/src/app/api/**/route.ts` — find routes missing it
2. `grep -rn 'params: { id' crm/src/app/api/` — find old-style (non-Promise) params
3. `grep -rn 'router.refresh' crm/src/` — should return zero results (use `refresh()` from useLiveData)
4. `grep -rn 'useEffect.*fetch' crm/src/` — components should use `useLiveData`, not manual fetch
5. `cd crm && npx next build` — verify before every deploy
6. `grep -rL 'export const dynamic' crm/src/app/api/**/route.ts` — catch missing force-dynamic (alt syntax)
7. Verify all sync routes listed in `cloudSync.js` TABLES have matching `/api/sync/*` endpoints
