-- Budget Assignments Migration
-- This migration creates a table to store budget assignments (which bid is assigned to which trade)
-- This is separate from scenarios - it stores the current working budget state

CREATE TABLE IF NOT EXISTS budget_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  trade_category TEXT NOT NULL,
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(job_id, trade_category) -- Only one bid per trade per job
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_assignments_job_id ON budget_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_budget_assignments_bid_id ON budget_assignments(bid_id);
CREATE INDEX IF NOT EXISTS idx_budget_assignments_trade_category ON budget_assignments(job_id, trade_category);

-- Update trigger function for updated_at
CREATE OR REPLACE FUNCTION update_budget_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_budget_assignments_updated_at ON budget_assignments;
CREATE TRIGGER trigger_budget_assignments_updated_at
  BEFORE UPDATE ON budget_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_assignments_updated_at();

-- Enable RLS
ALTER TABLE budget_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: Users can view assignments for jobs they own or are members of
CREATE POLICY "Users can view budget assignments for their jobs"
  ON budget_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = budget_assignments.job_id
      AND jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_members
      WHERE job_members.job_id = budget_assignments.job_id
      AND job_members.user_id = auth.uid()
    )
  );

-- INSERT: Users can create assignments for jobs they own or are members of
CREATE POLICY "Users can create budget assignments for their jobs"
  ON budget_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = budget_assignments.job_id
      AND jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_members
      WHERE job_members.job_id = budget_assignments.job_id
      AND job_members.user_id = auth.uid()
    )
  );

-- UPDATE: Users can update assignments for jobs they own or are members of
CREATE POLICY "Users can update budget assignments for their jobs"
  ON budget_assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = budget_assignments.job_id
      AND jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_members
      WHERE job_members.job_id = budget_assignments.job_id
      AND job_members.user_id = auth.uid()
    )
  );

-- DELETE: Users can delete assignments for jobs they own or are members of
CREATE POLICY "Users can delete budget assignments for their jobs"
  ON budget_assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = budget_assignments.job_id
      AND jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_members
      WHERE job_members.job_id = budget_assignments.job_id
      AND job_members.user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE budget_assignments IS 'Stores current budget assignments - which bid is assigned to which trade category for a job';
COMMENT ON COLUMN budget_assignments.trade_category IS 'The trade category (e.g., Electrical, Plumbing)';
COMMENT ON COLUMN budget_assignments.bid_id IS 'The bid assigned to this trade';
COMMENT ON COLUMN budget_assignments.is_confirmed IS 'Whether this assignment has been confirmed (bid accepted)';

