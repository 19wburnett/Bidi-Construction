import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'

// GET /api/jobs/[jobId]/timeline - Get all timeline items for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createServerSupabaseClient()

    // Check if this is a shared job access (no auth required)
    const shareToken = request.nextUrl.searchParams.get('shareToken')
    
    if (shareToken) {
      // Verify share token is valid
      const { data: share } = await supabase
        .from('job_shares')
        .select('job_id')
        .eq('share_token', shareToken)
        .eq('job_id', jobId)
        .single()

      if (!share) {
        return NextResponse.json({ error: 'Invalid share token' }, { status: 403 })
      }

      // Get timeline items for shared job
      const { data: timelineItems, error } = await supabase
        .from('job_timeline_items')
        .select('*')
        .eq('job_id', jobId)
        .order('start_date', { ascending: true })
        .order('display_order', { ascending: true })

      if (error) throw error

      return NextResponse.json({ timelineItems: timelineItems || [] })
    }

    // Authenticated access
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this job
    const membership = await getJobForUser(supabase, jobId, user.id, 'id')
    if (!membership) {
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 403 })
    }

    const { data: timelineItems, error } = await supabase
      .from('job_timeline_items')
      .select('*')
      .eq('job_id', jobId)
      .order('start_date', { ascending: true })
      .order('display_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ timelineItems: timelineItems || [] })

  } catch (error: any) {
    console.error('Error fetching timeline:', error)
    return NextResponse.json(
      { error: 'Failed to fetch timeline', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/jobs/[jobId]/timeline - Create a new timeline item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this job
    const membership = await getJobForUser(supabase, jobId, user.id, 'id')
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      trade_category,
      subcontractor_name,
      start_date,
      end_date,
      description,
      status = 'scheduled',
      display_order = 0
    } = body

    if (!trade_category || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: trade_category, start_date, end_date' },
        { status: 400 }
      )
    }

    // Validate date range
    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    const { data: timelineItem, error } = await supabase
      .from('job_timeline_items')
      .insert({
        job_id: jobId,
        trade_category,
        subcontractor_name: subcontractor_name || null,
        start_date,
        end_date,
        description: description || null,
        status,
        display_order,
        created_by: user.id
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ timelineItem })

  } catch (error: any) {
    console.error('Error creating timeline item:', error)
    return NextResponse.json(
      { error: 'Failed to create timeline item', details: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/jobs/[jobId]/timeline - Update a timeline item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this job
    const membership = await getJobForUser(supabase, jobId, user.id, 'id')
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Timeline item ID is required' }, { status: 400 })
    }

    // Validate date range if dates are being updated
    if (updates.start_date && updates.end_date) {
      if (new Date(updates.end_date) < new Date(updates.start_date)) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        )
      }
    }

    const { data: timelineItem, error } = await supabase
      .from('job_timeline_items')
      .update(updates)
      .eq('id', id)
      .eq('job_id', jobId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ timelineItem })

  } catch (error: any) {
    console.error('Error updating timeline item:', error)
    return NextResponse.json(
      { error: 'Failed to update timeline item', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/jobs/[jobId]/timeline - Delete a timeline item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this job
    const membership = await getJobForUser(supabase, jobId, user.id, 'id')
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Timeline item ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('job_timeline_items')
      .delete()
      .eq('id', id)
      .eq('job_id', jobId)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error deleting timeline item:', error)
    return NextResponse.json(
      { error: 'Failed to delete timeline item', details: error.message },
      { status: 500 }
    )
  }
}


