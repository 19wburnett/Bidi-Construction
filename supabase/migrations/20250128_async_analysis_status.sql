-- Add status tracking to analysis tables for async processing
-- This migration adds status tracking columns to support async analysis endpoints

-- Add status tracking to plan_takeoff_analysis
ALTER TABLE plan_takeoff_analysis 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS job_type TEXT; -- commercial or residential

-- Add status tracking to plan_quality_analysis
ALTER TABLE plan_quality_analysis
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS job_type TEXT;

-- Add indexes for status queries
CREATE INDEX IF NOT EXISTS idx_takeoff_analysis_status ON plan_takeoff_analysis(status, created_at);
CREATE INDEX IF NOT EXISTS idx_quality_analysis_status ON plan_quality_analysis(status, created_at);

-- Add comments for documentation
COMMENT ON COLUMN plan_takeoff_analysis.status IS 'Analysis status: pending, processing, completed, failed';
COMMENT ON COLUMN plan_takeoff_analysis.job_type IS 'Job type used for analysis: commercial or residential';
COMMENT ON COLUMN plan_quality_analysis.status IS 'Analysis status: pending, processing, completed, failed';
COMMENT ON COLUMN plan_quality_analysis.job_type IS 'Job type used for analysis: commercial or residential';
