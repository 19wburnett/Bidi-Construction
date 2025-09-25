-- Add dismissed state to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed BOOLEAN DEFAULT FALSE;

-- Create index for efficient queries on dismissed status
CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(dismissed);

-- Update the function to handle dismissed notifications
CREATE OR REPLACE FUNCTION create_bid_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the job owner (GC) from the job request
  INSERT INTO notifications (user_id, bid_id, read, dismissed)
  SELECT 
    jr.gc_id,
    NEW.id,
    FALSE,
    FALSE
  FROM job_requests jr
  WHERE jr.id = NEW.job_request_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to handle dismissed notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- Add a policy specifically for non-dismissed notifications
CREATE POLICY "Users can view non-dismissed notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id AND dismissed = FALSE);
