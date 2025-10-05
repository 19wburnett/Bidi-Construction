-- Migration: Add plan files support and annotation system
-- This migration adds plan_files column to job_requests and creates tables for plan annotations

-- Add plan_files column to job_requests table
ALTER TABLE job_requests 
ADD COLUMN IF NOT EXISTS plan_files TEXT[];

-- Create plan_annotations table for storing annotations on plan files
CREATE TABLE IF NOT EXISTS plan_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_request_id UUID NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  plan_file_url TEXT NOT NULL,
  bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
  annotation_type TEXT NOT NULL CHECK (annotation_type IN ('note', 'question', 'concern', 'suggestion', 'highlight')),
  x_coordinate FLOAT NOT NULL,
  y_coordinate FLOAT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create plan_annotation_responses table for responses to annotations
CREATE TABLE IF NOT EXISTS plan_annotation_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID NOT NULL REFERENCES plan_annotations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_plan_annotations_job_request_id ON plan_annotations(job_request_id);
CREATE INDEX idx_plan_annotations_plan_file_url ON plan_annotations(plan_file_url);
CREATE INDEX idx_plan_annotations_bid_id ON plan_annotations(bid_id);
CREATE INDEX idx_plan_annotations_annotation_type ON plan_annotations(annotation_type);
CREATE INDEX idx_plan_annotation_responses_annotation_id ON plan_annotation_responses(annotation_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE plan_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_annotation_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view plan annotations for their own job requests
CREATE POLICY "Users can view plan annotations for their own job requests" ON plan_annotations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM job_requests 
      WHERE job_requests.id = plan_annotations.job_request_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Policy: Users can insert plan annotations for their own job requests
CREATE POLICY "Users can insert plan annotations for their own job requests" ON plan_annotations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_requests 
      WHERE job_requests.id = plan_annotations.job_request_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Policy: Users can update plan annotations for their own job requests
CREATE POLICY "Users can update plan annotations for their own job requests" ON plan_annotations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM job_requests 
      WHERE job_requests.id = plan_annotations.job_request_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Policy: Users can delete plan annotations for their own job requests
CREATE POLICY "Users can delete plan annotations for their own job requests" ON plan_annotations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM job_requests 
      WHERE job_requests.id = plan_annotations.job_request_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Policy: Users can view annotation responses for their own job requests
CREATE POLICY "Users can view annotation responses for their own job requests" ON plan_annotation_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM plan_annotations 
      JOIN job_requests ON plan_annotations.job_request_id = job_requests.id 
      WHERE plan_annotations.id = plan_annotation_responses.annotation_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Policy: Users can insert annotation responses for their own job requests
CREATE POLICY "Users can insert annotation responses for their own job requests" ON plan_annotation_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM plan_annotations 
      JOIN job_requests ON plan_annotations.job_request_id = job_requests.id 
      WHERE plan_annotations.id = plan_annotation_responses.annotation_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Policy: Users can update annotation responses for their own job requests
CREATE POLICY "Users can update annotation responses for their own job requests" ON plan_annotation_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM plan_annotations 
      JOIN job_requests ON plan_annotations.job_request_id = job_requests.id 
      WHERE plan_annotations.id = plan_annotation_responses.annotation_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Policy: Users can delete annotation responses for their own job requests
CREATE POLICY "Users can delete annotation responses for their own job requests" ON plan_annotation_responses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM plan_annotations 
      JOIN job_requests ON plan_annotations.job_request_id = job_requests.id 
      WHERE plan_annotations.id = plan_annotation_responses.annotation_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Create a view for easier querying with job and bid context
CREATE OR REPLACE VIEW plan_annotations_with_context AS
SELECT 
  pa.*,
  jr.trade_category,
  jr.location,
  jr.description as job_description,
  b.company_name,
  b.contact_name,
  b.email as bid_email,
  b.phone as bid_phone,
  u.email as created_by_email
FROM plan_annotations pa
JOIN job_requests jr ON pa.job_request_id = jr.id
LEFT JOIN bids b ON pa.bid_id = b.id
LEFT JOIN auth.users u ON pa.created_by = u.id;

-- Create a view for annotation responses with context
CREATE OR REPLACE VIEW plan_annotation_responses_with_context AS
SELECT 
  par.*,
  pa.job_request_id,
  pa.plan_file_url,
  pa.annotation_type,
  pa.content as annotation_content,
  jr.trade_category,
  jr.location,
  u.email as created_by_email
FROM plan_annotation_responses par
JOIN plan_annotations pa ON par.annotation_id = pa.id
JOIN job_requests jr ON pa.job_request_id = jr.id
LEFT JOIN auth.users u ON par.created_by = u.id;



