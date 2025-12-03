import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/jobs
 * Creates a new job
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { name, description, location, budget_range, project_type, cover_image_path, status = 'needs_takeoff' } = body

    // Validate required fields
    if (!name || !location) {
      return NextResponse.json(
        { error: 'Name and location are required' },
        { status: 400 }
      )
    }

    // Create job using server-side client (ensures auth.uid() is available)
    const { data, error: insertError } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        location,
        budget_range: budget_range || null,
        project_type: project_type || null,
        cover_image_path: cover_image_path || null,
        status
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating job:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Failed to create job' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error('Unexpected error creating job:', error)
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

