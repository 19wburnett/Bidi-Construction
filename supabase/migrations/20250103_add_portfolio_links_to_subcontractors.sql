-- Migration: Add portfolio_links field to subcontractors table
-- Purpose: Store portfolio/work page links from enrichment for proper display

ALTER TABLE subcontractors 
  ADD COLUMN IF NOT EXISTS portfolio_links JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN subcontractors.portfolio_links IS 'Array of portfolio/work page URLs extracted from subcontractor website during enrichment';

-- Add index for JSONB queries (optional, but useful if we need to search)
CREATE INDEX IF NOT EXISTS idx_subcontractors_portfolio_links 
  ON subcontractors USING GIN (portfolio_links) 
  WHERE portfolio_links IS NOT NULL;
