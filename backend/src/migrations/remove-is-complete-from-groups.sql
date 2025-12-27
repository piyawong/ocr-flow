-- Migration: Remove isComplete and completedAt from groups table
-- Reason: New BOOKMARK-based grouping creates groups as complete atomically
-- Date: 2025-12-26

-- Remove columns that are no longer needed
ALTER TABLE groups
  DROP COLUMN IF EXISTS "isComplete",
  DROP COLUMN IF EXISTS "completedAt";

-- Note: Groups are now created as complete (atomic operation)
-- No more "grouping in progress" state
