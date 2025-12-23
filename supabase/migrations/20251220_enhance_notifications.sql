-- Migration: Enhance notifications system for robust bid and email tracking
-- This migration improves the notification system to properly track unseen bids and email events

-- Update the bid notification trigger to only notify for unseen bids
CREATE OR REPLACE FUNCTION create_bid_notification()
RETURNS TRIGGER AS $$
DECLARE
  job_owner_id UUID;
  job_name TEXT;
BEGIN
  -- Get the job owner and name
  SELECT user_id, name INTO job_owner_id, job_name
  FROM jobs
  WHERE id = NEW.job_id;

  -- If we found the owner, create a notification
  -- Only create if bid is not seen (seen = false or NULL)
  IF job_owner_id IS NOT NULL AND (NEW.seen IS NULL OR NEW.seen = false) THEN
    INSERT INTO notifications (user_id, bid_id, job_id, notification_type, title, message, read, dismissed)
    VALUES (
      job_owner_id,
      NEW.id,
      NEW.job_id,
      'bid_received',
      'New Bid Received',
      COALESCE('New bid on ' || job_name, 'You received a new bid'),
      false,
      false
    );
    -- Note: ON CONFLICT not needed here since we're inserting new records
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to auto-create notifications on new bids
DROP TRIGGER IF EXISTS on_bid_created ON bids;
CREATE TRIGGER on_bid_created
  AFTER INSERT ON bids
  FOR EACH ROW
  WHEN (NEW.seen IS NULL OR NEW.seen = false)
  EXECUTE FUNCTION create_bid_notification();

-- Add index for notification_type for better filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_bid_package_id ON notifications(bid_package_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read, dismissed, created_at DESC)
WHERE read = false AND dismissed = false;

