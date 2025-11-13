-- Migration: Plan Text Chunks for Plan Chat RAG
-- Enables pgvector and creates storage for embedded text snippets extracted from plan files

-- Enable pgvector extension (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PLAN TEXT CHUNKS TABLE
-- Stores text snippets extracted from plan files with embeddings for similarity search
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_text_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  page_number INTEGER,
  snippet_text TEXT NOT NULL,
  metadata JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plan_text_chunks_plan_id_idx
  ON plan_text_chunks(plan_id);

-- Use IVF Flat index for cosine similarity search over embeddings
CREATE INDEX IF NOT EXISTS plan_text_chunks_embedding_idx
  ON plan_text_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMENT ON TABLE plan_text_chunks IS 'Embedded text snippets extracted from plan files for Plan Chat retrieval';
COMMENT ON COLUMN plan_text_chunks.snippet_text IS 'Raw text snippet extracted from the plan';
COMMENT ON COLUMN plan_text_chunks.embedding IS 'Vector embedding of the text snippet used for similarity search';

-- ============================================================================
-- VECTOR SEARCH HELPER FUNCTION
-- Provides a convenient RPC for retrieving the most similar chunks
-- ============================================================================
DROP FUNCTION IF EXISTS match_plan_text_chunks;

CREATE OR REPLACE FUNCTION match_plan_text_chunks(
  p_plan_id UUID,
  p_query_embedding VECTOR(1536),
  p_match_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  page_number INTEGER,
  snippet_text TEXT,
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ptc.id,
    ptc.page_number,
    ptc.snippet_text,
    ptc.metadata,
    1 - (ptc.embedding <=> p_query_embedding) AS similarity
  FROM plan_text_chunks ptc
  WHERE ptc.plan_id = p_plan_id
  ORDER BY ptc.embedding <=> p_query_embedding
  LIMIT GREATEST(COALESCE(p_match_limit, 6), 1);
$$;

COMMENT ON FUNCTION match_plan_text_chunks IS 'Returns the closest plan_text_chunks rows for a given plan using cosine similarity';

