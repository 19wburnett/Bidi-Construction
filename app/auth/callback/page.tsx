'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the URL hash
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          router.push('/auth/login?error=callback_error')
          return
        }

        if (data.session?.user) {
          // Check if user has an active subscription
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('subscription_status, stripe_customer_id')
            .eq('id', data.session.user.id)
            .single()

          if (userError) {
            console.error('Error fetching user data:', userError)
            // Fallback: use old logic if column doesn't exist
            if (userError.code === 'PGRST116' || userError.message?.includes('subscription_status')) {
              if (userData?.stripe_customer_id) {
                router.push('/dashboard')
              } else {
                router.push('/subscription')
              }
            } else {
              router.push('/subscription')
            }
            return
          }

          // Check subscription status with fallback
          let hasActiveSubscription = false
          if (userData?.subscription_status === 'active') {
            hasActiveSubscription = true
          } else if (userError?.code === 'PGRST116' || userError?.message?.includes('subscription_status')) {
            // Fallback: use old logic if column doesn't exist
            hasActiveSubscription = !!userData?.stripe_customer_id
          }

          if (hasActiveSubscription) {
            router.push('/dashboard')
          } else {
            router.push('/subscription')
          }
        } else {
          router.push('/auth/login')
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        router.push('/auth/login?error=callback_error')
      }
    }

    handleAuthCallback()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Completing sign in...</p>
      </div>
    </div>
  )
}
