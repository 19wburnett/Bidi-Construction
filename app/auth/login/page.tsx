'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { Building2, ArrowLeft } from 'lucide-react'
import logo from '../../../public/brand/Bidi Contracting Logo.svg'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    // Check for success message from password reset
    if (searchParams.get('password_reset') === 'success') {
      setSuccessMessage('Password reset successful! Please sign in with your new password.')
      // Clear the query parameter from URL
      router.replace('/auth/login', { scroll: false })
    }
  }, [searchParams, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        // Check if user has an active subscription
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('subscription_status, stripe_customer_id')
          .eq('id', data.user?.id)
          .single()

        if (userError) {
          console.error('Error fetching user data:', userError)
        }

        // Check subscription status with fallback
        let hasActiveSubscription = false
        if (userData?.subscription_status === 'active') {
          hasActiveSubscription = true
        } else if (userError?.code === 'PGRST116' || userError?.message?.includes('subscription_status')) {
          // Fallback: use old logic if column doesn't exist
          hasActiveSubscription = !!userData?.stripe_customer_id
        }

        if (!hasActiveSubscription) {
          // Redirect to subscription page
          router.push('/subscription')
          router.refresh()
        } else {
          // Redirect to dashboard
          router.push('/dashboard')
          router.refresh()
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300">
      {/* Professional Construction Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white dark:from-black dark:to-orange-950/20"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-orange"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange/5 dark:bg-orange/10 rounded-full blur-3xl"></div>
      </div>

      <div className="flex items-center justify-center p-4 min-h-screen">
        {/* Back Button */}
        <div className="absolute top-4 left-4">
          <Link href="/">
            <Button variant="construction" size="sm" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </Button>
          </Link>
        </div>
        
        <Card className="w-full max-w-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <img src={logo.src} alt="Bidi" className="h-6 w-6 sm:h-8 sm:w-8" />
              <h1 className="text-xl sm:text-2xl font-bold text-black dark:text-white">Bidi</h1>
            </div>
            <CardTitle className="text-lg sm:text-xl">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your General Contractor account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-end">
                  <Link href="/auth/forgot-password" className="text-sm text-orange-600 hover:text-orange-700 hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
              </div>
              {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}
              <Button type="submit" variant="orange" className="w-full font-bold" disabled={loading}>
                {loading ? (
                  <div className="flex items-center justify-center">
                    <FallingBlocksLoader text="" size="sm" />
                    <span className="ml-2">Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-950 px-2 text-gray-500 dark:text-gray-400">
                    Or continue with
                  </span>
                </div>
              </div>
              
              <Button
                onClick={handleGoogleLogin}
                variant="construction"
                className="w-full mt-4"
                disabled={loading}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Don't have an account?{' '}
                <Link href="/auth/signup" className="bidi-orange-text hover:underline font-semibold">
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <FallingBlocksLoader text="Loading..." size="lg" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}