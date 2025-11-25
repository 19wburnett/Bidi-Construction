-- Migration: Add contact_id to bids table to reference gc_contacts
-- This allows bids to be directly linked to GC contacts without creating subcontractor records

-- Add contact_id column to bids table
ALTER TABLE bids 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES gc_contacts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_bids_contact_id ON bids(contact_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN bids.contact_id IS 'References gc_contacts table. A bid can be linked to either a subcontractor (subcontractor_id) or a GC contact (contact_id).';

