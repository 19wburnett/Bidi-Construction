-- Extend plan_drawings table to support analysis markers
-- This allows linking markers to takeoff and quality analysis items

ALTER TABLE plan_drawings 
ADD COLUMN IF NOT EXISTS note_data JSONB,
ADD COLUMN IF NOT EXISTS analysis_item_id TEXT,
ADD COLUMN IF NOT EXISTS analysis_type TEXT CHECK (analysis_type IN ('takeoff', 'quality', NULL));

-- Add index for faster queries when loading analysis markers
CREATE INDEX IF NOT EXISTS idx_plan_drawings_analysis ON plan_drawings(analysis_item_id, analysis_type) 
WHERE analysis_item_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN plan_drawings.analysis_item_id IS 'Links this marker to a specific takeoff or quality analysis item';
COMMENT ON COLUMN plan_drawings.analysis_type IS 'Type of analysis this marker belongs to: takeoff or quality';
COMMENT ON COLUMN plan_drawings.note_data IS 'JSON data for note-type drawings with type, category, location, content';


