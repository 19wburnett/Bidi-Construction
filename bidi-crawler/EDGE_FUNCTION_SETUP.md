# Deploying Bidi Crawler as Supabase Edge Function

This guide shows you how to deploy the subcontractor crawler as a Supabase Edge Function with pg_cron scheduling.

## Prerequisites

- Supabase CLI installed
- Your Supabase project linked
- Environment variables configured

## Quick Setup

### 1. Install Supabase CLI

If not already installed:

```bash
# macOS
brew install supabase/tap/supabase

# Windows (using Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or download from: https://github.com/supabase/cli/releases
```

### 2. Login to Supabase CLI

```bash
supabase login
```

### 3. Link Your Project

```bash
supabase link --project-ref your-project-ref
```

You can find your project ref in the Supabase dashboard URL:
`https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

### 4. Deploy the Edge Function

```bash
supabase functions deploy crawler
```

### 5. Set Environment Variables

In your Supabase dashboard:
1. Go to **Settings** → **Edge Functions**
2. Add these environment variables:
   - `FIRECRAWL_KEY` - Your Firecrawl API key
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

### 6. Test the Function

```bash
curl -X POST 'https://YOUR_PROJECT_REF.functions.supabase.co/crawler' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## Schedule with pg_cron

### Option 1: Using Supabase Dashboard

1. Go to **SQL Editor** in your Supabase dashboard  
2. Run the migration file:
   ```sql
   -- File: supabase/migrations/20250202_crawler_schedule_v2.sql
   ```
   This version lets you pass a JSON payload to the Edge Function so each scheduled job can process a specific trade, tweak the results-per-run, etc.

### Option 2: Manual Setup

Run this SQL in your Supabase SQL Editor (remember to swap in your project ref):

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create HTTP extension for calling Edge Functions
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule daily crawl at 6 AM
SELECT cron.schedule(
  'daily-subcontractor-crawl-default',
  '0 6 * * *', -- 6:00 AM UTC daily
  $$SELECT call_crawler_edge_function()$$
);

-- Fan out by trade if you want more coverage without hitting the 60s Edge runtime limit.
-- Each job can override the payload to focus on one category and/or adjust result caps.
SELECT cron.schedule(
  'daily-subcontractor-crawl-plumber',
  '5 6 * * *',
  $$SELECT call_crawler_edge_function(
    jsonb_build_object(
      'categories', jsonb_build_array('plumber'),
      'maxResultsPerCategory', 8
    )
  )$$
);
SELECT cron.schedule(
  'daily-subcontractor-crawl-electrician',
  '15 6 * * *',
  $$SELECT call_crawler_edge_function(
    jsonb_build_object(
      'categories', jsonb_build_array('electrician'),
      'maxResultsPerCategory', 8
    )
  )$$
);
```

**Replace:**
- `YOUR_PROJECT_REF` with your actual Supabase project reference
- Ensure your Edge Function has public access or is called with proper auth

## Alternative: Use Supabase Cron Jobs

Supabase also supports built-in cron jobs through the dashboard:

1. Go to **Database** → **Extensions**
2. Enable **pg_cron**
3. Use the SQL editor to create scheduled jobs

## Monitoring

### Check Function Logs

```bash
supabase functions logs crawler
```

### Check Cron Jobs

Run in SQL Editor:

```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Manual Invocation

Invoke manually via curl:

```bash
curl -X POST 'https://dkpucbqphkghrhiwtseb.functions.supabase.co/crawler' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

## Troubleshooting

### Function Times Out

Edge Functions have a timeout limit. For long-running crawls:
- The Edge Function now enforces sensible defaults (≤3 trades/run, ≤5 results/trade, <60s total)
- Pass a payload in scheduled jobs to focus on specific trades or raise/lower limits per run
- Split runs by trade/time if you need to process more vendors each day

### Rate Limits

Firecrawl has rate limits. The crawler includes delays:
- 1 second between URLs
- 2 seconds between categories
- 2 seconds after Google Reviews search

### Database Connection Issues

Ensure your Edge Function uses the service role key for database access.

### Missing Environment Variables

Double-check in **Settings** → **Edge Functions** that all variables are set.

### Monitoring Payloads

The function response now echoes the config used in the run (categories, limits, runtime). Use `supabase functions logs crawler` to confirm the schedule is sending the payload you expect.

## Cost Considerations

- **Edge Functions**: Billed per invocation and execution time
- **Firecrawl API**: Has its own pricing model
- **pg_cron**: Free for scheduled jobs
- **Database**: Standard Supabase pricing

## Alternative: Keep Node.js Version

You can still run the Node.js version on your own infrastructure:
- VPS with cron
- GitHub Actions scheduled workflow
- Cloud Run with Cloud Scheduler (Google Cloud)
- Lambda with EventBridge (AWS)

The Node.js version in `bidi-crawler/` remains fully functional for these use cases.

## File Structure

```
supabase/
├── functions/
│   └── crawler/
│       └── index.ts         # Edge Function code
└── migrations/
    └── 20250202_crawler_schedule.sql  # Cron setup
```

## Next Steps

1. Deploy the function
2. Set environment variables
3. Test manually
4. Set up cron schedule
5. Monitor logs
6. Adjust scheduling as needed


