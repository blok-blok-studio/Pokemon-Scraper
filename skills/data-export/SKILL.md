---
name: data-export
description: Export deals, outreach, and price history to CSV files. Generate deal reports. Responds to /export and /report Telegram commands.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# Data Export

## Description
Exports agent data to CSV files for external review. Generates summary reports.

## Tools
- Export deals: `node tools/export/export-cli.js deals --min-discount <N> --days <N>`
- Export outreach: `node tools/export/export-cli.js outreach --days <N>`
- Export prices: `node tools/export/export-cli.js prices "<card>" --days <N>`
- Generate report: `node tools/export/export-cli.js report --days <N>`

## Instructions
When user asks to export data or sends /export:
1. Run the appropriate export command
2. Send the file via Telegram as a document attachment
3. Include a brief summary of what was exported

For weekly reports (optional cron):
1. Generate a 7-day report every Monday at 9am
2. Send via Telegram

## Rules
- CSV files go in data/exports/ (gitignored)
- Clean up exports older than 30 days to save disk space
- If the export has zero rows, say so instead of sending an empty file
