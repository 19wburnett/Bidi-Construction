-- Migration: Add 'collecting_bids' status to job_requests table
-- Run this in your Supabase SQL editor

-- Update the status check constraint to include 'collecting_bids'
ALTER TABLE job_requests DROP CONSTRAINT IF EXISTS job_requests_status_check;
ALTER TABLE job_requests ADD CONSTRAINT job_requests_status_check 
  CHECK (status IN ('active', 'closed', 'collecting_bids'));

-- Add a column to track when bid collection started
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS bid_collection_started_at TIMESTAMP WITH TIME ZONE;

-- Add a column to track when bid collection should stop (for demo mode)
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS bid_collection_ends_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance when filtering by collecting_bids status
CREATE INDEX IF NOT EXISTS idx_job_requests_collecting_bids ON job_requests(status) 
  WHERE status = 'collecting_bids';

-- Create a function to start bid collection for a job
CREATE OR REPLACE FUNCTION start_bid_collection(job_id UUID, collection_duration_minutes INTEGER DEFAULT 5)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE job_requests 
  SET status = 'collecting_bids',
      bid_collection_started_at = NOW(),
      bid_collection_ends_at = NOW() + (collection_duration_minutes || ' minutes')::INTERVAL
  WHERE id = job_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to stop bid collection for a job
CREATE OR REPLACE FUNCTION stop_bid_collection(job_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE job_requests 
  SET status = 'active',
      bid_collection_ends_at = NOW()
  WHERE id = job_id AND status = 'collecting_bids';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to automatically move jobs from collecting_bids to active after timeout
CREATE OR REPLACE FUNCTION check_bid_collection_timeouts()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE job_requests 
  SET status = 'active'
  WHERE status = 'collecting_bids' 
    AND bid_collection_ends_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


