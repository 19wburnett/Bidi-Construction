# Ingestion System Verification Checklist

## ✅ Pre-Flight Checks

### 1. Database Tables ✅
- [x] Migration has been run
- [ ] Verify tables exist:
  ```sql
  SELECT COUNT(*) FROM plan_sheet_index;
  SELECT COUNT(*) FROM plan_chunks;
  ```

### 2. Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Required
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Required  
- [ ] `PDF_CO_API_KEY` - Optional (for image extraction)

### 3. Dependencies ✅
- [x] `sharp` installed
- [x] `pdf2json` installed
- [x] `pdfjs-dist` installed

## 🧪 Testing the Ingestion System

### Option 1: Test via UI (Recommended)

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to a plan page:**
   - Go to `/dashboard/jobs/[jobId]/plans/[planId]`
   - Open browser DevTools → Console
   - Run this in the console:

   ```javascript
   // Get current plan ID from the page
   const planId = window.location.pathname.split('/plans/')[1]
   
   // Call ingestion API
   fetch('/api/ingest', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     credentials: 'include',
     body: JSON.stringify({
       planId: planId,
       options: {
         target_chunk_size_tokens: 3000,
         overlap_percentage: 17.5
       }
     })
   })
   .then(r => r.json())
   .then(data => {
     console.log('✅ Ingestion result:', data)
     if (data.success) {
       console.log(`✅ Processed ${data.stats.totalPages} pages`)
       console.log(`✅ Created ${data.stats.totalChunks} chunks`)
       console.log(`✅ Indexed ${data.stats.sheetIndexCount} sheets`)
     } else {
       console.error('❌ Ingestion failed:', data.error)
     }
   })
   .catch(err => console.error('❌ Error:', err))
   ```

### Option 2: Test via API Route

Create a test endpoint or use Postman/curl:

```bash
# You'll need to be authenticated (get cookie from browser)
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "planId": "your-plan-uuid-here",
    "options": {
      "target_chunk_size_tokens": 3000
    }
  }'
```

### Option 3: Add Test Button to Plan Page

We can add a test button to the plan viewer page. Should I do this?

## 📊 Verify Results

After ingestion runs, check:

### 1. Database Verification

```sql
-- Check sheet index
SELECT sheet_id, title, discipline, sheet_type, page_no 
FROM plan_sheet_index 
WHERE plan_id = 'your-plan-id'
ORDER BY page_no;

-- Check chunks
SELECT 
  chunk_index,
  page_range->>'start' as start_page,
  page_range->>'end' as end_page,
  content->>'text_token_count' as tokens,
  content->>'image_count' as images
FROM plan_chunks
WHERE plan_id = 'your-plan-id'
ORDER BY chunk_index;
```

### 2. API Verification

```javascript
// Get chunks for a job
fetch('/api/chunks/your-job-id?planId=your-plan-id&limit=10')
  .then(r => r.json())
  .then(data => {
    console.log('Chunks:', data.chunks)
    console.log('Stats:', data.stats)
  })
```

## 🐛 Troubleshooting

### Issue: "Plan not found"
- **Cause**: Plan ID doesn't exist or wrong user
- **Fix**: Verify plan exists and belongs to your user

### Issue: "PDF download failed"
- **Cause**: File path issue or storage bucket permissions
- **Fix**: Check `plan.file_path` is correct, verify storage bucket access

### Issue: "Text extraction failed"
- **Cause**: PDF might be scanned/image-only
- **Fix**: This is okay - system will continue with image-only extraction

### Issue: "Image extraction failed"
- **Cause**: PDF_CO_API_KEY missing or invalid
- **Fix**: Add `PDF_CO_API_KEY` to `.env.local` (optional - text will still work)

### Issue: "Chunking failed"
- **Cause**: No text extracted or PDF is empty
- **Fix**: Check if PDF has extractable text

## ✅ Success Criteria

Ingestion is working correctly if:

1. ✅ API returns `{ success: true }`
2. ✅ Sheet index has entries (one per page)
3. ✅ Chunks are created (typically 2-5 chunks per 10 pages)
4. ✅ Each chunk has:
   - `page_range` with start/end pages
   - `content.text` with extracted text
   - `sheet_index_subset` with sheet metadata
   - `safeguards` with dedupe info

## 📈 Expected Performance

- **Small PDF (5-10 pages)**: 10-30 seconds
- **Medium PDF (20-50 pages)**: 30-90 seconds  
- **Large PDF (100+ pages)**: 2-5 minutes

Note: Image extraction adds time if enabled.

## 🚀 Next Steps

Once verified:

1. ✅ Integration works
2. 🔄 Add UI button to trigger ingestion
3. 🔄 Show ingestion progress in UI
4. 🔄 Add chunk preview/explorer
5. 🔄 Connect to LLM analysis endpoints

