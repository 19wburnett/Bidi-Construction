-- Script to create notifications for existing bids that don't have them
-- This should be run after the migration to ensure all existing bids have notifications

-- First, let's see what bids exist without notifications
SELECT 
  b.id as bid_id,
  b.job_request_id,
  jr.gc_id,
  b.created_at as bid_created_at
FROM bids b
JOIN job_requests jr ON b.job_request_id = jr.id
LEFT JOIN notifications n ON n.bid_id = b.id
WHERE n.id IS NULL
ORDER BY b.created_at DESC;

-- Create notifications for bids that don't have them
INSERT INTO notifications (user_id, bid_id, created_at)
SELECT 
  jr.gc_id,
  b.id,
  b.created_at
FROM bids b
JOIN job_requests jr ON b.job_request_id = jr.id
LEFT JOIN notifications n ON n.bid_id = b.id
WHERE n.id IS NULL;

-- Verify the results
SELECT 
  COUNT(*) as total_bids,
  COUNT(n.id) as bids_with_notifications,
  COUNT(*) - COUNT(n.id) as bids_without_notifications
FROM bids b
JOIN job_requests jr ON b.job_request_id = jr.id
LEFT JOIN notifications n ON n.bid_id = b.id;
