-- ================================================================
-- Script: Backup Templates -> Flush DB -> Restore Templates
-- Date: 2025-12-19
-- Purpose: Reset database while keeping templates
-- ================================================================

-- ================================================================
-- STEP 1: Backup templates to temporary table
-- ================================================================

-- Create temporary table to store templates
CREATE TEMP TABLE templates_backup AS
SELECT * FROM templates;

-- Verify backup
SELECT COUNT(*) as backup_count FROM templates_backup;

-- ================================================================
-- STEP 2: Flush all data from all tables (except templates_backup)
-- ================================================================

-- Disable foreign key constraints temporarily
SET session_replication_role = 'replica';

-- Truncate all tables (fast, keeps structure)
TRUNCATE TABLE charter_sub_items CASCADE;
TRUNCATE TABLE charter_articles CASCADE;
TRUNCATE TABLE charter_sections CASCADE;
TRUNCATE TABLE committee_members CASCADE;
TRUNCATE TABLE foundation_instruments CASCADE;
TRUNCATE TABLE labeled_files CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE groups CASCADE;
TRUNCATE TABLE files CASCADE;
TRUNCATE TABLE users CASCADE;
-- Note: templates will be flushed but restored from backup

-- Re-enable foreign key constraints
SET session_replication_role = 'origin';

-- ================================================================
-- STEP 3: Restore templates from backup
-- ================================================================

-- Clear current templates table
TRUNCATE TABLE templates CASCADE;

-- Restore templates from backup
INSERT INTO templates
SELECT * FROM templates_backup;

-- Reset sequence for templates.id
SELECT setval('templates_id_seq', (SELECT MAX(id) FROM templates));

-- Verify restoration
SELECT COUNT(*) as restored_count FROM templates;

-- ================================================================
-- STEP 4: Verification
-- ================================================================

SELECT
  'templates' as table_name,
  COUNT(*) as record_count,
  'Should match backup_count' as note
FROM templates
UNION ALL
SELECT
  'files' as table_name,
  COUNT(*) as record_count,
  'Should be 0' as note
FROM files
UNION ALL
SELECT
  'groups' as table_name,
  COUNT(*) as record_count,
  'Should be 0' as note
FROM groups
UNION ALL
SELECT
  'labeled_files' as table_name,
  COUNT(*) as record_count,
  'Should be 0' as note
FROM labeled_files
UNION ALL
SELECT
  'documents' as table_name,
  COUNT(*) as record_count,
  'Should be 0' as note
FROM documents
UNION ALL
SELECT
  'foundation_instruments' as table_name,
  COUNT(*) as record_count,
  'Should be 0' as note
FROM foundation_instruments
UNION ALL
SELECT
  'committee_members' as table_name,
  COUNT(*) as record_count,
  'Should be 0' as note
FROM committee_members
UNION ALL
SELECT
  'users' as table_name,
  COUNT(*) as record_count,
  'Should be 0 (need to recreate admin)' as note
FROM users;

-- ================================================================
-- SUCCESS MESSAGE
-- ================================================================

SELECT
  'Database flushed successfully!' as status,
  (SELECT COUNT(*) FROM templates) as templates_kept,
  'Run POST /auth/init-admin to create admin user' as next_step;

-- ================================================================
-- NOTES
-- ================================================================
-- 1. Templates are preserved
-- 2. All other data is deleted
-- 3. You need to recreate admin user: POST /auth/init-admin
-- 4. MinIO files are NOT deleted (still exist in storage)
-- 5. To delete MinIO files, use MinIO console or mc command
-- ================================================================
