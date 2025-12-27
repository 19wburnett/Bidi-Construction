# Manual Testing Guide for Subcontractor Discovery Cron Job

## Option 1: Test Locally (Development)

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Make a request to the endpoint:**
   
   **Using curl:**
   ```bash
   curl http://localhost:3000/api/cron/find-subcontractors
   ```
   
   **Using PowerShell (Windows):**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/cron/find-subcontractors" -Method GET
   ```
   
   **Or using POST (also works):**
   ```bash
   curl -X POST http://localhost:3000/api/cron/find-subcontractors
   ```

3. **Check the response** - You should see JSON with:
   - `success: true`
   - `found: <number>` - Number of new subcontractors added
   - `skipped: <number>` - Number skipped (duplicates, invalid emails, etc.)
   - `categories_searched: [...]` - Which trade categories were searched
   - `new_subcontractors: [...]` - Array of newly added subcontractors

## Option 2: Test in Production/Staging

1. **Get your CRON_SECRET** from your environment variables

2. **Make authenticated request:**
   
   **Using curl:**
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
        https://your-domain.com/api/cron/find-subcontractors
   ```
   
   **Using PowerShell:**
   ```powershell
   $headers = @{
       "Authorization" = "Bearer YOUR_CRON_SECRET"
   }
   Invoke-WebRequest -Uri "https://your-domain.com/api/cron/find-subcontractors" -Method GET -Headers $headers
   ```

## Option 3: Test via Browser (Development Only)

If running locally, you can simply open:
```
http://localhost:3000/api/cron/find-subcontractors
```

Note: This won't work in production due to CRON_SECRET requirement.

## What to Expect

### Successful Response:
```json
{
  "success": true,
  "found": 5,
  "skipped": 12,
  "errors": 0,
  "categories_searched": ["Excavation", "Concrete"],
  "new_subcontractors": [
    {
      "name": "ABC Construction",
      "email": "info@abcconstruction.com",
      "trade_category": "Excavation",
      "phone": "(801) 555-1234",
      "website_url": "abcconstruction.com",
      "location": "Utah"
    },
    ...
  ],
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### If No New Subcontractors Found:
```json
{
  "success": true,
  "found": 0,
  "skipped": 15,
  "errors": 0,
  "categories_searched": ["Excavation", "Concrete"],
  "new_subcontractors": [],
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Monitoring

- **Check server logs** for detailed console output:
  - `🔍 Starting subcontractor discovery cron job...`
  - `📋 Searching X trade categories today: ...`
  - `✅ Added new subcontractor: ...`
  - `🏁 Discovery complete. Found X new subcontractors...`

- **Check your database** to verify new subcontractors were added:
  ```sql
  SELECT * FROM subcontractors 
  ORDER BY created_at DESC 
  LIMIT 10;
  ```

- **Check admin email inbox** - If new subcontractors were found, admin users should receive a notification email

## Troubleshooting

1. **401 Unauthorized** - Make sure CRON_SECRET is set correctly in production
2. **No results** - Check if crawler is working (may take a few minutes)
3. **Timeout** - The job has a 5-minute timeout. If it takes longer, consider reducing `maxResultsPerCategory`
4. **Duplicate errors** - This is expected - the job skips duplicates automatically

## Testing Specific Trade Categories

To test specific categories, you can temporarily modify the `selectTradeCategoriesForDay` function in the route file, or modify the rotation logic to always return specific categories for testing.


