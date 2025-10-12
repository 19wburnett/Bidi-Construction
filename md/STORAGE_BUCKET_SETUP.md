# Storage Bucket Setup for Bid Acceptance

To use the bid acceptance and document template features, you need to create a storage bucket in Supabase.

## Steps to Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Set the following:
   - **Name**: `bid-documents`
   - **Public bucket**: ✅ **Yes** (Enable)
   - **Allowed MIME types**: Leave empty for all types
   - **File size limit**: 10 MB (or your preferred limit)

5. Click **Create bucket**

## Storage Policies

After creating the bucket, set up the following RLS policies:

### Policy 1: Allow authenticated users to upload
```sql
-- Allow users to upload their own documents
CREATE POLICY "Users can upload bid documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'bid-documents' AND
  (storage.foldername(name))[1] IN (
    'templates/' || auth.uid()::text,
    (SELECT id::text FROM job_requests WHERE gc_id = auth.uid())
  )
);
```

### Policy 2: Allow authenticated users to read
```sql
-- Allow users to read their own documents
CREATE POLICY "Users can read bid documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bid-documents' AND
  (
    -- User's own templates
    (storage.foldername(name))[1] = 'templates/' || auth.uid()::text
    OR
    -- Documents from their job requests
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM job_requests WHERE gc_id = auth.uid()
    )
  )
);
```

### Policy 3: Allow users to delete their own documents
```sql
-- Allow users to delete their own documents
CREATE POLICY "Users can delete bid documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bid-documents' AND
  (storage.foldername(name))[1] = 'templates/' || auth.uid()::text
);
```

## Folder Structure

The bucket uses the following folder structure:
- `templates/{user_id}/` - User's document templates
- `{job_request_id}/` - Documents uploaded when accepting a specific bid

## Supported File Types

The following file types are accepted:
- PDF (`.pdf`)
- Microsoft Word (`.doc`, `.docx`)


