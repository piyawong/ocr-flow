-- Migration: Rename district_offices to organizations
-- Date: 2025-12-24
-- Description: Migrate from district management to organization management

-- 1. Rename table
ALTER TABLE district_offices RENAME TO organizations;

-- 2. Rename column: foundationName -> groupName
ALTER TABLE organizations RENAME COLUMN "foundationName" TO "groupName";

-- 3. Add matchedGroupId (FK to groups.id)
ALTER TABLE organizations
ADD COLUMN "matchedGroupId" INTEGER NULL REFERENCES groups(id) ON DELETE SET NULL;

-- 4. Create index for matchedGroupId
CREATE INDEX idx_organizations_matched_group_id ON organizations("matchedGroupId");

-- Note: Existing indexes and constraints will be preserved
-- - Primary key: id
-- - Unique constraint: name
-- - Indexes: isActive, displayOrder
