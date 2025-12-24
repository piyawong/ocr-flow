-- Migration: Add type field to organizations
-- Date: 2025-12-24
-- Description: Add organization type field ("สมาคม" | "มูลนิธิ")

-- Add type column (required field)
ALTER TABLE organizations
ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'มูลนิธิ';

-- Note: Default value is 'มูลนิธิ' for existing records
-- Valid values: 'สมาคม' or 'มูลนิธิ'
