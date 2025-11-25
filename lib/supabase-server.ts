import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Get the effective user ID (masqueraded user if masquerading, otherwise actual user)
 */
export const getEffectiveUserId = async (): Promise<string | null> => {
  const cookieStore = await cookies()
  const masqueradeUserId = cookieStore.get('masquerade_user_id')?.value
  
  if (masqueradeUserId) {
    return masqueradeUserId
  }
  
  // If not masquerading, get actual user
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

/**
 * Check if currently masquerading
 */
export const isMasquerading = async (): Promise<boolean> => {
  const cookieStore = await cookies()
  const masqueradeAdminId = cookieStore.get('masquerade_admin_id')?.value
  const masqueradeUserId = cookieStore.get('masquerade_user_id')?.value
  return !!(masqueradeAdminId && masqueradeUserId)
}

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.warn('Could not set auth cookies in Server Component:', error)
          }
        },
      },
    }
  )
}

/**
 * Simple helper function to get authenticated user
 * Use this in API routes to check if user is authenticated
 * Returns the masqueraded user if masquerading, otherwise the actual user
 */
export const getAuthenticatedUser = async () => {
  try {
    const cookieStore = await cookies()
    const masqueradeUserId = cookieStore.get('masquerade_user_id')?.value
    
    // If masquerading, return the masqueraded user info
    if (masqueradeUserId) {
      // Use service role to get user info
      const { createClient } = await import('@supabase/supabase-js')
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (serviceRoleKey) {
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
          // Return a user-like object
          return { 
            user: {
              id: targetUser.user.id,
              email: targetUser.user.email,
              created_at: targetUser.user.created_at,
              app_metadata: targetUser.user.app_metadata,
              user_metadata: targetUser.user.user_metadata,
              aud: targetUser.user.aud,
            } as any,
            error: null 
          }
        }
      }
    }
    
    // Otherwise, get actual authenticated user
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Error getting user:', error)
      return { user: null, error }
    }
    
    if (!user) {
      return { user: null, error: new Error('No authenticated user found') }
    }
    
    return { user, error: null }
  } catch (error) {
    console.error('Error in getAuthenticatedUser:', error)
    return { user: null, error }
  }
}
