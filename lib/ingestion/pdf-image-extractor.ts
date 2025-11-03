/**
 * PDF Image Extractor (Vercel-Compatible)
 * Extracts raster images (PNG) per page from PDF using PDF.co API
 * This approach works on Vercel serverless functions
 */

import type { PageImage } from '@/types/ingestion'
import sharp from 'sharp'

/**
 * Extract images from PDF buffer using PDF.co API
 * Returns page images with URLs (images are stored externally by PDF.co)
 */
export async function extractImagesPerPage(
  buffer: Buffer,
  fileName: string = 'plan.pdf',
  dpi: number = 300
): Promise<PageImage[]> {
  const PDF_CO_API_KEY = process.env.PDF_CO_API_KEY

  if (!PDF_CO_API_KEY) {
    console.warn('PDF_CO_API_KEY not found - image extraction disabled')
    return []
  }

  try {
    // Step 1: Upload PDF to PDF.co
    // Create FormData-compatible body for Node.js
    const formData = new FormData()
    const blob = new Blob([buffer], { type: 'application/pdf' })
    formData.append('file', blob, fileName)

    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
      },
      body: uploadFormData,
    })

    if (!uploadResponse.ok) {
      throw new Error(`PDF.co upload failed: ${uploadResponse.statusText}`)
    }

    const uploadData = await uploadResponse.json()
    const fileUrl = uploadData.url

    // Step 2: Convert ALL pages to PNG images
    const convertResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: fileUrl,
        async: false, // Wait for conversion
        pages: '', // Empty = convert ALL pages
        name: `${fileName}-page`,
        dpi: dpi, // Set DPI
      }),
    })

    if (!convertResponse.ok) {
      throw new Error(`PDF.co conversion failed: ${convertResponse.statusText}`)
    }

    const convertData = await convertResponse.json()

    if (convertData.error) {
      throw new Error(`PDF.co error: ${convertData.message}`)
    }

    const imageUrls = convertData.urls || []
    console.log(`Converted ${imageUrls.length} pages to images via PDF.co`)

    // Download images to get dimensions (optional - for metadata)
    const pages: PageImage[] = []
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i]
      
      try {
        // Download image to get dimensions
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) continue
        
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        
        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata()
        
        pages.push({
          pageNumber: i + 1,
          imageBuffer: imageBuffer, // Store buffer for upload to Supabase
          width: metadata.width || 0,
          height: metadata.height || 0,
          dpi,
          storageUrl: imageUrl // PDF.co URL (temporary, will be replaced with Supabase URL)
        })
      } catch (error) {
        console.warn(`Failed to process image for page ${i + 1}:`, error)
        // Still add page with URL even if we can't process it
        pages.push({
          pageNumber: i + 1,
          imageBuffer: Buffer.from([]),
          width: 0,
          height: 0,
          dpi,
          storageUrl: imageUrl
        })
      }
    }

    return pages
  } catch (error) {
    console.error('Error extracting images from PDF via PDF.co:', error)
    throw error instanceof Error ? error : new Error('Failed to extract images from PDF')
  }
}

/**
 * Alternative: Extract images without downloading (faster, but less metadata)
 */
export async function extractImageUrlsOnly(
  buffer: Buffer,
  fileName: string = 'plan.pdf'
): Promise<string[]> {
  const PDF_CO_API_KEY = process.env.PDF_CO_API_KEY

  if (!PDF_CO_API_KEY) {
    return []
  }

  try {
    // Upload PDF
    const formData = new FormData()
    const blob = new Blob([buffer], { type: 'application/pdf' })
    formData.append('file', blob, fileName)

    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
      },
      body: formData,
    })

    if (!uploadResponse.ok) {
      throw new Error(`PDF.co upload failed: ${uploadResponse.statusText}`)
    }

    const uploadData = await uploadResponse.json()

    // Convert to PNG
    const convertResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: uploadData.url,
        async: false,
        pages: '',
        name: `${fileName}-page`,
      }),
    })

    if (!convertResponse.ok) {
      throw new Error(`PDF.co conversion failed`)
    }

    const convertData = await convertResponse.json()
    return convertData.urls || []
  } catch (error) {
    console.error('Error getting image URLs from PDF.co:', error)
    return []
  }
}
