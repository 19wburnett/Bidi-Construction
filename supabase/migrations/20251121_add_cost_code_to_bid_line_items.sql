-- Add cost_code column to bid_line_items
ALTER TABLE bid_line_items ADD COLUMN IF NOT EXISTS cost_code TEXT;

-- Add comment
COMMENT ON COLUMN bid_line_items.cost_code IS 'Standard construction cost code (e.g. 03-3000)';

