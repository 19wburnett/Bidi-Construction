-- Migration for bid acceptance workflow
-- This enables accepting bids, declining others, and tracking acceptance status

-- Add status and acceptance tracking to bids table
ALTER TABLE bids
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Add constraint to ensure valid status values
ALTER TABLE bids
ADD CONSTRAINT bids_status_check 
CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn'));

-- Add accepted_bid_id to job_requests to track which bid was accepted
ALTER TABLE job_requests
ADD COLUMN IF NOT EXISTS accepted_bid_id UUID REFERENCES bids(id),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Update status constraint to include more statuses
ALTER TABLE job_requests
DROP CONSTRAINT IF EXISTS job_requests_status_check;

ALTER TABLE job_requests
ADD CONSTRAINT job_requests_status_check 
CHECK (status IN ('active', 'closed', 'cancelled', 'expired'));

-- Create document templates table for storing user templates
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL, -- 'master_sub_agreement' or 'coi'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, template_type) -- One template per type per user
);

-- Create accepted bid documents table
CREATE TABLE IF NOT EXISTS accepted_bid_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  job_request_id UUID NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'master_sub_agreement' or 'coi'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_bid_document UNIQUE(bid_id, document_type)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
CREATE INDEX IF NOT EXISTS idx_bids_accepted_at ON bids(accepted_at) WHERE accepted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_requests_accepted_bid ON job_requests(accepted_bid_id) WHERE accepted_bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_templates_user ON document_templates(user_id, template_type);
CREATE INDEX IF NOT EXISTS idx_accepted_bid_documents_bid ON accepted_bid_documents(bid_id);

-- Add comments for documentation
COMMENT ON COLUMN bids.status IS 'Status of the bid: pending, accepted, declined, withdrawn';
COMMENT ON COLUMN bids.accepted_at IS 'Timestamp when bid was accepted';
COMMENT ON COLUMN bids.declined_at IS 'Timestamp when bid was declined';
COMMENT ON COLUMN bids.decline_reason IS 'Optional reason for declining the bid';
COMMENT ON COLUMN job_requests.accepted_bid_id IS 'Reference to the accepted bid';
COMMENT ON COLUMN job_requests.closed_at IS 'Timestamp when job request was closed';
COMMENT ON TABLE document_templates IS 'User document templates for master sub agreements and COIs';
COMMENT ON TABLE accepted_bid_documents IS 'Documents uploaded when accepting a bid';

-- Create function to automatically update job_request status when bid is accepted
CREATE OR REPLACE FUNCTION update_job_request_on_bid_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Update the job request
    UPDATE job_requests
    SET 
      status = 'closed',
      accepted_bid_id = NEW.id,
      closed_at = NEW.accepted_at
    WHERE id = NEW.job_request_id;
    
    -- Decline all other bids for this job
    UPDATE bids
    SET 
      status = 'declined',
      declined_at = NEW.accepted_at,
      decline_reason = 'Another bid was accepted'
    WHERE job_request_id = NEW.job_request_id
      AND id != NEW.id
      AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bid acceptance
DROP TRIGGER IF EXISTS trigger_bid_acceptance ON bids;
CREATE TRIGGER trigger_bid_acceptance
  AFTER UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION update_job_request_on_bid_acceptance();
