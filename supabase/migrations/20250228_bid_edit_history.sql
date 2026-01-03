-- Migration: Create bid_edit_history table for audit trail
-- Tracks all changes to bids with full history

-- Create bid_edit_history table
CREATE TABLE IF NOT EXISTS bid_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  field_name TEXT NOT NULL, -- e.g., 'bid_amount', 'timeline', 'notes', 'line_item'
  old_value JSONB, -- Previous value (can be null for new items)
  new_value JSONB, -- New value (can be null for deleted items)
  change_type TEXT NOT NULL CHECK (change_type IN ('field_update', 'line_item_add', 'line_item_update', 'line_item_delete')),
  notes TEXT, -- Optional reason for edit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_bid_edit_history_bid_id 
ON bid_edit_history(bid_id);

CREATE INDEX IF NOT EXISTS idx_bid_edit_history_edited_at 
ON bid_edit_history(edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_bid_edit_history_edited_by 
ON bid_edit_history(edited_by);

CREATE INDEX IF NOT EXISTS idx_bid_edit_history_field_name 
ON bid_edit_history(bid_id, field_name);

-- Add comments for documentation
COMMENT ON TABLE bid_edit_history IS 'Audit trail of all changes made to bids';
COMMENT ON COLUMN bid_edit_history.field_name IS 'Name of the field that was changed (e.g., bid_amount, timeline, notes, line_item)';
COMMENT ON COLUMN bid_edit_history.old_value IS 'Previous value before the change (JSONB for flexibility)';
COMMENT ON COLUMN bid_edit_history.new_value IS 'New value after the change (JSONB for flexibility)';
COMMENT ON COLUMN bid_edit_history.change_type IS 'Type of change: field_update, line_item_add, line_item_update, or line_item_delete';
COMMENT ON COLUMN bid_edit_history.notes IS 'Optional reason or notes about why the change was made';
