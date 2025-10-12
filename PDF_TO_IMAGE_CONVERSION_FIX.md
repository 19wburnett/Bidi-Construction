# PDF to Image Conversion Fix

## Problem

When attempting to run AI takeoff analysis on PDFs, the system encountered this error:

```
Error: 400 You uploaded an unsupported image. Please make sure your image has of one the following formats: ['png', 'jpeg', 'gif', 'webp'].
```

**Root Cause**: OpenAI's Vision API does not accept PDF files directly. It only accepts image formats (PNG, JPEG, GIF, WEBP).

## Solution

Implemented **client-side PDF to image conversion** using PDF.js before sending to the AI API.

### Why Client-Side?

1. **Serverless Compatibility**: Server-side conversion requires native packages like `canvas` which:
   - Need Visual Studio build tools on Windows
   - Require compilation with node-gyp
   - Don't work in Vercel's serverless environment
   
2. **Better for Serverless**: Client-side conversion:
   - Works entirely in the browser using PDF.js (already installed)
   - No additional dependencies or native binaries
   - Faster - no server round-trip for conversion
   - Reduces server load and costs

### Implementation

#### 1. Client-Side Conversion Function

Added `convertPdfPagesToImages()` in `app/dashboard/plans/[id]/page.tsx`:

```typescript
async function convertPdfPagesToImages(): Promise<string[]> {
  const images: string[] = []
  const pdfjsLib = await import('pdfjs-dist')
  
  // Configure worker if not already configured
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  }
  
  // Load PDF document
  const loadingTask = pdfjsLib.getDocument(planUrl)
  const pdf = await loadingTask.promise
  
  const pagesToConvert = Math.min(pdf.numPages, 5) // Limit to 5 pages
  
  for (let pageNum = 1; pageNum <= pagesToConvert; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2 }) // 2x for high quality
    
    // Create temporary canvas
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.height = viewport.height
    canvas.width = viewport.width
    
    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise
    
    // Convert to JPEG base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    images.push(dataUrl)
  }
  
  return images
}
```

**Key Settings**:
- `scale: 2` - Renders at 2x resolution for better quality
- `'image/jpeg', 0.9` - JPEG format at 90% quality (good balance)
- **5 page limit** - Prevents token limit issues and excessive API costs

#### 2. Updated API Calls

Both `runTakeoffAnalysis()` and `runQualityAnalysis()` now:

```typescript
// Convert PDF to images before calling API
const images = await convertPdfPagesToImages()

// Send images instead of planUrl
await fetch('/api/plan/analyze-takeoff', {
  method: 'POST',
  body: JSON.stringify({
    planId,
    images, // Array of base64 data URLs
    drawings
  })
})
```

#### 3. Updated API Routes

**`app/api/plan/analyze-takeoff/route.ts`**:

```typescript
// Accept images array instead of planUrl
const { planId, images, drawings } = await request.json()

// Build content array with all images
const imageContent = images.map((imageData: string) => ({
  type: 'image_url',
  image_url: {
    url: imageData, // Base64 data URL
    detail: 'high'
  }
}))

// Send all images to OpenAI Vision API
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: '...' },
    {
      role: 'user',
      content: [
        { type: 'text', text: '...' },
        ...imageContent // Spread all images
      ]
    }
  ]
})
```

**`app/api/plan/analyze-quality/route.ts`**: Same approach.

### Technical Details

- **Format**: JPEG (widely supported, smaller than PNG)
- **Quality**: 90% (optimal balance between quality and size)
- **Scale**: 2x (high resolution for OCR and detail recognition)
- **Page Limit**: 5 pages maximum
  - Prevents hitting OpenAI's token limits
  - Manages API costs
  - Most construction plans have 1-5 key pages anyway

### Benefits

✅ **Works with Serverless** (Vercel, Netlify, etc.)  
✅ **No Native Dependencies** (pure JavaScript)  
✅ **Fast** (browser-based, no server processing)  
✅ **High Quality** (2x scale, 90% JPEG quality)  
✅ **Multi-Page Support** (analyzes up to 5 pages together)  
✅ **Cost Efficient** (only converts when analyzing)  

### Limitations

⚠️ **5 Page Limit**: Large plan sets need to be analyzed in sections  
⚠️ **Base64 Size**: Large images increase request payload  
⚠️ **Browser Memory**: Very high-resolution PDFs may be slow to convert  

### Cleanup

Removed deprecated files:
- `lib/pdf-to-image.ts` (attempted server-side approach)
- `app/api/takeoff/*` (old deprecated API routes)
- `app/dashboard/takeoff/*` (old deprecated pages)

These were replaced by the new `plans` system (`app/dashboard/plans/*`).

## Troubleshooting

### Error: "No GlobalWorkerOptions.workerSrc specified"

**Symptom**: Console error when clicking "Analyze" button.

**Cause**: PDF.js worker was not configured before attempting document conversion.

**Fix**: Added worker configuration inside `convertPdfPagesToImages()`:

```typescript
// Configure worker if not already configured
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
}
```

This ensures the worker is always configured before attempting to load any PDF document.

## Testing

To test:
1. Upload a PDF plan in `/dashboard/plans/new`
2. Open the plan editor
3. Click "Analyze" in the Takeoff sidebar
4. System converts PDF → JPEG images → sends to OpenAI
5. View detailed breakdown in the sidebar

Expected behavior:
- Loading spinner appears during conversion
- No console errors
- Sidebar displays results after 5-15 seconds

## Related Files

- **Client**: `app/dashboard/plans/[id]/page.tsx`
- **API**: `app/api/plan/analyze-takeoff/route.ts`
- **API**: `app/api/plan/analyze-quality/route.ts`
- **Documentation**: `AI_TAKEOFF_ANALYSIS.md`

---

**Status**: ✅ Fixed and tested  
**Build**: ✅ Passing  
**Date**: October 12, 2025

