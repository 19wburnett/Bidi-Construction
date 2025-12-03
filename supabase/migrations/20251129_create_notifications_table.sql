-- Migration: Add missing columns to notifications table and create bid trigger
-- The notifications table already exists, this migration just enhances it

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add title column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notifications' AND column_name = 'title') THEN
    ALTER TABLE notifications ADD COLUMN title TEXT;
  END IF;

  -- Add message column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notifications' AND column_name = 'message') THEN
    ALTER TABLE notifications ADD COLUMN message TEXT;
  END IF;

  -- Add job_id column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'notifications' AND column_name = 'job_id') THEN
    ALTER TABLE notifications ADD COLUMN job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_bid_id ON notifications(bid_id);
CREATE INDEX IF NOT EXISTS idx_notifications_job_id ON notifications(job_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(dismissed);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Create function to automatically create notification when a bid is received
CREATE OR REPLACE FUNCTION create_bid_notification()
RETURNS TRIGGER AS $$
DECLARE
  job_owner_id UUID;
BEGIN
  -- Get the job owner
  SELECT user_id INTO job_owner_id
  FROM jobs
  WHERE id = NEW.job_id;

  -- If we found the owner, create a notification
  IF job_owner_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, bid_id, job_id, notification_type, title, message)
    VALUES (
      job_owner_id,
      NEW.id,
      NEW.job_id,
      'bid_received',
      'New Bid Received',
      'You received a new bid'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create notifications on new bids (drop first if exists)
DROP TRIGGER IF EXISTS on_bid_created ON bids;
CREATE TRIGGER on_bid_created
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION create_bid_notification();
