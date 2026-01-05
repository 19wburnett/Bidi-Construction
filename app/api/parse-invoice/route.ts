import { NextRequest, NextResponse } from 'next/server'
import { aiGateway } from '@/lib/ai-gateway-provider'
// @ts-ignore - pdf2json doesn't have TypeScript types  
import PDFParser from 'pdf2json'
import { extractTextWithOCR } from '@/lib/ingestion/pdf-ocr-extractor'

export interface ParsedLineItem {
  description: string
  category: 'labor' | 'materials' | 'equipment' | 'permits' | 'other' | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  amount: number
  notes: string | null
}

export interface ParsedInvoiceData {
  company: {
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
  }
  jobReference: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  lineItems: ParsedLineItem[]
  subtotal: number | null
  tax: number | null
  total: number
  timeline: string | null
  notes: string | null
  paymentTerms: string | null
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()
    let timeoutId: NodeJS.Timeout | null = null
    let resolved = false

    // Set a timeout for PDF parsing (30 seconds)
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('PDF parsing timed out. The file may be too large or corrupted.'))
      }
    }, 30000)

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      cleanup()
      if (resolved) return
      resolved = true
      
      const errorMessage = errData?.parserError || errData?.message || 'Unknown PDF parsing error'
      console.error('[Parse Invoice] PDF parsing error:', errorMessage, errData)
      
      // Provide more specific error messages
      if (errorMessage.includes('encrypted') || errorMessage.includes('password')) {
        reject(new Error('This PDF is password-protected or encrypted. Please remove the password and try again.'))
      } else if (errorMessage.includes('corrupt') || errorMessage.includes('invalid')) {
        reject(new Error('The PDF file appears to be corrupted or invalid. Please try a different file.'))
      } else {
        reject(new Error(`Failed to parse PDF: ${errorMessage}. The file may be image-based, corrupted, or in an unsupported format.`))
      }
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      cleanup()
      if (resolved) return
      
      try {
        let text = ''
        
        // Extract text with page separation
        if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            text += `\n=== PAGE ${pageIndex + 1} ===\n`
            
            if (page.Texts && Array.isArray(page.Texts)) {
              // Sort texts by position for better reading order
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                const yDiff = a.y - b.y
                if (Math.abs(yDiff) > 0.5) return yDiff
                return a.x - b.x
              })
              
              sortedTexts.forEach((textItem: any) => {
                if (textItem.R && Array.isArray(textItem.R)) {
                  textItem.R.forEach((r: any) => {
                    if (r.T) {
                      try {
                        text += decodeURIComponent(r.T) + ' '
                      } catch (decodeError) {
                        // If decoding fails, try using the text as-is
                        text += (r.T || '') + ' '
                      }
                    }
                  })
                }
              })
              text += '\n'
            }
          })
        } else {
          console.warn('[Parse Invoice] PDF has no Pages array or Pages is not an array')
        }
        
        resolved = true
        resolve(text.trim())
      } catch (error: any) {
        resolved = true
        console.error('[Parse Invoice] Error extracting text:', error)
        reject(new Error(`Error extracting text from PDF: ${error.message || 'Unknown error'}`))
      }
    })

    try {
      pdfParser.parseBuffer(buffer)
    } catch (error: any) {
      cleanup()
      if (resolved) return
      resolved = true
      console.error('[Parse Invoice] Error starting PDF parse:', error)
      reject(new Error(`Failed to start PDF parsing: ${error.message || 'Unknown error'}`))
    }
  })
}

/**
 * Convert PDF to images for OCR (using PDF.co just for conversion)
 * Returns array of image URLs
 */
async function convertPDFToImagesForOCR(buffer: Buffer, fileName: string): Promise<string[]> {
  const PDF_CO_API_KEY = process.env.PDF_CO_API_KEY

  if (!PDF_CO_API_KEY) {
    return []
  }

  try {
    // Step 1: Upload PDF to PDF.co
    const uploadFormData = new FormData()
    const uint8Array = new Uint8Array(buffer)
    const blob = new Blob([uint8Array], { type: 'application/pdf' })
    uploadFormData.append('file', blob, fileName)

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

    // Step 2: Convert pages to PNG images
    const convertResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
      method: 'POST',
      headers: {
        'x-api-key': PDF_CO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: fileUrl,
        async: false,
        pages: '', // All pages
        name: `${fileName}-page`,
      }),
    })

    if (!convertResponse.ok) {
      throw new Error(`PDF.co conversion failed: ${convertResponse.statusText}`)
    }

    const convertData = await convertResponse.json()

    if (convertData.error) {
      throw new Error(`PDF.co error: ${convertData.message}`)
    }

    return convertData.urls || []
  } catch (error) {
    console.error('[Parse Invoice] Error converting PDF to images:', error)
    return []
  }
}

/**
 * Extract text from PDF images using GPT-4 Vision via aiGateway
 */
async function extractTextWithGPT4Vision(imageUrls: string[]): Promise<string> {
  if (!imageUrls || imageUrls.length === 0) {
    return ''
  }

  try {
    const pages: string[] = []

    // Process each page image
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i]
      
      try {
        // Use messages format for vision API compatibility
        const response = await aiGateway.generate({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at extracting text from document images. Extract ALL visible text from the image, preserving structure, formatting, and layout as much as possible. Include all numbers, dates, addresses, line items, totals, and any other text content. Return only the extracted text, no explanations or markdown formatting.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all text from this invoice/bid document page. Include everything: headers, company info, line items, totals, notes, and any other text.'
                },
                {
                  type: 'image',
                  image: imageUrl
                }
              ]
            }
          ],
          maxTokens: 4000,
          temperature: 0.1,
        })

        const pageText = response.content || ''
        if (pageText.trim().length > 0) {
          pages.push(`\n=== PAGE ${i + 1} ===\n${pageText}`)
        }
      } catch (pageError: any) {
        console.warn(`[Parse Invoice] Failed to extract text from page ${i + 1} with GPT-4 Vision:`, pageError.message)
        // Continue with next page
      }
    }

    return pages.join('\n')
  } catch (error: any) {
    console.error('[Parse Invoice] Error extracting text with GPT-4 Vision:', error)
    throw error
  }
}

/**
 * Attempts to repair malformed JSON from AI responses
 */
function repairJSON(jsonText: string): string {
  let repaired = jsonText.trim()
  
  // Remove markdown code blocks (multiple passes to handle nested cases)
  while (repaired.includes('```')) {
    if (repaired.startsWith('```json')) {
      repaired = repaired.slice(7).trim()
    } else if (repaired.startsWith('```')) {
      repaired = repaired.slice(3).trim()
    }
    if (repaired.endsWith('```')) {
      repaired = repaired.slice(0, -3).trim()
    }
    if (!repaired.includes('```')) break
  }
  
  // Extract JSON from text that might have extra content
  // Try to find the first { and last }
  const firstBrace = repaired.indexOf('{')
  const lastBrace = repaired.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    repaired = repaired.substring(firstBrace, lastBrace + 1)
  } else if (firstBrace === -1) {
    // No opening brace found - might be just an array or malformed
    const firstBracket = repaired.indexOf('[')
    const lastBracket = repaired.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      // Wrap array in object
      repaired = `{"lineItems": ${repaired.substring(firstBracket, lastBracket + 1)}}`
    }
  }
  
  // Fix common JSON errors
  
  // 1. Fix missing commas before closing brackets/braces in arrays
  // Pattern: "key": "value"] should become "key": "value",]
  repaired = repaired.replace(/(:\s*"(?:[^"\\]|\\.)*")(\s*)\](?!\s*[,}\]]|$)/g, '$1,$2]')
  repaired = repaired.replace(/(:\s*"(?:[^"\\]|\\.)+")(\s*)\](?!\s*[,}\]]|$)/g, '$1,$2]')
  
  // 2. Fix missing commas before closing braces in arrays
  // Pattern: }] should be },] when closing object in array
  repaired = repaired.replace(/\}(\s*)\](?!\s*[,}\]\s]|$)/g, '},$1]')
  
  // 3. Fix missing commas between object properties
  repaired = repaired.replace(/"(\s*)"([^",}\]:\s])/g, '",$1"$2')
  repaired = repaired.replace(/(\d+)(\s*)"([^",}\]:\s])/g, '$1,$2"$3')
  repaired = repaired.replace(/(\})(\s*)"([^",}\]:\s])/g, '$1,$2"$3')
  repaired = repaired.replace(/(\])(\s*)"([^",}\]:\s])/g, '$1,$2"$3')
  
  // 4. Fix unclosed strings (simple approach - just close if we have odd number of quotes)
  const quoteCount = (repaired.match(/"/g) || []).length
  if (quoteCount % 2 !== 0 && !repaired.endsWith('"')) {
    // Odd number of quotes and doesn't end with quote - likely unclosed string
    // Just append a closing quote (this is a best-effort fix)
    repaired = repaired + '"'
  }
  
  // 5. Remove trailing commas (do this AFTER fixing missing commas)
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1')
  
  // 6. Try to close incomplete objects/arrays
  const openBraces = (repaired.match(/\{/g) || []).length
  const closeBraces = (repaired.match(/\}/g) || []).length
  const openBrackets = (repaired.match(/\[/g) || []).length
  const closeBrackets = (repaired.match(/\]/g) || []).length
  
  // Close incomplete objects
  if (openBraces > closeBraces) {
    // Before adding closing braces, make sure the last property is properly closed
    if (!repaired.endsWith('}') && !repaired.endsWith(',')) {
      // Find the last property and ensure it's closed
      const lastComma = repaired.lastIndexOf(',')
      const lastColon = repaired.lastIndexOf(':')
      if (lastColon > lastComma) {
        // Last property might be incomplete - try to close it
        const afterColon = repaired.substring(lastColon + 1).trim()
        if (afterColon && !afterColon.match(/^["\d\[\{]/)) {
          // Property value seems incomplete, add null
          repaired = repaired.substring(0, lastColon + 1) + ' null'
        }
      }
    }
    repaired += '}'.repeat(openBraces - closeBraces)
  }
  
  // Close incomplete arrays
  if (openBrackets > closeBrackets) {
    repaired += ']'.repeat(openBrackets - closeBrackets)
  }
  
  // 7. Fix common number formatting issues
  repaired = repaired.replace(/:\s*\$(\d+(?:\.\d+)?)/g, ': $1') // Remove $ from numbers
  repaired = repaired.replace(/:\s*"(\d+(?:\.\d+)?)"/g, ': $1') // Unquote pure numbers
  
  // 8. Remove any control characters that might break parsing (except newlines in strings)
  // But be careful - we need to preserve valid JSON structure
  repaired = repaired.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
  
  // 9. Final cleanup - remove any remaining problematic patterns
  repaired = repaired.replace(/,+/g, ',') // Multiple commas
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1') // Trailing commas again
  
  return repaired.trim()
}

async function parseInvoiceWithAI(extractedText: string, fileName: string): Promise<ParsedInvoiceData> {
  const systemPrompt = `You are an expert at parsing construction invoices, bids, and quotes from subcontractors.

Your task is to extract structured data from the invoice/bid text provided.

EXTRACTION RULES:
1. COMPANY INFO: Look for the company/subcontractor name, email, phone, and address. This is usually at the top of the document.
2. JOB REFERENCE: Look for project name, job number, job site address, or any reference to what project this bid is for.
3. INVOICE INFO: Extract invoice number and date if present.
4. LINE ITEMS: Parse each line item carefully:
   - Description: What work or materials are being charged
   - Category: Classify as 'labor', 'materials', 'equipment', 'permits', or 'other'
   - Quantity: Number of units (if specified)
   - Unit: Unit of measurement (hours, sq ft, each, lump sum, etc.)
   - Unit Price: Price per unit (if specified)
   - Amount: Total for this line item (REQUIRED - this is the most important field)
   - Notes: Any additional details about this line item
5. TOTALS: Extract subtotal, tax, and total amounts.
6. TIMELINE: Look for any mentioned timeline, completion date, or duration.
7. NOTES: Any general notes, terms, or conditions.
8. PAYMENT TERMS: Net 30, due on receipt, etc.

IMPORTANT:
- If a field is not present in the document, use null
- For amounts, always return numbers (not strings with $ signs)
- Be conservative - only extract what you can clearly identify
- The 'amount' field in line items is required - if you can't determine it, estimate from context or skip the item

Return your analysis as a valid JSON object matching this exact structure:
{
  "company": {
    "name": "string or null",
    "email": "string or null", 
    "phone": "string or null",
    "address": "string or null"
  },
  "jobReference": "string or null",
  "invoiceNumber": "string or null",
  "invoiceDate": "string or null",
  "lineItems": [
    {
      "description": "string",
      "category": "labor|materials|equipment|permits|other|null",
      "quantity": "number or null",
      "unit": "string or null",
      "unitPrice": "number or null",
      "amount": "number (required)",
      "notes": "string or null"
    }
  ],
  "subtotal": "number or null",
  "tax": "number or null",
  "total": "number",
  "timeline": "string or null",
  "notes": "string or null",
  "paymentTerms": "string or null"
}

Return ONLY the JSON object, no markdown formatting or extra text.`

  const userPrompt = `Parse this invoice/bid document and extract all relevant information.

File name: ${fileName}

Document text:
${extractedText}`

  try {
    // Try with response_format first, but handle if it fails
    let response
    try {
      response = await aiGateway.generate({
        model: 'gpt-4o',
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1, // Low temperature for more consistent extraction
        maxTokens: 4000,
        responseFormat: { type: 'json_object' }, // Request JSON format explicitly
      })
    } catch (formatError: any) {
      // If response_format causes an error, retry without it
      console.warn('[Parse Invoice] response_format failed, retrying without it:', formatError.message)
      response = await aiGateway.generate({
        model: 'gpt-4o',
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
        maxTokens: 4000,
      })
    }

    const content = response.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Log the raw response for debugging (first 1000 chars)
    console.log('[Parse Invoice] Raw AI response (first 1000 chars):', content.substring(0, 1000))
    console.log('[Parse Invoice] Raw AI response length:', content.length)
    console.log('[Parse Invoice] Finish reason:', response.finishReason)

    // Check if response was truncated or incomplete
    if (response.finishReason === 'length') {
      console.warn('[Parse Invoice] WARNING: AI response was truncated due to token limit')
    }

    // Clean and repair JSON
    let cleanedContent = content.trim()
    
    // Check if content is empty after trimming
    if (!cleanedContent || cleanedContent.length < 10) {
      throw new Error('AI returned an empty or very short response. The document may be too complex or unclear.')
    }
    
    // Try parsing directly first
    let parsed: ParsedInvoiceData
    try {
      parsed = JSON.parse(cleanedContent)
      console.log('[Parse Invoice] Successfully parsed JSON on first attempt')
    } catch (parseError: any) {
      // If direct parse fails, try to repair the JSON
      console.warn('[Parse Invoice] Initial JSON parse failed, attempting repair')
      console.warn('[Parse Invoice] Parse error:', parseError.message)
      console.warn('[Parse Invoice] Content preview (first 1000 chars):', cleanedContent.substring(0, 1000))
      console.warn('[Parse Invoice] Content preview (last 500 chars):', cleanedContent.substring(Math.max(0, cleanedContent.length - 500)))
      
      const repaired = repairJSON(cleanedContent)
      
      try {
        parsed = JSON.parse(repaired)
        console.log('[Parse Invoice] Successfully repaired and parsed JSON')
      } catch (secondError: any) {
        // Log comprehensive details for debugging
        console.error('[Parse Invoice] JSON repair failed')
        console.error('[Parse Invoice] Second parse error:', secondError.message)
        console.error('[Parse Invoice] Original content length:', cleanedContent.length)
        console.error('[Parse Invoice] Repaired content length:', repaired.length)
        console.error('[Parse Invoice] Original content (full):', cleanedContent)
        console.error('[Parse Invoice] Repaired content (full):', repaired)
        
        // Try one more time with a simpler repair - just extract the JSON object
        try {
          // Try multiple regex patterns to extract JSON
          let jsonMatch = cleanedContent.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            // Try finding JSON that might have newlines
            jsonMatch = cleanedContent.match(/\{[\s\S]{10,}\}/)
          }
          if (!jsonMatch) {
            // Try finding any object-like structure
            const braceStart = cleanedContent.indexOf('{')
            const braceEnd = cleanedContent.lastIndexOf('}')
            if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
              jsonMatch = [cleanedContent.substring(braceStart, braceEnd + 1)]
            }
          }
          
          if (jsonMatch) {
            let extracted = jsonMatch[0]
            // Try to repair the extracted JSON one more time
            extracted = repairJSON(extracted)
            parsed = JSON.parse(extracted)
            console.log('[Parse Invoice] Successfully extracted and parsed JSON using regex')
          } else {
            // Last resort: try to construct a minimal valid response from the text
            console.warn('[Parse Invoice] Could not extract JSON, attempting to construct minimal response')
            throw secondError
          }
        } catch (finalError: any) {
          // Log the full error details for server-side debugging
          console.error('[Parse Invoice] All JSON parsing attempts failed')
          console.error('[Parse Invoice] Final error:', finalError.message)
          console.error('[Parse Invoice] Full AI response:', content)
          
          // Return a more detailed error that includes what we tried
          const errorDetails = `JSON parsing failed after multiple repair attempts. ` +
            `Response length: ${content.length} chars. ` +
            `First 200 chars: ${content.substring(0, 200)}... ` +
            `Last error: ${finalError.message || secondError.message}`
          
          throw new Error(`Invalid JSON response from AI: ${errorDetails}`)
        }
      }
    }
    
    // Validate and clean the data
    return {
      company: {
        name: parsed.company?.name || null,
        email: parsed.company?.email || null,
        phone: parsed.company?.phone || null,
        address: parsed.company?.address || null,
      },
      jobReference: parsed.jobReference || null,
      invoiceNumber: parsed.invoiceNumber || null,
      invoiceDate: parsed.invoiceDate || null,
      lineItems: (parsed.lineItems || []).map((item, index) => ({
        description: item.description || `Line Item ${index + 1}`,
        category: item.category || null,
        quantity: typeof item.quantity === 'number' ? item.quantity : null,
        unit: item.unit || null,
        unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : null,
        amount: typeof item.amount === 'number' ? item.amount : 0,
        notes: item.notes || null,
      })),
      subtotal: typeof parsed.subtotal === 'number' ? parsed.subtotal : null,
      tax: typeof parsed.tax === 'number' ? parsed.tax : null,
      total: typeof parsed.total === 'number' ? parsed.total : 
             (parsed.lineItems || []).reduce((sum, item) => sum + (item.amount || 0), 0),
      timeline: parsed.timeline || null,
      notes: parsed.notes || null,
      paymentTerms: parsed.paymentTerms || null,
    }
  } catch (error: any) {
    console.error('[Parse Invoice] Error parsing invoice with AI:', error)
    console.error('[Parse Invoice] Error stack:', error.stack)
    
    // Provide more specific error messages
    if (error.message?.includes('JSON') || error.message?.includes('Invalid JSON')) {
      // Include more context in the error message
      const detailedMessage = error.message.includes('Response length') 
        ? error.message 
        : `AI returned invalid JSON. The document may be too complex or unclear. ${error.message}`
      throw new Error(detailedMessage)
    } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      throw new Error('AI service is temporarily unavailable. Please try again in a moment.')
    } else if (error.message?.includes('timeout')) {
      throw new Error('AI parsing timed out. The document may be too large or complex.')
    } else if (error.message?.includes('No response from AI')) {
      throw new Error('AI did not return a response. The document may be too large or the service may be unavailable.')
    } else if (error.message) {
      throw new Error(`AI parsing failed: ${error.message}`)
    } else {
      throw new Error('Failed to parse invoice with AI. Please ensure the document is a valid invoice or bid.')
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 50MB.` },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      )
    }

    // Validate file type - check both MIME type and extension
    const fileName = file.name.toLowerCase()
    const isValidPdf = 
      file.type === 'application/pdf' || 
      file.type.includes('pdf') ||
      fileName.endsWith('.pdf')

    if (!isValidPdf) {
      return NextResponse.json(
        { error: `File must be a PDF. Received type: ${file.type || 'unknown'}` },
        { status: 400 }
      )
    }

    // Convert file to buffer
    console.log(`[Parse Invoice] Processing file: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Step 1: Extract text from PDF
    console.log(`[Parse Invoice] Extracting text from PDF: ${file.name}`)
    let extractedText: string
    try {
      extractedText = await extractTextFromPDF(buffer)
    } catch (pdfError: any) {
      console.error('[Parse Invoice] PDF extraction failed:', pdfError)
      // Don't return error yet - try OCR fallback
      extractedText = ''
    }
    
    // If insufficient text extracted, try OCR for scanned PDFs
    if (!extractedText || extractedText.trim().length < 50) {
      const extractedLength = extractedText?.length || 0
      console.warn(`[Parse Invoice] Insufficient text extracted: ${extractedLength} characters. Attempting OCR...`)
      
      let ocrSuccess = false
      
      // Option 1: Try GPT-4 Vision OCR via aiGateway (if PDF can be converted to images)
      // Note: This still requires PDF-to-image conversion, which currently uses PDF.co
      // but GPT-4 Vision provides better OCR quality for invoices
      if (process.env.PDF_CO_API_KEY) {
        try {
          // First, convert PDF to images using PDF.co (just for conversion, not OCR)
          const imageUrls = await convertPDFToImagesForOCR(buffer, file.name)
          
          if (imageUrls && imageUrls.length > 0) {
            console.log(`[Parse Invoice] Converted PDF to ${imageUrls.length} images, using GPT-4 Vision for OCR...`)
            const visionText = await extractTextWithGPT4Vision(imageUrls)
            
            if (visionText && visionText.trim().length > 50) {
              extractedText = visionText + (extractedText ? `\n\n--- Additional extracted text ---\n${extractedText}` : '')
              console.log(`[Parse Invoice] GPT-4 Vision OCR extracted ${visionText.length} characters`)
              ocrSuccess = true
            }
          }
        } catch (visionError: any) {
          console.warn('[Parse Invoice] GPT-4 Vision OCR failed, trying PDF.co OCR:', visionError.message)
        }
      }
      
      // Option 2: Fallback to PDF.co OCR if GPT-4 Vision didn't work
      if (!ocrSuccess && process.env.PDF_CO_API_KEY) {
        try {
          const ocrPages = await extractTextWithOCR(buffer, file.name)
          
          if (ocrPages && ocrPages.length > 0) {
            // Combine OCR text from all pages
            const ocrText = ocrPages
              .map(page => `\n=== PAGE ${page.pageNumber} ===\n${page.text}`)
              .join('\n')
            
            // Merge with any existing text (OCR takes precedence)
            extractedText = ocrText + (extractedText ? `\n\n--- Additional extracted text ---\n${extractedText}` : '')
            
            console.log(`[Parse Invoice] PDF.co OCR extracted ${ocrText.length} characters from ${ocrPages.length} pages`)
            ocrSuccess = true
          }
        } catch (ocrError: any) {
          console.error('[Parse Invoice] PDF.co OCR extraction failed:', ocrError)
        }
      }
      
      // Final check - if still insufficient text, return error
      if (!ocrSuccess && (!extractedText || extractedText.trim().length < 50)) {
        const finalLength = extractedText?.length || 0
        console.warn(`[Parse Invoice] Insufficient text extracted after OCR attempts: ${finalLength} characters`)
        return NextResponse.json(
          { 
            error: `Could not extract sufficient text from PDF (only ${finalLength} characters found). The file may be image-based (scanned document) or corrupted. ${process.env.PDF_CO_API_KEY ? 'Both GPT-4 Vision and PDF.co OCR were attempted but failed.' : 'OCR is not configured (PDF_CO_API_KEY not set).'} Please use a PDF with selectable text or convert the scanned document to text first.` 
          },
          { status: 400 }
        )
      }
    }
    
    console.log(`[Parse Invoice] Extracted ${extractedText.length} characters of text`)

    // Step 2: Parse with AI
    console.log(`[Parse Invoice] Parsing invoice with AI...`)
    let parsedData: ParsedInvoiceData
    try {
      parsedData = await parseInvoiceWithAI(extractedText, file.name)
    } catch (aiError: any) {
      console.error('[Parse Invoice] AI parsing failed:', aiError)
      return NextResponse.json(
        { error: `Failed to parse invoice with AI: ${aiError.message || 'Unknown error'}. Please check if the document is a valid invoice or bid.` },
        { status: 500 }
      )
    }
    
    console.log(`[Parse Invoice] Successfully parsed invoice with ${parsedData.lineItems.length} line items`)

    return NextResponse.json({
      success: true,
      data: parsedData,
      extractedTextLength: extractedText.length,
    })

  } catch (error: any) {
    console.error('[Parse Invoice] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse invoice. Please try again or contact support if the problem persists.' },
      { status: 500 }
    )
  }
}

