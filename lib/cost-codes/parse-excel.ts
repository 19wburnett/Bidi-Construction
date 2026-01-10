/**
 * Excel Parsing Utility for Cost Codes
 * Extracts structured data from Excel files (.xlsx, .xls, CSV)
 */

import * as XLSX from 'xlsx'
import { CostCode } from '@/lib/cost-code-helpers'

export interface ExcelParseResult {
  rawData: any[]
  textContent: string
  sheets: string[]
}

/**
 * Parse Excel file and extract raw data
 */
export function parseExcelFile(buffer: Buffer): ExcelParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets: string[] = []
    const rawData: any[] = []
    let textContent = ''

    // Process each sheet
    workbook.SheetNames.forEach((sheetName) => {
      sheets.push(sheetName)
      const worksheet = workbook.Sheets[sheetName]
      
      // Convert to JSON array
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, // Use array format
        defval: '', // Default value for empty cells
        raw: false // Convert all values to strings
      })
      
      rawData.push({
        sheetName,
        data: sheetData
      })

      // Convert to CSV for text extraction
      const csv = XLSX.utils.sheet_to_csv(worksheet)
      textContent += `\n=== Sheet: ${sheetName} ===\n${csv}\n`
    })

    return {
      rawData,
      textContent,
      sheets
    }
  } catch (error) {
    console.error('Error parsing Excel file:', error)
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Attempt to extract cost codes from Excel data structure
 * This is a best-effort extraction - AI will refine it
 */
export function extractCostCodesFromExcelData(parseResult: ExcelParseResult): Partial<CostCode>[] {
  const costCodes: Partial<CostCode>[] = []

  for (const sheet of parseResult.rawData) {
    const { sheetName, data } = sheet
    
    if (!Array.isArray(data) || data.length === 0) continue

    // Try to find header row (look for common cost code column names)
    let headerRowIndex = -1
    const headerKeywords = ['code', 'cost code', 'division', 'description', 'item', 'number']
    
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i] as any[]
      if (Array.isArray(row)) {
        const rowText = row.join(' ').toLowerCase()
        if (headerKeywords.some(keyword => rowText.includes(keyword))) {
          headerRowIndex = i
          break
        }
      }
    }

    // If no header found, assume first row is header
    if (headerRowIndex === -1) headerRowIndex = 0

    const headerRow = data[headerRowIndex] as any[]
    if (!Array.isArray(headerRow)) continue

    // Find column indices
    const codeColIndex = headerRow.findIndex((h: any) => 
      String(h).toLowerCase().includes('code') || String(h).toLowerCase().includes('number')
    )
    const descColIndex = headerRow.findIndex((h: any) => 
      String(h).toLowerCase().includes('description') || String(h).toLowerCase().includes('item')
    )
    const divColIndex = headerRow.findIndex((h: any) => 
      String(h).toLowerCase().includes('division') || String(h).toLowerCase().includes('category')
    )

    // Extract data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as any[]
      if (!Array.isArray(row) || row.length === 0) continue

      const code = codeColIndex >= 0 ? String(row[codeColIndex] || '').trim() : ''
      const description = descColIndex >= 0 ? String(row[descColIndex] || '').trim() : ''
      const division = divColIndex >= 0 ? String(row[divColIndex] || '').trim() : ''

      // Skip empty rows
      if (!code && !description) continue

      // Try to extract division from code if not found
      let extractedDivision = division
      let extractedCode = code
      
      if (!extractedDivision && code) {
        // Try patterns like "03-3000", "03 30 00", "033000"
        const match = code.match(/^(\d{1,2})[-\s]?(\d+)/)
        if (match) {
          extractedDivision = match[1]
          extractedCode = match[2]
        }
      }

      costCodes.push({
        division: extractedDivision || '',
        code: extractedCode || code,
        description: description || '',
        fullCode: extractedDivision && extractedCode 
          ? `${extractedDivision}-${extractedCode}` 
          : code || ''
      })
    }
  }

  return costCodes
}
