---
name: deal-alerts
description: Send Pokemon card deal alerts and notifications via Telegram. Use when new deals are found, for daily summaries, error notifications, or responding to user commands via Telegram.
metadata:
  openclaw:
    requires:
      bins: ["node"]
      env: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
---

# Deal Alerts (Telegram)

## Description
Sends formatted deal alerts, daily summaries, and error notifications to Telegram. Also provides a bot listener for user commands.

## Tools
- Send deal alert: `node tools/telegram-client/telegram-cli.js send-deal '<listing JSON>'`
- Send summary: `node tools/telegram-client/telegram-cli.js send-summary '<stats JSON>'`
- Send message: `node tools/telegram-client/telegram-cli.js send-message "text"`
- Send error: `node tools/telegram-client/telegram-cli.js send-error "error text"`
- Start listener: `node tools/telegram-client/telegram-cli.js listen`
- Get unalerted deals: `node tools/db/cli.js get-unalerted-deals <minDiscountPercent>`
- Mark as alerted: `node tools/db/cli.js mark-alerted '[id1,id2,id3]'`
- Get stats: `node tools/db/cli.js get-stats`

## Instructions
When new deals are ready to alert:
1. Get unalerted deals from database above minDiscountPercent threshold
2. For each deal, send a Telegram alert using send-deal
3. Mark each deal as alerted in the database after sending
4. If more than 15 deals in one batch, send a count summary instead of individual alerts to avoid spam

For daily summary (run at dailySummaryHour from config):
1. Get stats from database
2. Get daily spend
3. Format and send summary via Telegram

## Rules
- Never send more than 15 individual alerts in one batch (summarize extras instead)
- Always mark deals as alerted after sending to prevent re-sending
- Rate limit: max 1 message per second
- If Telegram API fails, log the error and retry once, then skip
