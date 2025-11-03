# Testing Guide

## Quick Test

Run the test suite:
```bash
npm test
```

This validates:
- ✅ Environment variables are set
- ✅ Firecrawl search API works
- ✅ Supabase connection works
- ⚠️  Extract API test may fail with 400 (normal - test URL issues)

## Full Crawler Test

Run the actual crawler:
```bash
npm start
```

This will:
1. Search for subcontractors in 5 categories
2. Extract data from each website
3. Save only new entries to Supabase
4. Skip duplicates automatically

## What to Expect

### First Run
- Searches 5 categories × up to 20 results each
- May take 5-10 minutes
- Should add new subcontractors to your database

### Subsequent Runs
- Faster (skips existing entries)
- Only adds truly new subcontractors
- Minimal duplicates

## Troubleshooting

### Search returns no results
- Check your Firecrawl API key
- May need to wait for rate limits
- Firecrawl may have temporary issues

### Extract fails for all URLs
- Check Firecrawl documentation for latest API format
- Some sites may block automated scraping
- Verify your API plan includes extract

### Database errors
- Verify Supabase credentials
- Check table schema matches expected fields
- Ensure service role key (not anon key)

## Manual Testing

Test individual components:

### Test Search Only
```javascript
import { firecrawlSearch } from './src/firecrawlClient.js';
const results = await firecrawlSearch("Utah plumber", 5);
console.log(results);
```

### Test Extract Only
```javascript
import { firecrawlExtract } from './src/firecrawlClient.js';
const data = await firecrawlExtract("https://example.com");
console.log(data);
```

### Test Database
```javascript
import { subcontractorExists } from './src/supabaseClient.js';
const exists = await subcontractorExists("test@example.com", null);
console.log(exists);
```

## Expected Behavior

✅ **Good signs:**
- Search returns multiple results
- Supabase queries execute successfully
- No authentication errors
- Logs show progress

❌ **Warning signs:**
- Persistent 502/400 errors
- All extracts fail
- Database connection timeouts
- No results from searches

## Production Checklist

Before deploying:
- [ ] All environment variables set correctly
- [ ] Test run completes successfully
- [ ] Database has proper permissions
- [ ] Cron schedule is correct
- [ ] Error handling works
- [ ] Logs are being captured

