import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
 * Helper function to get authenticated user with automatic session refresh
 * Use this in API routes to ensure you have a valid user session
 */
export const getAuthenticatedUser = async () => {
  try {
    const supabase = await createServerSupabaseClient()
    
    // First try to get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('Error getting user:', userError)
      return { user: null, error: userError }
    }
    
    if (!user) {
      return { user: null, error: new Error('No authenticated user found') }
    }
    
    // Check if we need to refresh the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Error getting session:', sessionError)
      return { user: null, error: sessionError }
    }
    
    if (session) {
      const expiresAt = new Date(session.expires_at! * 1000)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()
      
      // If session expires within 5 minutes, try to refresh it
      if (timeUntilExpiry < 5 * 60 * 1000) {
        console.log('Session expires soon, attempting refresh...')
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          console.error('Session refresh failed:', refreshError)
          return { user: null, error: refreshError }
        }
        
        return { user: refreshData.user, error: null }
      }
    }
    
    return { user, error: null }
  } catch (error) {
    console.error('Error in getAuthenticatedUser:', error)
    return { user: null, error }
  }
}
