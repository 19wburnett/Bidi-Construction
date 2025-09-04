-- Add seen status to bids table
ALTER TABLE bids ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT FALSE;

-- Create index for efficient queries on seen status
CREATE INDEX IF NOT EXISTS idx_bids_seen ON bids(seen);
CREATE INDEX IF NOT EXISTS idx_bids_job_request_seen ON bids(job_request_id, seen);

-- Update the notifications table to use the correct structure
-- First, let's make sure the notifications table has the right structure
ALTER TABLE notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE notifications ALTER COLUMN updated_at SET DEFAULT NOW();

-- Create function to automatically create notification when bid is inserted
CREATE OR REPLACE FUNCTION create_bid_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the job owner (GC) from the job request
  INSERT INTO notifications (user_id, bid_id)
  SELECT 
    jr.gc_id,
    NEW.id
  FROM job_requests jr
  WHERE jr.id = NEW.job_request_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create notifications
DROP TRIGGER IF EXISTS trigger_create_bid_notification ON bids;
CREATE TRIGGER trigger_create_bid_notification
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION create_bid_notification();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_update_notifications_updated_at ON notifications;
CREATE TRIGGER trigger_update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security) if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to update their own notifications
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow system to insert notifications
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Create function to mark bid as seen when notification is read
CREATE OR REPLACE FUNCTION mark_bid_as_seen()
RETURNS TRIGGER AS $$
BEGIN
  -- When notification is marked as read, also mark the bid as seen
  IF NEW.read = true AND OLD.read = false THEN
    UPDATE bids 
    SET seen = true 
    WHERE id = NEW.bid_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to mark bid as seen when notification is read
DROP TRIGGER IF EXISTS trigger_mark_bid_as_seen ON notifications;
CREATE TRIGGER trigger_mark_bid_as_seen
  AFTER UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION mark_bid_as_seen();
