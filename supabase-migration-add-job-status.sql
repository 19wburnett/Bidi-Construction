-- Add status field to job_requests table
-- This migration adds a status field to track whether a job is active or closed

-- Add status column to job_requests table
ALTER TABLE job_requests 
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed'));

-- Create index for better performance when filtering by status
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);

-- Update existing job requests to have 'active' status (they should already be active by default)
UPDATE job_requests SET status = 'active' WHERE status IS NULL;
