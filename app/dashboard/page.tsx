'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  FileText, 
  Plus, 
  Briefcase, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Upload,
  BarChart3,
  Users,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

interface DashboardStats {
  totalPlans: number
  activePlans: number
  totalJobs: number
  activeJobs: number
  pendingBids: number
  totalContacts: number
}

interface RecentPlan {
  id: string
  title: string
  file_name: string
  status: string
  created_at: string
  has_takeoff_analysis: boolean
  has_quality_analysis: boolean
}

interface RecentJob {
  id: string
  trade_category: string
  location: string
  status: string
  created_at: string
  bids_count?: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalPlans: 0,
    activePlans: 0,
    totalJobs: 0,
    activeJobs: 0,
    pendingBids: 0,
    totalContacts: 0
  })
  const [recentPlans, setRecentPlans] = useState<RecentPlan[]>([])
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  async function loadDashboardData() {
    try {
      const supabase = createClient()

      // Load stats
      const [plansResult, jobsResult, bidsResult, contactsResult] = await Promise.all([
        supabase
          .from('plans')
          .select('status', { count: 'exact' })
          .eq('user_id', user?.id),
        supabase
          .from('job_requests')
          .select('status', { count: 'exact' })
          .eq('gc_id', user?.id),
        supabase
          .from('bids')
          .select('*, job_requests!inner(gc_id)', { count: 'exact' })
          .eq('job_requests.gc_id', user?.id)
          .is('seen_at', null),
        supabase
          .from('gc_contacts')
          .select('*', { count: 'exact' })
          .eq('gc_id', user?.id)
      ])

      // Count active plans
      const activePlans = plansResult.data?.filter(p => p.status === 'ready' || p.status === 'processing').length || 0
      const activeJobs = jobsResult.data?.filter(j => j.status === 'active').length || 0

      setStats({
        totalPlans: plansResult.count || 0,
        activePlans,
        totalJobs: jobsResult.count || 0,
        activeJobs,
        pendingBids: bidsResult.count || 0,
        totalContacts: contactsResult.count || 0
      })

      // Load recent plans
      const { data: plans } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentPlans(plans || [])

      // Load recent jobs
      const { data: jobs } = await supabase
        .from('job_requests')
        .select('*')
        .eq('gc_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentJobs(jobs || [])

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FallingBlocksLoader />
      </div>
    )
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome back!</h1>
          <p className="text-gray-600 dark:text-gray-300">Here's what's happening with your projects</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link href="/dashboard/plans/new">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-orange-500 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/30 dark:to-gray-950">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg mb-1 dark:text-white">Upload New Plan</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Start analyzing construction plans</p>
                  </div>
                  <div className="bg-orange-500 text-white p-3 rounded-lg">
                    <Upload className="h-6 w-6" />
          </div>
        </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/new-job">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-950">
              <CardContent className="p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-lg mb-1 dark:text-white">Post New Job</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get bids from subcontractors</p>
                  </div>
                  <div className="bg-blue-500 text-white p-3 rounded-lg">
                    <Briefcase className="h-6 w-6" />
                </div>
              </div>
              </CardContent>
            </Card>
              </Link>
            </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-lg">
                  <FileText className="h-5 w-5" />
          </div>
                {stats.activePlans > 0 && (
                  <Badge variant="default" className="bg-green-500">
                    {stats.activePlans} active
                  </Badge>
                )}
                </div>
              <h3 className="text-2xl font-bold dark:text-white">{stats.totalPlans}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Plans</p>
              </CardContent>
            </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                  <Briefcase className="h-5 w-5" />
                </div>
                {stats.activeJobs > 0 && (
                  <Badge variant="default" className="bg-green-500">
                    {stats.activeJobs} active
                  </Badge>
                )}
                </div>
              <h3 className="text-2xl font-bold dark:text-white">{stats.totalJobs}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Jobs</p>
              </CardContent>
            </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-purple-100 text-purple-600 p-2 rounded-lg">
                  <DollarSign className="h-5 w-5" />
                </div>
                {stats.pendingBids > 0 && (
                  <Badge variant="default" className="bg-yellow-500">
                    {stats.pendingBids} new
                  </Badge>
                )}
          </div>
              <h3 className="text-2xl font-bold dark:text-white">{stats.pendingBids}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending Bids</p>
              </CardContent>
            </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-green-100 text-green-600 p-2 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
                </div>
              <h3 className="text-2xl font-bold dark:text-white">{stats.totalContacts}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Contacts</p>
              </CardContent>
            </Card>
          </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Plans */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Plans</CardTitle>
                  <CardDescription>Your latest uploaded plans</CardDescription>
        </div>
                <Link href="/dashboard/plans">
                  <Button variant="ghost" size="sm">
                    View All
                    <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
            </CardHeader>
            <CardContent>
              {recentPlans.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                  <p className="text-sm">No plans yet</p>
                  <Link href="/dashboard/plans/new">
                    <Button size="sm" className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Upload Your First Plan
                  </Button>
                </Link>
                            </div>
                          ) : (
                <div className="space-y-3">
                  {recentPlans.map(plan => (
                    <Link key={plan.id} href={`/dashboard/plans/${plan.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all cursor-pointer">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 p-2 rounded">
                            <FileText className="h-4 w-4" />
                            </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate dark:text-white">
                              {plan.title || plan.file_name}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs dark:border-gray-700 dark:text-gray-300">
                                {plan.status}
                              </Badge>
                              {plan.has_takeoff_analysis && (
                                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-400">
                                  <BarChart3 className="h-3 w-3 mr-1" />
                                  Takeoff
                                </Badge>
                              )}
                              {plan.has_quality_analysis && (
                                <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/50 dark:border-green-700 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Quality
                                </Badge>
                              )}
                        </div>
                      </div>
                    </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                            </div>
                          )}
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Jobs</CardTitle>
                  <CardDescription>Your latest job requests</CardDescription>
                </div>
                <Link href="/dashboard/jobs">
                  <Button variant="ghost" size="sm">
                    View All
                    <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                  <p className="text-sm">No jobs yet</p>
                  <Link href="/dashboard/new-job">
                    <Button size="sm" className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Post Your First Job
                        </Button>
                      </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map(job => (
                    <Link key={job.id} href={`/dashboard/jobs/${job.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all cursor-pointer">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 p-2 rounded">
                            <Briefcase className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate dark:text-white">
                              {job.trade_category}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {job.location}
                              </span>
                              {job.bids_count && job.bids_count > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {job.bids_count} bids
                                </Badge>
                      )}
                    </div>
                            </div>
                          </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </div>
                      </Link>
                  ))}
                    </div>
              )}
                  </CardContent>
                </Card>
            </div>
      </div>
    </div>
  )
}
