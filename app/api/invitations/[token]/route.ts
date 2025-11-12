import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

function getAdminClient() {
  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error('Supabase service role key or URL is not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function fetchInvitation(rawToken: string) {
  const token = decodeURIComponent((rawToken || '')).trim()
  console.log('[invitation] raw token:', rawToken, 'normalized:', token)

  if (!token) {
    return null
  }
  const supabaseAdmin = getAdminClient()

  const { data, error } = await supabaseAdmin
    .from('job_invitations')
    .select(
      `
        id,
        token,
        email,
        role,
        status,
        expires_at,
        accepted_at,
        created_at,
        job_invitation_jobs (
          job_id,
          jobs (
            id,
            name
          )
        )
      `
    )
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('[invitation] supabase error:', error.message)
    throw new Error(error.message)
  }

  if (!data) {
    console.warn('[invitation] no invitation row for token', token)
    return null
  }

  console.log('[invitation] found row:', {
    id: data.id,
    email: data.email,
    status: data.status,
    expires_at: data.expires_at,
  })

  const jobs =
    data.job_invitation_jobs?.map((entry: any) => ({
      id: entry.job_id,
      name: entry.jobs?.name || 'Unknown Job',
    })) || []

  return {
    ...data,
    jobs,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const invitation = await fetchInvitation(token)

    if (!invitation) {
    return NextResponse.json(
        { error: 'Invitation not found', token: decodeURIComponent((token || '')).trim() },
      { status: 404 }
    )
    }

    const now = new Date()
    if (invitation.expires_at && new Date(invitation.expires_at) < now && invitation.status === 'pending') {
      const supabaseAdmin = getAdminClient()
      await supabaseAdmin
        .from('job_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      invitation.status = 'expired'
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expires_at: invitation.expires_at,
        accepted_at: invitation.accepted_at,
        created_at: invitation.created_at,
        jobs: invitation.jobs,
      },
    })
  } catch (error) {
    console.error('[invitation] GET handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = getAdminClient()
    const { token } = await params
    const invitation = await fetchInvitation(token)

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is already ${invitation.status}` },
        { status: 400 }
      )
    }

    const now = new Date()
    if (invitation.expires_at && new Date(invitation.expires_at) < now) {
      await supabaseAdmin
        .from('job_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, password } = body as { email?: string; password?: string }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    if (email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match invitation' },
        { status: 400 }
      )
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json(
        { error: 'Failed to create user', details: createError.message },
        { status: 400 }
      )
    }

    const newUserId = createdUser?.user?.id

    if (!newUserId) {
      return NextResponse.json(
        { error: 'User creation returned no user id' },
        { status: 500 }
      )
    }

    // Update subscription status to active
    const { error: subscriptionError } = await supabaseAdmin
      .from('users')
      .update({
        subscription_status: 'active',
        payment_type: 'subscription',
      })
      .eq('id', newUserId)

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.warn('Failed to update subscription status for new user:', subscriptionError.message)
    }

    if (invitation.jobs.length > 0) {
      const rows = invitation.jobs.map((job: any) => ({
        job_id: job.id,
        user_id: newUserId,
        role: invitation.role,
      }))

      const { error: membershipError } = await supabaseAdmin
        .from('job_members')
        .upsert(rows, { onConflict: 'job_id,user_id' })

      if (membershipError) {
        console.error('Failed to assign jobs to new user:', membershipError.message)
      }
    }

    const { error: invitationUpdateError } = await supabaseAdmin
      .from('job_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    if (invitationUpdateError) {
      console.warn('Failed to update invitation status:', invitationUpdateError.message)
    }

    return NextResponse.json({
      success: true,
      userId: newUserId,
    })
  } catch (error) {
    console.error('[invitation] POST handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

