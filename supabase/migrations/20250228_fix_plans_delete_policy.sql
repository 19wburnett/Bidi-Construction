-- Migration: Fix plans delete policy to allow creators to delete their own plans
-- Created: 2025-02-28
-- Description: Updates the delete policy to allow both job owners and plan creators to delete plans

-- Drop the existing delete policy
DROP POLICY IF EXISTS "Owners can delete plans" ON plans;

-- Recreate the policy to allow both job owners and plan creators
CREATE POLICY "Owners can delete plans"
  ON plans FOR DELETE
  USING (
    is_job_owner(plans.job_id, auth.uid())
    OR plans.created_by = auth.uid()
  );

COMMENT ON POLICY "Owners can delete plans" ON plans IS 'Allows job owners to delete any plan in their jobs, or users to delete plans they created.';
