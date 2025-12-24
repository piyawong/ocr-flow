-- Add is_cancelled column to foundation_instruments table
-- This field indicates whether the foundation/association has been cancelled/dissolved

ALTER TABLE foundation_instruments
ADD COLUMN is_cancelled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN foundation_instruments.is_cancelled IS 'Indicates if the foundation or association has been cancelled/dissolved';
