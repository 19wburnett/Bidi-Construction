-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the Edge Function via HTTP
CREATE OR REPLACE FUNCTION call_crawler_edge_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response text;
BEGIN
  -- Call the Supabase Edge Function via HTTP
  -- Replace 'YOUR_PROJECT_REF' with your actual project reference
  SELECT * INTO response FROM
  http((
    'POST',
    'https://YOUR_PROJECT_REF.functions.supabase.co/crawler',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  
  RAISE NOTICE 'Crawler called: %', response;
END;
$$;

-- Schedule the crawler to run daily at 6:00 AM UTC
SELECT cron.schedule(
  'daily-subcontractor-crawl',
  '0 6 * * *', -- Runs at 6:00 AM UTC daily
  $$SELECT call_crawler_edge_function()$$
);

-- Note: You need to set the service_role_key setting before running this
-- Run this in your Supabase SQL editor:
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- Alternatively, you can use Supabase's built-in API function:
-- Just update the URL above to use your actual project reference
-- and ensure your Edge Function is deployed

-- To remove the schedule later, run:
-- SELECT cron.unschedule('daily-subcontractor-crawl');


