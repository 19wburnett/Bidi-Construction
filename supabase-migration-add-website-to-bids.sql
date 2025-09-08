-- Migration: Add website field to bids table
-- Run this in your Supabase SQL editor

-- Add website column to bids table
ALTER TABLE bids ADD COLUMN IF NOT EXISTS website TEXT;

-- Add index for website field
CREATE INDEX IF NOT EXISTS idx_bids_website ON bids(website);

-- Add comment to document the field
COMMENT ON COLUMN bids.website IS 'Website URL of the subcontractor who submitted the bid';
