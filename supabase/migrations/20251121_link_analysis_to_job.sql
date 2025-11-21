-- Migration: specific_analysis_to_job_level
-- Description: Move plan_quality_analysis and plan_takeoff_analysis to be job-level entities

-- 1. Update plan_quality_analysis table
ALTER TABLE plan_quality_analysis 
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;

-- Backfill job_id from plans for quality analysis
UPDATE plan_quality_analysis pqa
SET job_id = p.job_id
FROM plans p
WHERE pqa.plan_id = p.id
AND pqa.job_id IS NULL;

-- Make plan_id nullable in plan_quality_analysis
ALTER TABLE plan_quality_analysis ALTER COLUMN plan_id DROP NOT NULL;

-- 2. Update plan_takeoff_analysis table
-- (It already has job_id per schema, but we need to ensure plan_id is nullable)
ALTER TABLE plan_takeoff_analysis ALTER COLUMN plan_id DROP NOT NULL;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_quality_analysis_job_id ON plan_quality_analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_plan_takeoff_analysis_job_id ON plan_takeoff_analysis(job_id);

