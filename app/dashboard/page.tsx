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
import { Building2, Plus, FileText, Users, Mail, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'

interface JobRequest {
  id: string
  trade_category: string
  location: string
  description: string
  budget_range: string
  created_at: string
  bids_count?: number
}

export default function DashboardPage() {
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive')
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
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
      // First get all job requests
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('gc_id', user.id)
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
              <h1 className="text-2xl font-bold text-gray-900">SubBidi</h1>
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
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">SubBidi</h1>
          </div>
          <div className="flex items-center space-x-4">
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
            <p className="mt-1">Your subscription is now active. Welcome to SubBidi!</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs Posted</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobRequests.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bids Received</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {jobRequests.reduce((sum, job) => sum + (job.bids_count || 0), 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {jobRequests.filter(job => new Date(job.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job Requests Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Your Job Requests</h2>
          <Link href="/dashboard/new-job">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Post New Job
            </Button>
          </Link>
        </div>

        {jobRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No job requests yet</h3>
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
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{job.trade_category}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">
                          {job.location}
                        </div>
                        <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                          {job.budget_range}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        {new Date(job.created_at).toLocaleDateString()}
                      </div>
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mt-1">
                        {job.bids_count || 0} bids received
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-4">{job.description}</p>
                  <div className="flex space-x-2">
                    <Link href={`/dashboard/jobs/${job.id}`}>
                      <Button variant="outline" size="sm">
                        View Bids
                      </Button>
                    </Link>
                    <Link href={`/dashboard/jobs/${job.id}/edit`}>
                      <Button variant="outline" size="sm">
                        Edit Job
                      </Button>
                    </Link>
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
