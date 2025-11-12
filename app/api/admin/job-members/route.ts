import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

async function getAdminSupabase() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  }

  const { data: adminData, error: adminError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (adminError || !adminData?.is_admin) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { error: NextResponse.json({ error: 'Service role key not configured' }, { status: 500 }) }
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  return { supabaseAdmin }
}

export async function POST(request: NextRequest) {
  try {
    const adminClients = await getAdminSupabase()
    if ('error' in adminClients) {
      return adminClients.error
    }
    const { supabaseAdmin } = adminClients

    const body = await request.json()
    const { userId, jobIds = [], role = 'collaborator' } = body as {
      userId?: string
      jobIds?: string[]
      role?: 'owner' | 'collaborator'
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!Array.isArray(jobIds)) {
      return NextResponse.json({ error: 'jobIds must be an array' }, { status: 400 })
    }

    if (!['owner', 'collaborator'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const normalizedJobIds = jobIds.filter((id): id is string => typeof id === 'string' && id.length > 0)

    const { data: existingMemberships, error: fetchError } = await supabaseAdmin
      .from('job_members')
      .select('job_id, role')
      .eq('user_id', userId)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to load existing memberships', details: fetchError.message },
        { status: 500 }
      )
    }

    const existingJobIds = new Set((existingMemberships || []).map((row) => row.job_id))
    const ownerJobIds = new Set(
      (existingMemberships || [])
        .filter((row) => row.role === 'owner')
        .map((row) => row.job_id)
    )
    const desiredJobIds = new Set(normalizedJobIds)

    const jobsToAdd = normalizedJobIds.filter((jobId) => !existingJobIds.has(jobId))
    const jobsToRemove = Array.from(existingJobIds).filter(
      (jobId) => !desiredJobIds.has(jobId) && !ownerJobIds.has(jobId)
    )

    if (jobsToAdd.length > 0) {
      const rows = jobsToAdd.map((jobId) => ({
        job_id: jobId,
        user_id: userId,
        role,
      }))

      const { error: insertError } = await supabaseAdmin
        .from('job_members')
        .upsert(rows, { onConflict: 'job_id,user_id' })

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to add job assignments', details: insertError.message },
          { status: 500 }
        )
      }
    }

    if (jobsToRemove.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('job_members')
        .delete()
        .eq('user_id', userId)
        .in('job_id', jobsToRemove)

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to remove job assignments', details: deleteError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating job memberships:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

