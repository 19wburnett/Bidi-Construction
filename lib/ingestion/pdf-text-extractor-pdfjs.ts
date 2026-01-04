/**
 * PDF Text Extractor using pdf-parse
 * 
 * This is the PRIMARY text extractor - designed specifically for
 * server-side Node.js usage. It's simple, reliable, and doesn't
 * require canvas or web workers.
 */

import type { PageText } from '@/types/ingestion'

export interface PdfjsExtractionResult {
  pages: PageText[]
  warnings: string[]
  extractionTimeMs: number
}

/**
 * Extract text from PDF buffer using pdf-parse
 * 
 * pdf-parse is specifically designed for server-side Node.js usage
 * and doesn't require web workers or canvas.
 * 
 * @param buffer - PDF file as Buffer
 * @param options - Extraction options
 * @returns Array of PageText objects, one per page
 */
export async function extractTextWithPdfjs(
  buffer: Buffer,
  options: {
    timeoutMs?: number
    onProgress?: (page: number, total: number) => void
  } = {}
): Promise<PdfjsExtractionResult> {
  const { timeoutMs = 5 * 60 * 1000, onProgress } = options
  const startTime = Date.now()
  const warnings: string[] = []

  // Dynamic import to avoid bundling issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>

  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`pdf-parse text extraction timeout after ${timeoutMs / 1000}s`))
    }, timeoutMs)
  })

  const extractionPromise = (async () => {
    // pdf-parse options
    const parseOptions = {
      // Return per-page text
      pagerender: async (pageData: { pageIndex: number; getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }> }) => {
        const textContent = await pageData.getTextContent()
        let text = ''
        let lastY: number | null = null
        
        for (const item of textContent.items) {
          if (item.str) {
            // Get Y position from transform if available
            const y = item.transform ? item.transform[5] : null
            const fontSize = item.transform ? Math.abs(item.transform[0]) : 12
            
            // Add newline when Y position changes significantly
            if (lastY !== null && y !== null && Math.abs(y - lastY) > fontSize * 0.5) {
              text += '\n'
            }
            if (y !== null) lastY = y
            
            text += item.str + ' '
          }
        }
        
        return text.trim()
      }
    }

    console.log('[pdf-parse] Extracting text from PDF...')
    
    const result = await pdfParse(buffer, parseOptions)
    
    const pages: PageText[] = []
    const numPages = result.numpages || 1
    
    // pdf-parse returns all text concatenated, but we need per-page
    // Split by page breaks or use the text as a single page if no page info
    const pageTexts = result.text.split(/\f/) // Form feed character often separates pages
    
    for (let i = 0; i < numPages; i++) {
      const pageText = pageTexts[i] || ''
      
      pages.push({
        pageNumber: i + 1,
        text: pageText.trim(),
        textItems: [], // pdf-parse doesn't provide position info in simple mode
      })
      
      if (onProgress) {
        onProgress(i + 1, numPages)
      }
      
      // Log progress every 10 pages
      if ((i + 1) % 10 === 0 || i + 1 === numPages) {
        console.log(`[pdf-parse] Processed ${i + 1}/${numPages} pages`)
      }
    }

    console.log(`[pdf-parse] Extracted text from ${numPages} pages`)
    
    return pages
  })()

  // Race between extraction and timeout
  const pages = await Promise.race([extractionPromise, timeoutPromise])

  const extractionTimeMs = Date.now() - startTime
  console.log(`[pdf-parse] Extraction completed in ${extractionTimeMs}ms`)

  return {
    pages,
    warnings,
    extractionTimeMs,
  }
}

/**
 * Check if a PDF likely has extractable text using pdf-parse
 * Quick check without full extraction
 */
export async function checkPdfHasText(buffer: Buffer): Promise<{
  hasText: boolean
  pageCount: number
  sampleText: string
}> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>
  
  try {
    // Quick parse to check for text
    const result = await pdfParse(buffer, {
      max: 1, // Only parse first page
    } as Record<string, unknown>)
    
    const sampleText = (result.text || '').trim().slice(0, 200)
    
    return {
      hasText: sampleText.length > 10,
      pageCount: result.numpages || 0,
      sampleText,
    }
  } catch (error) {
    console.warn('[pdf-parse] Error checking PDF for text:', error)
    return {
      hasText: false,
      pageCount: 0,
      sampleText: '',
    }
  }
}
