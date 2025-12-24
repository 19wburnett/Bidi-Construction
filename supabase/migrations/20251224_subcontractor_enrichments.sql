-- Migration: Create subcontractor enrichments table and add columns to subcontractors
-- Purpose: Support free profile enrichment with approval workflow

-- Create the subcontractor_enrichments table
CREATE TABLE IF NOT EXISTS subcontractor_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'approved', 'rejected')),
  results_json JSONB,
  sources_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id)
);

-- Add index for faster lookups by subcontractor
CREATE INDEX IF NOT EXISTS idx_subcontractor_enrichments_subcontractor_id 
  ON subcontractor_enrichments(subcontractor_id);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_subcontractor_enrichments_status 
  ON subcontractor_enrichments(status);

-- Add new columns to subcontractors table
ALTER TABLE subcontractors 
  ADD COLUMN IF NOT EXISTS profile_summary TEXT,
  ADD COLUMN IF NOT EXISTS services JSONB,
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_updated_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON TABLE subcontractor_enrichments IS 'Stores enrichment results for subcontractor profiles with approval workflow';
COMMENT ON COLUMN subcontractor_enrichments.status IS 'pending: queued, running: in progress, complete: awaiting review, approved: applied to subcontractor, rejected: discarded';
COMMENT ON COLUMN subcontractor_enrichments.results_json IS 'Extracted profile data (summary, services, phone, etc.)';
COMMENT ON COLUMN subcontractor_enrichments.sources_json IS 'Source URLs and confidence scores for each field';
COMMENT ON COLUMN subcontractors.profile_summary IS 'Brief company description extracted from website';
COMMENT ON COLUMN subcontractors.services IS 'Array of services offered by the subcontractor';
COMMENT ON COLUMN subcontractors.enrichment_status IS 'Current enrichment status for quick filtering';

-- Enable RLS
ALTER TABLE subcontractor_enrichments ENABLE ROW LEVEL SECURITY;

-- RLS policies: Only admins can access enrichments
CREATE POLICY "Admins can view all enrichments" ON subcontractor_enrichments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can insert enrichments" ON subcontractor_enrichments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can update enrichments" ON subcontractor_enrichments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can delete enrichments" ON subcontractor_enrichments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_subcontractor_enrichments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_subcontractor_enrichments_updated_at ON subcontractor_enrichments;
CREATE TRIGGER trigger_update_subcontractor_enrichments_updated_at
  BEFORE UPDATE ON subcontractor_enrichments
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractor_enrichments_updated_at();

