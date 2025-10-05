-- Add profile picture, Google rating, and review count to bids table
-- This allows us to display contractor reputation information in bid cards

-- Add columns to bids table
ALTER TABLE bids
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2, 1),
ADD COLUMN IF NOT EXISTS google_review_count INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN bids.profile_picture_url IS 'URL to contractor profile picture/logo';
COMMENT ON COLUMN bids.google_rating IS 'Google Business rating (0.0 to 5.0)';
COMMENT ON COLUMN bids.google_review_count IS 'Number of Google reviews';

-- Create index for querying highly-rated contractors
CREATE INDEX IF NOT EXISTS idx_bids_google_rating ON bids(google_rating DESC) WHERE google_rating IS NOT NULL;
