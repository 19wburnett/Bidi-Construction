'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Coins, CreditCard, X } from 'lucide-react'

export default function CreditsDisplay() {
  const [credits, setCredits] = useState<number>(0)
  const [paymentType, setPaymentType] = useState<string>('subscription')
  const [showPopup, setShowPopup] = useState(false)
  const [creditsToPurchase, setCreditsToPurchase] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      fetchUserCredits()
    }
  }, [user])

  const fetchUserCredits = async () => {
    if (!user) return
    
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('credits, payment_type')
        .eq('id', user.id)
        .single()
      
      if (userData) {
        setCredits(userData.credits || 0)
        setPaymentType(userData.payment_type || 'subscription')
      }
    } catch (error) {
      console.error('Error fetching user credits:', error)
    }
  }

  const handlePurchaseCredits = async () => {
    if (!user) return

    setLoading(true)
    setError('')

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
    } finally {
      setLoading(false)
    }
  }

  // Only show for credit users and pay-per-job users (not subscription users)
  if (paymentType !== 'credits' && paymentType !== 'pay_per_job') {
    return null
  }

  return (
    <>
      {/* Credits Display Button */}
      <button
        onClick={() => setShowPopup(true)}
        className="flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors duration-200 group"
      >
        <Coins className="h-4 w-4 text-blue-600" />
        <span className="text-blue-600 font-semibold text-sm">
          {credits}
        </span>
      </button>

      {/* Purchase Credits Popup */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">Purchase Credits</CardTitle>
                <CardDescription>
                  Buy credits to post job requests
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPopup(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  Current Credits: {credits}
                </div>
                <p className="text-sm text-gray-600">
                  Each credit allows you to post one job request
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Credits to Purchase:
                </label>
                <select
                  value={creditsToPurchase}
                  onChange={(e) => setCreditsToPurchase(parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>1 Credit - $20</option>
                  <option value={5}>5 Credits - $100</option>
                  <option value={10}>10 Credits - $200</option>
                  <option value={25}>25 Credits - $500</option>
                  <option value={50}>50 Credits - $1,000</option>
                </select>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                    Beta Pricing
                  </span>
                </div>
                <p className="text-sm text-orange-700">
                  Credits never expire and can be used anytime
                </p>
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}

              <Button 
                onClick={handlePurchaseCredits}
                className="w-full"
                disabled={loading}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {loading ? 'Processing...' : `Purchase ${creditsToPurchase} Credit${creditsToPurchase > 1 ? 's' : ''} - $${creditsToPurchase * 20}`}
              </Button>

              <div className="text-center text-xs text-gray-500">
                Secure payment processing by Stripe
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
