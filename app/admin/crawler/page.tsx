'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, Search, Users, Mail, Activity, ArrowLeft, Play, Pause, Square, FileText } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import logo from '../../../public/brand/Bidi Contracting Logo.svg'

const TRADE_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Roofing',
  'Flooring',
  'Painting',
  'Drywall',
  'Carpentry',
  'Concrete',
  'Landscaping',
  'Excavation',
  'Insulation',
  'Windows & Doors',
  'Siding',
  'Other'
]

interface CrawlerJob {
  id: string
  trade_category: string
  location: string
  max_results: number
  search_radius: number
  status: 'running' | 'completed' | 'failed' | 'paused'
  results_found: number
  emails_sent: number
  started_at: string
  completed_at: string | null
  created_at: string
}

export default function CrawlerAdminPage() {
  const [crawlerJobs, setCrawlerJobs] = useState<CrawlerJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showNewJobForm, setShowNewJobForm] = useState(false)
  const [newJobData, setNewJobData] = useState({
    trade_category: '',
    location: '',
    max_results: 50,
    search_radius: 25
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
    fetchCrawlerJobs()
    
    const interval = setInterval(fetchCrawlerJobs, 5000)
    return () => clearInterval(interval)
  }, [user, authLoading, router])

  const checkAdminStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking admin status:', error)
        return
      }

      if (!data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (err) {
      console.error('Error checking admin status:', err)
    }
  }

  const fetchCrawlerJobs = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('crawler_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error fetching crawler jobs:', error)
        return
      }

      setCrawlerJobs(data || [])
    } catch (err) {
      console.error('Error fetching crawler jobs:', err)
    }
  }

  const startCrawlerJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/crawler/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newJobData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start crawler')
      }

      // Reset form and refresh jobs
      setNewJobData({
        trade_category: '',
        location: '',
        max_results: 50,
        search_radius: 25
      })
      setShowNewJobForm(false)
      fetchCrawlerJobs()
    } catch (err: any) {
      setError(err.message || 'Failed to start crawler')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-600 bg-blue-100'
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      case 'paused':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4" />
      case 'completed':
        return <Square className="h-4 w-4" />
      case 'failed':
        return <Square className="h-4 w-4" />
      case 'paused':
        return <Pause className="h-4 w-4" />
      default:
        return <Square className="h-4 w-4" />
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
              <p className="text-muted-foreground mb-4">You need admin privileges to access this page.</p>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img src={logo.src} alt="Bidi" className="h-6 w-6 sm:h-8 sm:w-8 text-foreground" />    
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Bidi Crawler Admin</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/admin/analyze-plans">
              <Button variant="outline" className="hidden sm:flex">
                <FileText className="h-4 w-4 mr-2" />
                Analyze Plans
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <FileText className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/demo-settings">
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
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

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Contractor Discovery Crawler</h1>
          <p className="text-muted-foreground">
            Automatically find and contact subcontractors to expand your contractor network.
          </p>
        </div>

        {/* New Job Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-blue-600" />
              <span>Start New Crawler Job</span>
            </CardTitle>
            <CardDescription>
              Configure and start a new contractor discovery job.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showNewJobForm ? (
              <Button onClick={() => setShowNewJobForm(true)} className="w-full sm:w-auto">
                <Play className="h-4 w-4 mr-2" />
                Start New Crawler Job
              </Button>
            ) : (
              <form onSubmit={startCrawlerJob} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trade_category">Trade Category *</Label>
                    <Select
                      value={newJobData.trade_category}
                      onValueChange={(value) => setNewJobData(prev => ({ ...prev, trade_category: value }))}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trade category" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRADE_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      placeholder="e.g., San Francisco, CA or 94102"
                      value={newJobData.location}
                      onChange={(e) => setNewJobData(prev => ({ ...prev, location: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_results">Max Results</Label>
                    <Input
                      id="max_results"
                      type="number"
                      min="10"
                      max="200"
                      value={newJobData.max_results}
                      onChange={(e) => setNewJobData(prev => ({ ...prev, max_results: parseInt(e.target.value) || 50 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="search_radius">Search Radius (miles)</Label>
                    <Input
                      id="search_radius"
                      type="number"
                      min="5"
                      max="100"
                      value={newJobData.search_radius}
                      onChange={(e) => setNewJobData(prev => ({ ...prev, search_radius: parseInt(e.target.value) || 25 }))}
                    />
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Starting...' : 'Start Crawler'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowNewJobForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Crawler Jobs List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  <span>Crawler Jobs</span>
                </CardTitle>
                <CardDescription>
                  Recent crawler jobs and their status.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchCrawlerJobs}
                className="flex items-center space-x-2"
              >
                <Activity className="h-4 w-4" />
                <span>Refresh</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {crawlerJobs.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No crawler jobs yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start your first crawler job to begin discovering contractors.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {crawlerJobs.map((job) => (
                  <div key={job.id} className="border rounded-lg p-4 hover:bg-muted">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-foreground">{job.trade_category}</h3>
                          <span className="text-muted-foreground">in</span>
                          <span className="text-muted-foreground">{job.location}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(job.status)}`}>
                            {getStatusIcon(job.status)}
                            <span>{job.status}</span>
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{job.results_found} contractors found</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Mail className="h-4 w-4" />
                            <span>{job.emails_sent} emails sent</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>Max: {job.max_results}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>Radius: {job.search_radius}mi</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Started: {new Date(job.started_at).toLocaleString()}
                          {job.completed_at && (
                            <span className="ml-4">
                              Completed: {new Date(job.completed_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="mt-4 text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

