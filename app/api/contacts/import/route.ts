import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
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
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a GC
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
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

    // Validate contacts
    const validationResult = validateContacts(contacts)
    if (validationResult.errors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors found',
        details: validationResult.errors 
      }, { status: 400 })
    }

    // Import contacts using the database function
    const { data: importResult, error: importError } = await supabase
      .rpc('bulk_import_gc_contacts', {
        p_gc_id: user.id,
        p_contacts: JSON.stringify(contacts)
      })

    if (importError) {
      console.error('Error importing contacts:', importError)
      return NextResponse.json({ 
        error: 'Failed to import contacts' 
      }, { status: 500 })
    }

    const result = importResult[0] as ImportResult

    return NextResponse.json({
      success: true,
      imported_count: result.imported_count,
      skipped_count: result.skipped_count,
      errors: result.errors,
      message: `Successfully imported ${result.imported_count} contacts. ${result.skipped_count} contacts were skipped.`
    })

  } catch (error) {
    console.error('Error in contacts import API:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
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

function validateContacts(contacts: ContactRow[]): { errors: string[] } {
  const errors: string[] = []
  
  if (contacts.length === 0) {
    errors.push('No contacts found in the file')
    return { errors }
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

  contacts.forEach((contact, index) => {
    const rowNum = index + 2 // +2 because we start from row 2 (after header)

    // Check required fields
    requiredFields.forEach(field => {
      if (!contact[field as keyof ContactRow]?.toString().trim()) {
        errors.push(`Row ${rowNum}: ${field} is required`)
      }
    })

    // Validate email format
    if (contact.email && !isValidEmail(contact.email)) {
      errors.push(`Row ${rowNum}: Invalid email format`)
    }

    // Validate trade category
    if (contact.trade_category && !validTradeCategories.includes(contact.trade_category)) {
      errors.push(`Row ${rowNum}: Invalid trade category. Must be one of: ${validTradeCategories.join(', ')}`)
    }
  })

  return { errors }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
