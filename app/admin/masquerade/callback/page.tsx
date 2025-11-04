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
        // Wait for the hash to be available in the URL
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Check if there's a hash with tokens
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
          // Parse the hash to extract tokens
          const hashParams = new URLSearchParams(hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          const type = hashParams.get('type')
          
          if (accessToken && type === 'magiclink') {
            // Set the session using the tokens from the hash
            const { data, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            })
            
            if (sessionError) {
              console.error('Session error:', sessionError)
              setError('Failed to establish session')
              setTimeout(() => {
                window.location.href = '/auth/login?error=masquerade_failed'
              }, 2000)
              return
            }
            
            if (!data.session) {
              console.error('No session after setting tokens')
              setError('Failed to create session')
              setTimeout(() => {
                window.location.href = '/auth/login?error=masquerade_failed'
              }, 2000)
              return
            }
            
            // Wait a bit to ensure session cookies are written
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Verify the session is set
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
              console.error('User verification failed:', userError)
              setError('Failed to verify user')
              setTimeout(() => {
                window.location.href = '/auth/login?error=masquerade_failed'
              }, 2000)
              return
            }
            
            // Use full page reload to ensure cookies are persisted and middleware sees them
            window.location.href = '/dashboard'
          } else {
            // Try the standard getSession approach
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()
            
            if (sessionError || !session) {
              console.error('Session error:', sessionError)
              setError('Failed to establish session')
              setTimeout(() => {
                window.location.href = '/auth/login?error=masquerade_failed'
              }, 2000)
              return
            }
            
            // Use full page reload to ensure cookies are persisted
            window.location.href = '/dashboard'
          }
        } else {
          // No hash tokens found, try getSession anyway
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError || !session) {
            console.error('No tokens found and no session:', sessionError)
            setError('No authentication tokens found')
            setTimeout(() => {
              window.location.href = '/auth/login?error=masquerade_failed'
            }, 2000)
            return
          }
          
          // Use full page reload to ensure cookies are persisted
          window.location.href = '/dashboard'
        }
      } catch (error) {
        console.error('Callback error:', error)
        setError('An error occurred during masquerade')
        setTimeout(() => {
          window.location.href = '/auth/login?error=callback_error'
        }, 2000)
      }
    }

    handleCallback()
  }, [supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-red-600 mb-2">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
            <p className="text-gray-500">Completing masquerade...</p>
          </>
        )}
      </div>
    </div>
  )
}
