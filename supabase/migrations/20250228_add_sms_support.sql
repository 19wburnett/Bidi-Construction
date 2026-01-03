-- Migration: Add SMS Support to Bid Package Recipients
-- Adds SMS fields to bid_package_recipients table for Telnyx integration

DO $$
BEGIN
  -- Add phone number field if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'subcontractor_phone') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN subcontractor_phone TEXT;
  END IF;

  -- Add SMS message ID (from Telnyx)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'telnyx_message_id') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN telnyx_message_id TEXT;
  END IF;

  -- Add SMS status (separate from email status)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'sms_status') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN sms_status TEXT 
      CHECK (sms_status IN ('pending', 'sent', 'delivered', 'failed', 'received', NULL));
  END IF;

  -- Add SMS sent timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'sms_sent_at') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN sms_sent_at TIMESTAMPTZ;
  END IF;

  -- Add SMS delivered timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'sms_delivered_at') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN sms_delivered_at TIMESTAMPTZ;
  END IF;

  -- Add SMS response text (for inbound SMS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'sms_response_text') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN sms_response_text TEXT;
  END IF;

  -- Add SMS received timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'sms_received_at') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN sms_received_at TIMESTAMPTZ;
  END IF;

  -- Add delivery channel preference (email, sms, or both)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'delivery_channel') THEN
    ALTER TABLE bid_package_recipients ADD COLUMN delivery_channel TEXT 
      DEFAULT 'email' CHECK (delivery_channel IN ('email', 'sms', 'both'));
  END IF;

  -- Create index on telnyx_message_id for webhook lookups
  IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                 WHERE indexname = 'idx_bid_package_recipients_telnyx_message_id') THEN
    CREATE INDEX idx_bid_package_recipients_telnyx_message_id 
      ON bid_package_recipients(telnyx_message_id) 
      WHERE telnyx_message_id IS NOT NULL;
  END IF;

  -- Create index on subcontractor_phone for lookups
  IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                 WHERE indexname = 'idx_bid_package_recipients_phone') THEN
    CREATE INDEX idx_bid_package_recipients_phone 
      ON bid_package_recipients(subcontractor_phone) 
      WHERE subcontractor_phone IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN bid_package_recipients.subcontractor_phone IS 'Phone number for SMS delivery';
COMMENT ON COLUMN bid_package_recipients.telnyx_message_id IS 'Telnyx message ID for tracking SMS status';
COMMENT ON COLUMN bid_package_recipients.sms_status IS 'SMS delivery status: pending, sent, delivered, failed, received';
COMMENT ON COLUMN bid_package_recipients.delivery_channel IS 'Preferred delivery method: email, sms, or both';
