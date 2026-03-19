---
name: reply-handler
description: Handles incoming email replies from outreach contacts. Analyzes replies with AI and sends Telegram notifications. Manages email blocklist for spam complaints.
metadata:
  openclaw:
    requires:
      bins: ["node"]
      env: ["ANTHROPIC_API_KEY", "TELEGRAM_BOT_TOKEN"]
---

# Reply Handler

## Description
Processes incoming email replies to outreach messages. Automatically analyzes reply sentiment and content, updates outreach records, and alerts the operator via Telegram.

## Tools
- Webhook server is part of the dashboard (runs automatically)
- Check outreach log: `node tools/db/cli.js get-stats`
- View blocklist: `cat config/email-blocklist.json`

## Instructions
This skill is passive — it runs via the webhook endpoint on the dashboard server. No manual invocation needed.

When a reply comes in:
1. The webhook handler automatically processes it
2. Analyzes the reply content with AI
3. Updates the outreach_log in the database
4. Sends a Telegram notification

If the operator asks "any replies?" or "check outreach responses":
1. Query outreach_log for entries with status = "replied"
2. Report them with the AI analysis summaries

## Rules
- Always check API spend before running AI analysis on replies
- If a reply is marked as spam, immediately add to blocklist
- Never re-email someone on the blocklist
- Keep reply analysis concise — max 2 API calls per reply
