import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET - Fetch all contacts for the current GC
export async function GET(request: NextRequest) {
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
      return NextResponse.json({ error: 'Only GCs can access contacts' }, { status: 403 })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const tradeCategory = searchParams.get('trade_category')
    const location = searchParams.get('location')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('gc_contacts')
      .select('*')
      .eq('gc_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (tradeCategory) {
      query = query.eq('trade_category', tradeCategory)
    }
    
    if (location) {
      query = query.ilike('location', `%${location}%`)
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
    }

    const { data: contacts, error } = await query

    if (error) {
      console.error('Error fetching contacts:', error)
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
    }

    return NextResponse.json({ contacts })

  } catch (error) {
    console.error('Error in contacts GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new contact
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
      return NextResponse.json({ error: 'Only GCs can create contacts' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, company, phone, trade_category, location, notes } = body

    // Validate required fields
    if (!email || !name || !trade_category || !location) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, name, trade_category, location' 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Create the contact
    const { data: contact, error } = await supabase
      .from('gc_contacts')
      .insert([{
        gc_id: user.id,
        email,
        name,
        company,
        phone,
        trade_category,
        location,
        notes
      }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 })
      }
      console.error('Error creating contact:', error)
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    }

    return NextResponse.json({ contact }, { status: 201 })

  } catch (error) {
    console.error('Error in contacts POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a contact
export async function PUT(request: NextRequest) {
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
      return NextResponse.json({ error: 'Only GCs can update contacts' }, { status: 403 })
    }

    const body = await request.json()
    const { id, email, name, company, phone, trade_category, location, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    // Validate required fields
    if (!email || !name || !trade_category || !location) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, name, trade_category, location' 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Update the contact
    const { data: contact, error } = await supabase
      .from('gc_contacts')
      .update({
        email,
        name,
        company,
        phone,
        trade_category,
        location,
        notes
      })
      .eq('id', id)
      .eq('gc_id', user.id) // Ensure user can only update their own contacts
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 })
      }
      console.error('Error updating contact:', error)
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
    }

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json({ contact })

  } catch (error) {
    console.error('Error in contacts PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a contact
export async function DELETE(request: NextRequest) {
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
      return NextResponse.json({ error: 'Only GCs can delete contacts' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    // Delete the contact
    const { error } = await supabase
      .from('gc_contacts')
      .delete()
      .eq('id', id)
      .eq('gc_id', user.id) // Ensure user can only delete their own contacts

    if (error) {
      console.error('Error deleting contact:', error)
      return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in contacts DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
