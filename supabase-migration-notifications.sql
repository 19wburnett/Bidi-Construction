-- Create notifications table to track read/unread status
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

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

-- Enable RLS (Row Level Security)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy to allow users to update their own notifications
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to allow system to insert notifications
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);
