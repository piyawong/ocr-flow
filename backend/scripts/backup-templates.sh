#!/bin/bash

# ================================================================
# Script: Backup Templates Only
# Date: 2025-12-19
# Usage: ./backend/scripts/backup-templates.sh
# ================================================================

set -e  # Exit on error

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backend/backups"
BACKUP_FILE="${BACKUP_DIR}/templates_${TIMESTAMP}.sql"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "🔄 Backing up templates table..."

# Using Docker
docker exec -i postgres-ocr pg_dump \
  -U postgres \
  -d ocrflow \
  --table=templates \
  --data-only \
  --column-inserts \
  > "$BACKUP_FILE"

echo "✅ Templates backed up to: $BACKUP_FILE"
echo "📊 Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Count records in backup
RECORD_COUNT=$(grep -c "INSERT INTO templates" "$BACKUP_FILE" || echo "0")
echo "📝 Records backed up: $RECORD_COUNT"

echo ""
echo "To restore this backup later, run:"
echo "  psql -h localhost -p 5434 -U postgres -d ocrflow -f $BACKUP_FILE"
