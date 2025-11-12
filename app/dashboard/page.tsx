'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { listJobsForUser } from '@/lib/job-access'
import { 
  Building2, 
  Plus, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ArrowRight,
  FileText,
  BarChart3,
  Users,
  DollarSign,
  MapPin,
  Calendar,
  Package,
  Eye,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { staggerContainer, staggerItem, cardHover, pageVariants, skeletonPulse } from '@/lib/animations'
import { Job } from '@/types/takeoff'

interface DashboardStats {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  totalPlans: number
  totalBidPackages: number
  totalBids: number
  pendingBids: number
}

interface RecentJob {
  id: string
  name: string
  location: string
  status: string
  created_at: string
  plan_count: number
  bid_package_count: number
  bid_count: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalPlans: 0,
    totalBidPackages: 0,
    totalBids: 0,
    pendingBids: 0
  })
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  async function loadDashboardData() {
    try {
      if (!user) {
        return
      }

      const memberships = await listJobsForUser(
        supabase,
        user.id,
        'id, status, created_at, name, location'
      )

      const jobsData = memberships.map(({ job, role }) => ({
        ...job,
        membership_role: role as 'owner' | 'collaborator'
      }))

      const userJobIds = jobsData.map(job => job.id)

      let plansData: { id: string; job_id: string }[] = []
      if (userJobIds.length > 0) {
        const { data: plansResult, error: plansError } = await supabase
          .from('plans')
          .select('id, job_id')
          .in('job_id', userJobIds)

        if (plansError) throw plansError
        plansData = plansResult || []
      }

      let packagesData: { id: string; job_id: string; status: string | null }[] = []
      if (userJobIds.length > 0) {
        const { data: packagesResult, error: packagesError } = await supabase
          .from('bid_packages')
          .select('id, job_id, status')
          .in('job_id', userJobIds)

        if (packagesError) throw packagesError
        packagesData = packagesResult || []
      }

      const bidPackageIds = packagesData.map(pkg => pkg.id)
      let bidsData: { id: string; status: string | null; bid_package_id: string | null }[] = []
      if (bidPackageIds.length > 0) {
        const { data: bidsResult, error: bidsError } = await supabase
          .from('bids')
          .select('id, status, bid_package_id')
          .in('bid_package_id', bidPackageIds)

        if (bidsError) throw bidsError
        bidsData = bidsResult || []
      }

      const totalJobs = jobsData.length
      const activeJobs = jobsData.filter(job => job.status === 'active').length
      const completedJobs = jobsData.filter(job => job.status === 'completed').length
      const totalPlans = plansData.length
      const totalBidPackages = packagesData.length
      const totalBids = bidsData.length
      const pendingBids = bidsData.filter(bid => bid.status === 'pending').length

      setStats({
        totalJobs,
        activeJobs,
        completedJobs,
        totalPlans,
        totalBidPackages,
        totalBids,
        pendingBids
      })

      const recentJobsSorted = [...jobsData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      const formattedRecentJobs = recentJobsSorted.slice(0, 5).map((job) => {
        const jobPackages = packagesData.filter(pkg => pkg.job_id === job.id)
        const jobPackageIds = jobPackages.map(pkg => pkg.id)
        const jobBids = bidsData.filter(bid =>
          bid.bid_package_id ? jobPackageIds.includes(bid.bid_package_id) : false
        )

        return {
          id: job.id,
          name: job.name,
          location: job.location,
          status: job.status,
          created_at: job.created_at,
          plan_count: plansData.filter(plan => plan.job_id === job.id).length,
          bid_package_count: jobPackages.length,
          bid_count: jobBids.length
        }
      })

      setRecentJobs(formattedRecentJobs)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'archived': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        className="min-h-screen bg-gray-50"
      >
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <motion.div
            variants={skeletonPulse}
            animate="animate"
            className="space-y-6"
          >
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-gray-50"
    >
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your construction projects and bids</p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-8"
        >
          {/* Quick Actions */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="h-5 w-5 mr-2 text-orange-600" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Start a new project or manage existing ones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Link href="/dashboard/jobs/new">
                    <motion.div
                      whileHover="hover"
                      whileTap="tap"
                      variants={cardHover}
                    >
                      <Card className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-orange-500 transition-colors">
                        <CardContent className="p-6 text-center">
                          <Plus className="h-8 w-8 mx-auto mb-3 text-orange-600" />
                          <h3 className="font-semibold text-gray-900 mb-1">Create New Job</h3>
                          <p className="text-sm text-gray-600">Start a new construction project</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Link>
                  
                  <Link href="/dashboard/jobs">
                    <motion.div
                      whileHover="hover"
                      whileTap="tap"
                      variants={cardHover}
                    >
                      <Card className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-6 text-center">
                          <Eye className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                          <h3 className="font-semibold text-gray-900 mb-1">View All Jobs</h3>
                          <p className="text-sm text-gray-600">Manage existing projects</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={staggerItem}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                whileHover="hover"
                whileTap="tap"
                variants={cardHover}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
                      </div>
                      <Building2 className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                whileHover="hover"
                whileTap="tap"
                variants={cardHover}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                        <p className="text-2xl font-bold text-green-600">{stats.activeJobs}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                whileHover="hover"
                whileTap="tap"
                variants={cardHover}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Bid Packages</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.totalBidPackages}</p>
                      </div>
                      <Package className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                whileHover="hover"
                whileTap="tap"
                variants={cardHover}
              >
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Pending Bids</p>
                        <p className="text-2xl font-bold text-orange-600">{stats.pendingBids}</p>
                      </div>
                      <Clock className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>

          {/* Recent Jobs */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Building2 className="h-5 w-5 mr-2 text-orange-600" />
                      Recent Jobs
                    </CardTitle>
                    <CardDescription>
                      Your latest construction projects
                    </CardDescription>
                  </div>
                  <Link href="/dashboard/jobs">
                    <Button variant="outline" size="sm">
                      View All
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <AnimatePresence>
                  {recentJobs.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs yet</h3>
                      <p className="text-gray-600 mb-4">Create your first job to get started</p>
                      <Link href="/dashboard/jobs/new">
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Job
                        </Button>
                      </Link>
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-4"
                    >
                      {recentJobs.map((job) => (
                        <motion.div
                          key={job.id}
                          variants={staggerItem}
                          whileHover="hover"
                          whileTap="tap"
                        >
                          <Link href={`/dashboard/jobs/${job.id}`}>
                            <Card className="cursor-pointer">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <h4 className="font-semibold text-gray-900">{job.name}</h4>
                                      <Badge className={getStatusColor(job.status)}>
                                        {job.status}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                                      <div className="flex items-center">
                                        <MapPin className="h-4 w-4 mr-1" />
                                        {job.location}
                                      </div>
                                      <div className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-1" />
                                        {new Date(job.created_at).toLocaleDateString()}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                                      <div className="flex items-center">
                                        <FileText className="h-4 w-4 mr-1" />
                                        {job.plan_count} plan{job.plan_count !== 1 ? 's' : ''}
                                      </div>
                                      <div className="flex items-center">
                                        <Package className="h-4 w-4 mr-1" />
                                        {job.bid_package_count} package{job.bid_package_count !== 1 ? 's' : ''}
                                      </div>
                                      <div className="flex items-center">
                                        <Users className="h-4 w-4 mr-1" />
                                        {job.bid_count} bid{job.bid_count !== 1 ? 's' : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <ArrowRight className="h-5 w-5 text-gray-400" />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Additional Stats */}
          <motion.div variants={staggerItem}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Plans</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalPlans}</p>
                    </div>
                    <FileText className="h-8 w-8 text-gray-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Completed Jobs</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.completedJobs}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Bids</p>
                      <p className="text-2xl font-bold text-green-600">{stats.totalBids}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}