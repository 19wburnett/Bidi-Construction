import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

/**
 * GET - Fetch full profile with photos, reviews, etc. (public)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Subcontractor ID is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Fetch subcontractor profile
    const { data: subcontractor, error: subError } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', id)
      .single()

    if (subError) {
      if (subError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Subcontractor not found' }, { status: 404 })
      }
      console.error('Error fetching subcontractor:', subError)
      return NextResponse.json(
        { error: 'Failed to fetch profile', details: subError.message },
        { status: 500 }
      )
    }

    // Fetch portfolio photos
    const { data: photos, error: photosError } = await supabase
      .from('subcontractor_portfolio_photos')
      .select('*')
      .eq('subcontractor_id', id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (photosError) {
      console.error('Error fetching portfolio photos:', photosError)
      // Continue even if photos fail to load
    }

    return NextResponse.json({
      subcontractor,
      photos: photos || [],
    })
  } catch (error) {
    console.error('Error in GET /api/subcontractors/[id]:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch profile',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update profile (admin or subcontractor auth required)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
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

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', authUser.id)
      .single()

    if (userError || !user?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()

    // Allowed fields for update
    const allowedFields = [
      'name',
      'email',
      'phone',
      'trade_category',
      'location',
      'website_url',
      'google_review_score',
      'google_reviews_link',
      'time_in_business',
      'jobs_completed',
      'licensed',
      'bonded',
      'notes',
      'profile_picture_url',
      'profile_summary',
      'services',
      'bio',
      'service_radius',
      'year_established',
    ]

    const updates: Record<string, any> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const supabaseAdmin = createAdminSupabaseClient()

    // Update subcontractor
    const { data: updatedSubcontractor, error: updateError } = await supabaseAdmin
      .from('subcontractors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating subcontractor:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ subcontractor: updatedSubcontractor })
  } catch (error) {
    console.error('Error in PATCH /api/subcontractors/[id]:', error)
    return NextResponse.json(
      {
        error: 'Failed to update profile',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

