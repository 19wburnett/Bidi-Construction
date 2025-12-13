-- Make bid-attachments bucket publicly viewable/downloadable
-- This allows anyone to view or download files from the bid-attachments bucket

-- Update the bucket to be public (allows direct URL access)
UPDATE storage.buckets
SET public = true
WHERE id = 'bid-attachments';

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view bid attachments for their bids" ON storage.objects;

-- Create a new policy that allows public SELECT (view/download) access
-- This allows anyone (authenticated or not) to view/download files
CREATE POLICY "Public can view bid attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bid-attachments');

-- Note: INSERT and DELETE policies remain restricted for security
-- Only authenticated users can upload/delete, but anyone can view/download

