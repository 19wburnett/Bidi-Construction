-- Migration: Make plan_takeoff_analysis tied to job_id only
-- Removes plan_id and user_id, ties directly to job_id
-- Created: 2025-02-23

-- ============================================================================
-- STEP 1: Add job_id column to plan_takeoff_analysis
-- ============================================================================

ALTER TABLE plan_takeoff_analysis
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Populate job_id from related plans
-- ============================================================================

UPDATE plan_takeoff_analysis pta
SET job_id = p.job_id
FROM plans p
WHERE pta.plan_id = p.id
  AND pta.job_id IS NULL;

-- ============================================================================
-- STEP 3: Handle any orphaned records (shouldn't happen, but safety check)
-- ============================================================================

-- Create a default job for any orphaned takeoff analyses
DO $$
DECLARE
  default_job_id UUID;
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM plan_takeoff_analysis
  WHERE job_id IS NULL;
  
  IF orphaned_count > 0 THEN
    -- Get or create a default job
    SELECT id INTO default_job_id
    FROM jobs
    WHERE name = 'System - Orphaned Takeoff Analyses'
    LIMIT 1;
    
    IF default_job_id IS NULL THEN
      INSERT INTO jobs (user_id, name, location, status, description)
      VALUES (
        (SELECT id FROM users WHERE is_admin = true LIMIT 1),
        'System - Orphaned Takeoff Analyses',
        'Unknown',
        'archived',
        'Default job for takeoff analyses that could not be assigned to a job'
      )
      RETURNING id INTO default_job_id;
    END IF;
    
    -- Assign orphaned analyses to default job
    UPDATE plan_takeoff_analysis
    SET job_id = default_job_id
    WHERE job_id IS NULL;
    
    RAISE NOTICE 'Assigned % orphaned takeoff analyses to default job', orphaned_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Make job_id NOT NULL
-- ============================================================================

ALTER TABLE plan_takeoff_analysis
ALTER COLUMN job_id SET NOT NULL;

-- ============================================================================
-- STEP 5: Drop indexes that depend on plan_id and user_id
-- ============================================================================

DROP INDEX IF EXISTS idx_takeoff_analysis_plan_id;
DROP INDEX IF EXISTS idx_takeoff_analysis_version;

-- ============================================================================
-- STEP 6: Drop ALL RLS policies that depend on plan_id or user_id
-- ============================================================================

-- Drop all known policies
DROP POLICY IF EXISTS "Members can view plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can insert plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can update plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can delete plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Users can view takeoff analysis for their plans" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Users can insert takeoff analysis for their plans" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Users can update their own takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Users can delete their own takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Users can access their own takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Admins can view all plan takeoff analysis" ON plan_takeoff_analysis;

-- Drop any remaining policies that might reference user_id or plan_id
-- This catches any policies we might have missed
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'plan_takeoff_analysis'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON plan_takeoff_analysis', pol.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 7: Drop foreign key constraints on plan_id and user_id
-- ============================================================================

-- Drop foreign key constraint on plan_id
ALTER TABLE plan_takeoff_analysis
DROP CONSTRAINT IF EXISTS plan_takeoff_analysis_plan_id_fkey;

-- Drop foreign key constraint on user_id
ALTER TABLE plan_takeoff_analysis
DROP CONSTRAINT IF EXISTS plan_takeoff_analysis_user_id_fkey;

-- ============================================================================
-- STEP 8: Remove plan_id and user_id columns
-- ============================================================================

ALTER TABLE plan_takeoff_analysis
DROP COLUMN IF EXISTS plan_id;

ALTER TABLE plan_takeoff_analysis
DROP COLUMN IF EXISTS user_id;

-- ============================================================================
-- STEP 9: Create new indexes for job_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_takeoff_analysis_job_id ON plan_takeoff_analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_analysis_job_version ON plan_takeoff_analysis(job_id, version DESC);

-- ============================================================================
-- STEP 10: Recreate RLS policies using job_id
-- ============================================================================

CREATE POLICY "Members can view plan takeoff analysis"
  ON plan_takeoff_analysis FOR SELECT
  USING (
    is_job_member(plan_takeoff_analysis.job_id, auth.uid())
  );

CREATE POLICY "Members can insert plan takeoff analysis"
  ON plan_takeoff_analysis FOR INSERT
  WITH CHECK (
    is_job_member(plan_takeoff_analysis.job_id, auth.uid())
  );

CREATE POLICY "Members can update plan takeoff analysis"
  ON plan_takeoff_analysis FOR UPDATE
  USING (
    is_job_member(plan_takeoff_analysis.job_id, auth.uid())
  )
  WITH CHECK (
    is_job_member(plan_takeoff_analysis.job_id, auth.uid())
  );

CREATE POLICY "Members can delete plan takeoff analysis"
  ON plan_takeoff_analysis FOR DELETE
  USING (
    is_job_owner(plan_takeoff_analysis.job_id, auth.uid())
  );

-- Admin policy
DROP POLICY IF EXISTS "Admins can view all plan takeoff analysis" ON plan_takeoff_analysis;
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
-- STEP 11: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN plan_takeoff_analysis.job_id IS 'Job this takeoff analysis belongs to. Required. Replaces plan_id and user_id.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

