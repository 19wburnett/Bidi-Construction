-- Migration: Plan Vectorization Queue
-- Created: 2025-01-30
-- Description: Queue table for background plan vectorization jobs

CREATE TABLE IF NOT EXISTS plan_vectorization_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 0, -- Higher number = higher priority
  
  -- Progress tracking
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT,
  pages_processed INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  chunks_created INTEGER DEFAULT 0,
  
  -- Processing timestamps
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results
  error_message TEXT,
  warnings JSONB, -- Array of warning messages
  
  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vectorization_queue_plan_id ON plan_vectorization_queue(plan_id);
CREATE INDEX IF NOT EXISTS idx_vectorization_queue_user_id ON plan_vectorization_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_vectorization_queue_status ON plan_vectorization_queue(status);
CREATE INDEX IF NOT EXISTS idx_vectorization_queue_queued_at ON plan_vectorization_queue(queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_vectorization_queue_priority_status ON plan_vectorization_queue(priority DESC, status, queued_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vectorization_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vectorization_queue_updated_at
  BEFORE UPDATE ON plan_vectorization_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_vectorization_queue_updated_at();

COMMENT ON TABLE plan_vectorization_queue IS 'Queue for background plan vectorization jobs';
COMMENT ON COLUMN plan_vectorization_queue.status IS 'Job status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN plan_vectorization_queue.progress IS 'Progress percentage (0-100)';
COMMENT ON COLUMN plan_vectorization_queue.pages_processed IS 'Number of pages processed so far';
COMMENT ON COLUMN plan_vectorization_queue.total_pages IS 'Total number of pages in the plan';
