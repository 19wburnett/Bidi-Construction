-- Migration: Custom Trades Table
-- Allows users to add custom trade categories beyond the base list

-- Create custom_trades table
CREATE TABLE IF NOT EXISTS custom_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on name for lookups
CREATE INDEX IF NOT EXISTS idx_custom_trades_name ON custom_trades(name);
CREATE INDEX IF NOT EXISTS idx_custom_trades_created_by ON custom_trades(created_by);

-- Enable Row Level Security
ALTER TABLE custom_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All users can read, only creators can insert/update/delete
CREATE POLICY "All users can view custom trades"
  ON custom_trades FOR SELECT
  USING (true);

CREATE POLICY "Users can create custom trades"
  ON custom_trades FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own custom trades"
  ON custom_trades FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own custom trades"
  ON custom_trades FOR DELETE
  USING (auth.uid() = created_by);

