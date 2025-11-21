-- Migration: Add last_viewed_at to job_members
-- Purpose: Track when a user last viewed a job to sort the dashboard by "Recently Opened"

ALTER TABLE job_members 
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- Initialize last_viewed_at with created_at for existing records
UPDATE job_members 
SET last_viewed_at = created_at 
WHERE last_viewed_at IS NULL;

