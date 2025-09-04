-- SubBidi Database Schema
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('GC', 'sub')),
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job_requests table
CREATE TABLE IF NOT EXISTS job_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  gc_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  trade_category TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_range TEXT NOT NULL,
  files TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_request_id UUID REFERENCES job_requests(id) ON DELETE CASCADE NOT NULL,
  subcontractor_email TEXT NOT NULL,
  subcontractor_name TEXT,
  phone TEXT,
  bid_amount DECIMAL(10,2),
  timeline TEXT,
  notes TEXT,
  ai_summary TEXT,
  raw_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subcontractors table
CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  trade_category TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for job files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('job-files', 'job-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Job requests policies
CREATE POLICY "GCs can view own job requests" ON job_requests
  FOR SELECT USING (auth.uid() = gc_id);

CREATE POLICY "GCs can insert own job requests" ON job_requests
  FOR INSERT WITH CHECK (auth.uid() = gc_id);

CREATE POLICY "GCs can update own job requests" ON job_requests
  FOR UPDATE USING (auth.uid() = gc_id);

-- Bids policies
CREATE POLICY "GCs can view bids for their jobs" ON bids
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM job_requests 
      WHERE job_requests.id = bids.job_request_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert bids" ON bids
  FOR INSERT WITH CHECK (true);

-- Subcontractors policies (public read, admin write)
CREATE POLICY "Anyone can view subcontractors" ON subcontractors
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert subcontractors" ON subcontractors
  FOR INSERT WITH CHECK (true);

-- Storage policies for job files
CREATE POLICY "Authenticated users can upload job files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can view job files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'job-files' 
    AND auth.role() = 'authenticated'
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_requests_gc_id ON job_requests(gc_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_trade_category ON job_requests(trade_category);
CREATE INDEX IF NOT EXISTS idx_job_requests_location ON job_requests(location);
CREATE INDEX IF NOT EXISTS idx_bids_job_request_id ON bids(job_request_id);
CREATE INDEX IF NOT EXISTS idx_subcontractors_trade_category ON subcontractors(trade_category);
CREATE INDEX IF NOT EXISTS idx_subcontractors_location ON subcontractors(location);

-- Insert some sample subcontractors for testing
INSERT INTO subcontractors (email, name, trade_category, location) VALUES
  ('electrician1@example.com', 'ABC Electrical Services', 'Electrical', 'San Francisco, CA'),
  ('electrician2@example.com', 'Bay Area Electric', 'Electrical', 'San Francisco, CA'),
  ('plumber1@example.com', 'Golden Gate Plumbing', 'Plumbing', 'San Francisco, CA'),
  ('plumber2@example.com', 'SF Plumbing Co', 'Plumbing', 'San Francisco, CA'),
  ('hvac1@example.com', 'Cool Air HVAC', 'HVAC', 'San Francisco, CA'),
  ('roofer1@example.com', 'Pacific Roofing', 'Roofing', 'San Francisco, CA'),
  ('painter1@example.com', 'City Painters', 'Painting', 'San Francisco, CA'),
  ('drywall1@example.com', 'Perfect Walls', 'Drywall', 'San Francisco, CA')
ON CONFLICT (email) DO NOTHING;
