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
        // Check if there are tokens in the URL hash
        const hash = window.location.hash
        const hashParams = hash ? new URLSearchParams(hash.substring(1)) : null
        const accessToken = hashParams?.get('access_token')
        const refreshToken = hashParams?.get('refresh_token')
        const type = hashParams?.get('type')
        
        // If we have tokens in the hash, set them manually first
        if (accessToken && type === 'magiclink') {
          console.log('Found tokens in hash, setting session manually')
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          })
          
          if (setSessionError) {
            console.error('Error setting session from hash:', setSessionError)
            setError(`Failed to set session: ${setSessionError.message}`)
            setTimeout(() => {
              window.location.href = '/auth/login?error=masquerade_failed'
            }, 2000)
            return
          }
          
          if (!data.session) {
            console.error('No session after setting from hash')
            setError('Session was not created from tokens')
            setTimeout(() => {
              window.location.href = '/auth/login?error=masquerade_failed'
            }, 2000)
            return
          }
          
          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        } else {
          // Try getSession which should auto-extract tokens
          console.log('No hash tokens, trying getSession')
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            console.error('Session error:', sessionError)
            setError(`Failed to establish session: ${sessionError.message}`)
            setTimeout(() => {
              window.location.href = '/auth/login?error=masquerade_failed'
            }, 2000)
            return
          }
          
          if (!session) {
            console.error('No session found after callback')
            setError('No session found. The magic link may have expired.')
            setTimeout(() => {
              window.location.href = '/auth/login?error=masquerade_failed'
            }, 2000)
            return
          }
        }
        
        // Wait a bit for session to be fully established
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Verify the user is actually authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error('User verification error:', userError)
          setError(`Failed to verify user: ${userError.message}`)
          setTimeout(() => {
            window.location.href = '/auth/login?error=masquerade_failed'
          }, 2000)
          return
        }
        
        if (!user) {
          console.error('No user found after session was set')
          setError('User not found after authentication')
          setTimeout(() => {
            window.location.href = '/auth/login?error=masquerade_failed'
          }, 2000)
          return
        }
        
        console.log('Masquerade successful, user:', user.email)
        
        // Wait a bit more to ensure all cookies are written
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Use full page reload to ensure cookies are persisted and middleware sees them
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
