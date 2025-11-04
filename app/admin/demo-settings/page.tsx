'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Building2, 
  Settings, 
  Users, 
  Zap, 
  Search, 
  UserPlus, 
  FileText,
  DollarSign,
  BarChart3,
  Activity,
  ArrowRight,
  ArrowLeft,
  PlayCircle,
  User
} from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

export default function AdminDashboardPage() {
  const [demoMode, setDemoMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState({
    totalBids: 0,
    totalPlans: 0,
    totalSubcontractors: 0,
    pendingAnalyses: 0
  })
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
      color: 'blue',
      badge: stats.pendingAnalyses > 0 ? stats.pendingAnalyses : undefined
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
      title: 'Workflow Demo',
      description: 'Demonstrate the complete bid collection workflow',
      icon: PlayCircle,
      href: '/admin/workflow-demo',
      color: 'indigo'
    },
    {
      title: 'AI Plan Demo',
      description: 'Showcase AI-powered plan analysis and bid generation',
      icon: Zap,
      href: '/admin/ai-plan-demo',
      color: 'yellow'
    },
    {
      title: 'Impersonate User',
      description: 'Sign in as other users for debugging and support',
      icon: UserPlus,
      href: '/admin/impersonate',
      color: 'red'
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

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bids</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalBids.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Plans</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalPlans.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Subcontractors</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalSubcontractors.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Analyses</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingAnalyses.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                      <div className="flex items-start justify-between">
                        <div className={`h-12 w-12 rounded-lg bg-${feature.color}-100 flex items-center justify-center mb-3`}>
                          <Icon className={`h-6 w-6 text-${feature.color}-600`} />
                        </div>
                        {feature.badge && (
                          <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            {feature.badge}
                          </span>
                        )}
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
          {/* Demo Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-orange-600" />
                <span>AI Plan Analysis Demo</span>
              </CardTitle>
              <CardDescription>
                Upload construction plans, select trades, and see AI-powered bid generation in action.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This demo showcases AI-powered plan analysis:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• Upload PDF construction plans</li>
                  <li>• Select trade categories for analysis</li>
                  <li>• AI generates detailed bid estimates</li>
                  <li>• View materials, labor, and timeline breakdowns</li>
                  <li>• Identify potential issues and recommendations</li>
                </ul>
                <Link href="/admin/ai-plan-demo">
                  <Button className="w-full" variant="orange">
                    <Zap className="h-4 w-4 mr-2" />
                    Launch AI Plan Demo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-600" />
                <span>Interactive Workflow Demo</span>
              </CardTitle>
              <CardDescription>
                Experience the complete Bidi workflow from email to bid report in an interactive demo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This demo simulates the entire process of how Bidi works:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• General contractor sends email with job details</li>
                  <li>• Bidi processes and extracts job information</li>
                  <li>• System notifies qualified subcontractors</li>
                  <li>• Subcontractors respond with bids (simulated)</li>
                  <li>• Bidi analyzes and compares all bids</li>
                  <li>• Final report is generated and sent to GC</li>
                </ul>
                <Link href="/admin/workflow-demo">
                  <Button className="w-full">
                    <Users className="h-4 w-4 mr-2" />
                    Launch Interactive Demo
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
