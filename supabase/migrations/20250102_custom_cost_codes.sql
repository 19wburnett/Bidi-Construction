-- Migration: Custom Cost Codes Feature
-- Allows users to upload custom cost code documents (PDF/Excel) and use them in takeoffs

-- Create custom_cost_codes table
CREATE TABLE IF NOT EXISTS custom_cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- User-friendly name for the cost code set
  file_name TEXT NOT NULL, -- Original uploaded file name
  file_path TEXT NOT NULL, -- Storage path
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'excel')), -- 'pdf' or 'excel'
  is_default BOOLEAN DEFAULT false, -- Only one per user can be default
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')), -- Status of extraction
  extraction_error TEXT, -- Error message if extraction failed
  cost_codes JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of extracted cost codes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup of user's default cost codes
CREATE INDEX IF NOT EXISTS idx_custom_cost_codes_user_default ON custom_cost_codes(user_id, is_default) WHERE is_default = true;

-- Constraint: Only one default per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_cost_codes_one_default_per_user ON custom_cost_codes(user_id) WHERE is_default = true;

-- Index for user's cost code sets
CREATE INDEX IF NOT EXISTS idx_custom_cost_codes_user_id ON custom_cost_codes(user_id);

-- Add column to users table to track if user is using custom cost codes
ALTER TABLE users ADD COLUMN IF NOT EXISTS use_custom_cost_codes BOOLEAN DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN users.use_custom_cost_codes IS 'Whether the user has custom cost codes set as default';

-- Add comments to custom_cost_codes table
COMMENT ON TABLE custom_cost_codes IS 'User-uploaded custom cost code documents and extracted codes';
COMMENT ON COLUMN custom_cost_codes.cost_codes IS 'JSONB array of cost codes with structure: [{division, code, description, fullCode}]';
COMMENT ON COLUMN custom_cost_codes.extraction_status IS 'Status of AI extraction: pending, processing, completed, or failed';

-- Enable RLS
ALTER TABLE custom_cost_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own cost codes
CREATE POLICY "Users can view their own custom cost codes"
  ON custom_cost_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own cost codes
CREATE POLICY "Users can insert their own custom cost codes"
  ON custom_cost_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own cost codes
CREATE POLICY "Users can update their own custom cost codes"
  ON custom_cost_codes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own cost codes
CREATE POLICY "Users can delete their own custom cost codes"
  ON custom_cost_codes
  FOR DELETE
  USING (auth.uid() = user_id);
