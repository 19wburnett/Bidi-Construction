import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * POST - Approve an enrichment and apply it to the subcontractor
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrichmentId: string }> }
) {
  try {
    const { enrichmentId } = await params

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

    if (enrichment.status === 'approved') {
      return NextResponse.json({ error: 'Enrichment already approved' }, { status: 400 })
    }

    if (enrichment.status !== 'complete') {
      return NextResponse.json({ error: 'Enrichment is not complete' }, { status: 400 })
    }

    const results = enrichment.results_json || {}

    // Build update payload for subcontractor
    // Only update fields that have values
    const updatePayload: Record<string, unknown> = {}

    if (results.profile_summary) {
      updatePayload.profile_summary = results.profile_summary
    }
    if (results.services && Array.isArray(results.services)) {
      updatePayload.services = results.services
    }
    if (results.phone) {
      updatePayload.phone = results.phone
    }
    if (results.website_url) {
      updatePayload.website_url = results.website_url
    }
    if (results.logo_url) {
      updatePayload.profile_picture_url = results.logo_url
    }
    if (results.google_reviews_link) {
      updatePayload.google_reviews_link = results.google_reviews_link
    }
    if (results.licensed_claimed !== null && results.licensed_claimed !== undefined) {
      updatePayload.licensed = results.licensed_claimed
    }
    if (results.bonded_claimed !== null && results.bonded_claimed !== undefined) {
      updatePayload.bonded = results.bonded_claimed
    }
    if (results.portfolio_links && Array.isArray(results.portfolio_links) && results.portfolio_links.length > 0) {
      updatePayload.portfolio_links = results.portfolio_links
    }

    // Build notes from enrichment sources
    const existingNotes = await supabaseAdmin
      .from('subcontractors')
      .select('notes')
      .eq('id', enrichment.subcontractor_id)
      .single()

    // Collect all additional info that doesn't have dedicated fields
    const hasAdditionalInfo = 
      results.yelp_link || 
      results.bbb_link || 
      results.service_area ||
      results.insured_claimed

    if (hasAdditionalInfo) {
      let notesAddition = '\n\n--- Enrichment Additional Info ---\n'
      
      if (results.service_area) {
        notesAddition += `Service Area: ${results.service_area}\n`
      }
      
      if (results.insured_claimed !== null && results.insured_claimed !== undefined) {
        notesAddition += `Claims to be insured: ${results.insured_claimed ? 'Yes' : 'No'}\n`
      }
      
      if (results.yelp_link || results.bbb_link) {
        notesAddition += `\n--- Enrichment Links ---\n`
        if (results.yelp_link) {
          notesAddition += `Yelp: ${results.yelp_link}\n`
        }
        if (results.bbb_link) {
          notesAddition += `BBB: ${results.bbb_link}\n`
        }
      }
      
      updatePayload.notes = (existingNotes?.data?.notes || '') + notesAddition
    }

    // Update enrichment status
    updatePayload.enrichment_status = 'approved'
    updatePayload.enrichment_updated_at = new Date().toISOString()

    // Apply updates to subcontractor
    const { error: updateError } = await supabaseAdmin
      .from('subcontractors')
      .update(updatePayload)
      .eq('id', enrichment.subcontractor_id)

    if (updateError) {
      console.error('Error updating subcontractor:', updateError)
      return NextResponse.json({ error: 'Failed to update subcontractor' }, { status: 500 })
    }

    // Mark enrichment as approved
    const { error: approveError } = await supabaseAdmin
      .from('subcontractor_enrichments')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: authUser.id,
      })
      .eq('id', enrichmentId)

    if (approveError) {
      console.error('Error marking enrichment as approved:', approveError)
    }

    // Fetch the updated subcontractor
    const { data: updatedSubcontractor } = await supabaseAdmin
      .from('subcontractors')
      .select('*')
      .eq('id', enrichment.subcontractor_id)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Enrichment approved and applied',
      fieldsApplied: Object.keys(updatePayload).filter(k => k !== 'enrichment_status' && k !== 'enrichment_updated_at'),
      subcontractor: updatedSubcontractor,
    })

  } catch (error) {
    console.error('Error approving enrichment:', error)
    return NextResponse.json(
      {
        error: 'Failed to approve enrichment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

