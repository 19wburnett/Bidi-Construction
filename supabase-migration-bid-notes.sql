-- Migration: Add bid_notes table for categorized note extraction
-- This table will store individual notes extracted from bid emails with categorization

CREATE TABLE IF NOT EXISTS bid_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL CHECK (note_type IN ('requirement', 'concern', 'suggestion', 'timeline', 'material', 'other')),
  category TEXT, -- e.g., 'shower', 'electrical', 'plumbing', 'flooring', 'kitchen', 'bathroom'
  location TEXT, -- e.g., 'master_bathroom', 'kitchen', 'basement', 'upstairs'
  content TEXT NOT NULL,
  confidence_score FLOAT DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_bid_notes_bid_id ON bid_notes(bid_id);
CREATE INDEX idx_bid_notes_note_type ON bid_notes(note_type);
CREATE INDEX idx_bid_notes_category ON bid_notes(category);
CREATE INDEX idx_bid_notes_location ON bid_notes(location);
CREATE INDEX idx_bid_notes_confidence ON bid_notes(confidence_score);

-- Add RLS (Row Level Security) policies
ALTER TABLE bid_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see bid_notes for their own job requests
CREATE POLICY "Users can view bid_notes for their own job requests" ON bid_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bids 
      JOIN job_requests ON bids.job_request_id = job_requests.id 
      WHERE bids.id = bid_notes.bid_id 
      AND job_requests.gc_id = auth.uid()
    )
  );

-- Policy: System can insert bid_notes (for AI processing)
CREATE POLICY "System can insert bid_notes" ON bid_notes
  FOR INSERT WITH CHECK (true);

-- Policy: System can update bid_notes (for AI processing)
CREATE POLICY "System can update bid_notes" ON bid_notes
  FOR UPDATE USING (true);

-- Add a view for easier querying with job context
CREATE OR REPLACE VIEW bid_notes_with_context AS
SELECT 
  bn.*,
  b.subcontractor_name,
  b.subcontractor_email,
  jr.trade_category,
  jr.location as job_location,
  jr.description as job_description
FROM bid_notes bn
JOIN bids b ON bn.bid_id = b.id
JOIN job_requests jr ON b.job_request_id = jr.id;

-- Grant access to the view
GRANT SELECT ON bid_notes_with_context TO authenticated;
