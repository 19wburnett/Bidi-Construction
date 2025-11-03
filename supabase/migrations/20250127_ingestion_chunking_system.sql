-- Migration: Ingestion & Chunking System
-- Creates tables for PDF ingestion, sheet indexing, and chunking

-- ============================================================================
-- PLAN SHEET INDEX TABLE
-- Stores metadata for each page/sheet in a plan
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_sheet_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  title TEXT,
  discipline TEXT NOT NULL,
  scale TEXT,
  scale_ratio NUMERIC,
  units TEXT CHECK (units IN ('imperial', 'metric')),
  page_no INTEGER NOT NULL,
  sheet_type TEXT NOT NULL,
  rotation INTEGER DEFAULT 0,
  has_text_layer BOOLEAN DEFAULT FALSE,
  has_image BOOLEAN DEFAULT FALSE,
  text_length INTEGER DEFAULT 0,
  detected_keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, sheet_id)
);

CREATE INDEX IF NOT EXISTS idx_sheet_index_plan_id ON plan_sheet_index(plan_id);
CREATE INDEX IF NOT EXISTS idx_sheet_index_sheet_id ON plan_sheet_index(sheet_id);
CREATE INDEX IF NOT EXISTS idx_sheet_index_discipline ON plan_sheet_index(discipline);
CREATE INDEX IF NOT EXISTS idx_sheet_index_sheet_type ON plan_sheet_index(sheet_type);
CREATE INDEX IF NOT EXISTS idx_sheet_index_page_no ON plan_sheet_index(plan_id, page_no);

-- ============================================================================
-- PLAN CHUNKS TABLE
-- Stores chunks generated from plans for LLM analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_chunks (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_range JSONB NOT NULL,
  sheet_index_subset JSONB NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB NOT NULL,
  safeguards JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_plan_id ON plan_chunks(plan_id);
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON plan_chunks(plan_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON plan_chunks USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_chunks_content_text ON plan_chunks USING GIN(content);

-- Add RLS policies if needed (adjust based on your RLS setup)
-- For now, assuming RLS is handled at the plans table level

COMMENT ON TABLE plan_sheet_index IS 'Stores metadata for each sheet/page in architectural plans';
COMMENT ON TABLE plan_chunks IS 'Stores chunks generated from plans for LLM analysis';

