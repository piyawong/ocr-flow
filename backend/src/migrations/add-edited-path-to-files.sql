-- Add editedPath and hasEdited columns to files table for Stage 00 drawing/masking
-- Migration: add-edited-path-to-files.sql
-- Date: 2025-12-24

ALTER TABLE files
ADD COLUMN "editedPath" VARCHAR(500) NULL,
ADD COLUMN "hasEdited" BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for faster filtering by hasEdited
CREATE INDEX idx_files_has_edited ON files("hasEdited");

COMMENT ON COLUMN files."editedPath" IS 'Stage 00: Path to edited image (e.g., raw/123_temp.jpeg)';
COMMENT ON COLUMN files."hasEdited" IS 'Stage 00: Whether file has been edited (drawn/masked)';
