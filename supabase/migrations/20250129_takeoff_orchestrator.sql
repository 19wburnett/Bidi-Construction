-- Migration: Takeoff Orchestrator Schema
-- Created: 2025-01-29
-- Description: Database schema for scalable, resumable PDF takeoff processing

-- ============================================================================
-- TAKEOFF_JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS takeoff_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL, -- Links to jobs table
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configuration
  pdf_ref TEXT NOT NULL, -- Supabase storage path or signed URL
  model_policy JSONB NOT NULL DEFAULT '{"primary": "gpt-4o", "fallbacks": [], "max_tokens": 4096, "temperature": 0.2}'::jsonb,
  batch_config JSONB NOT NULL DEFAULT '{"batch_size": 5, "concurrency": 3, "max_retries": 3, "timeout_s": 120}'::jsonb,
  pages JSONB, -- {start: 1, end: 180} optional sub-range
  mode TEXT NOT NULL DEFAULT 'both' CHECK (mode IN ('takeoff', 'quality_analysis', 'both')),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'partial', 'complete', 'failed')),
  progress_percent INTEGER DEFAULT 0,
  total_pages INTEGER,
  total_batches INTEGER,
  completed_batches INTEGER DEFAULT 0,
  
  -- Results
  final_result JSONB, -- Merged final payload
  errors JSONB DEFAULT '[]'::jsonb, -- Array of error objects
  metrics JSONB, -- {total_cost: 0.50, total_tokens: 150000, total_time_ms: 1800000}
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TAKEOFF_BATCHES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS takeoff_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES takeoff_jobs(id) ON DELETE CASCADE,
  batch_index INTEGER NOT NULL, -- 0, 1, 2, 3... (sequential)
  
  -- Page range
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  
  -- Results
  result_jsonb JSONB, -- {items: [...], quality_analysis: {...}}
  metrics JSONB, -- {tokens: 5000, cost: 0.02, latency_ms: 30000, provider: "openai", worker_id: 1, attempt: 1}
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  UNIQUE(job_id, batch_index) -- Prevent duplicate batches
);

-- ============================================================================
-- PROVIDER_RATE_LIMITS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_rate_limits (
  provider TEXT PRIMARY KEY, -- 'openai', 'claude', 'gemini', 'xai'
  requests_per_minute INTEGER DEFAULT 60,
  tokens_per_minute INTEGER DEFAULT 100000,
  last_429_at TIMESTAMPTZ,
  backoff_until TIMESTAMPTZ,
  current_requests INTEGER DEFAULT 0,
  current_tokens INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  consecutive_429s INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_takeoff_jobs_job_id ON takeoff_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_jobs_plan_id ON takeoff_jobs(plan_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_jobs_user_id ON takeoff_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_jobs_status ON takeoff_jobs(status);
CREATE INDEX IF NOT EXISTS idx_takeoff_jobs_created_at ON takeoff_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_takeoff_batches_job_id ON takeoff_batches(job_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_batches_job_status ON takeoff_batches(job_id, status, batch_index);
CREATE INDEX IF NOT EXISTS idx_takeoff_batches_job_index ON takeoff_batches(job_id, batch_index);
CREATE INDEX IF NOT EXISTS idx_takeoff_batches_pending ON takeoff_batches(job_id, status) WHERE status = 'pending';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to atomically claim next pending batch (prevents race conditions)
CREATE OR REPLACE FUNCTION claim_next_batch(p_job_id UUID)
RETURNS TABLE (
  id UUID,
  batch_index INTEGER,
  page_start INTEGER,
  page_end INTEGER,
  status TEXT
) AS $$
DECLARE
  v_batch RECORD;
BEGIN
  -- Find next pending batch and lock it (SKIP LOCKED prevents race conditions)
  SELECT * INTO v_batch
  FROM takeoff_batches
  WHERE job_id = p_job_id
    AND status = 'pending'
  ORDER BY batch_index ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED; -- Skip batches already locked by other workers
  
  IF v_batch IS NULL THEN
    RETURN; -- No batches available
  END IF;
  
  -- Update status to processing (atomic)
  UPDATE takeoff_batches
  SET status = 'processing',
      started_at = NOW()
  WHERE id = v_batch.id;
  
  -- Return the batch
  RETURN QUERY
  SELECT v_batch.id, v_batch.batch_index, v_batch.page_start, v_batch.page_end, 'processing'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER update_takeoff_jobs_updated_at 
  BEFORE UPDATE ON takeoff_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_rate_limits_updated_at 
  BEFORE UPDATE ON provider_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE takeoff_jobs IS 'Main job tracking for takeoff orchestration';
COMMENT ON TABLE takeoff_batches IS 'Individual batch tracking for parallel processing';
COMMENT ON TABLE provider_rate_limits IS 'Provider rate limit tracking for backpressure';
COMMENT ON FUNCTION claim_next_batch IS 'Atomically claims next pending batch to prevent race conditions';





