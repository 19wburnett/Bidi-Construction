'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, Settings, ArrowLeft, Users, Zap, Search } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'

export default function AdminDemoSettingsPage() {
  const [demoMode, setDemoMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    checkAdminStatus()
  }, [user, authLoading, router])

  const checkAdminStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin, demo_mode')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking admin status:', error)
        setError('Failed to check admin status')
        return
      }

      if (!data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
      setDemoMode(data.demo_mode || false)
    } catch (err) {
      console.error('Error checking admin status:', err)
      setError('Failed to check admin status')
    }
  }

  const handleDemoModeToggle = async (enabled: boolean) => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase
        .from('users')
        .update({ demo_mode: enabled })
        .eq('id', user.id)

      if (error) {
        throw error
      }

      setDemoMode(enabled)
    } catch (err: any) {
      setError(err.message || 'Failed to update demo mode')
    } finally {
      setLoading(false)
    }
  }

  const setUserAsAdmin = async (email: string) => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.rpc('set_user_as_admin', {
        user_email: email
      })

      if (error) {
        throw error
      }

      alert(`User ${email} has been set as admin`)
    } catch (err: any) {
      setError(err.message || 'Failed to set user as admin')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return null
  }
  if (!user) {
    return null
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">You need admin privileges to access this page.</p>
              <Link href="/dashboard">
                <Button>Return to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bidi Admin</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/admin/crawler">
              <Button variant="outline" className="hidden sm:flex">
                <Search className="h-4 w-4 mr-2" />
                Crawler
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <Search className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Demo Settings</h1>
          <p className="text-gray-600">
            Configure demo mode settings for showcasing the platform to potential clients.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Demo Mode Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <span>Demo Mode</span>
              </CardTitle>
              <CardDescription>
                When enabled, job requests will automatically generate realistic demo bids instead of sending emails to subcontractors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Switch
                  id="demo-mode"
                  checked={demoMode}
                  onCheckedChange={handleDemoModeToggle}
                  disabled={loading}
                />
                <Label htmlFor="demo-mode" className="text-sm font-medium">
                  {demoMode ? 'Demo mode is enabled' : 'Demo mode is disabled'}
                </Label>
              </div>
              {demoMode && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Demo mode is active!</strong> When you create new job requests, 
                    the system will automatically generate 2-4 realistic demo bids with 
                    staggered timing to simulate real contractor responses.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Demo Features Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-green-600" />
                <span>Demo Features</span>
              </CardTitle>
              <CardDescription>
                What happens when demo mode is enabled:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">Automatic Bid Generation</h4>
                    <p className="text-sm text-gray-600">
                      Creates 2-4 realistic demo bids with company names, contact info, pricing, and timelines
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">Staggered Timing</h4>
                    <p className="text-sm text-gray-600">
                      Bids appear over time (0-30 seconds + staggered) to simulate real contractor responses
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">Realistic Data</h4>
                    <p className="text-sm text-gray-600">
                      Bid amounts adjust based on your budget range, with realistic company names and contact details
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">Trade-Specific Content</h4>
                    <p className="text-sm text-gray-600">
                      Demo bids are tailored to the specific trade category (Electrical, Plumbing, HVAC, etc.)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Admin Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-600" />
                <span>Admin Tools</span>
              </CardTitle>
              <CardDescription>
                Manage admin accounts and demo settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="admin-email" className="text-sm font-medium">
                    Set User as Admin
                  </Label>
                  <p className="text-sm text-gray-600 mb-2">
                    Enter an email address to grant admin privileges
                  </p>
                  <div className="flex space-x-2">
                    <input
                      id="admin-email"
                      type="email"
                      placeholder="user@example.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <Button
                      onClick={() => {
                        const email = (document.getElementById('admin-email') as HTMLInputElement)?.value
                        if (email) {
                          setUserAsAdmin(email)
                        }
                      }}
                      disabled={loading}
                      size="sm"
                    >
                      Set Admin
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
