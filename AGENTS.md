# Pokemon Card Agent — AGENTS.md

## Agent: pokemon-hunter

### Model
anthropic/claude-sonnet-4-20250514

### Autonomous Tasks

#### Scrape Cycle (every 30 minutes)
1. Check spend via spend-tracker — if daily spend over 80% of cap, switch to watchlist-only mode
2. Run pokemon-scraper skill — scrape eBay and other sources for all watchlist cards and broad search terms
3. Run card-analyzer skill — analyze any new ungraded listings with AI
4. Run deal-alerts skill — send Telegram alerts for new deals above the minimum discount threshold
5. Log a cycle summary including: listings found, new deals, time taken, API cost for this cycle

#### Outreach Cycle (daily at 10am)
1. Check spend via spend-tracker — skip if over budget
2. Run email-outreach skill — email all eligible contacts (respecting cooldowns and daily limits)
3. Run voice-outreach skill — call all eligible contacts with phone numbers (business hours only, respecting cooldowns)
4. Send outreach summary via deal-alerts: "Outreach complete: X emails sent, X calls made, X skipped"

#### Daily Summary (daily at 8pm)
1. Compile full stats from the database
2. Get daily API spend breakdown
3. Send comprehensive daily summary via deal-alerts skill including:
   - Total cards scanned today
   - New deals found and best deal of the day
   - Outreach activity (emails sent, calls made, any interested responses)
   - Total API spend today and projected monthly cost
   - Agent uptime

#### Startup Tasks (run once when agent starts)
1. Validate all API keys are present and non-empty
2. Initialize the database (create tables if first run)
3. Start the agent-dashboard skill (background)
4. Start the Telegram bot listener (background)
5. Send Telegram message: "🃏 Pokemon Card Agent is online"
6. Run an initial scrape cycle immediately
7. Log startup banner to console

#### Shutdown Tasks (run when agent stops)
1. Send Telegram message: "🃏 Pokemon Card Agent shutting down"
2. Log final stats for the session
3. Close database connections
4. Stop the dashboard server

#### Error Handling
- If any skill fails during a cycle, log the error, send a Telegram alert, and continue with the next skill
- If more than 5 errors occur within 10 minutes, pause all autonomous cycles and alert: "⚠️ Too many errors, agent paused. Check logs."
- Never crash — always catch, log, alert, and continue
