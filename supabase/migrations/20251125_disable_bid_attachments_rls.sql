
-- Disable RLS on bid_attachments table (makes it public to all authenticated users)
ALTER TABLE bid_attachments DISABLE ROW LEVEL SECURITY;

-- Clean up the policies we just created
DROP POLICY IF EXISTS "Users can view attachments for their bids" ON bid_attachments;
DROP POLICY IF EXISTS "Users can insert attachments for their bids" ON bid_attachments;
DROP POLICY IF EXISTS "Users can delete attachments for their bids" ON bid_attachments;


