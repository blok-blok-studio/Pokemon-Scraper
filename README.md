# Pokemon Card Agent

An autonomous Pokemon TCG card deal hunting agent running on [OpenClaw](https://openclaw.com). Scrapes marketplaces, cross-references TCGPlayer pricing, uses AI to analyze listing legitimacy, and manages outreach to sellers — all autonomously.

## How It Works

1. **Build** in Claude Code (this repo)
2. **Push** to GitHub
3. **Pull** onto isolated hardware
4. **Run** on OpenClaw — the agent operates autonomously from there

## Features

- **eBay Scraping** — Finds Pokemon card listings (Buy It Now only), up to 3 pages per search
- **TCGPlayer Price Check** — Cross-references market prices for discount calculation
- **AI Card Analysis** — Claude analyzes listings for legitimacy, deal quality, and red flags
- **Telegram Alerts** — Real-time deal notifications with bot commands for control
- **Email Outreach** — AI-personalized emails to card shops, pawn shops, and sellers via Resend
- **Voice Outreach** — AI phone calls to stores via Bland.ai with transcript analysis
- **Watchlist Management** — Track specific cards you're hunting for
- **Spend Tracking** — Monitor API costs across all services with daily caps
- **Web Dashboard** — Bootstrap status dashboard on localhost

## Quick Start

### Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/pokemon-card-agent.git
cd pokemon-card-agent
npm install
```

### Configure

```bash
cp .env.example .env
cp config/config.example.json config/config.json
cp config/watchlist.example.json config/watchlist.json
cp config/contacts.example.json config/contacts.json
```

Edit `.env` with your API keys.

### API Keys

| Service | Purpose | Get It |
|---------|---------|--------|
| Anthropic | AI analysis & email generation | [console.anthropic.com](https://console.anthropic.com) |
| Telegram | Deal alerts & bot commands | Create bot via [@BotFather](https://t.me/BotFather), get chat ID via [@userinfobot](https://t.me/userinfobot) |
| Resend | Email outreach | [resend.com](https://resend.com) |
| Bland.ai | Voice outreach | [bland.ai](https://bland.ai) |

All services are pay-as-you-go. No subscriptions required.

### Test Locally

```bash
npm run test:db         # Test database layer
npm run test:dashboard  # Test dashboard server
```

### Run with OpenClaw

```bash
openclaw onboard --install-daemon
openclaw gateway start
```

The agent will:
- Scrape for deals every 30 minutes
- Run outreach daily at 10am
- Send a daily summary at 8pm
- Back up the database at 3am

## Deployment to Isolated Hardware

### First-Time Setup

```bash
# On your isolated machine:
bash deploy/setup.sh
```

This script will:
- Check/install Node.js 22+, Git, and Chromium
- Install OpenClaw globally
- Clone the repo and install dependencies
- Walk you through API key configuration
- Run health checks

### Security Hardening

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

### Updating

```bash
bash deploy/update.sh
```

Pulls latest from GitHub, installs dependencies, restarts OpenClaw.

### Backing Up

```bash
bash deploy/backup.sh
# Or let the daily cron handle it automatically at 3am
```

Keeps last 7 database backups.

## Monitoring

- **Dashboard**: `http://localhost:3847` (configurable via AGENT_PORT)
- **Telegram**: Send `/status`, `/deals`, `/watchlist`, `/spend`, `/help` to your bot

## Project Structure

```
/skills           — OpenClaw skill definitions (SKILL.md files)
/tools            — Shared tools called by skills
  /scraper-engine — eBay + TCGPlayer scrapers
  /analyzer       — AI card analysis
  /telegram-client — Telegram bot + alerts
  /resend-client  — Email outreach via Resend
  /bland-client   — Voice outreach via Bland.ai
  /db             — SQLite database layer
  /dashboard      — Express + Bootstrap web dashboard
/config           — Configuration files (gitignored)
/deploy           — Deployment scripts
/data             — Database storage (gitignored)
/logs             — Log files (gitignored)
SOUL.md           — Agent personality for OpenClaw
AGENTS.md         — Agent task definitions
openclaw.json     — OpenClaw configuration with cron schedules
```

## License

MIT
