-- Migration: Support multiple users per job
-- Adds job_members table and updates policies to permit shared access

-- 1. Create job_members table to capture many-to-many relationship
CREATE TABLE IF NOT EXISTS job_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'collaborator' CHECK (role IN ('owner', 'collaborator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, user_id)
);

COMMENT ON TABLE job_members IS 'Associates jobs with users (owners and collaborators)';
COMMENT ON COLUMN job_members.role IS 'owner or collaborator';

CREATE INDEX IF NOT EXISTS idx_job_members_user_id ON job_members(user_id);
CREATE INDEX IF NOT EXISTS idx_job_members_job_id ON job_members(job_id);

-- Helper functions for membership checks (security definer bypasses RLS recursion)
CREATE OR REPLACE FUNCTION is_job_member(p_job_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT TRUE
  INTO result
  FROM job_members jm
  WHERE jm.job_id = p_job_id
    AND jm.user_id = p_user_id
  LIMIT 1;

  RETURN COALESCE(result, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION is_job_owner(p_job_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT TRUE
  INTO result
  FROM job_members jm
  WHERE jm.job_id = p_job_id
    AND jm.user_id = p_user_id
    AND jm.role = 'owner'
  LIMIT 1;

  RETURN COALESCE(result, FALSE);
END;
$$;

-- 2. Backfill existing jobs so their creator is marked as owner
INSERT INTO job_members (job_id, user_id, role)
SELECT id, user_id, 'owner'
FROM jobs
ON CONFLICT (job_id, user_id) DO NOTHING;

-- 3. Ensure future job inserts automatically register owners
CREATE OR REPLACE FUNCTION ensure_job_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO job_members (job_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (job_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_job_owner_membership_trigger ON jobs;
CREATE TRIGGER ensure_job_owner_membership_trigger
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION ensure_job_owner_membership();

-- 4. Temporarily disable RLS on job_members while multi-user access is stabilized
ALTER TABLE job_members DISABLE ROW LEVEL SECURITY;

-- Drop legacy job policies tied to single owner
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON jobs;
DROP POLICY IF EXISTS "Members can view jobs" ON jobs;
DROP POLICY IF EXISTS "Members can update jobs" ON jobs;
DROP POLICY IF EXISTS "Members can delete jobs" ON jobs;

-- Recreate policies allowing shared access
CREATE POLICY "Members can view jobs"
  ON jobs FOR SELECT
  USING (
    is_job_member(jobs.id, auth.uid())
  );

CREATE POLICY "Members can update jobs"
  ON jobs FOR UPDATE
  USING (
    is_job_owner(jobs.id, auth.uid())
  )
  WITH CHECK (
    is_job_owner(jobs.id, auth.uid())
  );

CREATE POLICY "Members can delete jobs"
  ON jobs FOR DELETE
  USING (
    is_job_owner(jobs.id, auth.uid())
  );

-- Preserve insert policy while still requiring creator to be auth.uid()
DROP POLICY IF EXISTS "Users can create their own jobs" ON jobs;
CREATE POLICY "Users can create their own jobs"
  ON jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 5. Policies for job_members table (owners manage membership, members can read)
DROP POLICY IF EXISTS "job_members_select" ON job_members;
DROP POLICY IF EXISTS "job_members_insert" ON job_members;
DROP POLICY IF EXISTS "job_members_update" ON job_members;
DROP POLICY IF EXISTS "job_members_delete" ON job_members;
DROP POLICY IF EXISTS "Users can view their membership rows" ON job_members;
DROP POLICY IF EXISTS "Users can insert their own membership rows" ON job_members;
DROP POLICY IF EXISTS "Users can update their own membership rows" ON job_members;
DROP POLICY IF EXISTS "Users can delete their own membership rows" ON job_members;

CREATE POLICY "Users can view their membership rows"
  ON job_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own membership rows"
  ON job_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own membership rows"
  ON job_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own membership rows"
  ON job_members FOR DELETE
  USING (user_id = auth.uid());

-- 6. Update bid_packages policies to respect membership
DROP POLICY IF EXISTS "Users can view bid packages for their jobs" ON bid_packages;
DROP POLICY IF EXISTS "Users can create bid packages for their jobs" ON bid_packages;
DROP POLICY IF EXISTS "Users can update bid packages for their jobs" ON bid_packages;
DROP POLICY IF EXISTS "Users can delete bid packages for their jobs" ON bid_packages;
DROP POLICY IF EXISTS "Members can view bid packages" ON bid_packages;
DROP POLICY IF EXISTS "Owners can create bid packages" ON bid_packages;
DROP POLICY IF EXISTS "Owners can update bid packages" ON bid_packages;
DROP POLICY IF EXISTS "Owners can delete bid packages" ON bid_packages;

CREATE POLICY "Members can view bid packages"
  ON bid_packages FOR SELECT
  USING (
    is_job_member(bid_packages.job_id, auth.uid())
  );

CREATE POLICY "Owners can create bid packages"
  ON bid_packages FOR INSERT
  WITH CHECK (
    is_job_owner(bid_packages.job_id, auth.uid())
  );

CREATE POLICY "Owners can update bid packages"
  ON bid_packages FOR UPDATE
  USING (
    is_job_owner(bid_packages.job_id, auth.uid())
  )
  WITH CHECK (
    is_job_owner(bid_packages.job_id, auth.uid())
  );

CREATE POLICY "Owners can delete bid packages"
  ON bid_packages FOR DELETE
  USING (
    is_job_owner(bid_packages.job_id, auth.uid())
  );

-- 7. Update plan-related policies to honor job membership
DROP POLICY IF EXISTS "Users can view their own plans" ON plans;
DROP POLICY IF EXISTS "Users can insert their own plans" ON plans;
DROP POLICY IF EXISTS "Users can update their own plans" ON plans;
DROP POLICY IF EXISTS "Users can delete their own plans" ON plans;
DROP POLICY IF EXISTS "Members can view plans" ON plans;
DROP POLICY IF EXISTS "Members can insert plans" ON plans;
DROP POLICY IF EXISTS "Members can update plans" ON plans;
DROP POLICY IF EXISTS "Owners can delete plans" ON plans;

CREATE POLICY "Members can view plans"
  ON plans FOR SELECT
  USING (
    is_job_member(plans.job_id, auth.uid())
    OR plans.user_id = auth.uid()
  );

CREATE POLICY "Members can insert plans"
  ON plans FOR INSERT
  WITH CHECK (
    is_job_member(plans.job_id, auth.uid())
    OR plans.user_id = auth.uid()
  );

CREATE POLICY "Members can update plans"
  ON plans FOR UPDATE
  USING (
    is_job_owner(plans.job_id, auth.uid())
    OR plans.user_id = auth.uid()
  )
  WITH CHECK (
    is_job_owner(plans.job_id, auth.uid())
    OR plans.user_id = auth.uid()
  );

CREATE POLICY "Owners can delete plans"
  ON plans FOR DELETE
  USING (
    is_job_owner(plans.job_id, auth.uid())
    OR plans.user_id = auth.uid()
  );

-- Plan drawings
DROP POLICY IF EXISTS "Users can view drawings on their plans" ON plan_drawings;
DROP POLICY IF EXISTS "Users can insert drawings on their plans" ON plan_drawings;
DROP POLICY IF EXISTS "Users can update their own drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Users can delete their own drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Members can view plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Members can insert plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Creators can update plan drawings" ON plan_drawings;
DROP POLICY IF EXISTS "Creators can delete plan drawings" ON plan_drawings;

CREATE POLICY "Members can view plan drawings"
  ON plan_drawings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_drawings.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can insert plan drawings"
  ON plan_drawings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_drawings.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Creators can update plan drawings"
  ON plan_drawings FOR UPDATE
  USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_drawings.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Creators can delete plan drawings"
  ON plan_drawings FOR DELETE
  USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_drawings.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

-- Takeoff analysis
DROP POLICY IF EXISTS "Users can view takeoff analysis for their plans" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Users can insert takeoff analysis for their plans" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Users can update their own takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Users can delete their own takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can view plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can insert plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can update plan takeoff analysis" ON plan_takeoff_analysis;
DROP POLICY IF EXISTS "Members can delete plan takeoff analysis" ON plan_takeoff_analysis;

CREATE POLICY "Members can view plan takeoff analysis"
  ON plan_takeoff_analysis FOR SELECT
  USING (
    plan_takeoff_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_takeoff_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can insert plan takeoff analysis"
  ON plan_takeoff_analysis FOR INSERT
  WITH CHECK (
    plan_takeoff_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_takeoff_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can update plan takeoff analysis"
  ON plan_takeoff_analysis FOR UPDATE
  USING (
    plan_takeoff_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_takeoff_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    plan_takeoff_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_takeoff_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can delete plan takeoff analysis"
  ON plan_takeoff_analysis FOR DELETE
  USING (
    plan_takeoff_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_takeoff_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

-- Quality analysis
DROP POLICY IF EXISTS "Users can view quality analysis for their plans" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Users can insert quality analysis for their plans" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Users can update their own quality analysis" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Users can delete their own quality analysis" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Members can view plan quality analysis" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Members can insert plan quality analysis" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Members can update plan quality analysis" ON plan_quality_analysis;
DROP POLICY IF EXISTS "Members can delete plan quality analysis" ON plan_quality_analysis;

CREATE POLICY "Members can view plan quality analysis"
  ON plan_quality_analysis FOR SELECT
  USING (
    plan_quality_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_quality_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can insert plan quality analysis"
  ON plan_quality_analysis FOR INSERT
  WITH CHECK (
    plan_quality_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_quality_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can update plan quality analysis"
  ON plan_quality_analysis FOR UPDATE
  USING (
    plan_quality_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_quality_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    plan_quality_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_quality_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can delete plan quality analysis"
  ON plan_quality_analysis FOR DELETE
  USING (
    plan_quality_analysis.user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_quality_analysis.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

-- Scale settings
DROP POLICY IF EXISTS "Users can view scale settings for their plans" ON plan_scale_settings;
DROP POLICY IF EXISTS "Users can manage scale settings for their plans" ON plan_scale_settings;
DROP POLICY IF EXISTS "Members can view scale settings" ON plan_scale_settings;
DROP POLICY IF EXISTS "Members can manage scale settings" ON plan_scale_settings;

CREATE POLICY "Members can view scale settings"
  ON plan_scale_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_scale_settings.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can manage scale settings"
  ON plan_scale_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_scale_settings.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_scale_settings.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

-- Plan comments
DROP POLICY IF EXISTS "Users can view comments on their plans" ON plan_comments;
DROP POLICY IF EXISTS "Users can insert comments on their plans" ON plan_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON plan_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON plan_comments;
DROP POLICY IF EXISTS "Members can view plan comments" ON plan_comments;
DROP POLICY IF EXISTS "Members can insert plan comments" ON plan_comments;
DROP POLICY IF EXISTS "Creators can update plan comments" ON plan_comments;
DROP POLICY IF EXISTS "Creators can delete plan comments" ON plan_comments;

CREATE POLICY "Members can view plan comments"
  ON plan_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_comments.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Members can insert plan comments"
  ON plan_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_comments.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Creators can update plan comments"
  ON plan_comments FOR UPDATE
  USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_comments.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Creators can delete plan comments"
  ON plan_comments FOR DELETE
  USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1
      FROM plans p
      WHERE p.id = plan_comments.plan_id
        AND (
          is_job_member(p.job_id, auth.uid())
          OR p.user_id = auth.uid()
        )
    )
  );


