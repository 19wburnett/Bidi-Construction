-- Migration: AI Takeoff Request Queue
-- Created: 2025-01-03
-- Description: Queue table for AI takeoff requests from non-admin users

CREATE TABLE IF NOT EXISTS ai_takeoff_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Request details
  task_type TEXT NOT NULL DEFAULT 'takeoff' CHECK (task_type IN ('takeoff', 'quality', 'bid_analysis')),
  job_type TEXT CHECK (job_type IN ('residential', 'commercial')),
  images_count INTEGER DEFAULT 0,
  request_data JSONB, -- Store full request data for processing later
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 0, -- Higher number = higher priority
  
  -- Admin assignment
  assigned_to_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- Processing timestamps
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results
  takeoff_analysis_id UUID REFERENCES plan_takeoff_analysis(id) ON DELETE SET NULL,
  quality_analysis_id UUID REFERENCES plan_quality_analysis(id) ON DELETE SET NULL,
  error_message TEXT,
  
  -- User notification
  user_notified_at TIMESTAMPTZ,
  admin_notified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_takeoff_queue_plan_id ON ai_takeoff_queue(plan_id);
CREATE INDEX IF NOT EXISTS idx_ai_takeoff_queue_user_id ON ai_takeoff_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_takeoff_queue_status ON ai_takeoff_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_takeoff_queue_queued_at ON ai_takeoff_queue(queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_takeoff_queue_priority_status ON ai_takeoff_queue(priority DESC, status, queued_at);

-- RLS Policies
ALTER TABLE ai_takeoff_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue requests
CREATE POLICY "Users can view their own queue requests"
  ON ai_takeoff_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own queue requests
CREATE POLICY "Users can insert their own queue requests"
  ON ai_takeoff_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all queue requests
CREATE POLICY "Admins can view all queue requests"
  ON ai_takeoff_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Admins can update all queue requests
CREATE POLICY "Admins can update all queue requests"
  ON ai_takeoff_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_takeoff_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_takeoff_queue_updated_at
  BEFORE UPDATE ON ai_takeoff_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_takeoff_queue_updated_at();

-- Add comment
COMMENT ON TABLE ai_takeoff_queue IS 'Queue for AI takeoff requests from non-admin users. Admins process these manually.';

