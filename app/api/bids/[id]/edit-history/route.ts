import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * GET /api/bids/[id]/edit-history
 * Retrieve full edit history for a bid
 */
export async function GET(
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

    // Verify user has access to this bid's job
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select(`
        id,
        job_id,
        bid_package_id,
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

    // Get job_id
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

    // Verify user has access
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

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch edit history with user information
    const { data: history, error: historyError } = await supabase
      .from('bid_edit_history')
      .select(`
        *,
        edited_by_user:users!bid_edit_history_edited_by_fkey (
          id,
          email
        )
      `)
      .eq('bid_id', bidId)
      .order('edited_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (historyError) {
      console.error('Error fetching edit history:', historyError)
      return NextResponse.json(
        { error: 'Failed to fetch edit history', details: historyError.message },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('bid_edit_history')
      .select('*', { count: 'exact', head: true })
      .eq('bid_id', bidId)

    return NextResponse.json({
      history: history || [],
      total: count || 0,
      limit,
      offset
    })

  } catch (error: any) {
    console.error('Error fetching edit history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch edit history', details: error.message },
      { status: 500 }
    )
  }
}
