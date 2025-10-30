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
  MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { drawerSlide } from '@/lib/animations'
import { Job, Plan } from '@/types/takeoff'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import FastPlanCanvas from '@/components/fast-plan-canvas'
import CommentPinForm from '@/components/comment-pin-form'
import { canvasUtils } from '@/lib/canvas-utils'
import { Drawing } from '@/lib/canvas-utils'
import { CommentPersistence } from '@/lib/comment-persistence'
import ShareLinkGenerator from '@/components/share-link-generator'
import BidPackageModal from '@/components/bid-package-modal'
import BidComparisonModal from '@/components/bid-comparison-modal'
import TakeoffAccordion from '@/components/takeoff-accordion'
import PdfQualitySettings, { QualityMode } from '@/components/pdf-quality-settings'
import ThreadedCommentDisplay from '@/components/threaded-comment-display'
import { organizeCommentsIntoThreads, getReplyCount } from '@/lib/comment-utils'
import { CheckCircle2 } from 'lucide-react'

type AnalysisMode = 'takeoff' | 'quality' | 'comments'

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
  const [qualityResults, setQualityResults] = useState<any>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<{ step: string; percent: number }>({ step: '', percent: 0 })
  const [goToPage, setGoToPage] = useState<number | undefined>(undefined)
  
  // Handle page navigation from takeoff items
  const handlePageNavigate = useCallback((page: number) => {
    setGoToPage(page)
  }, [])
  
  // PDF quality settings
  const [qualityMode, setQualityMode] = useState<QualityMode>('balanced')
  const [scale, setScale] = useState(1.5)
  
  // Modal states
  const [showShareModal, setShowShareModal] = useState(false)
  const [showPackageModal, setShowPackageModal] = useState(false)
  const [showBidsModal, setShowBidsModal] = useState(false)
  
  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(320) // Default 320px (w-80)
  const [isResizing, setIsResizing] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startWidth, setStartWidth] = useState(320)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const commentPersistenceRef = useRef<CommentPersistence | null>(null)
  const supabase = createClient()

  const jobId = params.jobId as string
  const planId = params.planId as string

  // Initialize comment persistence
  useEffect(() => {
    if (user && planId) {
      commentPersistenceRef.current = new CommentPersistence(planId, user.id)
    }
    return () => {
      // Cleanup if needed
    }
  }, [user, planId])

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
      
      // Clamp width between 250px and 800px
      const clampedWidth = Math.max(250, Math.min(800, newWidth))
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

      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user?.id)
        .single()

      if (jobError) throw jobError
      setJob(jobData)

      // Load plan details
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .eq('job_id', jobId)
        .single()

      if (planError) throw planError
      setPlan(planData)

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
        
        // Load comments from the comment system
        try {
          let comments: Drawing[] = []
          
          // Load comments from new system
          if (commentPersistenceRef.current) {
            try {
              comments = await commentPersistenceRef.current.loadComments()
            } catch (error) {
              console.warn('Could not load from plan_comments:', error)
            }
          }
          
          setDrawings(comments)
        } catch (error) {
          console.error('Error loading comments:', error)
        }
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load existing takeoff analysis
  const loadExistingAnalysis = async () => {
    if (!planId || !user) return

    try {
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
        // Ensure items is always an array
        const items = Array.isArray(takeoffAnalysis.items) 
          ? takeoffAnalysis.items 
          : []
        
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
            items: items,
            summary: takeoffAnalysis.summary || {}
          }
        })
      }
    } catch (error) {
      console.log('No existing takeoff analysis found')
    }
  }

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
  }, [])

  // Handle comment pin click (to place new comment)
  const handleCommentPinClick = useCallback((x: number, y: number, pageNumber: number) => {
    setCommentPosition({ x, y, pageNumber })
    setCommentFormOpen(true)
  }, [])

  // Handle comment click (to view existing comment)
  const handleCommentClick = useCallback((comment: Drawing) => {
    if (comment.notes) {
      alert(comment.notes)
    }
    // You could also show a modal with full comment details here
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
    // Smart page selection for comprehensive analysis while staying under payload limits
    const totalPages = pdf.numPages
    let pagesToProcess: number[] = []
    
    // Adjust page count based on retry attempts
    const maxPages = retryCount === 0 ? 5 : (retryCount === 1 ? 3 : 1)
    
    if (totalPages <= maxPages) {
      // Small document - process all pages
      pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1)
    } else {
      // Large document - select key pages strategically
      // Always include: first page, last page, and every 3rd page in between
      pagesToProcess = [1] // First page
      
      // Add every 3rd page (2, 5, 8, 11, etc.) up to page 20
      for (let i = 2; i <= Math.min(totalPages, 20); i += 3) {
        pagesToProcess.push(i)
      }
      
      // Add the last page if not already included
      if (totalPages > 1 && !pagesToProcess.includes(totalPages)) {
        pagesToProcess.push(totalPages)
      }
      
      // Limit based on retry count
      pagesToProcess = pagesToProcess.slice(0, maxPages)
    }
    
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

    try {
      // Step 1: Convert PDF to images (0-70%)
      const images = await convertPdfToImages(retryCount)

      // Step 2: Send to AI (70-90%)
      setAnalysisProgress({ step: 'Analyzing with AI...', percent: 75 })
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

      if (!analysisResponse.ok) {
        if (analysisResponse.status === 413) {
          throw new Error('Request too large - try with fewer pages or lower quality images')
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
      
      // Complete analysis
      setTimeout(() => {
        setAnalysisProgress({ step: '', percent: 0 })
        setIsRunningTakeoff(false)
      }, 500)
      
    } catch (error) {
      console.error('Error running AI takeoff:', error)
      setAnalysisProgress({ step: '', percent: 0 })
      
      // If it's a 413 error, automatically retry with fewer pages
      if (error instanceof Error && error.message.includes('Request too large') && retryCount < 2) {
        console.log(`Retrying with fewer pages (attempt ${retryCount + 1})`)
        setIsRunningTakeoff(false)
        setTimeout(() => {
          handleRunAITakeoff(retryCount + 1)
        }, 1000)
        return
      } else if (error instanceof Error && error.message.includes('Request too large')) {
        alert(`Request still too large even with 1 page. The document may be too complex.`)
      } else {
        alert(`Failed to run AI takeoff: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
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

    try {
      const images = await convertPdfToImages()

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
        const errorData = await analysisResponse.json()
        throw new Error(errorData.error || 'Quality analysis failed')
      }

      const analysisData = await analysisResponse.json()
      setQualityResults(analysisData)
      const issueCount = analysisData.issues?.length || 0
      alert(`Quality check complete! Found ${issueCount} issue${issueCount !== 1 ? 's' : ''}.`)
      
    } catch (error) {
      console.error('Error running quality check:', error)
      alert(`Failed to run quality check: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunningQuality(false)
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/dashboard/jobs/${jobId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Job
                </Button>
              </Link>
              <div className="text-sm text-gray-600">
                <span className="font-medium">{job.name}</span> - {plan.title || plan.file_name}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => setShowShareModal(true)}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowPackageModal(true)}>
                <Package className="h-4 w-4 mr-2" />
                Create Package
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowBidsModal(true)}>
                <Eye className="h-4 w-4 mr-2" />
                View Bids
              </Button>
              <Button variant="ghost" size="sm" onClick={() => console.log('Save clicked')}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                if (planUrl) {
                  window.open(planUrl, '_blank')
                }
              }}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <PdfQualitySettings
                qualityMode={qualityMode}
                onQualityModeChange={handleQualityModeChange}
                onClearCache={handleClearCache}
              />
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex relative" ref={containerRef}>
          <div 
            className="flex-1"
            style={{ width: rightSidebarOpen ? `calc(100% - ${sidebarWidth}px - 1px)` : '100%' }}
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

          {/* Resize Handle */}
          {rightSidebarOpen && (
            <div
              className="w-1 bg-gray-200 hover:bg-gray-300 cursor-ew-resize transition-colors z-30"
              onMouseDown={handleMouseDown}
            />
          )}

          {/* Right Sidebar */}
          <AnimatePresence>
            {rightSidebarOpen && (
              <motion.div
                ref={sidebarRef}
                variants={drawerSlide}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto"
                style={{ width: `${sidebarWidth}px` }}
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Analysis</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRightSidebarOpen(false)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AnalysisMode)} className="h-full">
                    <TabsList className="grid w-full grid-cols-3 mx-4 mt-4 mb-0 gap-1 pr-4 mr-4">
                      <TabsTrigger value="takeoff" className="text-xs">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Takeoff
                      </TabsTrigger>
                      <TabsTrigger value="quality" className="text-xs">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Quality
                      </TabsTrigger>
                      <TabsTrigger value="comments" className="text-xs">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Comments
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="p-4 h-full overflow-y-auto">
                      <TabsContent value="takeoff" className="h-full">
                        <div className="space-y-4">
                          <Button 
                            className="w-full" 
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
                          {isRunningTakeoff && (
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
                                Estimated time: {analysisProgress.percent < 70 ? '30-60 seconds' : '10-30 seconds'}
                              </p>
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
                      
                      <TabsContent value="quality" className="h-full">
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
                          <div className="text-center py-8">
                            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <h4 className="font-semibold text-gray-900 mb-2">No quality analysis yet</h4>
                            <p className="text-sm text-gray-600">Run AI analysis to check for issues</p>
                          </div>
                        </div>
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
            )}
          </AnimatePresence>
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
        takeoffItems={[]} // TODO: Load actual takeoff items
        isOpen={showPackageModal}
        onClose={() => setShowPackageModal(false)}
      />
      <BidComparisonModal
        jobId={jobId}
        isOpen={showBidsModal}
        onClose={() => setShowBidsModal(false)}
      />
    </div>
  )
}