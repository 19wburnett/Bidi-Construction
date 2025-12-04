'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { listJobsForUser } from '@/lib/job-access'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  Loader2,
  Check,
  CreditCard,
  ArrowUpRight,
  Activity,
  Bell,
  FilePlus,
  UserPlus,
  LayoutDashboard,
  Search,
  Filter
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { staggerContainer, staggerItem, cardHover, pageVariants, skeletonPulse } from '@/lib/animations'
import { Job } from '@/types/takeoff'
import logo from '../../public/brand/Bidi Contracting Logo.svg'

interface DashboardStats {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  totalPlans: number
  totalBidPackages: number
  totalBids: number
  pendingBids: number
  // Quote stats for subcontractors
  totalQuotes?: number
  pendingQuotes?: number
  processingQuotes?: number
  completedQuotes?: number
}

interface JobWithCounts extends Job {
  plan_count: number
  bid_package_count: number
  bid_count: number
  membership_role: 'owner' | 'collaborator'
  last_viewed_at?: string
}

interface ActivityItem {
  id: string
  type: 'job_created' | 'plan_added' | 'bid_received' | 'package_created'
  title: string
  description: string
  timestamp: string
  link: string
  jobName: string
}

interface ActionableMetrics {
  pendingBidsCount: number
  incompleteJobsCount: number
  draftPackagesCount: number
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('inactive')
  const [checkingSubscription, setCheckingSubscription] = useState(true)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState('')
  
  // Data States
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalPlans: 0,
    totalBidPackages: 0,
    totalBids: 0,
    pendingBids: 0,
    totalQuotes: 0,
    pendingQuotes: 0,
    processingQuotes: 0,
    completedQuotes: 0
  })
  const [userRole, setUserRole] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobWithCounts[]>([])
  const [heroJob, setHeroJob] = useState<JobWithCounts | null>(null)
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [actionableMetrics, setActionableMetrics] = useState<ActionableMetrics>({
    pendingBidsCount: 0,
    incompleteJobsCount: 0,
    draftPackagesCount: 0
  })

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')

  useEffect(() => {
    const status = searchParams.get('status')
    if (status) {
      setStatusFilter(status)
    }
  }, [searchParams])

  const supabase = createClient()

  const getCoverImageUrl = (path: string | null) => {
    if (!path) return null
    const { data } = supabase.storage.from('job-covers').getPublicUrl(path)
    return data.publicUrl
  }

  useEffect(() => {
    if (user) {
      fetchUserSubscription()
      fetchUserRole()
    }
  }, [user])

  const fetchUserRole = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!error && data) {
        setUserRole(data.role)
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  useEffect(() => {
    if (user && subscriptionStatus === 'active' && !checkingSubscription) {
      loadDashboardData()
    } else if (user && subscriptionStatus !== 'active' && !checkingSubscription) {
      setLoading(false)
    }
  }, [user, subscriptionStatus, checkingSubscription])

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
        if (error.code === 'PGRST116' || error.message.includes('subscription_status')) {
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
    } finally {
      setCheckingSubscription(false)
    }
  }

  async function loadDashboardData() {
    try {
      if (!user) {
        return
      }

      const memberships = await listJobsForUser(
        supabase,
        user.id,
        'id, status, created_at, name, location, description, budget_range, cover_image_path'
      )

      const jobsData = memberships.map(({ job, role, last_viewed_at }) => ({
        ...job,
        membership_role: role as 'owner' | 'collaborator',
        last_viewed_at
      }))

      const userJobIds = jobsData.map(job => job.id)

      let plansData: { id: string; job_id: string; created_at: string; file_name: string; title?: string }[] = []
      let packagesData: { id: string; job_id: string; status: string | null; created_at: string; trade_category: string }[] = []

      if (userJobIds.length > 0) {
        const [plansResult, packagesResult] = await Promise.all([
          supabase
            .from('plans')
            .select('id, job_id, created_at, file_name, title')
            .in('job_id', userJobIds)
            .limit(10000),
          supabase
            .from('bid_packages')
            .select('id, job_id, status, created_at, trade_category')
            .in('job_id', userJobIds)
            .limit(10000)
        ])

        if (plansResult.error) throw plansResult.error
        plansData = plansResult.data || []

        if (packagesResult.error) throw packagesResult.error
        packagesData = packagesResult.data || []
      }

      const bidPackageIds = packagesData.map(pkg => pkg.id)
      const jobIds = jobsData.map(job => job.id)
      let bidsData: { id: string; status: string | null; bid_package_id: string | null; job_id: string | null; created_at: string; raw_email: string; subcontractors: any }[] = []
      
      if (bidPackageIds.length > 0) {
        const { data: packageBidsResult, error: packageBidsError } = await supabase
          .from('bids')
          .select('id, status, bid_package_id, job_id, created_at, raw_email, subcontractors(name, email)')
          .in('bid_package_id', bidPackageIds)
          .limit(10000)

        if (packageBidsError) throw packageBidsError
        if (packageBidsResult) bidsData.push(...packageBidsResult)
      }
      
      if (jobIds.length > 0) {
        const { data: directBidsResult, error: directBidsError } = await supabase
          .from('bids')
          .select('id, status, bid_package_id, job_id, created_at, raw_email, subcontractors(name, email)')
          .in('job_id', jobIds)
          .limit(10000)

        if (directBidsError) throw directBidsError
        if (directBidsResult) {
          const existingIds = new Set(bidsData.map(bid => bid.id))
          const newBids = directBidsResult.filter(bid => !existingIds.has(bid.id))
          bidsData.push(...newBids)
        }
      }

      const totalJobs = jobsData.length
      const activeJobs = jobsData.filter(job => ACTIVE_STATUSES.includes(job.status)).length
      const completedJobs = jobsData.filter(job => job.status === 'completed').length
      const totalPlans = plansData.length
      const totalBidPackages = packagesData.length
      const totalBids = bidsData.length
      const pendingBids = bidsData.filter(bid => bid.status === 'pending').length

      const incompleteJobsCount = jobsData.filter(job => 
        plansData.filter(p => p.job_id === job.id).length === 0
      ).length
      const draftPackagesCount = packagesData.filter(p => p.status === 'draft').length

      setActionableMetrics({
        pendingBidsCount: pendingBids,
        incompleteJobsCount,
        draftPackagesCount
      })

      // Load quote stats for subcontractors
      let quoteStats = {
        totalQuotes: 0,
        pendingQuotes: 0,
        processingQuotes: 0,
        completedQuotes: 0
      }

      if (userRole === 'sub') {
        const { data: quotesData, error: quotesError } = await supabase
          .from('quote_requests')
          .select('id, status')
          .eq('user_id', user.id)

        if (!quotesError && quotesData) {
          quoteStats = {
            totalQuotes: quotesData.length,
            pendingQuotes: quotesData.filter(q => q.status === 'pending').length,
            processingQuotes: quotesData.filter(q => q.status === 'processing').length,
            completedQuotes: quotesData.filter(q => q.status === 'completed').length
          }
        }
      }

      setStats({
        totalJobs,
        activeJobs,
        completedJobs,
        totalPlans,
        totalBidPackages,
        totalBids,
        pendingBids,
        ...quoteStats
      })

      // Format all jobs with counts
      const formattedJobs: JobWithCounts[] = jobsData.map((job) => {
        const jobPackages = packagesData.filter(pkg => pkg.job_id === job.id)
        const jobPackageIds = jobPackages.map(pkg => pkg.id)
        const jobBids = bidsData.filter(bid =>
          (bid.bid_package_id && jobPackageIds.includes(bid.bid_package_id)) ||
          (bid.job_id === job.id)
        )

        return {
          ...job,
          plan_count: plansData.filter(plan => plan.job_id === job.id).length,
          bid_package_count: jobPackages.length,
          bid_count: jobBids.length,
          membership_role: job.membership_role as 'owner' | 'collaborator'
        }
      })

      // Sort by last viewed/created
      const sortedJobs = [...formattedJobs].sort((a, b) => {
        const dateA = new Date(a.last_viewed_at || a.created_at).getTime()
        const dateB = new Date(b.last_viewed_at || b.created_at).getTime()
        return dateB - dateA
      })

      setJobs(sortedJobs)
      
      // Set Hero Job (First active job, or first job if none active)
      const firstActive = sortedJobs.find(j => ACTIVE_STATUSES.includes(j.status))
      setHeroJob(firstActive || sortedJobs[0] || null)

      // --- Activity Feed Generation ---
      const activities: ActivityItem[] = []

      jobsData.forEach(job => {
        activities.push({
          id: `job-${job.id}`,
          type: 'job_created',
          title: 'New Job Created',
          description: `Created ${job.name}`,
          timestamp: job.created_at,
          link: `/dashboard/jobs/${job.id}`,
          jobName: job.name
        })
      })

      plansData.forEach(plan => {
        const job = jobsData.find(j => j.id === plan.job_id)
        if (job) {
          activities.push({
            id: `plan-${plan.id}`,
            type: 'plan_added',
            title: 'Plan Uploaded',
            description: `Added ${plan.title || plan.file_name || 'a plan'}`,
            timestamp: plan.created_at,
            link: `/dashboard/jobs/${job.id}/plans/${plan.id}`,
            jobName: job.name
          })
        }
      })

      bidsData.forEach(bid => {
        const pkg = packagesData.find(p => p.id === bid.bid_package_id)
        if (pkg) {
          const job = jobsData.find(j => j.id === pkg.job_id)
          if (job) {
            const sub = Array.isArray(bid.subcontractors) ? bid.subcontractors[0] : bid.subcontractors
            activities.push({
              id: `bid-${bid.id}`,
              type: 'bid_received',
              title: 'Bid Received',
              description: `From ${sub?.name || sub?.email || bid.raw_email || 'Subcontractor'}`,
              timestamp: bid.created_at,
              link: `/dashboard/jobs/${job.id}`,
              jobName: job.name
            })
          }
        }
      })

      packagesData.forEach(pkg => {
        const job = jobsData.find(j => j.id === pkg.job_id)
        if (job) {
          activities.push({
            id: `pkg-${pkg.id}`,
            type: 'package_created',
            title: 'Bid Package Created',
            description: `${pkg.trade_category || 'New Package'}`,
            timestamp: pkg.created_at,
            link: `/dashboard/jobs/${job.id}`,
            jobName: job.name
          })
        }
      })

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setActivityFeed(activities.slice(0, 10))

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    if (!user) return

    setSubscriptionLoading(true)
    setSubscriptionError('')

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      })

      const { url, error: stripeError } = await response.json()

      if (stripeError) {
        setSubscriptionError(stripeError)
      } else if (url) {
        window.location.href = url
      }
    } catch (err) {
      setSubscriptionError('Failed to create checkout session')
    } finally {
      setSubscriptionLoading(false)
    }
  }

    
    
  const ACTIVE_STATUSES = ['active', 'needs_takeoff', 'needs_packages', 'waiting_for_bids']

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'needs_takeoff': return 'bg-orange-100 text-orange-800'
      case 'needs_packages': return 'bg-blue-100 text-blue-800'
      case 'waiting_for_bids': return 'bg-purple-100 text-purple-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-gray-100 text-gray-600'
      case 'active': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'needs_takeoff': return 'Needs Takeoff'
      case 'needs_packages': return 'Need Packages'
      case 'waiting_for_bids': return 'Waiting for Bids'
      default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
    }
  }

  const getNextAction = (job: JobWithCounts) => {
    switch (job.status) {
      case 'draft':
        return { label: 'Complete Details', href: `/dashboard/jobs/${job.id}/edit`, variant: 'default' as const }
      case 'needs_takeoff':
        return { label: 'Start Takeoff', href: `/dashboard/jobs/${job.id}/plans`, variant: 'default' as const }
      case 'needs_packages':
        return { label: 'Create Packages', href: `/dashboard/jobs/${job.id}`, variant: 'default' as const }
      case 'waiting_for_bids':
        if (job.bid_count > 0) {
          return { label: 'Review Bids', href: `/dashboard/jobs/${job.id}`, variant: 'default' as const }
        }
        return { label: 'Invite Subs', href: `/dashboard/jobs/${job.id}`, variant: 'outline' as const }
      case 'active':
        return { label: 'View Dashboard', href: `/dashboard/jobs/${job.id}`, variant: 'outline' as const }
      default:
        return { label: 'View Job', href: `/dashboard/jobs/${job.id}`, variant: 'outline' as const }
    }
  }

  // Filter and sort jobs
  const filteredJobs = jobs
    .filter(job => {
      const matchesSearch = 
        job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.location && job.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'location':
          return (a.location || '').localeCompare(b.location || '')
        case 'status':
          return a.status.localeCompare(b.status)
        case 'recent':
        default:
          const dateA = new Date(a.last_viewed_at || a.created_at).getTime()
          const dateB = new Date(b.last_viewed_at || b.created_at).getTime()
          return dateB - dateA
      }
    })


  // Show loading while checking subscription
  if (checkingSubscription || (loading && subscriptionStatus === 'active')) {
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

  // Show paywall if subscription is not active
  if (subscriptionStatus !== 'active') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-black dark:to-orange-950/30 flex items-center justify-center p-4 transition-colors duration-300">
        <Card className="w-full max-w-2xl border-2 dark:border-gray-700">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="relative">
                <img src={logo.src} alt="Bidi" className="h-10 w-10 sm:h-12 sm:w-12 transition-transform duration-300" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange rounded-full animate-pulse"></div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight font-bidi">BIDI</h1>
              <span className="bg-orange-100 text-orange-800 text-xs font-semibold px-2 py-1 rounded-full border border-orange-200 dark:bg-orange/20 dark:text-orange-300 dark:border-orange/20">
                BETA
              </span>
            </div>
            <CardTitle className="text-2xl sm:text-3xl dark:text-white">Subscribe to Bidi</CardTitle>
            <CardDescription className="text-base sm:text-lg dark:text-gray-300">
              AI-Powered Estimating & Takeoff for General Contractors
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Plan Selection */}
            <div className="flex justify-center">
              {/* Monthly Subscription Option */}
              <div className="border-2 border-orange rounded-lg p-6 w-full max-w-lg bg-orange-50 dark:bg-orange-950/30 shadow-lg">
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-2">
                    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Monthly Subscription</h3>
                  <div className="text-3xl font-bold text-orange mb-2">$300<span className="text-base text-gray-600 dark:text-gray-400">/month</span></div>
                  <p className="text-gray-600 dark:text-gray-300">Complete AI-powered estimating solution</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Automated plan analysis & takeoff</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">AI-powered cost estimating</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Automatic subcontractor outreach</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Complete bid collection & leveling</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Priority support & training</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="w-4 h-4 mx-auto rounded-full border-2 border-orange bg-orange"></div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="text-center">
              {subscriptionError && (
                <div className="text-red-600 text-sm mb-4">{subscriptionError}</div>
              )}

              <Button 
                onClick={handleSubscribe} 
                className="w-full md:w-auto px-8" 
                size="lg"
                disabled={subscriptionLoading}
              >
                <CreditCard className="h-5 w-5 mr-2" />
                {subscriptionLoading ? 'Processing...' : 'Subscribe with Stripe'}
              </Button>
            </div>

            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              <p>Cancel anytime. Secure payment processing by Stripe.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
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
          className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {getGreeting()}, {user?.email?.split('@')[0] || 'Builder'}
            </h1>
            <p className="text-gray-600">Here's what's happening with your projects today.</p>
          </div>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button className="bg-orange hover:bg-orange/90 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="flex flex-col space-y-1">
                  <Link href="/dashboard/jobs/new">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <Plus className="h-4 w-4 mr-2 text-orange" />
                      Create Job
                    </Button>
                  </Link>
                  <Link href="/dashboard/plans/new">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <FilePlus className="h-4 w-4 mr-2 text-blue-500" />
                      Upload Plan
                    </Button>
                  </Link>
                  <Link href="/dashboard/contacts">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <UserPlus className="h-4 w-4 mr-2 text-green-500" />
                      Add Contact
                    </Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column (Left - 2/3) */}
          <motion.div 
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="lg:col-span-2 space-y-8"
          >
            
            {/* 1. Hero Card - Resume Work */}
            {heroJob ? (
              <motion.div variants={staggerItem}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <LayoutDashboard className="h-5 w-5 mr-2 text-orange" />
                    Resume Work
                  </h2>
                </div>
                <Card className="border-l-4 border-l-orange overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-start gap-4">
                          {/* Hero Job Cover Image */}
                          <div className="flex-shrink-0">
                            {heroJob.cover_image_path ? (
                              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                                <Image
                                  src={getCoverImageUrl(heroJob.cover_image_path) || ''}
                                  alt={heroJob.name}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center border-2 border-orange-200">
                                <Building2 className="h-8 w-8 text-orange-500" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-2xl font-bold text-gray-900">{heroJob.name}</h3>
                              <Badge className={getStatusColor(heroJob.status)}>{formatStatus(heroJob.status)}</Badge>
                            </div>
                            <div className="flex items-center text-gray-500 text-sm">
                              <MapPin className="h-4 w-4 mr-1" />
                              {heroJob.location}
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 py-4 border-y border-gray-100">
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Plans</p>
                            <p className="text-xl font-bold text-gray-900">{heroJob.plan_count}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Packages</p>
                            <p className="text-xl font-bold text-gray-900">{heroJob.bid_package_count}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Bids</p>
                            <p className="text-xl font-bold text-gray-900">{heroJob.bid_count}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Link href={`/dashboard/jobs/${heroJob.id}`}>
                            <Button size="sm">
                              Open Dashboard
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </Link>
                          <Link href={`/dashboard/jobs/${heroJob.id}/plans`}>
                            <Button variant="outline" size="sm">
                              View Plans
                            </Button>
                          </Link>
                        </div>
                      </div>
                      
                      <div className="md:w-1/3 bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-col justify-center items-center text-center">
                         <Clock className="h-8 w-8 text-gray-400 mb-2" />
                         <p className="text-sm text-gray-600 mb-1">Last Updated</p>
                         <p className="text-sm font-medium text-gray-900">
                           {new Date(heroJob.created_at).toLocaleDateString()}
                         </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div variants={staggerItem}>
                <Card className="bg-gray-50 border-dashed">
                  <CardContent className="p-8 text-center">
                     <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                     <h3 className="text-lg font-semibold text-gray-900">No Active Jobs</h3>
                     <p className="text-gray-500 mb-6">Get started by creating your first project.</p>
                     <Link href="/dashboard/jobs/new">
                      <Button>Create New Job</Button>
                     </Link>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 2. Action Center - Needs Attention */}
            <motion.div variants={staggerItem}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 text-orange" />
                Needs Attention
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/dashboard?status=waiting_for_bids">
                  <Card className="bg-white border-orange/20 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-orange-600">{actionableMetrics.pendingBidsCount}</p>
                        <p className="text-sm font-medium text-gray-600">Pending Bids</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-orange-600" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/dashboard?status=needs_takeoff">
                   <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{actionableMetrics.incompleteJobsCount}</p>
                        <p className="text-sm font-medium text-gray-600">Jobs w/o Plans</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-gray-600" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/dashboard?status=needs_packages">
                  <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{actionableMetrics.draftPackagesCount}</p>
                        <p className="text-sm font-medium text-gray-600">Draft Packages</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Package className="h-5 w-5 text-gray-600" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </motion.div>

            {/* Quote Stats for Subcontractors */}
            {userRole === 'sub' && (
              <motion.div variants={staggerItem}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-orange" />
                  Quote Requests
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                  <Link href="/dashboard/quotes">
                    <Card className="bg-white border-orange/20 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-orange-600">{stats.totalQuotes || 0}</p>
                          <p className="text-sm font-medium text-gray-600">Total Quotes</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-orange-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/dashboard/quotes?status=pending">
                    <Card className="bg-white border-yellow-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-yellow-600">{stats.pendingQuotes || 0}</p>
                          <p className="text-sm font-medium text-gray-600">Pending</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-yellow-50 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-yellow-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/dashboard/quotes?status=processing">
                    <Card className="bg-white border-blue-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{stats.processingQuotes || 0}</p>
                          <p className="text-sm font-medium text-gray-600">Processing</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link href="/dashboard/quotes?status=completed">
                    <Card className="bg-white border-green-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-green-600">{stats.completedQuotes || 0}</p>
                          <p className="text-sm font-medium text-gray-600">Completed</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
                <div className="mb-6">
                  <Link href="/dashboard/quotes/new">
                    <Button className="bg-orange-500 hover:bg-orange-600">
                      <Plus className="h-4 w-4 mr-2" />
                      New Quote Request
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}

            {/* 3. All Jobs with Search/Filters */}
            {userRole !== 'sub' && (
              <motion.div variants={staggerItem}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Building2 className="h-5 w-5 mr-2 text-orange" />
                    All Jobs
                    <Badge variant="secondary" className="ml-2">{stats.totalJobs}</Badge>
                  </h2>
                </div>

              {/* Search and Filters */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex flex-col space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search jobs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Sort by" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recent">Recent</SelectItem>
                            <SelectItem value="name">Name A-Z</SelectItem>
                            <SelectItem value="location">Location</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                      <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 border-b h-auto rounded-none">
                        <TabsTrigger 
                          value="all" 
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-orange data-[state=active]:text-orange-600 rounded-none px-4 py-2"
                        >
                          All Jobs
                        </TabsTrigger>
                        <TabsTrigger 
                          value="active" 
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-orange data-[state=active]:text-orange-600 rounded-none px-4 py-2"
                        >
                          Active
                        </TabsTrigger>
                         <TabsTrigger 
                          value="waiting_for_bids" 
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-orange data-[state=active]:text-orange-600 rounded-none px-4 py-2"
                        >
                          Bidding
                        </TabsTrigger>
                        <TabsTrigger 
                          value="draft" 
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-orange data-[state=active]:text-orange-600 rounded-none px-4 py-2"
                        >
                          Drafts
                        </TabsTrigger>
                        <TabsTrigger 
                          value="completed" 
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-orange data-[state=active]:text-orange-600 rounded-none px-4 py-2"
                        >
                          Completed
                        </TabsTrigger>
                         <TabsTrigger 
                          value="archived" 
                          className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-orange data-[state=active]:text-orange-600 rounded-none px-4 py-2"
                        >
                          Archived
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>

              {/* Jobs Grid */}
              <AnimatePresence mode="wait">
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
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {filteredJobs.map((job) => (
                      <motion.div
                        key={job.id}
                        variants={staggerItem}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <Link href={`/dashboard/jobs/${job.id}`}>
                          <Card className="cursor-pointer h-full hover:border-orange-300 transition-colors group">
                            <CardHeader className="pb-3">
                              <div className="flex items-start gap-3">
                                {/* Job Cover Image Thumbnail */}
                                <div className="flex-shrink-0">
                                  {job.cover_image_path ? (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200">
                                      <Image
                                        src={getCoverImageUrl(job.cover_image_path) || ''}
                                        alt={job.name}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                                      <Building2 className="h-6 w-6 text-orange-500" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-base mb-1 truncate">{job.name}</CardTitle>
                                      {job.location && (
                                        <CardDescription className="flex items-center text-sm">
                                          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                          <span className="truncate">{job.location}</span>
                                        </CardDescription>
                                      )}
                                    </div>
                                    <Badge className={`${getStatusColor(job.status)} ml-2 flex-shrink-0`}>
                                      {formatStatus(job.status)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
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
                                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-orange transition-colors" />
                              </div>
                              
                              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Next Step</span>
                                {(() => {
                                  const action = getNextAction(job)
                                  return (
                                    <Badge 
                                      variant="outline" 
                                      className={`
                                        bg-gray-50 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 transition-colors
                                        ${action.variant === 'default' ? 'text-orange-700 border-orange-200 bg-orange-50' : 'text-gray-600'}
                                      `}
                                    >
                                      {action.label}
                                    </Badge>
                                  )
                                })()}
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
            )}

          </motion.div>

          {/* Side Column (Right - 1/3) */}
          <motion.div 
             variants={staggerContainer}
             initial="initial"
             animate="animate"
             className="space-y-8"
          >
            
            {/* 4. Activity Feed */}
            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <Activity className="h-5 w-5 mr-2 text-orange" />
                    Activity Feed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {activityFeed.length === 0 ? (
                       <p className="text-sm text-gray-500 text-center py-4">No recent activity.</p>
                    ) : (
                      activityFeed.map((item) => (
                        <Link href={item.link} key={item.id} className="block group">
                          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                             <div className="mt-1 h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 group-hover:bg-white group-hover:border group-hover:border-orange-200 transition-all">
                                {item.type === 'job_created' && <Building2 className="h-4 w-4 text-orange-600" />}
                                {item.type === 'plan_added' && <FilePlus className="h-4 w-4 text-blue-600" />}
                                {item.type === 'bid_received' && <DollarSign className="h-4 w-4 text-green-600" />}
                                {item.type === 'package_created' && <Package className="h-4 w-4 text-purple-600" />}
                             </div>
                             <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between mb-0.5">
                                  <p className="text-sm font-medium text-gray-900 truncate pr-2">{item.title}</p>
                                  <span className="text-xs text-gray-400 whitespace-nowrap">
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-1 mb-1">{item.description}</p>
                                <div className="flex items-center text-xs text-gray-400">
                                  <span className="truncate max-w-[150px]">{item.jobName}</span>
                                </div>
                             </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions (Sidebar) */}
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                   <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                   <Link href="/dashboard/jobs/new">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <Plus className="h-4 w-4 mr-2" /> Create New Job
                    </Button>
                   </Link>
                   <Link href="/dashboard/contacts">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <UserPlus className="h-4 w-4 mr-2" /> Manage Contacts
                    </Button>
                   </Link>
                   <Link href="/dashboard/settings">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <Eye className="h-4 w-4 mr-2" /> Settings
                    </Button>
                   </Link>
                </CardContent>
              </Card>
            </motion.div>

          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
