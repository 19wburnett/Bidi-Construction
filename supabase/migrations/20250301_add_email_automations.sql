-- Migration: Email Automation System
-- Creates tables and columns for email automation settings (no-response follow-ups and deadline reminders)

-- 1. Create bid_package_automations table
CREATE TABLE IF NOT EXISTS bid_package_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_package_id UUID NOT NULL REFERENCES bid_packages(id) ON DELETE CASCADE,
  
  -- No-response follow-up settings
  no_response_enabled BOOLEAN DEFAULT TRUE,
  no_response_days INTEGER[] DEFAULT ARRAY[3, 7, 14], -- Days after send to remind
  
  -- Deadline reminder settings  
  deadline_reminder_enabled BOOLEAN DEFAULT TRUE,
  deadline_reminder_days INTEGER[] DEFAULT ARRAY[7, 3, 1], -- Days before deadline to remind
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bid_package_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bid_package_automations_bid_package_id 
  ON bid_package_automations(bid_package_id);

-- Add RLS policies
ALTER TABLE bid_package_automations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view automations for bid packages they own
CREATE POLICY "Users can view automations for their bid packages"
  ON bid_package_automations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bid_packages bp
      JOIN jobs j ON j.id = bp.job_id
      WHERE bp.id = bid_package_automations.bid_package_id
      AND j.user_id = auth.uid()
    )
  );

-- Policy: Users can insert automations for bid packages they own
CREATE POLICY "Users can insert automations for their bid packages"
  ON bid_package_automations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bid_packages bp
      JOIN jobs j ON j.id = bp.job_id
      WHERE bp.id = bid_package_automations.bid_package_id
      AND j.user_id = auth.uid()
    )
  );

-- Policy: Users can update automations for bid packages they own
CREATE POLICY "Users can update automations for their bid packages"
  ON bid_package_automations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bid_packages bp
      JOIN jobs j ON j.id = bp.job_id
      WHERE bp.id = bid_package_automations.bid_package_id
      AND j.user_id = auth.uid()
    )
  );

-- Policy: Users can delete automations for bid packages they own
CREATE POLICY "Users can delete automations for their bid packages"
  ON bid_package_automations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bid_packages bp
      JOIN jobs j ON j.id = bp.job_id
      WHERE bp.id = bid_package_automations.bid_package_id
      AND j.user_id = auth.uid()
    )
  );

-- 2. Add global automation settings to users table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'email_automation_settings') THEN
    ALTER TABLE users
      ADD COLUMN email_automation_settings JSONB DEFAULT '{
        "no_response_enabled": true,
        "no_response_days": [3, 7, 14],
        "deadline_reminder_enabled": true,
        "deadline_reminder_days": [7, 3, 1]
      }'::jsonb;
    RAISE NOTICE 'Added email_automation_settings column to users table';
  END IF;
END $$;

-- 3. Update bid_package_recipients table with deadline reminder tracking
DO $$
BEGIN
  -- Add deadline_reminder_count if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'deadline_reminder_count') THEN
    ALTER TABLE bid_package_recipients 
      ADD COLUMN deadline_reminder_count INTEGER DEFAULT 0;
    RAISE NOTICE 'Added deadline_reminder_count column';
  END IF;

  -- Add last_deadline_reminder_sent_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'last_deadline_reminder_sent_at') THEN
    ALTER TABLE bid_package_recipients 
      ADD COLUMN last_deadline_reminder_sent_at TIMESTAMPTZ;
    RAISE NOTICE 'Added last_deadline_reminder_sent_at column';
  END IF;

  -- Add deadline_reminders_sent array if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'bid_package_recipients' AND column_name = 'deadline_reminders_sent') THEN
    ALTER TABLE bid_package_recipients 
      ADD COLUMN deadline_reminders_sent INTEGER[] DEFAULT ARRAY[]::INTEGER[];
    RAISE NOTICE 'Added deadline_reminders_sent column';
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bid_package_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_bid_package_automations_updated_at ON bid_package_automations;
CREATE TRIGGER trigger_update_bid_package_automations_updated_at
  BEFORE UPDATE ON bid_package_automations
  FOR EACH ROW
  EXECUTE FUNCTION update_bid_package_automations_updated_at();

-- Add comments for documentation
COMMENT ON TABLE bid_package_automations IS 'Stores email automation settings per bid package (overrides global user defaults)';
COMMENT ON COLUMN bid_package_automations.no_response_days IS 'Array of days after initial send to send reminder emails (e.g., [3, 7, 14] means reminders at 3, 7, and 14 days)';
COMMENT ON COLUMN bid_package_automations.deadline_reminder_days IS 'Array of days before deadline to send reminder emails (e.g., [7, 3, 1] means reminders 7, 3, and 1 day before deadline)';
COMMENT ON COLUMN bid_package_recipients.deadline_reminder_count IS 'Total number of deadline reminders sent to this recipient';
COMMENT ON COLUMN bid_package_recipients.deadline_reminders_sent IS 'Array of days-before-deadline values for which reminders have been sent (e.g., [7, 3] means reminders for 7 and 3 days before have been sent)';
