import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !adminUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', adminUser.id)
      .single()

    if (adminError || !adminData?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { targetUserId } = body

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'targetUserId is required' },
        { status: 400 }
      )
    }

    // Use service role key to bypass RLS and verify target user exists
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

    // Verify target user exists using admin client (bypasses RLS)
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: 'Target user not found', details: targetError?.message },
        { status: 404 }
      )
    }

    // Get target user's auth record
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    
    if (authUserError || !authUser.user) {
      return NextResponse.json(
        { error: 'Failed to get target user auth record' },
        { status: 500 }
      )
    }

    // Create a session directly for the target user (works for OAuth and email users)
    // This is more reliable than magic links for OAuth-only users
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession({
      userId: targetUserId,
    })

    if (sessionError || !sessionData?.session) {
      // Fallback to magic link if createSession fails (for older Supabase versions)
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                     process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                     request.headers.get('origin') || 
                     'http://localhost:3000'
      
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: targetUser.email,
        options: {
          redirectTo: `${baseUrl}/admin/masquerade/callback`
        }
      })

      if (linkError || !linkData) {
        return NextResponse.json(
          { error: 'Failed to create masquerade session', details: linkError?.message || sessionError?.message },
          { status: 500 }
        )
      }

      // Store masquerade info in cookies before redirect
      const cookieStore = await cookies()
      
      // Create JSON response with redirect URL
      const response = NextResponse.json({
        success: true,
        message: 'Masquerade initiated',
        redirectUrl: linkData.properties.action_link,
        useRedirect: true
      })

      // Set masquerade cookies that will be preserved through the redirect
      response.cookies.set('masquerade_admin_id', adminUser.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600, // 1 hour
        path: '/'
      })

      response.cookies.set('masquerade_admin_email', adminUser.email || '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600,
        path: '/'
      })

      return response
    }

    // Successfully created session - set cookies directly
    const cookieStore = await cookies()
    const response = NextResponse.json({
      success: true,
      message: 'Masquerade session created',
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
      useRedirect: false
    })

    // Set masquerade cookies
    response.cookies.set('masquerade_admin_id', adminUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/'
    })

    response.cookies.set('masquerade_admin_email', adminUser.email || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600,
      path: '/'
    })

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
      maxAge: sessionData.session.expires_in || 60 * 60 * 24 * 7, // 7 days default
    })

    return response
  } catch (error) {
    console.error('Masquerade error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check if currently masquerading
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const adminId = cookieStore.get('masquerade_admin_id')?.value
    const adminEmail = cookieStore.get('masquerade_admin_email')?.value

    if (!adminId) {
      return NextResponse.json({ masquerading: false })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    return NextResponse.json({
      masquerading: true,
      adminId,
      adminEmail,
      currentUserId: currentUser?.id,
      currentUserEmail: currentUser?.email
    })
  } catch (error) {
    return NextResponse.json({ masquerading: false })
  }
}
