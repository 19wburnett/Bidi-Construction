# Batch Processing Fix for Large PDFs

## Problem

**Error:** `413 Request Entity Too Large` when analyzing 111-page PDFs

**Root Cause:**
- Frontend was sending all 111 pages in a single request to `/api/plan/analyze-enhanced`
- Vercel has a 4.5MB request body size limit
- Base64-encoded PDF images easily exceed this for large documents

## Solution

### 1. API-Level Protection
**File:** `app/api/plan/analyze-enhanced/route.ts`

Added page limit check:
```typescript
// For very large plans, redirect to batch processing
if (images.length > 50) {
  return NextResponse.json(
    { 
      error: 'Request too large',
      message: `This plan has ${images.length} pages...`,
      suggestBatch: true,
      totalPages: images.length,
      maxRecommendedPages: 50
    },
    { status: 413 }
  )
}
```

### 2. Automatic Batch Retry
**File:** `app/dashboard/jobs/[jobId]/plans/[planId]/page.tsx`

Frontend now detects 413 errors and automatically retries with batch endpoint:

```typescript
if (analysisResponse.status === 413) {
  const errorData = await analysisResponse.json()
  
  // If server suggests batch, automatically retry
  if (errorData.suggestBatch) {
    console.log(`Auto-switching to batch endpoint for ${errorData.totalPages} pages`)
    
    // Retry with batch endpoint
    const batchResponse = await fetch('/api/plan/analyze-enhanced-batch', {
      method: 'POST',
      body: JSON.stringify({ planId, images, drawings, taskType })
    })
    
    // Process batch results same as regular results
    const batchAnalysisData = await batchResponse.json()
    setTakeoffResults(batchAnalysisData)
  }
}
```

**Applied to both:**
- `handleRunAITakeoff` (takeoff analysis)
- `handleRunQualityCheck` (quality analysis)

### 3. Batch Endpoint Already Exists
**File:** `app/api/plan/analyze-enhanced-batch/route.ts`

This endpoint was already implemented and processes images in batches of 5:

```typescript
const batchSize = 5
const batches = []
for (let i = 0; i < images.length; i += batchSize) {
  batches.push(images.slice(i, i + batchSize))
}

// Process each batch sequentially
for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
  const batchResult = await enhancedAIProvider.analyzeWithConsensus(
    batches[batchIndex],
    analysisOptions
  )
  batchResults.push(batchResult)
}

// Merge all batch results
const mergedResults = mergeBatchResults(batchResults, taskType)
```

## How It Works Now

1. **< 50 pages**: Uses standard `/api/plan/analyze-enhanced` endpoint
2. **> 50 pages**: 
   - API returns 413 with `suggestBatch: true`
   - Frontend automatically retries with `/api/plan/analyze-enhanced-batch`
   - Batch endpoint processes in groups of 5 pages
   - Results are merged and displayed normally

## User Experience

- **Seamless:** User just clicks "Run Takeoff Analysis" - no extra steps
- **Automatic:** System detects large PDFs and uses batch processing
- **Transparent:** Progress bar shows "Switching to batch processing..." 
- **Same results:** Batch results merge identically to single-batch results

## Testing

After deployment, test with:
- ✅ **19-page PDF** (should work with standard endpoint)
- ✅ **111-page PDF** (should auto-switch to batch endpoint)
- ✅ **Both takeoff and quality analysis**

## Files Changed

- `app/api/plan/analyze-enhanced/route.ts`: Added 50-page limit check
- `app/dashboard/jobs/[jobId]/plans/[planId]/page.tsx`: Added auto-retry logic
- `app/api/plan/analyze-enhanced-batch/route.ts`: Already existed, no changes needed

