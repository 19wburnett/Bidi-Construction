-- Migration: Fix plans RLS policies to remove reference to non-existent user_id column
-- Created: 2025-02-28
-- Description: The plans table no longer has a user_id column (it was removed in job_centric_restructure),
--              but the RLS policies still reference it. This fixes all policies to only check job membership.

-- Drop all policies that reference plans.user_id
DROP POLICY IF EXISTS "Members can view plans" ON plans;
DROP POLICY IF EXISTS "Members can insert plans" ON plans;
DROP POLICY IF EXISTS "Members can update plans" ON plans;
DROP POLICY IF EXISTS "Owners can delete plans" ON plans;

-- Recreate policies without the user_id check
-- Plans are now accessed via job membership, and created_by is just for tracking

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

CREATE POLICY "Members can update plans"
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
    OR plans.created_by = auth.uid()
  );

COMMENT ON POLICY "Members can view plans" ON plans IS 'Allows job members to view plans in their jobs.';
COMMENT ON POLICY "Members can insert plans" ON plans IS 'Allows job members to insert plans into their jobs. Plans must have a valid job_id.';
COMMENT ON POLICY "Members can update plans" ON plans IS 'Allows job owners to update plans in their jobs.';
COMMENT ON POLICY "Owners can delete plans" ON plans IS 'Allows job owners to delete any plan in their jobs, or users to delete plans they created.';
