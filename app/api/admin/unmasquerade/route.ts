import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const adminId = cookieStore.get('masquerade_admin_id')?.value
    const adminEmail = cookieStore.get('masquerade_admin_email')?.value

    if (!adminId) {
      return NextResponse.json(
        { error: 'Not currently masquerading' },
        { status: 400 }
      )
    }

    // Use service role key to restore admin session
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

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

    // Get admin user's auth record
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(adminId)
    
    if (authUserError || !authUser.user) {
      // Clear masquerade cookies even if we can't restore session
      const response = NextResponse.json({
        success: true,
        message: 'Masquerade ended (admin user not found)'
      })
      response.cookies.delete('masquerade_admin_id')
      response.cookies.delete('masquerade_admin_email')
      return response
    }

    // Get base URL from environment or request headers
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                   request.headers.get('origin') || 
                   'http://localhost:3000'
    
    // Try to create session directly first (more reliable)
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
      userId: adminId,
    })

    if (!sessionError && sessionData?.session) {
      // Successfully created session - set cookies directly
      const response = NextResponse.json({
        success: true,
        message: 'Successfully returned to admin account',
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        },
        useRedirect: false
      })

      // Clear masquerade cookies
      response.cookies.delete('masquerade_admin_id')
      response.cookies.delete('masquerade_admin_email')

      // Set the session cookie using Supabase's format
      const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]
      const cookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
      
      const sessionCookie = {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        expires_in: sessionData.session.expires_in,
        token_type: 'bearer',
        user: sessionData.session.user,
      }

      response.cookies.set(cookieName, JSON.stringify(sessionCookie), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: sessionData.session.expires_in || 60 * 60 * 24 * 7,
      })

      return response
    }

    // Fallback to magic link if createSession fails
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: adminEmail || authUser.user.email || '',
      options: {
        redirectTo: `${baseUrl}/admin/demo-settings`
      }
    })

    if (linkError || !linkData) {
      // Clear masquerade cookies even if we can't restore session
      const response = NextResponse.json({
        success: true,
        message: 'Masquerade ended (failed to restore admin session)',
        warning: 'You may need to log in again'
      })
      response.cookies.delete('masquerade_admin_id')
      response.cookies.delete('masquerade_admin_email')
      return response
    }

    // Clear masquerade cookies
    const response = NextResponse.json({
      success: true,
      message: 'Successfully returned to admin account',
      redirectUrl: linkData.properties.action_link,
      useRedirect: true,
      requiresRedirect: true
    })

    response.cookies.delete('masquerade_admin_id')
    response.cookies.delete('masquerade_admin_email')

    return response
  } catch (error) {
    console.error('Unmasquerade error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
