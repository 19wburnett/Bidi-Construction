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
 */
export async function extractTextPerPage(buffer: Buffer): Promise<PageText[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1)

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`PDF parse error: ${errData.parserError}`))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
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
        reject(error instanceof Error ? error : new Error('Unknown error extracting text'))
      }
    })

    pdfParser.parseBuffer(buffer)
  })
}

