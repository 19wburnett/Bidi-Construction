'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { PostHogProvider } from '@/components/posthog-provider'
import { ThemeProvider } from 'next-themes'
import UnderConstructionModal from '@/components/under-construction-modal'

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
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
  const [showUnderConstruction, setShowUnderConstruction] = useState(false)
  const supabase = useRef(createClient()).current
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return // Prevent multiple initializations
    
    let mounted = true
    initialized.current = true

    // Initial auth check
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (mounted) {
          if (error) {
            setUser(null)
            setShowUnderConstruction(false)
          } else {
            setUser(user)
            if (user) {
              setShowUnderConstruction(true)
            }
          }
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    // Listen for auth state changes (important for OAuth callbacks)
    // Use shouldTriggerChange option to prevent unnecessary refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          // Only update on actual auth state changes, not on token refresh
          if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user)
            setShowUnderConstruction(true)
          } else if (event === 'SIGNED_OUT') {
            setUser(null)
            setShowUnderConstruction(false)
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            // Silently refresh token without triggering re-render if user is same
            if (user?.id !== session.user.id) {
              setUser(session.user)
            }
          }
          setLoading(false)
        }
      }
    )

    // Initial check
    checkAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase]) // Include supabase in dependencies

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ user, loading }), [user, loading])

  const handleCloseModal = () => {
    setShowUnderConstruction(false)
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthContext.Provider value={contextValue}>
        <PostHogProviderWrapper>
          {children}
          <UnderConstructionModal 
            isOpen={showUnderConstruction}
            onClose={handleCloseModal}
          />
        </PostHogProviderWrapper>
      </AuthContext.Provider>
    </ThemeProvider>
  )
}

// Wrapper to handle PostHog errors gracefully
function PostHogProviderWrapper({ children }: { children: React.ReactNode }) {
  const [shouldLoadPostHog, setShouldLoadPostHog] = useState(true)
  
  useEffect(() => {
    // Client-side check for PostHog blocking
    if (typeof window !== 'undefined') {
      const isPostHogBlocked = 
        window.location.hostname.includes('localhost') || 
        window.navigator.userAgent.includes('AdBlock') ||
        window.navigator.userAgent.includes('uBlock')
      
      if (isPostHogBlocked) {
        console.log('PostHog likely blocked by ad blocker, skipping analytics')
        setShouldLoadPostHog(false)
      }
    }
  }, [])
  
  // On server render, always try to load PostHog to prevent hydration mismatch
  // This will be corrected on client-side if blocked
  if (!shouldLoadPostHog) {
    return <>{children}</>
  }
  
  try {
    return <PostHogProvider>{children}</PostHogProvider>
  } catch (error) {
    console.warn('PostHog failed to initialize, continuing without analytics:', error)
    return <>{children}</>
  }
}
