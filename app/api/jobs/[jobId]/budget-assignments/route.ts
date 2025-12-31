import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// GET - Load budget assignments for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { jobId } = await params

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this job
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('role')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    const { data: job } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('id', jobId)
      .single()

    if (!job && !jobMember) {
      return NextResponse.json(
        { error: 'Job not found or access denied' },
        { status: 404 }
      )
    }

    if (jobMember || job?.user_id === user.id) {
      // User has access, fetch assignments
      const { data: assignments, error } = await supabase
        .from('budget_assignments')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching budget assignments:', error)
        return NextResponse.json(
          { error: 'Failed to fetch budget assignments', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ assignments: assignments || [] })
    }

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in GET /api/jobs/[jobId]/budget-assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Save budget assignments for a job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { jobId } = await params

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this job
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('role')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    const { data: job } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('id', jobId)
      .single()

    if (!job && !jobMember) {
      return NextResponse.json(
        { error: 'Job not found or access denied' },
        { status: 404 }
      )
    }

    if (!jobMember && job?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { assignments } = body // Array of { trade_category, bid_id, is_confirmed }

    if (!Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected assignments array.' },
        { status: 400 }
      )
    }

    // Delete all existing assignments for this job
    const { error: deleteError } = await supabase
      .from('budget_assignments')
      .delete()
      .eq('job_id', jobId)

    if (deleteError) {
      console.error('Error deleting existing assignments:', deleteError)
      return NextResponse.json(
        { error: 'Failed to clear existing assignments', details: deleteError.message },
        { status: 500 }
      )
    }

    // Insert new assignments
    if (assignments.length > 0) {
      const assignmentsToInsert = assignments.map((assignment: any) => ({
        job_id: jobId,
        trade_category: assignment.trade_category,
        bid_id: assignment.bid_id,
        is_confirmed: assignment.is_confirmed || false,
        created_by: user.id
      }))

      const { data: insertedAssignments, error: insertError } = await supabase
        .from('budget_assignments')
        .insert(assignmentsToInsert)
        .select()

      if (insertError) {
        console.error('Error inserting assignments:', insertError)
        return NextResponse.json(
          { error: 'Failed to save assignments', details: insertError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        assignments: insertedAssignments,
        message: 'Budget assignments saved successfully'
      })
    }

    return NextResponse.json({ 
      assignments: [],
      message: 'Budget assignments cleared'
    })
  } catch (error) {
    console.error('Error in POST /api/jobs/[jobId]/budget-assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

