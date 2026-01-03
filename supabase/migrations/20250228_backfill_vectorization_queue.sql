-- Migration: Backfill vectorization queue for existing plans
-- Created: 2025-02-28
-- Description: Queues vectorization for existing plans that haven't been vectorized yet

-- Function to queue vectorization for a plan (can be called manually or by trigger)
CREATE OR REPLACE FUNCTION queue_plan_vectorization_if_needed(p_plan_id UUID)
RETURNS UUID AS $$
DECLARE
  v_plan RECORD;
  v_user_id UUID;
  v_queue_id UUID;
BEGIN
  -- Get plan details
  SELECT id, job_id, created_by, num_pages, file_path
  INTO v_plan
  FROM plans
  WHERE id = p_plan_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan % not found', p_plan_id;
  END IF;
  
  -- Only queue if plan has a file_path
  IF v_plan.file_path IS NULL OR v_plan.file_path = '' THEN
    RAISE NOTICE 'Plan % has no file_path, skipping vectorization queue', p_plan_id;
    RETURN NULL;
  END IF;
  
  -- Check if plan is already vectorized
  IF EXISTS (
    SELECT 1 FROM plan_text_chunks
    WHERE plan_id = p_plan_id
      AND embedding IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE NOTICE 'Plan % is already vectorized, skipping queue', p_plan_id;
    RETURN NULL;
  END IF;
  
  -- Check if there's already a pending or processing job
  IF EXISTS (
    SELECT 1 FROM plan_vectorization_queue
    WHERE plan_id = p_plan_id
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE NOTICE 'Plan % already has a vectorization job in queue', p_plan_id;
    RETURN NULL;
  END IF;
  
  -- Get user_id - prefer created_by, fallback to job owner, then first admin user
  SELECT COALESCE(
    v_plan.created_by,
    (SELECT user_id FROM jobs WHERE id = v_plan.job_id LIMIT 1),
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
    v_plan.id,
    v_user_id,
    v_plan.job_id,
    'pending',
    3, -- Lower priority for backfilled jobs
    v_plan.num_pages,
    0,
    'Queued via backfill',
    NOW()
  )
  RETURNING id INTO v_queue_id;
  
  RAISE NOTICE 'Queued vectorization for plan % (queue job: %)', p_plan_id, v_queue_id;
  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Backfill: Queue vectorization for all existing plans that aren't vectorized
-- This runs once to catch up on plans that were created before the trigger existed
DO $$
DECLARE
  v_plan RECORD;
  v_queued_count INTEGER := 0;
BEGIN
  FOR v_plan IN
    SELECT p.id, p.job_id, p.created_by, p.num_pages
    FROM plans p
    WHERE p.file_path IS NOT NULL
      AND p.file_path != ''
      -- Plan is not vectorized (no chunks with embeddings)
      AND NOT EXISTS (
        SELECT 1 FROM plan_text_chunks ptc
        WHERE ptc.plan_id = p.id
          AND ptc.embedding IS NOT NULL
        LIMIT 1
      )
      -- No pending or processing job exists
      AND NOT EXISTS (
        SELECT 1 FROM plan_vectorization_queue pvq
        WHERE pvq.plan_id = p.id
          AND pvq.status IN ('pending', 'processing')
      )
    ORDER BY p.created_at DESC
    LIMIT 100 -- Process up to 100 plans at a time to avoid overwhelming the queue
  LOOP
    BEGIN
      PERFORM queue_plan_vectorization_if_needed(v_plan.id);
      v_queued_count := v_queued_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to queue vectorization for plan %: %', v_plan.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: Queued % plans for vectorization', v_queued_count;
END;
$$;

COMMENT ON FUNCTION queue_plan_vectorization_if_needed IS 'Queues vectorization for a plan if it is not already vectorized and has no pending job';
