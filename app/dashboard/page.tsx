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
  Loader2,
  Check,
  CreditCard,
  ArrowUpRight,
  Activity,
  Bell,
  FilePlus,
  UserPlus,
  LayoutDashboard
} from 'lucide-react'
import Link from 'next/link'
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
  incompleteJobsCount: number // Jobs with 0 plans
  draftPackagesCount: number
}

export default function DashboardPage() {
  const router = useRouter()
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
    pendingBids: 0
  })
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [heroJob, setHeroJob] = useState<RecentJob | null>(null)
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
  const [actionableMetrics, setActionableMetrics] = useState<ActionableMetrics>({
    pendingBidsCount: 0,
    incompleteJobsCount: 0,
    draftPackagesCount: 0
  })

  const supabase = createClient()

  useEffect(() => {
    if (user) {
      fetchUserSubscription()
    }
  }, [user])

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
        'id, status, created_at, name, location'
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
      
      // Fetch bids linked through bid packages
      if (bidPackageIds.length > 0) {
        const { data: packageBidsResult, error: packageBidsError } = await supabase
          .from('bids')
          .select('id, status, bid_package_id, job_id, created_at, raw_email, subcontractors(name, email)')
          .in('bid_package_id', bidPackageIds)
          .limit(10000)

        if (packageBidsError) throw packageBidsError
        if (packageBidsResult) bidsData.push(...packageBidsResult)
      }
      
      // Fetch bids directly linked to jobs via job_id
      if (jobIds.length > 0) {
        const { data: directBidsResult, error: directBidsError } = await supabase
          .from('bids')
          .select('id, status, bid_package_id, job_id, created_at, raw_email, subcontractors(name, email)')
          .in('job_id', jobIds)
          .limit(10000)

        if (directBidsError) throw directBidsError
        if (directBidsResult) {
          // Merge with existing bids, avoiding duplicates
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

      // Actionable Metrics
      const incompleteJobsCount = jobsData.filter(job => 
        plansData.filter(p => p.job_id === job.id).length === 0
      ).length
      const draftPackagesCount = packagesData.filter(p => p.status === 'draft').length

      setActionableMetrics({
        pendingBidsCount: pendingBids,
        incompleteJobsCount,
        draftPackagesCount
      })

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
        (a, b) => {
          const dateA = new Date(a.last_viewed_at || a.created_at).getTime()
          const dateB = new Date(b.last_viewed_at || b.created_at).getTime()
          return dateB - dateA
        }
      )

      const formattedRecentJobs = recentJobsSorted.map((job) => {
        const jobPackages = packagesData.filter(pkg => pkg.job_id === job.id)
        const jobPackageIds = jobPackages.map(pkg => pkg.id)
        // Count bids linked through packages OR directly via job_id
        const jobBids = bidsData.filter(bid =>
          (bid.bid_package_id && jobPackageIds.includes(bid.bid_package_id)) ||
          (bid.job_id === job.id)
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

      setRecentJobs(formattedRecentJobs.slice(0, 5))
      
      // Set Hero Job (First active job, or first job if none active)
      const firstActive = formattedRecentJobs.find(j => ACTIVE_STATUSES.includes(j.status))
      setHeroJob(firstActive || formattedRecentJobs[0] || null)

      // --- Activity Feed Generation ---
      const activities: ActivityItem[] = []

      // 1. New Jobs
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

      // 2. Plans Added
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

      // 3. Bids Received
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

      // 4. Packages Created
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

      // Sort and Slice
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
      // Create Stripe checkout session for subscription
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
        // Redirect to Stripe checkout
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
      case 'active': return 'bg-green-100 text-green-800' // Legacy
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
             <Link href="/dashboard/jobs/new">
              <Button className="bg-orange hover:bg-orange/90 text-white">
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            </Link>
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
                <Card className="bg-white border-orange/20 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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

                 <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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

                <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
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
              </div>
            </motion.div>

            {/* 3. Recent Jobs List */}
             <motion.div variants={staggerItem}>
                <div className="flex items-center justify-between mb-4">
                   <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
                   <Link href="/dashboard/jobs" className="text-sm text-orange hover:underline flex items-center">
                     View All <ArrowRight className="h-3 w-3 ml-1" />
                   </Link>
                </div>
                <div className="space-y-3">
                  {recentJobs.slice(0, 3).map((job) => (
                    <Link href={`/dashboard/jobs/${job.id}`} key={job.id}>
                      <Card className="hover:border-orange-300 transition-colors cursor-pointer group">
                        <CardContent className="p-4 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                                <Building2 className="h-5 w-5 text-gray-500 group-hover:text-orange transition-colors" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{job.name}</h4>
                                <p className="text-sm text-gray-500">{job.location}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-gray-900">{job.bid_count} Bids</p>
                                <p className="text-xs text-gray-500">{formatStatus(job.status)}</p>
                              </div>
                              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-orange transition-colors" />
                           </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
             </motion.div>

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
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent max-h-[400px] overflow-y-auto pr-2">
                    {activityFeed.length === 0 ? (
                       <p className="text-sm text-gray-500 text-center py-4">No recent activity.</p>
                    ) : (
                      activityFeed.map((item) => (
                        <div key={item.id} className="relative flex items-start group">
                           <div className="absolute left-0 h-5 w-5 rounded-full bg-white border-2 border-orange flex items-center justify-center z-10">
                              <div className="h-2 w-2 rounded-full bg-orange" />
                           </div>
                           <div className="pl-8 w-full">
                              <p className="text-xs text-gray-500 mb-0.5">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <Link href={item.link} className="block group-hover:bg-gray-50 p-2 -ml-2 rounded transition-colors">
                                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                                <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                                <p className="text-xs text-gray-400 mt-1">{item.jobName}</p>
                              </Link>
                           </div>
                        </div>
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
                   <Link href="/dashboard/jobs">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <Eye className="h-4 w-4 mr-2" /> View All Jobs
                    </Button>
                   </Link>
                   <Link href="/dashboard/contacts">
                    <Button variant="ghost" className="w-full justify-start" size="sm">
                      <UserPlus className="h-4 w-4 mr-2" /> Manage Contacts
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