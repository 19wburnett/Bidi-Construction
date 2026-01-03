-- Migration: Add optional/option_group fields to bid_line_items
-- Allows marking line items as optional alternatives and grouping related options

-- Add is_optional column to bid_line_items
ALTER TABLE bid_line_items
ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE;

-- Add option_group column to bid_line_items
ALTER TABLE bid_line_items
ADD COLUMN IF NOT EXISTS option_group TEXT;

-- Add index for filtering optional items
CREATE INDEX IF NOT EXISTS idx_bid_line_items_is_optional 
ON bid_line_items(bid_id, is_optional) 
WHERE is_optional = TRUE;

-- Add index for option groups
CREATE INDEX IF NOT EXISTS idx_bid_line_items_option_group 
ON bid_line_items(bid_id, option_group) 
WHERE option_group IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN bid_line_items.is_optional IS 'Whether this line item is an optional/alternative option';
COMMENT ON COLUMN bid_line_items.option_group IS 'Groups related optional items together (e.g., "Option A", "Option B")';
