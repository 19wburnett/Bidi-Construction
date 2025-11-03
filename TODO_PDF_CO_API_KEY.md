# 🔔 REMINDER: PDF.co API Key for Image Extraction

## 📝 TODO (After Testing Text-Only Version)

You wanted to enable image extraction later. Here's what to do:

### Step 1: Get PDF.co API Key

1. Sign up at: https://app.pdf.co/signup
2. Get your API key from dashboard
3. Free tier: 100 conversions/month (good for testing)

### Step 2: Add to Production

**Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add: `PDF_CO_API_KEY` = `your_api_key_here`
3. Redeploy (or it auto-updates)

### Step 3: Enable Images

Update ingestion calls to enable images:

```javascript
// Option 1: Enable for specific ingestion
fetch('/api/ingest', {
  method: 'POST',
  body: JSON.stringify({
    planId: '...',
    options: {
      enable_image_extraction: true  // ← Enable this
    }
  })
})

// Option 2: Or update default in code
// (in lib/ingestion-engine.ts, change default to true)
```

### Benefits of Images

- ✅ Visual analysis of drawings
- ✅ Symbol counting (outlets, switches, etc.)
- ✅ Better accuracy for complex plans
- ✅ Cross-reference text with visuals

### Cost Estimate

- **PDF.co**: ~$0.01-0.02 per page converted
- **20-page plan**: ~$0.20-0.40
- **100-page plan**: ~$1-2

**Note:** Text-only works great for most use cases. Images are enhancement!

---

**Status:** ⏸️ Paused until after production text-only testing

