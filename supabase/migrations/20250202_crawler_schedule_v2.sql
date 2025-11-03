-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable HTTP extension for calling Edge Functions
CREATE EXTENSION IF NOT EXISTS http;

-- Create a function to call the Edge Function via HTTP
-- Note: You'll need to update YOUR_PROJECT_REF with your actual project reference
CREATE OR REPLACE FUNCTION call_crawler_edge_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response http_response;
BEGIN
  -- Call the Supabase Edge Function via HTTP
  SELECT * INTO response FROM
  http_post(
    'https://dkpucbqphkghrhiwtseb.functions.supabase.co/crawler',
    '{}',
    'application/json'
  );
  
  RAISE NOTICE 'Crawler called: Status %', response.status;
END;
$$;

-- Schedule the crawler to run daily at 6:00 AM UTC
-- This will be created but won't work until you update YOUR_PROJECT_REF
SELECT cron.schedule(
  'daily-subcontractor-crawl',
  '0 6 * * *', -- Runs at 6:00 AM UTC daily
  $$SELECT call_crawler_edge_function()$$
);

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


