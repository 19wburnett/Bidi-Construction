-- Create table for storing bid comparison analyses
CREATE TABLE IF NOT EXISTS bid_comparison_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comparison_type TEXT NOT NULL CHECK (comparison_type IN ('bid_to_bid', 'takeoff')),
  selected_bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  comparison_bid_ids UUID[] DEFAULT ARRAY[]::UUID[], -- For bid-to-bid comparisons
  takeoff_items_hash TEXT, -- Hash of takeoff items for takeoff comparisons
  comparison_bid_ids_text TEXT, -- Text representation of sorted bid IDs for unique constraint
  matches JSONB NOT NULL,
  analysis JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint for caching (using text representation of array)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bid_comparison_analyses_unique
  ON bid_comparison_analyses(comparison_type, selected_bid_id, comparison_bid_ids_text, takeoff_items_hash);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bid_comparison_analyses_selected_bid 
  ON bid_comparison_analyses(selected_bid_id);

CREATE INDEX IF NOT EXISTS idx_bid_comparison_analyses_type_bid 
  ON bid_comparison_analyses(comparison_type, selected_bid_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_bid_comparison_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bid_comparison_analyses_updated_at
  BEFORE UPDATE ON bid_comparison_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_bid_comparison_analyses_updated_at();

-- Create function for upserting comparison analyses
CREATE OR REPLACE FUNCTION upsert_bid_comparison_analysis(
  p_comparison_type TEXT,
  p_selected_bid_id UUID,
  p_comparison_bid_ids UUID[],
  p_takeoff_items_hash TEXT,
  p_matches JSONB,
  p_analysis JSONB
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_bid_ids_text TEXT;
BEGIN
  -- Convert sorted array to text for unique constraint
  SELECT array_to_string(ARRAY(SELECT unnest(p_comparison_bid_ids) ORDER BY 1), ',') INTO v_bid_ids_text;
  IF v_bid_ids_text IS NULL THEN
    v_bid_ids_text := '';
  END IF;
  
  INSERT INTO bid_comparison_analyses (
    comparison_type,
    selected_bid_id,
    comparison_bid_ids,
    comparison_bid_ids_text,
    takeoff_items_hash,
    matches,
    analysis
  )
  VALUES (
    p_comparison_type,
    p_selected_bid_id,
    p_comparison_bid_ids,
    v_bid_ids_text,
    p_takeoff_items_hash,
    p_matches,
    p_analysis
  )
  ON CONFLICT (comparison_type, selected_bid_id, comparison_bid_ids_text, takeoff_items_hash)
  DO UPDATE SET
    matches = EXCLUDED.matches,
    analysis = EXCLUDED.analysis,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies
ALTER TABLE bid_comparison_analyses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read analyses for bids in their jobs
CREATE POLICY "Users can read bid comparison analyses"
  ON bid_comparison_analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bids b
      JOIN jobs j ON j.id = b.job_id
      WHERE b.id = bid_comparison_analyses.selected_bid_id
      AND (
        j.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM job_members jm
          WHERE jm.job_id = j.id
          AND jm.user_id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can insert analyses for bids in their jobs
CREATE POLICY "Users can insert bid comparison analyses"
  ON bid_comparison_analyses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bids b
      JOIN jobs j ON j.id = b.job_id
      WHERE b.id = bid_comparison_analyses.selected_bid_id
      AND (
        j.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM job_members jm
          WHERE jm.job_id = j.id
          AND jm.user_id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can update analyses for bids in their jobs
CREATE POLICY "Users can update bid comparison analyses"
  ON bid_comparison_analyses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bids b
      JOIN jobs j ON j.id = b.job_id
      WHERE b.id = bid_comparison_analyses.selected_bid_id
      AND (
        j.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM job_members jm
          WHERE jm.job_id = j.id
          AND jm.user_id = auth.uid()
        )
      )
    )
  );

