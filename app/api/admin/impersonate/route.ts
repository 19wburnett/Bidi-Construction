import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// POST /api/admin/impersonate - Start impersonating a user
export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const supabase = await createServerSupabaseClient()
    const { data: { user: adminUser }, error: adminError } = await supabase.auth.getUser()
    
    if (adminError || !adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: adminData, error: adminCheckError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', adminUser.id)
      .single()

    if (adminCheckError || !adminData?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get target user email
    const { email } = await request.json()
    console.log('Impersonate request - Admin:', adminUser.email, 'Target email:', email)
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim()
    
    // Prevent impersonating yourself
    if (normalizedEmail === adminUser.email?.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 })
    }

    // Get target user
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single()

    if (targetError || !targetUser) {
      console.error('Target user not found:', targetError, 'Email:', normalizedEmail)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    console.log('Found target user:', targetUser.email, 'ID:', targetUser.id)

    // Use service role to create session for target user
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
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

    // Generate magic link for target user
    // Redirect to impersonate callback to handle session setup
    console.log('Generating magic link for:', targetUser.email)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
      options: {
        redirectTo: `${request.nextUrl.origin}/admin/impersonate/callback`
      }
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Failed to generate magic link:', linkError)
      return NextResponse.json(
        { error: 'Failed to create impersonation link', details: linkError?.message },
        { status: 500 }
      )
    }
    
    console.log('Magic link generated successfully, redirecting to:', linkData.properties.action_link.substring(0, 100) + '...')

    // Store admin info in cookies
    const cookieStore = await cookies()
    const response = NextResponse.json({
      success: true,
      redirectUrl: linkData.properties.action_link
    })

    // Set masquerade cookies
    response.cookies.set('impersonate_admin_id', adminUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    })
    response.cookies.set('impersonate_admin_email', adminUser.email || '', {
      httpOnly: false, // Allow client-side access for display
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24
    })

    return response
  } catch (error) {
    console.error('Impersonate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/impersonate - Stop impersonating
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const adminId = cookieStore.get('impersonate_admin_id')?.value
    const adminEmail = cookieStore.get('impersonate_admin_email')?.value

    if (!adminId) {
      return NextResponse.json({ error: 'Not currently impersonating' }, { status: 400 })
    }

    // Use service role to restore admin session
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
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

    // Generate magic link for admin
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: adminEmail || '',
      options: {
        redirectTo: `${request.nextUrl.origin}/admin/demo-settings`
      }
    })

    if (linkError || !linkData?.properties?.action_link) {
      // Even if we can't restore, clear the cookies
      const response = NextResponse.json({
        success: true,
        message: 'Impersonation ended'
      })
      response.cookies.delete('impersonate_admin_id')
      response.cookies.delete('impersonate_admin_email')
      return response
    }

    // Clear impersonation cookies and return redirect URL
    const response = NextResponse.json({
      success: true,
      redirectUrl: linkData.properties.action_link
    })
    response.cookies.delete('impersonate_admin_id')
    response.cookies.delete('impersonate_admin_email')

    return response
  } catch (error) {
    console.error('Stop impersonate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/admin/impersonate - Check if currently impersonating
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const adminId = cookieStore.get('impersonate_admin_id')?.value
    const adminEmail = cookieStore.get('impersonate_admin_email')?.value

    if (!adminId) {
      return NextResponse.json({ impersonating: false })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    return NextResponse.json({
      impersonating: true,
      adminId,
      adminEmail,
      currentUserId: currentUser?.id,
      currentUserEmail: currentUser?.email
    })
  } catch (error) {
    return NextResponse.json({ impersonating: false })
  }
}

