'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  Bot,
  Maximize2,
  Minimize2,
  Pencil,
  Check,
  X,
  Plus,
  Tag
} from 'lucide-react'
import Link from 'next/link'
import { drawerSlide } from '@/lib/animations'
import { Job, Plan } from '@/types/takeoff'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import { Input } from '@/components/ui/input'
import { updatePlanTitle } from '@/app/actions/plan'
import FastPlanCanvas from '@/components/fast-plan-canvas'
import CommentPinForm from '@/components/comment-pin-form'
import { canvasUtils } from '@/lib/canvas-utils'
import { Drawing } from '@/lib/canvas-utils'
import { MeasurementPersistence, isMeasurementDrawing } from '@/lib/measurement-persistence'
import { CommentPersistence } from '@/lib/comment-persistence'
import { ItemPersistence } from '@/lib/item-persistence'
import { getItemTypeById } from '@/lib/item-types'
import ShareLinkGenerator from '@/components/share-link-generator'
import BidPackageModal from '@/components/bid-package-modal'
import BidComparisonModal from '@/components/bid-comparison-modal'
import TakeoffSpreadsheet from '@/components/takeoff-spreadsheet'
import TakeoffReviewPanel from '@/components/takeoff-review-panel'
import MissingInformationPanel from '@/components/missing-information-panel'
import PdfQualitySettings, { QualityMode } from '@/components/pdf-quality-settings'
import PlanChatPanel from '@/components/plan/plan-chat-panel'
import ThreadedCommentDisplay from '@/components/threaded-comment-display'
import { organizeCommentsIntoThreads, getReplyCount } from '@/lib/comment-utils'
import { CheckCircle2 } from 'lucide-react'
import ItemList from '@/components/item-list'
import ItemTagModal from '@/components/item-tag-modal'
import ScaleSettingsModal, { ScaleSetting } from '@/components/scale-settings-modal'
import { normalizeTradeScopeReview, TradeScopeReviewEntry } from '@/lib/trade-scope-review'
import { getJobForUser } from '@/lib/job-access'
import PDFSearch from '@/components/pdf-search'
import MeasurementSummaryPanel from '@/components/measurement-summary-panel'


type AnalysisMode = 'takeoff' | 'chat' | 'comments' | 'items'

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
  const [sidebarMaximized, setSidebarMaximized] = useState(false)
  const [planUrl, setPlanUrl] = useState<string>('')
  const [commentFormOpen, setCommentFormOpen] = useState(false)
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0, pageNumber: 1 })
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [itemModalPosition, setItemModalPosition] = useState({ x: 0, y: 0, pageNumber: 1 })
  const [editingItem, setEditingItem] = useState<Drawing | null>(null)
  const [sidebarHoveredItemId, setSidebarHoveredItemId] = useState<string | null>(null)
  const [selectedItemType, setSelectedItemType] = useState<{
    itemType: string
    itemCategory?: string
    itemLabel?: string
  } | null>(null)
  const [isRunningTakeoff, setIsRunningTakeoff] = useState(false)
  const [isGeneratingShare, setIsGeneratingShare] = useState(false)
  
  // Plan title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')
  const [isUpdatingTitle, setIsUpdatingTitle] = useState(false)

  const [takeoffResults, setTakeoffResults] = useState<any>(null)
  const [reviewResults, setReviewResults] = useState<any>(null)
  const [missingInformation, setMissingInformation] = useState<any[]>([])
  const [modalTakeoffItems, setModalTakeoffItems] = useState<Array<{
    id: string
    category: string
    description: string
    quantity: number
    unit: string
    unit_cost?: number
  }>>([])
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<{ step: string; percent: number; timeEstimate?: string; stage?: string }>({ step: '', percent: 0 })
  const [goToPage, setGoToPage] = useState<number | undefined>(undefined)
  const [goToCoordinate, setGoToCoordinate] = useState<{ x: number; y: number; pageNumber: number } | undefined>(undefined)
  
  // Handle page navigation from takeoff items
  const handlePageNavigate = useCallback((page: number) => {
    setGoToPage(page)
    setGoToCoordinate(undefined)
    // Reset after navigation so it can be triggered again
    setTimeout(() => {
      setGoToPage(undefined)
      setGoToCoordinate(undefined)
    }, 100)
  }, [])
  
  // Handle navigation to a specific coordinate
  const handleNavigateToCoordinate = useCallback((x: number, y: number, pageNumber: number) => {
    setGoToPage(pageNumber)
    setGoToCoordinate({ x, y, pageNumber })
    // Reset after navigation so it can be triggered again
    setTimeout(() => {
      setGoToPage(undefined)
      setGoToCoordinate(undefined)
    }, 100)
  }, [])
  
  // PDF quality settings
  const [qualityMode, setQualityMode] = useState<QualityMode>('balanced')
  const [scale, setScale] = useState(1.5)
  // Measurement scale settings per page (pixelsPerUnit derived from ratio input)
  const [measurementScaleSettings, setMeasurementScaleSettings] = useState<Record<number, ScaleSetting>>({})
  const [scaleSettingsModalOpen, setScaleSettingsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null)
  const [hasRestoredPage, setHasRestoredPage] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchCount, setSearchMatchCount] = useState(0)
  const [searchCurrentMatch, setSearchCurrentMatch] = useState(0)
  const [selectedMeasurementIds, setSelectedMeasurementIds] = useState<Set<string>>(new Set())
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([])
  const [isCalibrating, setIsCalibrating] = useState(false)
  // Store page dimensions for scale calculations
  const [currentPageDimensions, setCurrentPageDimensions] = useState<{
    rendered: { width: number; height: number } | null
    native: { width: number; height: number } | null
  } | null>(null)
  
  // Stable callback for page dimensions changes
  const handlePageDimensionsChange = useCallback((dims: {
    rendered: { width: number; height: number } | null
    native: { width: number; height: number } | null
    pageNumber: number
  }) => {
    setCurrentPageDimensions({
      rendered: dims.rendered,
      native: dims.native
    })
  }, [])
  
  // Modal states
  const [showShareModal, setShowShareModal] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showBidsModal, setShowBidsModal] = useState(false)
  
  // Sidebar resize state
	const [sidebarWidth, setSidebarWidth] = useState(480) // Default narrower sidebar to prioritize plan canvas
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
  const itemPersistenceRef = useRef<ItemPersistence | null>(null)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSyncingRef = useRef(false)
  const pendingSyncRef = useRef<Drawing[] | null>(null)
  const supabase = createClient()

  const jobId = params.jobId as string
  const planId = params.planId as string

  // Restore saved page from localStorage on mount
  useEffect(() => {
    if (planId && !hasRestoredPage) {
      const storageKey = `bidi-plan-page-${planId}`
      try {
        const savedPage = localStorage.getItem(storageKey)
        if (savedPage) {
          const pageNum = parseInt(savedPage, 10)
          if (!isNaN(pageNum) && pageNum >= 1) {
            setCurrentPage(pageNum)
          }
        }
      } catch (e) {
        // localStorage may be unavailable in some contexts
        console.warn('Could not restore saved page:', e)
      }
      setHasRestoredPage(true)
    }
  }, [planId, hasRestoredPage])

  // Save current page to localStorage when it changes
  useEffect(() => {
    if (planId && hasRestoredPage && currentPage >= 1) {
      const storageKey = `bidi-plan-page-${planId}`
      try {
        localStorage.setItem(storageKey, currentPage.toString())
      } catch (e) {
        // localStorage may be unavailable or full
        console.warn('Could not save page to localStorage:', e)
      }
    }
  }, [planId, currentPage, hasRestoredPage])

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

  // Initialize item persistence and load items
  useEffect(() => {
    const initializeAndLoadItems = async () => {
      if (user && planId) {
        // Initialize item persistence
        itemPersistenceRef.current = new ItemPersistence(planId, user.id)
        
        // Load items immediately after initialization
        try {
          const items = await itemPersistenceRef.current.loadItems()
          console.log('Loaded items:', items.length)
          setDrawings(prev => {
            // Merge with existing non-item drawings
            const nonItemDrawings = prev.filter(d => d.type !== 'item')
            if (items.length === 0) {
              return nonItemDrawings
            }
            // Deduplicate by ID to prevent duplicates
            const seenIds = new Set<string>()
            const uniqueItems = items.filter(item => {
              if (seenIds.has(item.id)) {
                return false
              }
              seenIds.add(item.id)
              return true
            })
            return [...nonItemDrawings, ...uniqueItems]
          })
        } catch (error) {
          console.error('Error loading items:', error)
        }
      }
    }
    
    initializeAndLoadItems()
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
          // Deduplicate by ID to prevent duplicates
          const seenIds = new Set<string>()
          const uniqueMeasurements = mergedMeasurements.filter(m => {
            if (seenIds.has(m.id)) {
              return false
            }
            seenIds.add(m.id)
            return true
          })
          return [...nonMeasurements, ...uniqueMeasurements]
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
    }
  }, [user, jobId, planId])

  // Load existing analysis after plan is loaded
  useEffect(() => {
    if (user && planId && plan?.job_id) {
      loadExistingAnalysis()
    }
  }, [user, planId, plan?.job_id])

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
      
      // Clamp width between 420px and 80% of viewport width
      const maxWidth = Math.floor(window.innerWidth * 0.8)
      const clampedWidth = Math.max(420, Math.min(maxWidth, newWidth))
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
      if (!planId) {
        console.error('Plan ID not found')
        return
      }

      const { data: takeoffAnalysis } = await supabase
        .from('plan_takeoff_analysis')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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
        
        // Add visual indicator for items from other plans
        const itemsWithSource = itemsWithIds.map((item: any) => ({
          ...item,
          // If item has a plan_file_name and it's different from current plan, indicate it
          source_display: item.plan_file_name && item.plan_id !== planId 
            ? item.plan_file_name 
            : undefined
        }))
        
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
            items: itemsWithSource,
            summary: takeoffAnalysis.summary || {},
            quality_analysis: normalizedQualityAnalysisFromTakeoff || undefined // Include quality analysis from takeoff
          }
        })
        
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

    } catch (error) {
      console.error('Error loading existing analysis:', error)
    }
  }

  const persistTakeoffItems = useCallback(async (updatedItems: any[]) => {
    if (!user) return
    try {
      let rowId = takeoffAnalysisRowId
      if (!rowId) {
        if (!planId) {
          console.error('Plan ID not found')
          return
        }

        const { data } = await supabase
          .from('plan_takeoff_analysis')
          .select('id')
          .eq('plan_id', planId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
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
      unit_cost: typeof it.unit_cost === 'number' ? it.unit_cost : Number(it.unit_cost) || undefined,
      subcontractor: it.subcontractor || undefined
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

  // Handle drawings change and save with debouncing to prevent race conditions
  const handleDrawingsChange = useCallback(async (newDrawings: Drawing[]) => {
    // Always update local state immediately for responsive UI
    setDrawings(newDrawings)

    const persistence = measurementPersistenceRef.current
    if (!persistence) {
      return
    }

    // Clear any pending sync timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    // If a sync is in progress, store the latest drawings to sync after current completes
    if (isSyncingRef.current) {
      pendingSyncRef.current = newDrawings
      return
    }

    // Debounce the sync to batch rapid changes (300ms delay)
    syncTimeoutRef.current = setTimeout(async () => {
      const performSync = async (drawingsToSync: Drawing[]) => {
        isSyncingRef.current = true
        try {
          const measurementDrawings = drawingsToSync.filter(isMeasurementDrawing)
          const syncedMeasurements = await persistence.syncMeasurements(measurementDrawings)

          // Merge synced measurements with current state (not the state at sync start)
          setDrawings(current => {
            const nonMeasurements = current.filter(d => !isMeasurementDrawing(d))
            // Keep any local measurements that weren't in the sync (newly added during sync)
            const syncedIds = new Set(syncedMeasurements.map(m => m.id))
            const currentMeasurements = current.filter(isMeasurementDrawing)
            const localOnlyMeasurements = currentMeasurements.filter(m => !syncedIds.has(m.id))
            
            // Deduplicate by ID to prevent duplicates
            const allMeasurements = [...syncedMeasurements, ...localOnlyMeasurements]
            const seenIds = new Set<string>()
            const uniqueMeasurements = allMeasurements.filter(m => {
              if (seenIds.has(m.id)) {
                return false
              }
              seenIds.add(m.id)
              return true
            })
            
            return [...nonMeasurements, ...uniqueMeasurements]
          })
        } catch (error) {
          console.error('Failed to sync measurements:', error)
        } finally {
          isSyncingRef.current = false
          
          // If there were changes during sync, process them now
          if (pendingSyncRef.current) {
            const pendingDrawings = pendingSyncRef.current
            pendingSyncRef.current = null
            // Use the latest state for the next sync
            performSync(pendingDrawings)
          }
        }
      }

      // Use the latest drawings from ref to ensure we sync the most recent state
      performSync(drawingsRef.current)
    }, 300)
  }, [])

  // Handle comment pin click (to place new comment)
  const handleCommentPinClick = useCallback((x: number, y: number, pageNumber: number) => {
    setCommentPosition({ x, y, pageNumber })
    setCommentFormOpen(true)
  }, [])

  // Handle item pin click (to place new item)
  const handleItemPinClick = useCallback((x: number, y: number, pageNumber: number) => {
    setItemModalPosition({ x, y, pageNumber })
    setEditingItem(null)
    setItemModalOpen(true)
  }, [])

  // Handle add comment from comments tab
  const handleAddCommentFromTab = useCallback(() => {
    // Set default position (center-ish of page 1)
    setCommentPosition({ x: 400, y: 400, pageNumber: 1 })
    setCommentFormOpen(true)
  }, [])

  // Handle comment click (to view existing comment)
  const handleCommentClick = useCallback((comment: Drawing) => {
    // Comment popup is now handled directly in FastPlanCanvas component
    // No additional action needed here
  }, [])

  // Handle comment delete
  const handleCommentDelete = useCallback(async (commentId: string) => {
    try {
      // Delete from Supabase using comment persistence
      if (commentPersistenceRef.current) {
        await commentPersistenceRef.current.deleteComment(commentId)
        // Reload comments to ensure state is in sync
        const comments = await commentPersistenceRef.current.loadComments()
        setDrawings(prev => [...prev.filter(d => d.type !== 'comment'), ...comments])
      } else {
        // Fallback: just remove from local state
        const updatedDrawings = drawings.filter(d => d.id !== commentId)
        await handleDrawingsChange(updatedDrawings)
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
      throw error // Re-throw so FastPlanCanvas can show error message
    }
  }, [drawings, handleDrawingsChange])

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

  // Handle item save
  const handleItemSave = useCallback(async (item: {
    itemType: string
    itemLabel?: string
    itemNotes?: string
    itemCategory?: string
  }) => {
    try {
      const itemType = getItemTypeById(item.itemType)
      const category = item.itemCategory || itemType?.category || 'other'
      
      const newDrawing: Drawing = {
        id: editingItem?.id || Date.now().toString(),
        type: 'item',
        geometry: {
          x: itemModalPosition.x,
          y: itemModalPosition.y,
        },
        style: {
          color: itemType?.color || '#3b82f6',
          strokeWidth: 2,
          opacity: 1
        },
        pageNumber: itemModalPosition.pageNumber,
        itemType: item.itemType,
        itemLabel: item.itemLabel,
        itemNotes: item.itemNotes,
        itemCategory: category,
        layerName: 'items',
        isVisible: true,
        isLocked: false,
        userId: user?.id,
        userName: user?.email,
        createdAt: editingItem?.createdAt || new Date().toISOString()
      }

      // Optimistically update UI immediately for better UX
      const tempId = newDrawing.id
      
      // Update state and capture the new state for syncing
      let updatedDrawings: Drawing[]
      if (editingItem) {
        // Update existing item - show immediately
        updatedDrawings = drawings.map(d => d.id === editingItem.id ? newDrawing : d)
        setDrawings(updatedDrawings)
      } else {
        // Create new item - show immediately
        updatedDrawings = [...drawings, newDrawing]
        setDrawings(updatedDrawings)
      }

      // Save using item persistence (async, but UI already updated)
      if (itemPersistenceRef.current) {
        // Use the updated drawings state (not the closure value)
        const currentItems = updatedDrawings.filter(d => d.type === 'item')
        
        if (editingItem) {
          // Update existing item - filter out the old one and add the new one
          const itemsToSync = currentItems.filter(d => d.id !== editingItem.id)
          itemsToSync.push(newDrawing)
          
          // Don't await - let it save in background
          itemPersistenceRef.current.syncItems(itemsToSync).then(savedItems => {
            // Update the item with the real database ID if it changed
            const savedItem = savedItems.find(i => i.id === tempId || (editingItem && i.id === editingItem.id))
            if (savedItem && savedItem.id !== tempId) {
              setDrawings(prev => {
                // Deduplicate by ID to prevent duplicates
                const seenIds = new Set<string>()
                return prev.map(d => {
                  if (d.id === tempId && savedItem.id !== tempId) {
                    if (seenIds.has(savedItem.id)) return null // Skip if already exists
                    seenIds.add(savedItem.id)
                    return { ...d, id: savedItem.id }
                  }
                  if (seenIds.has(d.id)) return null // Skip duplicates
                  seenIds.add(d.id)
                  return d
                }).filter((d): d is Drawing => d !== null)
              })
            }
          }).catch(err => {
            console.error('Error saving item to database:', err)
            // Optionally revert the optimistic update on error
            // For now, we'll keep it visible and let the user retry
          })
        } else {
          // Create new item - use current items (which includes the optimistically added one)
          const itemsToSync = [...currentItems]
          
          // Don't await - let it save in background
          itemPersistenceRef.current.syncItems(itemsToSync).then(savedItems => {
            // Update the item with the real database ID if it changed
            const savedItem = savedItems.find(i => 
              (i.geometry?.x === newDrawing.geometry.x && 
               i.geometry?.y === newDrawing.geometry.y &&
               i.pageNumber === newDrawing.pageNumber) ||
              i.id === tempId
            )
            if (savedItem && savedItem.id !== tempId) {
              setDrawings(prev => {
                // Deduplicate by ID to prevent duplicates
                const seenIds = new Set<string>()
                return prev.map(d => {
                  if (d.id === tempId && savedItem.id !== tempId) {
                    if (seenIds.has(savedItem.id)) return null // Skip if already exists
                    seenIds.add(savedItem.id)
                    return { ...d, id: savedItem.id }
                  }
                  if (seenIds.has(d.id)) return null // Skip duplicates
                  seenIds.add(d.id)
                  return d
                }).filter((d): d is Drawing => d !== null)
              })
            }
          }).catch(err => {
            console.error('Error saving item to database:', err)
            // Optionally revert the optimistic update on error
            // For now, we'll keep it visible and let the user retry
          })
        }
      } else {
        // Fallback to old method
        if (editingItem) {
          handleDrawingsChange(updatedDrawings)
        } else {
          handleDrawingsChange(updatedDrawings)
        }
      }
      
      // If creating a new item (not editing), set it as the selected type for quick tagging
      if (!editingItem) {
        setSelectedItemType({
          itemType: item.itemType,
          itemCategory: category,
          itemLabel: item.itemLabel
        })
      }
      
      setEditingItem(null)
      setItemModalOpen(false)
    } catch (error) {
      console.error('Error saving item:', error)
      alert('Failed to save item. Please try again.')
    }
  }, [itemModalPosition, drawings, handleDrawingsChange, user, editingItem])

  // Handle item save from canvas (with coordinates)
  const handleItemSaveWithCoords = useCallback(async (
    item: {
      itemType: string
      itemLabel?: string
      itemNotes?: string
      itemCategory?: string
    },
    x: number,
    y: number,
    pageNumber: number,
    editingItemId?: string
  ) => {
    try {
      const itemType = getItemTypeById(item.itemType)
      const category = item.itemCategory || itemType?.category || 'other'
      const existingItem = editingItemId ? drawings.find(d => d.id === editingItemId) : null
      
      const newDrawing: Drawing = {
        id: editingItemId || Date.now().toString(),
        type: 'item',
        geometry: {
          x,
          y,
        },
        style: {
          color: itemType?.color || '#3b82f6',
          strokeWidth: 2,
          opacity: 1
        },
        pageNumber,
        itemType: item.itemType,
        itemLabel: item.itemLabel,
        itemNotes: item.itemNotes,
        itemCategory: category,
        layerName: 'items',
        isVisible: true,
        isLocked: false,
        userId: user?.id,
        userName: user?.email,
        createdAt: existingItem?.createdAt || new Date().toISOString()
      }

      // Optimistically update UI immediately for better UX
      const tempId = newDrawing.id
      
      // Update state and capture the new state for syncing
      let updatedDrawings: Drawing[]
      if (editingItemId) {
        // Update existing item - show immediately
        updatedDrawings = drawings.map(d => d.id === editingItemId ? newDrawing : d)
        setDrawings(updatedDrawings)
      } else {
        // Create new item - show immediately
        updatedDrawings = [...drawings, newDrawing]
        setDrawings(updatedDrawings)
      }
      
      // Save using item persistence (async, but UI already updated)
      if (itemPersistenceRef.current) {
        // Use the updated drawings state (not the closure value)
        const currentItems = updatedDrawings.filter(d => d.type === 'item')
        
        if (editingItemId) {
          // Update existing item - filter out the old one and add the new one
          const itemsToSync = currentItems.filter(d => d.id !== editingItemId)
          itemsToSync.push(newDrawing)
          
          // Don't await - let it save in background
          itemPersistenceRef.current.syncItems(itemsToSync).then(savedItems => {
            // Update the item with the real database ID if it changed
            const savedItem = savedItems.find(i => i.id === tempId || i.id === editingItemId)
            if (savedItem && savedItem.id !== tempId) {
              setDrawings(prev => {
                // Deduplicate by ID to prevent duplicates
                const seenIds = new Set<string>()
                return prev.map(d => {
                  if (d.id === tempId && savedItem.id !== tempId) {
                    if (seenIds.has(savedItem.id)) return null // Skip if already exists
                    seenIds.add(savedItem.id)
                    return { ...d, id: savedItem.id }
                  }
                  if (seenIds.has(d.id)) return null // Skip duplicates
                  seenIds.add(d.id)
                  return d
                }).filter((d): d is Drawing => d !== null)
              })
            }
          }).catch(err => {
            console.error('Error saving item to database:', err)
            // Optionally revert the optimistic update on error
          })
        } else {
          // Create new item - use current items (which includes the optimistically added one)
          const itemsToSync = [...currentItems]
          
          // Don't await - let it save in background
          itemPersistenceRef.current.syncItems(itemsToSync).then(savedItems => {
            // Update the item with the real database ID if it changed
            const savedItem = savedItems.find(i => 
              (i.geometry?.x === newDrawing.geometry.x && 
               i.geometry?.y === newDrawing.geometry.y &&
               i.pageNumber === newDrawing.pageNumber) ||
              i.id === tempId
            )
            if (savedItem && savedItem.id !== tempId) {
              setDrawings(prev => {
                // Deduplicate by ID to prevent duplicates
                const seenIds = new Set<string>()
                return prev.map(d => {
                  if (d.id === tempId && savedItem.id !== tempId) {
                    if (seenIds.has(savedItem.id)) return null // Skip if already exists
                    seenIds.add(savedItem.id)
                    return { ...d, id: savedItem.id }
                  }
                  if (seenIds.has(d.id)) return null // Skip duplicates
                  seenIds.add(d.id)
                  return d
                }).filter((d): d is Drawing => d !== null)
              })
            }
          }).catch(err => {
            console.error('Error saving item to database:', err)
            // Optionally revert the optimistic update on error
          })
        }
      } else {
        // Fallback to old method
        if (editingItemId) {
          handleDrawingsChange(updatedDrawings)
        } else {
          handleDrawingsChange(updatedDrawings)
        }
      }
      
      // If creating a new item (not editing), set it as the selected type for quick tagging
      if (!editingItemId) {
        setSelectedItemType({
          itemType: item.itemType,
          itemCategory: category,
          itemLabel: item.itemLabel
        })
      }
    } catch (error) {
      console.error('Error saving item:', error)
      alert('Failed to save item. Please try again.')
    }
  }, [drawings, handleDrawingsChange, user])

  // Handle item delete
  const handleItemDelete = useCallback(async (itemId: string) => {
    try {
      if (itemPersistenceRef.current) {
        await itemPersistenceRef.current.deleteItem(itemId)
        // Reload items
        const items = await itemPersistenceRef.current.loadItems()
        setDrawings(prev => [...prev.filter(d => d.type !== 'item'), ...items])
      } else {
        // Fallback to old method
        await handleDrawingsChange(drawings.filter(d => d.id !== itemId))
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item. Please try again.')
    }
  }, [drawings, handleDrawingsChange])

  // Handle item edit
  const handleItemEdit = useCallback((item: Drawing) => {
    setEditingItem(item)
    setItemModalPosition({ 
      x: item.geometry.x || 0, 
      y: item.geometry.y || 0, 
      pageNumber: item.pageNumber 
    })
    setItemModalOpen(true)
  }, [])

  // Handle item click (navigate to item location)
  const handleItemClick = useCallback((item: Drawing) => {
    if (item.geometry && typeof item.geometry.x !== 'undefined' && typeof item.geometry.y !== 'undefined') {
      // Navigate to the item's specific location
      handleNavigateToCoordinate(item.geometry.x, item.geometry.y, item.pageNumber)
    } else {
      // Fallback to just navigating to the page
      handlePageNavigate(item.pageNumber)
    }
  }, [handlePageNavigate, handleNavigateToCoordinate])

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
      // Yield to main thread every 5 pages to keep UI responsive
      if (i > 0 && i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }

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
      // Step 1: Check vectorization status (using vectorized text chunks instead of images)
      setAnalysisProgress({ step: 'Checking plan vectorization status...', percent: 10, stage: 'primary' })
      
      // Step 2: Convert only a few sample pages for visual context (optional)
      // Since we're using vectorized text, we only need a few sample images
      // Check if convertPdfToImages supports a limit parameter
      let sampleImages: string[] = []
      try {
        // Try to get just first 5 pages for visual context
        const allImages = await convertPdfToImages(retryCount)
        sampleImages = allImages.slice(0, Math.min(5, allImages.length))
      } catch (imageError) {
        console.warn('Could not convert sample images, proceeding with text-only analysis:', imageError)
        // Continue without images - text chunks are sufficient
      }
      const totalPages = plan?.num_pages || sampleImages.length

      // Step 3: Primary AI Analysis using vectorized text chunks
      const timeEstimate = calculateTimeEstimate(totalPages)
      setAnalysisProgress({ step: 'Stage 1: Primary AI Analysis using vectorized text...', percent: 20, timeEstimate, stage: 'primary' })
      const startTime = Date.now()
      
      const analysisResponse = await fetch('/api/plan/analyze-takeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planId,
          images: sampleImages, // Only send sample images for visual context (optional)
          drawings: drawings
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
        // Handle vectorization error
        if (analysisResponse.status === 400 || analysisResponse.status === 202) {
          const errorData = await analysisResponse.json().catch(() => ({}))
          if (errorData.error === 'PLAN_NOT_VECTORIZED' || errorData.error === 'NO_TEXT_CHUNKS') {
            const message = errorData.vectorizationStatus?.autoQueued
              ? '⚠️ Plan needs to be vectorized first. Vectorization has been queued automatically. This usually takes 2-5 minutes. Please wait and try again.'
              : errorData.message || 'Plan needs to be vectorized before running takeoff analysis. Vectorization extracts text from plans which helps the AI provide more accurate results.'
            
            setAnalysisProgress({ 
              step: message,
              percent: 100,
              stage: 'vectorization_required'
            })
            
            // Show message for longer since user needs to wait
            setTimeout(() => {
              setIsRunningTakeoff(false)
              setAnalysisProgress({ step: '', percent: 0 })
            }, 15000) // Show for 15 seconds to give user time to read
            
            return
          }
        }
        
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
                images: sampleImages,
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

      setAnalysisProgress({ step: 'Stage 2: Multi-AI Review...', percent: 50, stage: 'review' })
      const analysisData = await analysisResponse.json()
      
      // Extract review and missing information from response
      if (analysisData.review) {
        setReviewResults(analysisData.review)
      }
      if (analysisData.missing_information?.missingInformation) {
        setMissingInformation(analysisData.missing_information.missingInformation)
      }
      
      setAnalysisProgress({ step: 'Stage 3: Missing Information Analysis...', percent: 75, stage: 'missing_info' })
      
      setAnalysisProgress({ step: 'Stage 4: Estimate Enhancement...', percent: 90, stage: 'estimate' })
      
      // Step 5: Complete (90-100%)
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
      setAnalysisProgress({ step: 'Complete!', percent: 100, stage: 'complete' })
      
      setTakeoffResults({
        results: {
          items: analysisData.items || [],
          summary: analysisData.summary || {}
        },
        review: analysisData.review,
        missing_information: analysisData.missing_information,
        estimate_enhancement: analysisData.estimate_enhancement
      })
      
      
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

  function startEditing() {
    if (plan) {
      setEditingTitle(plan.title || plan.file_name)
      setIsEditingTitle(true)
    }
  }

  async function saveTitle() {
    if (!plan || !editingTitle.trim()) return

    setIsUpdatingTitle(true)
    try {
      const result = await updatePlanTitle(plan.id, editingTitle)
      
      if (result.success) {
        setPlan(prev => prev ? { ...prev, title: editingTitle } : null)
        setIsEditingTitle(false)
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

  function cancelEditing() {
    setIsEditingTitle(false)
    setEditingTitle('')
  }

  // Search handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setSearchCurrentMatch(0) // Reset to first match when query changes
  }, [])

  const handleSearchNext = useCallback(() => {
    if (searchMatchCount > 0) {
      setSearchCurrentMatch(prev => (prev + 1) % searchMatchCount)
    }
  }, [searchMatchCount])

  const handleSearchPrevious = useCallback(() => {
    if (searchMatchCount > 0) {
      setSearchCurrentMatch(prev => (prev - 1 + searchMatchCount) % searchMatchCount)
    }
  }, [searchMatchCount])

  // Keyboard shortcut for search (Ctrl+F / Cmd+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Memoize scale settings modal props to prevent unnecessary re-renders
  // IMPORTANT: These hooks must be called before any early returns to follow Rules of Hooks
  const currentScaleSetting = useMemo(() => {
    // Use same helper logic as fast-plan-canvas to handle key mismatches
    if (!measurementScaleSettings) return undefined
    const setting = measurementScaleSettings[currentPage] || 
                   measurementScaleSettings[String(currentPage) as any] ||
                   measurementScaleSettings[Number(currentPage)]
    return setting
  }, [measurementScaleSettings, currentPage])

  const memoizedPageDimensions = useMemo(() => {
    const rendered = currentPageDimensions?.rendered
    return rendered ? { width: rendered.width, height: rendered.height } : undefined
  }, [currentPageDimensions?.rendered?.width, currentPageDimensions?.rendered?.height])

  const memoizedPdfNativeDimensions = useMemo(() => {
    const native = currentPageDimensions?.native
    return native ? { width: native.width, height: native.height } : undefined
  }, [currentPageDimensions?.native?.width, currentPageDimensions?.native?.height])

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
              <div className="text-xs md:text-sm text-gray-600 truncate flex items-center">
                <span className="font-medium mr-1">{job.name}</span> - 
                {isEditingTitle ? (
                  <div className="flex items-center ml-2 gap-1">
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="h-6 text-sm w-48 md:w-64"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle()
                        if (e.key === 'Escape') cancelEditing()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        saveTitle()
                      }}
                      disabled={isUpdatingTitle}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        cancelEditing()
                      }}
                      disabled={isUpdatingTitle}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="group flex items-center ml-1">
                    <span className="hidden sm:inline">{plan.title || plan.file_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                      onClick={startEditing}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
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
              width: rightSidebarOpen && !isMobile && !isTablet && !sidebarMaximized
                ? `calc(100% - ${sidebarWidth}px - 1px)` 
                : sidebarMaximized
                  ? '0%'
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
                onCommentDelete={handleCommentDelete}
                onItemPinClick={handleItemPinClick}
                onItemSave={handleItemSaveWithCoords}
                selectedItemType={selectedItemType}
                onSelectedItemTypeChange={setSelectedItemType}
                sidebarHoveredItemId={sidebarHoveredItemId}
                goToPage={goToPage}
                goToCoordinate={goToCoordinate}
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
                onPageDimensionsChange={handlePageDimensionsChange}
                fileType={plan?.file_type}
                searchQuery={searchQuery}
                currentMatchIndex={searchCurrentMatch}
                onSearchResults={(count) => {
                  setSearchMatchCount(count)
                }}
                selectedMeasurementIds={selectedMeasurementIds}
                onSelectedMeasurementsChange={setSelectedMeasurementIds}
                selectedItemIds={selectedItemIds}
                onSelectedItemsChange={setSelectedItemIds}
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

          {/* Resize Handle - Hidden on mobile/tablet and when maximized */}
          {rightSidebarOpen && !isMobile && !isTablet && !sidebarMaximized && (
            <div
              className="w-1 bg-gray-200 hover:bg-gray-300 cursor-ew-resize transition-colors z-30 hidden lg:block"
              onMouseDown={handleMouseDown}
            />
          )}

          {/* Right Sidebar - Drawer on mobile/tablet, sidebar on desktop */}
          <AnimatePresence>
            {rightSidebarOpen && (
              <>
                {/* Mobile/Tablet Overlay or Maximized Overlay */}
                {(isMobile || isTablet || sidebarMaximized) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:z-30"
                    onClick={() => {
                      if (sidebarMaximized) {
                        setSidebarMaximized(false)
                      } else {
                        setRightSidebarOpen(false)
                      }
                    }}
                  />
                )}
                
                <motion.div
                  ref={sidebarRef}
                  variants={drawerSlide}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={`bg-white border-l border-gray-200 flex flex-col overflow-y-auto ${
                    isMobile || isTablet || sidebarMaximized
                      ? 'fixed right-0 top-0 bottom-0 w-full z-50 shadow-xl h-screen' 
                      : 'relative'
                  }`}
                  style={{ 
                    width: isMobile
                      ? '100vw'
                      : isTablet
                        ? 'min(90vw, 520px)'
                        : sidebarMaximized
                          ? '100vw'
                          : `${sidebarWidth}px`,
                    ...(isMobile || isTablet || sidebarMaximized
                      ? { height: '100vh' }
                      : { height: 'calc(100vh - 80px)', maxHeight: 'calc(100vh - 80px)' }
                    )
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                <div className="p-3 md:p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-base md:text-lg">Analysis</h3>
                    <div className="flex items-center gap-1">
                      {!isMobile && !isTablet && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSidebarMaximized(!sidebarMaximized)}
                          className="h-9 w-9"
                          title={sidebarMaximized ? "Minimize sidebar" : "Maximize sidebar"}
                        >
                          {sidebarMaximized ? (
                            <Minimize2 className="h-4 w-4 md:h-5 md:w-5" />
                          ) : (
                            <Maximize2 className="h-4 w-4 md:h-5 md:w-5" />
                          )}
                        </Button>
                      )}
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
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AnalysisMode)} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-4 mx-2 md:mx-3 mt-2 md:mt-3 mb-0 gap-1 flex-shrink-0">
                      <TabsTrigger value="takeoff" className="text-xs md:text-sm px-2 md:px-3">
                        <BarChart3 className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                        <span className="hidden xl:inline">Takeoff</span>
                      </TabsTrigger>
                      <TabsTrigger value="chat" className="text-xs md:text-sm px-2 md:px-3">
                        <Bot className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                        <span className="hidden xl:inline">Chat</span>
                      </TabsTrigger>
                      <TabsTrigger value="comments" className="text-xs md:text-sm px-2 md:px-3">
                        <MessageSquare className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                        <span className="hidden xl:inline">Comments</span>
                      </TabsTrigger>
                      <TabsTrigger value="items" className="text-xs md:text-sm px-2 md:px-3">
                        <Tag className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                        <span className="hidden xl:inline">Items</span>
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 overflow-y-auto p-2 md:p-4 pb-6">
                      <TabsContent value="takeoff" className="mt-0">
                        <div className="space-y-3 md:space-y-4">
                          {!takeoffResults && (
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
                          )}
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
                                  className={`h-2 transition-all duration-300 ease-out rounded-full ${
                                    analysisProgress.stage === 'primary' ? 'bg-blue-600' :
                                    analysisProgress.stage === 'review' ? 'bg-purple-600' :
                                    analysisProgress.stage === 'missing_info' ? 'bg-orange-600' :
                                    analysisProgress.stage === 'estimate' ? 'bg-green-600' :
                                    'bg-blue-600'
                                  }`}
                                  style={{ width: `${analysisProgress.percent}%` }}
                                />
                              </div>
                              {analysisProgress.stage && analysisProgress.stage !== 'complete' && (
                                <div className="flex gap-2 text-xs text-gray-500">
                                  <span className={analysisProgress.stage === 'primary' ? 'font-semibold text-blue-600' : ''}>
                                    Stage 1: Primary Analysis
                                  </span>
                                  <span>•</span>
                                  <span className={analysisProgress.stage === 'review' ? 'font-semibold text-purple-600' : ''}>
                                    Stage 2: Review
                                  </span>
                                  <span>•</span>
                                  <span className={analysisProgress.stage === 'missing_info' ? 'font-semibold text-orange-600' : ''}>
                                    Stage 3: Missing Info
                                  </span>
                                  <span>•</span>
                                  <span className={analysisProgress.stage === 'estimate' ? 'font-semibold text-green-600' : ''}>
                                    Stage 4: Estimate
                                  </span>
                                </div>
                              )}
                              {analysisProgress.step.includes('underway') ? (
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                  <p className="text-xs text-blue-800 font-medium">
                                    ✅ Your request has been queued for processing. You will receive an email notification when the AI takeoff is complete.
                                  </p>
                                </div>
                              ) : analysisProgress.stage === 'vectorization_required' ? (
                                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                                  <p className="text-xs text-orange-800 font-medium">
                                    {analysisProgress.step}
                                  </p>
                                  <p className="text-xs text-orange-600 mt-1">
                                    Vectorization extracts text from your plans, which helps the AI provide more accurate takeoff results with better cost code assignments.
                                  </p>
                                </div>
                              ) : analysisProgress.percent < 100 ? (
                                <p className="text-xs text-gray-500">
                                  Estimated time: {analysisProgress.timeEstimate || 'Calculating...'}
                                </p>
                              ) : null}
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
                              
                              {/* Missing Information Panel */}
                              {missingInformation && missingInformation.length > 0 && (
                                <div className="mb-4">
                                  <MissingInformationPanel 
                                    missingInformation={missingInformation}
                                  />
                                </div>
                              )}
                              
                              {/* Review Panel */}
                              {reviewResults && (
                                <div className="mb-4">
                                  <TakeoffReviewPanel 
                                    reviewFindings={reviewResults}
                                  />
                                </div>
                              )}
                              
                              <TakeoffSpreadsheet
                                items={takeoffResults.results?.items || []}
                                summary={takeoffResults.results?.summary}
                                onPageNavigate={handlePageNavigate}
                                editable
                                onItemsChange={handleItemsChange}
                                missingInformation={missingInformation}
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

                      <TabsContent value="chat" className="mt-0">
                        <PlanChatPanel jobId={jobId} planId={planId} />
                      </TabsContent>
                      
                      <TabsContent value="comments" className="h-full">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-900">
                              Comments ({drawings.filter(d => d.type === 'comment' && !d.parentCommentId).length})
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleAddCommentFromTab}
                              className="h-7 px-2 text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Comment
                            </Button>
                          </div>
                          {drawings.filter(d => d.type === 'comment' && !d.parentCommentId).length === 0 ? (
                            <div className="text-center py-12">
                              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                              <p className="text-sm text-gray-600 mb-3">No comments yet</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleAddCommentFromTab}
                                className="h-8"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Comment
                              </Button>
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
                      
                      <TabsContent value="items" className="h-full">
                        <ItemList
                          items={drawings.filter(d => d.type === 'item')}
                          onItemClick={handleItemClick}
                          onItemEdit={handleItemEdit}
                          onItemDelete={handleItemDelete}
                          onItemHover={setSidebarHoveredItemId}
                          onAddItemType={(itemType, itemCategory, itemLabel) => {
                            setSelectedItemType({
                              itemType,
                              itemCategory,
                              itemLabel
                            })
                            // Note: The tool will be set to 'item' when user clicks on canvas
                            // We could add a prop to FastPlanCanvas to set the tool, but for now
                            // the user can just click on the canvas and it will place the item
                          }}
                        />
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

      {/* Item Tag Modal */}
      <ItemTagModal
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        x={itemModalPosition.x}
        y={itemModalPosition.y}
        pageNumber={itemModalPosition.pageNumber}
        onSave={handleItemSave}
        editingItem={editingItem ? {
          itemType: editingItem.itemType || '',
          itemLabel: editingItem.itemLabel,
          itemNotes: editingItem.itemNotes,
          itemCategory: editingItem.itemCategory
        } : null}
        onSetForQuickTagging={(item) => {
          setSelectedItemType({
            itemType: item.itemType,
            itemCategory: item.itemCategory,
            itemLabel: item.itemLabel
          })
          setItemModalOpen(false)
        }}
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
        current={currentScaleSetting}
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
        pageDimensions={memoizedPageDimensions}
        pdfNativeDimensions={memoizedPdfNativeDimensions}
      />

      {/* PDF Search Component */}
      <PDFSearch
        isOpen={searchOpen}
        onSearch={handleSearch}
        onNext={handleSearchNext}
        onPrevious={handleSearchPrevious}
        onClose={() => {
          setSearchOpen(false)
          setSearchQuery('')
          setSearchMatchCount(0)
          setSearchCurrentMatch(0)
        }}
        matchCount={searchMatchCount}
        currentMatch={searchCurrentMatch}
      />

      {/* Measurement Selection Summary Panel */}
      <MeasurementSummaryPanel
        selectedMeasurements={drawings.filter(d => selectedMeasurementIds.has(d.id))}
        onClearSelection={() => setSelectedMeasurementIds(new Set())}
        onDeleteSelected={() => {
          const newDrawings = drawings.filter(d => !selectedMeasurementIds.has(d.id))
          handleDrawingsChange(newDrawings)
          setSelectedMeasurementIds(new Set())
        }}
        unit={measurementScaleSettings[currentPage]?.unit || 'ft'}
      />
    </div>
  )
}