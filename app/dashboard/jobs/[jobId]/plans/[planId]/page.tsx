'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  ArrowLeft,
  Share2,
  Package,
  Eye,
  Save,
  Download,
  BarChart3,
  AlertTriangle,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileText,
  MessageSquare,
  Bot
} from 'lucide-react'
import Link from 'next/link'
import { drawerSlide } from '@/lib/animations'
import { Job, Plan } from '@/types/takeoff'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import FastPlanCanvas from '@/components/fast-plan-canvas'
import CommentPinForm from '@/components/comment-pin-form'
import { canvasUtils } from '@/lib/canvas-utils'
import { Drawing } from '@/lib/canvas-utils'
import { MeasurementPersistence, isMeasurementDrawing } from '@/lib/measurement-persistence'
import { CommentPersistence } from '@/lib/comment-persistence'
import ShareLinkGenerator from '@/components/share-link-generator'
import BidPackageModal from '@/components/bid-package-modal'
import BidComparisonModal from '@/components/bid-comparison-modal'
import TakeoffAccordion from '@/components/takeoff-accordion'
import PdfQualitySettings, { QualityMode } from '@/components/pdf-quality-settings'
import PlanChatPanel from '@/components/plan/plan-chat-panel'
import ThreadedCommentDisplay from '@/components/threaded-comment-display'
import { organizeCommentsIntoThreads, getReplyCount } from '@/lib/comment-utils'
import { CheckCircle2 } from 'lucide-react'
import ScaleSettingsModal, { ScaleSetting } from '@/components/scale-settings-modal'
import { normalizeTradeScopeReview, TradeScopeReviewEntry } from '@/lib/trade-scope-review'
import { getJobForUser } from '@/lib/job-access'


type AnalysisMode = 'takeoff' | 'quality' | 'chat' | 'comments'

type TradeScopeStatus = 'complete' | 'partial' | 'missing'

type TradeScopeReviewSummary = {
  complete: number
  partial: number
  missing: number
  notes: string
}

export default function EnhancedPlanViewer() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [activeTab, setActiveTab] = useState<AnalysisMode>('takeoff')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [planUrl, setPlanUrl] = useState<string>('')
  const [commentFormOpen, setCommentFormOpen] = useState(false)
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0, pageNumber: 1 })
  const [isRunningTakeoff, setIsRunningTakeoff] = useState(false)
  const [isRunningQuality, setIsRunningQuality] = useState(false)
  const [isGeneratingShare, setIsGeneratingShare] = useState(false)
  const [takeoffResults, setTakeoffResults] = useState<any>(null)
  const [modalTakeoffItems, setModalTakeoffItems] = useState<Array<{
    id: string
    category: string
    description: string
    quantity: number
    unit: string
    unit_cost?: number
  }>>([])
  const [qualityResults, setQualityResults] = useState<any>(null)
  const [qualityAnalysisRowId, setQualityAnalysisRowId] = useState<string | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<{ step: string; percent: number; timeEstimate?: string }>({ step: '', percent: 0 })
  const [goToPage, setGoToPage] = useState<number | undefined>(undefined)
  
  // Handle page navigation from takeoff items
  const handlePageNavigate = useCallback((page: number) => {
    setGoToPage(page)
    // Reset after navigation so it can be triggered again
    setTimeout(() => setGoToPage(undefined), 100)
  }, [])
  
  // PDF quality settings
  const [qualityMode, setQualityMode] = useState<QualityMode>('balanced')
  const [scale, setScale] = useState(1.5)
  // Measurement scale settings per page (pixelsPerUnit derived from ratio input)
  const [measurementScaleSettings, setMeasurementScaleSettings] = useState<Record<number, ScaleSetting>>({})
  const [scaleSettingsModalOpen, setScaleSettingsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null)
  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([])
  const [isCalibrating, setIsCalibrating] = useState(false)
  
  // Modal states
  const [showShareModal, setShowShareModal] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showBidsModal, setShowBidsModal] = useState(false)
  
  // Sidebar resize state
	const [sidebarWidth, setSidebarWidth] = useState(600) // Default 600px to match resize constraints
	const [isResizing, setIsResizing] = useState(false)
	const [startX, setStartX] = useState(0)
	const [startWidth, setStartWidth] = useState(600)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingsRef = useRef<Drawing[]>([])
  
  // Mobile/tablet detection and responsive sidebar state
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const rightSidebarOpenRef = useRef(rightSidebarOpen)
  
  // Keep ref in sync with state
  useEffect(() => {
    rightSidebarOpenRef.current = rightSidebarOpen
  }, [rightSidebarOpen])

  useEffect(() => {
    drawingsRef.current = drawings
  }, [drawings])
  
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      const mobile = width < 768
      const tablet = width >= 768 && width < 1024
      setIsMobile(mobile)
      setIsTablet(tablet)
      // On mobile, default sidebar to closed
      if (mobile && rightSidebarOpenRef.current) {
        setRightSidebarOpen(false)
      }
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])
  
  const commentPersistenceRef = useRef<CommentPersistence | null>(null)
  const measurementPersistenceRef = useRef<MeasurementPersistence | null>(null)
  const supabase = createClient()

  const jobId = params.jobId as string
  const planId = params.planId as string

  // Track current takeoff analysis row id for updates
  const [takeoffAnalysisRowId, setTakeoffAnalysisRowId] = useState<string | null>(null)

  const ensureItemIds = (items: any[]): any[] => {
    return (items || []).map((it: any) => ({
      ...it,
      id: it.id || crypto.randomUUID()
    }))
  }

  const ensureIssueIds = (issues: any[]): any[] => {
    return (issues || []).map((it: any) => ({
      ...it,
      id: it.id || crypto.randomUUID(),
      status: it.status || 'open'
    }))
  }

  // Initialize comment persistence and load comments
  useEffect(() => {
    const initializeAndLoadComments = async () => {
      if (user && planId) {
        // Initialize comment persistence
        commentPersistenceRef.current = new CommentPersistence(planId, user.id)
        
        // Load comments immediately after initialization
        try {
          const comments = await commentPersistenceRef.current.loadComments()
          console.log('Loaded comments:', comments.length)
          setDrawings(prev => {
            // Merge with existing non-comment drawings
            const nonCommentDrawings = prev.filter(d => d.type !== 'comment')
            return [...nonCommentDrawings, ...comments]
          })
        } catch (error) {
          console.error('Error loading comments:', error)
        }
      }
    }
    
    initializeAndLoadComments()
    return () => {
      // Cleanup if needed
    }
  }, [user, planId])

  useEffect(() => {
    let cancelled = false

    const initializeMeasurements = async () => {
      if (!planId || !user) {
        return
      }

      const persistence = new MeasurementPersistence(planId, user.id)
      measurementPersistenceRef.current = persistence

      try {
        const stored = await persistence.loadMeasurements()
        if (cancelled) {
          return
        }

        const existingMeasurements = drawingsRef.current.filter(isMeasurementDrawing)
        const storedIds = new Set(stored.map(measurement => measurement.id))
        const pendingLocal = existingMeasurements.filter(measurement => !storedIds.has(measurement.id))

        let mergedMeasurements = stored

        if (pendingLocal.length > 0) {
          const synced = await persistence.syncMeasurements([...stored, ...pendingLocal])
          if (cancelled) {
            return
          }
          mergedMeasurements = synced
        }

        if (cancelled) {
          return
        }

        setDrawings(prev => {
          const nonMeasurements = prev.filter(d => !isMeasurementDrawing(d))
          if (mergedMeasurements.length === 0) {
            return nonMeasurements
          }
          return [...nonMeasurements, ...mergedMeasurements]
        })
      } catch (error) {
        console.error('Error loading measurements:', error)
      }
    }

    initializeMeasurements()

    return () => {
      cancelled = true
      measurementPersistenceRef.current = null
    }
  }, [planId, user])

  // Load data and PDF images
  useEffect(() => {
    if (user && jobId && planId) {
      loadData()
      loadExistingAnalysis()
    }
  }, [user, jobId, planId])

  // Handle sidebar resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setStartX(e.clientX)
    setStartWidth(sidebarWidth)
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const deltaX = e.clientX - startX
      const newWidth = startWidth - deltaX
      
      // Clamp width between 600px and 800px
      const clampedWidth = Math.max(600, Math.min(800, newWidth))
      setSidebarWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, startX, startWidth])

  async function loadData() {
    try {
      setLoading(true)

      if (!user) {
        throw new Error('User not authenticated')
      }

      // Load job details via membership
      const membership = await getJobForUser(supabase, jobId, user.id, '*')
      if (!membership?.job) {
        throw new Error('Job not found or access denied')
      }
      setJob(membership.job as Job)

      // Load plan details
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .eq('job_id', jobId)
        .maybeSingle()

      if (planError || !planData) {
        throw planError || new Error('Plan not found or access denied')
      }
      setPlan(planData as Plan)

      // Get signed URL for PDF
      if (planData?.file_path) {
        let pdfUrl = planData.file_path
        
        if (!pdfUrl.startsWith('http')) {
          // Extract storage path from full URL if needed
          const storagePath = pdfUrl.includes('/storage/v1/object/public/') 
            ? pdfUrl.split('/storage/v1/object/public/')[1]
            : pdfUrl

          const { data: urlData } = await supabase.storage
            .from('job-plans')
            .createSignedUrl(storagePath, 3600)

          if (urlData) {
            pdfUrl = urlData.signedUrl
          }
        }
        
        setPlanUrl(pdfUrl)
        
        // Comments are now loaded separately in a useEffect that watches commentPersistenceRef
        // This ensures the ref is initialized before we try to load comments
      }

      // Load scale settings
      try {
        const response = await fetch(`/api/plan/scale-settings?planId=${planId}`, {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          if (data.settings && Object.keys(data.settings).length > 0) {
            console.log('Loaded scale settings:', data.settings)
            // Ensure page numbers are numbers, not strings
            // JavaScript object keys are always strings, but we need numeric keys for lookup
            const normalizedSettings: Record<number, ScaleSetting> = {}
            Object.entries(data.settings).forEach(([key, value]: [string, any]) => {
              const pageNum = Number(key)
              if (!isNaN(pageNum)) {
                normalizedSettings[pageNum] = value
                // Also store as string key for compatibility
                normalizedSettings[String(pageNum) as any] = value
              }
            })
            console.log('Loaded scale settings - original:', data.settings)
            console.log('Normalized scale settings:', normalizedSettings)
            console.log('Setting keys (numbers):', Object.keys(normalizedSettings).filter(k => !isNaN(Number(k))))
            console.log('Setting keys (all):', Object.keys(normalizedSettings))
            setMeasurementScaleSettings(normalizedSettings)
          } else {
            console.log('No scale settings found for plan')
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error('Error loading scale settings:', response.status, errorData)
        }
      } catch (error) {
        console.error('Error loading scale settings:', error)
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Save scale settings to database
  const saveScaleSettings = useCallback(async (pageNumber: number, setting: ScaleSetting) => {
    if (!planId) {
      console.error('Cannot save scale settings: planId is missing')
      return
    }
    
    // Ensure pageNumber is a valid integer
    const pageNum = Number.parseInt(String(pageNumber), 10)
    if (isNaN(pageNum) || pageNum < 1) {
      console.error('Invalid page number:', pageNumber)
      return
    }
    
    try {
      const response = await fetch('/api/plan/scale-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planId,
          pageNumber: pageNum,
          scaleRatio: setting.ratio,
          pixelsPerUnit: setting.pixelsPerUnit,
          unit: setting.unit
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to save scale settings:', {
          status: response.status,
          error: errorData,
          planId,
          pageNumber: pageNum,
          setting
        })
        throw new Error(errorData.error || `Failed to save scale settings: ${response.status}`)
      }
      
      const result = await response.json()
      console.log(`Successfully saved scale settings for page ${pageNum}:`, result)
      return result
    } catch (error) {
      console.error('Error saving scale settings:', error)
      throw error
    }
  }, [planId])

  // Load existing takeoff and quality analysis
  const loadExistingAnalysis = async () => {
    if (!planId || !user) return

    try {
      // Load takeoff analysis
      const { data: takeoffAnalysis } = await supabase
        .from('plan_takeoff_analysis')
        .select('*')
        .eq('plan_id', planId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (takeoffAnalysis) {
        console.log('Loading existing takeoff analysis:', takeoffAnalysis)
        setTakeoffAnalysisRowId(takeoffAnalysis.id)
        
        // Parse items if it's a string, otherwise use as-is
        let itemsArray = []
        try {
          if (typeof takeoffAnalysis.items === 'string') {
            const parsed = JSON.parse(takeoffAnalysis.items)
            itemsArray = parsed.takeoffs || []
          } else if (Array.isArray(takeoffAnalysis.items)) {
            itemsArray = takeoffAnalysis.items
          }
        } catch (parseError) {
          console.error('Error parsing takeoff items:', parseError)
          itemsArray = []
        }
        
        const itemsWithIds = ensureItemIds(itemsArray)
        
        // Extract quality_analysis from takeoff summary if it exists
        const qualityAnalysisFromTakeoff = takeoffAnalysis.summary?.quality_analysis
        const normalizedTradeScopeReview = qualityAnalysisFromTakeoff
          ? normalizeTradeScopeReview(
              qualityAnalysisFromTakeoff.trade_scope_review,
              qualityAnalysisFromTakeoff.risk_flags || []
            )
          : normalizeTradeScopeReview(null, [])
        const normalizedQualityAnalysisFromTakeoff = qualityAnalysisFromTakeoff
          ? {
              ...qualityAnalysisFromTakeoff,
              trade_scope_review: normalizedTradeScopeReview
            }
          : null
        
        setTakeoffResults({
          success: true,
          planId,
          taskType: 'takeoff',
          processingTime: takeoffAnalysis.processing_time_ms || 0,
          consensus: {
            confidence: takeoffAnalysis.confidence_scores?.consensus || 0.8,
            consensusCount: takeoffAnalysis.confidence_scores?.model_count || 1
          },
          results: {
            items: itemsWithIds,
            summary: takeoffAnalysis.summary || {},
            quality_analysis: normalizedQualityAnalysisFromTakeoff || undefined // Include quality analysis from takeoff
          }
        })
        
        // If quality_analysis is in takeoff results, populate quality tab
        if (normalizedQualityAnalysisFromTakeoff) {
          const issuesFromQA = normalizedQualityAnalysisFromTakeoff.risk_flags?.map((rf: any) => ({
            id: crypto.randomUUID(),
            severity: rf.level === 'high' ? 'critical' : rf.level === 'medium' ? 'warning' : 'info',
            category: rf.category || 'general',
            description: rf.description || '',
            location: rf.location || '',
            recommendation: rf.recommendation || '',
            status: 'open'
          })) || []
          
          // Set issues at top level to match API response format for frontend display
          setQualityResults({
            success: true,
            planId,
            taskType: 'takeoff',
            issues: issuesFromQA, // Top level for frontend compatibility
            results: {
              issues: issuesFromQA,
              quality_analysis: normalizedQualityAnalysisFromTakeoff
            }
          })
        }
        
        // Prepare items for BidPackageModal
        const items = itemsWithIds.map((it: any, idx: number) => ({
          id: it.id,
          category: it.category || 'General Contractor',
          description: it.description || it.item_description || 'Line item',
          quantity: typeof it.quantity === 'number' ? it.quantity : Number(it.quantity) || 1,
          unit: it.unit || 'unit',
          unit_cost: typeof it.unit_cost === 'number' ? it.unit_cost : Number(it.unit_cost) || undefined
        }))
        setModalTakeoffItems(items)
      }

      // Load quality analysis from plan_quality_analysis table (separate from takeoff)
      const { data: qualityAnalysis, error: qualityError } = await supabase
        .from('plan_quality_analysis')
        .select('*')
        .eq('plan_id', planId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (qualityAnalysis && !qualityError) {
        console.log('Loading existing quality analysis:', qualityAnalysis)
        setQualityAnalysisRowId(qualityAnalysis.id)
        
        // Parse issues if needed
        let issuesArray = []
        try {
          if (typeof qualityAnalysis.issues === 'string') {
            issuesArray = JSON.parse(qualityAnalysis.issues)
          } else if (Array.isArray(qualityAnalysis.issues)) {
            issuesArray = qualityAnalysis.issues
          } else if (qualityAnalysis.findings_by_severity) {
            // Combine issues from severity buckets
            issuesArray = [
              ...(qualityAnalysis.findings_by_severity.critical || []),
              ...(qualityAnalysis.findings_by_severity.warning || []),
              ...(qualityAnalysis.findings_by_severity.info || [])
            ]
          }
        } catch (parseError) {
          console.error('Error parsing quality issues:', parseError)
          issuesArray = []
        }
        
        const issuesWithIds = ensureIssueIds(issuesArray)
        
        // Build quality_analysis object from DB data
        const tradeScopeReview = normalizeTradeScopeReview(qualityAnalysis.trade_scope_review, issuesArray)

        const qualityAnalysisObj = {
          completeness: {
            overall_score: qualityAnalysis.overall_score || 0.8,
            missing_sheets: [],
            missing_dimensions: qualityAnalysis.missing_details || [],
            missing_details: qualityAnalysis.missing_details || [],
            incomplete_sections: [],
            notes: 'Quality analysis loaded from database'
          },
          consistency: {
            scale_mismatches: [],
            unit_conflicts: [],
            dimension_contradictions: [],
            schedule_vs_elevation_conflicts: [],
            notes: 'Consistency check from database'
          },
          risk_flags: issuesArray.map((issue: any) => ({
            level: issue.severity === 'critical' ? 'high' : issue.severity === 'warning' ? 'medium' : 'low',
            category: issue.category || 'general',
            description: issue.description || issue.detail || issue.message || '',
            location: issue.location || '',
            recommendation: issue.recommendation || ''
          })),
          audit_trail: {
            pages_analyzed: [],
            chunks_processed: 1,
            coverage_percentage: 100,
            assumptions_made: []
          },
          trade_scope_review: tradeScopeReview
        }
        
        // Set issues at top level to match API response format for frontend display
        setQualityResults({
          success: true,
          planId,
          taskType: 'quality',
          processingTime: qualityAnalysis.processing_time_ms || 0,
          issues: issuesWithIds, // Top level for frontend compatibility
          results: {
            issues: issuesWithIds,
            quality_analysis: qualityAnalysisObj
          }
        })
      } else if (qualityError && qualityError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is fine
        console.error('Error loading quality analysis:', qualityError)
      }
    } catch (error) {
      console.error('Error loading existing analysis:', error)
    }
  }

  const persistTakeoffItems = useCallback(async (updatedItems: any[]) => {
    if (!user) return
    try {
      let rowId = takeoffAnalysisRowId
      if (!rowId) {
        const { data } = await supabase
          .from('plan_takeoff_analysis')
          .select('id')
          .eq('plan_id', planId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        rowId = data?.id || null
        if (rowId) setTakeoffAnalysisRowId(rowId)
      }
      if (!rowId) return
      await supabase
        .from('plan_takeoff_analysis')
        .update({ items: updatedItems })
        .eq('id', rowId)
    } catch (e) {
      console.error('Failed to persist takeoff items:', e)
    }
  }, [planId, supabase, takeoffAnalysisRowId, user])

  const handleItemsChange = useCallback((updatedItems: any[]) => {
    setTakeoffResults((prev: any) => prev ? ({
      ...prev,
      results: { ...prev.results, items: updatedItems }
    }) : prev)
    persistTakeoffItems(updatedItems)
    // Also reflect in BidPackage modal set
    const items = updatedItems.map((it: any) => ({
      id: it.id,
      category: it.category || 'General Contractor',
      description: it.description || it.item_description || it.name || 'Line item',
      quantity: typeof it.quantity === 'number' ? it.quantity : Number(it.quantity) || 1,
      unit: it.unit || 'unit',
      unit_cost: typeof it.unit_cost === 'number' ? it.unit_cost : Number(it.unit_cost) || undefined
    }))
    setModalTakeoffItems(items)
  }, [persistTakeoffItems])

  // Handle quality mode change
  const handleQualityModeChange = useCallback((mode: QualityMode) => {
    setQualityMode(mode)
    // Map quality mode to scale: performance (1.0) -> balanced (1.5) -> quality (2.0)
    const scaleMap = { performance: 1.0, balanced: 1.5, quality: 2.0 }
    setScale(scaleMap[mode])
  }, [])

  // Handle clear cache
  const handleClearCache = useCallback(() => {
    // Clear the PDF pages and reload them
    setPlanUrl('')
    setTimeout(() => {
      setPlanUrl(plan?.file_path || '')
    }, 100)
  }, [plan])

  // Handle drawings change and save
  const handleDrawingsChange = useCallback(async (newDrawings: Drawing[]) => {
    setDrawings(newDrawings)

    const persistence = measurementPersistenceRef.current
    if (!persistence) {
      return
    }

    try {
      const measurementDrawings = newDrawings.filter(isMeasurementDrawing)
      const syncedMeasurements = await persistence.syncMeasurements(measurementDrawings)

      setDrawings(current => {
        const nonMeasurements = current.filter(d => !isMeasurementDrawing(d))
        return [...nonMeasurements, ...syncedMeasurements]
      })
    } catch (error) {
      console.error('Failed to sync measurements:', error)
    }
  }, [])

  // Handle comment pin click (to place new comment)
  const handleCommentPinClick = useCallback((x: number, y: number, pageNumber: number) => {
    setCommentPosition({ x, y, pageNumber })
    setCommentFormOpen(true)
  }, [])

  // Handle comment click (to view existing comment)
  const handleCommentClick = useCallback((comment: Drawing) => {
    // Comment popup is now handled directly in FastPlanCanvas component
    // No additional action needed here
  }, [])

  // Handle comment save
  const handleCommentSave = useCallback(async (comment: {
    noteType: 'requirement' | 'concern' | 'suggestion' | 'other'
    content: string
    category?: string
    location?: string
  }) => {
    try {
      const newDrawing: Drawing = {
        id: Date.now().toString(),
        type: 'comment',
        geometry: {
          x: commentPosition.x,
          y: commentPosition.y,
        },
        style: {
          color: '#3b82f6',
          strokeWidth: 2,
          opacity: 1
        },
        pageNumber: commentPosition.pageNumber,
        notes: comment.content,
        noteType: comment.noteType,
        category: comment.category,
        label: comment.category,
        location: comment.location,
        layerName: comment.location,
        isVisible: true,
        isLocked: false,
        userId: user?.id,
        userName: user?.email,
        createdAt: new Date().toISOString()
      }

      // Save using comment persistence
      if (commentPersistenceRef.current) {
        await commentPersistenceRef.current.saveComment(newDrawing)
        // Reload comments
        const comments = await commentPersistenceRef.current.loadComments()
        setDrawings(prev => [...prev.filter(d => d.type !== 'comment'), ...comments])
      } else {
        // Fallback to old method
        await handleDrawingsChange([...drawings, newDrawing])
      }
    } catch (error) {
      console.error('Error saving comment:', error)
      alert('Failed to save comment. Please try again.')
    }
  }, [commentPosition, drawings, handleDrawingsChange, user])

  // Handle comment reply
  const handleCommentReply = useCallback(async (parentId: string, content: string) => {
    try {
      const parentComment = drawings.find(d => d.id === parentId)
      if (!parentComment) {
        throw new Error('Parent comment not found')
      }

      const newReply: Drawing = {
        id: Date.now().toString(),
        type: 'comment',
        geometry: parentComment.geometry,
        style: {
          color: '#3b82f6',
          strokeWidth: 2,
          opacity: 1
        },
        pageNumber: parentComment.pageNumber,
        notes: content,
        noteType: 'other',
        isVisible: true,
        isLocked: false,
        userId: user?.id,
        userName: user?.email,
        createdAt: new Date().toISOString(),
        parentCommentId: parentId
      }

      // Save using comment persistence
      if (commentPersistenceRef.current) {
        await commentPersistenceRef.current.saveComment(newReply)
        // Reload comments
        const comments = await commentPersistenceRef.current.loadComments()
        setDrawings(prev => [...prev.filter(d => d.type !== 'comment'), ...comments])
      } else {
        // Fallback to old method
        await handleDrawingsChange([...drawings, newReply])
      }
    } catch (error) {
      console.error('Error saving reply:', error)
      alert('Failed to save reply. Please try again.')
    }
  }, [drawings, handleDrawingsChange, user])

  // Handle comment resolution
  const handleCommentResolve = useCallback(async (commentId: string) => {
    try {
      // Save using comment persistence
      if (commentPersistenceRef.current) {
        await commentPersistenceRef.current.updateComment(commentId, {
          isResolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedBy: user?.id,
          resolvedByUsername: user?.email
        })
        // Reload comments
        const comments = await commentPersistenceRef.current.loadComments()
        setDrawings(prev => [...prev.filter(d => d.type !== 'comment'), ...comments])
      } else {
        // Fallback to old method
        const updatedDrawings = drawings.map(d => {
          if (d.id === commentId) {
            return {
              ...d,
              isResolved: true,
              resolvedAt: new Date().toISOString(),
              resolvedBy: user?.id,
              resolvedByUsername: user?.email
            }
          }
          return d
        })
        await handleDrawingsChange(updatedDrawings)
      }
    } catch (error) {
      console.error('Error resolving comment:', error)
      alert('Failed to resolve comment. Please try again.')
    }
  }, [drawings, handleDrawingsChange, user])

  // Helper function to convert PDF to images using PDF.js
  const convertPdfToImages = async (retryCount = 0) => {
    if (!planUrl) throw new Error('Plan URL not available')
    
    setAnalysisProgress({ step: 'Loading PDF pages...', percent: 10 })
    
    // Load PDF.js
    const pdfjs = await import('pdfjs-dist')
    
    // Configure worker
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    }
    
    setAnalysisProgress({ step: 'Rendering PDF pages...', percent: 20 })
    
    // Load PDF document
    const loadingTask = pdfjs.getDocument(planUrl)
    const pdf = await loadingTask.promise
    
    const images: string[] = []
    // Convert ALL pages for comprehensive analysis
    const totalPages = pdf.numPages
    
    // Store totalPages in ref for use in error handling
    ;(convertPdfToImages as any).lastTotalPages = totalPages
    
    // For very large PDFs, reject early instead of trying to convert
    // This prevents browser crashes and timeout issues
    if (totalPages > 200) {
      throw new Error(`PDF too large: ${totalPages} pages. Maximum supported: 200 pages. Please split the document or contact support.`)
    }
    
    // Process all pages - no limits for comprehensive analysis
    const pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1)
    
    const pagesToConvert = pagesToProcess.length
    
    setAnalysisProgress({ step: `Converting ${pagesToConvert} page${pagesToConvert > 1 ? 's' : ''} to images...`, percent: 30 })
    
    for (let i = 0; i < pagesToProcess.length; i++) {
      const pageNum = pagesToProcess[i]
      const progress = 30 + ((i + 1) / pagesToProcess.length) * 30
      setAnalysisProgress({ step: `Processing page ${pageNum} of ${totalPages} (${i + 1}/${pagesToProcess.length} selected)...`, percent: progress })
      
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 0.8 }) // Very small scale for minimal payload
      
      // Create temporary canvas
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error('Failed to get 2D context from canvas')
      }
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      // Convert to JPEG base64 with extremely low quality to minimize payload
      const dataUrl = canvas.toDataURL('image/jpeg', 0.3)
      
      // Remove data URL prefix to just get base64 string for smaller payload
      const base64 = dataUrl.split(',')[1]
      images.push(base64)
    }
    
    setAnalysisProgress({ step: 'Images ready!', percent: 70 })
    return images
  }

  // Handle AI takeoff analysis with retry mechanism
  const handleRunAITakeoff = async (retryCount = 0) => {
    if (!plan || !planUrl) {
      alert('Plan not loaded yet')
      return
    }

    setIsRunningTakeoff(true)
    setAnalysisProgress({ step: 'Starting analysis...', percent: 0 })
    
    // For very large PDFs, queue immediately without trying to convert
    // This prevents browser crashes and timeout issues
    if (plan.num_pages && plan.num_pages > 100) {
      console.log(`Very large PDF detected: ${plan.num_pages} pages. Queueing immediately without conversion.`)
      setAnalysisProgress({ step: 'Queueing large PDF for processing...', percent: 75 })
      
      try {
        const { data: queueEntry, error: queueError } = await supabase
          .from('ai_takeoff_queue')
          .insert({
            plan_id: planId,
            user_id: user?.id,
            job_id: plan.job_id || job?.id || null,
            task_type: 'takeoff',
            job_type: job?.project_type === 'Commercial' ? 'commercial' : job?.project_type ? 'residential' : null,
            images_count: plan.num_pages || 0,
            request_data: {
              images_count: plan.num_pages || 0,
              task_type: 'takeoff',
              job_type: job?.project_type === 'Commercial' ? 'commercial' : job?.project_type ? 'residential' : null,
              too_large_for_browser: true,
              num_pages: plan.num_pages
            },
            status: 'pending',
            priority: 0
          })
          .select()
          .single()
        
        if (!queueError && queueEntry) {
          setAnalysisProgress({ 
            step: 'AI Takeoff queued. Estimated time: 2-3 hours. You will be notified when it is complete.', 
            percent: 100 
          })
          
          setTimeout(() => {
            setIsRunningTakeoff(false)
            setAnalysisProgress({ step: '', percent: 0 })
          }, 5000)
          return
        }
      } catch (error) {
        console.error('Failed to queue large PDF:', error)
        setIsRunningTakeoff(false)
        alert(`This PDF is too large (${plan.num_pages} pages). Please contact support or split the document.`)
        return
      }
    }
    
    // Calculate realistic time estimate based on page count
    const calculateTimeEstimate = (totalPages: number): string => {
      // Base time: 30 seconds per page for conversion, 60 seconds per page for AI analysis
      // Fastest observed: 60-90s for small docs, scales with pages
      const baseSeconds = 60 // Minimum time
      const perPageSeconds = 5 // Rough average per page
      const totalSeconds = baseSeconds + (totalPages * perPageSeconds)
      
      if (totalSeconds < 60) return `${totalSeconds}-${totalSeconds + 30} seconds`
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return `${minutes}-${minutes + 1} minutes`
    }

    try {
      // Step 1: Convert PDF to images (0-70%)
      const images = await convertPdfToImages(retryCount)
      const totalPages = images.length

      // Step 2: Send to AI (70-90%)
      const timeEstimate = calculateTimeEstimate(totalPages)
      setAnalysisProgress({ step: 'Analyzing with AI...', percent: 75, timeEstimate })
      const startTime = Date.now()
      
      const analysisResponse = await fetch('/api/plan/analyze-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planId,
          images: images,
          drawings: drawings,
          taskType: 'takeoff'
        })
      })

      // Handle queued response (202 Accepted)
      if (analysisResponse.status === 202) {
        const queueData = await analysisResponse.json()
        
        // Update progress to show queued message
        setAnalysisProgress({ 
          step: `AI Takeoff underway. Estimated time: ${queueData.estimatedTime || '2-3 hours'}. You will be notified when it is complete.`, 
          percent: 100 
        })
        
        // Keep the UI showing the message for a bit, then allow them to close it
        setTimeout(() => {
          setIsRunningTakeoff(false)
        }, 5000) // Show for 5 seconds then allow closing
        
        return
      }

      if (!analysisResponse.ok) {
        if (analysisResponse.status === 413) {
          // Check if server suggests using batch endpoint
          let errorData
          try {
            errorData = await analysisResponse.json()
          } catch (parseError) {
            // Fallback if JSON parse fails
            throw new Error('Request too large - try with fewer pages or lower quality images')
          }
          
          // If server suggests batch, automatically retry with batch endpoint
          if (errorData.suggestBatch) {
            console.log(`Auto-switching to batch endpoint for ${errorData.totalPages} pages`)
            setAnalysisProgress({ step: 'Switching to batch processing...', percent: 75 })
            
            // Retry with batch endpoint
            const batchResponse = await fetch('/api/plan/analyze-enhanced-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: planId,
                images: images,
                drawings: drawings,
                taskType: 'takeoff'
              })
            })
            
            if (!batchResponse.ok) {
              throw new Error(errorData.message || 'Batch processing also failed')
            }
            
            // Continue with batch response
            const batchAnalysisData = await batchResponse.json()
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
            setAnalysisProgress({ step: 'Complete!', percent: 100 })
            
            setTakeoffResults(batchAnalysisData)
            
            // Handle quality results from batch
            if (batchAnalysisData.results?.issues || batchAnalysisData.results?.quality_analysis) {
              const apiIssues = batchAnalysisData?.results?.issues || []
              const issuesWithIds = ensureIssueIds(apiIssues)
              setQualityResults({ ...batchAnalysisData, issues: issuesWithIds })
              
              try {
                const { data } = await supabase
                  .from('plan_quality_analysis')
                  .select('id')
                  .eq('plan_id', planId)
                  .eq('user_id', user?.id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single()
                if (data?.id) setQualityAnalysisRowId(data.id)
              } catch (e) {
                console.warn('Could not fetch quality analysis row id')
              }
            }
            
            setTimeout(() => {
              setIsRunningTakeoff(false)
              setAnalysisProgress({ step: '', percent: 0 })
            }, 2000)
            
            return // Success with batch endpoint
          }
          
          // Otherwise throw the original error
          throw new Error(errorData.message || 'Request too large')
        }
        
        let errorData
        try {
          errorData = await analysisResponse.json()
        } catch (parseError) {
          // If JSON parsing fails, it might be an HTML error page
          const errorText = await analysisResponse.text()
          throw new Error(`Server error (${analysisResponse.status}): ${errorText.substring(0, 200)}...`)
        }
        throw new Error(errorData.error || 'Analysis failed')
      }

      setAnalysisProgress({ step: 'Processing results...', percent: 90 })
      const analysisData = await analysisResponse.json()
      
      // Step 3: Complete (90-100%)
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
      setAnalysisProgress({ step: 'Complete!', percent: 100 })
      
      setTakeoffResults(analysisData)
      
      // Also populate quality results if present (API now returns both takeoff and quality)
      if (analysisData.results?.issues || analysisData.results?.quality_analysis) {
        const apiIssues = analysisData?.results?.issues || []
        const issuesWithIds = ensureIssueIds(apiIssues)
        setQualityResults({ ...analysisData, issues: issuesWithIds })
        
        // Fetch quality analysis row id if it was saved
        try {
          const { data } = await supabase
            .from('plan_quality_analysis')
            .select('id')
            .eq('plan_id', planId)
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          if (data?.id) setQualityAnalysisRowId(data.id)
        } catch (e) {
          console.warn('Could not fetch quality analysis row id')
        }
      }
      
      // Complete analysis
      setTimeout(() => {
        setAnalysisProgress({ step: '', percent: 0 })
        setIsRunningTakeoff(false)
      }, 500)
      
    } catch (error) {
      console.error('Error running AI takeoff:', error)
      
      // Last resort: Queue the request instead of showing error
      try {
        console.log('Queueing request as fallback due to error')
        setAnalysisProgress({ step: 'Queueing request for manual processing...', percent: 75 })
        
        // Insert into queue
        const { data: queueEntry, error: queueError } = await supabase
          .from('ai_takeoff_queue')
          .insert({
            plan_id: planId,
            user_id: user?.id,
            job_id: plan.job_id || job?.id || null,
            task_type: 'takeoff',
            job_type: job?.project_type === 'Commercial' ? 'commercial' : job?.project_type ? 'residential' : null,
            images_count: (convertPdfToImages as any).lastTotalPages || 0,
            request_data: {
              task_type: 'takeoff',
              error_fallback: true,
              original_error: error instanceof Error ? error.message : 'Unknown error'
            },
            status: 'pending',
            priority: 0
          })
          .select()
          .single()
        
        if (!queueError && queueEntry) {
          // Successfully queued
          setAnalysisProgress({ 
            step: 'AI Takeoff queued. Estimated time: 2-3 hours. You will be notified when it is complete.', 
            percent: 100 
          })
          
          setTimeout(() => {
            setIsRunningTakeoff(false)
            setAnalysisProgress({ step: '', percent: 0 })
          }, 5000)
          return
        }
      } catch (queueRetryError) {
        console.error('Failed to queue request:', queueRetryError)
      }
      
      // If queueing also failed, show error
      setAnalysisProgress({ step: '', percent: 0 })
      alert(`Failed to run AI takeoff: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsRunningTakeoff(false)
    } finally {
      // Analysis completed, but keep running state until success message is shown
      // setIsRunningTakeoff(false) is called in the success timeout
    }
  }

  // Handle quality check analysis
  const handleRunQualityCheck = async () => {
    if (!plan || !planUrl) {
      alert('Plan not loaded yet')
      return
    }

    setIsRunningQuality(true)
    setAnalysisProgress({ step: 'Starting analysis...', percent: 0 })

    try {
      // Step 1: Convert PDF to images (0-70%)
      const images = await convertPdfToImages()

      // Step 2: Send to AI (70-90%)
      setAnalysisProgress({ step: 'Analyzing with AI...', percent: 75 })
      const analysisResponse = await fetch('/api/plan/analyze-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planId,
          images: images,
          drawings: drawings,
          taskType: 'quality'
        })
      })

      if (!analysisResponse.ok) {
        if (analysisResponse.status === 413) {
          // Check if server suggests using batch endpoint
          let errorData
          try {
            errorData = await analysisResponse.json()
          } catch (parseError) {
            throw new Error('Request too large - try with fewer pages or lower quality images')
          }
          
          // If server suggests batch, automatically retry with batch endpoint
          if (errorData.suggestBatch) {
            console.log(`Auto-switching to batch endpoint for ${errorData.totalPages} pages`)
            setAnalysisProgress({ step: 'Switching to batch processing...', percent: 75 })
            
            const batchResponse = await fetch('/api/plan/analyze-enhanced-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: planId,
                images: images,
                drawings: drawings,
                taskType: 'quality'
              })
            })
            
            if (!batchResponse.ok) {
              throw new Error(errorData.message || 'Batch processing also failed')
            }
            
            const batchAnalysisData = await batchResponse.json()
            setAnalysisProgress({ step: 'Complete!', percent: 100 })
            
            const apiIssues = batchAnalysisData?.results?.issues || batchAnalysisData?.issues || []
            const issuesWithIds = ensureIssueIds(apiIssues)
            setQualityResults({ ...batchAnalysisData, issues: issuesWithIds })
            
            try {
              const { data } = await supabase
                .from('plan_quality_analysis')
                .select('id')
                .eq('plan_id', planId)
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
              if (data?.id) setQualityAnalysisRowId(data.id)
            } catch (e) {
              console.warn('Could not fetch quality analysis row id')
            }
            
            setTimeout(() => {
              setIsRunningQuality(false)
              setAnalysisProgress({ step: '', percent: 0 })
            }, 2000)
            
            return
          }
          
          throw new Error(errorData.message || 'Request too large')
        }
        
        let errorData
        try {
          errorData = await analysisResponse.json()
        } catch (parseError) {
          const errorText = await analysisResponse.text()
          throw new Error(`Server error (${analysisResponse.status}): ${errorText.substring(0, 200)}...`)
        }
        throw new Error(errorData.error || 'Quality analysis failed')
      }

      setAnalysisProgress({ step: 'Processing results...', percent: 90 })
      const analysisData = await analysisResponse.json()
      // Normalize issue IDs and status (support API response under results.issues)
      const apiIssues = analysisData?.results?.issues || analysisData?.issues || []
      const issuesWithIds = ensureIssueIds(apiIssues)
      setQualityResults({ ...analysisData, issues: issuesWithIds })
      // Fetch latest analysis row id for persistence updates
      try {
        const { data } = await supabase
          .from('plan_quality_analysis')
          .select('id')
          .eq('plan_id', planId)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (data?.id) setQualityAnalysisRowId(data.id)
      } catch (e) {
        console.warn('Could not fetch quality analysis row id')
      }
      const issueCount = analysisData.issues?.length || 0
      alert(`Quality check complete! Found ${issueCount} issue${issueCount !== 1 ? 's' : ''}.`)
      // Step 3: Complete (90-100%)
      setAnalysisProgress({ step: 'Complete!', percent: 100 })
      setTimeout(() => {
        setAnalysisProgress({ step: '', percent: 0 })
        setIsRunningQuality(false)
      }, 500)

    } catch (error) {
      console.error('Error running quality check:', error)
      alert(`Failed to run quality check: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsRunningQuality(false)
      setAnalysisProgress({ step: '', percent: 0 })
    }
  }

  // Resolve a single quality issue and persist
  const handleResolveQualityIssue = useCallback(async (issueId: string) => {
    setQualityResults((prev: any) => {
      if (!prev?.issues) return prev
      const updatedIssues = prev.issues.map((iss: any) => iss.id === issueId ? {
        ...iss,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id
      } : iss)
      return { ...prev, issues: updatedIssues }
    })

    try {
      let rowId = qualityAnalysisRowId
      if (!rowId) {
        const { data } = await supabase
          .from('plan_quality_analysis')
          .select('id')
          .eq('plan_id', planId)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        rowId = data?.id || null
        if (rowId) setQualityAnalysisRowId(rowId)
      }
      if (!rowId) return

      // Persist updated issues
      const issuesToSave = (qualityResults?.issues || []).map((iss: any) => iss.id === issueId ? {
        ...iss,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id
      } : iss)

      await supabase
        .from('plan_quality_analysis')
        .update({ issues: issuesToSave })
        .eq('id', rowId)
    } catch (e) {
      console.error('Failed to persist issue resolution:', e)
    }
  }, [planId, qualityAnalysisRowId, supabase, user, qualityResults])

  // Handle share link generation
  const handleGenerateShareLink = async () => {
    if (!plan) {
      alert('Plan not loaded yet')
      return
    }

    setIsGeneratingShare(true)

    try {
      const response = await fetch('/api/share-link/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planId,
          type: 'plan'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate share link')
      }

      const data = await response.json()
      const fullUrl = `${window.location.origin}/share/${data.shareId}`
      setShareLink(fullUrl)
      
      // Copy to clipboard
      await navigator.clipboard.writeText(fullUrl)
      alert(`Share link generated and copied to clipboard!`)
      
    } catch (error) {
      console.error('Error generating share link:', error)
      alert(`Failed to generate share link: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGeneratingShare(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!job || !plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Not Found</h2>
          <p className="text-gray-600 mb-4">This plan doesn't exist or you don't have access to it.</p>
          <Link href={`/dashboard/jobs/${jobId}`}>
            <Button>Back to Job</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 p-2 md:p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 md:space-x-4 min-w-0 flex-1">
              <Link href={`/dashboard/jobs/${jobId}`}>
                <Button variant="ghost" size="sm" className="h-9">
                  <ArrowLeft className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Back to Job</span>
                </Button>
              </Link>
              <div className="text-xs md:text-sm text-gray-600 truncate">
                <span className="font-medium">{job.name}</span> - <span className="hidden sm:inline">{plan.title || plan.file_name}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 md:space-x-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => setShowShareModal(true)} className="h-9">
                <Share2 className="h-4 w-4" />
                <span className="hidden lg:inline ml-2">Share</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowPackageModal(true)} className="h-9">
                <Package className="h-4 w-4" />
                <span className="hidden lg:inline ml-2">Package</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowBidsModal(true)} className="h-9">
                <Eye className="h-4 w-4" />
                <span className="hidden lg:inline ml-2">Bids</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => console.log('Save clicked')} className="h-9 hidden md:flex">
                <Save className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Save</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                if (planUrl) {
                  window.open(planUrl, '_blank')
                }
              }} className="h-9 hidden md:flex">
                <Download className="h-4 w-4 md:mr-2" />
                <span className="hidden lg:inline">Download</span>
              </Button>
              <div className="hidden md:block">
                <PdfQualitySettings
                  qualityMode={qualityMode}
                  onQualityModeChange={handleQualityModeChange}
                  onClearCache={handleClearCache}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex relative" ref={containerRef}>
          <div 
            className="flex-1 min-w-0"
            style={{ 
              width: rightSidebarOpen && !isMobile && !isTablet 
                ? `calc(100% - ${sidebarWidth}px - 1px)` 
                : '100%' 
            }}
          >
            {planUrl ? (
              <FastPlanCanvas
                pdfUrl={planUrl}
                drawings={drawings}
                onDrawingsChange={handleDrawingsChange}
                rightSidebarOpen={rightSidebarOpen}
                onRightSidebarToggle={() => setRightSidebarOpen(!rightSidebarOpen)}
                onCommentPinClick={handleCommentPinClick}
                onCommentClick={handleCommentClick}
                goToPage={goToPage}
                scale={scale}
                onClearCache={handleClearCache}
                measurementScaleSettings={measurementScaleSettings}
                onPageChange={setCurrentPage}
                onNumPagesChange={setPdfNumPages}
                onOpenScaleSettings={() => {
                  // Don't clear calibration points when opening - preserve them if they exist
                  setScaleSettingsModalOpen(true)
                  // Only clear isCalibrating if we're not in calibration mode
                  // This allows the modal to reopen with points after calibration
                  if (!isCalibrating) {
                    setIsCalibrating(false)
                  }
                }}
                onCalibrationPointsChange={setCalibrationPoints}
                calibrationPoints={calibrationPoints}
                isCalibrating={isCalibrating}
                onSetCalibrating={setIsCalibrating}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <FallingBlocksLoader />
                  <p className="text-sm text-gray-600 mt-4">Loading PDF...</p>
                </div>
              </div>
            )}
          </div>

          {/* Resize Handle - Hidden on mobile/tablet */}
          {rightSidebarOpen && !isMobile && !isTablet && (
            <div
              className="w-1 bg-gray-200 hover:bg-gray-300 cursor-ew-resize transition-colors z-30 hidden lg:block"
              onMouseDown={handleMouseDown}
            />
          )}

          {/* Right Sidebar - Drawer on mobile/tablet, sidebar on desktop */}
          <AnimatePresence>
            {rightSidebarOpen && (
              <>
                {/* Mobile/Tablet Overlay */}
                {(isMobile || isTablet) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:z-30"
                    onClick={() => setRightSidebarOpen(false)}
                  />
                )}
                
                <motion.div
                  ref={sidebarRef}
                  variants={drawerSlide}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={`bg-white border-l border-gray-200 flex flex-col overflow-y-auto ${
                    isMobile || isTablet 
                      ? 'fixed right-0 top-0 bottom-0 w-full z-50 shadow-xl h-screen' 
                      : 'relative'
                  }`}
                  style={{ 
                    width: isMobile
                      ? '100vw'
                      : isTablet
                        ? 'min(90vw, 640px)'
                        : `${sidebarWidth}px`,
                    ...(isMobile || isTablet 
                      ? { height: '100vh' }
                      : { height: 'calc(100vh - 80px)', maxHeight: 'calc(100vh - 80px)' }
                    )
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                <div className="p-3 md:p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-base md:text-lg">Analysis</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRightSidebarOpen(false)}
                      className="h-9 w-9"
                    >
                      <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AnalysisMode)} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-4 mx-2 md:mx-4 mt-2 md:mt-4 mb-0 gap-1 flex-shrink-0">
                      <TabsTrigger value="takeoff" className="text-xs md:text-sm px-2 md:px-4">
                        <BarChart3 className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                        <span className="hidden sm:inline">Takeoff</span>
                      </TabsTrigger>
                      <TabsTrigger value="quality" className="text-xs md:text-sm px-2 md:px-4">
                        <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                        <span className="hidden sm:inline">Quality</span>
                      </TabsTrigger>
                      <TabsTrigger value="chat" className="text-xs md:text-sm px-2 md:px-4">
                        <Bot className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                        <span className="hidden sm:inline">Chat</span>
                      </TabsTrigger>
                      <TabsTrigger value="comments" className="text-xs md:text-sm px-2 md:px-4">
                        <MessageSquare className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                        <span className="hidden sm:inline">Comments</span>
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 overflow-y-auto p-2 md:p-4 pb-6">
                      <TabsContent value="takeoff" className="mt-0">
                        <div className="space-y-3 md:space-y-4">
                          <Button 
                            className="w-full h-10 md:h-auto" 
                            onClick={() => handleRunAITakeoff()}
                            disabled={isRunningTakeoff}
                          >
                            {isRunningTakeoff ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Run AI Takeoff
                              </>
                            )}
                          </Button>
                          {(isRunningTakeoff || (analysisProgress.percent === 100 && analysisProgress.step.includes('underway'))) && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{analysisProgress.step}</span>
                                {analysisProgress.percent < 100 && (
                                  <span className="text-gray-600">{Math.round(analysisProgress.percent)}%</span>
                                )}
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-blue-600 h-2 transition-all duration-300 ease-out rounded-full"
                                  style={{ width: `${analysisProgress.percent}%` }}
                                />
                              </div>
                              {analysisProgress.step.includes('underway') ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                  <p className="text-xs text-blue-800 font-medium">
                                    ✅ Your request has been queued for processing. You will receive an email notification when the AI takeoff is complete.
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">
                                  Estimated time: {analysisProgress.timeEstimate || 'Calculating...'}
                                </p>
                              )}
                            </div>
                          )}
                          {takeoffResults ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900">
                                  Takeoff Results ({takeoffResults.results?.items?.length || 0} items)
                                </h4>
                                <Badge variant="outline" className="text-xs">
                                  {takeoffResults.consensus?.confidence ? 
                                    `${Math.round(takeoffResults.consensus.confidence * 100)}% confidence` : 
                                    'High confidence'
                                  }
                                </Badge>
                              </div>
                              <TakeoffAccordion
                                items={takeoffResults.results?.items || []}
                                summary={takeoffResults.results?.summary}
                                onPageNavigate={handlePageNavigate}
                                editable
                                onItemsChange={handleItemsChange}
                              />
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                              <h4 className="font-semibold text-gray-900 mb-2">No takeoff data yet</h4>
                              <p className="text-sm text-gray-600">Run AI analysis to generate takeoff items</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="quality" className="mt-0">
                        <div className="space-y-4">
                          <Button 
                            className="w-full"
                            onClick={handleRunQualityCheck}
                            disabled={isRunningQuality}
                          >
                            {isRunningQuality ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Checking...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Run Quality Check
                              </>
                            )}
                          </Button>
                          {isRunningQuality && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{analysisProgress.step}</span>
                                <span className="text-gray-600">{Math.round(analysisProgress.percent)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-blue-600 h-2 transition-all duration-300 ease-out rounded-full"
                                  style={{ width: `${analysisProgress.percent}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500">
                                Estimated time: {analysisProgress.timeEstimate || 'Calculating...'}
                              </p>
                            </div>
                          )}
                          {qualityResults?.results?.quality_analysis?.trade_scope_review?.items?.length ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900">Trade Scope Review</h4>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                                  <span>✅ {qualityResults.results.quality_analysis.trade_scope_review.summary.complete} complete</span>
                                  <span>⚠️ {qualityResults.results.quality_analysis.trade_scope_review.summary.partial} partial</span>
                                  <span>❌ {qualityResults.results.quality_analysis.trade_scope_review.summary.missing} missing</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {qualityResults.results.quality_analysis.trade_scope_review.items.map((entry: TradeScopeReviewEntry, idx: number) => (
                                  <div key={`${entry.trade}-${idx}`} className="border rounded-md p-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg" aria-hidden>{entry.status_icon}</span>
                                      <span className="font-semibold text-gray-900">{entry.trade}</span>
                                      <Badge variant="outline" className="text-xs capitalize">{entry.category}</Badge>
                                    </div>
                                    {entry.notes && (
                                      <div className="text-xs text-gray-600 mt-2">{entry.notes}</div>
                                    )}
                                    {entry.page_refs?.length ? (
                                      <div className="text-[11px] text-gray-500 mt-1">Pages: {entry.page_refs.join(', ')}</div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              {qualityResults.results.quality_analysis.trade_scope_review.summary.notes && (
                                <p className="text-xs text-gray-500 italic">
                                  {qualityResults.results.quality_analysis.trade_scope_review.summary.notes}
                                </p>
                              )}
                            </div>
                          ) : null}
                          {qualityResults?.issues?.length ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900">Quality Issues ({qualityResults.issues.length})</h4>
                              </div>
                              <div className="space-y-2">
                                {(qualityResults.issues || []).map((issue: any, idx: number) => (
                                  <div key={issue.id || idx} className="border rounded-md p-3 flex items-start justify-between">
                                    <div className="pr-3">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="text-xs capitalize">{issue.severity || 'warning'}</Badge>
                                        {issue.pageNumber ? (
                                          <button
                                            className="text-xs text-blue-600 hover:underline"
                                            onClick={() => {
                                              setGoToPage(issue.pageNumber)
                                              setTimeout(() => setGoToPage(undefined), 100)
                                            }}
                                          >
                                            Page {issue.pageNumber}
                                          </button>
                                        ) : null}
                                        {issue.status === 'resolved' && (
                                          <span className="text-xs text-green-600 flex items-center gap-1">
                                            <CheckCircle2 className="h-4 w-4" /> Resolved
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-800">
                                        {issue.description || issue.detail || issue.message || 'Issue'}
                                      </div>
                                      {issue.recommendation && (
                                        <div className="text-xs text-gray-500 mt-1">{issue.recommendation}</div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        disabled={issue.status === 'resolved'}
                                        onClick={() => handleResolveQualityIssue(issue.id)}
                                        className={`${issue.status === 'resolved' ? 'bg-green-100 text-green-700 border border-green-300 cursor-default' : 'bg-green-600 hover:bg-green-700 text-white'} `}
                                      >
                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                        {issue.status === 'resolved' ? 'Resolved' : 'Resolve'}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                              <h4 className="font-semibold text-gray-900 mb-2">No quality analysis yet</h4>
                              <p className="text-sm text-gray-600">Run AI analysis to check for issues</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="chat" className="mt-0">
                        <PlanChatPanel jobId={jobId} planId={planId} />
                      </TabsContent>
                      
                      <TabsContent value="comments" className="h-full">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-900">
                              Comments ({drawings.filter(d => d.type === 'comment' && !d.parentCommentId).length})
                            </h4>
                          </div>
                          {drawings.filter(d => d.type === 'comment' && !d.parentCommentId).length === 0 ? (
                            <div className="text-center py-12">
                              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                              <p className="text-sm text-gray-600">No comments yet</p>
                              <p className="text-xs text-gray-500 mt-1">Click on the plan to add a comment</p>
                            </div>
                          ) : (() => {
                            const commentMap = new Map<string, Drawing>()
                            drawings.filter(d => d.type === 'comment').forEach(c => commentMap.set(c.id, c))
                            
                            return organizeCommentsIntoThreads(drawings.filter(d => d.type === 'comment'))
                              .map(comment => (
                                <div
                                  key={comment.id}
                                  onClick={() => {
                                    setGoToPage(comment.pageNumber)
                                    setTimeout(() => setGoToPage(undefined), 100)
                                  }}
                                >
                                  <ThreadedCommentDisplay
                                    comment={comment}
                                    onReply={handleCommentReply}
                                    onResolve={handleCommentResolve}
                                    currentUserId={user?.id}
                                    currentUserName={user?.email}
                                    getReplyCount={(commentId) => {
                                      const foundComment = commentMap.get(commentId)
                                      return foundComment ? getReplyCount(foundComment) : 0
                                    }}
                                  />
                                </div>
                              ))
                          })()}
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
                </motion.div>
                </>
            )}
          </AnimatePresence>
            
            {/* Floating button to open sidebar on mobile/tablet */}
            {!rightSidebarOpen && (isMobile || isTablet) && (
              <Button
                className="fixed bottom-4 right-4 z-40 h-12 px-5 rounded-full shadow-xl bg-gray-900 text-white flex items-center gap-2 hover:bg-gray-800 active:bg-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                onClick={() => setRightSidebarOpen(true)}
                size="lg"
                aria-label="Open analysis sidebar"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="text-sm font-medium">Analysis</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
        </div>
      </div>

      {/* Comment Form Modal */}
      <CommentPinForm
        open={commentFormOpen}
        onOpenChange={setCommentFormOpen}
        x={commentPosition.x}
        y={commentPosition.y}
        pageNumber={commentPosition.pageNumber}
        onSave={handleCommentSave}
      />

      {/* Modals */}
      <ShareLinkGenerator
        planId={planId}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
      <BidPackageModal
        jobId={jobId}
        planId={planId}
        takeoffItems={modalTakeoffItems}
        isOpen={showPackageModal}
        onClose={() => setShowPackageModal(false)}
      />
      <BidComparisonModal
        jobId={jobId}
        isOpen={showBidsModal}
        onClose={() => setShowBidsModal(false)}
      />
      
      {/* Scale Settings Modal */}
      <ScaleSettingsModal
        open={scaleSettingsModalOpen}
        onOpenChange={(open) => {
          setScaleSettingsModalOpen(open)
          if (!open) {
            setIsCalibrating(false)
            setCalibrationPoints([])
          }
        }}
        current={(() => {
          // Use same helper logic as fast-plan-canvas to handle key mismatches
          if (!measurementScaleSettings) return undefined
          const setting = measurementScaleSettings[currentPage] || 
                         measurementScaleSettings[String(currentPage) as any] ||
                         measurementScaleSettings[Number(currentPage)]
          return setting
        })()}
        numPages={pdfNumPages || plan?.num_pages || undefined}
        onApplyCurrentToAll={async () => {
          try {
            // Use same helper logic to handle key mismatches
            const currentSetting = measurementScaleSettings?.[currentPage] || 
                                  measurementScaleSettings?.[String(currentPage) as any] ||
                                  measurementScaleSettings?.[Number(currentPage)]
            
            const totalPages = pdfNumPages || plan?.num_pages
            if (!currentSetting || !totalPages) {
              console.error('Cannot apply to all pages:', { currentSetting, totalPages, currentPage })
              alert('Unable to apply scale: No scale setting found for current page or page count unavailable.')
              return
            }
            
            console.log('Applying scale to all pages:', { 
              currentSetting, 
              totalPages, 
              currentPage,
              planId 
            })
            
            // Apply current page's scale to all pages in state
            const updatedSettings: Record<number, ScaleSetting> = {}
            for (let page = 1; page <= totalPages; page++) {
              updatedSettings[page] = currentSetting
            }
            setMeasurementScaleSettings(prev => ({
              ...prev,
              ...updatedSettings
            }))
            
            // Save all pages to database - wait for all to complete
            const savePromises = Array.from({ length: totalPages }, (_, i) => i + 1).map(async (page) => {
              try {
                console.log(`Saving scale settings for page ${page}...`)
                const result = await saveScaleSettings(page, currentSetting)
                console.log(`Successfully saved scale settings for page ${page}`)
                return { page, success: true, result }
              } catch (error) {
                console.error(`Failed to save scale settings for page ${page}:`, error)
                return { page, success: false, error }
              }
            })
            
            const results = await Promise.all(savePromises)
            const failures = results.filter(r => !r.success)
            
            if (failures.length > 0) {
              console.error(`Failed to save ${failures.length} pages:`, failures)
              alert(`Failed to apply scale to ${failures.length} of ${totalPages} pages. Please try again.`)
            } else {
              console.log(`Successfully applied scale to all ${totalPages} pages`)
              // Close modal after successful save
              setScaleSettingsModalOpen(false)
            }
          } catch (error) {
            console.error('Error applying scale to all pages:', error)
            alert('Failed to apply scale to all pages. Please try again.')
          }
        }}
        onApply={async (setting: ScaleSetting, applyToAllPages = false) => {
          try {
            if (applyToAllPages && plan?.num_pages) {
              // Apply to all pages
              const totalPages = pdfNumPages || plan.num_pages
              console.log(`Applying scale to all ${totalPages} pages...`)
              
              const updatedSettings: Record<number, ScaleSetting> = {}
              for (let page = 1; page <= totalPages; page++) {
                updatedSettings[page] = setting
              }
              setMeasurementScaleSettings(prev => ({
                ...prev,
                ...updatedSettings
              }))
              
              // Save all pages to database
              const savePromises = Array.from({ length: totalPages }, (_, i) => i + 1).map(async (page) => {
                try {
                  await saveScaleSettings(page, setting)
                  return { page, success: true }
                } catch (error) {
                  console.error(`Failed to save scale settings for page ${page}:`, error)
                  return { page, success: false, error }
                }
              })
              
              const results = await Promise.all(savePromises)
              const failures = results.filter(r => !r.success)
              
              if (failures.length > 0) {
                console.error(`Failed to save ${failures.length} pages:`, failures)
                alert(`Failed to apply scale to ${failures.length} of ${totalPages} pages. Please try again.`)
              } else {
                console.log(`Successfully applied scale to all ${totalPages} pages`)
              }
            } else {
              // Apply to current page only
              console.log(`Applying scale to page ${currentPage}...`)
              setMeasurementScaleSettings(prev => ({
                ...prev,
                [currentPage]: setting
              }))
              
              // Save to database
              await saveScaleSettings(currentPage, setting)
              console.log(`Successfully applied scale to page ${currentPage}`)
            }
            setIsCalibrating(false)
            setCalibrationPoints([])
          } catch (error) {
            console.error('Error applying scale:', error)
            alert('Failed to apply scale. Please try again.')
          }
        }}
        onStartCalibration={() => {
          setScaleSettingsModalOpen(false)
          setIsCalibrating(true)
          setCalibrationPoints([])
        }}
        calibrationPoints={calibrationPoints}
        onCalibrationComplete={() => {
          setIsCalibrating(false)
          setCalibrationPoints([])
        }}
      />
    </div>
  )
}