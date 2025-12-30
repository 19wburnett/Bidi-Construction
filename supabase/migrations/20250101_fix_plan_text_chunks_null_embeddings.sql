-- Migration: Fix plan_text_chunks vector search to handle NULL embeddings
-- This fixes the issue where chunks without embeddings cause vector search to fail

-- ============================================================================
-- FIX VECTOR SEARCH FUNCTION
-- Add filter to exclude NULL embeddings from similarity search
-- ============================================================================
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
    AND ptc.embedding IS NOT NULL  -- CRITICAL: Filter out NULL embeddings
  ORDER BY ptc.embedding <=> p_query_embedding
  LIMIT GREATEST(COALESCE(p_match_limit, 6), 1);
$$;

COMMENT ON FUNCTION match_plan_text_chunks IS 'Returns the closest plan_text_chunks rows for a given plan using cosine similarity. Only includes chunks with embeddings.';

-- ============================================================================
-- ADD INDEX FOR NULL EMBEDDING CHECKS (helps with diagnostics)
-- ============================================================================
CREATE INDEX IF NOT EXISTS plan_text_chunks_embedding_null_idx
  ON plan_text_chunks(plan_id, (embedding IS NULL))
  WHERE embedding IS NULL;

COMMENT ON INDEX plan_text_chunks_embedding_null_idx IS 'Helps quickly identify plans with chunks missing embeddings';





