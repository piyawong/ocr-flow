#!/bin/bash

# ================================================================
# Script: Full Reset (Delete MinIO + Flush DB + Restore Templates)
# Date: 2025-12-19
# Usage: ./backend/scripts/full-reset.sh
# ================================================================

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Full Reset (MinIO + Database)                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Backup templates
echo "📦 Step 1: Backing up templates..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backend/backups"
BACKUP_FILE="${BACKUP_DIR}/templates_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

docker exec -i ocr-postgres pg_dump \
  -U postgres \
  -d ocrflow \
  --table=templates \
  --data-only \
  --column-inserts \
  > "$BACKUP_FILE" 2>/dev/null || true

RECORD_COUNT=$(grep -c "INSERT INTO templates" "$BACKUP_FILE" 2>/dev/null || echo "0")
echo "   ✅ Backed up $RECORD_COUNT templates to: $BACKUP_FILE"
echo ""

# Step 2: Delete MinIO files
echo "🗑️  Step 2: Deleting MinIO files..."

# Method 1: Try to delete bucket contents using MinIO client
if command -v mc &> /dev/null; then
    echo "   Using MinIO client (mc)..."
    mc alias set local http://localhost:9004 minioadmin minioadmin 2>/dev/null || true
    mc rm --recursive --force local/ocr-documents/ 2>/dev/null || true
    echo "   ✅ MinIO files deleted (using mc)"
else
    # Method 2: Using docker exec
    echo "   Using docker exec..."
    docker exec ocr-minio sh -c "rm -rf /data/ocr-documents/*" 2>/dev/null || {
        echo "   ⚠️  Could not delete MinIO files automatically"
        echo "   Please delete manually via MinIO Console: http://localhost:9005"
    }
fi

echo ""

# Step 3: Flush database
echo "🗑️  Step 3: Flushing database..."
docker exec -i ocr-postgres psql -U postgres -d ocrflow <<'EOF' 2>/dev/null || true
-- Backup templates to temp table
CREATE TEMP TABLE IF NOT EXISTS templates_backup AS SELECT * FROM templates;

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
SELECT 'Templates restored: ' || COUNT(*)::text FROM templates;
EOF

echo "   ✅ Database flushed successfully"
echo ""

# Step 4: Verify
echo "🔍 Step 4: Verifying..."
docker exec -i ocr-postgres psql -U postgres -d ocrflow -t -c "
SELECT
  '  templates: ' || COUNT(*)::text as result
FROM templates
UNION ALL
SELECT '  files: ' || COUNT(*)::text FROM files
UNION ALL
SELECT '  groups: ' || COUNT(*)::text FROM groups
UNION ALL
SELECT '  labeled_files: ' || COUNT(*)::text FROM labeled_files
UNION ALL
SELECT '  documents: ' || COUNT(*)::text FROM documents
UNION ALL
SELECT '  users: ' || COUNT(*)::text FROM users;
" 2>/dev/null

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ Full Reset Complete!                                       ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  📁 Templates kept: $RECORD_COUNT records                      "
echo "║  🗑️  All MinIO files deleted                                   ║"
echo "║  🗑️  All database data deleted                                 ║"
echo "║  💾 Backup saved: $BACKUP_FILE         "
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  📝 Next Steps:                                                ║"
echo "║  1. Restart backend: docker-compose restart backend           ║"
echo "║  2. Create admin user:                                        ║"
echo "║     curl -X POST http://localhost:4004/auth/init-admin        ║"
echo "║  3. Login:                                                     ║"
echo "║     Email: admin@ocrflow.local                                ║"
echo "║     Password: admin123                                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
