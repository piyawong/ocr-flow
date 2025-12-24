-- Migration: Rename organization columns
-- Date: 2025-12-24
-- Description: Swap columns - name↔groupName becomes districtOfficeName↔name

-- Step 1: Rename 'name' to temp column
ALTER TABLE organizations RENAME COLUMN name TO temp_district;

-- Step 2: Rename 'groupName' to 'name'
ALTER TABLE organizations RENAME COLUMN "groupName" TO name;

-- Step 3: Rename temp column to 'districtOfficeName'
ALTER TABLE organizations RENAME COLUMN temp_district TO "districtOfficeName";

-- Step 4: Update unique constraint (name field should be unique, not districtOfficeName)
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS "UQ_6b13fe959542d447c696fb0a057";
ALTER TABLE organizations ADD CONSTRAINT "UQ_organizations_district_office_name" UNIQUE ("districtOfficeName");

-- Final result:
-- Old 'name' (สำนักงานเขต) → 'districtOfficeName' (unique)
-- Old 'groupName' (ชื่อองค์กร) → 'name'
