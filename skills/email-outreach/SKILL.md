---
name: email-outreach
description: Send personalized outreach emails to card shops, pawn shops, and sellers to ask about Pokemon card inventory. Uses Resend for email delivery and AI for personalization. Call during the daily outreach cycle.
metadata:
  openclaw:
    requires:
      bins: ["node"]
      env: ["RESEND_API_KEY", "ANTHROPIC_API_KEY"]
    primaryEnv: "RESEND_API_KEY"
---

# Email Outreach

## Description
AI-personalized email outreach to card shops, pawn shops, Facebook Marketplace sellers, and online sellers. Asks about Pokemon card inventory based on our current watchlist.

## Tools
- Generate email (dry run): `node tools/resend-client/email-cli.js generate '<target JSON>'`
- Send email: `node tools/resend-client/email-cli.js send '<target JSON>'`
- Check stats: `node tools/resend-client/email-cli.js stats`
- Check outreach history: `node tools/db/cli.js get-outreach-history '<email>' <days>`
- Get watchlist: `cat config/watchlist.json`
- Check daily spend: `node tools/db/cli.js get-daily-spend`
- Get config: `cat config/config.json`

## Instructions
For the daily outreach cycle:
1. Load contacts from config/contacts.json
2. Check daily API spend — skip entire cycle if over budget
3. Check email stats — skip if at maxDailyEmails limit from config
4. For each contact that has an email address:
   a. Check outreach history — skip if contacted within emailCooldownDays from config
   b. Generate the email using the generate command first to verify content
   c. Send the email using the send command
   d. Send a Telegram notification: "Emailed [name] at [email]"
5. Report summary: emails sent today, emails skipped (with reasons: cooldown or limit)

## Rules
- NEVER exceed maxDailyEmails from config
- NEVER contact the same email address within emailCooldownDays
- ALWAYS include CAN-SPAM unsubscribe language in the email footer
- ALWAYS log every send attempt to outreach_log via the database
- ALWAYS track API costs for both Anthropic (generation) and Resend (sending)
- Keep emails under 150 words — friendly and casual, not corporate
