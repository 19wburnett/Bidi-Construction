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
      // Create Stripe checkout session
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
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">SubBidi</h1>
          </div>
          <CardTitle className="text-3xl">Choose Your Plan</CardTitle>
          <CardDescription className="text-lg">
            Subscribe to start posting job requests and connecting with subcontractors
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

          {/* Pricing Card */}
          <div className="border rounded-lg p-6 bg-white">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Professional Plan</h3>
              <div className="text-4xl font-bold text-blue-600 mb-2">$99<span className="text-lg text-gray-600">/month</span></div>
              <p className="text-gray-600">Perfect for general contractors</p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center space-x-3">
                <Check className="h-5 w-5 text-green-600" />
                <span>Unlimited job postings</span>
              </div>
              <div className="flex items-center space-x-3">
                <Check className="h-5 w-5 text-green-600" />
                <span>Automatic subcontractor email distribution</span>
              </div>
              <div className="flex items-center space-x-3">
                <Check className="h-5 w-5 text-green-600" />
                <span>AI-powered bid analysis and organization</span>
              </div>
              <div className="flex items-center space-x-3">
                <Check className="h-5 w-5 text-green-600" />
                <span>File upload support for plans and specs</span>
              </div>
              <div className="flex items-center space-x-3">
                <Check className="h-5 w-5 text-green-600" />
                <span>Priority customer support</span>
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center mb-4">{error}</div>
            )}

            <Button 
              onClick={handleSubscribe} 
              className="w-full" 
              size="lg"
              disabled={loading}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              {loading ? 'Processing...' : 'Subscribe with Stripe'}
            </Button>
          </div>

          <div className="text-center text-sm text-gray-600">
            <p>Cancel anytime. No long-term contracts.</p>
            <p>Secure payment processing by Stripe.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
