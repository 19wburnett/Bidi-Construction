-- Fix bid acceptance trigger to work with new job-centric schema
-- The old trigger referenced job_request_id which no longer exists

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS trigger_bid_acceptance ON bids;
DROP FUNCTION IF EXISTS update_job_request_on_bid_acceptance();

-- Create new function that works with job_id instead of job_request_id
-- Note: Since multiple bids can be accepted for different trades, we don't auto-decline other bids
CREATE OR REPLACE FUNCTION update_job_on_bid_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- When a bid is accepted, we just log it
  -- The API handles the business logic (multiple bids can be accepted)
  -- This function exists to prevent errors, but doesn't need to do anything
  -- since we're handling acceptance logic in the application layer
  
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Just ensure the bid has a job_id (should already be set)
    -- No automatic actions needed since multiple bids can be accepted
    NULL; -- Do nothing, but this prevents the trigger from erroring
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bid acceptance (if needed for future functionality)
-- Currently it's a no-op, but keeps the trigger structure in place
CREATE TRIGGER trigger_bid_acceptance
  AFTER UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION update_job_on_bid_acceptance();

-- Fix accepted_bid_documents table to use job_id instead of job_request_id
-- Check if job_request_id column exists and migrate to job_id
DO $$
BEGIN
  -- Check if job_request_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accepted_bid_documents' 
    AND column_name = 'job_request_id'
  ) THEN
    -- Add job_id column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'accepted_bid_documents' 
      AND column_name = 'job_id'
    ) THEN
      ALTER TABLE accepted_bid_documents 
      ADD COLUMN job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;
      
      -- Migrate data from job_request_id to job_id if possible
      -- (This assumes job_requests table still exists with job_id column)
      UPDATE accepted_bid_documents abd
      SET job_id = jr.job_id
      FROM job_requests jr
      WHERE abd.job_request_id = jr.id
      AND abd.job_id IS NULL
      AND jr.job_id IS NOT NULL;
      
      -- Also try to get job_id from the bid itself
      UPDATE accepted_bid_documents abd
      SET job_id = b.job_id
      FROM bids b
      WHERE abd.bid_id = b.id
      AND abd.job_id IS NULL
      AND b.job_id IS NOT NULL;
    END IF;
    
    -- Make job_id NOT NULL if all rows have been migrated
    -- (We'll make it nullable for now to avoid errors if migration isn't complete)
    -- ALTER TABLE accepted_bid_documents ALTER COLUMN job_id SET NOT NULL;
    
    -- Drop the old job_request_id column and constraint
    ALTER TABLE accepted_bid_documents DROP CONSTRAINT IF EXISTS accepted_bid_documents_job_request_id_fkey;
    ALTER TABLE accepted_bid_documents DROP COLUMN IF EXISTS job_request_id;
  END IF;
END $$;

