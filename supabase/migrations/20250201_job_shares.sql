-- Migration: Add job_shares table for sharing all plans in a job
-- This allows subcontractors to view and download all plans associated with a job

-- Create job_shares table for sharing all plans in a job
CREATE TABLE IF NOT EXISTS job_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  accessed_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_shares_job_id ON job_shares(job_id);
CREATE INDEX IF NOT EXISTS idx_job_shares_share_token ON job_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_job_shares_expires_at ON job_shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_job_shares_created_by ON job_shares(created_by);

-- Enable RLS
ALTER TABLE job_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view job shares they created
CREATE POLICY "Users can view job shares they created"
  ON job_shares FOR SELECT
  USING (created_by = auth.uid());

-- Policy: Users can create job shares for jobs they own
CREATE POLICY "Users can create job shares for their jobs"
  ON job_shares FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND job_id IN (
      SELECT job_id FROM job_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Policy: Users can update job shares they created
CREATE POLICY "Users can update job shares they created"
  ON job_shares FOR UPDATE
  USING (created_by = auth.uid());

-- Policy: Users can delete job shares they created
CREATE POLICY "Users can delete job shares they created"
  ON job_shares FOR DELETE
  USING (created_by = auth.uid());

-- Policy: Anyone can view active job shares (for guest access)
CREATE POLICY "Anyone can view active job shares"
  ON job_shares FOR SELECT
  USING (
    expires_at IS NULL OR expires_at > NOW()
  );

COMMENT ON TABLE job_shares IS 'Share links for jobs that allow viewing all plans associated with the job';
COMMENT ON COLUMN job_shares.share_token IS 'Unique token for sharing URL';
COMMENT ON COLUMN job_shares.expires_at IS 'Optional expiration date for share link';


