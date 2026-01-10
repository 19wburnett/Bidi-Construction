/**
 * Custom Cost Code Extraction Service
 * Uses AI to extract cost codes from uploaded documents (PDF or Excel)
 */

import OpenAI from 'openai'
import { extractTextWithOCR } from '@/lib/ingestion/pdf-ocr-extractor'
import { extractTextPerPage } from '@/lib/ingestion/pdf-text-extractor'
import { parseExcelFile, extractCostCodesFromExcelData } from './parse-excel'
import { CostCode } from '@/lib/cost-code-helpers'
// @ts-ignore - pdf2json doesn't have TypeScript types
import PDFParser from 'pdf2json'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Fallback PDF text extraction using pdf2json
 */
async function extractTextWithPdf2Json(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()
    let timeoutId: NodeJS.Timeout | null = null
    let resolved = false

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('PDF parsing timed out'))
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
      reject(new Error(errData?.parserError?.message || 'PDF parsing error'))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      cleanup()
      if (resolved) return
      resolved = true

      try {
        let text = ''
        if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            text += `\n=== PAGE ${pageIndex + 1} ===\n`
            if (page.Texts && Array.isArray(page.Texts)) {
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
                      } catch {
                        text += (r.T || '') + ' '
                      }
                    }
                  })
                }
              })
              text += '\n'
            }
          })
        }
        resolve(text.trim())
      } catch (error: any) {
        reject(new Error(`Error extracting text: ${error.message || 'Unknown error'}`))
      }
    })

    try {
      pdfParser.parseBuffer(buffer)
    } catch (error: any) {
      cleanup()
      if (!resolved) {
        resolved = true
        reject(error)
      }
    }
  })
}

/**
 * Extract cost codes from a document (PDF or Excel)
 */
export async function extractCostCodesFromDocument(
  fileBuffer: Buffer,
  fileType: 'pdf' | 'excel',
  fileName: string = 'document'
): Promise<CostCode[]> {
  let extractedText = ''
  let structuredData: any = null

  try {
    if (fileType === 'excel') {
      // Parse Excel file
      const parseResult = parseExcelFile(fileBuffer)
      extractedText = parseResult.textContent
      structuredData = parseResult.rawData
      
      // Also try to extract cost codes directly from Excel structure
      const directExtraction = extractCostCodesFromExcelData(parseResult)
      if (directExtraction.length > 0) {
        console.log(`[Cost Code Extraction] Direct Excel extraction found ${directExtraction.length} potential cost codes`)
      }
    } else {
      // Extract text from PDF using regular text extraction (no OCR needed)
      // OCR is expensive and not necessary - we just need the text for AI to read
      try {
        const textPages = await extractTextPerPage(fileBuffer)
        if (textPages.length > 0) {
          extractedText = textPages
            .map(page => `=== Page ${page.pageNumber} ===\n${page.text || ''}`)
            .join('\n\n')
        }
      } catch (textError) {
        console.warn('[Cost Code Extraction] Regular text extraction failed, trying pdf2json:', textError)
        
        // Fallback to pdf2json
        try {
          const pdfText = await extractTextWithPdf2Json(fileBuffer)
          if (pdfText && pdfText.trim().length > 0) {
            extractedText = pdfText
          }
        } catch (pdf2jsonError) {
          // Last resort: try OCR if available (but don't fail if not)
          console.warn('[Cost Code Extraction] pdf2json failed, trying OCR as last resort')
          try {
            const ocrPages = await extractTextWithOCR(fileBuffer, fileName)
            if (ocrPages.length > 0) {
              extractedText = ocrPages
                .map(page => `=== Page ${page.pageNumber} ===\n${page.text}`)
                .join('\n\n')
            }
          } catch (ocrError) {
            console.error('[Cost Code Extraction] All PDF extraction methods failed')
            throw new Error(`Failed to extract text from PDF. The document may be image-based or corrupted. ${pdf2jsonError instanceof Error ? pdf2jsonError.message : 'Unknown error'}`)
          }
        }
      }
      
      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error('Failed to extract sufficient text from PDF. The document may be image-based or corrupted.')
      }
    }

    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error('Insufficient text extracted from document')
    }

    // Use AI to extract cost codes
    const costCodes = await extractCostCodesWithAI(extractedText, structuredData, fileType)
    
    return costCodes
  } catch (error) {
    console.error('[Cost Code Extraction] Error:', error)
    throw error
  }
}

/**
 * Use AI to extract cost codes from extracted text/data
 */
async function extractCostCodesWithAI(
  extractedText: string,
  structuredData: any,
  fileType: 'pdf' | 'excel'
): Promise<CostCode[]> {
  const systemPrompt = `You are an expert at analyzing construction cost code documents. Your task is to extract all cost codes from the provided document.

A cost code typically consists of:
- A division/category identifier (e.g., "03", "16", "1000")
- A code number (e.g., "3000", "5000", "1100")
- A description of the work item
- A full code combining division and code (e.g., "03-3000", "16-5000", "1000-1100")

Cost codes may appear in various formats:
- "03-3000" or "03 30 00" (CSI format)
- "1000-1100" (NAHB format)
- "16.50" or "16,50" (with decimals)
- Tables with columns for code, description, division
- Lists with hierarchical structure

Return a JSON object with this EXACT structure:
{
  "costCodes": [
    {
      "division": "03",
      "code": "3000",
      "description": "Cast-in-Place Concrete",
      "fullCode": "03-3000"
    }
  ]
}

Rules:
1. Extract ALL cost codes found in the document
2. If division is not explicitly stated, try to infer it from the code format
3. If code format is "03 30 00", use division "03" and code "3000"
4. If code format is "1000-1100", use division "1000" and code "1100"
5. Clean up descriptions (remove extra whitespace, formatting)
6. Ensure fullCode combines division and code with a hyphen (e.g., "03-3000")
7. If you cannot determine division or code, use empty string but still include the description
8. The response MUST be a JSON object with a "costCodes" property containing an array

Return ONLY valid JSON object, no additional text or markdown formatting.`

  let userPrompt = `Extract all cost codes from this ${fileType.toUpperCase()} document.

Document content:
${extractedText.substring(0, 15000)}${extractedText.length > 15000 ? '\n\n[... content truncated ...]' : ''}`

  if (structuredData && fileType === 'excel') {
    userPrompt += `\n\nStructured data (first few rows):
${JSON.stringify(structuredData.slice(0, 3), null, 2)}`
  }

  try {
    let response
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 8000, // Increased for large cost code sets
        response_format: { type: 'json_object' }
      })
    } catch (formatError: any) {
      // Fallback if response_format fails
      console.warn('[Cost Code Extraction] response_format failed, retrying without it')
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 8000 // Increased for large cost code sets
      })
    }

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Log raw response for debugging (first 1000 chars)
    console.log('[Cost Code Extraction] Raw AI response (first 1000 chars):', content.substring(0, 1000))

    // Parse JSON response
    let jsonData: any
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      let jsonString = content.trim()
      
      // Remove markdown code blocks if present
      if (jsonString.startsWith('```')) {
        const lines = jsonString.split('\n')
        jsonString = lines.slice(1, -1).join('\n').trim()
        if (jsonString.startsWith('json')) {
          jsonString = jsonString.substring(4).trim()
        }
      }
      
      // Try to find JSON object - look for the start of the object
      let jsonStart = jsonString.indexOf('{')
      if (jsonStart === -1) {
        // Try array format
        jsonStart = jsonString.indexOf('[')
        if (jsonStart !== -1) {
          // Wrap array in object
          jsonString = `{"costCodes": ${jsonString.substring(jsonStart)}}`
          jsonStart = 0
        }
      }
      
      if (jsonStart !== -1) {
        // Extract from the first { to try to get complete JSON
        let jsonToParse = jsonString.substring(jsonStart)
        
        // Try to find the end of the JSON object by counting braces
        let braceCount = 0
        let inString = false
        let escapeNext = false
        let endIndex = -1
        
        for (let i = 0; i < jsonToParse.length; i++) {
          const char = jsonToParse[i]
          
          if (escapeNext) {
            escapeNext = false
            continue
          }
          
          if (char === '\\') {
            escapeNext = true
            continue
          }
          
          if (char === '"') {
            inString = !inString
            continue
          }
          
          if (!inString) {
            if (char === '{') braceCount++
            if (char === '}') {
              braceCount--
              if (braceCount === 0) {
                endIndex = i + 1
                break
              }
            }
          }
        }
        
        if (endIndex > 0) {
          jsonToParse = jsonToParse.substring(0, endIndex)
        } else {
          // JSON appears truncated - try to fix it
          const openBraces = (jsonToParse.match(/\{/g) || []).length
          const closeBraces = (jsonToParse.match(/\}/g) || []).length
          const openBrackets = (jsonToParse.match(/\[/g) || []).length
          const closeBrackets = (jsonToParse.match(/\]/g) || []).length
          
          if (openBraces > closeBraces) {
            jsonToParse += '}'.repeat(openBraces - closeBraces)
          }
          if (openBrackets > closeBrackets) {
            jsonToParse += ']'.repeat(openBrackets - closeBrackets)
          }
        }
        
        try {
          jsonData = JSON.parse(jsonToParse)
        } catch (retryError) {
          // If still fails, try to extract individual cost code objects using regex
          const codePattern = /\{\s*"division"\s*:\s*"([^"]*)"\s*,\s*"code"\s*:\s*"([^"]*)"\s*,\s*"description"\s*:\s*"([^"]*)"(?:\s*,\s*"fullCode"\s*:\s*"([^"]*)")?\s*\}/g
          const salvagedCodes: any[] = []
          let match
          
          while ((match = codePattern.exec(jsonToParse)) !== null) {
            salvagedCodes.push({
              division: match[1] || '',
              code: match[2] || '',
              description: match[3] || '',
              fullCode: match[4] || (match[1] && match[2] ? `${match[1]}-${match[2]}` : '') || ''
            })
          }
          
          if (salvagedCodes.length > 0) {
            console.warn(`[Cost Code Extraction] Salvaged ${salvagedCodes.length} cost codes from malformed JSON`)
            jsonData = { costCodes: salvagedCodes }
          } else {
            // Last resort: try parsing the original string
            jsonData = JSON.parse(jsonString)
          }
        }
      } else {
        jsonData = JSON.parse(jsonString)
      }
      
      console.log('[Cost Code Extraction] Parsed JSON structure keys:', Object.keys(jsonData || {}))
    } catch (parseError) {
      console.error('[Cost Code Extraction] JSON parse error:', parseError)
      console.error('[Cost Code Extraction] Response content (first 2000 chars):', content.substring(0, 2000))
      console.error('[Cost Code Extraction] Response content (last 500 chars):', content.substring(Math.max(0, content.length - 500)))
      
      // Try to salvage partial JSON - extract what we can using regex
      console.warn('[Cost Code Extraction] Attempting to salvage cost codes from malformed JSON...')
      try {
        // Extract individual cost code objects using regex (more forgiving)
        const codePattern = /\{\s*"division"\s*:\s*"([^"]*)"\s*,\s*"code"\s*:\s*"([^"]*)"\s*,\s*"description"\s*:\s*"([^"]*)"(?:\s*,\s*"fullCode"\s*:\s*"([^"]*)")?\s*\}/g
        const salvagedCodes: any[] = []
        let match
        
        while ((match = codePattern.exec(content)) !== null) {
          const division = match[1] || ''
          const code = match[2] || ''
          const description = match[3] || ''
          const fullCode = match[4] || (division && code ? `${division}-${code}` : '') || ''
          
          // Only add if we have at least a description or code
          if (description || code || division) {
            salvagedCodes.push({
              division,
              code,
              description: description || 'Unnamed Item',
              fullCode: fullCode || (division && code ? `${division}-${code}` : code || division || '')
            })
          }
        }
        
        if (salvagedCodes.length > 0) {
          console.warn(`[Cost Code Extraction] Successfully salvaged ${salvagedCodes.length} cost codes from malformed JSON`)
          jsonData = { costCodes: salvagedCodes }
        } else {
          // Try alternative pattern (without quotes around values)
          const altPattern = /\{\s*division\s*:\s*([^,}]+)\s*,\s*code\s*:\s*([^,}]+)\s*,\s*description\s*:\s*([^,}]+)\s*(?:,\s*fullCode\s*:\s*([^}]+))?\s*\}/g
          while ((match = altPattern.exec(content)) !== null) {
            salvagedCodes.push({
              division: (match[1] || '').trim().replace(/^["']|["']$/g, ''),
              code: (match[2] || '').trim().replace(/^["']|["']$/g, ''),
              description: (match[3] || '').trim().replace(/^["']|["']$/g, '') || 'Unnamed Item',
              fullCode: (match[4] || '').trim().replace(/^["']|["']$/g, '') || ''
            })
          }
          
          if (salvagedCodes.length > 0) {
            console.warn(`[Cost Code Extraction] Successfully salvaged ${salvagedCodes.length} cost codes using alternative pattern`)
            jsonData = { costCodes: salvagedCodes }
          } else {
            throw parseError
          }
        }
      } catch (salvageError) {
        console.error('[Cost Code Extraction] Failed to salvage cost codes:', salvageError)
        throw new Error(`Could not parse JSON from AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }
    }

    // Extract cost codes array (could be in different keys or formats)
    let costCodes: any[] = []
    
    // Handle direct array response
    if (Array.isArray(jsonData)) {
      costCodes = jsonData
    }
    // Handle object with costCodes key
    else if (jsonData && typeof jsonData === 'object') {
      if (Array.isArray(jsonData.costCodes)) {
        costCodes = jsonData.costCodes
      } else if (Array.isArray(jsonData.cost_codes)) {
        costCodes = jsonData.cost_codes
      } else if (Array.isArray(jsonData.items)) {
        costCodes = jsonData.items
      } else if (Array.isArray(jsonData.data)) {
        costCodes = jsonData.data
      } else if (Array.isArray(jsonData.codes)) {
        costCodes = jsonData.codes
      } else {
        // Try to find any array property
        const arrayKeys = Object.keys(jsonData).filter(key => Array.isArray(jsonData[key]))
        if (arrayKeys.length > 0) {
          console.warn(`[Cost Code Extraction] Found array in unexpected key: ${arrayKeys[0]}, using it`)
          costCodes = jsonData[arrayKeys[0]]
        } else {
          console.error('[Cost Code Extraction] JSON structure:', JSON.stringify(jsonData, null, 2).substring(0, 1000))
          throw new Error('No cost codes array found in AI response. Response structure: ' + JSON.stringify(Object.keys(jsonData || {})))
        }
      }
    } else {
      throw new Error('Invalid JSON structure in AI response')
    }
    
    if (!Array.isArray(costCodes) || costCodes.length === 0) {
      console.warn('[Cost Code Extraction] No cost codes found or empty array')
      // Don't throw error - return empty array so user can see the issue
      return []
    }

    // Validate and normalize cost codes
    const validatedCodes: CostCode[] = costCodes
      .map((code: any) => {
        // Ensure required fields exist
        const division = String(code.division || code.division_code || '').trim()
        const codeNum = String(code.code || code.code_number || code.number || '').trim()
        const description = String(code.description || code.desc || code.item || '').trim()
        
        // Generate fullCode if not provided
        let fullCode = code.fullCode || code.full_code || ''
        if (!fullCode && division && codeNum) {
          fullCode = `${division}-${codeNum}`
        } else if (!fullCode && codeNum) {
          fullCode = codeNum
        }

        // Skip if no meaningful data
        if (!description && !codeNum) {
          return null
        }

        return {
          division: division || '',
          code: codeNum || '',
          description: description || 'Unnamed Item',
          fullCode: fullCode || codeNum || ''
        }
      })
      .filter((code): code is CostCode => code !== null)

    console.log(`[Cost Code Extraction] Successfully extracted ${validatedCodes.length} cost codes`)
    return validatedCodes
  } catch (error) {
    console.error('[Cost Code Extraction] AI extraction failed:', error)
    throw new Error(`Failed to extract cost codes: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
