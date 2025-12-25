-- Add isReviewed and reviewedAt columns to files table for Stage 00 review tracking
-- Migration: add-is-reviewed-to-files.sql
-- Date: 2025-12-24

ALTER TABLE files
ADD COLUMN "isReviewed" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN "reviewedAt" TIMESTAMP NULL;

-- Create index for faster filtering by isReviewed
CREATE INDEX idx_files_is_reviewed ON files("isReviewed");

COMMENT ON COLUMN files."isReviewed" IS 'Stage 00: Mark if file has been reviewed (relevant/not relevant)';
COMMENT ON COLUMN files."reviewedAt" IS 'Stage 00: Timestamp when file was reviewed';
