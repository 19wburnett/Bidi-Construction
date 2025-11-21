-- Migration: Update job status check constraint
-- Description: Adds new statuses 'needs_takeoff', 'needs_packages', 'waiting_for_bids'

ALTER TABLE "public"."jobs" DROP CONSTRAINT IF EXISTS "jobs_status_check";

ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_status_check" 
CHECK (status IN (
  'draft', 
  'active', 
  'completed', 
  'archived', 
  'needs_takeoff', 
  'needs_packages', 
  'waiting_for_bids'
));

-- Comment to document the valid statuses
COMMENT ON COLUMN "public"."jobs"."status" IS 'Status of the job: draft, active, completed, archived, needs_takeoff, needs_packages, waiting_for_bids';

