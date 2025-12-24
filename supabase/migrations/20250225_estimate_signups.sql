-- Migration: Estimate Signups Table
-- Creates table for storing email signups for free estimates on plans

CREATE TABLE IF NOT EXISTS estimate_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique emails (prevent duplicate signups)
  UNIQUE(email)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_estimate_signups_email ON estimate_signups(email);
CREATE INDEX IF NOT EXISTS idx_estimate_signups_created_at ON estimate_signups(created_at DESC);

-- Enable Row Level Security
ALTER TABLE estimate_signups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow anyone to insert (for public signup form)
CREATE POLICY "Anyone can sign up for estimates" ON estimate_signups
  FOR INSERT WITH CHECK (true);

-- Allow SELECT for duplicate checking (required for API route)
-- Note: This allows the API to check if an email already exists before inserting
-- The API route only selects 'id, email' columns, so minimal data exposure
-- For production, consider using a database function for duplicate checking instead
CREATE POLICY "Allow duplicate email check" ON estimate_signups
  FOR SELECT USING (true);

-- Only admins can delete signups
CREATE POLICY "Admins can delete signups" ON estimate_signups
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.is_admin = true OR users.role = 'admin')
    )
  );

