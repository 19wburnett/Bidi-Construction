-- Budget Scenarios Migration
-- This migration creates tables for budget scenario planning with drag-and-drop bid management

-- Budget scenarios table
CREATE TABLE IF NOT EXISTS budget_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL
);

-- Junction table for scenario bids
CREATE TABLE IF NOT EXISTS budget_scenario_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES budget_scenarios(id) ON DELETE CASCADE,
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(scenario_id, bid_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_scenarios_job_id ON budget_scenarios(job_id);
CREATE INDEX IF NOT EXISTS idx_budget_scenarios_is_active ON budget_scenarios(job_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_budget_scenario_bids_scenario_id ON budget_scenario_bids(scenario_id);
CREATE INDEX IF NOT EXISTS idx_budget_scenario_bids_bid_id ON budget_scenario_bids(bid_id);

-- Partial unique index: Only one active scenario per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_scenarios_one_active_per_job 
ON budget_scenarios(job_id) 
WHERE is_active = true;

-- Update trigger function for updated_at
CREATE OR REPLACE FUNCTION update_budget_scenarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_budget_scenarios_updated_at ON budget_scenarios;
CREATE TRIGGER trigger_budget_scenarios_updated_at
  BEFORE UPDATE ON budget_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_scenarios_updated_at();

-- Enable RLS
ALTER TABLE budget_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_scenario_bids ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budget_scenarios
-- SELECT: Users can view scenarios for jobs they own or are members of
CREATE POLICY "Users can view scenarios for their jobs"
  ON budget_scenarios
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = budget_scenarios.job_id
      AND jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_members
      WHERE job_members.job_id = budget_scenarios.job_id
      AND job_members.user_id = auth.uid()
    )
  );

-- INSERT: Users can create scenarios for jobs they own or are members of
CREATE POLICY "Users can create scenarios for their jobs"
  ON budget_scenarios
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = budget_scenarios.job_id
      AND jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_members
      WHERE job_members.job_id = budget_scenarios.job_id
      AND job_members.user_id = auth.uid()
    )
  );

-- UPDATE: Users can update scenarios for jobs they own or are members of
CREATE POLICY "Users can update scenarios for their jobs"
  ON budget_scenarios
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = budget_scenarios.job_id
      AND jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_members
      WHERE job_members.job_id = budget_scenarios.job_id
      AND job_members.user_id = auth.uid()
    )
  );

-- DELETE: Users can delete scenarios for jobs they own or are members of
CREATE POLICY "Users can delete scenarios for their jobs"
  ON budget_scenarios
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = budget_scenarios.job_id
      AND jobs.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM job_members
      WHERE job_members.job_id = budget_scenarios.job_id
      AND job_members.user_id = auth.uid()
    )
  );

-- RLS Policies for budget_scenario_bids
-- SELECT: Users can view scenario bids for scenarios they have access to
CREATE POLICY "Users can view scenario bids"
  ON budget_scenario_bids
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM budget_scenarios
      WHERE budget_scenarios.id = budget_scenario_bids.scenario_id
      AND (
        EXISTS (
          SELECT 1 FROM jobs
          WHERE jobs.id = budget_scenarios.job_id
          AND jobs.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM job_members
          WHERE job_members.job_id = budget_scenarios.job_id
          AND job_members.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: Users can add bids to scenarios they have access to
CREATE POLICY "Users can add bids to scenarios"
  ON budget_scenario_bids
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM budget_scenarios
      WHERE budget_scenarios.id = budget_scenario_bids.scenario_id
      AND (
        EXISTS (
          SELECT 1 FROM jobs
          WHERE jobs.id = budget_scenarios.job_id
          AND jobs.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM job_members
          WHERE job_members.job_id = budget_scenarios.job_id
          AND job_members.user_id = auth.uid()
        )
      )
    )
  );

-- UPDATE: Users can update scenario bids for scenarios they have access to
CREATE POLICY "Users can update scenario bids"
  ON budget_scenario_bids
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM budget_scenarios
      WHERE budget_scenarios.id = budget_scenario_bids.scenario_id
      AND (
        EXISTS (
          SELECT 1 FROM jobs
          WHERE jobs.id = budget_scenarios.job_id
          AND jobs.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM job_members
          WHERE job_members.job_id = budget_scenarios.job_id
          AND job_members.user_id = auth.uid()
        )
      )
    )
  );

-- DELETE: Users can remove bids from scenarios they have access to
CREATE POLICY "Users can remove bids from scenarios"
  ON budget_scenario_bids
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM budget_scenarios
      WHERE budget_scenarios.id = budget_scenario_bids.scenario_id
      AND (
        EXISTS (
          SELECT 1 FROM jobs
          WHERE jobs.id = budget_scenarios.job_id
          AND jobs.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM job_members
          WHERE job_members.job_id = budget_scenarios.job_id
          AND job_members.user_id = auth.uid()
        )
      )
    )
  );

-- Add comments for documentation
COMMENT ON TABLE budget_scenarios IS 'Budget scenarios allow users to create multiple budget combinations by selecting different bids';
COMMENT ON TABLE budget_scenario_bids IS 'Junction table linking budget scenarios to bids';
COMMENT ON COLUMN budget_scenarios.is_active IS 'Only one scenario per job can be active at a time';
COMMENT ON COLUMN budget_scenario_bids.bid_id IS 'Reference to a bid that is included in this scenario';

