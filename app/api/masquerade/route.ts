import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { targetUserId } = await request.json()

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Target user ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()
    
    // Get the current admin user
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !adminUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify admin is actually an admin
    const { data: adminData, error: adminError } = await supabase
      .from('users')
      .select('is_admin, role, email')
      .eq('id', adminUser.id)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const isAdmin = adminData.role === 'admin' || adminData.is_admin === true

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get target user info
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      )
    }

    // Use Supabase admin API to impersonate the user
    // We'll need to use the service role key for this
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    // Import the admin client
    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    // Generate a session for the target user
    // We'll use the admin API to create an impersonation session
    const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.email,
    })

    if (sessionError) {
      console.error('Error generating session:', sessionError)
      // Alternative: Use signInAsUser (Supabase Admin API)
      // For now, we'll store masquerade info in session metadata
    }

    // Store masquerade info in app_metadata for tracking
    // We'll use this to know when an admin is masquerading
    const { error: metadataError } = await adminSupabase.auth.admin.updateUserById(
      adminUser.id,
      {
        app_metadata: {
          ...adminUser.app_metadata,
          masquerading_as: targetUserId,
          masquerading_as_email: targetUser.email,
          original_user_id: adminUser.id,
          original_email: adminData.email,
        }
      }
    )

    if (metadataError) {
      console.error('Error setting masquerade metadata:', metadataError)
    }

    // Now we need to actually switch the session to the target user
    // Get the target user's auth record
    const { data: targetAuthUser, error: targetAuthError } = await adminSupabase.auth.admin.getUserById(targetUserId)

    if (targetAuthError || !targetAuthUser) {
      return NextResponse.json(
        { error: 'Target user auth record not found' },
        { status: 404 }
      )
    }

    // Create a session for the target user using admin API
    // We'll create a new session token and set it in cookies
    const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.createSession({
      userId: targetUserId,
    })

    if (sessionError || !sessionData) {
      console.error('Error creating session for target user:', sessionError)
      // Fall back to metadata-only approach
      return NextResponse.json({
        success: true,
        masqueradingAs: {
          id: targetUser.id,
          email: targetUser.email,
        },
        adminUser: {
          id: adminUser.id,
          email: adminData.email,
        },
        warning: 'Session switch failed, using metadata-only masquerade'
      })
    }

    // Use Supabase SSR to properly set the session cookies
    // We need to create a response and use the Supabase client's cookie handling
    const response = NextResponse.json({
      success: true,
      masqueradingAs: {
        id: targetUser.id,
        email: targetUser.email,
      },
      adminUser: {
        id: adminUser.id,
        email: adminData.email,
      },
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }
    })

    // Set the session using Supabase's cookie format
    // Supabase uses cookies with names like: sb-<project-ref>-auth-token
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]
    
    if (sessionData.session) {
      // Set session cookies in the format Supabase expects
      // The cookie name format is: sb-<project-ref>-auth-token
      const cookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
      
      // Set the session cookie with the access and refresh tokens
      // Supabase stores them as a JSON object
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
        maxAge: sessionData.session.expires_in || 60 * 60 * 24 * 7, // Use expires_in or default to 7 days
      })
    }

    return response
  } catch (error) {
    console.error('Masquerade error:', error)
    return NextResponse.json(
      { error: 'Failed to start masquerade', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the current user (which might be the masqueraded user)
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Use service role to check masquerade state and get admin user
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    // Check if current user has masquerade metadata (they're the admin)
    const { data: currentUserData, error: currentUserError } = await adminSupabase.auth.admin.getUserById(currentUser.id)
    
    let adminUserId = currentUser.id
    
    // If current user doesn't have masquerade metadata, check if they're the masqueraded user
    // and we need to find the admin user
    if (!currentUserData?.user.app_metadata?.masquerading_as) {
      // Search for admin user who is masquerading as current user
      // This is a bit tricky - we'll need to check all users or store this differently
      // For now, let's assume the current user is the admin or masqueraded user
      // and we'll restore their original session
    } else {
      // Current user is the admin, restore their original session
      adminUserId = currentUserData.user.app_metadata.original_user_id || currentUser.id
    }

    // Get admin user data to restore session
    const { data: adminUserData, error: adminUserError } = await adminSupabase.auth.admin.getUserById(adminUserId)

    if (adminUserError || !adminUserData) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      )
    }

    // Clear masquerade metadata from admin user
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
      adminUserId,
      {
        app_metadata: {
          ...adminUserData.user.app_metadata,
          masquerading_as: null,
          masquerading_as_email: null,
          original_user_id: null,
          original_email: null,
        }
      }
    )

    if (updateError) {
      console.error('Error clearing masquerade:', updateError)
    }

    // Create a new session for the admin user
    const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.createSession({
      userId: adminUserId,
    })

    const response = NextResponse.json({
      success: true,
      message: 'Masquerade ended'
    })

    // Set the admin's session cookies using Supabase's format
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]
    const cookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
    
    if (sessionData?.session) {
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
    }

    return response
  } catch (error) {
    console.error('End masquerade error:', error)
    return NextResponse.json(
      { error: 'Failed to end masquerade', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the current user (which might be the masqueraded user)
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !currentUser) {
      return NextResponse.json({
        isMasquerading: false
      })
    }

    // Check if current user is masquerading by looking at app_metadata
    // We need to use admin API to read app_metadata
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({
        isMasquerading: false
      })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    // Check if current user has masquerade metadata (they're the admin)
    const { data: currentUserData, error: currentUserError } = await adminSupabase.auth.admin.getUserById(currentUser.id)

    if (!currentUserError && currentUserData) {
      const masqueradingAs = currentUserData.user.app_metadata?.masquerading_as
      const masqueradingAsEmail = currentUserData.user.app_metadata?.masquerading_as_email
      const originalUserId = currentUserData.user.app_metadata?.original_user_id
      const originalEmail = currentUserData.user.app_metadata?.original_email

      if (masqueradingAs && originalUserId) {
        // Current user is the admin, masquerading as target user
        // Get target user info
        const { data: targetUser, error: targetError } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', masqueradingAs)
          .single()

        // Get admin user info
        const { data: adminUser, error: adminError } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', originalUserId)
          .single()

        return NextResponse.json({
          isMasquerading: true,
          masqueradingAs: {
            id: masqueradingAs,
            email: masqueradingAsEmail || targetUser?.email || 'Unknown user',
          },
          adminUser: {
            id: originalUserId,
            email: originalEmail || adminUser?.email || 'Unknown',
          }
        })
      }
    }

    // Check if current user is being masqueraded (they're the target user)
    // We need to search for an admin user who is masquerading as this user
    // This is less efficient but necessary for the case where we've switched sessions
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id')
      .eq('is_admin', true)
      .limit(100) // Limit to prevent too many queries

    if (!allUsersError && allUsers) {
      for (const adminUserRecord of allUsers) {
        const { data: adminUserData } = await adminSupabase.auth.admin.getUserById(adminUserRecord.id)
        if (adminUserData?.user.app_metadata?.masquerading_as === currentUser.id) {
          const masqueradingAsEmail = adminUserData.user.app_metadata?.masquerading_as_email
          const originalEmail = adminUserData.user.app_metadata?.original_email

          return NextResponse.json({
            isMasquerading: true,
            masqueradingAs: {
              id: currentUser.id,
              email: masqueradingAsEmail || currentUser.email || 'Unknown user',
            },
            adminUser: {
              id: adminUserRecord.id,
              email: originalEmail || adminUserData.user.email || 'Unknown',
            }
          })
        }
      }
    }

    return NextResponse.json({
      isMasquerading: false
    })
  } catch (error) {
    console.error('Get masquerade status error:', error)
    return NextResponse.json({
      isMasquerading: false
    })
  }
}
