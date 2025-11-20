-- Migration: Job-Centric Database Restructure
-- Makes everything tied to job_id, removes user_id from plans, adds created_by
-- Created: 2025-01-31

-- ============================================================================
-- STEP 1: Create jobs for orphaned plans (plans without job_id)
-- ============================================================================

DO $$
DECLARE
  orphaned_plan RECORD;
  new_job_id UUID;
  plan_user_id UUID;
  job_name TEXT;
  job_counter INTEGER := 1;
BEGIN
  -- Group orphaned plans by user_id and create a job for each user
  FOR orphaned_plan IN 
    SELECT DISTINCT user_id 
    FROM plans 
    WHERE job_id IS NULL AND user_id IS NOT NULL
  LOOP
    plan_user_id := orphaned_plan.user_id;
    
    -- Create a job for this user's orphaned plans
    -- Use a descriptive name based on user's email or a generic name
    SELECT COALESCE(
      (SELECT email FROM users WHERE id = plan_user_id),
      'User ' || SUBSTRING(plan_user_id::text, 1, 8)
    ) INTO job_name;
    
    INSERT INTO jobs (user_id, name, location, status, description)
    VALUES (
      plan_user_id,
      COALESCE(job_name, 'Imported Project') || ' - Orphaned Plans',
      'Unknown',
      'draft',
      'Auto-created job for plans that were not associated with a job'
    )
    RETURNING id INTO new_job_id;
    
    -- Ensure the creator is marked as owner in job_members
    INSERT INTO job_members (job_id, user_id, role)
    VALUES (new_job_id, plan_user_id, 'owner')
    ON CONFLICT (job_id, user_id) DO NOTHING;
    
    -- Assign all orphaned plans for this user to the new job
    UPDATE plans
    SET job_id = new_job_id
    WHERE user_id = plan_user_id AND job_id IS NULL;
    
    RAISE NOTICE 'Created job % for user % with orphaned plans', new_job_id, plan_user_id;
    job_counter := job_counter + 1;
  END LOOP;
  
  RAISE NOTICE 'Completed orphaned plan migration';
END $$;

-- ============================================================================
-- STEP 2: Add created_by column to plans table
-- ============================================================================

-- Add created_by column (nullable, will be set from user_id before removal)
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Set created_by from user_id for all existing plans
UPDATE plans
SET created_by = user_id
WHERE created_by IS NULL AND user_id IS NOT NULL;

-- Create index for created_by
CREATE INDEX IF NOT EXISTS idx_plans_created_by ON plans(created_by);

-- ============================================================================
-- STEP 3: Populate job_id for bids from bid_packages
-- ============================================================================

-- Update bids to have job_id from their bid_package
UPDATE bids b
SET job_id = bp.job_id
FROM bid_packages bp
WHERE b.bid_package_id = bp.id
  AND b.job_id IS NULL;

-- Also handle bids that might have job_request_id pointing to old job_requests
-- If job_requests table has a job_id, use that
UPDATE bids b
SET job_id = jr.job_id
FROM job_requests jr
WHERE b.job_request_id = jr.id
  AND b.job_id IS NULL
  AND jr.job_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Make job_id NOT NULL on plans table
-- ============================================================================

-- First, ensure all plans have a job_id (should be done by step 1, but double-check)
-- Create a default job for any remaining orphaned plans
DO $$
DECLARE
  default_job_id UUID;
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM plans
  WHERE job_id IS NULL;
  
  IF remaining_count > 0 THEN
    -- Create a default job for system/admin
    INSERT INTO jobs (user_id, name, location, status, description)
    VALUES (
      (SELECT id FROM users WHERE is_admin = true LIMIT 1),
      'System - Unassigned Plans',
      'Unknown',
      'archived',
      'Default job for plans that could not be assigned to a user'
    )
    RETURNING id INTO default_job_id;
    
    -- Assign remaining plans to default job
    UPDATE plans
    SET job_id = default_job_id
    WHERE job_id IS NULL;
    
    RAISE NOTICE 'Assigned % remaining plans to default job', remaining_count;
  END IF;
END $$;

-- Now make job_id NOT NULL
ALTER TABLE plans
ALTER COLUMN job_id SET NOT NULL;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'plans_job_id_fkey'
  ) THEN
    ALTER TABLE plans
    ADD CONSTRAINT plans_job_id_fkey 
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Drop all policies that depend on plans.user_id BEFORE dropping column
-- ============================================================================

-- Drop all policies that reference plans.user_id
-- These must be dropped before we can drop the column

-- Plans table policies
DROP POLICY IF EXISTS "Users can view their own plans" ON plans;
DROP POLICY IF EXISTS "Users can insert their own plans" ON plans;
DROP POLICY IF EXISTS "Users can update their own plans" ON plans;
DROP POLICY IF EXISTS "Users can delete their own plans" ON plans;
DROP POLICY IF EXISTS "Members can view plans" ON plans;
DROP POLICY IF EXISTS "Members can insert plans" ON plans;
DROP POLICY IF EXISTS "Members can update plans" ON plans;
DROP POLICY IF EXISTS "Owners can delete plans" ON plans;

-- Plan shares policies
DROP POLICY IF EXISTS "Users can view shares for their plans" ON plan_shares;
DROP POLICY IF EXISTS "Users can create shares for their plans" ON plan_shares;
DROP POLICY IF EXISTS "Users can view their own plan shares" ON plan_shares;
DROP POLICY IF EXISTS "Users can create plan shares for their own plans" ON plan_shares;

-- Plan scale settings policies
DROP POLICY IF EXISTS "Users can view their own plan scale settings" ON plan_scale_settings;
DROP POLICY IF EXISTS "Users can manage their own plan scale settings" ON plan_scale_settings;
DROP POLICY IF EXISTS "Members can view scale settings" ON plan_scale_settings;
DROP POLICY IF EXISTS "Members can manage scale settings" ON plan_scale_settings;

-- Plan drawings policies
DROP POLICY IF EXISTS "Users can view drawings on their plans" ON plan_drawings;
DROP POLICY IF EXISTS "Users can insert drawings on their plans" ON plan_drawings;
DROP POLICY IF EXISTS "Users can view their own plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Users can insert their own plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Users can update their own plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Users can delete their own plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Members can view plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Members can insert plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Members can update plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Members can delete plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Creators can update plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Creators can delete plan drawings" ON plan_drawings;

-- Plan takeoff analysis policies
DROP POLICY IF EXISTS "Users can view takeoff analysis for their plans" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can view plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can insert plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can update plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can delete plan takeoff analysis" ON plan_takeoff_analysis;

-- Plan quality analysis policies
DROP POLICY IF EXISTS "Users can view quality analysis for their plans" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Members can view plan quality analysis" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Members can insert plan quality analysis" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Members can update plan quality analysis" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Members can delete plan quality analysis" ON plan_quality_analysis;

-- Plan comments policies
DROP POLICY IF EXISTS "Users can view comments on their plans" ON plan_comments;
DROP POLICY IF EXISTS "Members can view plan comments" ON plan_comments;
DROP POLICY IF EXISTS "Members can insert plan comments" ON plan_comments;
DROP POLICY IF EXISTS "Members can update plan comments" ON plan_comments;
DROP POLICY IF EXISTS "Members can delete plan comments" ON plan_comments;
DROP POLICY IF EXISTS "Creators can update plan comments" ON plan_comments;
DROP POLICY IF EXISTS "Creators can delete plan comments" ON plan_comments;

-- ============================================================================
-- STEP 6: Remove user_id column from plans table
-- ============================================================================

-- Drop any indexes that depend on user_id
DROP INDEX IF EXISTS idx_plans_user_id;

-- Drop the user_id column (now safe since all dependent policies are dropped)
ALTER TABLE plans DROP COLUMN IF EXISTS user_id;

-- ============================================================================
-- STEP 6A: Remove job_request_id from bids table (legacy field)
-- ============================================================================

ALTER TABLE bids DROP COLUMN IF EXISTS job_request_id;

-- ============================================================================
-- STEP 7: Recreate RLS policies for plans table (using job_id)
-- ============================================================================

-- Policies were already dropped in step 5, now recreate them with job-based logic

-- Create new policies that use job_id → jobs.user_id via job_members
CREATE POLICY "Members can view plans"
  ON plans FOR SELECT
  USING (
    is_job_member(plans.job_id, auth.uid())
  );

CREATE POLICY "Members can insert plans"
  ON plans FOR INSERT
  WITH CHECK (
    is_job_member(plans.job_id, auth.uid())
  );

CREATE POLICY "Owners can update plans"
  ON plans FOR UPDATE
  USING (
    is_job_owner(plans.job_id, auth.uid())
  )
  WITH CHECK (
    is_job_owner(plans.job_id, auth.uid())
  );

CREATE POLICY "Owners can delete plans"
  ON plans FOR DELETE
  USING (
    is_job_owner(plans.job_id, auth.uid())
  );

-- Keep admin policy (already exists, but ensure it's there)
DROP POLICY IF EXISTS "Admins can view all plans" ON plans;
CREATE POLICY "Admins can view all plans"
  ON plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
  );

-- ============================================================================
-- STEP 8: Recreate plan_shares RLS policies (using job_id)
-- ============================================================================

-- Policies were already dropped in step 5, now recreate them with job-based logic

-- Create new policies using job_id
CREATE POLICY "Users can view shares for their plans"
  ON plan_shares FOR SELECT
  USING (
    plan_id IN (
      SELECT id FROM plans WHERE is_job_member(plans.job_id, auth.uid())
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create shares for their plans"
  ON plan_shares FOR INSERT
  WITH CHECK (
    plan_id IN (
      SELECT id FROM plans WHERE is_job_member(plans.job_id, auth.uid())
    )
    AND created_by = auth.uid()
  );

-- ============================================================================
-- STEP 9: Recreate plan_drawings RLS policies (using job_id)
-- ============================================================================

-- Policies were already dropped in step 5, now recreate them with job-based logic

-- Create new policies using job_id
CREATE POLICY "Members can view plan drawings"
  ON plan_drawings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_drawings.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can insert plan drawings"
  ON plan_drawings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_drawings.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can update plan drawings"
  ON plan_drawings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_drawings.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Members can delete plan drawings"
  ON plan_drawings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_drawings.plan_id 
        AND is_job_owner(plans.job_id, auth.uid())
    )
    OR user_id = auth.uid()
  );

-- ============================================================================
-- STEP 10: Recreate other plan-related table policies (using job_id)
-- ============================================================================

-- Plan comments (policies were already dropped in step 5)

CREATE POLICY "Members can view plan comments"
  ON plan_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_comments.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can insert plan comments"
  ON plan_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_comments.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can update plan comments"
  ON plan_comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_comments.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Members can delete plan comments"
  ON plan_comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_comments.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
    OR user_id = auth.uid()
  );

-- Plan takeoff analysis (policies were already dropped in step 5)
CREATE POLICY "Members can view plan takeoff analysis"
  ON plan_takeoff_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_takeoff_analysis.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can insert plan takeoff analysis"
  ON plan_takeoff_analysis FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_takeoff_analysis.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can update plan takeoff analysis"
  ON plan_takeoff_analysis FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_takeoff_analysis.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

-- Plan quality analysis (policies were already dropped in step 5)
CREATE POLICY "Members can view plan quality analysis"
  ON plan_quality_analysis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_quality_analysis.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can insert plan quality analysis"
  ON plan_quality_analysis FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_quality_analysis.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can update plan quality analysis"
  ON plan_quality_analysis FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_quality_analysis.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

-- ============================================================================
-- STEP 11: Recreate plan_scale_settings policies (using job_id)
-- ============================================================================

-- Policies were already dropped in step 5, now recreate them
CREATE POLICY "Members can view plan scale settings"
  ON plan_scale_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_scale_settings.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

CREATE POLICY "Members can manage plan scale settings"
  ON plan_scale_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_scale_settings.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_scale_settings.plan_id 
        AND is_job_member(plans.job_id, auth.uid())
    )
  );

-- ============================================================================
-- STEP 12: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN plans.created_by IS 'User who created the plan (for tracking). Ownership is determined via job_id → jobs.user_id';
COMMENT ON COLUMN plans.job_id IS 'Job this plan belongs to. Required. Ownership determined via jobs.user_id';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

