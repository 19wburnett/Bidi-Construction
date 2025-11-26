
-- Enable RLS on bid_attachments table
ALTER TABLE bid_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view attachments if they own the job the bid belongs to
CREATE POLICY "Users can view attachments for their bids"
  ON bid_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM bids b
      JOIN jobs j ON b.job_id = j.id
      WHERE b.id = bid_attachments.bid_id
      AND j.user_id = auth.uid()
    )
  );

-- Policy: Users can insert attachments if they own the job
CREATE POLICY "Users can insert attachments for their bids"
  ON bid_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM bids b
      JOIN jobs j ON b.job_id = j.id
      WHERE b.id = bid_attachments.bid_id
      AND j.user_id = auth.uid()
    )
  );

-- Policy: Users can delete attachments if they own the job
CREATE POLICY "Users can delete attachments for their bids"
  ON bid_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM bids b
      JOIN jobs j ON b.job_id = j.id
      WHERE b.id = bid_attachments.bid_id
      AND j.user_id = auth.uid()
    )
  );





