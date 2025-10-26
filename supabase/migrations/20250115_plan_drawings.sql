-- Create plan_drawings table for storing PDF markup and comments
CREATE TABLE IF NOT EXISTS plan_drawings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drawing_data JSONB NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_plan_drawings_plan_id ON plan_drawings(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_drawings_user_id ON plan_drawings(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_drawings_page_number ON plan_drawings(page_number);
CREATE INDEX IF NOT EXISTS idx_plan_drawings_created_at ON plan_drawings(created_at);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_plan_drawings_plan_user ON plan_drawings(plan_id, user_id);

-- Enable RLS
ALTER TABLE plan_drawings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own plan drawings" ON plan_drawings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plan drawings" ON plan_drawings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plan drawings" ON plan_drawings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plan drawings" ON plan_drawings
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_plan_drawings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_plan_drawings_updated_at
  BEFORE UPDATE ON plan_drawings
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_drawings_updated_at();

-- Add comments for documentation
COMMENT ON TABLE plan_drawings IS 'Stores PDF markup drawings and comments for construction plans';
COMMENT ON COLUMN plan_drawings.drawing_data IS 'JSONB containing drawing properties (type, coordinates, style, etc.)';
COMMENT ON COLUMN plan_drawings.page_number IS 'Page number where the drawing is located (1-indexed)';
