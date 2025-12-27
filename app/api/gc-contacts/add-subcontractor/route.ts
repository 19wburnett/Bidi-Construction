import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST - Add a subcontractor to GC's contacts list
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subcontractorId } = body

    if (!subcontractorId) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if user is a GC
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role !== 'GC') {
      return NextResponse.json({ error: 'Only GCs can add subcontractors to contacts' }, { status: 403 })
    }

    // Fetch the subcontractor details
    const { data: subcontractor, error: subError } = await supabase
      .from('subcontractors')
      .select('id, name, email, trade_category, location, phone, company')
      .eq('id', subcontractorId)
      .single()

    if (subError || !subcontractor) {
      return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
    }

    // Check if contact already exists
    const { data: existingContact } = await supabase
      .from('gc_contacts')
      .select('id')
      .eq('gc_id', authUser.id)
      .eq('email', subcontractor.email)
      .single()

    if (existingContact) {
      return NextResponse.json(
        { error: 'This subcontractor is already in your contacts', contactId: existingContact.id },
        { status: 409 }
      )
    }

    // Add to gc_contacts
    const { data: newContact, error: insertError } = await supabase
      .from('gc_contacts')
      .insert({
        gc_id: authUser.id,
        email: subcontractor.email,
        name: subcontractor.name,
        company: subcontractor.company || null,
        phone: subcontractor.phone || null,
        trade_category: subcontractor.trade_category,
        location: subcontractor.location,
        notes: `Added from Bidi directory`
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding subcontractor to contacts:', insertError)
      return NextResponse.json(
        { error: 'Failed to add subcontractor to contacts', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ contact: newContact, message: 'Subcontractor added to contacts successfully' })
  } catch (error) {
    console.error('Error in POST /api/gc-contacts/add-subcontractor:', error)
    return NextResponse.json(
      {
        error: 'Failed to add subcontractor to contacts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

