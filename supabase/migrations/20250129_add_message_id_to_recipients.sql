-- Migration: Add message_id column to bid_package_recipients
-- This stores the actual Message-ID header from emails for proper threading

ALTER TABLE bid_package_recipients 
ADD COLUMN IF NOT EXISTS message_id TEXT;

-- Add an index for faster lookups by message_id
CREATE INDEX IF NOT EXISTS idx_bid_package_recipients_message_id 
ON bid_package_recipients(message_id) 
WHERE message_id IS NOT NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN bid_package_recipients.message_id IS 'The actual Message-ID header from the email (e.g., <uuid@resend.dev> or Gmail Message-ID). Used for proper email threading via In-Reply-To and References headers.';



