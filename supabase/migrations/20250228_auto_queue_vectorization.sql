-- Migration: Auto-queue vectorization when plans are created
-- Created: 2025-02-28
-- Description: Automatically queues plans for vectorization when they are inserted into the plans table

-- Function to automatically queue vectorization for new plans
CREATE OR REPLACE FUNCTION auto_queue_plan_vectorization()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Only queue if plan has a file_path (is actually uploaded)
  IF NEW.file_path IS NOT NULL AND NEW.file_path != '' THEN
    -- Check if there's already a pending or processing job for this plan
    -- (This prevents duplicate jobs if the function is called multiple times)
    IF NOT EXISTS (
      SELECT 1 FROM plan_vectorization_queue
      WHERE plan_id = NEW.id
        AND status IN ('pending', 'processing')
    ) THEN
      -- Get user_id - prefer created_by, fallback to job owner, then first admin user
      SELECT COALESCE(
        NEW.created_by,
        (SELECT user_id FROM jobs WHERE id = NEW.job_id LIMIT 1),
        (SELECT id FROM users WHERE is_admin = true LIMIT 1),
        (SELECT id FROM auth.users LIMIT 1)
      ) INTO v_user_id;
      
      -- Insert into vectorization queue
      INSERT INTO plan_vectorization_queue (
        plan_id,
        user_id,
        job_id,
        status,
        priority,
        total_pages,
        progress,
        current_step,
        queued_at
      ) VALUES (
        NEW.id,
        v_user_id,
        NEW.job_id,
        'pending',
        5, -- Default priority for auto-queued jobs
        NEW.num_pages,
        0,
        'Auto-queued on plan creation',
        NOW()
      );
      
      RAISE NOTICE 'Auto-queued vectorization for plan % (user: %, job: %)', NEW.id, v_user_id, NEW.job_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run on plan insert
DROP TRIGGER IF EXISTS trigger_auto_queue_vectorization ON plans;
CREATE TRIGGER trigger_auto_queue_vectorization
  AFTER INSERT ON plans
  FOR EACH ROW
  EXECUTE FUNCTION auto_queue_plan_vectorization();

COMMENT ON FUNCTION auto_queue_plan_vectorization IS 'Automatically queues a plan for vectorization when it is created';
COMMENT ON TRIGGER trigger_auto_queue_vectorization ON plans IS 'Automatically queues vectorization for new plans';
