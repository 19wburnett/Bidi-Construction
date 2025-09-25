'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { AuthUtils } from '@/lib/auth-utils'
import type { User, Session } from '@supabase/supabase-js'
// import { HeroUIProvider } from '@heroui/system'

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const initialized = useRef(false)

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        setError(null)
        
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Error getting session:', sessionError)
          if (mounted) {
            setError('Failed to get session')
            setLoading(false)
          }
          return
        }

        if (mounted) {
          setUser(session?.user ?? null)
          setLoading(false)
          initialized.current = true
          
          // Start session refresh if user is authenticated
          if (session?.user) {
            AuthUtils.startSessionRefresh()
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        if (mounted) {
          setError('Authentication initialization failed')
          setLoading(false)
        }
      }
    }

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id)
        
        if (!mounted) return

        try {
          setError(null)
          
          if (event === 'SIGNED_OUT' || !session) {
            setUser(null)
            AuthUtils.stopSessionRefresh()
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setUser(session.user)
            AuthUtils.startSessionRefresh()
          }
          
          setLoading(false)
        } catch (err) {
          console.error('Auth state change error:', err)
          setError('Authentication state change failed')
        }
      }
    )

    // Initialize auth state
    if (!initialized.current) {
      initializeAuth()
    }

    return () => {
      mounted = false
      subscription.unsubscribe()
      AuthUtils.stopSessionRefresh()
    }
  }, [supabase.auth])

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}
