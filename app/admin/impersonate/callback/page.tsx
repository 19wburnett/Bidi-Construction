'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

export default function ImpersonateCallback() {
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Use getSession() which automatically extracts tokens from URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setError(`Authentication error: ${sessionError.message}`)
          setTimeout(() => {
            router.push('/auth/login?error=impersonate_failed')
            router.refresh()
          }, 3000)
          return
        }
        
        if (!session?.user) {
          console.error('No session found after callback')
          setError('No session found. The impersonation link may have expired.')
          setTimeout(() => {
            router.push('/auth/login?error=impersonate_failed')
            router.refresh()
          }, 3000)
          return
        }
        
        console.log('Impersonation session found, user:', session.user.email)
        
        // Clear hash from URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        
        // Wait a moment for session to be established
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Redirect to dashboard
        router.push('/dashboard')
        router.refresh()
      } catch (err: any) {
        console.error('Callback error:', err)
        setError(err.message || 'Impersonation failed')
        setTimeout(() => {
          router.push('/auth/login?error=callback_error')
          router.refresh()
        }, 3000)
      }
    }

    handleCallback()
  }, [router, supabase])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Impersonation Failed</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <FallingBlocksLoader text="Completing impersonation..." size="lg" />
        <p className="text-sm text-gray-600 mt-2">Please wait while we set up the session</p>
      </div>
    </div>
  )
}

