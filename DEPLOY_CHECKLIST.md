# 🚀 Production Deployment Checklist

## ✅ Pre-Deployment Verification

- [x] Database migration run (`plan_sheet_index`, `plan_chunks` tables exist)
- [x] Code files in place (all ingestion modules, API routes)
- [x] Dependencies installed (`sharp`, `pdf2json`, `pdfjs-dist`)
- [x] Text-only mode works (no API keys needed)

## 📦 Files to Deploy

All these files are ready:
- ✅ `lib/ingestion/*` - All ingestion modules
- ✅ `lib/ingestion-engine.ts` - Main orchestration
- ✅ `app/api/ingest/route.ts` - Ingestion API
- ✅ `app/api/chunks/[jobId]/route.ts` - Chunks retrieval API
- ✅ `types/ingestion.ts` - Type definitions
- ✅ Database migration (already run on Supabase)

## 🚀 Deploy Steps

### 1. Commit & Push to Git
```bash
git add .
git commit -m "Add ingestion & chunking system (text-only mode)"
git push origin main
```

### 2. Vercel Auto-Deploy
If connected to Vercel, it should auto-deploy when you push.

### 3. Verify Deployment
- Check Vercel dashboard for successful build
- Ensure all environment variables are set (Supabase URL/Key)

## 🧪 Quick Production Test

Once deployed, test on live site:

```javascript
// In browser console on production plan page
(async () => {
  const planId = window.location.pathname.split('/plans/')[1];
  console.log('🧪 Testing ingestion on PRODUCTION:', planId);
  
  const response = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ planId })
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✅ PRODUCTION SUCCESS!');
    console.log(`📄 Pages: ${data.stats.totalPages}`);
    console.log(`📦 Chunks: ${data.stats.totalChunks}`);
    console.log(`📋 Sheets: ${data.stats.sheetIndexCount}`);
    console.log('✅ Ready for customers!');
  } else {
    console.error('❌ Failed:', data.error);
  }
})();
```

## ✅ Success Criteria

After testing, verify:
1. ✅ API responds (no 500 errors)
2. ✅ Creates sheet index entries in database
3. ✅ Creates chunks in database
4. ✅ Returns stats (pages, chunks, etc.)

## 📝 TODO: Image Extraction (Later)

**REMINDER:** To enable images later:
1. Get PDF.co API key: https://app.pdf.co/signup
2. Add to Vercel environment variables: `PDF_CO_API_KEY`
3. Update ingestion calls to include: `{ enable_image_extraction: true }`

## 🎯 Ready for Customers

Once test passes, the system is ready! Customers can use it immediately.

