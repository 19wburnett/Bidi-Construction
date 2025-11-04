'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function MasqueradeCallback() {
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Use getSession() which automatically extracts tokens from URL hash
        // This is the same approach as the regular auth callback
        // getSession() will automatically sync localStorage to cookies via middleware
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setError(`Authentication error: ${sessionError.message}`)
          setTimeout(() => {
            router.push('/auth/login?error=masquerade_failed')
            router.refresh()
          }, 3000)
          return
        }
        
        if (!session?.user) {
          console.error('No session found after callback')
          setError('No session found. The magic link may have expired.')
          setTimeout(() => {
            router.push('/auth/login?error=masquerade_failed')
            router.refresh()
          }, 3000)
          return
        }
        
        console.log('Session found via getSession(), user:', session.user.email)
        
        // Clear hash from URL now that we've extracted the session
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        
        // Make a request to an API route to trigger middleware processing
        // This will cause the middleware to sync localStorage to cookies
        try {
          const syncResponse = await fetch('/api/admin/masquerade/sync', {
            method: 'POST',
            credentials: 'include'
          })
          
          if (syncResponse.ok) {
            const syncData = await syncResponse.json()
            console.log('Session synced to server, user:', syncData.user?.email)
          } else {
            console.warn('Session sync failed, but continuing anyway')
          }
        } catch (syncError) {
          console.warn('Session sync error:', syncError)
          // Continue anyway - the redirect might still work
        }
        
        // Wait a moment for cookies to be written
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verify the user one more time
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          console.error('Failed to verify user:', userError)
          setError('Failed to verify user after authentication')
          setTimeout(() => {
            router.push('/auth/login?error=masquerade_failed')
            router.refresh()
          }, 3000)
          return
        }
        
        console.log('User verified, redirecting to dashboard...')
        
        // Use window.location for full page reload to ensure middleware processes it
        // This ensures the synced cookies are read
        window.location.href = '/dashboard'
      } catch (error) {
        console.error('Callback error:', error)
        setError(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setTimeout(() => {
          window.location.href = '/auth/login?error=callback_error'
        }, 2000)
      }
    }

    handleCallback()
  }, [supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-6">
        {error ? (
          <>
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-red-600 mb-2">Masquerade Failed</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium mb-2">Completing masquerade...</p>
            <p className="text-sm text-gray-500">Please wait while we authenticate you</p>
          </>
        )}
      </div>
    </div>
  )
}
