#!/bin/bash
set -e

echo "Updating Pokemon Card Agent..."

# Pull latest from GitHub
git pull origin main

# Install any new dependencies
npm install

# Restart OpenClaw gateway
if command -v openclaw &> /dev/null; then
    openclaw gateway restart
    echo "✓ OpenClaw gateway restarted"
fi

# Send Telegram notification
node tools/telegram-client/telegram-cli.js send-message "🔄 Agent updated to latest version from GitHub" 2>/dev/null || true

echo "✓ Update complete"
