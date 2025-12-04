/**
 * PDF OCR Extractor
 * Extracts text from scanned PDF pages using OCR
 * Uses PDF.co OCR API for reliable text extraction from images
 */

import type { PageText } from '@/types/ingestion'

export interface OCRPageText extends PageText {
  source: 'ocr' | 'text'
  confidence?: number
}

/**
 * Extract text from PDF using OCR (for scanned PDFs)
 * Uses PDF.co OCR API which works on Vercel serverless
 */
export async function extractTextWithOCR(
  buffer: Buffer,
  fileName: string = 'plan.pdf'
): Promise<OCRPageText[]> {
  const PDF_CO_API_KEY = process.env.PDF_CO_API_KEY

  if (!PDF_CO_API_KEY) {
    console.warn('PDF_CO_API_KEY not found - OCR extraction disabled')
    return []
  }

  try {
    // Step 1: Upload PDF to PDF.co
    const formData = new FormData()
    const uint8Array = new Uint8Array(buffer)
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
      throw new Error(`PDF.co upload failed: ${uploadResponse.statusText}`)
    }

    const uploadData = await uploadResponse.json()
    const fileUrl = uploadData.url

    // Step 2: Use PDF.co text extraction with OCR
    // PDF.co's text extraction automatically uses OCR for scanned PDFs
    const ocrResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: fileUrl,
        pages: '', // All pages
        ocrMode: 'auto', // Auto-detect if OCR is needed
        ocrLanguage: 'eng', // English
        async: false, // Wait for completion
      }),
    })

    if (!ocrResponse.ok) {
      // Try alternative endpoint if first one fails
      const errorText = await ocrResponse.text()
      console.warn('PDF.co text extraction failed, trying alternative method:', errorText)
      
      // Fallback: Try PDF.co OCR endpoint directly
      const ocrFallbackResponse = await fetch('https://api.pdf.co/v1/pdf/ocr', {
        method: 'POST',
        headers: {
          'x-api-key': PDF_CO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: fileUrl,
          language: 'eng',
          pages: '',
          async: false,
        }),
      })
      
      if (!ocrFallbackResponse.ok) {
        const fallbackError = await ocrFallbackResponse.text()
        console.error('PDF.co OCR fallback also failed:', fallbackError)
        throw new Error(`PDF.co OCR failed: ${ocrResponse.statusText}`)
      }
      
      // Use fallback response
      const ocrData = await ocrFallbackResponse.json()
      return parseOCRResponse(ocrData)
    }

    const ocrData = await ocrResponse.json()

    if (ocrData.error) {
      throw new Error(`PDF.co OCR error: ${ocrData.message || 'Unknown error'}`)
    }

    return parseOCRResponse(ocrData)
  } catch (error) {
    console.error('Error extracting text with OCR:', error)
    // Don't throw - return empty array so text extraction can continue
    return []
  }
}

/**
 * Parse OCR response from PDF.co into PageText format
 */
function parseOCRResponse(ocrData: any): OCRPageText[] {
  const pages: OCRPageText[] = []
  
  // Handle different response formats
  if (ocrData.body && Array.isArray(ocrData.body)) {
    // Array of page objects
    ocrData.body.forEach((page: any, index: number) => {
      const pageText = page.text || page.body || page.content || ''
      if (pageText.trim().length > 0) {
        pages.push({
          pageNumber: (page.pageNumber || index + 1),
          text: pageText,
          textItems: [],
          source: 'ocr',
          confidence: page.confidence || undefined,
        })
      }
    })
  } else if (ocrData.text) {
    // Single text result
    const text = ocrData.text
    
    // Try to detect page breaks
    const pageBreakPattern = /(?:Page\s+\d+|PAGE\s+\d+|\n\s*\n\s*\n)/gi
    const pageBreaks = text.match(pageBreakPattern)
    
    if (pageBreaks && pageBreaks.length > 0) {
      // Split by detected page breaks
      const parts = text.split(pageBreakPattern)
      parts.forEach((part: string, index: number) => {
        const trimmed = part.trim()
        if (trimmed.length > 20) { // Only include substantial text
          pages.push({
            pageNumber: index + 1,
            text: trimmed,
            textItems: [],
            source: 'ocr',
          })
        }
      })
    } else {
      // Single page or couldn't detect pages
      // Estimate pages by text length (rough estimate: ~2000 chars per page)
      const estimatedPages = Math.max(1, Math.ceil(text.length / 2000))
      
      if (estimatedPages === 1) {
        pages.push({
          pageNumber: 1,
          text: text,
          textItems: [],
          source: 'ocr',
        })
      } else {
        // Split into estimated pages
        const charsPerPage = Math.ceil(text.length / estimatedPages)
        for (let i = 0; i < estimatedPages; i++) {
          const start = i * charsPerPage
          const end = Math.min(start + charsPerPage, text.length)
          const pageText = text.slice(start, end).trim()
          if (pageText.length > 20) {
            pages.push({
              pageNumber: i + 1,
              text: pageText,
              textItems: [],
              source: 'ocr',
            })
          }
        }
      }
    }
  } else if (ocrData.urls && Array.isArray(ocrData.urls)) {
    // If PDF.co returns URLs instead of text, we'd need to fetch them
    // This shouldn't happen with text conversion, but handle it
    console.warn('PDF.co returned URLs instead of text - OCR may not be available')
  }
  
  console.log(`OCR extracted text from ${pages.length} pages`)
  return pages
}

/**
 * Extract text using GPT-4 Vision as fallback OCR
 * More expensive but works when PDF.co OCR fails
 */
export async function extractTextWithVisionOCR(
  imageUrls: string[],
  openaiClient: any
): Promise<OCRPageText[]> {
  if (!openaiClient || !imageUrls.length) {
    return []
  }

  const pages: OCRPageText[] = []

  try {
    // Process images in batches to avoid rate limits
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i]
      
      try {
        const completion = await openaiClient.chat.completions.create({
          model: 'gpt-4o', // Vision model
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this blueprint page. Include all labels, dimensions, notes, legends, and annotations. Preserve the structure and formatting as much as possible. Return only the extracted text, no explanations.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                    detail: 'high', // High detail for accurate OCR
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
        })

        const extractedText = completion.choices[0]?.message?.content || ''
        
        if (extractedText.trim().length > 0) {
          pages.push({
            pageNumber: i + 1,
            text: extractedText,
            textItems: [],
            source: 'ocr',
          })
        }
      } catch (error) {
        console.warn(`Failed to extract text from page ${i + 1} with Vision OCR:`, error)
        // Continue with next page
      }
    }

    return pages
  } catch (error) {
    console.error('Error extracting text with Vision OCR:', error)
    return []
  }
}

