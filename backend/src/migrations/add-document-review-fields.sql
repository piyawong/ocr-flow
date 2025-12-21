-- Migration: Add review fields to documents table
-- Date: 2025-12-21
-- Purpose: Move review tracking from labeled_files to documents

-- Add review fields
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_user_reviewed BOOLEAN DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewer VARCHAR(255) NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_notes TEXT NULL;

-- Create index for filtering reviewed documents
CREATE INDEX IF NOT EXISTS idx_documents_is_user_reviewed ON documents(is_user_reviewed);
