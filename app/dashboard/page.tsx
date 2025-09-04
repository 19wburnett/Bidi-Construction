'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import { Button as HeroUIButton } from '@heroui/button'
// import { Card as HeroUICard, CardBody, CardHeader as HeroUICardHeader } from '@heroui/card'
// import { Badge } from '@heroui/badge'
// import { Chip } from '@heroui/chip'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, Plus, FileText, Users, Mail, CheckCircle, X, History, MapPin, DollarSign, MessageSquare, Calendar } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import DebugNotifications from '@/components/debug-notifications'

interface JobRequest {
  id: string
  trade_category: string
  location: string
  description: string
  budget_range: string
  created_at: string
  bids_count?: number
  status?: string
}

export default function DashboardPage() {
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([])
  const [pastJobRequests, setPastJobRequests] = useState<JobRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive')
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current')
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Check for success parameter from Stripe
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      setShowSuccessMessage(true)
      // Show success message and refresh subscription status
      setTimeout(() => {
        fetchUserSubscription()
        // Remove success parameter from URL
        window.history.replaceState({}, '', '/dashboard')
      }, 1000)
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false)
      }, 5000)
    }

    fetchUserSubscription()
    fetchJobRequests()
    fetchPastJobRequests()
  }, [user, router])

  const fetchUserSubscription = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('subscription_status, stripe_customer_id')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching subscription status:', error)
        // Fallback: check if user has stripe_customer_id (old logic)
        if (error.code === 'PGRST116' || error.message.includes('subscription_status')) {
          // Column doesn't exist yet, use old logic
          const { data: fallbackData } = await supabase
            .from('users')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single()
          setSubscriptionStatus(fallbackData?.stripe_customer_id ? 'active' : 'inactive')
        } else {
          setSubscriptionStatus('inactive')
        }
      } else {
        setSubscriptionStatus(data?.subscription_status || 'inactive')
      }
    } catch (err) {
      console.error('Error:', err)
      setSubscriptionStatus('inactive')
    }
  }

  const fetchJobRequests = async () => {
    if (!user) return

    try {
      // First get all active job requests
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('gc_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (jobsError) {
        console.error('Error fetching job requests:', jobsError)
        return
      }

      // Then get bid counts for each job
      const jobsWithBidCounts = await Promise.all(
        (jobsData || []).map(async (job) => {
          const { count, error: countError } = await supabase
            .from('bids')
            .select('*', { count: 'exact', head: true })
            .eq('job_request_id', job.id)

          if (countError) {
            console.error('Error counting bids:', countError)
            return { ...job, bids_count: 0 }
          }

          return { ...job, bids_count: count || 0 }
        })
      )

      setJobRequests(jobsWithBidCounts)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPastJobRequests = async () => {
    if (!user) return

    try {
      // Get all closed job requests
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('gc_id', user.id)
        .eq('status', 'closed')
        .order('created_at', { ascending: false })

      if (jobsError) {
        console.error('Error fetching past job requests:', jobsError)
        return
      }

      // Then get bid counts for each job
      const jobsWithBidCounts = await Promise.all(
        (jobsData || []).map(async (job) => {
          const { count, error: countError } = await supabase
            .from('bids')
            .select('*', { count: 'exact', head: true })
            .eq('job_request_id', job.id)

          if (countError) {
            console.error('Error counting bids:', countError)
            return { ...job, bids_count: 0 }
          }

          return { ...job, bids_count: count || 0 }
        })
      )

      setPastJobRequests(jobsWithBidCounts)
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const closeJob = async (jobId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('job_requests')
        .update({ status: 'closed' })
        .eq('id', jobId)
        .eq('gc_id', user.id)

      if (error) {
        console.error('Error closing job:', error)
        return
      }

      // Refresh both job requests lists
      fetchJobRequests()
      fetchPastJobRequests()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const reopenJob = async (jobId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('job_requests')
        .update({ status: 'active' })
        .eq('id', jobId)
        .eq('gc_id', user.id)

      if (error) {
        console.error('Error reopening job:', error)
        return
      }

      // Refresh both job requests lists
      fetchJobRequests()
      fetchPastJobRequests()
    } catch (err) {
      console.error('Error:', err)
    }
  }


  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Check if user needs to subscribe
  if (subscriptionStatus !== 'active') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Building2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Bidi</h1>
            </div>
            <CardTitle>Subscription Required</CardTitle>
            <CardDescription>
              You need an active subscription to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Current status: <span className="font-semibold capitalize">{subscriptionStatus}</span>
            </p>
            <Link href="/subscription">
              <Button className="w-full">
                Subscribe Now
              </Button>
            </Link>
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bidi</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span className="font-semibold">Payment Successful!</span>
            </div>
            <p className="mt-1">Your subscription is now active. Welcome to Bidi!</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="mb-8">
          {/* Mobile: Horizontal scrollable cards */}
          <div className="flex gap-4 overflow-x-auto pb-2 sm:hidden">
            <Card className="min-w-[140px] flex-shrink-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">
                  {activeTab === 'current' ? 'Active Jobs' : 'Closed Jobs'}
                </CardTitle>
                <FileText className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-xl font-bold">
                  {activeTab === 'current' ? jobRequests.length : pastJobRequests.length}
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[140px] flex-shrink-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Total Bids</CardTitle>
                <Users className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-xl font-bold">
                  {activeTab === 'current' 
                    ? jobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)
                    : pastJobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)
                  }
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[140px] flex-shrink-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">
                  {activeTab === 'current' ? 'Recent Jobs' : 'Avg Bids/Job'}
                </CardTitle>
                <Mail className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-xl font-bold">
                  {activeTab === 'current' 
                    ? jobRequests.filter(job => new Date(job.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length
                    : pastJobRequests.length > 0 
                      ? Math.round(pastJobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0) / pastJobRequests.length * 10) / 10
                      : 0
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop: Grid layout */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {activeTab === 'current' ? 'Active Jobs' : 'Closed Jobs'}
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeTab === 'current' ? jobRequests.length : pastJobRequests.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bids Received</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeTab === 'current' 
                    ? jobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)
                    : pastJobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)
                  }
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {activeTab === 'current' ? 'Recent Jobs (30 days)' : 'Average Bids per Job'}
                </CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeTab === 'current' 
                    ? jobRequests.filter(job => new Date(job.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length
                    : pastJobRequests.length > 0 
                      ? Math.round(pastJobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0) / pastJobRequests.length * 10) / 10
                      : 0
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Job Requests Section */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your Job Requests</h2>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Link href="/dashboard/new-job">
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Post New Job
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'current'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Current Jobs ({jobRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'past'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Past Jobs ({pastJobRequests.length})
            </button>
          </div>
        </div>

        {/* Job Requests Content */}
        {activeTab === 'current' ? (
          jobRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No active job requests yet</h3>
                <p className="text-gray-600 mb-4">
                  Get started by posting your first job request to connect with subcontractors.
                </p>
                <Link href="/dashboard/new-job">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Post Your First Job
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {jobRequests.map((job) => (
                <Card key={job.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg leading-tight">{job.trade_category}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs sm:text-sm flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.location}
                            </div>
                            <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs sm:text-sm flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {job.budget_range}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2">
                          <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.created_at).toLocaleDateString()}
                          </div>
                          <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs sm:text-sm font-medium flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {job.bids_count || 0} bids received
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-700 mb-4 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base leading-relaxed">{job.description}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link href={`/dashboard/jobs/${job.id}`} className="flex-1 sm:flex-none order-1">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                          View Bids
                        </Button>
                      </Link>
                      <Link href={`/dashboard/jobs/${job.id}/edit`} className="flex-1 sm:flex-none order-2">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                          Edit Job
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => closeJob(job.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto text-xs sm:text-sm order-3"
                      >
                        <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Close
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          pastJobRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No closed requests yet</h3>
                <p className="text-gray-600 mb-4">
                  Closed job requests will appear here once you close them from your active jobs.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {pastJobRequests.map((job) => (
                <Card key={job.id} className="opacity-75 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg leading-tight">{job.trade_category}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs sm:text-sm flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.location}
                            </div>
                            <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs sm:text-sm flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {job.budget_range}
                            </div>
                            <div className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs sm:text-sm flex items-center gap-1">
                              <X className="h-3 w-3" />
                              Closed
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2">
                          <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(job.created_at).toLocaleDateString()}
                          </div>
                          <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs sm:text-sm font-medium flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {job.bids_count || 0} bids received
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-700 mb-4 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base leading-relaxed">{job.description}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link href={`/dashboard/jobs/${job.id}`} className="flex-1 sm:flex-none order-1">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                          View Bids
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => reopenJob(job.id)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 w-full sm:w-auto text-xs sm:text-sm order-2"
                      >
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Reopen
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
