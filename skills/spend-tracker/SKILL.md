---
name: spend-tracker
description: Track API costs across all services (Anthropic, Resend, Bland, Telegram). Show daily and monthly spending, breakdowns by service, and alerts when approaching the spend cap. Responds to /spend command.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# Spend Tracker

## Description
Monitors API costs and budget usage across all paid services used by the Pokemon Card Agent.

## Tools
- Get daily spend total: `node tools/db/cli.js get-daily-spend`
- Get full stats: `node tools/db/cli.js get-stats`
- Read spend cap: check DAILY_API_SPEND_CAP_USD from the environment or .env file

## Instructions
- When user sends /spend or asks about spending:
  1. Get daily spend from database
  2. Break down by service (anthropic, resend, bland)
  3. Show percentage of daily cap used
  4. Calculate projected monthly cost at current daily rate
  5. Format and respond

- Include spend data in the daily summary (called by deal-alerts skill):
  Total spend today, breakdown by service, projected monthly cost, top spending category

- Budget alerts (check proactively):
  If daily spend exceeds 80% of DAILY_API_SPEND_CAP_USD → alert via Telegram: "⚠️ API spend at [X]% of daily cap ($X.XX / $X.XX)"
  If daily spend exceeds 100% of cap → alert and recommend: "🛑 Daily spend cap exceeded. Pausing non-essential operations."

## Pricing Reference (for cost estimation when logging)
- Anthropic Claude Sonnet: ~$3 per million input tokens, ~$15 per million output tokens
- Resend: first 100 emails/month free, then pay-per-email (check current pricing)
- Bland.ai: pay-per-minute of call time (check current pricing)
- Telegram Bot API: free

## Rules
- Always round cost estimates to 2 decimal places
- Never fabricate cost data — always pull from the api_usage table in the database
- When reporting monthly projections, note that it's an estimate based on current daily average
