'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Building2, 
  Upload, 
  ArrowLeft, 
  Plus,
  FileText,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Edit,
  Eye,
  Download,
  Trash2,
  Package,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { staggerContainer, staggerItem, cardHover, skeletonPulse } from '@/lib/animations'
import { Job, Plan, BidPackage } from '@/types/takeoff'

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [bidPackages, setBidPackages] = useState<BidPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const jobId = params.jobId as string

  useEffect(() => {
    if (user && jobId) {
      loadJobData()
    }
  }, [user, jobId])

  async function loadJobData() {
    try {
      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user?.id)
        .single()

      if (jobError) throw jobError
      setJob(jobData)

      // Load plans for this job
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (plansError) throw plansError
      setPlans(plansData || [])

      // Load bid packages for this job
      const { data: packagesData, error: packagesError } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (packagesError) throw packagesError
      setBidPackages(packagesData || [])

    } catch (error) {
      console.error('Error loading job data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-trigger ingestion after upload (same pattern as plans/new page)
    const files = Array.from(e.target.files || [])
    if (!files.length || !job) return

    setUploading(true)
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `job-plans/${user?.id}/${jobId}/${fileName}`

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('job-plans')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('job-plans')
          .getPublicUrl(filePath)

        // Create plan record
        // Store both public URL and storage path for ingestion
        const { data: newPlan, error: insertError } = await supabase
          .from('plans')
          .insert({
            user_id: user?.id,
            job_id: jobId,
            title: file.name.split('.')[0],
            file_name: file.name,
            file_path: filePath, // Store storage path, not public URL (ingestion needs this)
            file_size: file.size,
            file_type: file.type,
            status: 'ready',
            num_pages: 1 // Will be updated after PDF processing
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Auto-trigger ingestion in the background (don't wait)
        if (newPlan) {
          console.log(`Auto-triggering ingestion for plan ${newPlan.id}`)
          fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planId: newPlan.id,
              jobId: jobId,
              options: {
                enable_image_extraction: true,
                image_dpi: 300
              }
            })
          }).catch(err => {
            console.error('Background ingestion trigger failed:', err)
            // Don't block the user - ingestion can be retried later
          })
        }
      }

      // Reload plans
      await loadJobData()
    } catch (error) {
      console.error('Error uploading files:', error)
    } finally {
      setUploading(false)
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
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <motion.div
            variants={skeletonPulse}
            animate="animate"
            className="space-y-6"
          >
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Not Found</h2>
          <p className="text-gray-600 mb-4">This job doesn't exist or you don't have access to it.</p>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{job.name}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  {job.location}
                </div>
                {job.budget_range && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {job.budget_range}
                  </div>
                )}
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(job.status)}>
                {job.status}
              </Badge>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-8"
        >
          {/* Job Overview */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="h-5 w-5 mr-2 text-orange-600" />
                  Project Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {job.description ? (
                  <p className="text-gray-700">{job.description}</p>
                ) : (
                  <p className="text-gray-500 italic">No description provided</p>
                )}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{plans.length}</div>
                    <div className="text-sm text-gray-600">Plans</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{bidPackages.length}</div>
                    <div className="text-sm text-gray-600">Bid Packages</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">0</div>
                    <div className="text-sm text-gray-600">Bids Received</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Plans Section */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-orange-600" />
                      Project Plans
                    </CardTitle>
                    <CardDescription>
                      Upload and manage your construction plans
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      id="plan-upload"
                      multiple
                      accept=".pdf,.dwg,.jpg,.jpeg,.png,.tiff"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <label htmlFor="plan-upload">
                      <Button asChild disabled={uploading}>
                        <span>
                          {uploading ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Plans
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AnimatePresence>
                  {plans.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No plans uploaded yet</h3>
                      <p className="text-gray-600 mb-4">Upload your first plan to get started with analysis and bidding</p>
                      <label htmlFor="plan-upload">
                        <Button asChild>
                          <span>
                            <Plus className="h-4 w-4 mr-2" />
                            Upload Your First Plan
                          </span>
                        </Button>
                      </label>
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                      {plans.map((plan) => (
                        <motion.div
                          key={plan.id}
                          variants={staggerItem}
                          whileHover="hover"
                          whileTap="tap"
                        >
                          <Card className="cursor-pointer">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2 min-w-0 flex-1">
                                  <FileText className="h-5 w-5 text-orange-600 flex-shrink-0" />
                                  <span className="font-medium text-sm truncate min-w-0">
                                    {plan.title || plan.file_name}
                                  </span>
                                </div>
                                <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">
                                  {plan.status}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex space-x-1">
                                  <Link href={`/dashboard/jobs/${jobId}/plans/${plan.id}`}>
                                    <Button variant="ghost" size="sm">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                  <Button variant="ghost" size="sm">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {plan.num_pages} page{plan.num_pages !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Bid Packages Section */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <Package className="h-5 w-5 mr-2 text-orange-600" />
                      Bid Packages
                    </CardTitle>
                    <CardDescription>
                      Create and manage bid requests for different trades
                    </CardDescription>
                  </div>
                  {plans.length > 0 && (
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Package
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <AnimatePresence>
                  {bidPackages.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No bid packages yet</h3>
                      <p className="text-gray-600 mb-4">
                        {plans.length === 0 
                          ? "Upload plans first, then create bid packages to send to subcontractors"
                          : "Create your first bid package to start collecting bids"
                        }
                      </p>
                      {plans.length > 0 && (
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Package
                        </Button>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-4"
                    >
                      {bidPackages.map((pkg) => (
                        <motion.div
                          key={pkg.id}
                          variants={staggerItem}
                          whileHover="hover"
                          whileTap="tap"
                        >
                          <Card className="cursor-pointer">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-semibold">{pkg.trade_category}</h4>
                                  <p className="text-sm text-gray-600">{pkg.description}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge className={getStatusColor(pkg.status)}>
                                    {pkg.status}
                                  </Badge>
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Bids Section */}
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-orange-600" />
                  Received Bids
                </CardTitle>
                <CardDescription>
                  View and manage bids from subcontractors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No bids received yet</h3>
                  <p className="text-gray-600">Bids will appear here once you send out bid packages</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
