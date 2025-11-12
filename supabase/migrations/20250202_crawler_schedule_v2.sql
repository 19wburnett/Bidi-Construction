-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable HTTP extension for calling Edge Functions
CREATE EXTENSION IF NOT EXISTS http;

-- Create a function to call the Edge Function via HTTP.
-- Pass an optional payload to control categories/results per run.
CREATE OR REPLACE FUNCTION call_crawler_edge_function(payload jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response http_response;
  body text := COALESCE(payload::text, '{}');
BEGIN
  -- Call the Supabase Edge Function via HTTP
  SELECT * INTO response FROM
  http_post(
    'https://dkpucbqphkghrhiwtseb.functions.supabase.co/crawler',
    body,
    'application/json'
  );
  
  RAISE NOTICE 'Crawler called (status %)', response.status;
END;
$$;

-- Schedule examples (update as needed):
-- 1. Generic daily crawl using defaults (max 3 categories/run, 5 results/category)
SELECT cron.schedule(
  'daily-subcontractor-crawl-default',
  '0 6 * * *', -- Runs at 6:00 AM UTC daily
  $$SELECT call_crawler_edge_function()$$
);

-- 2. Optionally fan out by category at different times to stay within runtime budget
-- SELECT cron.schedule(
--   'daily-subcontractor-crawl-plumber',
--   '5 6 * * *',
--   $$SELECT call_crawler_edge_function(
--     jsonb_build_object(
--       'categories', jsonb_build_array('plumber'),
--       'maxResultsPerCategory', 8
--     )
--   )$$
-- );
-- SELECT cron.schedule(
--   'daily-subcontractor-crawl-electrician',
--   '15 6 * * *',
--   $$SELECT call_crawler_edge_function(
--     jsonb_build_object(
--       'categories', jsonb_build_array('electrician'),
--       'maxResultsPerCategory', 8
--     )
--   )$$
-- );

-- IMPORTANT: After deploying the Edge Function, run this to update the URL:
-- UPDATE pg_cron.job
-- SET command = REPLACE(command, 'YOUR_PROJECT_REF', 'your-actual-project-ref')
-- WHERE jobname = 'daily-subcontractor-crawl';

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To view job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- To remove the schedule:
-- SELECT cron.unschedule('daily-subcontractor-crawl');

-- Alternative: If the above doesn't work due to HTTP limitations,
-- you can use external cron services (GitHub Actions, Vercel Cron, etc.)
-- to call your Edge Function instead


