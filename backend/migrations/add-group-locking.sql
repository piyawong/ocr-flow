-- Migration: Add group locking fields
-- Created: 2024-12-23
-- Purpose: Prevent concurrent editing of the same group

ALTER TABLE groups
  ADD COLUMN locked_by INTEGER NULL,
  ADD COLUMN locked_at TIMESTAMP NULL;

-- Add index for faster lookup
CREATE INDEX idx_groups_locked_by ON groups(locked_by);

COMMENT ON COLUMN groups.locked_by IS 'User ID who locked this group for editing';
COMMENT ON COLUMN groups.locked_at IS 'Timestamp when the group was locked';
