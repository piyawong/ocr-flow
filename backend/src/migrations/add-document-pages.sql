-- Migration: Add startPage and endPage columns to documents table
-- Date: 2025-12-21
-- Purpose: Support document-based labeling (document range instead of page-by-page)

-- Add columns
ALTER TABLE documents ADD COLUMN IF NOT EXISTS start_page INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS end_page INTEGER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_documents_pages ON documents(group_id, start_page, end_page);

-- Note: No data migration needed - fresh start (flush old data except templates)
