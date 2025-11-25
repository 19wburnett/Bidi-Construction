import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getEffectiveUserId } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

interface ContactRow {
  email: string
  name: string
  company?: string
  phone?: string
  trade_category: string
  location: string
  notes?: string
}

interface ImportResult {
  imported_count: number
  skipped_count: number
  errors: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the effective user ID (handles masquerading)
    const effectiveUserId = await getEffectiveUserId()
    
    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a GC
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', effectiveUserId)
      .single()

    if (userError || !userData || userData.role !== 'GC') {
      return NextResponse.json({ error: 'Only GCs can import contacts' }, { status: 403 })
    }

    // Parse the form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Please upload a CSV or Excel file.' 
      }, { status: 400 })
    }

    // Read and parse the file
    const buffer = await file.arrayBuffer()
    let contacts: ContactRow[] = []

    try {
      if (file.type === 'text/csv') {
        // Parse CSV
        const text = new TextDecoder().decode(buffer)
        contacts = parseCSV(text)
      } else {
        // Parse Excel
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        contacts = parseExcelSheet(worksheet)
      }
    } catch (parseError) {
      console.error('Error parsing file:', parseError)
      return NextResponse.json({ 
        error: 'Error parsing file. Please check the format and try again.' 
      }, { status: 400 })
    }

    // Validate contacts and normalize them
    const validationResult = validateContacts(contacts)
    if (validationResult.errors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors found',
        details: validationResult.errors 
      }, { status: 400 })
    }

    // Use normalized contacts for import
    const contactsToImport = validationResult.normalizedContacts.length > 0 
      ? validationResult.normalizedContacts 
      : contacts

    // Import contacts using the database function
    // Convert contacts array to the format expected by the database function
    // Supabase will automatically convert JavaScript arrays/objects to JSONB
    const contactsJson = contactsToImport.map(contact => ({
      email: contact.email,
      name: contact.name,
      company: contact.company || null,
      phone: contact.phone || null,
      trade_category: contact.trade_category,
      location: contact.location,
      notes: contact.notes || null
    }))

    console.log(`Attempting to import ${contactsJson.length} contacts for GC ${effectiveUserId}`)
    
    const { data: importResult, error: importError } = await supabase
      .rpc('bulk_import_gc_contacts', {
        p_gc_id: effectiveUserId,
        p_contacts: contactsJson
      })

    if (importError) {
      console.error('Error importing contacts:', importError)
      console.error('Import error details:', JSON.stringify(importError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to import contacts',
        details: importError.message || 'Unknown error'
      }, { status: 500 })
    }

    if (!importResult || importResult.length === 0) {
      console.error('No result returned from bulk_import_gc_contacts')
      return NextResponse.json({ 
        error: 'No result returned from import function' 
      }, { status: 500 })
    }

    const result = importResult[0] as ImportResult

    return NextResponse.json({
      success: true,
      imported_count: result.imported_count || 0,
      skipped_count: result.skipped_count || 0,
      errors: result.errors || [],
      message: `Successfully imported ${result.imported_count || 0} contacts. ${result.skipped_count || 0} contacts were skipped.`
    })

  } catch (error) {
    console.error('Error in contacts import API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error stack:', errorStack)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage
    }, { status: 500 })
  }
}

function parseCSV(csvText: string): ContactRow[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row')
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const contacts: ContactRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) continue

    const contact: any = {}
    headers.forEach((header, index) => {
      contact[header] = values[index] || ''
    })

    // Map common column names
    const mappedContact: ContactRow = {
      email: contact.email || contact.e_mail || contact['e-mail'] || '',
      name: contact.name || contact.contact_name || contact.full_name || '',
      company: contact.company || contact.business || contact.organization || '',
      phone: contact.phone || contact.telephone || contact.phone_number || '',
      trade_category: contact.trade_category || contact.trade || contact.category || contact.specialty || '',
      location: contact.location || contact.city || contact.address || contact.area || '',
      notes: contact.notes || contact.comments || contact.description || ''
    }

    contacts.push(mappedContact)
  }

  return contacts
}

function parseExcelSheet(worksheet: XLSX.WorkSheet): ContactRow[] {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
  
  if (jsonData.length < 2) {
    throw new Error('Excel file must have at least a header row and one data row')
  }

  const headers = (jsonData[0] as string[]).map(h => h?.toString().toLowerCase() || '')
  const contacts: ContactRow[] = []

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as any[]
    if (!row || row.length === 0) continue

    const contact: any = {}
    headers.forEach((header, index) => {
      contact[header] = row[index]?.toString() || ''
    })

    // Map common column names
    const mappedContact: ContactRow = {
      email: contact.email || contact.e_mail || contact['e-mail'] || '',
      name: contact.name || contact.contact_name || contact.full_name || '',
      company: contact.company || contact.business || contact.organization || '',
      phone: contact.phone || contact.telephone || contact.phone_number || '',
      trade_category: contact.trade_category || contact.trade || contact.category || contact.specialty || '',
      location: contact.location || contact.city || contact.address || contact.area || '',
      notes: contact.notes || contact.comments || contact.description || ''
    }

    contacts.push(mappedContact)
  }

  return contacts
}

function validateContacts(contacts: ContactRow[]): { errors: string[], normalizedContacts: ContactRow[] } {
  const errors: string[] = []
  const normalizedContacts: ContactRow[] = []
  
  if (contacts.length === 0) {
    errors.push('No contacts found in the file')
    return { errors, normalizedContacts }
  }

  if (contacts.length > 1000) {
    errors.push('Too many contacts. Maximum 1000 contacts per import.')
  }

  const requiredFields = ['email', 'name', 'trade_category', 'location']
  const validTradeCategories = [
    'Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Flooring', 'Painting',
    'Drywall', 'Carpentry', 'Concrete', 'Landscaping', 'Excavation',
    'Insulation', 'Windows & Doors', 'Siding', 'General Construction',
    'Renovation', 'Other'
  ]

  // Create a normalized map for case-insensitive matching
  const normalizedTradeMap = new Map<string, string>()
  validTradeCategories.forEach(cat => {
    normalizedTradeMap.set(cat.toLowerCase().trim(), cat)
    // Also handle common variations
    normalizedTradeMap.set(cat.toLowerCase().replace(/\s+/g, ''), cat)
    normalizedTradeMap.set(cat.toLowerCase().replace(/\s+/g, '-'), cat)
  })

  // Common trade category mappings
  const tradeCategoryMappings: Record<string, string> = {
    'electric': 'Electrical',
    'electrician': 'Electrical',
    'plumber': 'Plumbing',
    'hvac': 'HVAC',
    'heating': 'HVAC',
    'cooling': 'HVAC',
    'hvac & gas lines': 'HVAC',
    'hvac and gas lines': 'HVAC',
    'roof': 'Roofing',
    'roofer': 'Roofing',
    'roof (labor)': 'Roofing',
    'roof labor': 'Roofing',
    'floor': 'Flooring',
    'floor coverings': 'Flooring',
    'floor covering': 'Flooring',
    'paint': 'Painting',
    'painter': 'Painting',
    'dry wall': 'Drywall',
    'dry-wall': 'Drywall',
    'carpenter': 'Carpentry',
    'framing': 'Carpentry',
    'frame': 'Carpentry',
    'framing (turnkey)': 'Carpentry',
    'framing turnkey': 'Carpentry',
    'trusses': 'Carpentry',
    'truss': 'Carpentry',
    'lumber': 'Carpentry',
    'finish work': 'Carpentry',
    'finish': 'Carpentry',
    'concrete work': 'Concrete',
    'landscape': 'Landscaping',
    'landscaper': 'Landscaping',
    'excavate': 'Excavation',
    'excavator': 'Excavation',
    'insulate': 'Insulation',
    'window': 'Windows & Doors',
    'windows': 'Windows & Doors',
    'door': 'Windows & Doors',
    'windows and doors': 'Windows & Doors',
    'windows & doors': 'Windows & Doors',
    'siding contractor': 'Siding',
    'stucco': 'Siding',
    'soffit, fascia, & rain gutter': 'Roofing',
    'soffit fascia rain gutter': 'Roofing',
    'soffit': 'Roofing',
    'fascia': 'Roofing',
    'rain gutter': 'Roofing',
    'general contractor': 'General Construction',
    'gc': 'General Construction',
    'general': 'General Construction',
    'renovate': 'Renovation',
    'remodel': 'Renovation',
    'remodeling': 'Renovation',
    'specialty': 'Other',
    'hardware & glass': 'Other',
    'hardware and glass': 'Other',
    'hardware': 'Other',
    'brick': 'Other',
    'granite countertops': 'Other',
    'granite': 'Other',
    'countertops': 'Other'
  }

  contacts.forEach((contact, index) => {
    const rowNum = index + 2 // +2 because we start from row 2 (after header)
    const normalizedContact: ContactRow = { ...contact }
    let hasRowErrors = false

    // Normalize all string fields (trim whitespace)
    if (normalizedContact.email) {
      normalizedContact.email = normalizedContact.email.trim()
    }
    if (normalizedContact.name) {
      normalizedContact.name = normalizedContact.name.trim()
    }
    if (normalizedContact.location) {
      normalizedContact.location = normalizedContact.location.trim()
    }
    if (normalizedContact.company) {
      normalizedContact.company = normalizedContact.company.trim()
    }
    if (normalizedContact.phone) {
      normalizedContact.phone = normalizedContact.phone.trim()
    }

    // Normalize trade category
    if (normalizedContact.trade_category) {
      const originalCategory = normalizedContact.trade_category
      const trimmedCategory = originalCategory.trim()
      const lowerCategory = trimmedCategory.toLowerCase()
      
      // Try exact match first
      if (validTradeCategories.includes(trimmedCategory)) {
        normalizedContact.trade_category = trimmedCategory
      }
      // Try case-insensitive match
      else if (normalizedTradeMap.has(lowerCategory)) {
        normalizedContact.trade_category = normalizedTradeMap.get(lowerCategory)!
      }
      // Try mapping common variations
      else if (tradeCategoryMappings[lowerCategory]) {
        normalizedContact.trade_category = tradeCategoryMappings[lowerCategory]
      }
      // Try matching without spaces
      else if (normalizedTradeMap.has(lowerCategory.replace(/\s+/g, ''))) {
        normalizedContact.trade_category = normalizedTradeMap.get(lowerCategory.replace(/\s+/g, ''))!
      }
      // Try extracting main word before parentheses (e.g., "Framing (turnkey)" -> "framing")
      else if (lowerCategory.includes('(')) {
        const mainWord = lowerCategory.split('(')[0].trim()
        if (tradeCategoryMappings[mainWord]) {
          normalizedContact.trade_category = tradeCategoryMappings[mainWord]
        } else if (normalizedTradeMap.has(mainWord)) {
          normalizedContact.trade_category = normalizedTradeMap.get(mainWord)!
        } else {
          normalizedContact.trade_category = trimmedCategory
        }
      }
      // If still no match, keep original for error reporting
      else {
        normalizedContact.trade_category = trimmedCategory
      }
    }

    // Check required fields
    requiredFields.forEach(field => {
      const value = normalizedContact[field as keyof ContactRow]?.toString().trim()
      if (!value) {
        errors.push(`Row ${rowNum}: ${field} is required`)
        hasRowErrors = true
      }
    })

    // Validate email format
    if (normalizedContact.email) {
      if (!isValidEmail(normalizedContact.email)) {
        errors.push(`Row ${rowNum}: Invalid email format`)
        hasRowErrors = true
      }
    }

    // Validate trade category
    if (normalizedContact.trade_category) {
      if (!validTradeCategories.includes(normalizedContact.trade_category)) {
        // Try to find a close match for better error message
        const lowerCategory = normalizedContact.trade_category.toLowerCase()
        const closeMatch = validTradeCategories.find(cat => 
          cat.toLowerCase().includes(lowerCategory) || 
          lowerCategory.includes(cat.toLowerCase())
        )
        
        if (closeMatch) {
          errors.push(`Row ${rowNum}: Invalid trade category "${normalizedContact.trade_category}". Did you mean "${closeMatch}"? Valid options: ${validTradeCategories.join(', ')}`)
        } else {
          errors.push(`Row ${rowNum}: Invalid trade category "${normalizedContact.trade_category}". Must be one of: ${validTradeCategories.join(', ')}`)
        }
        hasRowErrors = true
      }
    }

    // Always add normalized contact (errors will prevent import if any exist)
    normalizedContacts.push(normalizedContact)
  })

  return { errors, normalizedContacts }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
