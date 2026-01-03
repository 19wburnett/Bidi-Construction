-- Migration: Add edit tracking fields to bids table
-- Tracks whether a bid has been manually edited and by whom

-- Add is_manually_edited flag
ALTER TABLE bids
ADD COLUMN IF NOT EXISTS is_manually_edited BOOLEAN DEFAULT FALSE;

-- Add edited_by field (references users table)
ALTER TABLE bids
ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add edited_at timestamp
ALTER TABLE bids
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Add index for filtering edited bids
CREATE INDEX IF NOT EXISTS idx_bids_is_manually_edited 
ON bids(is_manually_edited) 
WHERE is_manually_edited = TRUE;

-- Add index for edited_by lookups
CREATE INDEX IF NOT EXISTS idx_bids_edited_by 
ON bids(edited_by) 
WHERE edited_by IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN bids.is_manually_edited IS 'Whether this bid has been manually edited by a user';
COMMENT ON COLUMN bids.edited_by IS 'User ID of the person who last edited this bid';
COMMENT ON COLUMN bids.edited_at IS 'Timestamp when the bid was last edited';
