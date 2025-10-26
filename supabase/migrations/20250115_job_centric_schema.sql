-- Job-Centric Schema Migration
-- This migration creates the new job-centric architecture

-- Create jobs table to replace scattered job_requests functionality
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  budget_range TEXT,
  project_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add job_id to plans table (nullable initially for migration)
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;

-- Create bid_packages table for trade-specific bid requests
CREATE TABLE IF NOT EXISTS bid_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  trade_category TEXT NOT NULL,
  description TEXT,
  minimum_line_items JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'receiving', 'closed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  deadline TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add bid_package_id to bids table (nullable initially for migration)
ALTER TABLE bids 
ADD COLUMN IF NOT EXISTS bid_package_id UUID REFERENCES bid_packages(id) ON DELETE CASCADE;

-- Create plan_shares table for collaboration links
CREATE TABLE IF NOT EXISTS plan_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  share_token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permissions TEXT NOT NULL DEFAULT 'view_only' CHECK (permissions IN ('view_only', 'markup', 'comment', 'all')),
  expires_at TIMESTAMP WITH TIME ZONE,
  accessed_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plans_job_id ON plans(job_id);
CREATE INDEX IF NOT EXISTS idx_plans_job_id_status ON plans(job_id, status);

CREATE INDEX IF NOT EXISTS idx_bid_packages_job_id ON bid_packages(job_id);
CREATE INDEX IF NOT EXISTS idx_bid_packages_status ON bid_packages(status);
CREATE INDEX IF NOT EXISTS idx_bid_packages_trade_category ON bid_packages(trade_category);

CREATE INDEX IF NOT EXISTS idx_bids_bid_package_id ON bids(bid_package_id);

CREATE INDEX IF NOT EXISTS idx_plan_shares_plan_id ON plan_shares(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_shares_share_token ON plan_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_plan_shares_expires_at ON plan_shares(expires_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bid_packages_updated_at 
  BEFORE UPDATE ON bid_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_shares ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for jobs
CREATE POLICY "Users can view their own jobs"
  ON jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own jobs"
  ON jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own jobs"
  ON jobs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own jobs"
  ON jobs FOR DELETE
  USING (user_id = auth.uid());

-- Create RLS policies for bid_packages
CREATE POLICY "Users can view bid packages for their jobs"
  ON bid_packages FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create bid packages for their jobs"
  ON bid_packages FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update bid packages for their jobs"
  ON bid_packages FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete bid packages for their jobs"
  ON bid_packages FOR DELETE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for plan_shares
CREATE POLICY "Users can view shares for their plans"
  ON plan_shares FOR SELECT
  USING (
    plan_id IN (
      SELECT id FROM plans WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create shares for their plans"
  ON plan_shares FOR INSERT
  WITH CHECK (
    plan_id IN (
      SELECT id FROM plans WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update shares they created"
  ON plan_shares FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete shares they created"
  ON plan_shares FOR DELETE
  USING (created_by = auth.uid());

-- Create policy for guest access to plan shares (no auth required)
CREATE POLICY "Anyone can view active plan shares"
  ON plan_shares FOR SELECT
  USING (
    expires_at IS NULL OR expires_at > NOW()
  );

-- Add comments for documentation
COMMENT ON TABLE jobs IS 'Main jobs table - replaces scattered job_requests functionality';
COMMENT ON TABLE bid_packages IS 'Trade-specific bid requests linked to jobs';
COMMENT ON TABLE plan_shares IS 'Collaboration links for sharing plans with external users';

COMMENT ON COLUMN jobs.status IS 'Job status: draft, active, completed, archived';
COMMENT ON COLUMN bid_packages.status IS 'Bid package status: draft, sent, receiving, closed';
COMMENT ON COLUMN plan_shares.permissions IS 'Access level: view_only, markup, comment, all';
COMMENT ON COLUMN plan_shares.share_token IS 'Unique token for sharing URL';
COMMENT ON COLUMN plan_shares.expires_at IS 'Optional expiration date for share link';

