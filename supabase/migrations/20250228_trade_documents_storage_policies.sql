-- Migration: Storage Policies for Trade Documents
-- Created: 2025-02-28
-- Description: RLS policies for trade documents stored in job-plans bucket

-- Note: This assumes the 'job-plans' storage bucket already exists
-- If using a separate 'trade-documents' bucket, create it first in Supabase dashboard

-- Storage policies are managed via Supabase dashboard or SQL
-- These policies allow users to upload/download trade documents for jobs they have access to

-- Policy: Allow authenticated users to upload trade documents for their jobs
-- This is typically set via Supabase dashboard, but can be done via SQL:
-- Note: Storage policies use a different syntax than table RLS policies

-- Example policy (to be set in Supabase Storage settings):
-- Policy Name: "Users can upload trade documents for their jobs"
-- Policy Type: INSERT
-- Target Roles: authenticated
-- USING Expression: 
--   bucket_id = 'job-plans' AND
--   (storage.foldername(name))[1] IN (
--     SELECT id::text FROM jobs WHERE user_id = auth.uid()
--     UNION
--     SELECT job_id::text FROM job_members WHERE user_id = auth.uid()
--   ) AND
--   (storage.foldername(name))[2] = 'trade-documents'

-- Policy: Allow authenticated users to read trade documents for their jobs
-- Policy Name: "Users can read trade documents for their jobs"
-- Policy Type: SELECT
-- Target Roles: authenticated
-- USING Expression:
--   bucket_id = 'job-plans' AND
--   (storage.foldername(name))[1] IN (
--     SELECT id::text FROM jobs WHERE user_id = auth.uid()
--     UNION
--     SELECT job_id::text FROM job_members WHERE user_id = auth.uid()
--   ) AND
--   (storage.foldername(name))[2] = 'trade-documents'

-- Policy: Allow authenticated users to delete trade documents they uploaded
-- Policy Name: "Users can delete trade documents for their jobs"
-- Policy Type: DELETE
-- Target Roles: authenticated
-- USING Expression:
--   bucket_id = 'job-plans' AND
--   (storage.foldername(name))[1] IN (
--     SELECT id::text FROM jobs WHERE user_id = auth.uid()
--     UNION
--     SELECT job_id::text FROM job_members WHERE user_id = auth.uid()
--   ) AND
--   (storage.foldername(name))[2] = 'trade-documents'

-- Note: Storage policies must be created via Supabase Dashboard or using the storage admin API
-- This migration file documents the required policies but they need to be set up manually
-- or via a script that uses the Supabase admin API

COMMENT ON TABLE trade_documents IS 'Trade-specific documents stored in job-plans bucket under {job_id}/trade-documents/{trade_category}/ path';
