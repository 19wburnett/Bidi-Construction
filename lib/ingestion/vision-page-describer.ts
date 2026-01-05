/**
 * Vision Page Describer
 * 
 * Generates text descriptions of PDF pages using GPT-4V.
 * These descriptions are stored as text chunks, making visual content
 * searchable through the existing vector search infrastructure.
 * 
 * This enables the AI to answer questions like "Where is the kitchen?"
 * by finding the vision description chunk that mentions it.
 * 
 * PDF-to-Image conversion strategies:
 * 1. Local: pdfjs-dist + @napi-rs/canvas (works in development)
 * 2. Serverless: PDF.co API (works in Vercel/serverless environments)
 */

import { generateTextWithGateway } from '@/lib/ai-gateway-provider'

// Vision analysis model - GPT-4o is recommended for best quality/cost ratio
const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o'
const PDF_CO_API_KEY = process.env.PDF_CO_API_KEY

// Prompt for analyzing construction plan pages
const VISION_DESCRIPTION_PROMPT = `Analyze this construction plan page and provide a structured description.

Your description should help users find information and understand what's on this page.

Include the following (if applicable):
1. **Page Type**: Floor plan, elevation, section, detail, schedule, legend, title sheet, site plan, etc.
2. **Area/Location**: What area, floor, or zone is shown (e.g., "First Floor", "Kitchen Area", "North Elevation")
3. **Rooms/Spaces**: List any rooms, spaces, or areas visible with their approximate locations (north, south, etc.)
4. **Key Elements**: Notable features like doors, windows, stairs, equipment, fixtures
5. **Schedules/Tables**: Any schedules (door, window, finish) or tables visible
6. **Dimensions**: Any major dimensions or measurements noted
7. **Notes/Specifications**: Any visible notes, specifications, or callouts
8. **Sheet Information**: Sheet number, title, scale if visible

Be concise but specific. Focus on information that helps users navigate the plans and find what they need.
Format as clear, readable text - not a form or checklist.`

export interface VisionDescription {
  pageNumber: number
  description: string
  contentType: 'vision_description'
  pageType?: string
  confidence?: number
}

export interface VisionDescriptionResult {
  descriptions: VisionDescription[]
  warnings: string[]
  totalCost: number
  processingTimeMs: number
}

export interface ConvertPdfToImagesOptions {
  scale?: number       // Render scale (0.5 = half size, 1.0 = full size)
  quality?: number     // JPEG quality (0.0-1.0)
  maxPages?: number    // Maximum pages to process
  startPage?: number   // Start from this page (1-indexed)
}

/**
 * Convert PDF buffer to base64 images
 * 
 * NOTE: This function requires pdfjs-dist which has worker limitations in 
 * serverless/Next.js environments. If conversion fails, vision descriptions
 * will be skipped but text extraction will still work.
 * 
 * Uses @napi-rs/canvas for server-side rendering (has prebuilt binaries)
 */
async function convertPdfToImages(
  pdfBuffer: Buffer,
  options: ConvertPdfToImagesOptions = {}
): Promise<string[]> {
  const { scale = 0.5, quality = 0.4, maxPages, startPage = 1 } = options
  
  // Check if we're in an environment where pdfjs-dist works
  // In serverless/Vercel, this often fails due to worker issues
  let pdfjs: typeof import('pdfjs-dist')
  try {
    pdfjs = await import('pdfjs-dist')
  } catch (importError) {
    console.warn('[VisionDescriber] Failed to import pdfjs-dist:', importError)
    return []
  }
  
  const data = new Uint8Array(pdfBuffer)
  
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>
  try {
    const loadingTask = pdfjs.getDocument({ 
      data, 
      // @ts-expect-error - pdfjs-dist accepts null to disable worker but types don't reflect this
      worker: null,
      disableFontFace: true,
      isEvalSupported: false,
      disableAutoFetch: true,
      disableStream: true,
    })
    doc = await loadingTask.promise
  } catch (loadError) {
    const errorMsg = loadError instanceof Error ? loadError.message : String(loadError)
    console.warn(`[VisionDescriber] Failed to load PDF (pdfjs-dist worker issue): ${errorMsg}`)
    console.warn('[VisionDescriber] Vision descriptions require pdfjs-dist which may not work in serverless environments')
    return []
  }
  
  const totalPages = doc.numPages
  const endPage = maxPages ? Math.min(startPage + maxPages - 1, totalPages) : totalPages
  
  const images: string[] = []
  
  console.log(`[VisionDescriber] Converting pages ${startPage}-${endPage} of ${totalPages} to images (scale: ${scale}, quality: ${quality})`)
  
  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    try {
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      
      let imageBase64: string | undefined
      
      if (typeof window !== 'undefined') {
        // Browser environment - use DOM canvas
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (!context) {
          console.warn(`[VisionDescriber] Could not get 2D context for page ${pageNum}`)
          continue
        }
        
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise
        
        // Convert to JPEG base64
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        imageBase64 = dataUrl.split(',')[1] || ''
      } else {
        // Server environment - try @napi-rs/canvas first, then node-canvas
        try {
          // Try @napi-rs/canvas (has prebuilt binaries, works on most platforms)
          const { createCanvas } = await import('@napi-rs/canvas')
          const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
          const context = canvas.getContext('2d')
          
          await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            viewport: viewport
          }).promise
          
          // Convert to JPEG base64 using @napi-rs/canvas API
          // quality is 0-100 for @napi-rs/canvas
          const jpegQuality = Math.floor(quality * 100)
          const buffer = await canvas.encode('jpeg', jpegQuality)
          imageBase64 = Buffer.from(buffer).toString('base64')
        } catch (napiError) {
          // @napi-rs/canvas failed - log the error and skip this page
          // We don't fall back to node-canvas as it requires native compilation
          const errorMsg = napiError instanceof Error ? napiError.message : String(napiError)
          console.warn(`[VisionDescriber] @napi-rs/canvas failed for page ${pageNum}: ${errorMsg}`)
          continue
        }
      }
      
      if (imageBase64) {
        images.push(imageBase64)
        
        if (pageNum % 10 === 0) {
          console.log(`[VisionDescriber] Converted ${pageNum}/${endPage} pages`)
        }
      }
    } catch (pageError) {
      const errorMsg = pageError instanceof Error ? pageError.message : String(pageError)
      console.warn(`[VisionDescriber] Failed to convert page ${pageNum}:`, errorMsg)
    }
  }
  
  await doc.destroy()
  
  console.log(`[VisionDescriber] Converted ${images.length} pages to images`)
  return images
}

/**
 * Convert PDF to images using PDF.co API
 * This works reliably in serverless environments (Vercel, etc.)
 * 
 * @param pdfBuffer - PDF file as Buffer
 * @param fileName - Original filename (for upload)
 * @param options - Conversion options
 * @returns Array of base64 image strings
 */
async function convertPdfToImagesWithPdfCo(
  pdfBuffer: Buffer,
  fileName: string = 'plan.pdf',
  options: ConvertPdfToImagesOptions = {}
): Promise<string[]> {
  const { maxPages, startPage = 1 } = options
  
  if (!PDF_CO_API_KEY) {
    console.warn('[VisionDescriber] PDF_CO_API_KEY not set - cannot use PDF.co for image conversion')
    return []
  }
  
  try {
    const fileSizeMB = pdfBuffer.length / (1024 * 1024)
    console.log(`[VisionDescriber] Using PDF.co API for PDF-to-image conversion (${fileSizeMB.toFixed(1)} MB)...`)
    
    let fileUrl: string
    
    // For large files (>10MB), use presigned URL upload to avoid timeout
    if (pdfBuffer.length > 10 * 1024 * 1024) {
      console.log('[VisionDescriber] Large file detected, using presigned URL upload...')
      
      // Step 1a: Get presigned URL for upload
      const presignedResponse = await fetch('https://api.pdf.co/v1/file/upload/get-presigned-url', {
        method: 'GET',
        headers: {
          'x-api-key': PDF_CO_API_KEY,
          'Content-Type': 'application/json',
        },
      })
      
      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text()
        console.error('[VisionDescriber] PDF.co presigned URL request failed:', errorText)
        return []
      }
      
      const presignedData = await presignedResponse.json()
      
      if (!presignedData.presignedUrl || !presignedData.url) {
        console.error('[VisionDescriber] PDF.co did not return presigned URL')
        return []
      }
      
      // Step 1b: Upload to presigned URL (direct to S3, no timeout issues)
      console.log('[VisionDescriber] Uploading to presigned URL...')
      const uploadResponse = await fetch(presignedData.presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: new Uint8Array(pdfBuffer),
      })
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('[VisionDescriber] Presigned URL upload failed:', errorText)
        return []
      }
      
      fileUrl = presignedData.url
      console.log('[VisionDescriber] Large file uploaded successfully via presigned URL')
    } else {
      // Step 1: Standard upload for smaller files
      const formData = new FormData()
      const uint8Array = new Uint8Array(pdfBuffer)
      const blob = new Blob([uint8Array], { type: 'application/pdf' })
      formData.append('file', blob, fileName)
      
      const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
        method: 'POST',
        headers: {
          'x-api-key': PDF_CO_API_KEY,
        },
        body: formData,
      })
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('[VisionDescriber] PDF.co upload failed:', errorText)
        return []
      }
      
      const uploadData = await uploadResponse.json()
      fileUrl = uploadData.url
    }
    
    if (!fileUrl) {
      console.error('[VisionDescriber] PDF.co upload did not return a URL')
      return []
    }
    
    console.log('[VisionDescriber] PDF uploaded to PDF.co, converting to images...')
    
    // Step 2: Convert to PNG images using PDF.co (async mode for large files)
    // Calculate page range - limit to first 20 pages for cost/time efficiency
    const effectiveMaxPages = maxPages || 20 // Default limit for vision descriptions
    const pagesParam = `${startPage - 1}-${Math.min(startPage + effectiveMaxPages - 2, 99)}` // PDF.co uses 0-indexed, max 100 pages
    
    console.log(`[VisionDescriber] Converting pages ${pagesParam} via PDF.co (async mode)...`)
    
    const convertResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: fileUrl,
        pages: pagesParam,
        async: true, // Use async mode for large files - returns job ID
        inline: false, // Return URLs, not inline data
      }),
    })
    
    if (!convertResponse.ok) {
      const errorText = await convertResponse.text()
      console.error('[VisionDescriber] PDF.co conversion request failed:', errorText)
      return []
    }
    
    let convertData = await convertResponse.json()
    
    // Handle async job - poll for completion
    if (convertData.jobId) {
      console.log(`[VisionDescriber] PDF.co job started: ${convertData.jobId}, polling for completion...`)
      
      const maxPolls = 60 // Max 5 minutes (60 * 5 seconds)
      let pollCount = 0
      
      while (pollCount < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
        
        const statusResponse = await fetch(`https://api.pdf.co/v1/job/check?jobid=${convertData.jobId}`, {
          headers: { 'x-api-key': PDF_CO_API_KEY },
        })
        
        if (!statusResponse.ok) {
          console.error('[VisionDescriber] PDF.co job status check failed')
          return []
        }
        
        const statusData = await statusResponse.json()
        
        if (statusData.status === 'success') {
          console.log(`[VisionDescriber] PDF.co job completed after ${(pollCount + 1) * 5}s`)
          convertData = statusData
          break
        } else if (statusData.status === 'error' || statusData.status === 'failed') {
          console.error('[VisionDescriber] PDF.co job failed:', statusData.message)
          return []
        }
        
        pollCount++
        if (pollCount % 6 === 0) { // Log every 30 seconds
          console.log(`[VisionDescriber] PDF.co job still processing... (${pollCount * 5}s)`)
        }
      }
      
      if (pollCount >= maxPolls) {
        console.error('[VisionDescriber] PDF.co job timed out after 5 minutes')
        return []
      }
    }
    
    if (convertData.error) {
      console.error('[VisionDescriber] PDF.co conversion error:', convertData.message)
      return []
    }
    
    // Step 3: Fetch each image and convert to base64
    const imageUrls = convertData.urls || []
    console.log(`[VisionDescriber] PDF.co returned ${imageUrls.length} image URLs`)
    
    const images: string[] = []
    
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const imageResponse = await fetch(imageUrls[i])
        if (!imageResponse.ok) {
          console.warn(`[VisionDescriber] Failed to fetch image ${i + 1}`)
          continue
        }
        
        const imageBuffer = await imageResponse.arrayBuffer()
        const base64 = Buffer.from(imageBuffer).toString('base64')
        images.push(base64)
        
        if ((i + 1) % 10 === 0) {
          console.log(`[VisionDescriber] Downloaded ${i + 1}/${imageUrls.length} images`)
        }
      } catch (fetchError) {
        console.warn(`[VisionDescriber] Error fetching image ${i + 1}:`, fetchError)
      }
    }
    
    console.log(`[VisionDescriber] Successfully converted ${images.length} pages via PDF.co`)
    return images
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[VisionDescriber] PDF.co conversion error:', errorMsg)
    return []
  }
}

/**
 * Generate descriptions for PDF pages using GPT-4V
 * 
 * @param pdfBuffer - PDF file as Buffer
 * @param options - Processing options
 * @returns Array of vision descriptions, one per page
 */
export async function generatePageDescriptions(
  pdfBuffer: Buffer,
  options: {
    maxPages?: number        // Limit pages to process (for cost control)
    startPage?: number       // Start from this page
    batchSize?: number       // Pages to process in parallel (default: 3)
    fileName?: string        // Original filename (for PDF.co upload)
    onProgress?: (page: number, total: number, description: string) => void
  } = {}
): Promise<VisionDescriptionResult> {
  const { maxPages, startPage = 1, batchSize = 3, fileName = 'plan.pdf', onProgress } = options
  const startTime = Date.now()
  const warnings: string[] = []
  let totalCost = 0
  
  // Check if AI Gateway is configured
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY not configured. Cannot generate vision descriptions.')
  }
  
  console.log(`[VisionDescriber] Starting vision analysis with model: ${VISION_MODEL}`)
  
  // Strategy 1: Try local pdfjs-dist + canvas conversion first
  // This works in development but often fails in serverless
  let images = await convertPdfToImages(pdfBuffer, {
    scale: 0.5,      // Half size for cost efficiency
    quality: 0.4,    // Low quality OK for GPT-4V
    maxPages,
    startPage,
  })
  
  let conversionMethod = 'local'
  
  // Strategy 2: If local conversion failed, try PDF.co API
  // This works reliably in serverless environments
  if (images.length === 0 && PDF_CO_API_KEY) {
    console.log('[VisionDescriber] Local conversion failed, trying PDF.co API...')
    warnings.push('Local PDF-to-image conversion failed, using PDF.co API')
    
    images = await convertPdfToImagesWithPdfCo(pdfBuffer, fileName, {
      maxPages,
      startPage,
    })
    conversionMethod = 'pdf.co'
  }
  
  if (images.length === 0) {
    const noApiKeyMsg = !PDF_CO_API_KEY 
      ? ' Set PDF_CO_API_KEY for serverless PDF-to-image conversion.'
      : ''
    warnings.push(`No images could be converted from PDF.${noApiKeyMsg}`)
    return {
      descriptions: [],
      warnings,
      totalCost: 0,
      processingTimeMs: Date.now() - startTime,
    }
  }
  
  console.log(`[VisionDescriber] Using ${conversionMethod} conversion: ${images.length} images`)
  
  const descriptions: VisionDescription[] = []
  
  // Process images in batches to control parallelism
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize)
    const batchPromises = batch.map(async (imageBase64, batchIndex) => {
      const pageNum = startPage + i + batchIndex
      
      try {
        console.log(`[VisionDescriber] Analyzing page ${pageNum}...`)
        
        const response = await generateTextWithGateway({
          model: VISION_MODEL,
          prompt: VISION_DESCRIPTION_PROMPT,
          images: [`data:image/jpeg;base64,${imageBase64}`],
          maxTokens: 500,
          temperature: 0.3, // Lower temperature for more consistent descriptions
        })
        
        const description = response.content.trim()
        
        // Estimate cost (GPT-4V: ~$0.01-0.03 per low-res image)
        // Using token-based estimate as proxy
        const inputTokens = response.usage?.promptTokens || 1000
        const outputTokens = response.usage?.completionTokens || 300
        const pageCost = (inputTokens * 0.00001 + outputTokens * 0.00003) // GPT-4o pricing
        totalCost += pageCost
        
        // Try to extract page type from description
        let pageType: string | undefined
        const pageTypeMatch = description.match(/\*\*Page Type\*\*:\s*([^\n]+)/i) ||
                             description.match(/Page Type:\s*([^\n]+)/i) ||
                             description.match(/^(Floor Plan|Elevation|Section|Detail|Schedule|Legend|Title Sheet|Site Plan)/im)
        if (pageTypeMatch) {
          pageType = pageTypeMatch[1].trim().replace(/[*]/g, '')
        }
        
        if (onProgress) {
          onProgress(pageNum, images.length + startPage - 1, description)
        }
        
        return {
          pageNumber: pageNum,
          description,
          contentType: 'vision_description' as const,
          pageType,
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`[VisionDescriber] Failed to analyze page ${pageNum}:`, errorMsg)
        warnings.push(`Page ${pageNum}: ${errorMsg}`)
        return null
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    const validResults = batchResults.filter((d): d is NonNullable<typeof d> => d !== null)
    descriptions.push(...validResults as VisionDescription[])
    
    // Log batch progress
    const processedCount = Math.min(i + batch.length, images.length)
    console.log(`[VisionDescriber] Progress: ${processedCount}/${images.length} pages analyzed`)
  }
  
  const processingTimeMs = Date.now() - startTime
  
  console.log(`[VisionDescriber] Complete:`)
  console.log(`  - Pages analyzed: ${descriptions.length}`)
  console.log(`  - Estimated cost: $${totalCost.toFixed(4)}`)
  console.log(`  - Time: ${processingTimeMs}ms`)
  
  return {
    descriptions,
    warnings,
    totalCost,
    processingTimeMs,
  }
}

/**
 * Generate a single page description
 * Useful for on-demand analysis of specific pages
 */
export async function describePageImage(
  imageBase64: string,
  pageNumber: number
): Promise<VisionDescription | null> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY not configured')
  }
  
  try {
    const response = await generateTextWithGateway({
      model: VISION_MODEL,
      prompt: VISION_DESCRIPTION_PROMPT,
      images: [`data:image/jpeg;base64,${imageBase64}`],
      maxTokens: 500,
      temperature: 0.3,
    })
    
    return {
      pageNumber,
      description: response.content.trim(),
      contentType: 'vision_description',
    }
  } catch (error) {
    console.error(`[VisionDescriber] Failed to describe page ${pageNumber}:`, error)
    return null
  }
}

/**
 * Check if vision description is enabled
 */
export function isVisionDescriptionEnabled(): boolean {
  return !!process.env.AI_GATEWAY_API_KEY && 
         (process.env.ENABLE_VISION_DESCRIPTIONS === 'true' || 
          process.env.ENABLE_VISION_DESCRIPTIONS === '1')
}
