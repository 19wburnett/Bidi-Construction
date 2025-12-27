-- Create storage bucket for subcontractor assets (profile pictures, portfolio photos, etc.)
-- This bucket stores images and other assets related to subcontractors

-- Note: Storage buckets are created via Supabase Dashboard or Storage API
-- This migration documents the bucket configuration but cannot create it directly
-- Run this SQL in Supabase SQL Editor or use the Storage API

-- Bucket name: subcontractor-assets
-- Configuration:
--   - Public: true (so images can be accessed via public URLs)
--   - Allowed MIME types: image/jpeg, image/png, image/webp, image/svg+xml, image/gif, image/x-icon
--   - File size limit: 10MB

-- To create via SQL (if supported):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'subcontractor-assets',
--   'subcontractor-assets',
--   true,
--   10485760, -- 10MB in bytes
--   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for subcontractor-assets bucket
-- Public read access for all files
CREATE POLICY "Public can view subcontractor assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'subcontractor-assets');

-- Admins can upload files
CREATE POLICY "Admins can upload subcontractor assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'subcontractor-assets' AND
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
  )
);

-- Admins can update files
CREATE POLICY "Admins can update subcontractor assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'subcontractor-assets' AND
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
  )
);

-- Admins can delete files
CREATE POLICY "Admins can delete subcontractor assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'subcontractor-assets' AND
  EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true
  )
);

