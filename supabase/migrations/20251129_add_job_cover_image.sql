-- Add cover image path to jobs table
-- This allows users to upload a cover photo for each project

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cover_image_path TEXT;

COMMENT ON COLUMN jobs.cover_image_path IS 'Storage path for the job cover image in job-covers bucket';

-- Create storage bucket for job cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-covers', 'job-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job-covers bucket
-- Users can upload cover images for their own jobs
CREATE POLICY "Users can upload job cover images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job-covers' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view job cover images (public bucket, but policy for consistency)
CREATE POLICY "Anyone can view job cover images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-covers');

-- Users can update their own job cover images
CREATE POLICY "Users can update their own job cover images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'job-covers' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own job cover images
CREATE POLICY "Users can delete their own job cover images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-covers' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

