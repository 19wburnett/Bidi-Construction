'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, Check, CreditCard } from 'lucide-react'

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCanceledMessage, setShowCanceledMessage] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'subscription' | 'credits'>('subscription')
  const [creditsToPurchase, setCreditsToPurchase] = useState(1)
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Check for canceled parameter from Stripe
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('canceled') === 'true') {
      setShowCanceledMessage(true)
      // Remove canceled parameter from URL
      window.history.replaceState({}, '', '/subscription')
      
      // Hide message after 5 seconds
      setTimeout(() => {
        setShowCanceledMessage(false)
      }, 5000)
    }
  }, [user, router])

  const handleSubscribe = async () => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      if (selectedPlan === 'subscription') {
        // Create Stripe checkout session for subscription
        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
          }),
        })

        const { url, error: stripeError } = await response.json()

        if (stripeError) {
          setError(stripeError)
        } else if (url) {
          // Redirect to Stripe checkout
          window.location.href = url
        }
      } else {
        // For credits, create checkout session
        try {
          const response = await fetch('/api/stripe/purchase-credits', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: user.id,
              email: user.email,
              creditsToPurchase: creditsToPurchase,
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
        }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bidi</h1>
            <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2 py-1 rounded-full border border-orange-200">
              BETA
            </span>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Choose Your Plan</CardTitle>
          <CardDescription className="text-base sm:text-lg">
            Choose how you'd like to pay for job requests and connecting with subcontractors
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credits Option */}
            <div 
              className={`border rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                selectedPlan === 'credits' 
                  ? 'border-blue-500 bg-blue-50 shadow-lg' 
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
              onClick={() => setSelectedPlan('credits')}
            >
              <div className="text-center mb-6">
                <div className="flex justify-center mb-2">
                  <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                    Beta Pricing
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Credit System</h3>
                <div className="text-3xl font-bold text-blue-600 mb-2">$20<span className="text-base text-gray-600">/credit</span></div>
                <p className="text-gray-600">Perfect for occasional users</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">1 credit = 1 job posting</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Automatic subcontractor emails</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">AI bid analysis</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">File upload support</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Credits never expire</span>
                </div>
              </div>

              {selectedPlan === 'credits' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Credits to Purchase:
                  </label>
                  <select
                    value={creditsToPurchase}
                    onChange={(e) => setCreditsToPurchase(parseInt(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={1}>1 Credit - $20</option>
                    <option value={5}>5 Credits - $100</option>
                    <option value={10}>10 Credits - $200</option>
                    <option value={25}>25 Credits - $500</option>
                    <option value={50}>50 Credits - $1,000</option>
                  </select>
                </div>
              )}

              <div className="text-center">
                <div className={`w-4 h-4 mx-auto rounded-full border-2 ${
                  selectedPlan === 'credits' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                }`}></div>
              </div>
            </div>

            {/* Monthly Subscription Option */}
            <div 
              className={`border rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                selectedPlan === 'subscription' 
                  ? 'border-blue-500 bg-blue-50 shadow-lg' 
                  : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
              onClick={() => setSelectedPlan('subscription')}
            >
              <div className="text-center mb-6">
                <div className="flex justify-center mb-2">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Monthly Subscription</h3>
                <div className="text-3xl font-bold text-blue-600 mb-2">$100<span className="text-base text-gray-600">/month</span></div>
                <p className="text-gray-600">Perfect for active contractors</p>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Unlimited job postings</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Automatic subcontractor emails</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">AI bid analysis</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">File upload support</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Priority support</span>
                </div>
              </div>

              <div className="text-center">
                <div className={`w-4 h-4 mx-auto rounded-full border-2 ${
                  selectedPlan === 'subscription' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                }`}></div>
              </div>
            </div>
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
              {loading ? 'Processing...' : 
                selectedPlan === 'subscription' ? 'Subscribe with Stripe' : `Purchase ${creditsToPurchase} Credit${creditsToPurchase > 1 ? 's' : ''}`
              }
            </Button>
          </div>

          <div className="text-center text-sm text-gray-600">
            <p>Credits: No subscription required, never expire. Monthly subscription: Cancel anytime.</p>
            <p>Secure payment processing by Stripe.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
