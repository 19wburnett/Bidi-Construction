/**
 * PDF Text Extractor
 * Extracts text per page from PDF using pdf2json
 */

import PDFParser from 'pdf2json'
import type { PageText } from '@/types/ingestion'

export interface PageTextData {
  pageNumber: number
  text: string
  textItems: Array<{
    text: string
    x: number
    y: number
    fontSize: number
    fontName?: string
  }>
}

/**
 * Extract text from PDF buffer, returning per-page text data
 * Includes timeout handling to prevent hanging on problematic PDFs
 */
export async function extractTextPerPage(buffer: Buffer): Promise<PageText[]> {
  return new Promise((resolve, reject) => {
    // Set a timeout for the entire parsing operation (5 minutes for large PDFs)
    const timeout = setTimeout(() => {
      reject(new Error('PDF text extraction timeout after 5 minutes. The PDF may be too complex or corrupted.'))
    }, 5 * 60 * 1000)

    // Suppress console warnings from pdf2json about unsupported features
    const originalConsoleWarn = console.warn
    const suppressedWarnings = new Set<string>()
    console.warn = (...args: any[]) => {
      const message = args.join(' ')
      // Suppress known pdf2json warnings that don't affect functionality
      if (
        message.includes('Unsupported: field.type') ||
        message.includes('NOT valid form element') ||
        message.includes('Setting up fake worker') ||
        message.includes('TT: undefined function')
      ) {
        // Only log each unique warning once to avoid spam
        if (!suppressedWarnings.has(message)) {
          suppressedWarnings.add(message)
          // Log at debug level instead of warn
          console.log(`[PDFParser] ${message}`)
        }
        return
      }
      // Pass through other warnings
      originalConsoleWarn.apply(console, args)
    }

    const pdfParser = new PDFParser(null, true)

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      clearTimeout(timeout)
      console.warn = originalConsoleWarn
      reject(new Error(`PDF parse error: ${errData.parserError}`))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        clearTimeout(timeout)
        console.warn = originalConsoleWarn
        
        const pages: PageText[] = []

        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            const pageText: PageText = {
              pageNumber: pageIndex + 1,
              text: '',
              textItems: []
            }

            if (page.Texts) {
              // Sort by Y (top to bottom), then X (left to right)
              // Note: PDF Y coordinates start at bottom, so we reverse Y comparison
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                const yDiff = b.y - a.y  // Higher Y = top of page in PDF coords
                if (Math.abs(yDiff) > 0.5) return yDiff
                return a.x - b.x
              })

              sortedTexts.forEach((textItem: any) => {
                if (textItem.R) {
                  textItem.R.forEach((r: any) => {
                    if (r.T) {
                      try {
                        const decodedText = decodeURIComponent(r.T)
                        pageText.text += decodedText + ' '
                        
                        // Store text item with position info
                        pageText.textItems?.push({
                          text: decodedText,
                          x: textItem.x || 0,
                          y: textItem.y || 0,
                          fontSize: r.TS?.[1] || 12,
                          fontName: r.TS?.[0]
                        })
                      } catch (decodeError) {
                        // If URL decoding fails, try raw text
                        pageText.text += r.T + ' '
                      }
                    }
                  })
                }
              })
            }

            pages.push(pageText)
          })
        }

        resolve(pages)
      } catch (error) {
        clearTimeout(timeout)
        console.warn = originalConsoleWarn
        reject(error instanceof Error ? error : new Error('Unknown error extracting text'))
      }
    })

    // Start parsing
    try {
      pdfParser.parseBuffer(buffer)
    } catch (parseError) {
      clearTimeout(timeout)
      console.warn = originalConsoleWarn
      reject(parseError instanceof Error ? parseError : new Error('Failed to start PDF parsing'))
    }
  })
}

