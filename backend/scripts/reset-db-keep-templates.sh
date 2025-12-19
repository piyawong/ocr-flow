#!/bin/bash

# ================================================================
# Script: Reset Database (Keep Templates Only)
# Date: 2025-12-19
# Usage: ./backend/scripts/reset-db-keep-templates.sh
# ================================================================

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Reset Database (Keep Templates Only)                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Backup templates
echo "📦 Step 1: Backing up templates..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backend/backups"
BACKUP_FILE="${BACKUP_DIR}/templates_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

docker exec -i postgres-ocr pg_dump \
  -U postgres \
  -d ocrflow \
  --table=templates \
  --data-only \
  --column-inserts \
  > "$BACKUP_FILE"

RECORD_COUNT=$(grep -c "INSERT INTO templates" "$BACKUP_FILE" || echo "0")
echo "   ✅ Backed up $RECORD_COUNT templates to: $BACKUP_FILE"
echo ""

# Step 2: Flush database
echo "🗑️  Step 2: Flushing all data..."
docker exec -i postgres-ocr psql -U postgres -d ocrflow <<EOF
-- Backup templates to temp table
CREATE TEMP TABLE templates_backup AS SELECT * FROM templates;

-- Disable FK constraints
SET session_replication_role = 'replica';

-- Truncate all tables
TRUNCATE TABLE charter_sub_items CASCADE;
TRUNCATE TABLE charter_articles CASCADE;
TRUNCATE TABLE charter_sections CASCADE;
TRUNCATE TABLE committee_members CASCADE;
TRUNCATE TABLE foundation_instruments CASCADE;
TRUNCATE TABLE labeled_files CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE groups CASCADE;
TRUNCATE TABLE files CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE templates CASCADE;

-- Re-enable FK constraints
SET session_replication_role = 'origin';

-- Restore templates
INSERT INTO templates SELECT * FROM templates_backup;

-- Reset sequence
SELECT setval('templates_id_seq', COALESCE((SELECT MAX(id) FROM templates), 1));

-- Verify
SELECT COUNT(*) FROM templates;
EOF

echo "   ✅ Database flushed successfully"
echo ""

# Step 3: Verify
echo "🔍 Step 3: Verifying..."
docker exec -i postgres-ocr psql -U postgres -d ocrflow -t -c "
SELECT
  'templates: ' || COUNT(*)::text as result
FROM templates
UNION ALL
SELECT 'files: ' || COUNT(*)::text FROM files
UNION ALL
SELECT 'groups: ' || COUNT(*)::text FROM groups
UNION ALL
SELECT 'labeled_files: ' || COUNT(*)::text FROM labeled_files
UNION ALL
SELECT 'documents: ' || COUNT(*)::text FROM documents
UNION ALL
SELECT 'users: ' || COUNT(*)::text FROM users;
"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ Reset Complete!                                            ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  📁 Templates kept: $RECORD_COUNT records                      "
echo "║  🗑️  All other data deleted                                    ║"
echo "║  💾 Backup saved: $BACKUP_FILE         "
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  📝 Next Steps:                                                ║"
echo "║  1. Restart backend: docker-compose restart backend           ║"
echo "║  2. Create admin user: POST /auth/init-admin                  ║"
echo "║  3. Start fresh with upload -> group -> label                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
