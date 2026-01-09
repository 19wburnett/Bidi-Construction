'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { 
  FileText,
  Download,
  Eye,
  AlertCircle,
  Loader2,
  Building2,
  MapPin,
  Calendar
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import JobTimeline from '@/components/job-timeline'

interface Plan {
  id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  num_pages?: number
  created_at: string
}

interface Job {
  id: string
  name: string
  location: string
  description?: string
  budget_range?: string
}

export default function GuestJobPlansViewer() {
  const params = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingPlanId, setDownloadingPlanId] = useState<string | null>(null)
  
  const supabase = createClient()
  const shareToken = params.token as string

  useEffect(() => {
    if (shareToken) {
      loadJobData()
    }
  }, [shareToken])

  async function loadJobData() {
    try {
      setLoading(true)
      setError('')

      // Load share details
      const { data: shareData, error: shareError } = await supabase
        .from('job_shares')
        .select('*')
        .eq('share_token', shareToken)
        .single()

      if (shareError) throw shareError

      if (!shareData) {
        throw new Error('Invalid share link')
      }

      // Check if share is expired
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        throw new Error('This share link has expired')
      }

      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', shareData.job_id)
        .single()

      if (jobError) throw jobError
      setJob(jobData)

      // Load all plans for this job
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .eq('job_id', shareData.job_id)
        .order('created_at', { ascending: false })

      if (plansError) throw plansError
      setPlans(plansData || [])

      // Update access count
      await supabase
        .from('job_shares')
        .update({ 
          accessed_count: (shareData.accessed_count || 0) + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', shareData.id)

    } catch (err: any) {
      setError(err.message || 'Failed to load job plans')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPlan = async (plan: Plan) => {
    try {
      setDownloadingPlanId(plan.id)
      
      // Get signed URL for plan file
      let downloadUrl = plan.file_path
      
      if (!downloadUrl.startsWith('http')) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from('job-plans')
          .createSignedUrl(plan.file_path, 3600) // 1 hour

        if (urlError) throw urlError
        if (urlData) {
          downloadUrl = urlData.signedUrl
        }
      }

      // Create temporary link and trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = plan.file_name || 'plan.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (err: any) {
      console.error('Error downloading plan:', err)
      setError('Failed to download plan')
    } finally {
      setDownloadingPlanId(null)
    }
  }

  const handleViewPlan = async (plan: Plan) => {
    try {
      // Get signed URL for plan file
      let viewUrl = plan.file_path
      
      if (!viewUrl.startsWith('http')) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from('job-plans')
          .createSignedUrl(plan.file_path, 3600) // 1 hour

        if (urlError) throw urlError
        if (urlData) {
          viewUrl = urlData.signedUrl
        }
      }

      // Open in new tab
      window.open(viewUrl, '_blank')
      
    } catch (err: any) {
      console.error('Error viewing plan:', err)
      setError('Failed to open plan')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-gray-600">Loading project plans...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-6 w-6 text-orange-600" />
                    <CardTitle className="text-2xl">{job?.name}</CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-700">
                    {job?.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{job.location}</span>
                      </div>
                    )}
                    {job?.budget_range && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Budget:</span>
                        <span>{job.budget_range}</span>
                      </div>
                    )}
                  </div>
                  {job?.description && (
                    <p className="mt-3 text-gray-700">{job.description}</p>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Plans List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Project Plans ({plans.length})
            </h2>
          </div>

          {plans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No plans available for this project.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">
                            {plan.file_name}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            <span className="inline-flex items-center gap-2 text-xs">
                              {plan.num_pages && (
                                <span>{plan.num_pages} page{plan.num_pages !== 1 ? 's' : ''}</span>
                              )}
                              {plan.file_size && (
                                <>
                                  <span>•</span>
                                  <span>{(plan.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                </>
                              )}
                            </span>
                            <br />
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {new Date(plan.created_at).toLocaleDateString()}
                              </span>
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPlan(plan)}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleDownloadPlan(plan)}
                          disabled={downloadingPlanId === plan.id}
                          className="flex-1 bg-orange-600 hover:bg-orange-700"
                        >
                          {downloadingPlanId === plan.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Project Timeline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <JobTimeline 
            jobId={job?.id || ''} 
            canEdit={false}
            shareToken={shareToken}
          />
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center text-sm text-gray-500"
        >
          <p>Shared via Bidi Construction Management</p>
        </motion.div>
      </div>
    </div>
  )
}

