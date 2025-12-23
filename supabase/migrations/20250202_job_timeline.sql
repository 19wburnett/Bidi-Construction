-- Migration: Add job timeline for subcontractor scheduling
-- This allows GCs to create a timeline showing when different subcontractors work on the project

-- Create job_timeline_items table
CREATE TABLE IF NOT EXISTS job_timeline_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  trade_category TEXT NOT NULL,
  subcontractor_name TEXT, -- Optional: specific subcontractor name
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'delayed')),
  display_order INTEGER DEFAULT 0, -- For custom ordering
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_timeline_items_job_id ON job_timeline_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_timeline_items_start_date ON job_timeline_items(start_date);
CREATE INDEX IF NOT EXISTS idx_job_timeline_items_trade_category ON job_timeline_items(trade_category);
CREATE INDEX IF NOT EXISTS idx_job_timeline_items_status ON job_timeline_items(status);

-- Enable RLS
ALTER TABLE job_timeline_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view timeline items for jobs they have access to
CREATE POLICY "Users can view timeline items for their jobs"
  ON job_timeline_items FOR SELECT
  USING (
    job_id IN (
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can create timeline items for jobs they own
CREATE POLICY "Users can create timeline items for their jobs"
  ON job_timeline_items FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND job_id IN (
      SELECT job_id FROM job_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Policy: Users can update timeline items for jobs they own
CREATE POLICY "Users can update timeline items for their jobs"
  ON job_timeline_items FOR UPDATE
  USING (
    job_id IN (
      SELECT job_id FROM job_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Policy: Users can delete timeline items for jobs they own
CREATE POLICY "Users can delete timeline items for their jobs"
  ON job_timeline_items FOR DELETE
  USING (
    job_id IN (
      SELECT job_id FROM job_members WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Policy: Anyone can view timeline items for shared jobs (via job_shares)
CREATE POLICY "Guests can view timeline items for shared jobs"
  ON job_timeline_items FOR SELECT
  USING (
    job_id IN (
      SELECT job_id FROM job_shares 
      WHERE expires_at IS NULL OR expires_at > NOW()
    )
  );

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_job_timeline_items_updated_at 
  BEFORE UPDATE ON job_timeline_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE job_timeline_items IS 'Timeline entries showing when different subcontractors/trades work on a job';
COMMENT ON COLUMN job_timeline_items.trade_category IS 'Trade category (e.g., Electrical, Plumbing, Framing)';
COMMENT ON COLUMN job_timeline_items.subcontractor_name IS 'Optional specific subcontractor name';
COMMENT ON COLUMN job_timeline_items.status IS 'Status: scheduled, in_progress, completed, delayed';
COMMENT ON COLUMN job_timeline_items.display_order IS 'Custom ordering for timeline display';











