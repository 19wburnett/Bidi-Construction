import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * PATCH /api/bids/[id]
 * Update bid fields (amount, timeline, notes) with audit trail
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!bidId) {
      return NextResponse.json(
        { error: 'Bid ID required' },
        { status: 400 }
      )
    }

    // Fetch the bid to verify ownership
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select(`
        id,
        job_id,
        bid_package_id,
        bid_amount,
        timeline,
        notes,
        jobs!inner(user_id)
      `)
      .eq('id', bidId)
      .single()

    if (bidError || !bid) {
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      )
    }

    // Get job_id from bid or bid_package
    let jobId = bid.job_id
    if (!jobId && bid.bid_package_id) {
      const { data: bidPackage } = await supabase
        .from('bid_packages')
        .select('job_id')
        .eq('id', bid.bid_package_id)
        .single()
      jobId = bidPackage?.job_id
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Bid is not associated with a job' },
        { status: 400 }
      )
    }

    // Verify user has access to this job (owner or member)
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('role')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    const jobUserId = bid.jobs && (Array.isArray(bid.jobs) ? bid.jobs[0]?.user_id : (bid.jobs as any).user_id)

    if (!jobMember && jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - You do not have access to this job' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { bid_amount, timeline, notes, edit_notes } = body

    // Build update object with only provided fields
    const updateData: any = {}
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = []

    if (bid_amount !== undefined) {
      const oldAmount = bid.bid_amount
      const newAmount = bid_amount === null || bid_amount === '' ? null : parseFloat(bid_amount)
      if (oldAmount !== newAmount) {
        updateData.bid_amount = newAmount
        changes.push({
          field: 'bid_amount',
          oldValue: oldAmount,
          newValue: newAmount
        })
      }
    }

    if (timeline !== undefined) {
      const oldTimeline = bid.timeline
      const newTimeline = timeline === null || timeline === '' ? null : String(timeline).trim()
      if (oldTimeline !== newTimeline) {
        updateData.timeline = newTimeline
        changes.push({
          field: 'timeline',
          oldValue: oldTimeline,
          newValue: newTimeline
        })
      }
    }

    if (notes !== undefined) {
      const oldNotes = bid.notes
      const newNotes = notes === null || notes === '' ? null : String(notes).trim()
      if (oldNotes !== newNotes) {
        updateData.notes = newNotes
        changes.push({
          field: 'notes',
          oldValue: oldNotes,
          newValue: newNotes
        })
      }
    }

    // If no changes, return early
    if (changes.length === 0) {
      return NextResponse.json({
        message: 'No changes detected',
        bid: bid
      })
    }

    // Set edit tracking fields
    updateData.is_manually_edited = true
    updateData.edited_by = user.id
    updateData.edited_at = new Date().toISOString()

    // Update the bid
    const { data: updatedBid, error: updateError } = await supabase
      .from('bids')
      .update(updateData)
      .eq('id', bidId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating bid:', updateError)
      return NextResponse.json(
        { error: 'Failed to update bid', details: updateError.message },
        { status: 500 }
      )
    }

    // Create audit trail entries for each change
    if (changes.length > 0) {
      const historyEntries = changes.map(change => ({
        bid_id: bidId,
        edited_by: user.id,
        edited_at: new Date().toISOString(),
        field_name: change.field,
        old_value: change.oldValue,
        new_value: change.newValue,
        change_type: 'field_update' as const,
        notes: edit_notes || null
      }))

      const { error: historyError } = await supabase
        .from('bid_edit_history')
        .insert(historyEntries)

      if (historyError) {
        console.error('Error creating edit history:', historyError)
        // Don't fail the request if history creation fails, but log it
      }
    }

    return NextResponse.json({
      message: 'Bid updated successfully',
      bid: updatedBid,
      changes: changes.length
    })

  } catch (error: any) {
    console.error('Error updating bid:', error)
    return NextResponse.json(
      { error: 'Failed to update bid', details: error.message },
      { status: 500 }
    )
  }
}
