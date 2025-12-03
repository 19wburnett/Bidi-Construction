'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { PostHogProvider } from '@/components/posthog-provider'
import { ThemeProvider } from 'next-themes'

interface AuthContextType {
  user: User | null
  loading: boolean
  isMasquerading: boolean
  originalAdminId: string | null
  targetUserEmail: string | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isMasquerading: false,
  originalAdminId: null,
  targetUserEmail: null,
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
  const [isMasquerading, setIsMasquerading] = useState(false)
  const [originalAdminId, setOriginalAdminId] = useState<string | null>(null)
  const [targetUserEmail, setTargetUserEmail] = useState<string | null>(null)
  const supabase = useRef(createClient()).current
  const initialized = useRef(false)
  const userRef = useRef<User | null>(null)

  // Check masquerade status
  const checkMasqueradeStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/masquerade/status')
      const data = await response.json()
      
      if (data.isMasquerading && data.targetUserId) {
        setIsMasquerading(true)
        setOriginalAdminId(data.originalAdminId)
        setTargetUserEmail(data.targetUserEmail)
        
        // Create a minimal user object for the target user
        // The actual user data will be fetched server-side for RLS
        setUser({
          id: data.targetUserId,
          email: data.targetUserEmail || '',
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
        } as User)
        return true
      } else {
        setIsMasquerading(false)
        setOriginalAdminId(null)
        setTargetUserEmail(null)
        return false
      }
    } catch (error) {
      console.error('Error checking masquerade status:', error)
      setIsMasquerading(false)
      setOriginalAdminId(null)
      setTargetUserEmail(null)
      return false
    }
  }

  // Keep ref in sync with user state
  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    if (initialized.current) return // Prevent multiple initializations
    
    let mounted = true
    initialized.current = true

    // Initial auth check
    const checkAuth = async () => {
      try {
        // First check masquerade status
        const isMasqueradingActive = await checkMasqueradeStatus()
        
        // If not masquerading, get actual user
        // checkMasqueradeStatus already sets the user if masquerading
        if (!isMasqueradingActive) {
          const { data: { user }, error } = await supabase.auth.getUser()
          
          if (mounted) {
            if (error) {
              setUser(null)
            } else {
              setUser(user)
            }
            setLoading(false)
          }
        } else {
          // Already set user in checkMasqueradeStatus
          if (mounted) {
            setLoading(false)
          }
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
          // Check masquerade status on auth changes
          const masqueradeStatus = await fetch('/api/admin/masquerade/status').then(r => r.json()).catch(() => ({ isMasquerading: false }))
          
          // Only update if not masquerading
          if (!masqueradeStatus.isMasquerading) {
            // Only update on actual auth state changes, not on token refresh
            if (event === 'SIGNED_IN' && session?.user) {
              setUser(session.user)
            } else if (event === 'SIGNED_OUT') {
              setUser(null)
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
              // Silently refresh token without triggering re-render if user is same
              // Use ref to get current user value instead of stale closure value
              if (userRef.current?.id !== session.user.id) {
                setUser(session.user)
              }
            }
          } else {
            // Refresh masquerade status
            await checkMasqueradeStatus()
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
  }, [supabase])

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({ 
    user, 
    loading, 
    isMasquerading, 
    originalAdminId, 
    targetUserEmail 
  }), [user, loading, isMasquerading, originalAdminId, targetUserEmail])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthContext.Provider value={contextValue}>
        <PostHogProviderWrapper>
          {children}
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
