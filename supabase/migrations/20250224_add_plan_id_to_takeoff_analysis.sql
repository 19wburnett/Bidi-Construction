-- Migration: Add plan_id back to plan_takeoff_analysis
-- This fixes the issue where we can't tell which plan a takeoff analysis belongs to
-- Created: 2025-02-24
-- 
-- Problem: plan_takeoff_analysis only has job_id, making it unclear which plan(s) 
-- have had takeoff run. This can lead to duplicate or missing takeoffs.
--
-- Solution: Add plan_id back as a required field, keeping job_id for master takeoff aggregation

-- ============================================================================
-- STEP 1: Add plan_id column (nullable initially for migration)
-- ============================================================================

ALTER TABLE plan_takeoff_analysis
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Populate plan_id from takeoff_jobs where possible
-- ============================================================================

-- Match plan_takeoff_analysis records to takeoff_jobs by job_id and created_at proximity
-- This works for takeoffs that went through the orchestrator
UPDATE plan_takeoff_analysis pta
SET plan_id = tj.plan_id
FROM takeoff_jobs tj
WHERE pta.job_id = tj.job_id
  AND pta.plan_id IS NULL
  AND ABS(EXTRACT(EPOCH FROM (pta.created_at - tj.completed_at))) < 3600 -- Within 1 hour
  AND tj.status = 'complete'
  AND tj.plan_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Populate plan_id from plans table for remaining records
-- ============================================================================

-- For records that don't have a matching takeoff_job, try to find the plan
-- that was updated around the same time as the takeoff analysis was created
UPDATE plan_takeoff_analysis pta
SET plan_id = p.id
FROM plans p
WHERE pta.job_id = p.job_id
  AND pta.plan_id IS NULL
  AND p.has_takeoff_analysis = true
  AND p.takeoff_analysis_status = 'completed'
  AND ABS(EXTRACT(EPOCH FROM (pta.created_at - p.updated_at))) < 3600 -- Within 1 hour
  AND (
    -- Prefer plans updated closest to when the analysis was created
    NOT EXISTS (
      SELECT 1 FROM plans p2
      WHERE p2.job_id = pta.job_id
        AND p2.has_takeoff_analysis = true
        AND p2.takeoff_analysis_status = 'completed'
        AND ABS(EXTRACT(EPOCH FROM (pta.created_at - p2.updated_at))) < 
            ABS(EXTRACT(EPOCH FROM (pta.created_at - p.updated_at)))
    )
  );

-- ============================================================================
-- STEP 4: Handle any remaining orphaned records
-- ============================================================================

-- For any remaining records without plan_id, assign to the first plan in the job
-- This is a fallback - ideally all records should have been matched above
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM plan_takeoff_analysis
  WHERE plan_id IS NULL;
  
  IF orphaned_count > 0 THEN
    -- Assign to first plan in each job
    UPDATE plan_takeoff_analysis pta
    SET plan_id = (
      SELECT p.id
      FROM plans p
      WHERE p.job_id = pta.job_id
      ORDER BY p.created_at ASC
      LIMIT 1
    )
    WHERE pta.plan_id IS NULL;
    
    RAISE NOTICE 'Assigned % orphaned takeoff analyses to first plan in their job', orphaned_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Make plan_id NOT NULL
-- ============================================================================

-- First verify all records have plan_id
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM plan_takeoff_analysis
  WHERE plan_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot make plan_id NOT NULL: % records still have NULL plan_id', null_count;
  END IF;
END $$;

-- Now make it NOT NULL
ALTER TABLE plan_takeoff_analysis
ALTER COLUMN plan_id SET NOT NULL;

-- ============================================================================
-- STEP 6: Create indexes for plan_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_takeoff_analysis_plan_id ON plan_takeoff_analysis(plan_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_analysis_plan_version ON plan_takeoff_analysis(plan_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_takeoff_analysis_job_plan ON plan_takeoff_analysis(job_id, plan_id);

-- ============================================================================
-- STEP 7: Update RLS policies to include plan_id checks
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Members can view plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can insert plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can update plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can delete plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Admins can view all plan takeoff analysis" ON plan_takeoff_analysis;

-- Recreate policies with plan_id checks (still check via job_id for access control)
CREATE POLICY "Members can view plan takeoff analysis"
  ON plan_takeoff_analysis FOR SELECT
  USING (
    is_job_member(plan_takeoff_analysis.job_id, auth.uid())
  );

CREATE POLICY "Members can insert plan takeoff analysis"
  ON plan_takeoff_analysis FOR INSERT
  WITH CHECK (
    is_job_member(plan_takeoff_analysis.job_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_takeoff_analysis.plan_id
        AND plans.job_id = plan_takeoff_analysis.job_id
    )
  );

CREATE POLICY "Members can update plan takeoff analysis"
  ON plan_takeoff_analysis FOR UPDATE
  USING (
    is_job_member(plan_takeoff_analysis.job_id, auth.uid())
  )
  WITH CHECK (
    is_job_member(plan_takeoff_analysis.job_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM plans
      WHERE plans.id = plan_takeoff_analysis.plan_id
        AND plans.job_id = plan_takeoff_analysis.job_id
    )
  );

CREATE POLICY "Members can delete plan takeoff analysis"
  ON plan_takeoff_analysis FOR DELETE
  USING (
    is_job_owner(plan_takeoff_analysis.job_id, auth.uid())
  );

-- Admin policy
CREATE POLICY "Admins can view all plan takeoff analysis"
  ON plan_takeoff_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
  );

-- ============================================================================
-- STEP 8: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN plan_takeoff_analysis.plan_id IS 'Plan this takeoff analysis belongs to. Required. Each plan can have multiple takeoff analyses (versions).';
COMMENT ON COLUMN plan_takeoff_analysis.job_id IS 'Job this takeoff analysis belongs to. Required. Used for master takeoff aggregation across all plans in a job.';

-- ============================================================================
-- STEP 9: Create trigger function to validate plan belongs to job
-- ============================================================================

-- Create a function to validate that plan_id's job matches job_id
CREATE OR REPLACE FUNCTION validate_plan_job_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plans
    WHERE plans.id = NEW.plan_id
      AND plans.job_id = NEW.job_id
  ) THEN
    RAISE EXCEPTION 'Plan % does not belong to job %', NEW.plan_id, NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate on insert/update
CREATE TRIGGER plan_takeoff_analysis_plan_job_match_trigger
  BEFORE INSERT OR UPDATE ON plan_takeoff_analysis
  FOR EACH ROW
  EXECUTE FUNCTION validate_plan_job_match();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

