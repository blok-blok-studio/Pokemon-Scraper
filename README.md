# Pokemon Card Agent

An autonomous Pokemon TCG card deal-hunting agent running on [OpenClaw](https://openclaw.com). Scrapes marketplaces, cross-references TCGPlayer pricing, uses AI to analyze listing legitimacy, and manages outreach to sellers — all autonomously. Includes a cloud CRM dashboard deployed on Vercel for managing your deal pipeline from anywhere.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Part 1: Agent Setup (Local Testing)](#part-1-agent-setup-local-testing)
- [Part 2: Cloud CRM Setup](#part-2-cloud-crm-setup)
- [Part 3: Deploy Agent to Isolated Hardware](#part-3-deploy-agent-to-isolated-hardware)
- [Part 4: Connect Agent to Cloud CRM](#part-4-connect-agent-to-cloud-crm)
- [API Keys Reference](#api-keys-reference)
- [CRM Pages Guide](#crm-pages-guide)
- [Agent Cron Schedule](#agent-cron-schedule)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Overview

The system has two parts:

1. **The Agent** — Runs on isolated hardware (or locally for testing). Scrapes eBay for Pokemon card listings, checks prices against TCGPlayer, uses Claude AI to analyze deals, sends Telegram alerts, and does email/voice outreach to sellers.

2. **The Cloud CRM** — A Next.js dashboard deployed on Vercel. Lets you review deals, manage a pipeline (new → reviewing → approved → purchased → passed), track sellers, approve outreach, manage tasks, and monitor API spend — all from your browser on any device.

The agent syncs its local SQLite data to the cloud CRM's Postgres database every 5 minutes.

## Features

### Agent
- **eBay Scraping** — Finds Pokemon card listings (Buy It Now only), up to 3 pages per search
- **TCGPlayer Price Check** — Cross-references market prices for discount calculation
- **AI Card Analysis** — Claude analyzes listings for legitimacy, deal quality, and red flags
- **Telegram Alerts** — Real-time deal notifications with bot commands for control
- **Email Outreach** — AI-personalized emails to card shops, pawn shops, and sellers via Resend
- **Voice Outreach** — AI phone calls to stores via Twilio + Deepgram with real-time conversation and transcript analysis
- **Watchlist Management** — Track specific cards you're hunting for
- **Spend Tracking** — Monitor API costs across all services with daily caps
- **Local Dashboard** — Bootstrap status dashboard on localhost

### Cloud CRM
- **Deal Pipeline** — Kanban board with drag-and-drop (new → reviewing → approved → purchased → passed)
- **Seller Management** — Track sellers with AI trust scores
- **Outreach Pipeline** — Approve/reject outreach, track status
- **Task Management** — Create tasks linked to deals or sellers
- **Watchlist** — Manage watched cards from anywhere
- **Spend Dashboard** — API cost charts, daily/monthly breakdown
- **Global Search** — Search across deals, sellers, and outreach
- **Password Auth** — Secure login with bcrypt-hashed password

---

## Architecture

```
Agent (OpenClaw hardware)             Cloud (Vercel)
┌───────────────────────────┐        ┌──────────────────────────┐
│ SQLite: data/agent.db     │──sync──│ Neon Postgres            │
│  card_listings            │ (5min) │  + sellers               │
│  outreach_log             │        │  + deal_pipeline         │
│  price_history            │        │  + tasks & notes         │
│  api_usage                │        │  + watchlist             │
└───────────────────────────┘        └──────────────────────────┘
                                     │ Next.js 14 + Tailwind    │
                                     │ Prisma ORM               │
                                     │ Password auth (bcrypt)   │
                                     └──────────────────────────┘
```

---

## Prerequisites

- **Node.js 18+** (22+ recommended for agent)
- **npm** (comes with Node.js)
- **Git**
- A **GitHub** account (to push/pull the repo)
- A **Vercel** account (free tier works) for the CRM
- API keys (see [API Keys Reference](#api-keys-reference))

---

## Part 1: Agent Setup (Local Testing)

You can test the entire agent locally on your computer before deploying to isolated hardware.

### Step 1: Clone the Repository

```bash
git clone https://github.com/blok-blok-studio/Pokemon-Scraper.git
cd Pokemon-Scraper
```

### Step 2: Install Agent Dependencies

```bash
npm install
```

This installs all agent dependencies (puppeteer, better-sqlite3, express, axios, etc.).

### Step 3: Copy Config Templates

```bash
cp .env.example .env
cp config/config.example.json config/config.json
cp config/watchlist.example.json config/watchlist.json
cp config/contacts.example.json config/contacts.json
```

### Step 4: Add Your API Keys

Open `.env` in a text editor and fill in your keys:

```env
# Required — AI analysis powers the whole agent
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Required — Deal alerts and bot commands
TELEGRAM_BOT_TOKEN=1234567890:ABCDefghIJKLmnopQRSTuvwxYZ
TELEGRAM_CHAT_ID=123456789

# Optional — Email outreach (skip if you don't need outreach)
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=deals@yourdomain.com
REPLY_TO_EMAIL=you@gmail.com

# Optional — Voice outreach (skip if you don't need calls)
DEEPGRAM_API_KEY=your_deepgram_api_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+15551234567

# Optional — Testing
TEST_EMAIL=you@gmail.com
TEST_PHONE=+15551234567
AGENT_NAME=Chase

# Agent config
AGENT_PORT=3847
DAILY_API_SPEND_CAP_USD=5.00
```

See [API Keys Reference](#api-keys-reference) for how to get each key.

### Step 5: Configure Your Watchlist

Edit `config/watchlist.json` to add cards you want to hunt for:

```json
[
  {
    "cardName": "Charizard VMAX",
    "setName": "Shining Fates",
    "maxPrice": 150.00
  },
  {
    "cardName": "Pikachu VMAX",
    "setName": "Vivid Voltage",
    "maxPrice": 50.00
  }
]
```

### Step 6: Configure Outreach Contacts

Edit `config/contacts.json` to add sellers/stores you want to reach out to:

```json
[
  {
    "name": "Card Kingdom",
    "type": "card_shop",
    "email": "info@cardkingdom.com",
    "phone": "+15551234567"
  }
]
```

### Step 7: Test It

```bash
# Test the database layer
npm run test:db

# Test the dashboard server
npm run test:dashboard
```

The local dashboard runs at `http://localhost:3847`.

### Step 8: Configure Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts to create a bot
3. Copy the bot token into `TELEGRAM_BOT_TOKEN` in `.env`
4. Message [@userinfobot](https://t.me/userinfobot) to get your chat ID
5. Copy the chat ID into `TELEGRAM_CHAT_ID` in `.env`
6. Send `/start` to your new bot

Now you can interact with the agent via Telegram commands: `/status`, `/deals`, `/watchlist`, `/spend`, `/help`.

---

## Part 2: Cloud CRM Setup

The CRM is a separate Next.js app in the `/crm` directory. It deploys to Vercel with a Postgres database.

### Step 1: Install CRM Dependencies

```bash
cd crm
npm install
cd ..
```

### Step 2: Create a Vercel Account

1. Go to [vercel.com](https://vercel.com) and sign up (free tier is fine)
2. Install the Vercel CLI:

```bash
npm install -g vercel
vercel login
```

### Step 3: Deploy to Vercel

From the project root:

```bash
cd crm
vercel --yes --prod
```

When prompted:
- **Set up and deploy?** Yes
- **Which scope?** Select your account
- **Link to existing project?** No
- **Project name?** `pokemon-crm` (or whatever you want)
- **Directory with source code?** `./` (you're already in `/crm`)
- **Override settings?** No

The first deploy will fail because there's no database yet. That's expected.

### Step 4: Add a Postgres Database

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your new project (e.g., `pokemon-crm`)
3. Go to **Storage** tab
4. Click **Create Database** → select **Neon Postgres**
5. Choose the free tier and your preferred region
6. When asked for an environment variable prefix, use **`POSTGRES`**

This auto-creates the required env vars (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, etc.) in your Vercel project.

### Step 5: Set CRM Password

Generate a bcrypt hash of your chosen password:

```bash
node -e "const b=require('bcryptjs');b.hash('YOUR_PASSWORD_HERE',12).then(h=>{process.stdout.write(h);})" > /tmp/hash.txt
```

Add it to Vercel:

```bash
cat /tmp/hash.txt | vercel env add CRM_PASSWORD_HASH production
rm /tmp/hash.txt
```

**Important:** Do NOT use `echo` to pipe the hash — the `$` characters in bcrypt hashes get interpreted by the shell.

### Step 6: Set Sync API Key

Generate a random sync secret:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" > /tmp/synckey.txt
cat /tmp/synckey.txt | vercel env add SYNC_API_KEY production
```

Save this key — you'll need it for the agent's `.env` file later. View it:

```bash
cat /tmp/synckey.txt
rm /tmp/synckey.txt
```

### Step 7: Redeploy

Now that the database and env vars are set, redeploy:

```bash
vercel --yes --prod
```

The build will:
1. Generate the Prisma client
2. Push the schema to Postgres (creates all tables)
3. Build the Next.js app

### Step 8: Verify the CRM

1. Open your Vercel deployment URL (e.g., `https://pokemon-crm.vercel.app`)
2. You should see the login page
3. Enter your password
4. You should see the empty dashboard

The CRM is now live. It will populate with data once the agent starts syncing.

### Local CRM Development (Optional)

If you want to run the CRM locally for development:

```bash
cd crm

# Create a local env file
cat > .env.local << 'EOF'
POSTGRES_PRISMA_URL=your_neon_connection_string
POSTGRES_URL_NON_POOLING=your_neon_direct_connection_string
CRM_PASSWORD_HASH=your_bcrypt_hash
SYNC_API_KEY=your_sync_secret
EOF

# Run the dev server
npm run dev
```

You can find the Neon connection strings in your Vercel project's Storage settings.

The local dev server runs at `http://localhost:3000`.

---

## Part 3: Deploy Agent to Isolated Hardware

This section is for deploying the agent to a dedicated machine (Linux server, Raspberry Pi, etc.) to run 24/7.

### Step 1: Run the Setup Script

SSH into your machine and run:

```bash
bash deploy/setup.sh
```

This will:
- Check/install Node.js 22+, Git, and Chromium
- Install OpenClaw globally
- Clone the repo and install dependencies
- Walk you through API key configuration
- Run health checks

### Step 2: Harden Security (Recommended)

```bash
bash deploy/harden.sh
```

This configures:
- UFW firewall (custom SSH port, outbound only)
- SSH key-only auth with root login disabled
- fail2ban (3 attempts = 1 hour ban)
- Dedicated `pokemon-agent` user
- Locked-down file permissions
- Automatic security updates

### Step 3: Start OpenClaw

```bash
openclaw onboard --install-daemon
openclaw gateway start
```

The agent will now run on its automated schedule (see [Agent Cron Schedule](#agent-cron-schedule)).

### Updating the Agent

```bash
bash deploy/update.sh
```

Pulls latest from GitHub, installs dependencies, restarts OpenClaw.

### Backing Up

```bash
bash deploy/backup.sh
```

Keeps last 7 database backups. Also runs automatically at 3am via cron.

---

## Part 4: Connect Agent to Cloud CRM

Once both the agent and CRM are running, connect them so data syncs automatically.

### Step 1: Add CRM Sync Config to Agent

Open the agent's `.env` file and add:

```env
CRM_SYNC_URL=https://your-pokemon-crm.vercel.app
CRM_SYNC_API_KEY=the_sync_key_from_step_6_above
```

Replace the URL with your actual Vercel deployment URL.

### Step 2: Test the Sync

Run the sync script manually:

```bash
node tools/sync/cloudSync.js
```

You should see output like:

```
Starting cloud sync...
card_listings: synced 15 records (cursor: 15)
outreach_log: already up to date
price_history: synced 42 records (cursor: 42)
api_usage: synced 108 records (cursor: 108)
Cloud sync complete: 165 total records synced
```

### Step 3: Verify in CRM

Open your CRM URL and check:
- Dashboard shows deal counts
- Deals page shows your scraped listings
- Spend page shows API usage

### Automatic Sync

The sync runs automatically every 5 minutes via the `cloud-sync` cron in `openclaw.json`. No further setup needed.

### How the Sync Works

1. The sync script calls `GET /api/sync/status` to get the last synced ID for each table
2. Queries local SQLite for rows with `id > last_synced_id`
3. POSTs batches of 100 records to `/api/sync/{listings,outreach,prices,usage}`
4. The CRM upserts on `local_id` (no duplicates)
5. Seller profiles are auto-created from listing seller names

The sync is **incremental** — it only sends new records, not the entire database each time.

---

## API Keys Reference

| Service | Purpose | Required? | How to Get |
|---------|---------|-----------|------------|
| **Anthropic** | AI analysis, email generation, deal grading | Yes | Sign up at [console.anthropic.com](https://console.anthropic.com), create an API key |
| **Telegram** | Real-time deal alerts, bot commands | Yes | Create bot via [@BotFather](https://t.me/BotFather), get chat ID via [@userinfobot](https://t.me/userinfobot) |
| **Resend** | Email outreach to sellers | No | Sign up at [resend.com](https://resend.com), verify a domain, create API key |
| **Deepgram** | Voice STT/TTS for phone calls | No | Sign up at [deepgram.com](https://deepgram.com), create API key |
| **Twilio** | Phone call infrastructure | No | Sign up at [twilio.com](https://www.twilio.com), get SID/token, buy a phone number (~$1.15/mo) |

All services are pay-as-you-go. No subscriptions required.

### Resend Domain Setup

Resend requires a verified domain to send emails. Without this, emails will fail or go to spam.

1. Sign up at [resend.com](https://resend.com)
2. Go to **Domains** → **Add Domain**
3. Enter your domain (e.g., `blokblokstudio.com`)
4. Resend will give you DNS records to add:
   - **MX record** — for receiving replies
   - **TXT record (SPF)** — authorizes Resend to send on your behalf
   - **CNAME records (DKIM)** — email authentication signatures
5. Add these DNS records in your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.)
6. Back in Resend, click **Verify** — it may take a few minutes for DNS to propagate
7. Once verified, create an API key under **API Keys**
8. Set these in your `.env`:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   FROM_EMAIL=yourname@yourdomain.com
   REPLY_TO_EMAIL=yourname@yourdomain.com
   ```

The `FROM_EMAIL` must use your verified domain. You can use any prefix (e.g., `deals@`, `chase@`, `pokemon@`).

### Cost Estimates

| Service | Typical Cost | Notes |
|---------|-------------|-------|
| Anthropic | ~$0.50-2.00/day | Depends on number of listings analyzed |
| Resend | Free for 100 emails/day | Then $20/mo for more |
| Twilio | ~$0.014/minute + $1.15/mo | Per-minute call charges + phone number |
| Deepgram | ~$0.02/minute | STT + TTS combined |
| Vercel | Free | Hobby tier covers the CRM |
| Neon Postgres | Free | Free tier has 0.5 GB storage |

The agent has a configurable daily spend cap (`DAILY_API_SPEND_CAP_USD` in `.env`) that pauses expensive operations once reached.

---

## CRM Pages Guide

| Page | URL | What It Does |
|------|-----|-------------|
| **Dashboard** | `/` | Stat cards (total deals, must-buys, pending outreach, open tasks, today's spend), recent deals, recent outreach |
| **Deals** | `/deals` | Filterable table of all card listings with grade and pipeline stage filter pills |
| **Deal Detail** | `/deals/[id]` | Full deal info: AI analysis, price comparison, red flags, seller link, pipeline stage controls, notes |
| **Pipeline** | `/pipeline` | Kanban board — drag deals between columns: new, reviewing, approved, purchased, passed |
| **Sellers** | `/sellers` | List of all sellers with trust scores, listing counts, outreach counts |
| **Seller Detail** | `/sellers/[id]` | Seller profile with all their listings, outreach history, and notes |
| **Outreach** | `/outreach` | Outreach pipeline — approve/reject messages, track status (pending → sent → replied → converted) |
| **Tasks** | `/tasks` | Task list with create, complete, delete — tasks can be linked to deals or sellers |
| **Watchlist** | `/watchlist` | Manage watched cards — add, edit, toggle active/paused, remove |
| **Spend** | `/spend` | API cost dashboard — today/month totals, per-service breakdown, daily spend chart |
| **Search** | `/search` | Global search across deals, sellers, and outreach |
| **Login** | `/login` | Password login page |

---

## Agent Cron Schedule

These run automatically when OpenClaw is active:

| Cron | Schedule | What It Does |
|------|----------|-------------|
| `scrape-cycle` | Every 30 minutes | Checks spend, scrapes eBay, analyzes listings with AI, sends deal alerts |
| `outreach-cycle` | Daily at 10:00 AM | Emails and calls eligible contacts, respects cooldowns |
| `daily-summary` | Daily at 8:00 PM | Sends Telegram summary: cards scanned, deals found, spend breakdown |
| `database-backup` | Daily at 3:00 AM | Backs up SQLite database (keeps last 7) |
| `cloud-sync` | Every 5 minutes | Syncs local data to cloud CRM |

---

## Monitoring

### Local (on agent machine)
- **Dashboard**: `http://localhost:3847` (configurable via `AGENT_PORT`)
- **Telegram Bot**: Send `/status`, `/deals`, `/watchlist`, `/spend`, `/help`
- **Logs**: Check `logs/` directory for detailed logs

### Cloud CRM
- **URL**: Your Vercel deployment URL
- **Login**: Use the password you set in [Part 2, Step 5](#step-5-set-crm-password)

---

## Troubleshooting

### CRM shows "Internal Server Error"
- Check Vercel function logs: go to your Vercel project → Deployments → click latest → Functions tab
- Most common cause: database not connected. Verify the Storage tab shows a connected Postgres database with `POSTGRES` prefix

### Login doesn't work
- The bcrypt hash may have been corrupted by shell interpolation. Re-generate it:
  ```bash
  node -e "const b=require('bcryptjs');b.hash('YOUR_PASSWORD',12).then(h=>{process.stdout.write(h);})" > /tmp/hash.txt
  cat /tmp/hash.txt | vercel env rm CRM_PASSWORD_HASH production -y
  cat /tmp/hash.txt | vercel env add CRM_PASSWORD_HASH production
  rm /tmp/hash.txt
  vercel --yes --prod
  ```

### Sync script fails with "CRM_SYNC_URL and CRM_SYNC_API_KEY must be set"
- Make sure both `CRM_SYNC_URL` and `CRM_SYNC_API_KEY` are in your agent's `.env` file
- The URL should include `https://` (e.g., `https://pokemon-crm.vercel.app`)

### Sync script gets 401 Unauthorized
- The `CRM_SYNC_API_KEY` in the agent's `.env` must match the `SYNC_API_KEY` in Vercel's environment variables exactly

### Agent scraping returns no results
- Make sure Chromium is installed (`chromium --version`)
- Check that your search terms in `config/watchlist.json` are valid Pokemon card names
- eBay may rate-limit aggressive scraping — the agent handles this with delays

### Telegram bot not responding
- Make sure you sent `/start` to your bot first
- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are correct in `.env`
- Check that the chat ID is your personal chat, not a group ID

### "POSTGRES_PRISMA_URL is not set" during build
- Go to Vercel Dashboard → your project → Storage → make sure Neon Postgres is connected
- The prefix must be `POSTGRES` so the env vars are named `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`

---

## Project Structure

```
/skills              — OpenClaw skill definitions (SKILL.md files)
/tools               — Shared tools called by skills
  /scraper-engine    — eBay + TCGPlayer scrapers
  /analyzer          — AI card analysis
  /telegram-client   — Telegram bot + alerts
  /resend-client     — Email outreach via Resend
  /bland-client      — Voice outreach via Twilio + Deepgram
  /db                — SQLite database layer
  /dashboard         — Express + Bootstrap local web dashboard
  /sync              — Cloud CRM sync script (cloudSync.js)
/config              — Configuration files (gitignored)
/deploy              — Deployment & hardening scripts
/data                — Database storage (gitignored)
/logs                — Log files (gitignored)
/crm                 — Cloud CRM (Next.js app, deploys to Vercel)
  /prisma            — Database schema (schema.prisma)
  /src/app           — Next.js App Router pages
  /src/app/api       — API routes (sync, deals, sellers, etc.)
  /src/lib           — Shared utilities (auth, prisma client)
  /src/components    — Reusable UI components
SOUL.md              — Agent personality for OpenClaw
AGENTS.md            — Agent task definitions
openclaw.json        — OpenClaw config with cron schedules
```

### CRM Database Tables

| Table | Synced from Agent? | Purpose |
|-------|-------------------|---------|
| `card_listings` | Yes | All scraped card listings with AI analysis |
| `outreach_log` | Yes | Email/voice outreach records |
| `price_history` | Yes | Historical price data points |
| `api_usage` | Yes | API call logs with cost tracking |
| `sellers` | Auto-created | Seller profiles with trust scores |
| `notes` | CRM only | Notes on deals, sellers, outreach |
| `tasks` | CRM only | Tasks linked to entities |
| `watchlist` | CRM only | Watched card configurations |
| `sync_cursors` | CRM only | Tracks sync progress per table |

### Database Indexes

The CRM database uses compound indexes for fast queries at scale. These are defined in `crm/prisma/schema.prisma` and applied automatically during deployment.

| Table | Index | Why |
|-------|-------|-----|
| `card_listings` | `(pipeline_stage)` | Filter deals by stage (new, reviewing, approved, etc.) |
| `card_listings` | `(seller_name)` | Look up listings by seller |
| `card_listings` | `(deal_grade)` | Filter by deal quality (A, B, C, D) |
| `card_listings` | `(card_name, found_at)` | Search for a card + sort by when found |
| `card_listings` | `(seller_id, found_at)` | Seller detail page: their listings sorted by date |
| `card_listings` | `(found_at DESC)` | Default listing sort: newest first |
| `outreach_log` | `(pipeline_stage)` | Filter outreach by status |
| `outreach_log` | `(contact_info)` | Look up outreach by contact |
| `outreach_log` | `(sent_at DESC)` | Default outreach sort: most recent first |
| `outreach_log` | `(seller_id, sent_at)` | Seller detail page: their outreach history |
| `price_history` | `(card_name)` | Look up price history for a card |
| `price_history` | `(card_name, recorded_at)` | Price trend chart: card prices over time |
| `price_history` | `(recorded_at DESC)` | Recent prices query |
| `api_usage` | `(service)` | Spend breakdown by service |
| `api_usage` | `(called_at)` | Spend queries by date range |

To add new indexes, edit `crm/prisma/schema.prisma` and run `npx prisma db push` from the `crm/` directory.

### Security

The system enforces several security layers:

- **No hardcoded secrets** — All API keys and tokens are loaded from environment variables (`.env` for agent, Vercel env vars for CRM)
- **`.gitignore` coverage** — `.env`, `data/`, `logs/`, `config/`, and `node_modules/` are all gitignored. Secrets never enter git history.
- **Rate limiting** — The CRM middleware rate-limits all API endpoints:
  - Auth: 5 requests/minute per IP (brute-force protection)
  - Sync: 30 requests/minute per IP
  - General API: 60 requests/minute per IP
  - Returns `429 Too Many Requests` with `Retry-After` header when exceeded
- **Sync authentication** — All `/api/sync/*` endpoints require a `Bearer` token matching `SYNC_API_KEY`
- **Session auth** — CRM dashboard requires password login; session cookie checked on every request
- **Input validation** — All API route parameters are validated (parseInt checks, required field checks, limit clamping)
- **Error handling** — Every API route has try/catch with 500 responses; no stack traces leak to clients
- **Cloud sync retry** — Sync uses exponential backoff (1s, 2s, 4s) with 3 retries on transient failures, and continues syncing other tables if one fails
- **Voice call hardening** — Deepgram/Twilio connection drops are handled gracefully, Claude API calls have 10s timeouts, TTS failures trigger fallback responses

---

## License

MIT
