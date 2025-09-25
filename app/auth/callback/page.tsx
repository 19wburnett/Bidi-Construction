'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function AuthCallbackContent() {
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from URL hash parameters
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          setError(`Authentication error: ${error.message}`)
          setTimeout(() => {
            router.push('/auth/login?error=callback_error')
          }, 3000)
          return
        }

        if (data.session?.user) {
          // Wait for user record to be created by database trigger
          let attempts = 0
          let userData = null
          
          while (attempts < 5) {
            const { data: userResult, error: userError } = await supabase
              .from('users')
              .select('subscription_status, stripe_customer_id')
              .eq('id', data.session.user.id)
              .single()

            if (!userError) {
              userData = userResult
              break
            }
            
            // If user doesn't exist yet, wait and retry
            if (userError.code === 'PGRST116') {
              attempts++
              await new Promise(resolve => setTimeout(resolve, 1000))
              continue
            }
            
            // Other error, handle fallback
            if (userError.code === 'PGRST116' || userError.message?.includes('subscription_status')) {
              // Fallback: use old logic if column doesn't exist
              const { data: fallbackData } = await supabase
                .from('users')
                .select('stripe_customer_id')
                .eq('id', data.session.user.id)
                .single()
              
              if (fallbackData?.stripe_customer_id) {
                router.push('/dashboard')
              } else {
                router.push('/subscription')
              }
              return
            }
            
            // Other database error
            setError('Failed to load user data')
            setTimeout(() => {
              router.push('/auth/login?error=user_data_error')
            }, 3000)
            return
          }
          
          if (!userData) {
            setError('User account setup failed')
            setTimeout(() => {
              router.push('/auth/login?error=user_setup_failed')
            }, 3000)
            return
          }

          // Check subscription status
          let hasActiveSubscription = false
          if (userData?.subscription_status === 'active') {
            hasActiveSubscription = true
          } else if (userData?.stripe_customer_id) {
            // Fallback: use old logic if subscription_status is not active but has stripe_customer_id
            hasActiveSubscription = true
          }

          if (hasActiveSubscription) {
            router.push('/dashboard')
          } else {
            router.push('/subscription')
          }
        } else {
          // No session found, redirect to login
          router.push('/auth/login')
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed')
        setTimeout(() => {
          router.push('/auth/login?error=callback_error')
        }, 3000)
      }
    }

    handleAuthCallback()
  }, [router, supabase])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Sign In Failed</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login page...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-lg font-medium">Completing sign in...</p>
        <p className="text-sm text-gray-600 mt-2">Please wait while we set up your account</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
