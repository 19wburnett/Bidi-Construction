-- Migration to fix job_requests with old 'collecting_bids' status
-- This updates any existing job_requests to use the new allowed status values

-- Update any jobs with 'collecting_bids' status to 'active'
UPDATE job_requests 
SET status = 'active' 
WHERE status = 'collecting_bids';

-- Also fix any other invalid status values to 'active' as the default
-- This ensures all existing data complies with the new check constraint
UPDATE job_requests 
SET status = 'active' 
WHERE status NOT IN ('active', 'closed', 'cancelled', 'expired') 
   OR status IS NULL;

-- For jobs that have a bid_collection_started_at but no ends_at,
-- set ends_at to started_at + 5 minutes (the default collection period)
-- This handles jobs that were interrupted during migration
UPDATE job_requests
SET bid_collection_ends_at = bid_collection_started_at + INTERVAL '5 minutes'
WHERE status = 'active'
  AND bid_collection_started_at IS NOT NULL
  AND bid_collection_ends_at IS NULL;

-- For jobs that are 'active' but don't have bid_collection timestamps at all,
-- set ends_at to now (so they stop showing as "collecting bids")
-- This handles old jobs that were created before the bid collection system
UPDATE job_requests
SET bid_collection_ends_at = NOW()
WHERE status = 'active'
  AND bid_collection_ends_at IS NULL;