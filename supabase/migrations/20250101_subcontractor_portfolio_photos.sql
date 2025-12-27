-- Migration: Create subcontractor portfolio photos table and add profile columns
-- Purpose: Support portfolio photo galleries and extended profile information

-- Create the subcontractor_portfolio_photos table
CREATE TABLE IF NOT EXISTS subcontractor_portfolio_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_subcontractor_portfolio_photos_subcontractor_id 
  ON subcontractor_portfolio_photos(subcontractor_id);

CREATE INDEX IF NOT EXISTS idx_subcontractor_portfolio_photos_display_order 
  ON subcontractor_portfolio_photos(subcontractor_id, display_order);

CREATE INDEX IF NOT EXISTS idx_subcontractor_portfolio_photos_is_primary 
  ON subcontractor_portfolio_photos(subcontractor_id, is_primary) 
  WHERE is_primary = true;

-- Add new columns to subcontractors table
ALTER TABLE subcontractors 
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS service_radius INTEGER,
  ADD COLUMN IF NOT EXISTS year_established INTEGER;

-- Add comments for documentation
COMMENT ON TABLE subcontractor_portfolio_photos IS 'Stores portfolio photos for subcontractor profiles';
COMMENT ON COLUMN subcontractor_portfolio_photos.image_url IS 'Public URL to the image in Supabase Storage';
COMMENT ON COLUMN subcontractor_portfolio_photos.storage_path IS 'Storage path for deletion purposes';
COMMENT ON COLUMN subcontractor_portfolio_photos.caption IS 'Optional caption/description for the photo';
COMMENT ON COLUMN subcontractor_portfolio_photos.display_order IS 'Order in which photos should be displayed in gallery';
COMMENT ON COLUMN subcontractor_portfolio_photos.is_primary IS 'Whether this is the primary/cover photo';
COMMENT ON COLUMN subcontractors.bio IS 'Extended bio/description of the subcontractor company';
COMMENT ON COLUMN subcontractors.service_radius IS 'Service radius in miles from location';
COMMENT ON COLUMN subcontractors.year_established IS 'Year the company was established';

-- Enable RLS
ALTER TABLE subcontractor_portfolio_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies: Public read, admin/subcontractor write
CREATE POLICY "Anyone can view portfolio photos" ON subcontractor_portfolio_photos
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert portfolio photos" ON subcontractor_portfolio_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can update portfolio photos" ON subcontractor_portfolio_photos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

CREATE POLICY "Admins can delete portfolio photos" ON subcontractor_portfolio_photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_subcontractor_portfolio_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_subcontractor_portfolio_photos_updated_at ON subcontractor_portfolio_photos;
CREATE TRIGGER trigger_update_subcontractor_portfolio_photos_updated_at
  BEFORE UPDATE ON subcontractor_portfolio_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_subcontractor_portfolio_photos_updated_at();

-- Ensure only one primary photo per subcontractor
CREATE OR REPLACE FUNCTION ensure_single_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Unset other primary photos for this subcontractor
    UPDATE subcontractor_portfolio_photos
    SET is_primary = false
    WHERE subcontractor_id = NEW.subcontractor_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_primary_photo ON subcontractor_portfolio_photos;
CREATE TRIGGER trigger_ensure_single_primary_photo
  BEFORE INSERT OR UPDATE ON subcontractor_portfolio_photos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_photo();

