# Vision Analysis Upgrade Plan

## Current State: TEXT ONLY
The system currently extracts text from PDFs using `pdf2json` and sends only text to GPT-4o.

## What We Need for TRUE Visual Analysis:

### Option 1: PDF to Image Conversion (Recommended)
1. **Install server-side PDF renderer**:
   ```bash
   npm install canvas pdf2img sharp
   # Or use a service like PDF.co, Cloudmersive, etc.
   ```

2. **Convert PDF pages to images**:
   ```typescript
   // Convert each page to PNG/JPEG
   const images = await convertPDFToImages(buffer)
   ```

3. **Send images to GPT-4 Vision**:
   ```typescript
   const completion = await openai.chat.completions.create({
     model: 'gpt-4o',  // Has vision capabilities
     messages: [
       {
         type: 'text',
         text: 'Analyze this construction plan drawing...'
       },
       {
         type: 'image_url',
         image_url: {
           url: `data:image/png;base64,${base64Image}`,
           detail: 'high'  // For detailed plan analysis
         }
       }
     ]
   })
   ```

### Option 2: Use External Service
1. **PDF.co API**:
   - Converts PDF to images
   - OCR for scanned plans
   - ~$0.01 per page

2. **Cloudmersive**:
   - PDF to PNG conversion
   - Text extraction with OCR
   - Free tier available

### Option 3: Client-Side Rendering
1. Render PDF in browser using `pdfjs-dist`
2. Capture canvas as image
3. Send image to backend for analysis

## Benefits of Vision Analysis:

### What AI Could See:
- ✅ **Floor plan layouts** (walls, rooms, openings)
- ✅ **Electrical symbols** (outlets, switches, fixtures)
- ✅ **Plumbing diagrams** (fixture locations, pipe routes)
- ✅ **Dimensions shown as lines** (not just text)
- ✅ **Framing details** (beam locations, joist spacing)
- ✅ **Annotations and callouts** (arrows, circles, highlights)
- ✅ **Legends and symbols**
- ✅ **Site plans and elevations**

### What It Would Count:
- Outlet symbols by counting icons
- Window/door openings by seeing shapes
- Fixture locations by recognizing symbols
- Structural elements by analyzing drawings

## Implementation Steps:

### 1. Basic Vision Implementation
```typescript
// app/api/ai-plan-analysis/route.ts

async function convertPDFToImages(buffer: Buffer): Promise<string[]> {
  // Option A: Use sharp + canvas (requires native builds)
  const pdfDoc = await pdfjs.getDocument(buffer).promise
  const images: string[] = []
  
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })
    
    // Render to canvas
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')
    
    await page.render({ canvasContext: context, viewport }).promise
    
    // Convert to base64
    const base64 = canvas.toDataURL('image/png')
    images.push(base64)
  }
  
  return images
}

// Option B: Use external service
async function convertPDFToImages(buffer: Buffer): Promise<string[]> {
  const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.PDF_CO_API_KEY,
    },
    body: buffer
  })
  
  const { urls } = await response.json()
  return urls
}
```

### 2. Enhanced AI Prompts for Vision
```typescript
const VISION_PROMPTS = {
  electrical: `Analyze this electrical plan drawing. COUNT and IDENTIFY:
  
  VISUAL ELEMENTS TO COUNT:
  - Outlet symbols (circles, duplex, GFCI marked)
  - Switch symbols (S, S3, S4, SD for dimmer)
  - Light fixture symbols (ceiling, recessed, pendant)
  - Panel locations
  - Circuit routing shown as lines
  
  DIMENSIONS TO MEASURE:
  - Wire run lengths from panel to fixtures
  - Room sizes for load calculations
  - Ceiling heights if shown in elevations
  
  Return exact counts based on what you see in the drawing.`
}
```

### 3. Hybrid Approach (Text + Vision)
```typescript
// Extract both text AND images
const pdfText = await extractTextFromPDF(buffer)
const pdfImages = await convertPDFToImages(buffer)

// Send both to AI
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: `Extracted text: ${pdfText}` },
        { type: 'image_url', image_url: { url: pdfImages[0] } },
        { type: 'text', text: 'Analyze both the text and visual elements...' }
      ]
    }
  ]
})
```

## Cost Considerations:

### Current (Text Only):
- **$0.02-0.03 per trade** (~2,000 tokens)
- Fast analysis (30-60 seconds)

### With Vision:
- **$0.10-0.30 per trade** (images are more tokens)
- Slower analysis (60-120 seconds)
- But MUCH more accurate for plans with drawings

## Deployment Considerations:

### Vercel (Current):
- ❌ Canvas/native dependencies don't work
- ✅ External API calls would work
- ✅ Client-side rendering could work

### Alternative: Docker/VPS:
- ✅ Full canvas/image processing support
- ✅ Complete control over dependencies
- ❌ More infrastructure to manage

## Recommendation:

**Short-term**: Use external PDF-to-image service (PDF.co, Cloudmersive)
- Quick to implement
- Works with Vercel
- Pay per use

**Long-term**: Consider moving to container-based deployment
- Full vision capabilities
- Lower per-page costs
- More control

## Example External Service Integration:

```typescript
// Using PDF.co
async function analyzePlanWithVision(buffer: Buffer, trade: string) {
  // 1. Convert PDF to images via PDF.co
  const formData = new FormData()
  formData.append('file', buffer)
  
  const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
    method: 'POST',
    headers: { 'x-api-key': process.env.PDF_CO_API_KEY },
    body: formData
  })
  
  const { urls } = await response.json()
  
  // 2. Send images to GPT-4 Vision
  const imageMessages = urls.slice(0, 5).map(url => ({
    type: 'image_url',
    image_url: { url, detail: 'high' }
  }))
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VISION_PROMPTS[trade] },
      { role: 'user', content: [
        { type: 'text', text: 'Analyze these plan pages...' },
        ...imageMessages
      ]}
    ]
  })
  
  return completion.choices[0].message.content
}
```

## Next Steps:

1. Choose approach (external service recommended for Vercel)
2. Get API key for PDF.co or similar
3. Implement image conversion
4. Update prompts for visual analysis
5. Test with actual construction plans
6. Compare accuracy vs. text-only

