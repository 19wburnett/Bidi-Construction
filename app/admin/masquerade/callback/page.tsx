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
        // Use getSession which automatically extracts tokens from URL hash/query
        // This is the same approach as the regular auth callback
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
        
        console.log('Session found, user:', session.user.email)
        
        // Wait longer to ensure cookies are synced from localStorage to cookies
        // The middleware needs time to process the session
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Verify session is still there after waiting
        const { data: { session: verifySession } } = await supabase.auth.getSession()
        if (!verifySession) {
          console.error('Session lost after waiting!')
          setError('Session was lost. Please try again.')
          setTimeout(() => {
            router.push('/auth/login?error=session_lost')
            router.refresh()
          }, 2000)
          return
        }
        
        console.log('Session verified, redirecting...')
        
        // Use router like the regular auth callback does
        // This allows Next.js to properly handle the navigation and cookie sync
        router.push('/dashboard')
        router.refresh() // Force refresh to ensure middleware sees the new session
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
