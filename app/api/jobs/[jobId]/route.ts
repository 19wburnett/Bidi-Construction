import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'

/**
 * PATCH /api/jobs/[jobId]
 * Updates an existing job (only owners can update)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }


    // First, check if the job exists and get basic info
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Check if user is the original creator
    const isCreator = job.user_id === user.id

    // Check if user has membership and is owner
    const membership = await getJobForUser(supabase, jobId, user.id, 'id')
    const isOwner = membership?.role === 'owner'

    // Only allow update if user is creator or owner
    if (!isCreator && !isOwner) {
      return NextResponse.json(
        { error: 'Only job owners can update jobs' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { name, description, location, budget_range, project_type, cover_image_path, status } = body

    // Validate required fields
    if (name !== undefined && !name?.trim()) {
      return NextResponse.json(
        { error: 'Job name cannot be empty' },
        { status: 400 }
      )
    }

    if (location !== undefined && !location?.trim()) {
      return NextResponse.json(
        { error: 'Location cannot be empty' },
        { status: 400 }
      )
    }

    // Build update payload with only provided fields
    const updatePayload: Record<string, unknown> = {}
    if (name !== undefined) updatePayload.name = name.trim()
    if (location !== undefined) updatePayload.location = location.trim()
    if (description !== undefined) updatePayload.description = description?.trim() || null
    if (budget_range !== undefined) updatePayload.budget_range = budget_range?.trim() || null
    if (project_type !== undefined) updatePayload.project_type = project_type?.trim() || null
    if (cover_image_path !== undefined) updatePayload.cover_image_path = cover_image_path || null
    if (status !== undefined) updatePayload.status = status

    // Update job
    const { data, error: updateError } = await supabase
      .from('jobs')
      .update(updatePayload)
      .eq('id', jobId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating job:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to update job' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (error: any) {
    console.error('Unexpected error updating job:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

