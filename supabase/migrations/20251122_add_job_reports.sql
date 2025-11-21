-- Create job_reports table for storing PDF reports
CREATE TABLE IF NOT EXISTS job_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bid_package_reports table for linking reports to bid packages (many-to-many)
CREATE TABLE IF NOT EXISTS bid_package_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bid_package_id UUID NOT NULL REFERENCES bid_packages(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES job_reports(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bid_package_id, report_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_job_reports_job_id ON job_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_job_reports_created_by ON job_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_bid_package_reports_package_id ON bid_package_reports(bid_package_id);
CREATE INDEX IF NOT EXISTS idx_bid_package_reports_report_id ON bid_package_reports(report_id);

-- Enable Row Level Security
ALTER TABLE job_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_package_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_reports

-- Users can view reports for jobs they have access to
-- (Assuming job access is controlled by job membership or ownership - reusing job policies logic)
-- For now, relying on job ownership/membership if available, or just matching user_id on the job table via the job_id
CREATE POLICY "Users can view reports for their jobs"
  ON job_reports FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
      UNION
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create reports for their jobs"
  ON job_reports FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
      UNION
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reports for their jobs"
  ON job_reports FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
      UNION
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reports for their jobs"
  ON job_reports FOR DELETE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
      UNION
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for bid_package_reports

-- Users can view report links if they can view the bid package
CREATE POLICY "Users can view report links for their bid packages"
  ON bid_package_reports FOR SELECT
  USING (
    bid_package_id IN (
      SELECT id FROM bid_packages WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
        UNION
        SELECT job_id FROM job_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can link reports to their bid packages"
  ON bid_package_reports FOR INSERT
  WITH CHECK (
    bid_package_id IN (
      SELECT id FROM bid_packages WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
        UNION
        SELECT job_id FROM job_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can remove report links from their bid packages"
  ON bid_package_reports FOR DELETE
  USING (
    bid_package_id IN (
      SELECT id FROM bid_packages WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
        UNION
        SELECT job_id FROM job_members WHERE user_id = auth.uid()
      )
    )
  );

