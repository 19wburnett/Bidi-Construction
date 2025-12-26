-- Add profile_picture_url column to subcontractors table
-- This stores the URL to the subcontractor's logo, profile picture, or favicon

ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN subcontractors.profile_picture_url IS 'URL to subcontractor logo, profile picture, or favicon';





