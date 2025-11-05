'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import logo from '../../../public/brand/Bidi Contracting Logo.svg'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validatingToken, setValidatingToken] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const validateToken = async () => {
      try {
        // Supabase automatically processes hash parameters when getSession() is called
        // The hash contains access_token, type=recovery, etc.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          setError('Invalid or expired reset link. Please request a new password reset.')
          setValidatingToken(false)
          return
        }
        
        // Check if we have hash parameters (from email link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const hasHashToken = hashParams.get('access_token') && hashParams.get('type') === 'recovery'
        
        if (!session && !hasHashToken) {
          // No session and no recovery token in URL
          setError('Invalid or expired reset link. Please request a new password reset.')
          setValidatingToken(false)
          return
        }
        
        // If we have hash params but no session yet, wait for Supabase to process them
        if (hasHashToken && !session) {
          // Give Supabase a moment to process the hash and create the session
          await new Promise(resolve => setTimeout(resolve, 1000))
          const { data: { session: newSession } } = await supabase.auth.getSession()
          
          if (!newSession) {
            setError('Invalid or expired reset link. Please request a new password reset.')
            setValidatingToken(false)
            return
          }
        }
        
        // Clear hash from URL for security
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
        
        setValidatingToken(false)
      } catch (err) {
        console.error('Validation error:', err)
        setError('An error occurred validating the reset link.')
        setValidatingToken(false)
      }
    }

    validateToken()
  }, [supabase])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push('/auth/login?password_reset=success')
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (validatingToken) {
    return (
      <div className="min-h-screen bg-white dark:bg-black relative transition-colors duration-300 flex items-center justify-center">
        <div className="text-center">
          <FallingBlocksLoader text="Validating reset link..." size="lg" />
        </div>
      </div>
    )
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
          <Link href="/auth/login">
            <Button variant="construction" size="sm" className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Sign In</span>
            </Button>
          </Link>
        </div>
        
        <Card className="w-full max-w-md border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <img src={logo.src} alt="Bidi" className="h-6 w-6 sm:h-8 sm:w-8" />
              <h1 className="text-xl sm:text-2xl font-bold text-black dark:text-white">Bidi</h1>
            </div>
            <CardTitle className="text-lg sm:text-xl">Set New Password</CardTitle>
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                      Password updated successfully!
                    </p>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                    Redirecting to sign in...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                {error && (
                  <div className="text-red-600 text-sm text-center">{error}</div>
                )}
                <Button type="submit" variant="orange" className="w-full font-bold" disabled={loading}>
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <FallingBlocksLoader text="" size="sm" />
                      <span className="ml-2">Updating...</span>
                    </div>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

