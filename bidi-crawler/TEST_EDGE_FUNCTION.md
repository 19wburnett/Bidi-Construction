# Testing the Edge Function

## Option 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Edge Functions** in the left sidebar
4. Click on **crawler** function
5. Look for **"Invoke Function"** button
6. In the payload box, enter: `{}`
7. Click **"Invoke"**
8. View logs in real-time

## Option 2: cURL Command

```bash
curl -X POST 'https://dkpucbqphkghrhiwtseb.functions.supabase.co/crawler' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Replace `YOUR_ANON_KEY` with your actual Supabase anon key from Settings → API.

## Option 3: Supabase CLI

```bash
supabase functions invoke crawler --body '{}'
```

## What to Expect

### Successful Run
```json
{
  "success": true,
  "message": "Crawl completed successfully",
  "results": {
    "totalProcessed": 100,
    "totalAdded": 15,
    "totalSkipped": 85,
    "totalErrors": 0
  }
}
```

### Rate Limited
```json
{
  "success": true,
  "message": "Crawl completed successfully",
  "results": {
    "totalProcessed": 25,
    "totalAdded": 0,
    "totalSkipped": 0,
    "totalErrors": 25
  }
}
```

### View Logs
In Supabase Dashboard → Edge Functions → crawler → Logs:
- See real-time console output
- Debug extraction errors
- Monitor rate limits
- Track progress

## Troubleshooting

### Function Not Found
Make sure you deployed:
```bash
supabase functions deploy crawler
```

### 500 Error
Check environment variables in Settings → Edge Functions:
- `FIRECRAWL_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### All Zeros in Results
- Database might already have all those subcontractors
- Check your database: `supabase/migrations/check_utah_subcontractors.sql`

### Rate Limit Errors
The crawler now has built-in retry logic. It will:
- Wait 1-8 seconds between retries
- Retry up to 3 times
- Use exponential backoff

## Quick Test Query

To verify your database has subcontractors:

```sql
SELECT COUNT(*) FROM subcontractors WHERE location ILIKE '%Utah%';
```

