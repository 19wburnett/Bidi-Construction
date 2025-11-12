import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

async function getAdminClients(request: NextRequest) {
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
    return {
      error: NextResponse.json({ error: 'Service role key not configured' }, { status: 500 }),
    }
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

  return { supabaseAdmin, adminUser: user }
}

export async function GET(request: NextRequest) {
  try {
    const adminClients = await getAdminClients(request)
    if ('error' in adminClients) {
      return adminClients.error
    }
    const { supabaseAdmin } = adminClients

    const { data: invitationsData, error: invitationsError } = await supabaseAdmin
      .from('job_invitations')
      .select(
        `
          id,
          token,
          email,
          status,
          role,
          expires_at,
          accepted_at,
          created_at,
          invited_by,
          job_invitation_jobs (
            job_id,
            jobs (
              id,
              name
            )
          )
        `
      )
      .order('created_at', { ascending: false })

    if (invitationsError) {
      return NextResponse.json(
        { error: 'Failed to fetch invitations', details: invitationsError.message },
        { status: 500 }
      )
    }

    const invitations =
      invitationsData?.map((invite: any) => ({
        id: invite.id,
        token: invite.token,
        email: invite.email,
        status: invite.status,
        role: invite.role,
        expires_at: invite.expires_at,
        accepted_at: invite.accepted_at,
        created_at: invite.created_at,
        invited_by: invite.invited_by,
        jobs:
          invite.job_invitation_jobs?.map((job: any) => ({
            id: job.job_id,
            name: job.jobs?.name || 'Unknown Job',
          })) || [],
      })) || []

    const [{ data: jobs, error: jobsError }, { data: users, error: usersError }, { data: jobMembers, error: membershipError }] =
      await Promise.all([
        supabaseAdmin
          .from('jobs')
          .select('id, name, status')
          .order('name', { ascending: true }),
        supabaseAdmin
          .from('users')
          .select('id, email, subscription_status, is_admin')
          .order('created_at', { ascending: false })
          .limit(200),
        supabaseAdmin
          .from('job_members')
          .select('job_id, user_id, role'),
      ])

    if (jobsError || usersError || membershipError) {
      return NextResponse.json(
        {
          error: 'Failed to load admin data',
          details: jobsError?.message || usersError?.message || membershipError?.message,
        },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL

    return NextResponse.json({
      success: true,
      invitations,
      jobs: jobs || [],
      users: users || [],
      jobMembers: jobMembers || [],
      invitationBaseUrl: baseUrl,
    })
  } catch (error) {
    console.error('Error fetching admin invitation data:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminClients = await getAdminClients(request)
    if ('error' in adminClients) {
      return adminClients.error
    }
    const { supabaseAdmin, adminUser } = adminClients

    const body = await request.json()
    const { email, role = 'collaborator', jobIds = [], expiresInDays = 7 } = body as {
      email?: string
      role?: 'owner' | 'collaborator'
      jobIds?: string[]
      expiresInDays?: number
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!['owner', 'collaborator'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const normalizedJobIds = Array.isArray(jobIds)
      ? jobIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []

    const token = randomUUID()
    let expiresAt: string | null = null
    if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
      const expireDate = new Date()
      expireDate.setDate(expireDate.getDate() + expiresInDays)
      expiresAt = expireDate.toISOString()
    }

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('job_invitations')
      .insert({
        token,
        email: email.toLowerCase(),
        role,
        invited_by: adminUser.id,
        expires_at: expiresAt,
      })
      .select('id, created_at')
      .single()

    if (invitationError) {
      return NextResponse.json(
        { error: 'Failed to create invitation', details: invitationError.message },
        { status: 500 }
      )
    }

    if (normalizedJobIds.length > 0) {
      const rows = normalizedJobIds.map((jobId) => ({
        invitation_id: invitation.id,
        job_id: jobId,
      }))

      const { error: jobsError } = await supabaseAdmin
        .from('job_invitation_jobs')
        .insert(rows)

      if (jobsError) {
        return NextResponse.json(
          { error: 'Failed to attach jobs to invitation', details: jobsError.message },
          { status: 500 }
        )
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    const invitationUrl = `${baseUrl}/invite/${token}`

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email,
        role,
        token,
        expires_at: expiresAt,
        created_at: invitation.created_at,
        jobs: normalizedJobIds,
        invitationUrl,
      },
    })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

