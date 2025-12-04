-- Migration: Subcontractor Quote Requests
-- Created: 2025-01-15
-- Description: Table for subcontractor quote requests, modeled after ai_takeoff_queue pattern

-- Create quote_requests table
CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Quote-specific fields
  work_description TEXT,
  known_pricing JSONB, -- Flexible structure for pricing data
  quote_pdf_path TEXT, -- Path to generated PDF in storage
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  
  -- Timestamps
  estimated_completion_date TIMESTAMPTZ, -- "1 day" from submission
  admin_notified_at TIMESTAMPTZ, -- When admin email was sent
  user_notified_at TIMESTAMPTZ, -- When quote PDF was sent to user
  
  -- Admin assignment
  assigned_to_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- Processing timestamps
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  request_data JSONB, -- Additional metadata
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_requests_plan_id ON quote_requests(plan_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_user_id ON quote_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_queued_at ON quote_requests(queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at DESC);

-- RLS Policies
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own quote requests
CREATE POLICY "Users can view their own quote requests"
  ON quote_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own quote requests
CREATE POLICY "Users can insert their own quote requests"
  ON quote_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all quote requests
CREATE POLICY "Admins can view all quote requests"
  ON quote_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.is_admin = true OR users.role = 'admin')
    )
  );

-- Admins can update all quote requests
CREATE POLICY "Admins can update all quote requests"
  ON quote_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.is_admin = true OR users.role = 'admin')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quote_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_quote_requests_updated_at
  BEFORE UPDATE ON quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_requests_updated_at();

-- Create storage bucket for quote PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-pdfs', 'quote-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for quote-pdfs bucket
-- Users can upload quote PDFs (for admins uploading completed quotes)
CREATE POLICY "Admins can upload quote PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quote-pdfs' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.is_admin = true OR users.role = 'admin')
    )
  );

-- Users can view their own quote PDFs
CREATE POLICY "Users can view their own quote PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quote-pdfs' AND
    EXISTS (
      SELECT 1 FROM quote_requests
      WHERE quote_requests.quote_pdf_path = (bucket_id || '/' || name)
      AND quote_requests.user_id = auth.uid()
    )
  );

-- Admins can view all quote PDFs
CREATE POLICY "Admins can view all quote PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quote-pdfs' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.is_admin = true OR users.role = 'admin')
    )
  );

-- Admins can delete quote PDFs
CREATE POLICY "Admins can delete quote PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'quote-pdfs' AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.is_admin = true OR users.role = 'admin')
    )
  );

-- Create system job for quote requests (to satisfy plans.job_id NOT NULL requirement)
DO $$
DECLARE
  system_job_id UUID;
  admin_user_id UUID;
BEGIN
  -- Get first admin user
  SELECT id INTO admin_user_id
  FROM users
  WHERE (is_admin = true OR role = 'admin')
  LIMIT 1;
  
  -- If no admin exists, create a system user (fallback)
  IF admin_user_id IS NULL THEN
    -- Try to get any user as fallback
    SELECT id INTO admin_user_id
    FROM users
    LIMIT 1;
  END IF;
  
  -- Create system job for quote requests if it doesn't exist
  INSERT INTO jobs (user_id, name, location, status, description)
  VALUES (
    COALESCE(admin_user_id, (SELECT id FROM users LIMIT 1)),
    'Subcontractor Quote Requests',
    'System',
    'archived',
    'System job for subcontractor quote request plans. This job is archived and not shown in normal job lists.'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO system_job_id;
  
  -- If job already exists, get its ID
  IF system_job_id IS NULL THEN
    SELECT id INTO system_job_id
    FROM jobs
    WHERE name = 'Subcontractor Quote Requests'
    LIMIT 1;
  END IF;
  
  RAISE NOTICE 'System job for quote requests: %', system_job_id;
END $$;

-- Add comment
COMMENT ON TABLE quote_requests IS 'Queue for subcontractor quote requests. Subcontractors upload plans and receive PDF quotes within 1 business day.';

