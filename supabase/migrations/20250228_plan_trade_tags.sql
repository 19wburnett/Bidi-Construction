-- Migration: Plan Trade Tags
-- Created: 2025-02-28
-- Description: Junction table for many-to-many relationship between plans and trade categories

-- Junction table for plans and trade categories
CREATE TABLE IF NOT EXISTS plan_trade_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  trade_category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, trade_category)
);

-- Indexes for performance
CREATE INDEX idx_plan_trade_tags_plan_id ON plan_trade_tags(plan_id);
CREATE INDEX idx_plan_trade_tags_trade_category ON plan_trade_tags(trade_category);

-- Enable Row Level Security
ALTER TABLE plan_trade_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view trade tags for plans they have access to
CREATE POLICY "Users can view trade tags for their plans"
  ON plan_trade_tags FOR SELECT
  USING (
    plan_id IN (
      SELECT id FROM plans 
      WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
        UNION
        SELECT job_id FROM job_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can create trade tags for plans they have access to
CREATE POLICY "Users can create trade tags for their plans"
  ON plan_trade_tags FOR INSERT
  WITH CHECK (
    plan_id IN (
      SELECT id FROM plans 
      WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
        UNION
        SELECT job_id FROM job_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can delete trade tags for plans they have access to
CREATE POLICY "Users can delete trade tags for their plans"
  ON plan_trade_tags FOR DELETE
  USING (
    plan_id IN (
      SELECT id FROM plans 
      WHERE job_id IN (
        SELECT id FROM jobs WHERE user_id = auth.uid()
        UNION
        SELECT job_id FROM job_members WHERE user_id = auth.uid()
      )
    )
  );

-- Add comments for documentation
COMMENT ON TABLE plan_trade_tags IS 'Junction table linking plans to trade categories (many-to-many)';
COMMENT ON COLUMN plan_trade_tags.trade_category IS 'Trade category name (e.g., Electrical, Plumbing, Framing)';
