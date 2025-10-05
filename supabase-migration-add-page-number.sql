-- Migration: Add page_number field to bid_notes table
-- This allows subcontractors to specify which page of the plan their note refers to

ALTER TABLE bid_notes 
ADD COLUMN page_number INTEGER;

-- Add index for better query performance
CREATE INDEX idx_bid_notes_page_number ON bid_notes(page_number);

-- Add comment for documentation
COMMENT ON COLUMN bid_notes.page_number IS 'Optional page number reference for plan annotations. If specified, the note can be auto-placed on that page.';
