# How Vectorization Jobs Run Server-Side

## Current Implementation (Hybrid Approach)

The current system uses a **hybrid approach** that's not fully server-side:

1. **When a job is queued:**
   - Job is created in `plan_vectorization_queue` table
   - A `fetch()` call is made to trigger processing
   - This `fetch()` is fire-and-forget (doesn't wait for response)

2. **Problem:**
   - The `fetch()` call is still initiated by the client request
   - If the user closes the app before the fetch completes, processing might not start
   - It's not truly "server-side" - it depends on the client making the request

## True Server-Side Solution

I've added a **Vercel Cron Job** that runs every 5 minutes to process pending jobs:

### How It Works:

1. **Vercel Cron Job** (`/api/cron/process-vectorization-queue`)
   - Runs every 5 minutes automatically
   - Completely independent of user sessions
   - Processes up to 5 pending jobs per run
   - Orders by priority (higher priority first)

2. **Queue Processing:**
   - Finds all `pending` jobs
   - Calls `/api/plan-vectorization/process` for each job
   - Updates job status as it processes
   - Continues even if no users are online

3. **Benefits:**
   - ✅ Truly server-side - runs independently
   - ✅ Continues even if user closes app
   - ✅ Processes multiple jobs automatically
   - ✅ Respects priority ordering
   - ✅ Handles failures gracefully

## Architecture Flow

```
User Uploads Plan
    ↓
Job Queued (status: 'pending')
    ↓
[Option 1: Immediate trigger via fetch() - may fail if user closes app]
[Option 2: Cron job picks it up within 5 minutes - guaranteed]
    ↓
Cron Job Runs (every 5 minutes)
    ↓
Finds Pending Jobs
    ↓
Processes Each Job
    ↓
Updates Status (processing → completed/failed)
```

## Configuration

The cron job is configured in `vercel.json`:
```json
{
  "path": "/api/cron/process-vectorization-queue",
  "schedule": "*/5 * * * *"  // Every 5 minutes
}
```

## Alternative: Supabase pg_cron

You could also use Supabase's `pg_cron` extension (like the crawler):

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to process queue
CREATE OR REPLACE FUNCTION process_vectorization_queue()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call the API endpoint via HTTP
  PERFORM net.http_post(
    url := 'https://YOUR_APP_URL/api/plan-vectorization/process',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"queueJobId": "..."}'::jsonb
  );
END;
$$;

-- Schedule to run every 5 minutes
SELECT cron.schedule(
  'process-vectorization-queue',
  '*/5 * * * *',
  $$SELECT process_vectorization_queue()$$
);
```

## Recommendation

**Use Vercel Cron** (already implemented) because:
- ✅ Already configured in your project
- ✅ No additional database setup needed
- ✅ Works with your existing Vercel deployment
- ✅ Easy to monitor via Vercel dashboard
- ✅ Handles authentication automatically

The cron job ensures jobs are processed even if:
- User closes the app immediately after upload
- Network request fails
- User's browser crashes
- Multiple users upload plans simultaneously

## Monitoring

Check cron job execution in:
- Vercel Dashboard → Cron Jobs
- Or check logs: `vercel logs --follow`

Check queue status:
```sql
SELECT status, COUNT(*) 
FROM plan_vectorization_queue 
GROUP BY status;
```
