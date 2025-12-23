-- Migration: Add recipient preferences to job_requests table
-- Run this in your Supabase SQL editor

-- Add columns to job_requests table for recipient preferences
ALTER TABLE job_requests
ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'both' CHECK (recipient_type IN ('contacts_only', 'network_only', 'both', 'selected')),
ADD COLUMN IF NOT EXISTS selected_network_subcontractors TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS selected_contact_subcontractors TEXT[] DEFAULT NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN job_requests.recipient_type IS 'Determines who receives the job request: contacts_only, network_only, both, or selected';
COMMENT ON COLUMN job_requests.selected_network_subcontractors IS 'Array of subcontractor emails from Bidi network to send job request to. NULL means send to all matching network subcontractors.';
COMMENT ON COLUMN job_requests.selected_contact_subcontractors IS 'Array of contact emails from GC contacts to send job request to. NULL means send to all matching contacts.';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_job_requests_recipient_type ON job_requests(recipient_type);
