-- Migration: Fix plan collaboration constraints
-- This migration fixes the constraint issues for plan annotations

-- Create guest_users table to track external collaborators FIRST
CREATE TABLE IF NOT EXISTS guest_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  guest_name TEXT NOT NULL,
  email TEXT, -- Optional email if they want to provide it
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create plan_shares table for shareable links
CREATE TABLE IF NOT EXISTS plan_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text || clock_timestamp()::text) from 1 for 32),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL means never expires
  allow_comments BOOLEAN DEFAULT true,
  allow_drawings BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true, -- Can be disabled without deleting
  access_count INTEGER DEFAULT 0, -- Track how many times the link was accessed
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- First, make job_request_id nullable in plan_annotations if it isn't already
ALTER TABLE plan_annotations 
ALTER COLUMN job_request_id DROP NOT NULL;

-- Add guest_user_id to plan_annotations to support guest annotations
ALTER TABLE plan_annotations 
ADD COLUMN IF NOT EXISTS guest_user_id UUID REFERENCES guest_users(id) ON DELETE CASCADE;

-- Add guest_user_id to plan_annotation_responses
ALTER TABLE plan_annotation_responses 
ADD COLUMN IF NOT EXISTS guest_user_id UUID REFERENCES guest_users(id) ON DELETE CASCADE;

-- Add guest_user_id to plan_drawings as well
ALTER TABLE plan_drawings 
ADD COLUMN IF NOT EXISTS guest_user_id UUID REFERENCES guest_users(id) ON DELETE CASCADE;

-- Handle existing data: For existing annotations that have neither created_by nor guest_user_id,
-- we'll delete them since we can't determine who created them
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count 
    FROM plan_annotations 
    WHERE created_by IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Found % orphaned annotations without created_by. These will be deleted.', orphaned_count;
        -- Delete orphaned annotations since we can't determine who created them
        DELETE FROM plan_annotations WHERE created_by IS NULL;
    END IF;
END $$;

-- Handle orphaned annotation responses
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count 
    FROM plan_annotation_responses 
    WHERE created_by IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Found % orphaned annotation responses without created_by. These will be deleted.', orphaned_count;
        DELETE FROM plan_annotation_responses WHERE created_by IS NULL;
    END IF;
END $$;

-- Handle orphaned drawings
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count 
    FROM plan_drawings 
    WHERE user_id IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE NOTICE 'Found % orphaned drawings without user_id. These will be deleted.', orphaned_count;
        DELETE FROM plan_drawings WHERE user_id IS NULL;
    END IF;
END $$;

-- Update plan_annotations constraint to allow either created_by OR guest_user_id
-- (One must be set, but not both)
ALTER TABLE plan_annotations 
DROP CONSTRAINT IF EXISTS plan_annotations_user_check;

ALTER TABLE plan_annotations 
ADD CONSTRAINT plan_annotations_user_check 
CHECK (
  (created_by IS NOT NULL AND guest_user_id IS NULL) OR
  (created_by IS NULL AND guest_user_id IS NOT NULL)
);

-- Same for responses
ALTER TABLE plan_annotation_responses 
DROP CONSTRAINT IF EXISTS plan_annotation_responses_user_check;

ALTER TABLE plan_annotation_responses 
ADD CONSTRAINT plan_annotation_responses_user_check 
CHECK (
  (created_by IS NOT NULL AND guest_user_id IS NULL) OR
  (created_by IS NULL AND guest_user_id IS NOT NULL)
);

-- Same for drawings
ALTER TABLE plan_drawings 
DROP CONSTRAINT IF EXISTS plan_drawings_user_check;

ALTER TABLE plan_drawings 
ADD CONSTRAINT plan_drawings_user_check 
CHECK (
  (user_id IS NOT NULL AND guest_user_id IS NULL) OR
  (user_id IS NULL AND guest_user_id IS NOT NULL)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_guest_users_session_token ON guest_users(session_token);
CREATE INDEX IF NOT EXISTS idx_plan_shares_share_token ON plan_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_plan_shares_plan_id ON plan_shares(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_shares_created_by ON plan_shares(created_by);
CREATE INDEX IF NOT EXISTS idx_plan_annotations_guest_user_id ON plan_annotations(guest_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_annotation_responses_guest_user_id ON plan_annotation_responses(guest_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_drawings_guest_user_id ON plan_drawings(guest_user_id);

-- Enable RLS on new tables
ALTER TABLE guest_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plan_shares

-- Users can view their own plan shares
CREATE POLICY "Users can view their own plan shares" ON plan_shares
  FOR SELECT USING (created_by = auth.uid());

-- Users can create plan shares for their own plans
CREATE POLICY "Users can create plan shares for their own plans" ON plan_shares
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM plans 
      WHERE plans.id = plan_shares.plan_id 
      AND plans.user_id = auth.uid()
    )
  );

-- Users can update their own plan shares
CREATE POLICY "Users can update their own plan shares" ON plan_shares
  FOR UPDATE USING (created_by = auth.uid());

-- Users can delete their own plan shares
CREATE POLICY "Users can delete their own plan shares" ON plan_shares
  FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for guest_users

-- Anyone can view guest users (needed for displaying names on annotations)
CREATE POLICY "Anyone can view guest users" ON guest_users
  FOR SELECT USING (true);

-- Anyone can insert guest users (for first-time visitors)
CREATE POLICY "Anyone can insert guest users" ON guest_users
  FOR INSERT WITH CHECK (true);

-- Guest users can update their own record (last_seen_at)
CREATE POLICY "Guest users can update their own record" ON guest_users
  FOR UPDATE USING (session_token = current_setting('app.guest_session_token', true));

-- Update RLS policies for plan_annotations to allow guest access via share links
-- Guest users can view annotations on shared plans
CREATE POLICY "Guest users can view annotations on shared plans" ON plan_annotations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plan_shares ps
      JOIN plans p ON ps.plan_id = p.id
      WHERE ps.is_active = true
      AND (ps.expires_at IS NULL OR ps.expires_at > NOW())
      AND p.file_path = plan_annotations.plan_file_url
    )
  );

-- Guest users can insert annotations on shared plans (if allowed)
CREATE POLICY "Guest users can insert annotations on shared plans" ON plan_annotations
  FOR INSERT WITH CHECK (
    guest_user_id IS NOT NULL
  );

-- Update RLS policies for plan_annotation_responses
CREATE POLICY "Guest users can view annotation responses on shared plans" ON plan_annotation_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plan_annotations pa
      WHERE pa.id = plan_annotation_responses.annotation_id
    )
  );

CREATE POLICY "Guest users can insert annotation responses" ON plan_annotation_responses
  FOR INSERT WITH CHECK (
    guest_user_id IS NOT NULL
  );

-- Update RLS policies for plan_drawings to allow guest access
CREATE POLICY "Guest users can insert drawings on shared plans" ON plan_drawings
  FOR INSERT WITH CHECK (
    guest_user_id IS NOT NULL
  );

CREATE POLICY "Guest users can view drawings on shared plans" ON plan_drawings
  FOR SELECT USING (true); -- Anyone can view drawings

CREATE POLICY "Guest users can update their own drawings" ON plan_drawings
  FOR UPDATE USING (guest_user_id IS NOT NULL);

CREATE POLICY "Guest users can delete their own drawings" ON plan_drawings
  FOR DELETE USING (guest_user_id IS NOT NULL);

-- Create a function to validate and track share link access
CREATE OR REPLACE FUNCTION validate_share_token(token TEXT)
RETURNS TABLE (
  plan_id UUID,
  plan_title TEXT,
  plan_file_name TEXT,
  plan_file_url TEXT,
  allow_comments BOOLEAN,
  allow_drawings BOOLEAN,
  owner_name TEXT
) AS $$
BEGIN
  -- Update access tracking
  UPDATE plan_shares
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE share_token = token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());

  -- Return plan info if valid
  RETURN QUERY
  SELECT 
    p.id as plan_id,
    p.title as plan_title,
    p.file_name as plan_file_name,
    p.file_path as plan_file_url,
    ps.allow_comments,
    ps.allow_drawings,
    u.email as owner_name
  FROM plan_shares ps
  JOIN plans p ON ps.plan_id = p.id
  JOIN auth.users u ON ps.created_by = u.id
  WHERE ps.share_token = token
    AND ps.is_active = true
    AND (ps.expires_at IS NULL OR ps.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for annotations with guest user info
CREATE OR REPLACE VIEW plan_annotations_with_guest_context AS
SELECT 
  pa.*,
  COALESCE(u.email, gu.guest_name) as author_name,
  CASE WHEN pa.guest_user_id IS NOT NULL THEN 'guest' ELSE 'user' END as author_type,
  gu.email as guest_email
FROM plan_annotations pa
LEFT JOIN auth.users u ON pa.created_by = u.id
LEFT JOIN guest_users gu ON pa.guest_user_id = gu.id;

-- Create a view for drawings with guest user info
CREATE OR REPLACE VIEW plan_drawings_with_guest_context AS
SELECT 
  pd.*,
  COALESCE(u.email, gu.guest_name) as author_name,
  CASE WHEN pd.guest_user_id IS NOT NULL THEN 'guest' ELSE 'user' END as author_type
FROM plan_drawings pd
LEFT JOIN auth.users u ON pd.user_id = u.id
LEFT JOIN guest_users gu ON pd.guest_user_id = gu.id;
