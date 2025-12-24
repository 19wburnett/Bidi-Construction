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

export async function POST(request: NextRequest) {
  try {
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const supabaseAdmin = getAdminClient()
    const body = await request.json()
    const { userId, email } = body as { userId?: string; email?: string }

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      )
    }

    // Find pending invitation for this email
    const { data: invitationsData, error: invitationsError } = await supabaseAdmin
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
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')

    if (invitationsError) {
      console.error('[accept-by-email] Error fetching invitations:', invitationsError.message)
      return NextResponse.json(
        { error: 'Failed to check invitations', details: invitationsError.message },
        { status: 500 }
      )
    }

    if (!invitationsData || invitationsData.length === 0) {
      // No pending invitations found - this is fine, user can still proceed
      return NextResponse.json({
        success: true,
        invitationAccepted: false,
        message: 'No pending invitations found',
      })
    }

    // Filter out expired invitations
    const now = new Date()
    const validInvitations = invitationsData.filter((inv) => {
      if (inv.expires_at && new Date(inv.expires_at) < now) {
        // Mark as expired
        supabaseAdmin
          .from('job_invitations')
          .update({ status: 'expired' })
          .eq('id', inv.id)
          .then(() => {
            console.log(`Marked expired invitation ${inv.id} as expired`)
          })
        return false
      }
      return true
    })

    if (validInvitations.length === 0) {
      return NextResponse.json({
        success: true,
        invitationAccepted: false,
        message: 'No valid pending invitations found',
      })
    }

    // Process the first valid invitation (or all of them if there are multiple)
    let subscriptionUpdated = false
    const acceptedInvitationIds: string[] = []

    for (const invitation of validInvitations) {
      // Update subscription status to active
      const { error: subscriptionError } = await supabaseAdmin
        .from('users')
        .update({
          subscription_status: 'active',
          payment_type: 'subscription',
        })
        .eq('id', userId)

      if (subscriptionError) {
        console.error(
          `Failed to update subscription status for user ${userId}:`,
          subscriptionError.message
        )
        // Continue processing other invitations even if this fails
        continue
      } else {
        subscriptionUpdated = true
        console.log(`Subscription status set to active for user ${userId} via invitation ${invitation.id}`)
      }

      // Assign jobs if any
      const jobs =
        invitation.job_invitation_jobs?.map((entry: any) => ({
          job_id: entry.job_id,
          user_id: userId,
          role: invitation.role,
        })) || []

      if (jobs.length > 0) {
        const { error: membershipError } = await supabaseAdmin
          .from('job_members')
          .upsert(jobs, { onConflict: 'job_id,user_id' })

        if (membershipError) {
          console.error(
            `Failed to assign jobs to user ${userId} for invitation ${invitation.id}:`,
            membershipError.message
          )
        } else {
          console.log(
            `Assigned ${jobs.length} job(s) to user ${userId} for invitation ${invitation.id}`
          )
        }
      }

      // Mark invitation as accepted
      const { error: invitationUpdateError } = await supabaseAdmin
        .from('job_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id)

      if (invitationUpdateError) {
        console.warn(
          `Failed to update invitation ${invitation.id} status:`,
          invitationUpdateError.message
        )
      } else {
        acceptedInvitationIds.push(invitation.id)
      }
    }

    return NextResponse.json({
      success: true,
      invitationAccepted: subscriptionUpdated,
      acceptedInvitationIds,
      subscriptionActivated: subscriptionUpdated,
    })
  } catch (error) {
    console.error('[accept-by-email] POST handler error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}











