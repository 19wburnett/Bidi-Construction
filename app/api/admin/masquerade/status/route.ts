import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    
    const masqueradeAdminId = cookieStore.get('masquerade_admin_id')?.value
    const masqueradeUserId = cookieStore.get('masquerade_user_id')?.value

    if (!masqueradeAdminId || !masqueradeUserId) {
      return NextResponse.json({
        isMasquerading: false,
        originalAdminId: null,
        targetUserId: null,
        targetUserEmail: null
      })
    }

    // Fetch target user email for display
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    let targetUserEmail: string | null = null

    if (serviceRoleKey) {
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        )

        const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(masqueradeUserId)
        
        if (!targetUserError && targetUser.user) {
          targetUserEmail = targetUser.user.email || null
        }
      } catch (error) {
        console.error('Error fetching target user:', error)
      }
    }

    return NextResponse.json({
      isMasquerading: true,
      originalAdminId: masqueradeAdminId,
      targetUserId: masqueradeUserId,
      targetUserEmail
    })
  } catch (error) {
    console.error('Error getting masquerade status:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

