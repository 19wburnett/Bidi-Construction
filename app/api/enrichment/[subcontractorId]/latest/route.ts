import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * GET - Fetch the latest enrichment for a subcontractor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subcontractorId: string }> }
) {
  try {
    const { subcontractorId } = await params

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

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', authUser.id)
      .single()

    if (userError || !user?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Create admin client for operations that need to bypass RLS
    const supabaseAdmin = createAdminSupabaseClient()

    // Fetch the latest enrichment for this subcontractor
    const { data: enrichment, error: fetchError } = await supabaseAdmin
      .from('subcontractor_enrichments')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No enrichment found
        return NextResponse.json({ 
          enrichment: null,
          message: 'No enrichment found for this subcontractor' 
        })
      }
      console.error('Error fetching enrichment:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch enrichment' }, { status: 500 })
    }

    // Also fetch the subcontractor for context
    const { data: subcontractor } = await supabaseAdmin
      .from('subcontractors')
      .select('id, name, trade_category, location, website_url, phone, profile_picture_url, enrichment_status')
      .eq('id', subcontractorId)
      .single()

    return NextResponse.json({
      enrichment,
      subcontractor,
    })

  } catch (error) {
    console.error('Error fetching latest enrichment:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch enrichment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

