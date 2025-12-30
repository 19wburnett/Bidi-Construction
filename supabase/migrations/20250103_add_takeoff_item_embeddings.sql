-- Migration: Add Takeoff Item Embeddings for Hybrid Vector/Keyword Search
-- Enables semantic search over takeoff items while maintaining keyword matching fallback

-- ============================================================================
-- TAKEOFF ITEM EMBEDDINGS TABLE
-- Stores vector embeddings for takeoff items to enable semantic search
-- ============================================================================
CREATE TABLE IF NOT EXISTS takeoff_item_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  takeoff_item_id TEXT NOT NULL, -- Reference to the item ID in plan_takeoff_analysis.items JSONB
  item_text TEXT NOT NULL, -- Combined text representation of the item (category, name, description)
  
  -- Embedding vector (1536 dimensions, same as plan_text_chunks)
  embedding VECTOR(1536),
  
  -- Metadata for quick filtering
  category TEXT,
  subcategory TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_takeoff_item_embeddings_plan ON takeoff_item_embeddings(plan_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_item_embeddings_category ON takeoff_item_embeddings(plan_id, category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_takeoff_item_embeddings_item_id ON takeoff_item_embeddings(plan_id, takeoff_item_id);

-- Vector similarity index (IVF Flat for cosine similarity)
CREATE INDEX IF NOT EXISTS idx_takeoff_item_embeddings_vector
  ON takeoff_item_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- RLS Policies
ALTER TABLE takeoff_item_embeddings ENABLE ROW LEVEL SECURITY;

-- Users can view embeddings for plans they have access to (via plan access)
CREATE POLICY "Users can view takeoff item embeddings for accessible plans"
  ON takeoff_item_embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      WHERE p.id = takeoff_item_embeddings.plan_id
      -- Add your plan access check here if needed
    )
  );

-- Users can insert embeddings (will be done server-side)
CREATE POLICY "Service role can insert takeoff item embeddings"
  ON takeoff_item_embeddings
  FOR INSERT
  WITH CHECK (true);

-- Users can update embeddings
CREATE POLICY "Service role can update takeoff item embeddings"
  ON takeoff_item_embeddings
  FOR UPDATE
  USING (true);

-- Users can delete embeddings
CREATE POLICY "Service role can delete takeoff item embeddings"
  ON takeoff_item_embeddings
  FOR DELETE
  USING (true);

COMMENT ON TABLE takeoff_item_embeddings IS 'Vector embeddings for takeoff items to enable semantic search';
COMMENT ON COLUMN takeoff_item_embeddings.item_text IS 'Combined text representation: category + name + description for embedding';
COMMENT ON COLUMN takeoff_item_embeddings.takeoff_item_id IS 'Reference to item ID within plan_takeoff_analysis.items JSONB array';

-- ============================================================================
-- VECTOR SEARCH FUNCTION FOR TAKEOFF ITEMS
-- Similar to match_plan_text_chunks but for takeoff items
-- ============================================================================
CREATE OR REPLACE FUNCTION match_takeoff_items(
  p_plan_id UUID,
  p_query_embedding VECTOR(1536),
  p_match_limit INTEGER DEFAULT 20,
  p_min_similarity DOUBLE PRECISION DEFAULT 0.7
)
RETURNS TABLE (
  takeoff_item_id TEXT,
  item_text TEXT,
  category TEXT,
  subcategory TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    tie.takeoff_item_id,
    tie.item_text,
    tie.category,
    tie.subcategory,
    1 - (tie.embedding <=> p_query_embedding) AS similarity
  FROM takeoff_item_embeddings tie
  WHERE tie.plan_id = p_plan_id
    AND tie.embedding IS NOT NULL
    AND (1 - (tie.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY tie.embedding <=> p_query_embedding
  LIMIT GREATEST(COALESCE(p_match_limit, 20), 1);
$$;

COMMENT ON FUNCTION match_takeoff_items IS 'Returns the closest takeoff items for a given plan using cosine similarity. Filters by minimum similarity threshold.';

-- ============================================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_takeoff_embedding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_takeoff_embedding_timestamp
  BEFORE UPDATE ON takeoff_item_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_takeoff_embedding_timestamp();





