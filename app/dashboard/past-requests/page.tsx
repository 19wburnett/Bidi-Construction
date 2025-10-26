'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, ArrowLeft, FileText, History, CheckCircle, MapPin, DollarSign, XCircle, MessageSquare, Calendar } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

interface JobRequest {
  id: string
  trade_category: string
  location: string
  description: string
  budget_range: string
  created_at: string
  bids_count?: number
  status?: string
  closed_at?: string
}

export default function PastRequestsPage() {
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive')
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    fetchUserSubscription()
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

  const fetchPastJobRequests = async () => {
    if (!user) return

    try {
      // Get all closed jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      if (jobsError) {
        console.error('Error fetching past job requests:', jobsError)
        return
      }

      // Then get bid counts for each job through bid_packages
      const jobsWithBidCounts = await Promise.all(
        (jobsData || []).map(async (job) => {
          // First get bid packages for this job
          const { data: bidPackages, error: packagesError } = await supabase
            .from('bid_packages')
            .select('id')
            .eq('job_id', job.id)
          
          if (packagesError) {
            console.error('Error fetching bid packages:', packagesError)
            return { ...job, bidCount: 0 }
          }
          
          const packageIds = bidPackages?.map(pkg => pkg.id) || []
          if (packageIds.length === 0) {
            return { ...job, bidCount: 0 }
          }
          
          // Then get bid count for these packages
          const { count, error: countError } = await supabase
            .from('bids')
            .select('*', { count: 'exact', head: true })
            .in('bid_package_id', packageIds)

          if (countError) {
            console.error('Error counting bids:', countError)
            return { ...job, bidCount: 0 }
          }

          return { ...job, bidCount: count || 0 }
        })
      )

      setJobRequests(jobsWithBidCounts)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const reopenJob = async (jobId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'active' })
        .eq('id', jobId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error reopening job:', error)
        return
      }

      // Refresh the job requests list
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
          <FallingBlocksLoader text="Loading past requests..." size="lg" />
        </div>
      </div>
    )
  }

  // Past requests page is now accessible to all authenticated users

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Past Requests</h2>
              <p className="text-gray-600">Your closed job requests</p>
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="mb-8">
          {/* Mobile: Horizontal scrollable cards */}
          <div className="flex gap-4 overflow-x-auto pb-2 sm:hidden">
            <Card className="min-w-[140px] flex-shrink-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Closed Jobs</CardTitle>
                <History className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-xl font-bold">{jobRequests.length}</div>
              </CardContent>
            </Card>

            <Card className="min-w-[140px] flex-shrink-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Total Bids</CardTitle>
                <FileText className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-xl font-bold">
                  {jobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[140px] flex-shrink-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium">Avg Bids/Job</CardTitle>
                <CheckCircle className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-2">
                <div className="text-xl font-bold">
                  {jobRequests.length > 0 
                    ? Math.round(jobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0) / jobRequests.length * 10) / 10
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
                <CardTitle className="text-sm font-medium">Closed Jobs</CardTitle>
                <History className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{jobRequests.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bids Received</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {jobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Bids per Job</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {jobRequests.length > 0 
                    ? Math.round(jobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0) / jobRequests.length * 10) / 10
                    : 0
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Past Job Requests */}
        {jobRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No closed requests yet</h3>
              <p className="text-gray-600 mb-4">
                Closed job requests will appear here once you close them from your active dashboard.
              </p>
              <Link href="/dashboard">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {jobRequests.map((job) => (
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
                            <XCircle className="h-3 w-3" />
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
        )}
      </div>
    </div>
  )
}
