'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import { Button as HeroUIButton } from '@heroui/button'
// import { Card as HeroUICard, CardBody, CardHeader as HeroUICardHeader } from '@heroui/card'
// import { Badge } from '@heroui/badge'
// import { Chip } from '@heroui/chip'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, Plus, FileText, Users, Mail, CheckCircle, X, History, MapPin, DollarSign, MessageSquare, Calendar, UserCheck } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import CreditsDisplay from '@/components/credits-display'
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
  unseen_bids_count?: number
  status?: 'active' | 'closed' | 'collecting_bids'
  bid_collection_started_at?: string
  bid_collection_ends_at?: string
}

export default function DashboardPage() {
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([])
  const [pastJobRequests, setPastJobRequests] = useState<JobRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive')
  const [paymentType, setPaymentType] = useState<string>('subscription')
  const [userCredits, setUserCredits] = useState<number>(0)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current')
  const [isAdmin, setIsAdmin] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useRef(createClient()).current

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    // Simple data loading - only run once when user changes
    const loadData = async () => {
      setLoading(true)
      
      // Check for success parameter from Stripe
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('success') === 'true') {
        setShowSuccessMessage(true)
        setTimeout(() => {
          fetchUserSubscription()
          window.history.replaceState({}, '', '/dashboard')
        }, 1000)
        
        setTimeout(() => {
          setShowSuccessMessage(false)
        }, 5000)
      }

      // Load all data
      await Promise.all([
        fetchUserSubscription(),
        fetchJobRequests(),
        fetchPastJobRequests(),
        checkAdminStatus()
      ])
      
      setLoading(false)
    }

    loadData()
  }, [user]) // Only depend on user

  const checkAdminStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin, demo_mode')
        .eq('id', user.id)
        .single()

      if (error) {
        setIsAdmin(false)
        setDemoMode(false)
        return
      }

      setIsAdmin(data?.is_admin || false)
      setDemoMode(data?.demo_mode || false)
    } catch (err) {
      setIsAdmin(false)
      setDemoMode(false)
    }
  }

  const fetchUserSubscription = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('subscription_status, stripe_customer_id, payment_type, credits')
        .eq('id', user.id)
        .single()

      if (error) {
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
        setPaymentType(data?.payment_type || 'subscription')
        setUserCredits(data?.credits || 0)
      }
    } catch (err) {
      setSubscriptionStatus('inactive')
      setPaymentType('subscription')
      setUserCredits(0)
    }
  }

  const fetchJobRequests = async () => {
    if (!user) return

    try {
      // First get all job requests (including those without status for backward compatibility)
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('gc_id', user.id)
        .or('status.is.null,status.in.(active,collecting_bids)')
        .order('created_at', { ascending: false })

      if (jobsError) {
        setJobRequests([])
        return
      }

      // Optimized: Get all bid counts in a single query
      const jobIds = (jobsData || []).map(job => job.id)
      let bidCounts: { [key: string]: { total: number, unseen: number } } = {}
      
      if (jobIds.length > 0) {
        // Get all bid counts for all jobs at once
        const { data: allBids, error: bidsError } = await supabase
          .from('bids')
          .select('job_request_id, seen')
          .in('job_request_id', jobIds)

        if (!bidsError && allBids) {
          // Count bids per job
          bidCounts = allBids.reduce((acc, bid) => {
            const jobId = bid.job_request_id
            if (!acc[jobId]) {
              acc[jobId] = { total: 0, unseen: 0 }
            }
            acc[jobId].total++
            if (!bid.seen) {
              acc[jobId].unseen++
            }
            return acc
          }, {} as { [key: string]: { total: number, unseen: number } })
        }
      }

      const jobsWithBidCounts = (jobsData || []).map(job => ({
        ...job,
        bids_count: bidCounts[job.id]?.total || 0,
        unseen_bids_count: bidCounts[job.id]?.unseen || 0
      }))

      setJobRequests(jobsWithBidCounts)
    } catch (err) {
      setJobRequests([])
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
        setPastJobRequests([])
        return
      }

      // Optimized: Get all bid counts in a single query
      const jobIds = (jobsData || []).map(job => job.id)
      let bidCounts: { [key: string]: number } = {}
      
      if (jobIds.length > 0) {
        // Get all bid counts for all jobs at once
        const { data: allBids, error: bidsError } = await supabase
          .from('bids')
          .select('job_request_id')
          .in('job_request_id', jobIds)

        if (!bidsError && allBids) {
          // Count bids per job
          bidCounts = allBids.reduce((acc, bid) => {
            const jobId = bid.job_request_id
            acc[jobId] = (acc[jobId] || 0) + 1
            return acc
          }, {} as { [key: string]: number })
        }
      }

      const jobsWithBidCounts = (jobsData || []).map(job => ({
        ...job,
        bids_count: bidCounts[job.id] || 0
      }))

      setPastJobRequests(jobsWithBidCounts)
    } catch (err) {
      setPastJobRequests([])
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
        return
      }

      // Refresh both job requests lists
      fetchJobRequests()
      fetchPastJobRequests()
    } catch (err) {
      // Silent error handling
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
        return
      }

      // Refresh both job requests lists
      fetchJobRequests()
      fetchPastJobRequests()
    } catch (err) {
      // Silent error handling
    }
  }

  const stopCollectingBids = useCallback(async (jobId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('job_requests')
        .update({ 
          status: 'active',
          bid_collection_ends_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .eq('gc_id', user.id)

      if (error) {
        return
      }

      // Refresh job requests
      fetchJobRequests()
    } catch (err) {
      // Silent error handling
    }
  }, [user, supabase])

  // Memoize expensive calculations
  const stats = useMemo(() => {
    const currentJobsCount = jobRequests.length
    const pastJobsCount = pastJobRequests.length
    const currentBidsCount = jobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)
    const pastBidsCount = pastJobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)
    const recentJobsCount = jobRequests.filter(job => 
      new Date(job.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length
    const avgBidsPerJob = pastJobRequests.length > 0 
      ? Math.round(pastBidsCount / pastJobRequests.length * 10) / 10
      : 0

    return {
      currentJobsCount,
      pastJobsCount,
      currentBidsCount,
      pastBidsCount,
      recentJobsCount,
      avgBidsPerJob
    }
  }, [jobRequests, pastJobRequests])

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

  // Dashboard is now accessible to all authenticated users

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
            <CreditsDisplay />
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8 py-4">
            <Link 
              href="/dashboard" 
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/dashboard' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Jobs</span>
            </Link>
            <Link 
              href="/dashboard/contacts" 
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/dashboard/contacts' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              <span>My Contacts</span>
            </Link>
            <Link 
              href="/dashboard/past-requests" 
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/dashboard/past-requests' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Past Requests</span>
            </Link>
          </div>
        </div>
      </nav>

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

        {/* Demo Mode Indicator */}
        {isAdmin && demoMode && (
          <div className="mb-6 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                <div>
                  <span className="font-semibold">Demo Mode Active</span>
                  <p className="text-sm mt-1">New job requests will automatically generate demo bids for demonstration purposes.</p>
                </div>
              </div>
              <Link href="/admin/demo-settings">
                <Button variant="outline" size="sm" className="text-blue-700 border-blue-400 hover:bg-blue-200">
                  Settings
                </Button>
              </Link>
            </div>
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
                  {activeTab === 'current' ? stats.currentJobsCount : stats.pastJobsCount}
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
                  {activeTab === 'current' ? stats.currentBidsCount : stats.pastBidsCount}
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
                  {activeTab === 'current' ? stats.recentJobsCount : stats.avgBidsPerJob}
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
                  {activeTab === 'current' ? stats.currentJobsCount : stats.pastJobsCount}
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
                  {activeTab === 'current' ? stats.currentBidsCount : stats.pastBidsCount}
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
                  {activeTab === 'current' ? stats.recentJobsCount : stats.avgBidsPerJob}
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
              Current Jobs ({stats.currentJobsCount})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'past'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Past Jobs ({stats.pastJobsCount})
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
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg leading-tight">{job.trade_category}</CardTitle>
                            {job.status === 'collecting_bids' && (job.unseen_bids_count || 0) > 0 && (
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            )}
                          </div>
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
                          {job.status === 'collecting_bids' ? (
                            <div className="flex flex-col gap-1">
                              <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs sm:text-sm font-medium flex items-center gap-1">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-600"></div>
                                Collecting bids...
                              </div>
                              {(job.bids_count || 0) > 0 && (
                                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs sm:text-sm font-medium flex items-center gap-1 relative">
                                  <MessageSquare className="h-3 w-3" />
                                  {job.bids_count || 0} bids received
                                  {(job.unseen_bids_count || 0) > 0 && (
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs sm:text-sm font-medium flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {job.bids_count || 0} bids received
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-700 mb-4 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base leading-relaxed">{job.description}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link 
                        href={`/dashboard/jobs/${job.id}`} 
                        className="flex-1 sm:flex-none order-1 relative"
                        onClick={() => {
                          // Refresh job requests after a short delay to update unseen counts
                          setTimeout(() => {
                            fetchJobRequests()
                          }, 1000)
                        }}
                      >
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                          View Bids
                          {job.status === 'collecting_bids' && (job.unseen_bids_count || 0) > 0 && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse flex items-center justify-center">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                          )}
                        </Button>
                      </Link>
                      <Link href={`/dashboard/jobs/${job.id}/edit`} className="flex-1 sm:flex-none order-2">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                          Edit Job
                        </Button>
                      </Link>
                      {job.status === 'collecting_bids' ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => stopCollectingBids(job.id)}
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 w-full sm:w-auto text-xs sm:text-sm order-3"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Stop Collecting
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => closeJob(job.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto text-xs sm:text-sm order-3"
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Close
                        </Button>
                      )}
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
