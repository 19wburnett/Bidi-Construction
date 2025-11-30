import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
// @ts-ignore - pdf2json doesn't have TypeScript types  
import PDFParser from 'pdf2json'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

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

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('Error parsing PDF:', errData.parserError)
      reject(new Error('Failed to parse PDF'))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let text = ''
        
        // Extract text with page separation
        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            text += `\n=== PAGE ${pageIndex + 1} ===\n`
            
            if (page.Texts) {
              // Sort texts by position for better reading order
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                const yDiff = a.y - b.y
                if (Math.abs(yDiff) > 0.5) return yDiff
                return a.x - b.x
              })
              
              sortedTexts.forEach((textItem: any) => {
                if (textItem.R) {
                  textItem.R.forEach((r: any) => {
                    if (r.T) {
                      text += decodeURIComponent(r.T) + ' '
                    }
                  })
                }
              })
              text += '\n'
            }
          })
        }
        
        resolve(text.trim())
      } catch (error) {
        console.error('Error extracting text:', error)
        resolve('') // Return empty string instead of rejecting
      }
    })

    pdfParser.parseBuffer(buffer)
  })
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for more consistent extraction
      max_tokens: 4000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Clean up the response - remove any markdown formatting
    let cleanedContent = content.trim()
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7)
    }
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3)
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3)
    }
    cleanedContent = cleanedContent.trim()

    const parsed: ParsedInvoiceData = JSON.parse(cleanedContent)
    
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
  } catch (error) {
    console.error('Error parsing invoice with AI:', error)
    throw new Error('Failed to parse invoice with AI')
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

    // Validate file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Step 1: Extract text from PDF
    console.log(`[Parse Invoice] Extracting text from PDF: ${file.name}`)
    const extractedText = await extractTextFromPDF(buffer)
    
    if (!extractedText || extractedText.length < 50) {
      return NextResponse.json(
        { error: 'Could not extract sufficient text from PDF. The file may be image-based or corrupted.' },
        { status: 400 }
      )
    }
    
    console.log(`[Parse Invoice] Extracted ${extractedText.length} characters of text`)

    // Step 2: Parse with AI
    console.log(`[Parse Invoice] Parsing invoice with AI...`)
    const parsedData = await parseInvoiceWithAI(extractedText, file.name)
    
    console.log(`[Parse Invoice] Successfully parsed invoice with ${parsedData.lineItems.length} line items`)

    return NextResponse.json({
      success: true,
      data: parsedData,
      extractedTextLength: extractedText.length,
    })

  } catch (error: any) {
    console.error('[Parse Invoice] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse invoice' },
      { status: 500 }
    )
  }
}

