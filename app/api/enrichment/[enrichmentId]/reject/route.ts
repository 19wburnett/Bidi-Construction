import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * POST - Reject an enrichment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrichmentId: string }> }
) {
  try {
    const { enrichmentId } = await params
    const body = await request.json().catch(() => ({}))
    const { reason } = body

    if (!enrichmentId) {
      return NextResponse.json({ error: 'Enrichment ID is required' }, { status: 400 })
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

    // Fetch the enrichment
    const { data: enrichment, error: fetchError } = await supabaseAdmin
      .from('subcontractor_enrichments')
      .select('*')
      .eq('id', enrichmentId)
      .single()

    if (fetchError || !enrichment) {
      return NextResponse.json({ error: 'Enrichment not found' }, { status: 404 })
    }

    if (enrichment.status === 'rejected') {
      return NextResponse.json({ error: 'Enrichment already rejected' }, { status: 400 })
    }

    if (enrichment.status === 'approved') {
      return NextResponse.json({ error: 'Cannot reject an approved enrichment' }, { status: 400 })
    }

    // Mark enrichment as rejected
    const { error: rejectError } = await supabaseAdmin
      .from('subcontractor_enrichments')
      .update({
        status: 'rejected',
        error_message: reason || 'Rejected by admin',
      })
      .eq('id', enrichmentId)

    if (rejectError) {
      console.error('Error rejecting enrichment:', rejectError)
      return NextResponse.json({ error: 'Failed to reject enrichment' }, { status: 500 })
    }

    // Update subcontractor enrichment status
    await supabaseAdmin
      .from('subcontractors')
      .update({
        enrichment_status: 'rejected',
        enrichment_updated_at: new Date().toISOString(),
      })
      .eq('id', enrichment.subcontractor_id)

    return NextResponse.json({
      success: true,
      message: 'Enrichment rejected',
    })

  } catch (error) {
    console.error('Error rejecting enrichment:', error)
    return NextResponse.json(
      {
        error: 'Failed to reject enrichment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

