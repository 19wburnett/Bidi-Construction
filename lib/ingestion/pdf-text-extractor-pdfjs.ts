/**
 * PDF Text Extractor - Alternative methods
 * 
 * This module provides alternative PDF text extraction using pdf2json.
 * pdf2json is the most reliable option for serverless environments
 * as it doesn't require web workers or canvas.
 * 
 * Note: The primary extraction is now handled by pdf2json directly
 * in plan-text-chunks.ts. This module exists for compatibility.
 */

import type { PageText } from '@/types/ingestion'

export interface PdfjsExtractionResult {
  pages: PageText[]
  warnings: string[]
  extractionTimeMs: number
}

/**
 * Extract text from PDF buffer
 * 
 * Note: This function now delegates to pdf2json since pdfjs-dist
 * has issues in serverless environments (worker requirements).
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

  // Use pdf2json for extraction - it's the most reliable in serverless
  const PDFParser = (await import('pdf2json')).default
  
  const pdfParser = new PDFParser()

  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`PDF text extraction timeout after ${timeoutMs / 1000}s`))
    }, timeoutMs)
  })

  const extractionPromise = new Promise<PageText[]>((resolve, reject) => {
    pdfParser.on('pdfParser_dataError', (errData: { parserError: Error } | Error) => {
      const errorMsg = errData instanceof Error ? errData.message : errData.parserError?.message || 'PDF parsing error'
      reject(new Error(errorMsg))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }>, x: number, y: number }> }> }) => {
      const pages: PageText[] = []
      
      for (let i = 0; i < pdfData.Pages.length; i++) {
        const page = pdfData.Pages[i]
        const textItems: PageText['textItems'] = []
        let pageText = ''
        
        for (const textItem of page.Texts) {
          const text = textItem.R.map((r: { T: string }) => decodeURIComponent(r.T)).join('')
          if (text) {
            pageText += text + ' '
            textItems.push({
              text,
              x: textItem.x || 0,
              y: textItem.y || 0,
              fontSize: 12, // pdf2json doesn't provide font size directly
            })
          }
        }
        
        pages.push({
          pageNumber: i + 1,
          text: pageText.trim(),
          textItems,
        })
        
        if (onProgress) {
          onProgress(i + 1, pdfData.Pages.length)
        }
      }
      
      resolve(pages)
    })

    pdfParser.parseBuffer(buffer)
  })

  // Race between extraction and timeout
  const pages = await Promise.race([extractionPromise, timeoutPromise])

  const extractionTimeMs = Date.now() - startTime
  console.log(`[pdf2json-alt] Extraction completed in ${extractionTimeMs}ms, ${pages.length} pages`)

  return {
    pages,
    warnings,
    extractionTimeMs,
  }
}

/**
 * Check if a PDF likely has extractable text
 * Quick check without full extraction
 */
export async function checkPdfHasText(buffer: Buffer): Promise<{
  hasText: boolean
  pageCount: number
  sampleText: string
}> {
  const PDFParser = (await import('pdf2json')).default
  const pdfParser = new PDFParser()
  
  try {
    return new Promise((resolve) => {
      pdfParser.on('pdfParser_dataError', () => {
        resolve({
          hasText: false,
          pageCount: 0,
          sampleText: '',
        })
      })

      pdfParser.on('pdfParser_dataReady', (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }> }) => {
        const pageCount = pdfData.Pages.length
        let sampleText = ''
        
        // Get text from first page
        if (pageCount > 0) {
          const firstPage = pdfData.Pages[0]
          for (const textItem of firstPage.Texts) {
            const text = textItem.R.map((r: { T: string }) => decodeURIComponent(r.T)).join('')
            sampleText += text + ' '
            if (sampleText.length > 200) break
          }
        }
        
        resolve({
          hasText: sampleText.trim().length > 10,
          pageCount,
          sampleText: sampleText.trim().slice(0, 200),
        })
      })

      pdfParser.parseBuffer(buffer)
    })
  } catch (error) {
    console.warn('[pdf2json-alt] Error checking PDF for text:', error)
    return {
      hasText: false,
      pageCount: 0,
      sampleText: '',
    }
  }
}
