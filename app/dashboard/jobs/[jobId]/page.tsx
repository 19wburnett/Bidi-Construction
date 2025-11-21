'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  AlertCircle,
  BarChart3,
  Bell,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { staggerContainer, staggerItem, cardHover, skeletonPulse } from '@/lib/animations'
import { Job, Plan, BidPackage } from '@/types/takeoff'
import { getJobForUser } from '@/lib/job-access'
import BidComparisonModal from '@/components/bid-comparison-modal'
import BidPackageModal from '@/components/bid-package-modal'
import BidPackageViewModal from '@/components/bid-package-view-modal'
import TakeoffSpreadsheet from '@/components/takeoff-spreadsheet'

const PROJECT_TYPES = [
  'Residential',
  'Commercial',
  'Industrial',
  'Renovation',
  'New Construction',
  'Other'
]

const JOB_STATUSES: Job['status'][] = ['draft', 'active', 'completed', 'archived']

type EditFormState = {
  name: string
  location: string
  budget_range: string
  project_type: string
  description: string
  status: Job['status']
}

type Activity = {
  id: string
  type: 'plan' | 'takeoff' | 'bid' | 'package'
  message: string
  date: string
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [jobRole, setJobRole] = useState<'owner' | 'collaborator' | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [bidPackages, setBidPackages] = useState<BidPackage[]>([])
  const [bids, setBids] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [showBidsModal, setShowBidsModal] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showPackageViewModal, setShowPackageViewModal] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [takeoffItems, setTakeoffItems] = useState<any[]>([])
  const [aggregatedTakeoffItems, setAggregatedTakeoffItems] = useState<any[]>([])
  const [takeoffAnalysisMap, setTakeoffAnalysisMap] = useState<Record<string, string>>({}) // plan_id -> analysis_id
  const [loadingTakeoff, setLoadingTakeoff] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const isSavingTakeoffRef = useRef(false)
  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    location: '',
    budget_range: '',
    project_type: '',
    description: '',
    status: 'draft'
  })
  const supabase = createClient()

  const jobId = params.jobId as string

  useEffect(() => {
    if (user && jobId) {
      loadJobData()
    }
  }, [user, jobId])

  async function loadJobData() {
    try {
      if (!user) {
        return
      }

      // Load job details via membership
      const membership = await getJobForUser(supabase, jobId, user.id, '*')

      if (!membership?.job) {
        setJob(null)
        setJobRole(null)
        return
      }

      setJob(membership.job)
      setJobRole(membership.role)

      // Load plans for this job with takeoff analysis status
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select(`
          *,
          plan_takeoff_analysis (
            id,
            created_at,
            updated_at,
            status,
            is_finalized
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (plansError) throw plansError
      
      // Enrich plans with takeoff status from plan_takeoff_analysis
      const enrichedPlans = (plansData || []).map((plan: any) => {
        const takeoffAnalyses = plan.plan_takeoff_analysis || []
        const hasTakeoffAnalysis = takeoffAnalyses.length > 0
        const latestTakeoff = takeoffAnalyses.length > 0 
          ? takeoffAnalyses.sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]
          : null
        
        return {
          ...plan,
          plan_takeoff_analysis: undefined, // Remove nested data
          has_takeoff_analysis: hasTakeoffAnalysis || plan.has_takeoff_analysis,
          takeoff_analysis_status: latestTakeoff?.status || plan.takeoff_analysis_status || (hasTakeoffAnalysis ? 'completed' : null),
          latest_takeoff_analysis: latestTakeoff
        }
      })
      
      setPlans(enrichedPlans)

      // Load bid packages for this job
      const { data: packagesData, error: packagesError } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (packagesError) throw packagesError
      setBidPackages(packagesData || [])

      // Load bids for this job with bid package info
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('*, subcontractors (id, name, email), bid_packages (id, trade_category, description, minimum_line_items, status)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (bidsError) throw bidsError
      setBids(bidsData || [])

      // Load takeoff items from all plans
      await loadAggregatedTakeoffItems(plansData || [])

    } catch (error) {
      console.error('Error loading job data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadAggregatedTakeoffItems(plansList: Plan[]) {
    if (!user) return
    
    setLoadingTakeoff(true)
    try {
      const allItems: any[] = []
      const analysisMap: Record<string, string> = {}

      // Load takeoff analysis for each plan
      for (const plan of plansList) {
        const hasTakeoff = plan.takeoff_analysis_status === 'completed' || plan.has_takeoff_analysis === true
        if (!hasTakeoff) continue

        const { data: takeoffAnalysis, error: takeoffError } = await supabase
          .from('plan_takeoff_analysis')
          .select('id, items')
          .eq('plan_id', plan.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (takeoffError || !takeoffAnalysis) continue

        analysisMap[plan.id] = takeoffAnalysis.id

        // Parse takeoff items
        let itemsArray: any[] = []
        try {
          if (typeof takeoffAnalysis.items === 'string') {
            const parsed = JSON.parse(takeoffAnalysis.items)
            itemsArray = parsed.takeoffs || parsed.items || (Array.isArray(parsed) ? parsed : [])
          } else if (Array.isArray(takeoffAnalysis.items)) {
            itemsArray = takeoffAnalysis.items
          }
        } catch (parseError) {
          console.error('Error parsing takeoff items for plan', plan.id, parseError)
          continue
        }

        // Add plan_id to each item for tracking
        const itemsWithPlanId = itemsArray.map((item: any) => ({
          ...item,
          plan_id: plan.id,
          plan_name: plan.title || plan.file_name
        }))

        allItems.push(...itemsWithPlanId)
      }

      setAggregatedTakeoffItems(allItems)
      setTakeoffAnalysisMap(analysisMap)
    } catch (error) {
      console.error('Error loading aggregated takeoff items:', error)
    } finally {
      setLoadingTakeoff(false)
    }
  }

  const handleTakeoffItemsChange = async (updatedItems: any[]) => {
    if (!user || isSavingTakeoffRef.current) return

    // Get the first plan with takeoff analysis for items without plan_id
    const firstPlanWithTakeoff = plans.find(p => 
      (p.takeoff_analysis_status === 'completed' || p.has_takeoff_analysis === true) &&
      takeoffAnalysisMap[p.id]
    )
    const defaultPlanId = firstPlanWithTakeoff?.id
    const defaultPlanName = firstPlanWithTakeoff?.title || firstPlanWithTakeoff?.file_name

    // Assign plan_id to items that don't have one
    const itemsWithPlanId = updatedItems.map(item => {
      if (!item.plan_id && defaultPlanId) {
        return {
          ...item,
          plan_id: defaultPlanId,
          plan_name: defaultPlanName
        }
      }
      return item
    })

    // Update local state immediately for responsive UI
    setAggregatedTakeoffItems(itemsWithPlanId)

    // Save to database in the background (don't reload on success to prevent refresh)
    isSavingTakeoffRef.current = true
    setLoadingTakeoff(true)
    try {
      // Group items by plan_id
      const itemsByPlan: Record<string, any[]> = {}
      
      itemsWithPlanId.forEach(item => {
        const planId = item.plan_id
        if (!planId) {
          console.warn('Skipping item without plan_id:', item)
          return
        }
        
        if (!itemsByPlan[planId]) {
          itemsByPlan[planId] = []
        }
        
        // Remove plan_id and plan_name before saving
        const { plan_id, plan_name, ...itemToSave } = item
        itemsByPlan[planId].push(itemToSave)
      })

      // Update each plan's takeoff analysis
      for (const [planId, items] of Object.entries(itemsByPlan)) {
        const analysisId = takeoffAnalysisMap[planId]
        if (!analysisId) {
          console.warn(`No analysis ID found for plan ${planId}`)
          continue
        }

        const { error } = await supabase
          .from('plan_takeoff_analysis')
          .update({ items })
          .eq('id', analysisId)

        if (error) {
          console.error(`Error updating takeoff items for plan ${planId}:`, error)
          // Only reload on error to sync with database
          await loadAggregatedTakeoffItems(plans)
          return
        }
      }
      // Success - don't reload, state is already updated
    } catch (error) {
      console.error('Error saving takeoff items:', error)
      // Reload on error to get correct state from database
      await loadAggregatedTakeoffItems(plans)
    } finally {
      setLoadingTakeoff(false)
      isSavingTakeoffRef.current = false
    }
  }

  // Determine next step based on current state
  function getNextStep(): { message: string; action?: string; buttonText?: string; onAction?: () => void } {
    if (plans.length === 0) {
      return { 
        message: 'Upload your first plan to get started', 
        action: 'upload',
        buttonText: 'Upload Plans',
        onAction: () => setActiveTab('plans')
      }
    }
    
    // Check if any plan has completed takeoff
    const hasTakeoff = plans.some(p => p.takeoff_analysis_status === 'completed' || p.has_takeoff_analysis === true)
    if (!hasTakeoff) {
      return { 
        message: 'Run takeoff analysis on your plans', 
        action: 'takeoff',
        buttonText: 'Go to Plans',
        onAction: () => setActiveTab('plans')
      }
    }
    
    if (bidPackages.length === 0) {
      return { 
        message: 'Create a bid package to start collecting bids', 
        action: 'create_package',
        buttonText: 'Create Package',
        onAction: () => setActiveTab('bids')
      }
    }
    
    if (bids.length === 0) {
      return { 
        message: 'Waiting for bids from subcontractors', 
        action: 'waiting' 
      }
    }
    
    return { 
      message: 'Review and compare received bids', 
      action: 'review',
      buttonText: 'Review Bids',
      onAction: () => setActiveTab('bids')
    }
  }

  // Get recent notifications/activity
  function getRecentActivity(): Activity[] {
    const activities: Activity[] = []
    
    plans.forEach(p => {
      if (p.status === 'processed') {
        activities.push({
          id: `plan-${p.id}`,
          type: 'plan',
          message: `Plan "${p.title || p.file_name}" processed successfully`,
          date: p.created_at || new Date().toISOString()
        })
      }
      if (p.takeoff_analysis_status === 'completed') {
        activities.push({
          id: `takeoff-${p.id}`,
          type: 'takeoff',
          message: `Takeoff analysis completed for "${p.title || p.file_name}"`,
          date: p.created_at || new Date().toISOString()
        })
      }
    })

    bidPackages.forEach(pkg => {
      activities.push({
        id: `pkg-${pkg.id}`,
        type: 'package',
        message: `Bid package "${pkg.trade_category}" created`,
        date: pkg.created_at
      })
    })

    bids.forEach(bid => {
      activities.push({
        id: `bid-${bid.id}`,
        type: 'bid',
        message: `New bid received from ${bid.subcontractors?.name || 'Unknown Subcontractor'}`,
        date: bid.created_at
      })
    })

    // Sort by date descending and take top 5
    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }

  const openEditDialog = () => {
    if (!job || (jobRole !== 'owner' && job.user_id !== user?.id)) return

    setEditForm({
      name: job.name || '',
      location: job.location || '',
      budget_range: job.budget_range || '',
      project_type: job.project_type || '',
      description: job.description || '',
      status: job.status
    })
    setEditError(null)
    setIsEditDialogOpen(true)
  }

  const handleEditChange = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value
    }))
    setEditError(null)
  }

  const handleUpdateJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !job) return

    setSaving(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          location: editForm.location.trim(),
          budget_range: editForm.budget_range.trim() || null,
          project_type: editForm.project_type.trim() || null,
          description: editForm.description.trim() || null,
          status: editForm.status
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setEditError(result.error || 'Failed to update job. Please try again.')
        return
      }

      await loadJobData()
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error('Unexpected error updating job:', error)
      setEditError('Something went wrong while updating. Please try again.')
    } finally {
      setSaving(false)
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
            job_id: jobId,
            created_by: user?.id,
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
        if (newPlan?.id) {
          console.log(`Auto-triggering ingestion for plan ${newPlan.id}`)
          fetch('/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planId: newPlan.id,
              jobId: jobId,
              options: {
                enable_image_extraction: true,
                image_dpi: 300,
              },
            }),
          }).catch((err) => {
            console.error('Background ingestion trigger failed:', err)
          })

          fetch('/api/plan-text-chunks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              planId: newPlan.id,
              jobId,
            }),
          }).catch((err) => {
            console.error('Background plan text ingestion trigger failed:', err)
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

  const handleCreatePackageClick = async () => {
    if (!user || plans.length === 0) return

    // Find the first plan with takeoff analysis
    const planWithTakeoff = plans.find(p => 
      p.takeoff_analysis_status === 'completed' || p.has_takeoff_analysis === true
    )

    if (!planWithTakeoff) {
      alert('Please run takeoff analysis on at least one plan before creating a bid package.')
      return
    }

    try {
      // Load takeoff items for the selected plan
      const { data: takeoffAnalysis, error: takeoffError } = await supabase
        .from('plan_takeoff_analysis')
        .select('items')
        .eq('job_id', planWithTakeoff.job_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (takeoffError || !takeoffAnalysis) {
        alert('Could not load takeoff items. Please ensure takeoff analysis is complete.')
        return
      }

      // Parse takeoff items
      let itemsArray: any[] = []
      try {
        if (typeof takeoffAnalysis.items === 'string') {
          const parsed = JSON.parse(takeoffAnalysis.items)
          itemsArray = parsed.takeoffs || parsed.items || []
        } else if (Array.isArray(takeoffAnalysis.items)) {
          itemsArray = takeoffAnalysis.items
        }
      } catch (parseError) {
        console.error('Error parsing takeoff items:', parseError)
        itemsArray = []
      }

      // Ensure items have required fields
      const normalizedItems = itemsArray.map((item: any, index: number) => ({
        id: item.id || `item-${index}`,
        category: item.category || 'Uncategorized',
        description: item.description || item.name || item.item_name || '',
        quantity: item.quantity || 0,
        unit: item.unit || '',
        unit_cost: item.unit_cost || null,
        subcontractor: item.subcontractor || undefined
      }))

      setTakeoffItems(normalizedItems)
      setSelectedPlanId(planWithTakeoff.id)
      setShowPackageModal(true)
    } catch (error) {
      console.error('Error preparing package creation:', error)
      alert('Failed to prepare package creation. Please try again.')
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

  const nextStep = getNextStep()
  const recentActivity = getRecentActivity()

  return (
    <>
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
                {(jobRole === 'owner' || (job.user_id === user?.id)) && (
                  <Button variant="outline" size="sm" onClick={openEditDialog}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="takeoff">Takeoff</TabsTrigger>
              <TabsTrigger value="bids">Bids</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2 space-y-6">
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
                          <p className="text-gray-700 mb-6">{job.description}</p>
                        ) : (
                          <p className="text-gray-500 italic mb-6">No description provided</p>
                        )}
                        
                        {/* Next Step */}
                        <div className="mb-6 p-5 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start">
                              <AlertCircle className="h-5 w-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                              <div>
                                <h3 className="font-semibold text-orange-900 mb-1">Next Step</h3>
                                <p className="text-sm text-orange-800 mb-3">{nextStep.message}</p>
                                {nextStep.buttonText && nextStep.onAction && (
                                  <Button 
                                    size="sm" 
                                    onClick={nextStep.onAction}
                                    className="bg-orange-600 hover:bg-orange-700 text-white border-none"
                                  >
                                    {nextStep.buttonText}
                                    <ArrowRight className="ml-2 h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900">{plans.length}</div>
                            <div className="text-sm text-gray-600">Plans</div>
                          </div>
                          <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900">{bidPackages.length}</div>
                            <div className="text-sm text-gray-600">Bid Packages</div>
                          </div>
                          <div className="text-center p-4 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900">{bids.length}</div>
                            <div className="text-sm text-gray-600">Bids Received</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                <div className="lg:col-span-1">
                  <motion.div variants={staggerItem}>
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Bell className="h-5 w-5 mr-2 text-orange-600" />
                          Recent Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {recentActivity.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 text-sm">
                            No recent activity
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {recentActivity.map((activity) => (
                              <div key={activity.id} className="flex items-start space-x-3 pb-3 border-b last:border-0 last:pb-0">
                                <div className="mt-1">
                                  {activity.type === 'plan' && <FileText className="h-4 w-4 text-blue-500" />}
                                  {activity.type === 'takeoff' && <BarChart3 className="h-4 w-4 text-green-500" />}
                                  {activity.type === 'package' && <Package className="h-4 w-4 text-purple-500" />}
                                  {activity.type === 'bid' && <Users className="h-4 w-4 text-orange-500" />}
                                </div>
                                <div className="flex-1 space-y-1">
                                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(activity.date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>
            </TabsContent>

            {/* Plans Tab */}
            <TabsContent value="plans" className="space-y-6">
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
                            <Link href={`/dashboard/jobs/${jobId}/plans/${plan.id}`}>
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
                                      <Button variant="ghost" size="sm">
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          // TODO: Add download functionality
                                        }}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          // TODO: Add delete functionality
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {plan.num_pages} page{plan.num_pages !== 1 ? 's' : ''}
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
                </CardContent>
              </Card>
            </TabsContent>

            {/* Takeoff Tab */}
            <TabsContent value="takeoff" className="h-[calc(100vh-200px)] min-h-[600px]">
              <Card className="h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-orange-600" />
                    Takeoff & Estimate
                  </CardTitle>
                  <CardDescription>
                    View and edit takeoff analysis and estimates for all plans
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0 sm:p-6 pt-0">
                  {plans.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Upload plans to see takeoff analysis</p>
                    </div>
                  ) : loadingTakeoff ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                      <p className="text-gray-500 mt-2">Loading takeoff data...</p>
                    </div>
                  ) : aggregatedTakeoffItems.length === 0 ? (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No takeoff analysis yet</h3>
                      <p className="text-gray-600 mb-4">
                        Run takeoff analysis on your plans to see items here
                      </p>
                      <div className="space-y-2 max-w-md mx-auto">
                        {plans.map((plan) => {
                          const hasTakeoff = plan.takeoff_analysis_status === 'completed' || plan.has_takeoff_analysis === true
                          const takeoffDate = (plan as any).latest_takeoff_analysis?.created_at 
                            ? new Date((plan as any).latest_takeoff_analysis.created_at).toLocaleDateString()
                            : null
                          return (
                            <div key={plan.id} className="flex items-center justify-between p-3 border rounded-lg text-left">
                              <div className="flex items-center space-x-3 flex-1">
                                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium block truncate">{plan.title || plan.file_name}</span>
                                  {takeoffDate && (
                                    <span className="text-xs text-gray-500">Takeoff: {takeoffDate}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                {hasTakeoff ? (
                                  <Badge className="bg-green-100 text-green-800">Takeoff Complete</Badge>
                                ) : (
                                  <Badge variant="outline">No Takeoff</Badge>
                                )}
                                <Link href={`/dashboard/jobs/${jobId}/plans/${plan.id}`}>
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-4 w-4 mr-1" />
                                    {hasTakeoff ? 'View' : 'Run Analysis'}
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full overflow-auto">
                      <TakeoffSpreadsheet
                        items={aggregatedTakeoffItems}
                        editable={jobRole === 'owner' || job.user_id === user?.id}
                        onItemsChange={handleTakeoffItemsChange}
                        onItemHighlight={(bbox) => {
                          // Find the plan that contains this page
                          const item = aggregatedTakeoffItems.find(i => 
                            i.bounding_box?.page === bbox.page
                          )
                          if (item?.plan_id) {
                            router.push(`/dashboard/jobs/${jobId}/plans/${item.plan_id}?page=${bbox.page}`)
                          }
                        }}
                        onPageNavigate={(page) => {
                          // Find the plan that contains this page
                          const item = aggregatedTakeoffItems.find(i => 
                            i.bounding_box?.page === page
                          )
                          if (item?.plan_id) {
                            router.push(`/dashboard/jobs/${jobId}/plans/${item.plan_id}?page=${page}`)
                          }
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bids Tab */}
            <TabsContent value="bids" className="space-y-6">
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-6"
              >
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
                          <Button onClick={handleCreatePackageClick}>
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
                              <Button onClick={handleCreatePackageClick}>
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
                                <Card 
                                  className="cursor-pointer hover:shadow-md transition-shadow"
                                  onClick={() => {
                                    setSelectedPackageId(pkg.id)
                                    setShowPackageViewModal(true)
                                  }}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <h4 className="font-semibold">{pkg.trade_category}</h4>
                                        {pkg.description && (
                                          <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
                                        )}
                                        {pkg.sent_at && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Sent: {new Date(pkg.sent_at).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Badge className={getStatusColor(pkg.status)}>
                                          {pkg.status}
                                        </Badge>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setSelectedPackageId(pkg.id)
                                            setShowPackageViewModal(true)
                                          }}
                                        >
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

                {/* Received Bids Section */}
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
                      {bids.length === 0 ? (
                        <div className="text-center py-12">
                          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No bids received yet</h3>
                          <p className="text-gray-600">Bids will appear here once you send out bid packages</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bids.map((bid) => {
                            const subcontractor = (bid.subcontractors as any)
                            const bidPackage = (bid.bid_packages as any)
                            return (
                              <div key={bid.id} className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-semibold">{subcontractor?.name || 'Unknown'}</span>
                                    <Badge className={bid.status === 'accepted' ? 'bg-green-100 text-green-800' : bid.status === 'declined' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                                      {bid.status || 'pending'}
                                    </Badge>
                                    {bidPackage && (
                                      <Badge variant="outline" className="text-xs">
                                        {bidPackage.trade_category}
                                      </Badge>
                                    )}
                                  </div>
                                  {bid.bid_amount && (
                                    <p className="text-sm text-gray-600">${Number(bid.bid_amount).toLocaleString()}</p>
                                  )}
                                  {bid.timeline && (
                                    <p className="text-xs text-gray-500 mt-1">Timeline: {bid.timeline}</p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setShowBidsModal(true)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) setEditError(null)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl">Edit Job</DialogTitle>
            <DialogDescription className="mt-1.5">
              Update the job details and save your changes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateJob} className="px-6 py-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-sm font-medium">Job Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => handleEditChange('name', e.target.value)}
                required
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-location" className="text-sm font-medium">Location</Label>
              <Input
                id="edit-location"
                value={editForm.location}
                onChange={(e) => handleEditChange('location', e.target.value)}
                required
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-budget_range" className="text-sm font-medium">Budget</Label>
              <Input
                id="edit-budget_range"
                placeholder="e.g. $40,000 with 10% contingency"
                value={editForm.budget_range}
                onChange={(e) => handleEditChange('budget_range', e.target.value)}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="edit-project_type" className="text-sm font-medium">Project Type</Label>
                <Select
                  value={editForm.project_type || 'not_specified'}
                  onValueChange={(value) => handleEditChange('project_type', value === 'not_specified' ? '' : value)}
                >
                  <SelectTrigger id="edit-project_type" className="w-full">
                    <SelectValue placeholder="Select project type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_specified">Not specified</SelectItem>
                    {PROJECT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status" className="text-sm font-medium">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => handleEditChange('status', value as EditFormState['status'])}
                >
                  <SelectTrigger id="edit-status" className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_STATUSES.map((statusOption) => (
                      <SelectItem key={statusOption} value={statusOption}>
                        {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="edit-description"
                rows={4}
                value={editForm.description}
                onChange={(e) => handleEditChange('description', e.target.value)}
                placeholder="Describe the job scope, timeline, or other important details."
                className="w-full resize-none"
              />
            </div>

            {editError && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{editError}</p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !editForm.name.trim() || !editForm.location.trim()}
                className="w-full sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bid Comparison Modal */}
      {jobId && (
        <BidComparisonModal
          jobId={jobId}
          isOpen={showBidsModal}
          onClose={() => setShowBidsModal(false)}
        />
      )}

      {/* Bid Package Creation Modal */}
      {jobId && selectedPlanId && (
        <BidPackageModal
          jobId={jobId}
          planId={selectedPlanId}
          takeoffItems={takeoffItems}
          isOpen={showPackageModal}
          onClose={() => {
            setShowPackageModal(false)
            setSelectedPlanId(null)
            setTakeoffItems([])
          }}
          onPackageCreated={(pkg) => {
            // Reload bid packages after creation
            loadJobData()
          }}
        />
      )}

      {/* Bid Package View Modal */}
      {selectedPackageId && (
        <BidPackageViewModal
          bidPackageId={selectedPackageId}
          isOpen={showPackageViewModal}
          onClose={() => {
            setShowPackageViewModal(false)
            setSelectedPackageId(null)
          }}
        />
      )}
    </>
  )
}
