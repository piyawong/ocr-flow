-- Migration: Add context_rules column to templates table
-- Date: 2025-12-15

ALTER TABLE templates ADD COLUMN IF NOT EXISTS context_rules JSONB NULL;

-- Example context_rules structure:
-- {
--   "requirePreviousCategory": "เอกสารจัดตั้งมูลนิธิ",
--   "blockPreviousCategory": "เอกสารเปลี่ยนแปลงมูลนิธิ"
-- }
