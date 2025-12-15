-- Migration: Add read_by_gc_at column to track when GC reads incoming emails
-- This allows us to show notifications for unread messages from subcontractors

-- Add the column
ALTER TABLE bid_package_recipients 
ADD COLUMN IF NOT EXISTS read_by_gc_at TIMESTAMPTZ;

-- Add a comment explaining the column
COMMENT ON COLUMN bid_package_recipients.read_by_gc_at IS 'Timestamp when the GC (General Contractor) read this email message. NULL means unread. Only relevant for incoming emails (is_from_gc = false).';

-- Create an index for efficient queries of unread emails
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_unread 
ON bid_package_recipients(bid_package_id, is_from_gc, read_by_gc_at) 
WHERE is_from_gc = false AND read_by_gc_at IS NULL;

