'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Check, CreditCard } from 'lucide-react'
import logo from '../../public/brand/Bidi Contracting Logo.svg'

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCanceledMessage, setShowCanceledMessage] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [subscriptionType, setSubscriptionType] = useState<'gc' | 'sub'>('gc')
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Check URL params for subscription type
    const urlParams = new URLSearchParams(window.location.search)
    const typeParam = urlParams.get('type')
    if (typeParam === 'sub') {
      setSubscriptionType('sub')
    }

    // Fetch user role
    const fetchUserRole = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (!error && data) {
        setUserRole(data.role)
        // If user is already a subcontractor, default to sub subscription
        if (data.role === 'sub') {
          setSubscriptionType('sub')
        }
      }
    }
    
    fetchUserRole()

    // Check for canceled parameter from Stripe
    if (urlParams.get('canceled') === 'true') {
      setShowCanceledMessage(true)
      // Remove canceled parameter from URL
      window.history.replaceState({}, '', '/subscription')
      
      // Hide message after 5 seconds
      setTimeout(() => {
        setShowCanceledMessage(false)
      }, 5000)
    }
  }, [user, router, supabase])

  const handleSubscribe = async () => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      // Create Stripe checkout session for subscription
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          subscriptionType: subscriptionType,
        }),
      })

      const { url, error: stripeError } = await response.json()

      if (stripeError) {
        setError(stripeError)
      } else if (url) {
        // Redirect to Stripe checkout
        window.location.href = url
      }
    } catch (err) {
      setError('Failed to create checkout session')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-black dark:to-orange-950/30 flex items-center justify-center p-4 transition-colors duration-300">
      <Card className="w-full max-w-2xl border-2 dark:border-gray-700">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="relative">
              <img src={logo.src} alt="BIDI" className="h-10 w-10 sm:h-12 sm:w-12 transition-transform duration-300" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange rounded-full animate-pulse"></div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight font-bidi">BIDI</h1>
            <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2 py-1 rounded-full border border-orange-200 dark:bg-orange/20 dark:text-orange-300 dark:border-orange/20">
              BETA
            </span>
          </div>
          <CardTitle className="text-2xl sm:text-3xl dark:text-white">Subscribe to <span className="font-bidi">BIDI</span></CardTitle>
          <CardDescription className="text-base sm:text-lg dark:text-gray-300">
            {subscriptionType === 'sub' 
              ? 'Quote Generation Service for Subcontractors'
              : 'AI-Powered Estimating & Takeoff for General Contractors'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Canceled Message */}
          {showCanceledMessage && (
            <div className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg">
              <div className="flex items-center">
                <span className="font-semibold">Payment Canceled</span>
              </div>
              <p className="mt-1">You can try subscribing again anytime.</p>
            </div>
          )}

          {/* Plan Selection */}
          <div className="flex justify-center">
            {subscriptionType === 'sub' ? (
              /* Subcontractor Subscription Option */
              <div className="border-2 border-orange rounded-lg p-6 w-full max-w-lg bg-orange-50 dark:bg-orange-950/30 shadow-lg">
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-2">
                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
                      Quote Service
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Monthly Subscription</h3>
                  <div className="text-3xl font-bold text-orange mb-2">$200<span className="text-base text-gray-600 dark:text-gray-400">/month</span></div>
                  <p className="text-gray-600 dark:text-gray-300">Professional quote generation service</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Upload plans for quote generation</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Describe work and add known pricing</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Receive PDF quotes ready to send</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">1 business day turnaround</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Easy-to-use interface</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="w-4 h-4 mx-auto rounded-full border-2 border-orange bg-orange"></div>
                </div>
              </div>
            ) : (
              /* General Contractor Subscription Option */
              <div className="border-2 border-orange rounded-lg p-6 w-full max-w-lg bg-orange-50 dark:bg-orange-950/30 shadow-lg">
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-2">
                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Monthly Subscription</h3>
                  <div className="text-3xl font-bold text-orange mb-2">$300<span className="text-base text-gray-600 dark:text-gray-400">/month</span></div>
                  <p className="text-gray-600 dark:text-gray-300">Complete AI-powered estimating solution</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Automated plan analysis & takeoff</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">AI-powered cost estimating</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Automatic subcontractor outreach</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Complete bid collection & leveling</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Priority support & training</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="w-4 h-4 mx-auto rounded-full border-2 border-orange bg-orange"></div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="text-center">
            {error && (
              <div className="text-red-600 text-sm mb-4">{error}</div>
            )}

            <Button 
              onClick={handleSubscribe} 
              className="w-full md:w-auto px-8" 
              size="lg"
              disabled={loading}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              {loading ? 'Processing...' : 'Subscribe with Stripe'}
            </Button>
          </div>

          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Cancel anytime. Secure payment processing by Stripe.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
