# Deployment Checklist

## ✅ Already Complete
- Edge Function code written
- Node.js version working
- Environment variables configured
- Function already tested (100 processed successfully)

## 🔄 What to Do Next

### 1. Deploy Latest Edge Function Code
Since you already deployed, you need to redeploy with the NEW search expansion code:

```bash
cd "Bidi Construction"
supabase functions deploy crawler
```

This will push your updated code with the 15+ search patterns.

### 2. Run Database Migration (Optional)
Only if you want the pg_cron scheduler:

**Option A: Via Supabase Dashboard**
1. Go to SQL Editor in Supabase dashboard
2. Copy the contents of: `supabase/migrations/20250202_crawler_schedule_v2.sql`
3. Paste and execute

**Option B: Skip cron migration**
Your Edge Function already works when called manually. The pg_cron is optional if you want automated daily runs.

### 3. Test the New Search Patterns
Manually invoke to test the enhanced search:

```bash
curl -X POST 'https://dkpucbqphkghrhiwtseb.functions.supabase.co/crawler' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

## Current State
- ✅ Function deployed and working
- ⏳ Updated search patterns NOT yet deployed
- ⏳ Daily cron schedule optional

## Priority
1. **HIGH**: Deploy updated function with smart search
2. **LOW**: Set up daily cron (can do later)


