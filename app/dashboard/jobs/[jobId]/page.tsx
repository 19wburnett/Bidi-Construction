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
  ArrowRight,
  Pencil,
  Check,
  X,
  Search,
  Camera,
  ImageIcon
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { staggerContainer, staggerItem, cardHover, skeletonPulse } from '@/lib/animations'
import { Job, Plan, BidPackage, JobReport } from '@/types/takeoff'
import { getJobForUser } from '@/lib/job-access'
import { updatePlanTitle } from '@/app/actions/plan'
import BidComparisonModal from '@/components/bid-comparison-modal'
import BidPackageModal from '@/components/bid-package-modal'
import BidPackageViewModal from '@/components/bid-package-view-modal'
import AddBidModal from '@/components/add-bid-modal'
import BulkPdfUploadModal from '@/components/bulk-pdf-upload-modal'
import TakeoffSpreadsheet from '@/components/takeoff-spreadsheet'
import BudgetSpreadsheet from '@/components/budget-spreadsheet'
import ReportViewerModal from '@/components/report-viewer-modal'
import JobTimeline from '@/components/job-timeline'

const PROJECT_TYPES = [
  'Residential',
  'Commercial',
  'Industrial',
  'Renovation',
  'New Construction',
  'Other'
]

const JOB_STATUSES: Job['status'][] = ['draft', 'needs_takeoff', 'needs_packages', 'waiting_for_bids', 'completed', 'archived']

const formatStatus = (status: string) => {
  switch (status) {
    case 'needs_takeoff': return 'Needs Takeoff'
    case 'needs_packages': return 'Need Packages'
    case 'waiting_for_bids': return 'Waiting for Bids'
    default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
  }
}

type EditFormState = {
  name: string
  location: string
  budget_range: string
  project_type: string
  description: string
  status: Job['status']
  cover_image_path: string | null
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
  const [reports, setReports] = useState<JobReport[]>([])
  const [bidPackages, setBidPackages] = useState<BidPackage[]>([])
  const [bids, setBids] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingReport, setUploadingReport] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showPackageViewModal, setShowPackageViewModal] = useState(false)
  const [showAddBidModal, setShowAddBidModal] = useState(false)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [showReportViewer, setShowReportViewer] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<JobReport | null>(null)
  const [takeoffItems, setTakeoffItems] = useState<any[]>([])
  const [aggregatedTakeoffItems, setAggregatedTakeoffItems] = useState<any[]>([])
  const [takeoffAnalysisId, setTakeoffAnalysisId] = useState<string | null>(null)
  const [loadingTakeoff, setLoadingTakeoff] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [acceptedBidsWithLineItems, setAcceptedBidsWithLineItems] = useState<any[]>([])
  const [showBidComparisonModal, setShowBidComparisonModal] = useState(false)
  const [selectedBidIdForModal, setSelectedBidIdForModal] = useState<string | null>(null)
  const [bidModalRefreshTrigger, setBidModalRefreshTrigger] = useState(0)
  const isSavingTakeoffRef = useRef(false)
  
  // Plan editing state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    location: '',
    budget_range: '',
    project_type: '',
    description: '',
    status: 'draft',
    cover_image_path: null
  })
  const [editCoverImage, setEditCoverImage] = useState<File | null>(null)
  const [editCoverImagePreview, setEditCoverImagePreview] = useState<string | null>(null)
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

      // Update last viewed timestamp (fire and forget)
      supabase
        .from('job_members')
        .update({ last_viewed_at: new Date().toISOString() })
        .eq('job_id', jobId)
        .eq('user_id', user.id)
        .then(({ error }) => {
           if (error) console.error('Failed to update last viewed:', error)
        })

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

      // Load job reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('job_reports')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (reportsError) console.error('Error loading reports:', reportsError)
      setReports(reportsData || [])

      // Load bid packages for this job
      const { data: packagesData, error: packagesError } = await supabase
        .from('bid_packages')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (packagesError) throw packagesError
      setBidPackages(packagesData || [])

      // Load bids for this job with bid package info, subcontractors, and contacts
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('*, subcontractors (id, name, email, trade_category), gc_contacts (id, name, email, trade_category, location, company, phone), bid_packages (id, trade_category, description, minimum_line_items, status)')
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

  // Load accepted bids with line items when bids change
  useEffect(() => {
    if (bids.length > 0) {
      loadAcceptedBidsWithLineItems(bids)
    } else {
      setAcceptedBidsWithLineItems([])
    }
  }, [bids])

  async function loadAcceptedBidsWithLineItems(allBids: any[]) {
    const acceptedBids = allBids.filter(bid => bid.status === 'accepted')
    
    if (acceptedBids.length === 0) {
      setAcceptedBidsWithLineItems([])
      return
    }

    try {
      const bidIds = acceptedBids.map(b => b.id)
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('bid_line_items')
        .select('*')
        .in('bid_id', bidIds)
        .order('item_number', { ascending: true })

      if (lineItemsError) {
        console.error('Error loading bid line items:', lineItemsError)
        setAcceptedBidsWithLineItems(acceptedBids.map(bid => ({ ...bid, bid_line_items: [] })))
        return
      }

      // Group line items by bid_id
      const itemsByBid: Record<string, any[]> = {}
      lineItems?.forEach(item => {
        if (!itemsByBid[item.bid_id]) {
          itemsByBid[item.bid_id] = []
        }
        itemsByBid[item.bid_id].push(item)
      })

      // Enrich accepted bids with their line items
      const enrichedBids = acceptedBids.map(bid => ({
        ...bid,
        bid_line_items: itemsByBid[bid.id] || []
      }))

      setAcceptedBidsWithLineItems(enrichedBids)
    } catch (error) {
      console.error('Error loading accepted bids with line items:', error)
      setAcceptedBidsWithLineItems(acceptedBids.map(bid => ({ ...bid, bid_line_items: [] })))
    }
  }

  async function loadAggregatedTakeoffItems(plansList: Plan[]) {
    if (!user) return
    
    setLoadingTakeoff(true)
    try {
      // Fetch the latest takeoff analysis for this job
      const { data: takeoffAnalysis, error: takeoffError } = await supabase
        .from('plan_takeoff_analysis')
        .select('id, items')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (takeoffError) {
        console.error('Error fetching takeoff analysis:', takeoffError)
        return
      }

      if (!takeoffAnalysis) {
        setAggregatedTakeoffItems([])
        return
      }

      setTakeoffAnalysisId(takeoffAnalysis.id)

      let itemsArray: any[] = []
      try {
        if (typeof takeoffAnalysis.items === 'string') {
          const parsed = JSON.parse(takeoffAnalysis.items)
          itemsArray = parsed.takeoffs || parsed.items || (Array.isArray(parsed) ? parsed : [])
        } else if (Array.isArray(takeoffAnalysis.items)) {
          itemsArray = takeoffAnalysis.items
        }
      } catch (parseError) {
        console.error('Error parsing takeoff items:', parseError)
      }

      // If items don't have plan_name but have plan_id, we can enrich them from plansList
      const enrichedItems = itemsArray.map((item: any) => {
        if (item.plan_id && !item.plan_name) {
           const plan = plansList.find(p => p.id === item.plan_id)
           if (plan) {
             return { ...item, plan_name: plan.title || plan.file_name }
           }
        }
        return item
      })

      setAggregatedTakeoffItems(enrichedItems)
    } catch (error) {
      console.error('Error loading aggregated takeoff items:', error)
    } finally {
      setLoadingTakeoff(false)
    }
  }

  const handleTakeoffItemsChange = async (updatedItems: any[]) => {
    if (!user || isSavingTakeoffRef.current || !takeoffAnalysisId) return

    // Update local state immediately for responsive UI
    setAggregatedTakeoffItems(updatedItems)

    // Save to database in the background
    isSavingTakeoffRef.current = true
    setLoadingTakeoff(true)
    try {
      const { error } = await supabase
        .from('plan_takeoff_analysis')
        .update({ items: updatedItems })
        .eq('id', takeoffAnalysisId)

      if (error) throw error
      
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
    
    // Check if we have items or an analysis ID (job-level takeoff)
    const hasTakeoff = aggregatedTakeoffItems.length > 0 || !!takeoffAnalysisId
    
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
        message: `New bid received from ${bid.subcontractors?.name || bid.gc_contacts?.name || 'Unknown Subcontractor'}`,
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
      status: job.status,
      cover_image_path: job.cover_image_path || null
    })
    setEditCoverImage(null)
    setEditCoverImagePreview(null)
    setEditError(null)
    setIsEditDialogOpen(true)
  }

  const handleEditCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setEditError('Please select an image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setEditError('Image must be less than 5MB')
        return
      }
      setEditCoverImage(file)
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setEditCoverImagePreview(previewUrl)
      setEditError(null)
    }
  }

  const removeEditCoverImage = () => {
    setEditCoverImage(null)
    if (editCoverImagePreview) {
      URL.revokeObjectURL(editCoverImagePreview)
      setEditCoverImagePreview(null)
    }
    // Mark for removal by setting to empty string (will become null on save)
    setEditForm(prev => ({ ...prev, cover_image_path: '' }))
  }

  const getCoverImageUrl = (path: string | null) => {
    if (!path) return null
    const { data } = supabase.storage.from('job-covers').getPublicUrl(path)
    return data.publicUrl
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
      let cover_image_path = editForm.cover_image_path

      // Upload new cover image if selected
      if (editCoverImage) {
        const fileExt = editCoverImage.name.split('.').pop()
        const fileName = `cover.${fileExt}`
        const filePath = `${user.id}/${job.id}/${fileName}`

        // Delete old image if exists
        if (job.cover_image_path) {
          await supabase.storage
            .from('job-covers')
            .remove([job.cover_image_path])
        }

        const { error: uploadError } = await supabase.storage
          .from('job-covers')
          .upload(filePath, editCoverImage, { upsert: true })

        if (uploadError) {
          setEditError(`Failed to upload cover image: ${uploadError.message}`)
          setSaving(false)
          return
        }

        cover_image_path = filePath
      } else if (editForm.cover_image_path === '') {
        // User removed the image
        if (job.cover_image_path) {
          await supabase.storage
            .from('job-covers')
            .remove([job.cover_image_path])
        }
        cover_image_path = null
      }

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
          status: editForm.status,
          cover_image_path
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setEditError(result.error || 'Failed to update job. Please try again.')
        return
      }

      await loadJobData()
      setIsEditDialogOpen(false)
      setEditCoverImage(null)
      setEditCoverImagePreview(null)
    } catch (error) {
      console.error('Unexpected error updating job:', error)
      setEditError('Something went wrong while updating. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function startEditingPlan(plan: Plan) {
    setEditingPlanId(plan.id)
    setEditingTitle(plan.title || plan.file_name)
  }

  async function savePlanTitle() {
    if (!editingPlanId || !editingTitle.trim()) return

    setIsUpdatingTitle(true)
    try {
      const result = await updatePlanTitle(editingPlanId, editingTitle)
      
      if (result.success) {
        // Update local state
        setPlans(prev => prev.map(p => 
          p.id === editingPlanId 
            ? { ...p, title: editingTitle } 
            : p
        ))
        setEditingPlanId(null)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error updating plan title:', error)
      alert('Failed to update plan name')
    } finally {
      setIsUpdatingTitle(false)
    }
  }

  function cancelEditingPlan() {
    setEditingPlanId(null)
    setEditingTitle('')
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

  const handleReportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !job) return

    setUploadingReport(true)
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `job-plans/reports/${user?.id}/${jobId}/${fileName}`

        // Upload to storage (using job-plans bucket with reports/ prefix)
        const { error: uploadError } = await supabase.storage
          .from('job-plans')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Create report record
        const { error: insertError } = await supabase
          .from('job_reports')
          .insert({
            job_id: jobId,
            created_by: user?.id,
            title: file.name.split('.')[0],
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type
          })

        if (insertError) throw insertError
      }

      // Reload data
      await loadJobData()
    } catch (error) {
      console.error('Error uploading reports:', error)
      alert('Failed to upload report. Please try again.')
    } finally {
      setUploadingReport(false)
    }
  }

  const deleteReport = async (report: JobReport) => {
    if (!confirm(`Are you sure you want to delete "${report.title || report.file_name}"?`)) return

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('job-plans')
        .remove([report.file_path])

      if (storageError) console.error('Error deleting file from storage:', storageError)

      // Delete from database
      const { error: dbError } = await supabase
        .from('job_reports')
        .delete()
        .eq('id', report.id)

      if (dbError) throw dbError

      // Update local state
      setReports(prev => prev.filter(r => r.id !== report.id))
    } catch (error) {
      console.error('Error deleting report:', error)
      alert('Failed to delete report.')
    }
  }

  const handleDeletePlan = async (plan: Plan) => {
    if (!confirm(`Are you sure you want to delete "${plan.title || plan.file_name}"? This will also delete all associated takeoff data.`)) return

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('job-plans')
        .remove([plan.file_path])

      if (storageError) console.error('Error deleting file from storage:', storageError)

      // Delete from database
      const { error: dbError } = await supabase
        .from('plans')
        .delete()
        .eq('id', plan.id)

      if (dbError) throw dbError

      // Update local state
      setPlans(prev => prev.filter(p => p.id !== plan.id))
      
      // Reload job data to update takeoff summaries etc
      loadJobData()
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete plan.')
    }
  }

  const handleDownloadPlan = async (plan: Plan) => {
    try {
      const { data, error } = await supabase.storage
        .from('job-plans')
        .download(plan.file_path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = plan.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading plan:', error)
      alert('Failed to download plan.')
    }
  }

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

  const handleCreatePackageClick = async () => {
    if (!user || plans.length === 0) return

    // Check if we have takeoff items or an analysis ID
    if (aggregatedTakeoffItems.length === 0 && !takeoffAnalysisId) {
      alert('Please run takeoff analysis on at least one plan before creating a bid package.')
      return
    }

    try {
      // Use existing items
      const itemsArray = aggregatedTakeoffItems

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
      
      // Select a default plan ID (required by modal/API)
      // Try to find from items, otherwise use first plan
      const itemWithPlan = itemsArray.find((i: any) => i.plan_id)
      const defaultPlanId = itemWithPlan?.plan_id || plans[0]?.id
      
      setSelectedPlanId(defaultPlanId)
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

  const filteredPlans = plans.filter(plan => 
    (plan.title || plan.file_name).toLowerCase().includes(searchQuery.toLowerCase())
  )

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
              <div className="flex items-center gap-4">
                {/* Job Cover Image Thumbnail */}
                <div className="flex-shrink-0">
                  {job.cover_image_path ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                      <Image
                        src={getCoverImageUrl(job.cover_image_path) || ''}
                        alt={job.name}
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
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(job.status)}>
                  {formatStatus(job.status)}
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
            <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="takeoff">Takeoff</TabsTrigger>
              <TabsTrigger value="bids">Bids</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
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
                          <div 
                            className={`text-center p-4 bg-gray-50 rounded-lg ${plans.length > 0 ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                            onClick={() => plans.length > 0 && setActiveTab('plans')}
                          >
                            <div className="text-2xl font-bold text-gray-900">{plans.length}</div>
                            <div className="text-sm text-gray-600">Plans</div>
                          </div>
                          <div 
                            className={`text-center p-4 bg-gray-50 rounded-lg ${bidPackages.length > 0 ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                            onClick={() => bidPackages.length > 0 && setActiveTab('bids')}
                          >
                            <div className="text-2xl font-bold text-gray-900">{bidPackages.length}</div>
                            <div className="text-sm text-gray-600">Bid Packages</div>
                          </div>
                          <div 
                            className={`text-center p-4 bg-gray-50 rounded-lg ${bids.length > 0 ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                            onClick={() => bids.length > 0 && setActiveTab('bids')}
                          >
                            <div className="text-2xl font-bold text-gray-900">{bids.length}</div>
                            <div className="text-sm text-gray-600">Bids Received</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Project Timeline */}
                  <motion.div variants={staggerItem}>
                    <JobTimeline 
                      jobId={jobId} 
                      canEdit={jobRole === 'owner'}
                      onUpdate={() => {
                        // Refresh any relevant data if needed
                      }}
                    />
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-orange-600" />
                        Project Plans
                      </CardTitle>
                      <CardDescription>
                        Upload and manage your construction plans
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                          placeholder="Search plans..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8"
                        />
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
                    ) : filteredPlans.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-12"
                      >
                        <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No plans found</h3>
                        <p className="text-gray-600">Try adjusting your search query</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                        className="flex flex-col space-y-3"
                      >
                        {filteredPlans.map((plan) => (
                          <motion.div
                            key={plan.id}
                            variants={staggerItem}
                            className="flex items-stretch gap-3 group"
                          >
                            {editingPlanId === plan.id ? (
                              <div className="flex-1 flex items-center p-4 bg-white border rounded-lg shadow-sm ring-2 ring-orange-500 border-transparent transition-all">
                                <FileText className="h-8 w-8 text-orange-600 mr-4 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                      <Input
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        className="h-7 text-sm px-2 max-w-[300px]"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          e.stopPropagation()
                                          if (e.key === 'Enter') savePlanTitle()
                                          if (e.key === 'Escape') cancelEditingPlan()
                                        }}
                                      />
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 flex-shrink-0"
                                        onClick={savePlanTitle}
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                        onClick={cancelEditingPlan}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <Badge variant="secondary" className="text-xs ml-2">{plan.status}</Badge>
                                  </div>
                                  <div className="text-sm text-gray-500 flex items-center gap-3">
                                    <span>{plan.num_pages} page{plan.num_pages !== 1 ? 's' : ''}</span>
                                    <span>•</span>
                                    <span>Uploaded {new Date(plan.created_at || new Date()).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <Link 
                                href={`/dashboard/jobs/${jobId}/plans/${plan.id}`}
                                className="flex-1 flex"
                              >
                                <div className="flex-1 flex items-center p-4 bg-white border rounded-lg hover:border-orange-500 hover:shadow-md transition-all cursor-pointer group-hover:border-orange-500">
                                  <FileText className="h-8 w-8 text-orange-600 mr-4 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-semibold text-gray-900 truncate text-lg">
                                          {plan.title || plan.file_name}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          startEditingPlan(plan)
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Badge variant="secondary" className="text-xs ml-2">{plan.status}</Badge>
                                    </div>
                                    <div className="text-sm text-gray-500 flex items-center gap-3">
                                      <span>{plan.num_pages} page{plan.num_pages !== 1 ? 's' : ''}</span>
                                      <span>•</span>
                                      <span>Uploaded {new Date(plan.created_at || new Date()).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                  <div className="text-sm font-medium text-orange-600 flex items-center opacity-0 group-hover:opacity-100 transition-opacity px-4">
                                    View Plan <ArrowRight className="ml-1 h-4 w-4" />
                                  </div>
                                </div>
                              </Link>
                            )}
                            
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-full flex-1 bg-white hover:bg-gray-50 hover:text-blue-600 border-gray-200 w-12"
                                title="Download"
                                onClick={() => handleDownloadPlan(plan)}
                              >
                                <Download className="h-5 w-5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-full flex-1 bg-white hover:bg-red-50 hover:text-red-600 border-gray-200 w-12"
                                title="Delete"
                                onClick={() => handleDeletePlan(plan)}
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* Reports Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-blue-600" />
                        Reports
                      </CardTitle>
                      <CardDescription>
                        Upload additional PDF reports (e.g., Soil Reports, Engineering Specs)
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        id="report-upload"
                        multiple
                        accept=".pdf"
                        onChange={handleReportUpload}
                        className="hidden"
                        disabled={uploadingReport}
                      />
                      <label htmlFor="report-upload">
                        <Button asChild disabled={uploadingReport} variant="outline">
                          <span>
                            {uploadingReport ? (
                              <>
                                <Clock className="h-4 w-4 mr-2 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Reports
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reports.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No reports uploaded</h3>
                      <p className="text-gray-600">Upload PDF reports to attach to bid packages</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {reports.map((report) => (
                        <Card key={report.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2 min-w-0 flex-1">
                                <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate" title={report.title || report.file_name}>
                                    {report.title || report.file_name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(report.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-end space-x-1 mt-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedReport(report)
                                  setShowReportViewer(true)
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => deleteReport(report)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
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
                {/* Received Bids Section */}
                <motion.div variants={staggerItem}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center">
                            <Users className="h-5 w-5 mr-2 text-orange-600" />
                            Received Bids
                          </CardTitle>
                          <CardDescription>
                            View and manage bids from subcontractors
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setShowBulkUploadModal(true)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload PDFs
                          </Button>
                          <Button variant="outline" onClick={() => setShowAddBidModal(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Manually Add Bid
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {bids.length === 0 ? (
                        <div className="text-center py-12 px-6">
                          <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No bids received yet</h3>
                          <p className="text-gray-600">Bids will appear here once you send out bid packages</p>
                        </div>
                      ) : (
                        <div className="h-[800px] overflow-hidden">
                          {jobId && (
                            <BidComparisonModal
                              jobId={jobId}
                              isOpen={true}
                              onClose={() => {}}
                              inline={true}
                              refreshTrigger={bidModalRefreshTrigger}
                            />
                          )}
                        </div>
                      )}
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
              </motion.div>
            </TabsContent>

            {/* Budget Tab */}
            <TabsContent value="budget" className="space-y-6">
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-6"
              >
                <motion.div variants={staggerItem}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <DollarSign className="h-5 w-5 mr-2 text-orange-600" />
                        Budget Overview
                      </CardTitle>
                      <CardDescription>
                        View accepted bids organized by trade category and see what still needs bids
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <BudgetSpreadsheet
                        acceptedBids={acceptedBidsWithLineItems}
                        takeoffItems={aggregatedTakeoffItems}
                        jobId={jobId}
                        onBidClick={(bidId) => {
                          setSelectedBidIdForModal(bidId)
                          setShowBidComparisonModal(true)
                        }}
                        onViewBidsForTrade={(tradeCategory) => {
                          // Open bid comparison modal - it will show all bids for the job
                          // The user can filter by trade category in the modal
                          setSelectedBidIdForModal(null)
                          setShowBidComparisonModal(true)
                        }}
                      />
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
            {/* Cover Image */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center">
                <Camera className="h-4 w-4 mr-1" />
                Project Photo
              </Label>
              <div className="flex items-start gap-4">
                {editCoverImagePreview || (editForm.cover_image_path && editForm.cover_image_path !== '') ? (
                  <div className="relative">
                    <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                      <Image
                        src={editCoverImagePreview || getCoverImageUrl(editForm.cover_image_path) || ''}
                        alt="Cover preview"
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removeEditCoverImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="edit-cover-image"
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors"
                  >
                    <ImageIcon className="h-5 w-5 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">Add</span>
                  </label>
                )}
                <div className="flex-1 text-sm text-gray-500">
                  <p>Upload a photo to help identify this project.</p>
                  <p className="text-xs mt-1">JPG, PNG or WebP, max 5MB</p>
                </div>
              </div>
              <input
                type="file"
                id="edit-cover-image"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleEditCoverImageChange}
                className="hidden"
              />
            </div>

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
                        {formatStatus(statusOption)}
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

      {/* Add Bid Modal */}
      {jobId && (
        <AddBidModal
          jobId={jobId}
          isOpen={showAddBidModal}
          onClose={() => setShowAddBidModal(false)}
          onBidAdded={() => {
            loadJobData()
            // Refresh bid comparison modal if it's open
            setBidModalRefreshTrigger(prev => prev + 1)
          }}
        />
      )}

      {/* Bulk PDF Upload Modal */}
      {jobId && (
        <BulkPdfUploadModal
          jobId={jobId}
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          onBidsCreated={() => {
            loadJobData()
            // Refresh bid comparison modal if it's open
            setBidModalRefreshTrigger(prev => prev + 1)
          }}
        />
      )}

      {/* Report Viewer Modal */}
      <ReportViewerModal
        report={selectedReport}
        isOpen={showReportViewer}
        onClose={() => {
          setShowReportViewer(false)
          setSelectedReport(null)
        }}
      />

      {/* Bid Comparison Modal for Budget View */}
      {jobId && (
        <BidComparisonModal
          jobId={jobId}
          isOpen={showBidComparisonModal}
          onClose={() => {
            setShowBidComparisonModal(false)
            setSelectedBidIdForModal(null)
            // Reload job data to refresh accepted bids in budget view
            loadJobData()
          }}
          initialBidId={selectedBidIdForModal}
          refreshTrigger={bidModalRefreshTrigger}
        />
      )}
    </>
  )
}
