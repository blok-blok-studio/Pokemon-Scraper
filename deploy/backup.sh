#!/bin/bash

BACKUP_DIR="data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/agent_$TIMESTAMP.db"

# Create backup directory if needed
mkdir -p "$BACKUP_DIR"

# Copy database
if [ -f "data/agent.db" ]; then
    cp data/agent.db "$BACKUP_FILE"
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Backup created: $BACKUP_FILE ($SIZE)"

    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/agent_*.db 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null
    REMAINING=$(ls "$BACKUP_DIR"/agent_*.db 2>/dev/null | wc -l)
    echo "  Backups retained: $REMAINING"
else
    echo "✗ No database found at data/agent.db"
fi
