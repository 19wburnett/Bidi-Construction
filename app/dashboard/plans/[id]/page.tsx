'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Minus,
  Plus,
  ZoomIn,
  ZoomOut,
  Move,
  Square,
  Ruler,
  Circle,
  Pencil,
  Layers,
  Trash2,
  Download,
  Save,
  BarChart3,
  AlertTriangle,
  Sparkles,
  Loader2,
  ArrowLeft,
  Settings,
  ChevronRight,
  ChevronLeft,
  PanelRightClose,
  PanelRightOpen,
  MessageSquare,
  X as XIcon,
  FileText,
  Clock,
  Package,
  Lightbulb,
  MapPin,
  User,
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  Check
} from 'lucide-react'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import TakeoffAccordion, { BoundingBox } from '@/components/takeoff-accordion'

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <FallingBlocksLoader />
      </div>
    )
  }
) as any

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
) as any

// We'll configure the worker in a useEffect hook instead

interface Plan {
  id: string
  title: string | null
  file_name: string
  file_path: string
  status: string
  num_pages: number
  project_name: string | null
  project_location: string | null
  takeoff_analysis_status?: string | null
  takeoff_requested_at?: string | null
  quality_analysis_status?: string | null
  quality_requested_at?: string | null
}

interface Drawing {
  id: string
  type: 'line' | 'rectangle' | 'circle' | 'measurement' | 'note'
  geometry: {
    // ABSOLUTE pixel coordinates in "world space" (PDF coordinate system)
    // These never change regardless of zoom level
    x1: number
    y1: number
    x2?: number
    y2?: number
    width?: number
    height?: number
    radius?: number
    // Legacy flag to identify old relative-coordinate drawings
    isRelative?: boolean
  }
  style: {
    color: string
    strokeWidth: number
    opacity: number
  }
  label?: string
  notes?: string
  measurement_data?: {
    length: number
    unit: string
    scale: string
  }
  note_data?: {
    note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
    category: string | null
    location: string | null
    content: string
    confidence_score: number
  }
  page_number?: number
  analysis_item_id?: string
  analysis_type?: string
  is_locked?: boolean
}

type DrawingTool = 'select' | 'line' | 'rectangle' | 'circle' | 'measurement' | 'note'
type AnalysisMode = 'takeoff' | 'quality' | 'notes'

interface NoteForm {
  note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
  category: string
  location: string
  content: string
}

const NOTE_TYPE_CONFIG = {
  requirement: { 
    icon: '📄',
    color: '#3b82f6',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-900',
    borderColor: 'border-blue-500'
  },
  concern: { 
    icon: '⚠️',
    color: '#ef4444',
    bgColor: 'bg-red-100',
    textColor: 'text-red-900',
    borderColor: 'border-red-500'
  },
  suggestion: { 
    icon: '💡',
    color: '#22c55e',
    bgColor: 'bg-green-100',
    textColor: 'text-green-900',
    borderColor: 'border-green-500'
  },
  timeline: { 
    icon: '⏰',
    color: '#eab308',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-900',
    borderColor: 'border-yellow-500'
  },
  material: { 
    icon: '📦',
    color: '#a855f7',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-900',
    borderColor: 'border-purple-500'
  },
  other: { 
    icon: '📝',
    color: '#6b7280',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-500'
  }
}

export default function PlanEditorPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const planId = params.id as string

  // Plan state
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planUrl, setPlanUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [numPages, setNumPages] = useState<number | null>(null)

  // Canvas state
  const [zoom, setZoom] = useState(0.5) // Default to 50% zoom
  const [viewport, setViewport] = useState({ x: 0, y: 0 }) // Pan position in screen coordinates
  const [activeTool, setActiveTool] = useState<DrawingTool>('select')
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null)
  const [pdfJsReady, setPdfJsReady] = useState(false)
  const [documentReady, setDocumentReady] = useState(false)
  const [pdfError, setPdfError] = useState(false)
  const pdfDocumentRef = useRef<any>(null)
  
  // Debounce zoom changes to prevent flickering
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Figma-style simple redraw system
  const redrawAllCanvases = useCallback(() => {
    console.log('🎨 Figma-style redraw:', { drawings: drawings.length, current: currentDrawing ? 'yes' : 'no', zoom })
    
    canvasRefs.current.forEach((canvas, pageNum) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Clear canvas completely
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
      
      // Apply transform
      ctx.save()
      ctx.translate(viewport.x, viewport.y)
      ctx.scale(zoom, zoom)

      // Draw all saved drawings for this page
      drawings.forEach(drawing => {
        if (drawing.page_number !== pageNum) return
        
        const geom = drawing.geometry
        let x1, y1, x2, y2
        
        if (geom.isRelative) {
          // Legacy relative coordinates
          x1 = geom.x1 * canvas.width
          y1 = geom.y1 * canvas.height
          x2 = geom.x2 ? geom.x2 * canvas.width : x1
          y2 = geom.y2 ? geom.y2 * canvas.height : y1
        } else {
          // Absolute coordinates (Figma style)
          x1 = geom.x1
          y1 = geom.y1
          x2 = geom.x2 || x1
          y2 = geom.y2 || y1
        }

        ctx.strokeStyle = drawing.style.color
        ctx.lineWidth = drawing.style.strokeWidth / zoom
        ctx.globalAlpha = drawing.style.opacity

        if (drawing.type === 'line' || drawing.type === 'measurement') {
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        } else if (drawing.type === 'rectangle' && geom.x2 && geom.y2) {
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
        }
      })

      // Draw current drawing in progress
      if (currentDrawing && currentDrawing.geometry && currentDrawing.page_number === pageNum) {
        const geom = currentDrawing.geometry
        ctx.strokeStyle = currentDrawing.style?.color || '#3b82f6'
        ctx.lineWidth = (currentDrawing.style?.strokeWidth || 2) / zoom
        ctx.globalAlpha = currentDrawing.style?.opacity || 1

        const x1 = geom.x1
        const y1 = geom.y1
        const x2 = geom.x2 || x1
        const y2 = geom.y2 || y1

        if ((currentDrawing.type === 'line' || currentDrawing.type === 'measurement') && geom.x2 && geom.y2) {
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        } else if (currentDrawing.type === 'rectangle' && geom.x2 && geom.y2) {
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
        }
      }
      
      ctx.restore()
    })
  }, [drawings, currentDrawing, zoom, viewport])

  // Debounced redraw for zoom changes
  const debouncedRedraw = useCallback(() => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current)
    }
    zoomTimeoutRef.current = setTimeout(() => {
      console.log('🎨 Debounced redraw after zoom change')
      redrawAllCanvases()
    }, 16) // ~60fps
  }, [redrawAllCanvases])

  // Analysis state
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('takeoff')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [takeoffResults, setTakeoffResults] = useState<any>(null)
  const [qualityResults, setQualityResults] = useState<any>(null)
  
  // Model progress tracking
  const [modelProgress, setModelProgress] = useState<{
    [key: string]: 'pending' | 'running' | 'completed' | 'failed'
  }>({})
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState<'normal' | 'wide' | 'full'>('normal')
  
  // Highlight state for click-to-highlight functionality
  const [highlightedBox, setHighlightedBox] = useState<BoundingBox | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Zoom feedback state
  const [showZoomIndicator, setShowZoomIndicator] = useState(false)

  // Scale state
  const [scale, setScale] = useState({ ratio: `1/4" = 1'`, pixelsPerUnit: 48 })
  const [isSettingScale, setIsSettingScale] = useState(false)

  // Note state
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [pendingNotePosition, setPendingNotePosition] = useState<{ x: number, y: number, pageNum: number } | null>(null)
  const [noteForm, setNoteForm] = useState<NoteForm>({
    note_type: 'other',
    category: '',
    location: '',
    content: ''
  })
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)

  // Refs
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfPageRef = useRef<HTMLDivElement>(null)
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Initialize PDF.js and load CSS on client side
  useEffect(() => {
    const initPdfJs = async () => {
      try {
        // Load CSS files (non-blocking, ignore type errors)
        import('react-pdf/dist/Page/AnnotationLayer.css' as any)
        import('react-pdf/dist/Page/TextLayer.css' as any)
        
        // Configure PDF.js worker
        const pdfjs = await import('react-pdf')
        pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        
        // Wait longer to ensure worker is fully initialized
        // This prevents "messageHandler is null" errors
        // Increased to 3 seconds for maximum reliability
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Mark as ready
        setPdfJsReady(true)
      } catch (error) {
        console.error('Error initializing PDF.js:', error)
      }
    }
    
    // Inject CSS to prevent browser zoom
    const style = document.createElement('style')
    style.id = 'prevent-zoom-style'
    style.textContent = `
      body {
        touch-action: pan-y pan-x !important;
      }
    `
    document.head.appendChild(style)
    
    initPdfJs()
    
    return () => {
      // Clean up style on unmount
      const styleEl = document.getElementById('prevent-zoom-style')
      if (styleEl) {
        document.head.removeChild(styleEl)
      }
    }
  }, [])

  useEffect(() => {
    if (user && planId && pdfJsReady) {
      // Reset document ready state
      setDocumentReady(false)
      
      // Add additional delay before loading plan to ensure worker is ready
      const timer = setTimeout(async () => {
        await loadPlan()
        // Document ready will be set by onDocumentLoadSuccess callback
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [user, planId, pdfJsReady])

  async function loadPlan() {
    try {
      const supabase = createClient()

      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('User not authenticated:', authError)
        throw new Error('User not authenticated')
      }

      // Load plan details
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .single()

      if (planError) throw planError

      setPlan(planData)

      // Get signed URL for the plan file
      const { data: urlData, error: urlError } = await supabase.storage
        .from('plans')
        .createSignedUrl(planData.file_path, 3600)

      if (urlError) {
        console.error('Error creating signed URL:', urlError)
        throw new Error(`Failed to create signed URL: ${urlError.message}`)
      }

      if (urlData) {
        setPlanUrl(urlData.signedUrl)
      }

      // Load existing drawings for all pages
      const { data: drawingsData, error: drawingsError } = await supabase
        .from('plan_drawings')
        .select('*')
        .eq('plan_id', planId)
        .order('page_number', { ascending: true })

      if (drawingsError) {
        console.error('Error loading drawings:', drawingsError)
        // Don't throw here, just log the error and continue without drawings
      }

      if (drawingsData) {
        setDrawings(drawingsData.map((d: any) => {
          let geometry = d.geometry
          let isRelative = geometry.isRelative !== false // Default to relative for old drawings
          
          // Extract canvas dimensions from geometry if they exist
          const canvas_width = geometry.canvas_width
          const canvas_height = geometry.canvas_height
          
          // Migration: Check if this is an old drawing with relative coordinates (0-1)
          // New drawings have isRelative: false flag
          if (isRelative && geometry.x1 <= 1 && geometry.y1 <= 1) {
            // Legacy drawing with relative coordinates - convert to absolute
            // Use stored canvas dimensions or assume standard PDF page size
            const refWidth = canvas_width || 612  // Standard PDF page width
            const refHeight = canvas_height || 792 // Standard PDF page height
            
            console.log('📦 Migrating legacy drawing from relative to absolute:', d.id)
            geometry = {
              x1: geometry.x1 * refWidth,
              y1: geometry.y1 * refHeight,
              x2: geometry.x2 ? geometry.x2 * refWidth : undefined,
              y2: geometry.y2 ? geometry.y2 * refHeight : undefined,
              isRelative: false // Mark as migrated
            }
          } else {
            // Already absolute or marked as absolute
            geometry = {
              x1: geometry.x1,
              y1: geometry.y1,
              x2: geometry.x2,
              y2: geometry.y2,
              isRelative: false
            }
          }
          
          return {
            id: d.id,
            type: d.drawing_type,
            geometry: geometry,
            style: d.style,
            label: d.label,
            notes: d.notes,
            measurement_data: d.measurement_data,
            note_data: d.note_data,
            page_number: d.page_number
          }
        }))
      }

      // Load existing analyses if available
      loadAnalyses()

    } catch (error) {
      console.error('Error loading plan:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadAnalyses() {
    try {
      const supabase = createClient()

      // Load takeoff analysis
      const { data: takeoffData, error: takeoffError } = await supabase
        .from('plan_takeoff_analysis')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (takeoffData && !takeoffError) {
        setTakeoffResults(takeoffData)
      }

      // Load quality analysis
      const { data: qualityData, error: qualityError } = await supabase
        .from('plan_quality_analysis')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (qualityData && !qualityError) {
        setQualityResults(qualityData)
      }

      // Load analysis markers (from admin analysis)
      const { data: analysisMarkers } = await supabase
        .from('plan_drawings')
        .select('*')
        .eq('plan_id', planId)
        .not('analysis_item_id', 'is', null)

      if (analysisMarkers && analysisMarkers.length > 0) {
        // Add analysis markers to drawings (as read-only/locked)
        const formattedMarkers = analysisMarkers.map((m: any) => ({
          id: m.id,
          type: m.drawing_type,
          geometry: m.geometry,
          style: m.style,
          page_number: m.page_number,
          analysis_item_id: m.analysis_item_id,
          analysis_type: m.analysis_type,
          is_locked: true // Mark as read-only
        }))
        
        setDrawings(prev => {
          // Merge with existing user drawings, avoid duplicates
          const existingIds = new Set(prev.map(d => d.id))
          const newMarkers = formattedMarkers.filter(m => !existingIds.has(m.id))
          return [...prev, ...newMarkers]
        })
      }

    } catch (error) {
      console.error('Error loading analyses:', error)
    }
  }

  const onDocumentLoadSuccess = (pdf: any) => {
    console.log('📄 PDF Document loaded successfully with', pdf.numPages, 'pages')
    pdfDocumentRef.current = pdf
    setNumPages(pdf.numPages)
    // Set document ready to true after a small delay to ensure PDF.js is fully initialized
    setTimeout(() => {
      setDocumentReady(true)
      console.log('✅ Document ready to render pages')
    }, 100)
  }



  // Handle item highlight - scrolls to page and sets highlighted box
  const handleItemHighlight = useCallback((bbox: BoundingBox) => {
    setHighlightedBox(bbox)
    
    // Scroll to the page containing this item
    const pageElement = document.querySelector(`[data-page-number="${bbox.page}"]`)
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    
    // Clear highlight after 5 seconds
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current)
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedBox(null)
    }, 5000)
  }, [])

  // Draw highlight overlay when an item is clicked
  useEffect(() => {
    if (!highlightedBox) return
    
    const canvas = canvasRefs.current.get(highlightedBox.page)
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Redraw base canvas first to clear any previous highlights
    redrawAllCanvases()
    
    // Get the PDF page element to calculate proper coordinates
    const pdfPageElement = canvas.parentElement
    if (!pdfPageElement) return
    
    const rect = pdfPageElement.getBoundingClientRect()
    
    // Convert normalized coordinates (0-1) to actual canvas pixels
    // The bounding box coordinates are normalized to the page size
    const x = highlightedBox.x * rect.width
    const y = highlightedBox.y * rect.height
    const w = highlightedBox.width * rect.width
    const h = highlightedBox.height * rect.height
    
    // Draw pulsing highlight box
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform to screen space
    
    // Draw stroke
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 4
    ctx.setLineDash([8, 4])
    ctx.shadowColor = '#3b82f6'
    ctx.shadowBlur = 15
    ctx.strokeRect(x, y, w, h)
    
    // Fill with semi-transparent blue
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(x, y, w, h)
    
    ctx.restore()
  }, [highlightedBox, redrawAllCanvases])

  // Figma-style: Update canvas sizes when PDF pages size changes
  useEffect(() => {
    const updateCanvasSizes = () => {
      canvasRefs.current.forEach((canvas, pageNum) => {
        const pdfPageElement = canvas.parentElement
        if (pdfPageElement) {
          const rect = pdfPageElement.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width
            canvas.height = rect.height
          }
        }
      })
      // Direct redraw after canvas resize
      redrawAllCanvases()
    }

    // Update on mount and when zoom/pages change
    // Use multiple timeouts to catch the canvas at different stages
    const timer1 = setTimeout(updateCanvasSizes, 100)
    const timer2 = setTimeout(updateCanvasSizes, 300)
    const timer3 = setTimeout(updateCanvasSizes, 500)
    window.addEventListener('resize', updateCanvasSizes)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      window.removeEventListener('resize', updateCanvasSizes)
    }
  }, [zoom, planUrl, numPages]) // Removed redrawAllCanvases from deps

  // Figma-style: Redraw whenever anything visual changes
  useEffect(() => {
    console.log('🎨 Figma-style visual change:', { 
      drawingsCount: drawings.length,
      hasCurrentDrawing: currentDrawing ? 'yes' : 'no',
      zoom,
      activeTool
    })
    
    // Always use direct redraw - keep it simple
    redrawAllCanvases()
  }, [drawings.length, zoom, viewport.x, viewport.y, activeTool]) // Removed redrawAllCanvases from deps


  // Figma-style: Handle currentDrawing updates during active drawing
  useEffect(() => {
    if (isDrawing && currentDrawing) {
      // Direct redraw for smooth preview - no animation frames
      redrawAllCanvases()
    }
  }, [isDrawing, currentDrawing]) // Removed redrawAllCanvases from deps

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return // Don't interfere with input fields
      }

      switch(e.key.toLowerCase()) {
        case 'v':
        case 'escape':
          setActiveTool('select')
          setIsDrawing(false)
          setCurrentDrawing(null)
          setIsCreatingNote(false)
          setPendingNotePosition(null)
          break
        case 'l':
          setActiveTool('line')
          break
        case 'r':
          setActiveTool('rectangle')
          break
        case 'm':
          setActiveTool('measurement')
          break
        case 'n':
          setActiveTool('note')
          break
        case 'a':
          // Toggle analysis sidebar
          setSidebarVisible(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Mouse/Trackpad gestures for zoom and pan
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Figma-style wheel handling - zoom with trackpad, pan with Shift
    const handleWheel = (e: WheelEvent) => {
      console.log('🖱️ Wheel event:', { 
        deltaY: e.deltaY, 
        deltaX: e.deltaX,
        deltaMode: e.deltaMode, 
        ctrlKey: e.ctrlKey, 
        metaKey: e.metaKey,
        shiftKey: e.shiftKey
      })
      
      // Figma-style: Ctrl/Cmd+wheel = zoom, no modifiers = let browser handle (for now we'll make trackpad pinch zoom)
      const isPinchZoom = e.ctrlKey || e.metaKey
      
      if (isPinchZoom) {
        e.preventDefault()
        e.stopPropagation()
        
        // Calculate zoom with exponential scaling (like Figma)
        const delta = -e.deltaY
        const zoomFactor = 1 + (delta * 0.01) // Smooth exponential zoom
        
        console.log('🔍 Zoom factor:', zoomFactor)
        
        setZoom(prevZoom => {
          const newZoom = prevZoom * zoomFactor
          const clampedZoom = Math.max(0.1, Math.min(10, newZoom))
          console.log('📏 Zoom:', prevZoom.toFixed(2), '->', clampedZoom.toFixed(2))
          return clampedZoom
        })

        // Show zoom indicator
        setShowZoomIndicator(true)
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current)
        }
        zoomTimeoutRef.current = setTimeout(() => {
          setShowZoomIndicator(false)
        }, 1000)
      }
    }

    // Also prevent browser zoom with gesturestart/gesturechange events (Safari)
    const preventGesture = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // Prevent browser zoom on the document level as well
    const preventDocumentZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    
    // Prevent touchpad pinch-to-zoom more aggressively
    const preventTouchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Prevent touchpad pinch-to-zoom on document
    const preventDocumentGesture = (e: Event) => {
      e.preventDefault()
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('gesturestart', preventGesture, { passive: false })
    container.addEventListener('gesturechange', preventGesture, { passive: false })
    container.addEventListener('gestureend', preventGesture, { passive: false })
    
    // Add document-level listeners to prevent browser zoom
    document.addEventListener('wheel', preventDocumentZoom, { passive: false })
    document.addEventListener('gesturestart', preventDocumentGesture, { passive: false })
    document.addEventListener('gesturechange', preventDocumentGesture, { passive: false })
    document.addEventListener('gestureend', preventDocumentGesture, { passive: false })
    
    // Add touch event listeners for better pinch detection
    container.addEventListener('touchstart', preventTouchZoom, { passive: false })
    container.addEventListener('touchmove', preventTouchZoom, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('gesturestart', preventGesture)
      container.removeEventListener('gesturechange', preventGesture)
      container.removeEventListener('gestureend', preventGesture)
      container.removeEventListener('touchstart', preventTouchZoom)
      container.removeEventListener('touchmove', preventTouchZoom)
      
      document.removeEventListener('wheel', preventDocumentZoom)
      document.removeEventListener('gesturestart', preventDocumentGesture)
      document.removeEventListener('gesturechange', preventDocumentGesture)
      document.removeEventListener('gestureend', preventDocumentGesture)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🖱️ Mouse down:', { activeTool, isPanning, target: e.currentTarget.tagName })
    
    if (activeTool === 'select') {
      // Start panning
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const pageNum = parseInt(canvas.getAttribute('data-page') || '1')
    
    // Get screen coordinates
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    // Convert screen coordinates to world coordinates (reverse the transform)
    // screen = (world * zoom) + viewport
    // world = (screen - viewport) / zoom
    const worldX = (screenX - viewport.x) / zoom
    const worldY = (screenY - viewport.y) / zoom

    console.log('📍 Coords:', { 
      screen: `(${screenX.toFixed(1)}, ${screenY.toFixed(1)})`,
      world: `(${worldX.toFixed(1)}, ${worldY.toFixed(1)})`,
      zoom,
      viewport: `(${viewport.x}, ${viewport.y})`,
      pageNum
    })

    // Note tool - single click to place
    if (activeTool === 'note') {
      // Store absolute world coordinates
      setPendingNotePosition({ x: worldX, y: worldY, pageNum })
      setIsCreatingNote(true)
      return
    }

    setIsDrawing(true)
    const newDrawing = {
      type: activeTool as any,
      geometry: { x1: worldX, y1: worldY, isRelative: false },
      style: { color: '#3b82f6', strokeWidth: 3, opacity: 0.8 },
      page_number: pageNum
    }
    console.log('🎯 Starting new drawing:', newDrawing)
    setCurrentDrawing(newDrawing)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      // Handle panning by updating viewport position
      const deltaX = e.clientX - panStart.x
      const deltaY = e.clientY - panStart.y
      
      setViewport(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
      
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    if (!isDrawing || !currentDrawing) return

    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()

    // Get screen coordinates
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    // Convert screen coordinates to world coordinates
    const worldX = (screenX - viewport.x) / zoom
    const worldY = (screenY - viewport.y) / zoom

    const updatedDrawing = {
      ...currentDrawing,
      geometry: {
        ...currentDrawing.geometry!,
        x2: worldX,
        y2: worldY
      }
    }
    console.log('🖱️ Mouse move - updating drawing:', updatedDrawing)
    setCurrentDrawing(updatedDrawing)
    
    // Request smooth redraw on next animation frame
    redrawAllCanvases()
  }

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (isDrawing && currentDrawing && currentDrawing.geometry?.x2 && currentDrawing.geometry?.y2) {
      // Only save if the drawing has actual size (in absolute coordinates)
      const dx = Math.abs(currentDrawing.geometry.x2 - currentDrawing.geometry.x1)
      const dy = Math.abs(currentDrawing.geometry.y2 - currentDrawing.geometry.y1)
      
      // Minimum size threshold: 5 pixels in world coordinates
      if (dx > 5 || dy > 5) {
        let newDrawing = {
          ...currentDrawing,
          id: `drawing-${Date.now()}`,
          geometry: {
            ...currentDrawing.geometry,
            isRelative: false // Mark as absolute coordinates
          }
        } as Drawing

        // Calculate measurement for measurement tool
        if (currentDrawing.type === 'measurement') {
          const pixelLength = Math.sqrt(dx * dx + dy * dy)
          // Convert pixels to real-world units using scale
          const realLength = pixelLength / scale.pixelsPerUnit
          
          // Format the measurement
          let displayLength: string
          let unit: string
          
          if (scale.ratio.includes(':')) {
            // Metric scale
            unit = 'm'
            displayLength = realLength.toFixed(2)
          } else {
            // Imperial scale (feet and inches)
            unit = 'ft'
            const feet = Math.floor(realLength)
            const inches = Math.round((realLength - feet) * 12)
            
            if (inches === 0) {
              displayLength = `${feet}'`
            } else if (inches === 12) {
              displayLength = `${feet + 1}'`
            } else {
              displayLength = `${feet}'-${inches}"`
            }
          }

          newDrawing.measurement_data = {
            length: realLength,
            unit: unit,
            scale: scale.ratio
          }
          newDrawing.label = displayLength
          
          console.log('📏 Measurement calculated:', { 
            pixelLength: pixelLength.toFixed(2),
            realLength: realLength.toFixed(2),
            display: displayLength,
            scale: scale.ratio
          })
        }

        console.log('✅ Saving drawing:', newDrawing)
        setDrawings([...drawings, newDrawing])
        saveDrawing(newDrawing)
      } else {
        console.log('❌ Drawing too small, discarded:', { dx, dy })
      }
    }

    setIsDrawing(false)
    setCurrentDrawing(null)
    setActiveTool('select')
  }

  const handleMouseLeave = () => {
    setIsPanning(false)
    setIsDrawing(false)
  }

  const handleCreateNote = () => {
    if (!noteForm.content.trim() || !pendingNotePosition) {
      alert('Please enter note content')
      return
    }

    const config = NOTE_TYPE_CONFIG[noteForm.note_type]
    
    const newNote: Drawing = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'note',
      geometry: {
        x1: pendingNotePosition.x,
        y1: pendingNotePosition.y,
        isRelative: false // Using absolute coordinates
      },
      style: {
        color: config.color,
        strokeWidth: 2,
        opacity: 1
      },
      note_data: {
        note_type: noteForm.note_type,
        category: noteForm.category || null,
        location: noteForm.location || null,
        content: noteForm.content,
        confidence_score: 1.0 // User-created notes have 100% confidence
      },
      page_number: pendingNotePosition.pageNum
    }

    console.log('📝 Creating note at absolute coords:', { x: pendingNotePosition.x, y: pendingNotePosition.y, pageNum: pendingNotePosition.pageNum })

    setDrawings([...drawings, newNote])
    saveDrawing(newNote)
    
    // Reset form
    setNoteForm({
      note_type: 'other',
      category: '',
      location: '',
      content: ''
    })
    setIsCreatingNote(false)
    setPendingNotePosition(null)
    setActiveTool('select')
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return

    try {
      const supabase = createClient()
      
      // Delete from database
      await supabase
        .from('plan_drawings')
        .delete()
        .eq('id', noteId)
        .eq('plan_id', planId)

      // Update local state
      setDrawings(drawings.filter(d => d.id !== noteId))
      
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null)
      }
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Failed to delete note')
    }
  }

  async function saveDrawing(drawing: Drawing) {
    try {
      const supabase = createClient()

      // Geometry now contains absolute coordinates with isRelative: false flag
      await supabase.from('plan_drawings').insert({
        plan_id: planId,
        user_id: user?.id,
        page_number: drawing.page_number || 1,
        drawing_type: drawing.type,
        geometry: drawing.geometry, // Absolute coordinates with isRelative flag
        style: drawing.style,
        label: drawing.label,
        notes: drawing.notes,
        measurement_data: drawing.measurement_data,
        note_data: drawing.note_data
      })
      
      console.log('💾 Saved drawing with absolute coordinates:', drawing.id)
    } catch (error) {
      console.error('Error saving drawing:', error)
    }
  }

  async function convertPdfPagesToImages(): Promise<string[]> {
    if (typeof window === 'undefined' || !planUrl) return []
    
    const images: string[] = []
    const pdfjsLib = await import('pdfjs-dist')
    
    // Configure worker if not already configured
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
    }
    
    try {
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument(planUrl)
      const pdf = await loadingTask.promise
      
      // Limit pages for very large plans to avoid Vercel payload limits
      const maxPages = 15 // Limit to 15 pages max for enhanced analysis
      const pagesToConvert = Math.min(pdf.numPages, maxPages)
      
      if (pdf.numPages > maxPages) {
        console.warn(`Plan has ${pdf.numPages} pages, limiting to ${maxPages} for enhanced analysis`)
      }
      
      for (let pageNum = 1; pageNum <= pagesToConvert; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1.0 }) // Minimal scale for Vercel payload limits
        
        // Create a temporary canvas
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) continue
        
        canvas.height = viewport.height
        canvas.width = viewport.width
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise
        
        // Convert to JPEG base64 with maximum compression for Vercel payload limits
        const dataUrl = canvas.toDataURL('image/jpeg', 0.2) // Maximum compression for large plans
        images.push(dataUrl)
      }
      
      return images
    } catch (error) {
      console.error('Error converting PDF to images:', error)
      throw new Error('Failed to convert PDF pages to images')
    }
  }

  // Check payload size and warn if approaching Vercel limits
  const checkPayloadSize = (images: string[]): { size: number, warning?: string } => {
    const payloadSize = JSON.stringify({ images }).length
    const sizeInMB = payloadSize / (1024 * 1024)
    
    if (sizeInMB > 2.0) { // Very aggressive limit for Vercel
      return {
        size: sizeInMB,
        warning: `Payload size (${sizeInMB.toFixed(2)}MB) exceeds Vercel's 4.5MB limit. Applying additional compression...`
      }
    }
    
    return { size: sizeInMB }
  }

  // Further compress images if payload is too large
  const compressImagesForVercel = async (images: string[]): Promise<string[]> => {
    const payloadCheck = checkPayloadSize(images)
    
    if (payloadCheck.size > 2.0) {
      console.log(`Payload too large (${payloadCheck.size.toFixed(2)}MB), applying additional compression...`)
      
      const compressedImages: string[] = []
      
      for (const imageDataUrl of images) {
        try {
          // Create a temporary image element to resize
          const img = new Image()
          img.src = imageDataUrl
          
          await new Promise((resolve) => {
            img.onload = () => {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')
              
              if (!ctx) {
                compressedImages.push(imageDataUrl)
                resolve(void 0)
                return
              }
              
              // Resize to 20% of original size for Vercel limits
              canvas.width = img.width * 0.2
              canvas.height = img.height * 0.2
              
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              
              // Convert with maximum compression
              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.1)
              compressedImages.push(compressedDataUrl)
              resolve(void 0)
            }
          })
        } catch (error) {
          console.error('Error compressing image:', error)
          compressedImages.push(imageDataUrl) // Use original if compression fails
        }
      }
      
      const newPayloadCheck = checkPayloadSize(compressedImages)
      console.log(`After compression: ${newPayloadCheck.size.toFixed(2)}MB`)
      
      return compressedImages
    }
    
    return images
  }

  // Simulate model progress updates
  const simulateModelProgress = () => {
    const models = ['GPT-4o', 'GPT-4-turbo', 'Grok-4', 'Claude-3-haiku', 'Gemini-1.5-Flash']
    const intervals = [1000, 3000, 6000, 9000, 12000] // Different start times
    
    models.forEach((model, index) => {
      setTimeout(() => {
        setModelProgress(prev => ({ ...prev, [model]: 'running' }))
        setCurrentModel(model)
      }, intervals[index])
      
      // Simulate completion after 2-4 seconds
      setTimeout(() => {
        setModelProgress(prev => ({ ...prev, [model]: 'completed' }))
        if (index === models.length - 1) {
          setCurrentModel(null)
        }
      }, intervals[index] + 2000 + Math.random() * 2000)
    })
  }

  async function runTakeoffAnalysis() {
    setIsAnalyzing(true)
    
    // Initialize model progress
    setModelProgress({})
    setCurrentModel(null)
    
    // Start simulating model progress
    simulateModelProgress()
    setAnalysisMode('takeoff')

    try {
      const supabase = createClient()
      
      // Mark the plan as pending takeoff analysis
      await supabase
        .from('plans')
        .update({ 
          takeoff_analysis_status: 'pending',
          takeoff_requested_at: new Date().toISOString()
        })
        .eq('id', planId)

      // Show pending status immediately
      setTakeoffResults({
        status: 'pending',
        message: 'Converting PDF to images for enhanced multi-model analysis...',
        requested_at: new Date().toISOString()
      })

      // Convert PDF pages to images
      const images = await convertPdfPagesToImages()
      
      if (images.length === 0) {
        throw new Error('Failed to convert PDF to images')
      }

      // Check payload size for Vercel limits and compress if needed
      const payloadCheck = checkPayloadSize(images)
      if (payloadCheck.warning) {
        console.warn('Payload size warning:', payloadCheck.warning)
        // Apply additional compression for Vercel limits
        const compressedImages = await compressImagesForVercel(images)
        images.length = 0 // Clear original array
        images.push(...compressedImages) // Replace with compressed images
        console.log('Applied additional compression for Vercel payload limits')
      }

      // Determine if we need batch processing (more than 5 pages)
      const needsBatchProcessing = images.length > 5
      
      if (needsBatchProcessing) {
        // Show batch processing status
        setTakeoffResults({
          status: 'pending',
          message: `Running enhanced consensus analysis with batch processing on ${images.length} pages...`,
          requested_at: new Date().toISOString()
        })

        // Call the batch processing API
        const response = await fetch('/api/plan/analyze-enhanced-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            planId: planId,
            images: images,
            drawings: drawings, // Include any user annotations
            taskType: 'takeoff'
          })
        })

        if (!response.ok) {
          let errorMessage = 'Batch enhanced analysis failed'
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.details || errorMessage
          } catch (parseError) {
            errorMessage = response.statusText || `HTTP ${response.status} Error`
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()

        // Update plan status to completed
        await supabase
          .from('plans')
          .update({ 
            takeoff_analysis_status: 'completed',
            finish_takeoff_analysis: true
          })
          .eq('id', planId)

        // Show enhanced results with batch processing metadata
        setTakeoffResults({
          status: 'completed',
          message: 'Enhanced batch analysis complete!',
          items: data.results?.items || [],
          summary: data.results?.summary || {},
          analysisId: data.analysisId,
          requested_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        
        // Reset model progress
        setModelProgress({})
        setCurrentModel(null)

        const consensusScore = Math.round((data.consensus?.confidence || 0) * 100)
        const modelCount = data.consensus?.consensusCount || 0
        const disagreements = data.consensus?.disagreements?.length || 0
        const batchesProcessed = data.batchProcessing?.totalBatches || 0
        const isFallback = data.consensus?.modelAgreements?.includes('chatgpt-fallback')
        
        if (isFallback) {
          alert(`✅ Analysis Complete! (ChatGPT Fallback)\n\n🤖 Enhanced multi-model system unavailable\n🔄 Used ChatGPT-only analysis as fallback\n📊 Processed ${batchesProcessed} batches of pages\n🎯 Confidence Score: ${consensusScore}%\n📊 View detailed results in the sidebar`)
        } else {
          alert(`✅ Enhanced Batch Analysis Complete!\n\n🤖 ${modelCount} AI models analyzed your plan\n📊 Processed ${batchesProcessed} batches of pages\n🎯 Consensus Score: ${consensusScore}%\n${disagreements > 0 ? `⚠️ ${disagreements} disagreements flagged for review\n` : ''}📊 View detailed results in the sidebar`)
        }

      } else {
        // Use regular enhanced analysis for smaller plans
        setTakeoffResults({
          status: 'pending',
          message: `Running enhanced consensus analysis with 5+ specialized AI models on ${images.length} page${images.length > 1 ? 's' : ''}...`,
          requested_at: new Date().toISOString()
        })

        // Call the enhanced multi-model API
        const response = await fetch('/api/plan/analyze-enhanced', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            planId: planId,
            images: images,
            drawings: drawings, // Include any user annotations
            taskType: 'takeoff'
          })
        })

        if (!response.ok) {
          let errorMessage = 'Enhanced analysis failed'
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.details || errorMessage
          } catch (parseError) {
            errorMessage = response.statusText || `HTTP ${response.status} Error`
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()

        // Update plan status to completed
        await supabase
          .from('plans')
          .update({ 
            takeoff_analysis_status: 'completed',
            finish_takeoff_analysis: true
          })
          .eq('id', planId)

        // Show enhanced results with consensus metadata
        setTakeoffResults({
          status: 'completed',
          message: 'Enhanced consensus analysis complete!',
          items: data.results?.items || [],
          summary: data.results?.summary || {},
          analysisId: data.analysisId,
          requested_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })

        const consensusScore = Math.round((data.consensus?.confidence || 0) * 100)
        const modelCount = data.consensus?.consensusCount || 0
        const disagreements = data.consensus?.disagreements?.length || 0
        const isFallback = data.consensus?.modelAgreements?.includes('chatgpt-fallback')

        if (isFallback) {
          alert(`✅ Analysis Complete! (ChatGPT Fallback)\n\n🤖 Enhanced multi-model system unavailable\n🔄 Used ChatGPT-only analysis as fallback\n🎯 Confidence Score: ${consensusScore}%\n📊 View detailed results in the sidebar`)
        } else {
          alert(`✅ Enhanced Analysis Complete!\n\n🤖 ${modelCount} AI models analyzed your plan\n🎯 Consensus Score: ${consensusScore}%\n${disagreements > 0 ? `⚠️ ${disagreements} disagreements flagged for review\n` : ''}📊 View detailed results in the sidebar`)
        }
      }

    } catch (error) {
      console.error('Error requesting enhanced takeoff analysis:', error)
      
      // Mark as failed in database
      const supabase = createClient()
      await supabase
        .from('plans')
        .update({ 
          takeoff_analysis_status: 'failed'
        })
        .eq('id', planId)

      setTakeoffResults({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Enhanced analysis failed',
        requested_at: new Date().toISOString()
      })

      // Check if it's a configuration error (missing environment variables)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isConfigError = errorMessage.includes('Enhanced AI system not configured') || 
                           errorMessage.includes('Missing environment variables')
      const isSizeError = errorMessage.includes('Too many images') || 
                         errorMessage.includes('Payload Too Large')
      
      if (isConfigError) {
        // Show helpful message about configuration
        alert('⚠️ Enhanced AI System Not Configured\n\n' + 
              'The enhanced multi-model system requires additional API keys to be configured on the server.\n\n' +
              'Please contact your administrator to set up the enhanced AI system, or use the standard AI analysis instead.')
      } else if (isSizeError) {
        // Show helpful message about size limits
        alert('⚠️ Plan Too Large for Enhanced Analysis\n\n' + 
              'The enhanced multi-model system is limited to 5 pages maximum.\n\n' +
              'Please select the most important pages or use the standard AI analysis for larger plans.')
      } else {
        alert('❌ Enhanced Analysis Failed\n\n' + errorMessage)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function runQualityAnalysis() {
    setIsAnalyzing(true)
    setAnalysisMode('quality')

    try {
      const supabase = createClient()
      
      // Mark the plan as pending quality analysis
      await supabase
        .from('plans')
        .update({ 
          quality_analysis_status: 'pending',
          quality_requested_at: new Date().toISOString()
        })
        .eq('id', planId)

      // Show pending status immediately
      setQualityResults({
        status: 'pending',
        message: 'Converting PDF to images for analysis...',
        requested_at: new Date().toISOString()
      })

      // Convert PDF pages to images
      const images = await convertPdfPagesToImages()
      
      if (images.length === 0) {
        throw new Error('Failed to convert PDF to images')
      }

      // Update status
      setQualityResults({
        status: 'pending',
        message: `Analyzing ${images.length} page${images.length > 1 ? 's' : ''} with AI...`,
        requested_at: new Date().toISOString()
      })

      // Call the multi-provider API to perform the analysis
      const response = await fetch('/api/plan/analyze-multi-quality', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planId: planId,
          images: images
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()

      // Update plan status to completed
      await supabase
        .from('plans')
        .update({ 
          quality_analysis_status: 'completed',
          has_quality_analysis: true
        })
        .eq('id', planId)

      // Show results
      setQualityResults({
        status: 'completed',
        message: 'Analysis complete!',
        overall_score: data.overall_score,
        issues: data.issues || [],
        missing_details: data.missing_details || [],
        recommendations: data.recommendations || [],
        findings_by_category: data.findings_by_category || {},
        findings_by_severity: data.findings_by_severity || {},
        analysisId: data.analysisId,
        completed_at: new Date().toISOString()
      })

      alert('✅ Quality Analysis Complete!\n\nYour plan has been successfully analyzed. View the results in the sidebar.')

    } catch (error) {
      console.error('Error requesting quality analysis:', error)
      
      // Mark as failed in database
      const supabase = createClient()
      await supabase
        .from('plans')
        .update({ 
          quality_analysis_status: 'failed'
        })
        .eq('id', planId)

      setQualityResults({
        status: 'failed',
        message: error instanceof Error ? error.message : 'Analysis failed',
        requested_at: new Date().toISOString()
      })

      alert('❌ Analysis Failed\n\n' + (error instanceof Error ? error.message : 'Failed to analyze plan. Please try again.'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (loading || !pdfJsReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FallingBlocksLoader />
          <p className="text-sm text-gray-600 mt-4">
            {!pdfJsReady ? 'Initializing PDF viewer...' : 'Loading plan...'}
          </p>
        </div>
      </div>
    )
  }

  if (!plan || !user) {
    return null
  }

  return (
    <div 
      className="fixed inset-0 flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors duration-300"
      style={{ touchAction: 'pan-y pan-x' }} // Prevent browser pinch-zoom globally on this page
    >
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-black border-b dark:border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm z-10 transition-colors duration-300">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/plans')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="font-semibold text-lg dark:text-white">{plan.title || plan.file_name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {numPages ? `${numPages} page${numPages !== 1 ? 's' : ''}` : 'Loading...'}
            </p>
          </div>
          
          {/* Active Tool Indicator */}
          {activeTool !== 'select' && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-700 rounded-md">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400 capitalize">
                {activeTool} mode active - Click on the PDF to draw
              </span>
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(Math.max(0.25, zoom - 0.25))
              setShowZoomIndicator(true)
              if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
              zoomTimeoutRef.current = setTimeout(() => setShowZoomIndicator(false), 1000)
            }}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center dark:text-white">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(Math.min(3, zoom + 0.25))
              setShowZoomIndicator(true)
              if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current)
              zoomTimeoutRef.current = setTimeout(() => setShowZoomIndicator(false), 1000)
            }}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar */}
        <div className="bg-white dark:bg-black border-r dark:border-gray-800 p-2 flex flex-col space-y-2 w-16 transition-colors duration-300">
          <Button
            variant={activeTool === 'select' ? 'default' : 'ghost'}
            size="sm"
            className="w-full"
            onClick={() => setActiveTool('select')}
            title="Select / Pan (V or Esc)"
          >
            <Move className="h-5 w-5" />
          </Button>
          <Button
            variant={activeTool === 'line' ? 'default' : 'ghost'}
            size="sm"
            className="w-full"
            onClick={() => setActiveTool('line')}
            title="Draw Line (L)"
          >
            <Minus className="h-5 w-5" />
          </Button>
          <Button
            variant={activeTool === 'rectangle' ? 'default' : 'ghost'}
            size="sm"
            className="w-full"
            onClick={() => setActiveTool('rectangle')}
            title="Draw Rectangle (R)"
          >
            <Square className="h-5 w-5" />
          </Button>
          <Button
            variant={activeTool === 'measurement' ? 'default' : 'ghost'}
            size="sm"
            className="w-full"
            onClick={() => setActiveTool('measurement')}
            title="Measurement (M)"
          >
            <Ruler className="h-5 w-5" />
          </Button>
          <Button
            variant={activeTool === 'note' ? 'default' : 'ghost'}
            size="sm"
            className="w-full"
            onClick={() => setActiveTool('note')}
            title="Add Note (N)"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>

          <div className="border-t pt-2 mt-auto">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setIsSettingScale(true)}
              title="Set Scale"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div 
          className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900 relative" 
          ref={containerRef}
          style={{ 
            cursor: activeTool === 'select' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
            scrollBehavior: 'smooth',
            touchAction: 'pan-y pan-x' // Prevent browser zoom, allow pan
          }}
        >
          {/* Active Tool Indicator */}
          <div className="absolute top-6 left-6 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-2 flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${activeTool === 'select' ? 'bg-gray-500' : 'bg-blue-500 animate-pulse'}`} />
              <span className="text-sm font-medium dark:text-white">
                {activeTool === 'select' && 'Select / Pan'}
                {activeTool === 'line' && 'Drawing Line'}
                {activeTool === 'rectangle' && 'Drawing Rectangle'}
                {activeTool === 'measurement' && 'Measurement Tool'}
                {activeTool === 'note' && 'Add Note'}
              </span>
            </div>
            {activeTool === 'note' && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Click to place note</span>
            )}
            {activeTool !== 'select' && activeTool !== 'note' && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Click and drag to draw</span>
            )}
            {activeTool === 'select' && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Drag to pan</span>
            )}
          </div>

          {/* Zoom Indicator - appears when zooming */}
          {showZoomIndicator && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-blue-600 text-white rounded-lg shadow-lg px-6 py-3 flex items-center space-x-2 transition-opacity">
              <ZoomIn className="h-5 w-5" />
              <span className="text-lg font-bold">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          )}

          {/* Drawings Counter & Clear */}
          {drawings.length > 0 && (
            <div className="absolute top-6 right-6 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-2 flex items-center space-x-3">
              <span className="text-sm dark:text-white">
                {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (confirm('Clear all drawings from all pages?')) {
                    setDrawings([])
                    const supabase = createClient()
                    await supabase
                      .from('plan_drawings')
                      .delete()
                      .eq('plan_id', planId)
                  }
                }}
                className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="relative inline-block">
            {!pdfJsReady ? (
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <FallingBlocksLoader />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">Initializing PDF viewer...</p>
                </div>
              </div>
            ) : planUrl ? (
              <Document
                file={planUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error: Error) => {
                  console.error('PDF load error:', error)
                  setPdfError(true)
                  
                  // If it's a worker error, try to reinitialize
                  if (error.message && error.message.includes('messageHandler')) {
                    console.log('Worker error detected, attempting recovery...')
                    setTimeout(() => {
                      setPdfError(false)
                      setDocumentReady(false)
                      setPdfJsReady(false)
                      
                      // Reinitialize after a delay
                      setTimeout(() => {
                        window.location.reload()
                      }, 1000)
                    }, 500)
                  }
                }}
                loading={
                  <div className="flex items-center justify-center p-12">
                    <FallingBlocksLoader />
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-12">
                    <div className="text-center text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                      <p className="font-medium">Failed to load PDF</p>
                      <p className="text-sm mt-2">
                        {pdfError && 'Attempting to recover...'}
                        {!pdfError && 'Please try refreshing the page'}
                      </p>
                    </div>
                  </div>
                }
              >
                {/* Render all pages - only after document is fully loaded */}
                <div className="space-y-6">
                  {documentReady && numPages && pdfJsReady && pdfDocumentRef.current ? (
                    Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                    <div key={`page-${pageNum}`} className="relative bg-white dark:bg-gray-800 shadow-lg">
                      {/* Page number indicator */}
                      <div className="absolute -top-8 left-0 text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Page {pageNum} of {numPages}
                      </div>
                      
                      <div ref={pageNum === 1 ? pdfPageRef : null} className="relative">
                        <Page
                          key={`pdf-page-${pageNum}`}
                          pageNumber={pageNum}
                          scale={zoom}
                          width={800}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          onLoadSuccess={() => {
                            // Ensure canvas gets sized after page loads
                            setTimeout(() => {
                              const canvas = canvasRefs.current.get(pageNum)
                              if (canvas && canvas.parentElement) {
                                const rect = canvas.parentElement.getBoundingClientRect()
                                if (rect.width > 0 && rect.height > 0) {
                                  canvas.width = rect.width
                                  canvas.height = rect.height
                                  redrawAllCanvases()
                                }
                              }
                            }, 100)
                          }}
                          loading={
                            <div className="flex items-center justify-center" style={{ width: 800 * zoom, height: 1000 * zoom }}>
                              <p className="text-gray-400 dark:text-gray-500 text-sm">Loading page {pageNum}...</p>
                            </div>
                          }
                          error={(error: Error) => {
                            console.error(`Error loading page ${pageNum}:`, error)
                            return (
                              <div className="flex items-center justify-center" style={{ width: 800 * zoom, height: 1000 * zoom }}>
                                <div className="text-center text-orange-600 dark:text-orange-400">
                                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                                  <p className="text-sm">Page {pageNum} temporarily unavailable</p>
                                  <p className="text-xs mt-1">Scroll past and come back</p>
                                </div>
                              </div>
                            )
                          }}
                        />

                        {/* Drawing Canvas Overlay for this page */}
                        <canvas
                          ref={(el) => {
                            if (el) {
                              canvasRefs.current.set(pageNum, el)
                              // Size canvas immediately when ref is attached
                              const pdfPageElement = el.parentElement
                              if (pdfPageElement) {
                                const rect = pdfPageElement.getBoundingClientRect()
                                if (rect.width > 0 && rect.height > 0) {
                                  el.width = rect.width
                                  el.height = rect.height
                                }
                              }
                            } else {
                              canvasRefs.current.delete(pageNum)
                            }
                          }}
                          data-page={pageNum}
                          className="absolute top-0 left-0"
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseLeave}
                          style={{
                            pointerEvents: 'auto',
                            cursor: activeTool === 'select' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
                            zIndex: 10
                          }}
                        />

                        {/* Note Pins Overlay for this page */}
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 20 }}>
                          {drawings
                            .filter(d => d.type === 'note' && d.page_number === pageNum && d.note_data)
                            .map((note) => {
                              const config = NOTE_TYPE_CONFIG[note.note_data!.note_type]
                              const canvas = canvasRefs.current.get(pageNum)
                              if (!canvas) return null

                              // Handle both old relative and new absolute coordinates
                              let x, y
                              if (note.geometry.isRelative || (note.geometry.x1 <= 1 && note.geometry.y1 <= 1)) {
                                // Old relative coordinates (0-1 range)
                                x = note.geometry.x1 * canvas.width
                                y = note.geometry.y1 * canvas.height
                              } else {
                                // New absolute coordinates - apply viewport transform
                                x = (note.geometry.x1 * zoom) + viewport.x
                                y = (note.geometry.y1 * zoom) + viewport.y
                              }

                              return (
                                <div
                                  key={note.id}
                                  className="absolute group pointer-events-auto"
                                  style={{
                                    left: `${x}px`,
                                    top: `${y}px`,
                                    transform: 'translate(-50%, -50%)'
                                  }}
                                >
                                  {/* Note Pin */}
                                  <div 
                                    className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shadow-lg border-2 border-white transition-transform hover:scale-110 ${selectedNoteId === note.id ? 'scale-125 ring-2 ring-orange-500' : ''}`}
                                    style={{ backgroundColor: config.color }}
                                    onClick={() => setSelectedNoteId(selectedNoteId === note.id ? null : note.id)}
                                    title={note.note_data!.content}
                                  >
                                    <span className="text-sm">{config.icon}</span>
                                  </div>

                                  {/* Hover/Selected Tooltip */}
                                  {(selectedNoteId === note.id) && (
                                    <div 
                                      className={`absolute left-10 top-0 min-w-[250px] max-w-[350px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border-l-4 ${config.borderColor} p-3 z-30`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {/* Note Header */}
                                      <div className={`flex items-center justify-between mb-2 pb-2 border-b ${config.borderColor}`}>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-sm">{config.icon}</span>
                                          <span className={`text-xs font-semibold uppercase ${config.textColor}`}>
                                            {note.note_data!.note_type}
                                          </span>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteNote(note.id)
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>

                                      {/* Note Content */}
                                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-2">
                                        {note.note_data!.content}
                                      </p>

                                      {/* Category and Location */}
                                      {(note.note_data!.category || note.note_data!.location) && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {note.note_data!.category && (
                                            <Badge variant="outline" className="text-xs">
                                              {note.note_data!.category}
                                            </Badge>
                                          )}
                                          {note.note_data!.location && (
                                            <Badge variant="outline" className="text-xs flex items-center">
                                              <MapPin className="h-3 w-3 mr-1" />
                                              {note.note_data!.location}
                                            </Badge>
                                          )}
                                        </div>
                                      )}

                                      {/* Footer */}
                                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                          <User className="h-3 w-3 mr-1" />
                                          <span>You</span>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {Math.round(note.note_data!.confidence_score * 100)}%
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center p-12">
                    <div className="text-center">
                      <FallingBlocksLoader />
                      <p className="text-sm text-gray-600 mt-4">Loading PDF pages...</p>
                    </div>
                  </div>
                )}
                </div>
              </Document>
            ) : null}
          </div>
        </div>

        {/* Right Analysis Sidebar */}
        {sidebarVisible ? (
          <div 
            className={`bg-white dark:bg-black border-l dark:border-gray-800 flex flex-col overflow-hidden relative transition-all duration-300 ${
              sidebarWidth === 'full' ? 'w-4/5' :
              sidebarWidth === 'wide' ? 'w-[700px]' :
              'w-96'
            }`}
          >
            {/* Close Sidebar Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarVisible(false)}
              className="absolute top-2 right-2 z-10 h-8 w-8 p-0"
              title="Hide sidebar (A)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Sidebar Width Toggle Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSidebarWidth(prev => 
                  prev === 'normal' ? 'wide' : 
                  prev === 'wide' ? 'full' : 
                  'normal'
                )
              }}
              className="absolute top-2 right-12 z-10 h-8 w-8 p-0"
              title={`Sidebar: ${sidebarWidth} (click to ${sidebarWidth === 'normal' ? 'expand' : sidebarWidth === 'wide' ? 'maximize' : 'reset'})`}
            >
              {sidebarWidth === 'normal' ? (
                <ArrowLeftRight className="h-4 w-4" />
              ) : sidebarWidth === 'wide' ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Analysis Mode Tabs */}
            <div className="border-b dark:border-gray-800 p-4 pr-24">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={analysisMode === 'takeoff' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAnalysisMode('takeoff')}
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  <span className="text-xs">Takeoff</span>
                </Button>
                <Button
                  variant={analysisMode === 'quality' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAnalysisMode('quality')}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span className="text-xs">Quality</span>
                </Button>
                <Button
                  variant={analysisMode === 'notes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAnalysisMode('notes')}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  <span className="text-xs">Notes</span>
                </Button>
              </div>
            </div>

          {/* Analysis Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {analysisMode === 'takeoff' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Takeoff Analysis</h3>
                  <Button
                    size="sm"
                    onClick={runTakeoffAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyze
                      </>
                    )}
                  </Button>
                </div>

                {takeoffResults ? (
                  <div className="space-y-3">
                    {/* Pending Status Message */}
                    {takeoffResults.status === 'pending' && (
                      <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                                <Clock className="h-6 w-6 text-white animate-pulse" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-blue-900 mb-2 text-lg">AI Analysis In Progress</h4>
                              <p className="text-blue-800 mb-4">
                                Our enhanced AI system is analyzing your plans with multiple specialized models for maximum accuracy.
                              </p>
                              
                              {/* Progress Bar */}
                              <div className="bg-white rounded-lg p-4 border border-blue-200 mb-4">
                                <h5 className="font-medium text-blue-900 mb-3">Analysis Progress:</h5>
                                
                                {/* Main Progress Bar */}
                                <div className="mb-4">
                                  <div className="flex justify-between text-sm text-blue-800 mb-2">
                                    <span>Enhanced AI Analysis</span>
                                    <span>3-5 minutes</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div 
                                      className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-out"
                                      style={{ 
                                        width: `${Math.min(100, Math.max(20, (Object.values(modelProgress).filter(status => status === 'completed').length / 5) * 100))}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>

                                {/* Current Step */}
                                <div className="mb-3">
                                  <div className="flex items-center gap-2 text-sm text-blue-700">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span>
                                      {currentModel ? `Analyzing with ${currentModel}...` : 'Preparing AI models...'}
                                    </span>
                                  </div>
                                </div>

                                {/* Model Status Grid */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {['GPT-4o', 'GPT-4-turbo', 'Grok-4', 'Claude-3-haiku', 'Gemini-1.5-Flash'].map((model) => {
                                    const status = modelProgress[model] || 'pending'
                                    return (
                                      <div key={model} className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                          status === 'completed' ? 'bg-green-500' :
                                          status === 'running' ? 'bg-blue-500 animate-pulse' :
                                          status === 'failed' ? 'bg-red-500' :
                                          'bg-gray-300'
                                        }`}></div>
                                        <span className={`${
                                          status === 'completed' ? 'text-green-700' :
                                          status === 'running' ? 'text-blue-700' :
                                          status === 'failed' ? 'text-red-700' :
                                          'text-gray-500'
                                        }`}>
                                          {model}
                                        </span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                              
                              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <div className="flex items-center gap-2 text-sm text-blue-900 mb-2">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-medium">Requested:</span>
                                  <span>{new Date(takeoffResults.requested_at).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-blue-900">
                                  <span className="font-medium">⏱️ Expected completion:</span>
                                  <span>3-5 minutes</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Error Message (if AI couldn't analyze) */}
                    {takeoffResults._showError && (
                      <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-medium text-orange-900 mb-1">Analysis Could Not Be Completed</h4>
                              <p className="text-sm text-orange-800 mb-2">
                                {takeoffResults.message || 'Unable to extract measurable details from this plan.'}
                              </p>
                              {takeoffResults.ai_response && (
                                <details className="text-xs text-orange-700 mt-2">
                                  <summary className="cursor-pointer hover:underline">View AI Response</summary>
                                  <p className="mt-2 p-2 bg-white rounded border border-orange-200 whitespace-pre-wrap">
                                    {takeoffResults.ai_response}
                                  </p>
                                </details>
                              )}
                              <div className="mt-3 text-xs text-orange-700">
                                <p className="font-medium mb-1">Suggestions:</p>
                                <ul className="list-disc list-inside space-y-0.5 ml-2">
                                  <li>Upload a higher resolution image</li>
                                  <li>Ensure dimensions and labels are clearly visible</li>
                                  <li>Try a different page with more construction details</li>
                                  <li>Manually add measurements using the drawing tools</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Summary Card */}
                    {takeoffResults.status !== 'pending' && takeoffResults.summary && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-3">Summary</h4>
                          
                          {typeof takeoffResults.summary === 'object' ? (
                            <div className="space-y-3">
                              {takeoffResults.summary.total_items !== undefined && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Total Items:</span>
                                  <span className="font-medium">{takeoffResults.summary.total_items}</span>
                                </div>
                              )}
                              
                              {takeoffResults.summary.total_area_sf && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Total Area:</span>
                                  <span className="font-medium">{takeoffResults.summary.total_area_sf.toLocaleString()} SF</span>
                                </div>
                              )}
                              
                              {takeoffResults.summary.plan_scale && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Plan Scale:</span>
                                  <span className="font-medium">{takeoffResults.summary.plan_scale}</span>
                                </div>
                              )}
                              
                              {takeoffResults.summary.confidence && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Confidence:</span>
                                  <Badge 
                                    variant="outline"
                                    className={
                                      takeoffResults.summary.confidence === 'high' ? 'bg-green-50 text-green-700' :
                                      takeoffResults.summary.confidence === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                                      'bg-red-50 text-red-700'
                                    }
                                  >
                                    {takeoffResults.summary.confidence}
                                  </Badge>
                                </div>
                              )}
                              
                              {takeoffResults.summary.categories && Object.keys(takeoffResults.summary.categories).length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-xs font-medium text-gray-700 mb-2">By Category:</p>
                                  <div className="space-y-1">
                                    {Object.entries(takeoffResults.summary.categories).map(([cat, count]: [string, any]) => (
                                      <div key={cat} className="flex justify-between text-xs">
                                        <span className="text-gray-600 capitalize">{cat}:</span>
                                        <span className="font-medium">{count}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {takeoffResults.summary.notes && (
                                <p className="text-xs text-gray-600 mt-3 pt-3 border-t">
                                  {takeoffResults.summary.notes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600">
                              {takeoffResults.summary}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Items Breakdown - 3-Level Accordion */}
                    {takeoffResults.status !== 'pending' && takeoffResults.items && takeoffResults.items.length > 0 ? (
                      <TakeoffAccordion 
                        items={takeoffResults.items}
                        summary={takeoffResults.summary}
                        onItemHighlight={handleItemHighlight}
                      />
                    ) : takeoffResults.status !== 'pending' ? (
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-gray-600 text-center">
                            {takeoffResults.raw_response 
                              ? 'Analysis complete. No structured items found. Check summary above.'
                              : 'Analysis complete but no items were detected.'}
                          </p>
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Raw Response (if available and items parsing failed) */}
                    {takeoffResults.status !== 'pending' && takeoffResults.raw_response && (!takeoffResults.items || takeoffResults.items.length === 0) && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-2">AI Response</h4>
                          <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {takeoffResults.raw_response}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm">No takeoff analysis yet</p>
                    <p className="text-xs mt-2">
                      Click "Analyze" to generate takeoff data
                    </p>
                  </div>
                )}
              </div>
            ) : analysisMode === 'quality' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Quality Analysis</h3>
                  <Button
                    size="sm"
                    onClick={runQualityAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyze
                      </>
                    )}
                  </Button>
                </div>

                {qualityResults ? (
                  <div className="space-y-3">
                    {/* Pending Status Message */}
                    {qualityResults.status === 'pending' && (
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                                <Clock className="h-6 w-6 text-white animate-pulse" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-green-900 mb-2 text-lg">AI Quality Check In Progress</h4>
                              <p className="text-green-800 mb-3">
                                Your quality analysis has been queued for review. Our AI system is inspecting your plans for completeness, compliance, and potential quality issues.
                              </p>
                              <div className="bg-white rounded-lg p-4 border border-green-200 mb-3">
                                <div className="flex items-center gap-2 text-sm text-green-900 mb-2">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-medium">Requested:</span>
                                  <span>{new Date(qualityResults.requested_at).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-green-900">
                                  <span className="font-medium">⏱️ Expected completion:</span>
                                  <span>1-2 hours</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-2 text-sm text-green-700">
                                <span>📧</span>
                                <p>You will receive an email notification at <strong>{user?.email}</strong> when the review is complete.</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Overall Score Card */}
                    {qualityResults.status !== 'pending' && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Overall Score</h4>
                          <Badge 
                            variant="default" 
                            className={
                              qualityResults.overall_score >= 0.8 ? 'bg-green-500' :
                              qualityResults.overall_score >= 0.6 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }
                          >
                            {Math.round(qualityResults.overall_score * 100)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">
                          {qualityResults.overall_score >= 0.8 ? 'Plan quality is good' :
                           qualityResults.overall_score >= 0.6 ? 'Plan has some issues' :
                           'Plan needs improvement'}
                        </p>
                      </CardContent>
                    </Card>

                    )}

                    {/* Issues Breakdown */}
                    {qualityResults.status !== 'pending' && qualityResults.issues && qualityResults.issues.length > 0 ? (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-3">Issues ({qualityResults.issues.length})</h4>
                          <div className="space-y-3 max-h-[500px] overflow-y-auto">
                            {qualityResults.issues.map((issue: any, index: number) => (
                              <div 
                                key={index} 
                                className="border-l-4 pl-3 py-2"
                                style={{
                                  borderColor: 
                                    issue.severity === 'critical' ? '#ef4444' :
                                    issue.severity === 'warning' ? '#f59e0b' :
                                    '#6b7280'
                                }}
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs"
                                        style={{
                                          borderColor: 
                                            issue.severity === 'critical' ? '#ef4444' :
                                            issue.severity === 'warning' ? '#f59e0b' :
                                            '#6b7280',
                                          color:
                                            issue.severity === 'critical' ? '#ef4444' :
                                            issue.severity === 'warning' ? '#f59e0b' :
                                            '#6b7280'
                                        }}
                                      >
                                        {issue.severity || 'warning'}
                                      </Badge>
                                      {issue.category && (
                                        <span className="text-xs text-gray-500 capitalize">
                                          {issue.category}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {issue.description || issue.title || `Issue ${index + 1}`}
                                    </p>
                                    {issue.location && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        📍 {issue.location}
                                      </p>
                                    )}
                                    {issue.impact && (
                                      <p className="text-xs text-gray-600 mt-1">
                                        <span className="font-medium">Impact:</span> {issue.impact}
                                      </p>
                                    )}
                                    {issue.recommendation && (
                                      <p className="text-xs text-blue-600 mt-1">
                                        💡 {issue.recommendation}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Recommendations */}
                    {qualityResults.status !== 'pending' && qualityResults.recommendations && qualityResults.recommendations.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-2">Recommendations</h4>
                          <ul className="space-y-2 text-sm">
                            {qualityResults.recommendations.map((rec: any, index: number) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span className="text-gray-600 flex-1">
                                  {typeof rec === 'string' ? rec : rec.description || rec.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* Missing Details */}
                    {qualityResults.status !== 'pending' && qualityResults.missing_details && qualityResults.missing_details.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-medium mb-2 text-orange-600">Missing Details</h4>
                          <ul className="space-y-2 text-sm">
                            {qualityResults.missing_details.map((detail: any, index: number) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-orange-500 mt-0.5">⚠</span>
                                <span className="text-gray-600 flex-1">
                                  {typeof detail === 'string' ? detail : detail.description || detail.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm">No quality analysis yet</p>
                    <p className="text-xs mt-2">
                      Click "Analyze" to check plan quality
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Notes Tab
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Notes</h3>
                  <Badge variant="outline">
                    {drawings.filter(d => d.type === 'note').length} total
                  </Badge>
                </div>

                {drawings.filter(d => d.type === 'note').length > 0 ? (
                  <div className="space-y-3">
                    {drawings
                      .filter(d => d.type === 'note' && d.note_data)
                      .sort((a, b) => (b.page_number || 0) - (a.page_number || 0))
                      .map((note) => {
                        const config = NOTE_TYPE_CONFIG[note.note_data!.note_type]
                        
                        return (
                          <Card 
                            key={note.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              selectedNoteId === note.id ? 'ring-2 ring-orange-500' : ''
                            }`}
                            onClick={() => {
                              setSelectedNoteId(note.id)
                              // Optionally scroll to the note's page
                              const canvas = canvasRefs.current.get(note.page_number || 1)
                              if (canvas) {
                                canvas.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }
                            }}
                          >
                            <CardContent className="p-3">
                              <div className={`flex items-start justify-between mb-2 pb-2 border-b ${config.borderColor}`}>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm">{config.icon}</span>
                                  <span className={`text-xs font-semibold uppercase ${config.textColor}`}>
                                    {note.note_data!.note_type}
                                  </span>
                                  {note.page_number && (
                                    <Badge variant="outline" className="text-xs">
                                      Page {note.page_number}
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteNote(note.id)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              <p className="text-sm text-gray-800 leading-relaxed mb-2">
                                {note.note_data!.content}
                              </p>

                              {(note.note_data!.category || note.note_data!.location) && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {note.note_data!.category && (
                                    <Badge variant="outline" className="text-xs">
                                      {note.note_data!.category}
                                    </Badge>
                                  )}
                                  {note.note_data!.location && (
                                    <Badge variant="outline" className="text-xs flex items-center">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {note.note_data!.location}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm">No notes yet</p>
                    <p className="text-xs mt-2">
                      Use the Note tool (N) to add notes to your plan
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setActiveTool('note')
                        setSidebarVisible(false)
                      }}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add First Note
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        ) : (
          /* Floating button to reopen sidebar when hidden */
          <Button
            onClick={() => setSidebarVisible(true)}
            className="fixed top-1/2 right-4 -translate-y-1/2 z-20 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all"
            title="Show analysis sidebar (A)"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Note Creation Modal */}
      {isCreatingNote && pendingNotePosition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-orange-500" />
                  Create Note
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingNote(false)
                    setPendingNotePosition(null)
                    setActiveTool('select')
                  }}
                  className="h-8 w-8 p-0"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="note-type" className="text-sm font-medium">Note Type</Label>
                  <Select
                    value={noteForm.note_type}
                    onValueChange={(value) => setNoteForm({ ...noteForm, note_type: value as any })}
                  >
                    <SelectTrigger id="note-type" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="requirement">
                        <span className="flex items-center">
                          📄 Requirement
                        </span>
                      </SelectItem>
                      <SelectItem value="concern">
                        <span className="flex items-center">
                          ⚠️ Concern
                        </span>
                      </SelectItem>
                      <SelectItem value="suggestion">
                        <span className="flex items-center">
                          💡 Suggestion
                        </span>
                      </SelectItem>
                      <SelectItem value="timeline">
                        <span className="flex items-center">
                          ⏰ Timeline
                        </span>
                      </SelectItem>
                      <SelectItem value="material">
                        <span className="flex items-center">
                          📦 Material
                        </span>
                      </SelectItem>
                      <SelectItem value="other">
                        <span className="flex items-center">
                          📝 Other
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="category" className="text-sm font-medium">Category (optional)</Label>
                    <Input
                      id="category"
                      placeholder="e.g., Electrical"
                      value={noteForm.category}
                      onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location" className="text-sm font-medium">Location (optional)</Label>
                    <Input
                      id="location"
                      placeholder="e.g., Floor 2"
                      value={noteForm.location}
                      onChange={(e) => setNoteForm({ ...noteForm, location: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="content" className="text-sm font-medium">Note Content *</Label>
                  <Textarea
                    id="content"
                    placeholder="Enter your note..."
                    value={noteForm.content}
                    onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                    className="mt-1 min-h-[100px]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreatingNote(false)
                      setPendingNotePosition(null)
                      setActiveTool('select')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateNote}
                    disabled={!noteForm.content.trim()}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Create Note
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scale Settings Modal */}
      {isSettingScale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <Settings className="h-5 w-5 mr-2 text-blue-500" />
                  Set Drawing Scale
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsSettingScale(false)}
                  className="h-8 w-8 p-0"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Scale Ratio</Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Set the scale of your construction plan (e.g., 1/4&quot; = 1&apos;)
                  </p>
                  <Select
                    value={scale.ratio}
                    onValueChange={(value) => {
                      const scaleMap: { [key: string]: number } = {
                        [`1/8" = 1'`]: 96,
                        [`1/4" = 1'`]: 48,
                        [`1/2" = 1'`]: 24,
                        [`1" = 1'`]: 12,
                        '1:100': 100,
                        '1:50': 50,
                        '1:20': 20
                      }
                      setScale({ 
                        ratio: value, 
                        pixelsPerUnit: scaleMap[value] || 48 
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={`1/8" = 1'`}>1/8&quot; = 1&apos; (Architectural)</SelectItem>
                      <SelectItem value={`1/4" = 1'`}>1/4&quot; = 1&apos; (Architectural - Default)</SelectItem>
                      <SelectItem value={`1/2" = 1'`}>1/2&quot; = 1&apos; (Architectural)</SelectItem>
                      <SelectItem value={`1" = 1'`}>1&quot; = 1&apos; (Architectural)</SelectItem>
                      <SelectItem value="1:100">1:100 (Metric)</SelectItem>
                      <SelectItem value="1:50">1:50 (Metric)</SelectItem>
                      <SelectItem value="1:20">1:20 (Metric)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Current Scale:</strong> {scale.ratio}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Use the Measurement tool to draw scaled lines on your plan.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsSettingScale(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setIsSettingScale(false)
                      alert(`Scale set to ${scale.ratio}. Use the Measurement tool (M) to measure distances.`)
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Apply Scale
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

