---
name: system-health
description: Monitor agent health (disk, memory, uptime), manage circuit breakers, run data pruning, and respond to /health Telegram command.
metadata:
  openclaw:
    requires:
      bins: ["node"]
---

# System Health

## Description
Monitors the agent's operational health and manages system resilience features including circuit breakers, data pruning, and log rotation.

## Tools
- Health check: `node -e "const h = require('./tools/maintenance/healthCheck'); const db = require('./tools/db/database').init(); console.log(JSON.stringify(h.getHealthReport(db), null, 2)); db.close()"`
- Data pruning: `node tools/maintenance/dataPruner.js`
- Circuit status: `node -e "const cb = require('./tools/utils/circuitBreaker'); console.log(JSON.stringify(cb.getAllStatus(), null, 2))"`

## Instructions
Run health check every 30 minutes (alongside scrape cycle). Alert via Telegram if:
- Disk space < 1GB free
- Memory usage > 512MB
- Database > 500MB
- Log file > 100MB
- No new listings in 2+ hours (scrapers may be blocked)
- Any circuit breaker is OPEN

Run data pruning weekly (Sunday 4am):
1. Delete listings older than 90 days (except purchased/reviewing/approved)
2. Aggregate price history older than 180 days into weekly averages
3. Delete API usage records older than 90 days
4. Delete completed automation tasks older than 30 days
5. Clean up export files older than 30 days

## Rules
- Never delete purchased listings regardless of age
- If disk is critically low (<500MB), halt scraping immediately
- Log all pruning actions for audit trail
- Circuit breakers auto-recover — don't manually reset unless asked
