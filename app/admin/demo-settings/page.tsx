'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Building2, 
  Users, 
  Zap, 
  Search, 
  UserPlus, 
  FileText,
  DollarSign,
  ArrowRight,
  Layers,
  Mail,
  Grid3X3
} from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import UserMasqueradeSelector from '@/components/admin/user-masquerade-selector'

export default function AdminDashboardPage() {
  const [demoMode, setDemoMode] = useState(false)
  const [loading, setLoading] = useState(true)
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
              <p className="text-muted-foreground">You need admin privileges to access this page.</p>
              <Link href="/dashboard">
                <Button>Return to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const adminFeatures = [
    {
      title: 'Analyze Plans',
      description: 'Review and complete takeoff and quality analyses for uploaded plans',
      icon: FileText,
      href: '/admin/analyze-plans',
      color: 'blue'
    },
    {
      title: 'Manage Bids',
      description: 'Add and manage line items for bids from subcontractors',
      icon: DollarSign,
      href: '/admin/manage-bids',
      color: 'green'
    },
    {
      title: 'Manage Subcontractors',
      description: 'View, add, and manage subcontractors in your network',
      icon: Users,
      href: '/admin/manage-subcontractors',
      color: 'purple'
    },
    {
      title: 'Crawler',
      description: 'Run web crawler jobs to find and contact new subcontractors',
      icon: Search,
      href: '/admin/crawler',
      color: 'orange'
    },
    {
      title: 'Team Invitations',
      description: 'Manage team invitations and onboard new members',
      icon: Mail,
      href: '/admin/invitations',
      color: 'indigo'
    },
    {
      title: 'Test Multi Takeoff',
      description: 'Test multi-page takeoff analysis across plan sheets',
      icon: Grid3X3,
      href: '/admin/test-multi-takeoff',
      color: 'teal'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-orange-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">Manage your platform and settings</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UserMasqueradeSelector />
              <NotificationBell />
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {/* Admin Features Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminFeatures.map((feature) => {
              const Icon = feature.icon
              return (
                <Link key={feature.href} href={feature.href}>
                  <Card className="h-full hover:shadow-lg transition-all cursor-pointer border-2 hover:border-orange-300">
                    <CardHeader>
                      <div className={`h-12 w-12 rounded-lg bg-${feature.color}-100 flex items-center justify-center mb-3`}>
                        <Icon className={`h-6 w-6 text-${feature.color}-600`} />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                      <CardDescription className="text-sm">{feature.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-orange-600 font-medium text-sm">
                        Open tool
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan Text Ingestion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Layers className="h-5 w-5 text-emerald-600" />
                <span>Plan Text Ingestion</span>
              </CardTitle>
              <CardDescription>
                Run the blueprint text extraction pipeline so Plan Chat can reference sheet notes and
                legends.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-gray-600">
                <p>
                  Provide a plan ID (and optional job ID) to regenerate the text chunks and embeddings used
                  by Plan Chat. Useful after uploading new plan files or running the vector migration.
                </p>
                <ul className="space-y-1 ml-4">
                  <li>• Runs PDF text extraction and chunking</li>
                  <li>• Refreshes embeddings stored in `plan_text_chunks`</li>
                  <li>• Reports chunk counts and warnings</li>
                </ul>
                <Link href="/admin/plan_text_ingestion">
                  <Button className="w-full" variant="secondary">
                    <Layers className="h-4 w-4 mr-2" />
                    Launch Plan Text Ingestion
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

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


          {/* Subcontractor Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserPlus className="h-5 w-5 text-orange-600" />
                <span>Subcontractor Management</span>
              </CardTitle>
              <CardDescription>
                Add, edit, and manage subcontractors in your database
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Manage your subcontractor database with full CRUD operations. Add new subcontractors, 
                  edit existing ones, and maintain your network of qualified contractors.
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Add new subcontractors with contact information</li>
                  <li>• Edit existing subcontractor details</li>
                  <li>• Search and filter by trade category or location</li>
                  <li>• View statistics and manage your network</li>
                </ul>
                <Link href="/admin/manage-subcontractors">
                  <Button className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Manage Subcontractors
                  </Button>
                </Link>
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
                      className="flex-1 px-3 py-2 border border-border rounded-md text-sm"
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
