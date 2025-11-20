'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Building2, 
  Plus, 
  Search,
  Filter,
  MapPin,
  Calendar,
  FileText,
  Package,
  Users,
  ArrowRight,
  Loader2,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { staggerContainer, staggerItem, cardHover, pageVariants, skeletonPulse } from '@/lib/animations'
import { Job } from '@/types/takeoff'
import { listJobsForUser } from '@/lib/job-access'

interface JobWithCounts extends Job {
  plan_count: number
  bid_package_count: number
  bid_count: number
  membership_role: 'owner' | 'collaborator'
}

export default function JobsPage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      loadJobs()
    }
  }, [user, statusFilter, sortBy])

  async function loadJobs() {
    try {
      if (!user) {
        return
      }

      const memberships = await listJobsForUser(
        supabase,
        user.id,
        `
          *,
          plans(count),
          bid_packages(count)
        `
      )

      let filteredMemberships = memberships

      if (statusFilter !== 'all') {
        filteredMemberships = memberships.filter(({ job }) => job.status === statusFilter)
      }

      filteredMemberships = filteredMemberships.sort((a, b) => {
        const aValue = a.job[sortBy as keyof Job] ?? ''
        const bValue = b.job[sortBy as keyof Job] ?? ''
        if (aValue === bValue) return 0
        if (aValue === null) return 1
        if (bValue === null) return -1
        return aValue > bValue ? -1 : 1
      })

      // Calculate bid counts for each job through bid_packages
      const formattedJobs = await Promise.all(
        filteredMemberships.map(async ({ job, role }) => {
          // Get bid packages for this job
          const { data: jobBidPackages } = await supabase
            .from('bid_packages')
            .select('id')
            .eq('job_id', job.id)
          
          const packageIds = jobBidPackages?.map(pkg => pkg.id) || []
          let bidCount = 0
          
          if (packageIds.length > 0) {
            const { count } = await supabase
              .from('bids')
              .select('*', { count: 'exact', head: true })
              .in('bid_package_id', packageIds)
            
            bidCount = count || 0
          }

          return {
            ...job,
            plan_count: job.plans?.[0]?.count || 0,
            bid_package_count: job.bid_packages?.[0]?.count || 0,
            bid_count: bidCount,
            membership_role: role
          }
        })
      )

      setJobs(formattedJobs)

    } catch (error) {
      console.error('Error loading jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredJobs = jobs.filter(job =>
    job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (job.location && job.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

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
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded"></div>
              ))}
            </div>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Jobs</h1>
              <p className="text-gray-600">Manage your construction projects</p>
            </div>
            <Link href="/dashboard/jobs/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search jobs by name, location, or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Newest First</SelectItem>
                      <SelectItem value="name">Name A-Z</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Jobs Grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-6"
        >
          <AnimatePresence>
            {filteredJobs.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12"
              >
                <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchTerm || statusFilter !== 'all' ? 'No jobs found' : 'No jobs yet'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Create your first job to get started'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Link href="/dashboard/jobs/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Job
                    </Button>
                  </Link>
                )}
              </motion.div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {filteredJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    variants={staggerItem}
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <Link href={`/dashboard/jobs/${job.id}`}>
                      <Card className="cursor-pointer h-full">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg mb-1">{job.name}</CardTitle>
                              {job.location && (
                                <CardDescription className="flex items-center">
                                  <MapPin className="h-4 w-4 mr-1" />
                                  {job.location}
                                </CardDescription>
                              )}
                            </div>
                            <Badge className={getStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {job.description && (
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                              {job.description}
                            </p>
                          )}
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center text-gray-600">
                                <Calendar className="h-4 w-4 mr-1" />
                                Created {new Date(job.created_at).toLocaleDateString()}
                              </div>
                              {job.budget_range && (
                                <div className="text-gray-600">
                                  {job.budget_range}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center text-gray-500">
                                  <FileText className="h-4 w-4 mr-1" />
                                  {job.plan_count}
                                </div>
                                <div className="flex items-center text-gray-500">
                                  <Package className="h-4 w-4 mr-1" />
                                  {job.bid_package_count}
                                </div>
                                <div className="flex items-center text-gray-500">
                                  <Users className="h-4 w-4 mr-1" />
                                  {job.bid_count}
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  )
}