# Testing Guide

## Quick Start

```bash
# Run all unit tests (free, no API keys needed, no network)
npm run test:unit

# Run specific test file
npx vitest run tests/unit/database.test.js

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run everything
npm run test:all
```

## Test Types

### Unit Tests (`npm run test:unit`)
- **Cost:** Free
- **Network:** Not required
- **API Keys:** Not required
- **What they test:** Database operations, card matching, proxy rotation, CSV export
- **Run these:** After every code change

### Smoke Tests (`npm run test:smoke`)
- **Cost:** Free
- **Network:** Not required
- **API Keys:** Not required
- **What they test:** Full agent cycle with mock data — verifies all modules work together
- **Run these:** Before every deployment to production hardware

### Integration Tests (`npm run test:integration`)
- **Cost:** $0.05-0.50 per full run (mostly AI analyzer cost)
- **Network:** Required
- **API Keys:** Required (fill in .env.test)
- **What they test:** Real API calls to TCGPlayer, eBay, Telegram, Resend, Anthropic, dashboard
- **Run these:** Before pushing to GitHub, after changing any scraper or API integration

### Standalone Tests (legacy, pre-vitest)
These are the original test scripts that run outside vitest:
```bash
npm run test:db        # Database operations
npm run test:tcg       # TCGPlayer price lookup (needs network)
npm run test:ebay      # eBay scraper (needs network)
npm run test:analyzer  # Card analyzer (costs ~$0.01-0.05)
npm run test:telegram  # Telegram send (needs bot token)
npm run test:email     # Email outreach (needs Resend key)
npm run test:voice     # Voice outreach (needs Twilio)
npm run test:dashboard # Dashboard API
npm run test:proxy     # Proxy manager
npm run test:matcher   # Card name matcher
```

## Testing Workflow

1. Make code changes
2. Run `npm run test:unit` — fix any failures
3. Run `npm run test:smoke` — fix any integration issues
4. If you changed a scraper or API module, run the relevant standalone test
5. All green? Commit: `git add . && git commit -m "your message"`
6. Push: `git push origin main`

## Environment Setup for Integration Tests

Copy .env to .env.test and adjust values:
```bash
cp .env .env.test
```

Set a lower spend cap for testing:
```env
DAILY_API_SPEND_CAP_USD=1.00
AGENT_PORT=3848
```

## Test Data

Mock data is in `tests/helpers/mockData.js`:
- **10 sample listings** — includes real deals, overpriced, accessories, fakes, code cards
- **5 watchlist cards** — Charizard VMAX, Pikachu VMAX, Lugia V Alt Art, Mew VMAX Alt Art, Umbreon VMAX Alt Art
- **4 sample contacts** — card shop, pawn shop, facebook seller, online seller
- **5 outreach entries** — various statuses (sent, delivered, replied, failed)
- **5 API usage entries** — totaling $0.043

## Test Database

Tests use a separate database at `data/test_agent.db` (created automatically, deleted after tests). It never touches the production database at `data/agent.db`.

## Common Test Failures

| Failure | Cause | Fix |
|---------|-------|-----|
| "Navigation timeout" | Scraper couldn't load page | Site may be slow or blocking. Try again or add proxies. |
| "ANTHROPIC_API_KEY not set" | Missing .env or .env.test | Copy from .env.example and fill in keys |
| "Empty scraper results" | Site changed HTML structure | Open URL in browser, compare HTML, update selectors |
| "Telegram send failed" | Bad bot token or chat ID | Verify with @BotFather and @userinfobot |
| "CAPTCHA detected" | IP blocked by site | Add proxies to config/proxies.json |
| "disk I/O error" | Stale test database | Delete `data/test_agent.db` and re-run |
| "Cannot find module" | Missing dependency | Run `npm install` |
| "SyntaxError: Unexpected token" | Wrong Node.js version | Requires Node.js 18+ |

## Writing New Tests

### Unit Test Template
```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { getTestDb, cleanupTestDb } = require('../helpers/testDb');
const db = require('../../tools/db/database');

let database;
beforeAll(() => { database = getTestDb(); });
afterAll(() => { database.close(); cleanupTestDb(); });

describe('MyFeature', () => {
  it('should do something', () => {
    // Arrange
    const input = { card_name: 'Test Card', price: 10, url: 'https://test.com/1' };

    // Act
    db.insertListing(database, input);
    const result = database.prepare('SELECT * FROM card_listings').all();

    // Assert
    expect(result.length).toBe(1);
    expect(result[0].card_name).toBe('Test Card');
  });
});
```

### Key Rules
- Use `beforeAll` (not `beforeEach`) for database setup — avoids disk I/O errors
- Use relative assertions (`toBeGreaterThan`) instead of exact counts when tests share a database
- Always clean up: close database connections, delete export files
- Mock external APIs in unit tests — only hit real APIs in integration tests
