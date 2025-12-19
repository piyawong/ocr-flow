# Database Migrations

## How to Run Migration

### Prerequisites
- PostgreSQL database running
- psql CLI installed or database tool (pgAdmin, DBeaver, etc.)

### Run Migration

**Using psql:**
```bash
psql -h localhost -p 5434 -U postgres -d ocrflow -f backend/migrations/add-documents-table.sql
```

**Using Docker:**
```bash
docker exec -i postgres-ocr psql -U postgres -d ocrflow < backend/migrations/add-documents-table.sql
```

**Using pgAdmin or DBeaver:**
1. Open the SQL file `add-documents-table.sql`
2. Copy and paste the content
3. Execute the script

### Verify Migration

Run these queries to verify the migration succeeded:

```sql
-- Check table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'documents';

-- Check document counts
SELECT
  'labeled_files' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT "groupId") as total_groups,
  COUNT(DISTINCT "documentId") as total_documents
FROM labeled_files
WHERE "documentId" IS NOT NULL
UNION ALL
SELECT
  'documents' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT "groupId") as total_groups,
  COUNT(DISTINCT "documentNumber") as total_documents
FROM documents;

-- Check that all labeled_files have documentTableId set
SELECT
  COUNT(*) as files_with_documentId,
  COUNT("documentTableId") as files_with_documentTableId,
  COUNT(*) - COUNT("documentTableId") as missing_documentTableId
FROM labeled_files
WHERE "documentId" IS NOT NULL AND "templateName" IS NOT NULL;
```

### Rollback (if needed)

If something goes wrong, you can rollback by running:

```sql
ALTER TABLE labeled_files DROP COLUMN IF EXISTS "documentTableId";
DROP TABLE IF EXISTS documents CASCADE;
```

## Migration Details

### What This Migration Does

1. **Creates `documents` table** - Normalized storage for document metadata
2. **Adds `documentTableId` column** to `labeled_files` - References documents table
3. **Migrates existing data** - Creates document records from labeled_files
4. **Links labeled_files to documents** - Updates foreign keys

### Schema Changes

**New Table: `documents`**
- `id` (PK)
- `groupId` (FK to groups)
- `documentNumber` (1, 2, 3 per group)
- `templateName`
- `category`
- `documentDate` (NEW! - date field)
- `pageCount`
- `createdAt`, `updatedAt`

**Updated Table: `labeled_files`**
- Added: `documentTableId` (FK to documents)
- Kept: `documentId` (deprecated, for backward compatibility)
