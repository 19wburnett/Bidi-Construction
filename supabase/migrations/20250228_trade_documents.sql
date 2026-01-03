-- Migration: Trade Documents
-- Created: 2025-02-28
-- Description: Table for trade-specific documents (SOW, specifications, addendums, etc.)

-- Trade-specific documents (SOW, supporting documents)
CREATE TABLE IF NOT EXISTS trade_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE, -- Optional: link to specific plan
  trade_category TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('sow', 'specification', 'addendum', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_trade_documents_job_id ON trade_documents(job_id);
CREATE INDEX idx_trade_documents_plan_id ON trade_documents(plan_id);
CREATE INDEX idx_trade_documents_trade_category ON trade_documents(trade_category);
CREATE INDEX idx_trade_documents_document_type ON trade_documents(document_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trade_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_trade_documents_updated_at 
  BEFORE UPDATE ON trade_documents
  FOR EACH ROW EXECUTE FUNCTION update_trade_documents_updated_at();

-- Enable Row Level Security
ALTER TABLE trade_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view trade documents for jobs they have access to
CREATE POLICY "Users can view trade documents for their jobs"
  ON trade_documents FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
      UNION
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
  );

-- Users can create trade documents for jobs they have access to
CREATE POLICY "Users can create trade documents for their jobs"
  ON trade_documents FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
      UNION
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

-- Users can update trade documents they uploaded
CREATE POLICY "Users can update their trade documents"
  ON trade_documents FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    AND job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
      UNION
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete trade documents they uploaded or for their jobs
CREATE POLICY "Users can delete trade documents for their jobs"
  ON trade_documents FOR DELETE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE user_id = auth.uid()
      UNION
      SELECT job_id FROM job_members WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE trade_documents IS 'Trade-specific documents (SOW, specifications, addendums) linked to jobs and optionally plans';
COMMENT ON COLUMN trade_documents.document_type IS 'Type of document: sow, specification, addendum, or other';
COMMENT ON COLUMN trade_documents.plan_id IS 'Optional link to specific plan. If null, document applies to all plans for the trade in this job';
