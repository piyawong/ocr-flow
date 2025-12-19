-- ================================================================
-- Migration: Add documents table and migrate existing data
-- Date: 2025-12-19
-- Purpose: Add document_date field with proper normalization
-- ================================================================

-- Step 1: Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  "groupId" INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  "documentNumber" INTEGER NOT NULL,
  "templateName" VARCHAR(255) NULL,
  category VARCHAR(255) NULL,
  "documentDate" DATE NULL,
  "pageCount" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("groupId", "documentNumber")
);

-- Step 2: Add indexes for performance
CREATE INDEX idx_documents_group_id ON documents("groupId");
CREATE INDEX idx_documents_document_number ON documents("documentNumber");

-- Step 3: Add new column to labeled_files
ALTER TABLE labeled_files
ADD COLUMN IF NOT EXISTS "documentTableId" INTEGER NULL REFERENCES documents(id) ON DELETE CASCADE;

-- Step 4: Create index on documentTableId
CREATE INDEX idx_labeled_files_document_table_id ON labeled_files("documentTableId");

-- Step 5: Migrate existing data from labeled_files to documents
-- This creates one document record for each unique (groupId, documentId, templateName)
INSERT INTO documents ("groupId", "documentNumber", "templateName", category, "pageCount", "createdAt")
SELECT
  "groupId",
  "documentId" as "documentNumber",
  "templateName",
  category,
  COUNT(*) as "pageCount",
  MIN("createdAt") as "createdAt"
FROM labeled_files
WHERE "documentId" IS NOT NULL
  AND "templateName" IS NOT NULL
  AND "labelStatus" != 'unmatched'
GROUP BY "groupId", "documentId", "templateName", category
ORDER BY "groupId", "documentId";

-- Step 6: Update labeled_files.documentTableId to reference documents
UPDATE labeled_files lf
SET "documentTableId" = d.id
FROM documents d
WHERE lf."groupId" = d."groupId"
  AND lf."documentId" = d."documentNumber"
  AND lf."templateName" = d."templateName"
  AND lf."documentId" IS NOT NULL
  AND lf."templateName" IS NOT NULL;

-- Step 7: Update documents.pageCount (make sure it's accurate)
UPDATE documents d
SET "pageCount" = (
  SELECT COUNT(*)
  FROM labeled_files lf
  WHERE lf."documentTableId" = d.id
);

-- ================================================================
-- Rollback script (run if needed to revert changes)
-- ================================================================
--
-- -- Remove foreign key constraint
-- ALTER TABLE labeled_files DROP COLUMN IF EXISTS "documentTableId";
--
-- -- Drop documents table
-- DROP TABLE IF EXISTS documents CASCADE;
--
-- ================================================================

-- ================================================================
-- Verification queries (run after migration to verify data)
-- ================================================================
--
-- -- Check document counts
-- SELECT
--   'labeled_files' as table_name,
--   COUNT(*) as total_records,
--   COUNT(DISTINCT "groupId") as total_groups,
--   COUNT(DISTINCT "documentId") as total_documents
-- FROM labeled_files
-- WHERE "documentId" IS NOT NULL
-- UNION ALL
-- SELECT
--   'documents' as table_name,
--   COUNT(*) as total_records,
--   COUNT(DISTINCT "groupId") as total_groups,
--   COUNT(DISTINCT "documentNumber") as total_documents
-- FROM documents;
--
-- -- Check that all labeled_files have documentTableId set
-- SELECT
--   COUNT(*) as files_with_documentId,
--   COUNT("documentTableId") as files_with_documentTableId,
--   COUNT(*) - COUNT("documentTableId") as missing_documentTableId
-- FROM labeled_files
-- WHERE "documentId" IS NOT NULL AND "templateName" IS NOT NULL;
--
-- -- Check documents with their page counts
-- SELECT
--   d."groupId",
--   d."documentNumber",
--   d."templateName",
--   d."pageCount",
--   COUNT(lf.id) as actual_page_count,
--   d."documentDate"
-- FROM documents d
-- LEFT JOIN labeled_files lf ON lf."documentTableId" = d.id
-- GROUP BY d.id
-- ORDER BY d."groupId", d."documentNumber";
--
-- ================================================================
