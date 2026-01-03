-- Migration: Fix vectorization trigger to use public.users instead of auth.users
-- Created: 2025-02-28
-- Description: Fixes the auto_queue_plan_vectorization function to query public.users for is_admin
--              instead of auth.users (which doesn't have the is_admin column)

-- Fix the auto_queue_plan_vectorization function
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
      -- FIX: Use public.users instead of auth.users for is_admin check
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

-- Fix the queue_plan_vectorization_if_needed function
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
  -- FIX: Use public.users instead of auth.users for is_admin check
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

COMMENT ON FUNCTION auto_queue_plan_vectorization IS 'Automatically queues a plan for vectorization when it is created. Fixed to use public.users for is_admin check.';
COMMENT ON FUNCTION queue_plan_vectorization_if_needed IS 'Queues vectorization for a plan if it is not already vectorized and has no pending job. Fixed to use public.users for is_admin check.';
