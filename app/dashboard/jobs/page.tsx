'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Briefcase, 
  Plus, 
  FileText, 
  MapPin, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  CheckCircle,
  XCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
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
  accepted_bid_id?: string | null
}

export default function JobsPage() {
  const [activeJobs, setActiveJobs] = useState<JobRequest[]>([])
  const [closedJobs, setClosedJobs] = useState<JobRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active')
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    fetchJobs()
  }, [user, router])

  const fetchJobs = async () => {
    if (!user) return

    try {
      // Get all jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('gc_id', user.id)
        .order('created_at', { ascending: false })

      if (jobsError) {
        console.error('Error fetching jobs:', jobsError)
        return
      }

      // Get bid counts for each job
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

      // Separate active and closed jobs
      const active = jobsWithBidCounts.filter(job => job.status === 'active')
      const closed = jobsWithBidCounts.filter(job => job.status === 'closed')

      setActiveJobs(active)
      setClosedJobs(closed)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const closeJob = async (jobId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('job_requests')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('gc_id', user.id)

      if (error) {
        console.error('Error closing job:', error)
        return
      }

      // Refresh the jobs list
      fetchJobs()
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

      // Refresh the jobs list
      fetchJobs()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const renderJobCard = (job: JobRequest, isActive: boolean) => (
    <Card key={job.id} className={`hover:shadow-md transition-shadow ${!isActive ? 'opacity-75' : ''}`}>
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
                {isActive ? (
                  <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs sm:text-sm flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </div>
                ) : (
                  <div className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs sm:text-sm flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Closed
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(job.created_at).toLocaleDateString()}
              </div>
              <div className={`px-2 py-1 rounded text-xs sm:text-sm font-medium flex items-center gap-1 ${
                job.bids_count === 0 
                  ? 'bg-gray-100 text-gray-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                <MessageSquare className="h-3 w-3" />
                {job.bids_count || 0} {job.bids_count === 1 ? 'bid' : 'bids'}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-gray-700 mb-4 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base leading-relaxed">
          {job.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href={`/dashboard/jobs/${job.id}`} className="flex-1 sm:flex-none">
            <Button variant="default" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
              View Details
            </Button>
          </Link>
          <Link href={`/dashboard/jobs/${job.id}/edit`} className="flex-1 sm:flex-none">
            <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
              Edit Job
            </Button>
          </Link>
          {isActive ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => closeJob(job.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto text-xs sm:text-sm"
            >
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Close Job
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => reopenJob(job.id)}
              className="text-green-600 hover:text-green-700 hover:bg-green-50 w-full sm:w-auto text-xs sm:text-sm"
            >
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Reopen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FallingBlocksLoader text="Loading jobs..." size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">My Jobs</h2>
            <p className="text-gray-600 dark:text-gray-300">Manage your job requests and bids</p>
          </div>
          <Link href="/dashboard/new-job">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Post New Job
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeJobs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closed Jobs</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{closedJobs.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bids</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {[...activeJobs, ...closedJobs].reduce((sum, job) => sum + (job.bids_count || 0), 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Bids/Job</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {[...activeJobs, ...closedJobs].length > 0 
                  ? Math.round([...activeJobs, ...closedJobs].reduce((sum, job) => sum + (job.bids_count || 0), 0) / [...activeJobs, ...closedJobs].length * 10) / 10
                  : 0
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Tabs */}
        <Tabs defaultValue="active" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
            <TabsTrigger value="active">
              Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed ({closedJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeJobs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No active jobs</h3>
                  <p className="text-gray-600 mb-4">
                    Post a new job to start receiving bids from subcontractors.
                  </p>
                  <Link href="/dashboard/new-job">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Post New Job
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {activeJobs.map((job) => renderJobCard(job, true))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="closed" className="mt-6">
            {closedJobs.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No closed jobs</h3>
                  <p className="text-gray-600">
                    Closed jobs will appear here once you close them from the active list.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {closedJobs.map((job) => renderJobCard(job, false))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

