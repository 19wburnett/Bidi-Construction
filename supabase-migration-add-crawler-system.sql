-- Migration: Add crawler system tables
-- Run this in your Supabase SQL editor

-- Create crawler_jobs table to track crawler runs
CREATE TABLE IF NOT EXISTS crawler_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_category TEXT NOT NULL,
  location TEXT NOT NULL,
  max_results INTEGER DEFAULT 50,
  search_radius INTEGER DEFAULT 25,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused')),
  results_found INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create crawler_outreach_log table to track outreach emails
CREATE TABLE IF NOT EXISTS crawler_outreach_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crawler_job_id UUID REFERENCES crawler_jobs(id) ON DELETE CASCADE,
  contractor_email TEXT NOT NULL,
  contractor_name TEXT,
  trade_category TEXT NOT NULL,
  location TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  response_received BOOLEAN DEFAULT FALSE,
  response_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Create crawler_discovered_contractors table for contractors found by crawler
CREATE TABLE IF NOT EXISTS crawler_discovered_contractors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crawler_job_id UUID REFERENCES crawler_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  website TEXT,
  rating DECIMAL(3,2),
  source TEXT NOT NULL, -- 'google_my_business', 'yelp', 'linkedin', 'trade_association'
  verified BOOLEAN DEFAULT FALSE,
  verification_attempts INTEGER DEFAULT 0,
  last_verification_attempt TIMESTAMP WITH TIME ZONE,
  added_to_subcontractors BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crawler_jobs_status ON crawler_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawler_jobs_trade_category ON crawler_jobs(trade_category);
CREATE INDEX IF NOT EXISTS idx_crawler_jobs_location ON crawler_jobs(location);
CREATE INDEX IF NOT EXISTS idx_crawler_jobs_created_by ON crawler_jobs(created_by);

CREATE INDEX IF NOT EXISTS idx_crawler_outreach_log_job_id ON crawler_outreach_log(crawler_job_id);
CREATE INDEX IF NOT EXISTS idx_crawler_outreach_log_contractor_email ON crawler_outreach_log(contractor_email);
CREATE INDEX IF NOT EXISTS idx_crawler_outreach_log_status ON crawler_outreach_log(status);

CREATE INDEX IF NOT EXISTS idx_crawler_discovered_contractors_job_id ON crawler_discovered_contractors(crawler_job_id);
CREATE INDEX IF NOT EXISTS idx_crawler_discovered_contractors_email ON crawler_discovered_contractors(email);
CREATE INDEX IF NOT EXISTS idx_crawler_discovered_contractors_source ON crawler_discovered_contractors(source);
CREATE INDEX IF NOT EXISTS idx_crawler_discovered_contractors_verified ON crawler_discovered_contractors(verified);

-- Enable RLS
ALTER TABLE crawler_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_discovered_contractors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only admins can view crawler jobs
CREATE POLICY "Admins can view crawler jobs" ON crawler_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = TRUE
    )
  );

-- Only admins can insert crawler jobs
CREATE POLICY "Admins can create crawler jobs" ON crawler_jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = TRUE
    )
  );

-- Only admins can update crawler jobs
CREATE POLICY "Admins can update crawler jobs" ON crawler_jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = TRUE
    )
  );

-- Similar policies for outreach log
CREATE POLICY "Admins can view outreach log" ON crawler_outreach_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can insert outreach log" ON crawler_outreach_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = TRUE
    )
  );

-- Similar policies for discovered contractors
CREATE POLICY "Admins can view discovered contractors" ON crawler_discovered_contractors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = TRUE
    )
  );

CREATE POLICY "Admins can insert discovered contractors" ON crawler_discovered_contractors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = TRUE
    )
  );

-- Create function to automatically add verified contractors to subcontractors table
CREATE OR REPLACE FUNCTION add_verified_contractor_to_subcontractors()
RETURNS TRIGGER AS $$
BEGIN
  -- When a discovered contractor is marked as verified and not already added
  IF NEW.verified = TRUE AND NEW.added_to_subcontractors = FALSE THEN
    -- Insert into subcontractors table
    INSERT INTO subcontractors (email, name, trade_category, location)
    VALUES (NEW.email, NEW.name, 
            (SELECT trade_category FROM crawler_jobs WHERE id = NEW.crawler_job_id),
            (SELECT location FROM crawler_jobs WHERE id = NEW.crawler_job_id))
    ON CONFLICT (email) DO NOTHING;
    
    -- Mark as added
    NEW.added_to_subcontractors = TRUE;
    NEW.added_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add verified contractors
DROP TRIGGER IF EXISTS trigger_add_verified_contractor ON crawler_discovered_contractors;
CREATE TRIGGER trigger_add_verified_contractor
  AFTER UPDATE ON crawler_discovered_contractors
  FOR EACH ROW
  EXECUTE FUNCTION add_verified_contractor_to_subcontractors();

-- Create function to update crawler job statistics
CREATE OR REPLACE FUNCTION update_crawler_job_stats(job_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE crawler_jobs 
  SET 
    results_found = (
      SELECT COUNT(*) FROM crawler_discovered_contractors 
      WHERE crawler_job_id = job_id
    ),
    emails_sent = (
      SELECT COUNT(*) FROM crawler_outreach_log 
      WHERE crawler_job_id = job_id
    )
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;


