-- Migration: Add is_from_gc column to bid_package_recipients
-- This column explicitly tracks whether an email message was sent by the GC (true) or received from a subcontractor (false)
-- This eliminates fragile inference logic based on resend_email_id, status, and responded_at

-- Add the column with a default value
ALTER TABLE bid_package_recipients 
ADD COLUMN IF NOT EXISTS is_from_gc BOOLEAN NOT NULL DEFAULT false;

-- Add a comment explaining the column
COMMENT ON COLUMN bid_package_recipients.is_from_gc IS 'Indicates whether this email message was sent by the GC (true) or received from a subcontractor (false). Explicitly set to avoid inference logic issues.';

-- Backfill existing data based on current inference logic
-- GC messages: have resend_email_id, status = 'sent', and no responded_at
UPDATE bid_package_recipients
SET is_from_gc = true
WHERE resend_email_id IS NOT NULL 
  AND status = 'sent' 
  AND responded_at IS NULL;

-- All other records are subcontractor responses (already defaulted to false, but being explicit)
UPDATE bid_package_recipients
SET is_from_gc = false
WHERE is_from_gc IS NULL OR (
  resend_email_id IS NULL 
  OR status != 'sent' 
  OR responded_at IS NOT NULL
);

-- Create an index for common queries filtering by sender type
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_is_from_gc 
ON bid_package_recipients(is_from_gc);

-- Create a composite index for thread queries with sender type
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_thread_sender 
ON bid_package_recipients(thread_id, is_from_gc, created_at);













