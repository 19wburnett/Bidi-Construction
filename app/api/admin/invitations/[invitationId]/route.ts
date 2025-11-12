import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

async function getAdminClients() {
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

  return { supabaseAdmin }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string }> }
) {
  try {
    const adminClients = await getAdminClients()
    if ('error' in adminClients) {
      return adminClients.error
    }
    const { supabaseAdmin } = adminClients

    const { invitationId } = await context.params

    const { error } = await supabaseAdmin
      .from('job_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to cancel invitation', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

