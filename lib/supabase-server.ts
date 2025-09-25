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
 * Simple helper function to get authenticated user
 * Use this in API routes to check if user is authenticated
 */
export const getAuthenticatedUser = async () => {
  try {
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
