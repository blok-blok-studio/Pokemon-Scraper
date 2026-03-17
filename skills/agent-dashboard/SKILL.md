---
name: agent-dashboard
description: Start and manage the Bootstrap web dashboard for monitoring the Pokemon card agent. Shows deals, outreach, watchlist, and API spending on a local web page.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# Agent Dashboard

## Description
Local Bootstrap web dashboard served by Express for monitoring agent activity, deals found, outreach status, and API spending.

## Tools
- Start dashboard: `node tools/dashboard/dashboard-cli.js start --background`
- Check dashboard status: `node tools/dashboard/dashboard-cli.js status`

## Instructions
- Start the dashboard when the agent first boots up
- Dashboard runs on localhost only at the port configured in AGENT_PORT from .env (default 3847)
- If user asks "show dashboard", "open dashboard", or "where's the dashboard": respond with the URL http://localhost:<port>
- If the dashboard process dies or becomes unresponsive, restart it
- Dashboard is view-only — all changes to watchlist, settings, etc. go through Telegram commands or config files

## Rules
- Dashboard binds to localhost/loopback only — never expose to public internet
- No authentication required since it's on isolated hardware on a private network
- If someone asks about adding auth, suggest using a reverse proxy with basic auth
