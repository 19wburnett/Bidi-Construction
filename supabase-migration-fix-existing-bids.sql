-- Fix existing bids that were created before the status column was added
-- Set their status to 'pending' if it's currently NULL

UPDATE bids 
SET status = 'pending' 
WHERE status IS NULL;

-- Verify the update
-- This should return 0 rows after the update
-- SELECT COUNT(*) FROM bids WHERE status IS NULL;
