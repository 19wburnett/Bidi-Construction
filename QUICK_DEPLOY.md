# 🚀 Quick Deploy & Test Steps

## Step 1: Deploy to Production (2 minutes)

Run these commands:

```bash
# Add all ingestion files
git add app/api/ingest/ app/api/chunks/ lib/ingestion/ lib/ingestion-engine.ts types/ingestion.ts package.json package-lock.json

# Commit
git commit -m "Add ingestion & chunking system"

# Push to deploy (Vercel auto-deploys)
git push origin main
```

## Step 2: Wait for Vercel (2-5 minutes)

- Check Vercel dashboard for deployment status
- Wait for "Ready" status (green checkmark)

## Step 3: Test on Live Site

1. Go to your production site
2. Navigate to any plan: `/dashboard/jobs/[jobId]/plans/[planId]`
3. Open browser console (F12)
4. Paste and run:

```javascript
(async () => {
  const planId = window.location.pathname.split('/plans/')[1];
  console.log('🧪 Testing on PRODUCTION:', planId);
  
  try {
    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ planId })
    });
    
    const data = await res.json();
    
    if (data.success) {
      console.log('✅ SUCCESS!');
      console.log(`📄 Pages: ${data.stats.totalPages}`);
      console.log(`📦 Chunks: ${data.stats.totalChunks}`);
      console.log(`📋 Sheets: ${data.stats.sheetIndexCount}`);
      console.log(`⏱️  Time: ${(data.stats.processingTimeMs / 1000).toFixed(1)}s`);
      alert('✅ Ingestion successful! Check console for details.');
    } else {
      console.error('❌ FAILED:', data.error);
      alert('❌ Failed: ' + data.error);
    }
  } catch (err) {
    console.error('❌ Error:', err);
    alert('❌ Error: ' + err.message);
  }
})();
```

## ✅ Success = Ready for Customers!

If you see:
- ✅ SUCCESS message
- Stats showing pages/chunks/sheets
- No errors

Then it's working and ready for customers! 🎉

