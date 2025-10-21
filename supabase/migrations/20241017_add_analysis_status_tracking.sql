-- Add status tracking columns for manual analysis workflow
-- This allows tracking when analysis is requested and its current status

ALTER TABLE plans
ADD COLUMN IF NOT EXISTS takeoff_analysis_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS takeoff_requested_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS quality_analysis_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS quality_requested_at TIMESTAMPTZ DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN plans.takeoff_analysis_status IS 'Status of takeoff analysis: pending, completed, or NULL (not requested)';
COMMENT ON COLUMN plans.takeoff_requested_at IS 'Timestamp when takeoff analysis was requested';
COMMENT ON COLUMN plans.quality_analysis_status IS 'Status of quality analysis: pending, completed, or NULL (not requested)';
COMMENT ON COLUMN plans.quality_requested_at IS 'Timestamp when quality analysis was requested';

-- Create index for filtering plans by status
CREATE INDEX IF NOT EXISTS idx_plans_takeoff_status ON plans(takeoff_analysis_status) WHERE takeoff_analysis_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_quality_status ON plans(quality_analysis_status) WHERE quality_analysis_status IS NOT NULL;

-- Add RLS policies (if not already present) to allow users to see their own plan status
-- This assumes RLS is already enabled on the plans table


