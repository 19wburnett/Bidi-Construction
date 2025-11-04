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
        // Extract tokens from URL hash manually
        const hash = window.location.hash
        const hashParams = hash ? new URLSearchParams(hash.substring(1)) : null
        const accessToken = hashParams?.get('access_token')
        const refreshToken = hashParams?.get('refresh_token')
        const type = hashParams?.get('type')
        
        if (!accessToken || type !== 'magiclink') {
          console.error('No valid tokens in URL')
          setError('No valid authentication tokens found. The magic link may have expired.')
          setTimeout(() => {
            router.push('/auth/login?error=masquerade_failed')
            router.refresh()
          }, 3000)
          return
        }
        
        console.log('Found tokens in URL, setting session...')
        
        // Explicitly set the session - this will store in localStorage
        // The middleware will sync it to cookies on the next request
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        })
        
        if (setSessionError || !data.session) {
          console.error('Failed to set session:', setSessionError)
          setError(`Failed to establish session: ${setSessionError?.message || 'Unknown error'}`)
          setTimeout(() => {
            router.push('/auth/login?error=masquerade_failed')
            router.refresh()
          }, 3000)
          return
        }
        
        console.log('Session set successfully, user:', data.session.user.email)
        
        // Clear hash from URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        
        // Wait for session to be established
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verify the session
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
        
        console.log('User verified, syncing session to server...')
        
        // Make a request to sync the session to server-side cookies
        // This ensures the middleware can read the session
        try {
          const syncResponse = await fetch('/api/admin/masquerade/sync', {
            method: 'POST',
            credentials: 'include'
          })
          
          if (!syncResponse.ok) {
            console.warn('Session sync failed, but continuing anyway')
          } else {
            console.log('Session synced successfully')
          }
        } catch (syncError) {
          console.warn('Session sync error:', syncError)
        }
        
        // Wait a bit for cookies to be written
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Use window.location instead of router to force a full page reload
        // This ensures middleware processes the request and syncs cookies
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
