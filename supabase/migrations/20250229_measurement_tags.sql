-- Migration: Add measurement tags system
-- This allows tagging measurements with custom labels and colors (e.g., "LVP Flooring", "Drywall")
-- Tags are per-plan and can be used to group and total measurements

-- Create plan_measurement_tags table
CREATE TABLE IF NOT EXISTS plan_measurement_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_user_id UUID REFERENCES guest_users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure tag names are unique per plan
  CONSTRAINT plan_measurement_tags_plan_name_unique UNIQUE (plan_id, name),
  
  -- Ensure either user_id or guest_user_id is set (but not both)
  CONSTRAINT plan_measurement_tags_user_check CHECK (
    (user_id IS NOT NULL AND guest_user_id IS NULL) OR
    (user_id IS NULL AND guest_user_id IS NOT NULL)
  )
);

-- Add measurement_tag column to plan_drawings
ALTER TABLE plan_drawings 
ADD COLUMN IF NOT EXISTS measurement_tag JSONB;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_plan_measurement_tags_plan_id ON plan_measurement_tags(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_measurement_tags_user_id ON plan_measurement_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_measurement_tags_guest_user_id ON plan_measurement_tags(guest_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_drawings_measurement_tag ON plan_drawings USING GIN (measurement_tag);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_plan_measurement_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_plan_measurement_tags_updated_at
  BEFORE UPDATE ON plan_measurement_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_measurement_tags_updated_at();

-- Enable RLS on plan_measurement_tags
ALTER TABLE plan_measurement_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plan_measurement_tags
-- Users can view tags for plans they have access to
CREATE POLICY "Users can view measurement tags for accessible plans"
  ON plan_measurement_tags FOR SELECT
  USING (
    plan_id IN (
      SELECT id FROM plans WHERE 
        user_id = auth.uid() OR
        job_id IN (
          SELECT job_id FROM job_members WHERE user_id = auth.uid()
        )
    )
    OR guest_user_id IN (
      SELECT id FROM guest_users WHERE session_token = current_setting('app.guest_session_token', true)
    )
  );

-- Users can insert tags for plans they have access to
CREATE POLICY "Users can insert measurement tags for accessible plans"
  ON plan_measurement_tags FOR INSERT
  WITH CHECK (
    plan_id IN (
      SELECT id FROM plans WHERE 
        user_id = auth.uid() OR
        job_id IN (
          SELECT job_id FROM job_members WHERE user_id = auth.uid()
        )
    )
    AND (
      (user_id = auth.uid() AND guest_user_id IS NULL) OR
      (user_id IS NULL AND guest_user_id IN (
        SELECT id FROM guest_users WHERE session_token = current_setting('app.guest_session_token', true)
      ))
    )
  );

-- Users can update tags they created
CREATE POLICY "Users can update their own measurement tags"
  ON plan_measurement_tags FOR UPDATE
  USING (
    user_id = auth.uid() OR
    guest_user_id IN (
      SELECT id FROM guest_users WHERE session_token = current_setting('app.guest_session_token', true)
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    guest_user_id IN (
      SELECT id FROM guest_users WHERE session_token = current_setting('app.guest_session_token', true)
    )
  );

-- Users can delete tags they created
CREATE POLICY "Users can delete their own measurement tags"
  ON plan_measurement_tags FOR DELETE
  USING (
    user_id = auth.uid() OR
    guest_user_id IN (
      SELECT id FROM guest_users WHERE session_token = current_setting('app.guest_session_token', true)
    )
  );

-- Add comments for documentation
COMMENT ON TABLE plan_measurement_tags IS 'Tags for grouping and categorizing measurements (e.g., "LVP Flooring", "Drywall")';
COMMENT ON COLUMN plan_measurement_tags.name IS 'Tag name (e.g., "LVP Flooring")';
COMMENT ON COLUMN plan_measurement_tags.color IS 'Tag color in hex format (e.g., "#3b82f6")';
COMMENT ON COLUMN plan_drawings.measurement_tag IS 'JSONB containing tag reference: {id, name, color}';