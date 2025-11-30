'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  MessageSquare,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  X,
  Info,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Star,
  Settings,
  Ruler,
  Square,
  Hand,
  Move,
  Trash2,
  PanelRightOpen,
  PanelRightClose,
  MousePointerClick
} from 'lucide-react'

import { Drawing } from '@/lib/canvas-utils'
import CommentPopup from '@/components/comment-popup'
import CommentBubble from '@/components/comment-bubble'

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { 
    ssr: false,
    loading: () => null
  }
) as any

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
) as any

// Worker configuration will be handled in useEffect

// Import CSS for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Inject styles to ensure react-pdf canvas is visible and properly constrained
// CRITICAL: These styles ensure the PDF canvas matches the drawing canvas during quality transitions
if (typeof window !== 'undefined') {
  // Check if styles already injected
  if (!document.getElementById('react-pdf-canvas-fix')) {
    const style = document.createElement('style')
    style.id = 'react-pdf-canvas-fix'
    style.textContent = `
      .react-pdf__Page__canvas {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        visibility: visible !important;
        opacity: 1 !important;
        image-rendering: auto !important;
        background-color: white !important;
      }
      .react-pdf__Page {
        display: block !important;
        position: relative !important;
        background-color: white !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      .react-pdf__Page__textContent {
        display: none !important;
      }
      .react-pdf__Page__annotations {
        display: none !important;
      }
    `
    document.head.appendChild(style)
  }
}

// Standard PDF dimensions (72 DPI)
// Coordinates are stored in this normalized space to ensure persistence across zoom/scale changes
const PDF_BASE_WIDTH = 612  // 8.5 inches * 72 DPI
const PDF_BASE_HEIGHT = 792 // 11 inches * 72 DPI

// Helper functions for measurements (pure functions, can be outside component)
const calculatePixelDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

// Snap threshold for closing polygon shapes (in PDF base coordinates)
// Keep small since users often work at 200-400% zoom
const SNAP_TO_CLOSE_THRESHOLD = 8

const calculatePolygonArea = (points: number[]): number => {
  if (points.length < 6) return 0 // Need at least 3 points (6 numbers)
  let area = 0
  for (let i = 0; i < points.length - 2; i += 2) {
    const j = (i + 2) % points.length
    area += points[i] * points[j + 1]
    area -= points[j] * points[i + 1]
  }
  return Math.abs(area) / 2
}

export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

interface FastPlanCanvasProps {
  pdfUrl: string
  drawings: Drawing[]
  onDrawingsChange: (drawings: Drawing[]) => void | Promise<void>
  rightSidebarOpen: boolean
  onRightSidebarToggle: () => void
  onCommentPinClick: (x: number, y: number, pageNumber: number) => void
  onCommentClick?: (comment: Drawing) => void
  goToPage?: number
  scale?: number
  onClearCache?: () => void
  measurementScaleSettings?: Record<number, { ratio: string; pixelsPerUnit: number; unit: 'ft' | 'in' | 'm' | 'cm' | 'mm' }>
  onPageChange?: (page: number) => void
  onNumPagesChange?: (numPages: number) => void
  onOpenScaleSettings?: () => void
  onCalibrationPointsChange?: (points: { x: number; y: number }[]) => void
  calibrationPoints?: { x: number; y: number }[]
  isCalibrating?: boolean
  onSetCalibrating?: (calibrating: boolean) => void
  searchQuery?: string
  currentMatchIndex?: number
  onSearchResults?: (count: number) => void
  selectedMeasurementIds?: Set<string>
  onSelectedMeasurementsChange?: (ids: Set<string>) => void
}

type DrawingTool = 'comment' | 'none' | 'measurement_line' | 'measurement_area' | 'measurement_edit' | 'measurement_select'

// Error Boundary to catch render-phase errors from react-pdf
// This is necessary because PDF.js can throw errors during the render phase
// when the document is destroyed while pages are still rendering
import React from 'react'

interface PageErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface PageErrorBoundaryProps {
  children: React.ReactNode
  pageNumber: number
  onError?: (error: Error) => void
  fallback?: React.ReactNode
}

class PageErrorBoundary extends React.Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Check if this is a PDF.js cleanup error (harmless during navigation)
    if (error.message?.includes('messageHandler') || 
        error.message?.includes('sendWithPromise') ||
        error.message?.includes('destroyed')) {
      console.debug(`PDF page ${this.props.pageNumber} render skipped - document was destroyed (normal during navigation)`)
    } else {
      console.error(`Page ${this.props.pageNumber} render error:`, error)
    }
    this.props.onError?.(error)
  }

  componentDidUpdate(prevProps: PageErrorBoundaryProps) {
    // Reset error state when page number changes
    if (prevProps.pageNumber !== this.props.pageNumber && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      // Check if it's a harmless PDF.js error
      const isHarmlessError = this.state.error?.message?.includes('messageHandler') ||
                              this.state.error?.message?.includes('sendWithPromise') ||
                              this.state.error?.message?.includes('destroyed')
      
      if (isHarmlessError) {
        // Return null for harmless errors - the page will re-render when document is ready
        return null
      }
      
      return this.props.fallback || (
        <div className="flex items-center justify-center p-4 bg-red-50 text-red-600 text-sm">
          Failed to render page {this.props.pageNumber}
        </div>
      )
    }

    return this.props.children
  }
}

interface EditingMeasurementState {
  id: string
  type: Drawing['type']
  pageNumber: number
  points: number[]
  handleIndex: number
}

interface MeasurementHandleHit {
  drawing: Drawing
  handleIndex: number
}

interface SegmentHit {
  drawing: Drawing
  segmentIndex: number // Index of the first point of the segment (0-based)
  clickX: number
  clickY: number
}

export default function FastPlanCanvas({
  pdfUrl,
  drawings,
  onDrawingsChange,
  rightSidebarOpen,
  onRightSidebarToggle,
  onCommentPinClick,
  onCommentClick,
  goToPage,
  scale = 1.5,
  onClearCache,
  measurementScaleSettings,
  onPageChange,
  onNumPagesChange,
  onOpenScaleSettings,
  onCalibrationPointsChange,
  calibrationPoints: externalCalibrationPoints,
  isCalibrating: externalIsCalibrating,
  onSetCalibrating,
  searchQuery,
  currentMatchIndex,
  onSearchResults,
  selectedMeasurementIds,
  onSelectedMeasurementsChange
}: FastPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 })
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('none')
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [selectedComment, setSelectedComment] = useState<Drawing | null>(null)
  const [showCommentPopup, setShowCommentPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const [hoveredComment, setHoveredComment] = useState<Drawing | null>(null)
  // Measurement drawing state
  const [currentMeasurement, setCurrentMeasurement] = useState<Drawing | null>(null)
  const [isDrawingMeasurement, setIsDrawingMeasurement] = useState(false)
  const [editingMeasurement, setEditingMeasurement] = useState<EditingMeasurementState | null>(null)
  const [isAdjustingMeasurement, setIsAdjustingMeasurement] = useState(false)
  const [isSnappingToStart, setIsSnappingToStart] = useState(false)
  const [hoveredMeasurementId, setHoveredMeasurementId] = useState<string | null>(null)
  // Calibration mode state
  const [internalIsCalibrating, setInternalIsCalibrating] = useState(false)
  const [internalCalibrationPoints, setInternalCalibrationPoints] = useState<{ x: number; y: number }[]>([])
  
  // Use external calibration points if provided, otherwise use internal state
  const calibrationPoints = externalCalibrationPoints || internalCalibrationPoints
  const isCalibrating = externalIsCalibrating !== undefined ? externalIsCalibrating : internalIsCalibrating
  
  const setCalibrationPoints = (points: { x: number; y: number }[]) => {
    if (onCalibrationPointsChange) {
      onCalibrationPointsChange(points)
    } else {
      setInternalCalibrationPoints(points)
    }
  }
  
  const setIsCalibrating = (calibrating: boolean) => {
    if (onSetCalibrating) {
      onSetCalibrating(calibrating)
    } else {
      setInternalIsCalibrating(calibrating)
    }
  }
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [numPages, setNumPages] = useState(0) // Start at 0, will be set when PDF loads
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState('1')
  // Track actual PDF page dimensions (stored at base scale, i.e., multiplied by scale prop)
  const [pageDimensions, setPageDimensions] = useState<Map<number, { width: number; height: number }>>(new Map())
  // Legacy pageHeights for backwards compatibility - derived from pageDimensions
  const pageHeights = useMemo(() => {
    const heights = new Map<number, number>()
    pageDimensions.forEach((dims, pageNum) => {
      heights.set(pageNum, dims.height)
    })
    return heights
  }, [pageDimensions])
  const [documentReady, setDocumentReady] = useState(false) // Track if PDF is ready for rendering
  const [documentComponentReady, setDocumentComponentReady] = useState(false) // Track if Document component's internal PDF is loaded
  const documentInstanceId = useRef(0) // Unique ID for each document load to prevent stale page renders
  const componentIsMounted = useRef(true) // Track component lifecycle to prevent state updates after unmount
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1])) // Track visible pages for lazy loading
  const hasAutoFitted = useRef(false) // Track if we've already auto-fitted
  const [searchMatches, setSearchMatches] = useState<Array<{ page: number; index: number }>>([])
  
  // Page cache for faster navigation (LRU with max 5 pages)
  const pageCacheRef = useRef<Map<number, { timestamp: number; rendered: boolean }>>(new Map())
  const MAX_CACHED_PAGES = 5
  
  // Pages to render: current page + next 2 for prefetching
  const [pagesToRender, setPagesToRender] = useState<Set<number>>(new Set([1]))
  
  // Progressive rendering state - start with low quality, upgrade on idle
  const [renderQuality, setRenderQuality] = useState<'low' | 'high'>('low')
  const qualityUpgradeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Track if text layer should be enabled (only when search is active)
  const shouldRenderTextLayer = Boolean(searchQuery && searchQuery.trim())
  
  // Handle search query changes
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) {
      setSearchMatches([])
      if (onSearchResults) {
        onSearchResults(0)
      }
      // Clear highlights
      const textLayer = document.querySelector(`[data-page-num="${currentPage}"] .react-pdf__Page__textContent`)
      if (textLayer) {
        const spans = textLayer.querySelectorAll('span')
        spans.forEach(span => {
          span.style.backgroundColor = 'transparent'
        })
      }
      return
    }

    // Search through text layer
    const performSearch = () => {
      const textLayer = document.querySelector(`[data-page-num="${currentPage}"] .react-pdf__Page__textContent`)
      if (!textLayer) {
        // Text layer not ready yet, try again
        setTimeout(performSearch, 200)
        return
      }

      const query = searchQuery.toLowerCase()
      const spans = Array.from(textLayer.querySelectorAll('span'))
      let matches: number[] = []
      
      spans.forEach((span, index) => {
        const text = span.textContent?.toLowerCase() || ''
        span.style.backgroundColor = 'transparent'
        
        if (text.includes(query)) {
          matches.push(index)
        }
      })

      // Update matches for current page
      const pageMatches = matches.map(index => ({ page: currentPage, index }))
      setSearchMatches(pageMatches)
      
      if (onSearchResults) {
        onSearchResults(pageMatches.length)
      }
    }

    performSearch()
  }, [searchQuery, currentPage, onSearchResults])

  // Handle match navigation and highlighting
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim() || searchMatches.length === 0) return

    const textLayer = document.querySelector(`[data-page-num="${currentPage}"] .react-pdf__Page__textContent`)
    if (!textLayer) return

    const spans = Array.from(textLayer.querySelectorAll('span'))
    const matchIndex = currentMatchIndex !== undefined ? currentMatchIndex : 0
    
    // Reset all highlights
    searchMatches.forEach(match => {
      const span = spans[match.index]
      if (span) {
        span.style.backgroundColor = 'rgba(255, 255, 0, 0.3)'
      }
    })

    // Highlight current match
    if (matchIndex < searchMatches.length && matchIndex >= 0) {
      const currentMatch = searchMatches[matchIndex]
      const currentMatchSpan = spans[currentMatch.index]
      if (currentMatchSpan) {
        currentMatchSpan.style.backgroundColor = 'rgba(255, 255, 0, 0.6)'
        // Scroll to match
        currentMatchSpan.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentMatchIndex, searchMatches, searchQuery, currentPage])

  // Configure PDF.js worker on mount - only needed for getting page count
  const [workerReady, setWorkerReady] = useState(false)
  
  // Render PDF at variable resolution based on quality mode
  // Low quality for fast initial paint, high quality after idle
  // CSS transform handles visual zoom, so we don't need to include zoom in render scale
  const pageScale = useMemo(() => {
    const BASE_WIDTH = 612
    const BASE_HEIGHT = 792
    const MAX_CANVAS_DIMENSION = 8192

    // Low quality: render at 1.5x scale for fast initial load
    // High quality: render at 2x devicePixelRatio for crisp display
    if (renderQuality === 'low') {
      return scale * 1.5 // Fast initial render
    }

    const rawDevicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2
    const effectiveDevicePixelRatio = Math.min(2, rawDevicePixelRatio) // Cap at 2x for performance
    const desiredScale = scale * 2 * effectiveDevicePixelRatio // Reduced from scale * 3

    const maxScaleByWidth = MAX_CANVAS_DIMENSION / BASE_WIDTH
    const maxScaleByHeight = MAX_CANVAS_DIMENSION / BASE_HEIGHT
    const cappedScale = Math.min(desiredScale, maxScaleByWidth, maxScaleByHeight)

    return cappedScale
  }, [scale, renderQuality])
  
  // Suppress PDF.js messageHandler errors that occur during navigation/cleanup
  // These are harmless race conditions that don't affect functionality
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('messageHandler') || 
          event.message?.includes('sendWithPromise') ||
          event.error?.message?.includes('messageHandler') ||
          event.error?.message?.includes('sendWithPromise')) {
        event.preventDefault()
        console.debug('Suppressed PDF.js worker cleanup error (harmless during navigation)')
        return true
      }
    }
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || String(event.reason)
      if (errorMessage?.includes('messageHandler') || 
          errorMessage?.includes('sendWithPromise')) {
        event.preventDefault()
        console.debug('Suppressed PDF.js unhandled rejection (harmless during navigation)')
        return
      }
    }
    
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Track component mount state to prevent state updates after unmount
  useEffect(() => {
    componentIsMounted.current = true
    return () => {
      componentIsMounted.current = false
    }
  }, [])
  
  useEffect(() => {
    if (typeof window !== 'undefined' && !workerReady) {
      const initWorker = async () => {
        try {
          const pdfjs = await import('react-pdf')
          if (pdfjs.pdfjs) {
            // Set worker source to absolute path to avoid Turbopack specifier issues
            pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = new URL(
              '/pdf.worker.min.js',
              window.location.origin
            ).toString()
            
            // Allow worker time to initialize - reduced from 1500ms but still safe
            await new Promise(resolve => setTimeout(resolve, 400))
            
            if (pdfjs.pdfjs.GlobalWorkerOptions.workerSrc) {
              setWorkerReady(true)
            } else {
              // Retry with longer delay
              setTimeout(() => setWorkerReady(true), 500)
            }
          }
        } catch (error) {
          console.error('Failed to configure PDF.js worker:', error)
          // Fallback to CDN
          try {
            const pdfjs = await import('react-pdf')
            if (pdfjs.pdfjs) {
              pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.pdfjs.version}/pdf.worker.min.js`
              await new Promise(resolve => setTimeout(resolve, 500))
              setWorkerReady(true)
            }
          } catch (fallbackError) {
            console.error('CDN fallback also failed:', fallbackError)
            // Still set ready after delay to allow rendering attempts
            setTimeout(() => setWorkerReady(true), 800)
          }
        }
      }
      
      initWorker()
    }
  }, [workerReady])

  // Reset document component ready state when PDF URL changes
  useEffect(() => {
    setDocumentComponentReady(false)
    // Reset related states for fresh PDF load
    setDocumentReady(false)
    setPdfLoaded(false)
    setPdfError(null)
    // Reset pages to render to prevent stale page loads
    setPagesToRender(new Set([1]))
    setCurrentPage(1)
  }, [pdfUrl])

  // Mark document as ready once worker is ready and we have a URL
  // The actual PDF loading is handled by the Document component
  useEffect(() => {
    if (pdfUrl && workerReady && !documentReady) {
      // Allow the Document component to handle PDF loading
      // Just mark that we're ready to attempt rendering
      setDocumentReady(true)
    }
  }, [pdfUrl, workerReady, documentReady])

  // Progressive rendering: upgrade to high quality after initial render settles
  useEffect(() => {
    // Only reset quality if document is ready (worker is stable)
    if (!documentReady) return
    
    // Reset to low quality when page changes for fast initial paint
    setRenderQuality('low')
    
    // Clear any pending upgrade
    if (qualityUpgradeTimeoutRef.current) {
      clearTimeout(qualityUpgradeTimeoutRef.current)
    }
    
    // Schedule upgrade to high quality after page settles
    qualityUpgradeTimeoutRef.current = setTimeout(() => {
      // Guard against state updates after unmount
      if (componentIsMounted.current) {
        setRenderQuality('high')
      }
    }, 500) // Upgrade after 500ms of idle (increased for stability)
    
    return () => {
      if (qualityUpgradeTimeoutRef.current) {
        clearTimeout(qualityUpgradeTimeoutRef.current)
      }
    }
  }, [currentPage, documentReady])
  
  // Update which pages to render: current + next 2 for prefetching
  useEffect(() => {
    if (!documentReady || numPages === 0) return
    
    const pagesToLoad = new Set<number>()
    
    // Always load current page
    pagesToLoad.add(currentPage)
    
    // Prefetch next 2 pages (if they exist)
    if (currentPage + 1 <= numPages) pagesToLoad.add(currentPage + 1)
    if (currentPage + 2 <= numPages) pagesToLoad.add(currentPage + 2)
    
    // Also keep previous page for back navigation
    if (currentPage - 1 >= 1) pagesToLoad.add(currentPage - 1)
    
    setPagesToRender(pagesToLoad)
    
    // Update cache
    const cache = pageCacheRef.current
    cache.set(currentPage, { timestamp: Date.now(), rendered: true })
    
    // Evict pages far from current view to save memory
    if (cache.size > MAX_CACHED_PAGES) {
      const pagesToKeep = new Set([
        currentPage - 1, currentPage, currentPage + 1, currentPage + 2
      ])
      
      cache.forEach((_, pageNum) => {
        if (!pagesToKeep.has(pageNum)) {
          cache.delete(pageNum)
        }
      })
    }
  }, [currentPage, documentReady, numPages])

  // Notify parent on current page changes
  useEffect(() => {
    if (onPageChange) {
      onPageChange(currentPage)
    }
  }, [currentPage, onPageChange])

  useEffect(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  const handlePageInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value
    const sanitizedValue = rawValue.replace(/\D/g, '')
    setPageInputValue(sanitizedValue)
  }, [])

  const handlePageInputFormSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (numPages <= 0) {
      return
    }

    if (!pageInputValue) {
      setPageInputValue(String(currentPage))
      return
    }

    const parsedValue = parseInt(pageInputValue, 10)

    if (Number.isNaN(parsedValue)) {
      setPageInputValue(String(currentPage))
      return
    }

    const targetPage = Math.min(Math.max(parsedValue, 1), numPages)

    setPageInputValue(String(targetPage))

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage)
      setViewport(prev => ({
        ...prev,
        panX: 0,
        panY: 0
      }))
    }
  }, [numPages, pageInputValue, currentPage])

  const handlePageInputBlur = useCallback(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  // Get icon for comment type
  const getCommentIcon = (noteType?: string) => {
    const iconMap: Record<string, any> = {
      requirement: CheckCircle,
      concern: AlertCircle,
      suggestion: Lightbulb,
      other: MessageSquare
    }
    return iconMap[noteType || 'other'] || MessageSquare
  }

  // Helper: Get scale setting for a page (handles string/number key conversion)
  const getScaleSetting = useCallback((pageNumber: number) => {
    if (!measurementScaleSettings) {
      return null
    }
    
    // Try all possible key formats - numeric first, then string
    let setting = measurementScaleSettings[pageNumber]
    if (!setting) {
      setting = measurementScaleSettings[String(pageNumber) as any]
    }
    if (!setting) {
      setting = measurementScaleSettings[Number(pageNumber)]
    }
    
    // Debug only if not found and we have settings
    if (!setting && Object.keys(measurementScaleSettings).length > 0) {
      console.log('getScaleSetting: No setting found for page', pageNumber, {
        availableKeys: Object.keys(measurementScaleSettings),
        availableNumericKeys: Object.keys(measurementScaleSettings).filter(k => !isNaN(Number(k))),
        pageNumberType: typeof pageNumber,
        triedKeys: [pageNumber, String(pageNumber), Number(pageNumber)],
        settingsObject: measurementScaleSettings
      })
    }
    
    return setting
  }, [measurementScaleSettings])

  // Helper: Calculate real-world distance from pixel distance using scale
  const calculateRealWorldDistance = useCallback((pixelDistance: number, pageNumber: number): number | null => {
    const scaleSetting = getScaleSetting(pageNumber)
    if (!scaleSetting?.pixelsPerUnit) return null
    return pixelDistance / scaleSetting.pixelsPerUnit
  }, [getScaleSetting])

  // Helper: Calculate real-world area from pixel area using scale
  const calculateRealWorldArea = useCallback((pixelArea: number, pageNumber: number): number | null => {
    const scaleSetting = getScaleSetting(pageNumber)
    if (!scaleSetting?.pixelsPerUnit) return null
    // Convert from pixels^2 to real-world units^2
    const pixelsPerUnit = scaleSetting.pixelsPerUnit
    return pixelArea / (pixelsPerUnit * pixelsPerUnit)
  }, [getScaleSetting])

  // Helper: Format measurement value with unit
  const formatMeasurement = (value: number, unit: 'ft' | 'in' | 'm' | 'cm' | 'mm'): string => {
    if (unit === 'ft') {
      // Convert decimal feet to feet and inches
      const feet = Math.floor(value)
      const inches = Math.round((value - feet) * 12)
      
      if (feet === 0) {
        return inches > 0 ? `${inches} in` : '0 in'
      } else if (inches === 0) {
        return `${feet} ft`
      } else {
        return `${feet} ft ${inches} in`
      }
    } else if (unit === 'in') {
      return `${Math.round(value)} in`
    } else if (unit === 'm') {
      return `${value.toFixed(2)} m`
    } else if (unit === 'cm') {
      return `${value.toFixed(1)} cm`
    } else {
      return `${Math.round(value)} mm`
    }
  }
  
  // Helper: Format area with unit
  const formatArea = (value: number, unit: 'ft' | 'in' | 'm' | 'cm' | 'mm'): string => {
    if (unit === 'ft') {
      // For area, show decimal feet for precision but convert whole feet to feet+inches
      const wholeFeet = Math.floor(value)
      const decimalPart = value - wholeFeet
      
      if (wholeFeet === 0) {
        return `${value.toFixed(2)} sq ft`
      } else if (decimalPart < 0.01) {
        return `${wholeFeet} sq ft`
      } else {
        // Show as "X sq ft Y sq in" for better readability
        const totalSqInches = value * 144 // 1 sq ft = 144 sq in
        const wholeSqFeet = Math.floor(totalSqInches / 144)
        const remainingSqInches = Math.round(totalSqInches % 144)
        
        if (wholeSqFeet === 0) {
          return `${remainingSqInches} sq in`
        } else if (remainingSqInches === 0) {
          return `${wholeSqFeet} sq ft`
        } else {
          return `${wholeSqFeet} sq ft ${remainingSqInches} sq in`
        }
      }
    } else if (unit === 'in') {
      return `${Math.round(value)} sq in`
    } else if (unit === 'm') {
      return `${value.toFixed(2)} sq m`
    } else if (unit === 'cm') {
      return `${value.toFixed(1)} sq cm`
    } else {
      return `${Math.round(value)} sq mm`
    }
  }

  // Calculate page positions for continuous scroll view - memoized to prevent infinite loops
  // Uses actual heights from loaded pages, or estimated heights
  const pagePositions = useMemo(() => {
    const PAGE_GAP = 20 // Gap between pages in pixels
    const positions: { y: number; height: number }[] = []
    let yPos = 0

    // Estimate height from first loaded page, or use default based on scale
    // Standard 8.5x11" at 72 DPI = 612x792px, scaled
    const estimatedHeight = pageHeights.get(1) || (792 * scale)

    for (let i = 0; i < numPages; i++) {
      const pageNum = i + 1
      const height = pageHeights.get(pageNum) || estimatedHeight
      positions[i] = { y: yPos, height }
      yPos += height + PAGE_GAP
    }

    return positions
  }, [pageHeights, numPages, scale])
  
  // Wrapper function for backward compatibility with callbacks
  const calculatePagePositions = useCallback(() => {
    return pagePositions
  }, [pagePositions])

  // Track visible pages for lazy loading
  useEffect(() => {
    const container = containerRef.current
    if (!container || numPages === 0) return

    const updateVisiblePages = () => {
      const containerRect = container.getBoundingClientRect()
      const positions = calculatePagePositions()
      const visible = new Set<number>()

      positions.forEach((pos, index) => {
        const pageNum = index + 1
        const worldY = pos.y
        const screenY = worldY * viewport.zoom + viewport.panY
        const pageHeight = pos.height * viewport.zoom
        
        // Check if page is in viewport (with some padding)
        const padding = 200 // Load pages slightly outside viewport
        if (screenY + pageHeight + padding >= 0 && screenY - padding <= containerRect.height) {
          visible.add(pageNum)
        }
      })

      setVisiblePages(visible)
    }

    updateVisiblePages()
    
    // Update on viewport changes (zoom/pan)
    const handleViewportChange = () => updateVisiblePages()
    
    // Use requestAnimationFrame for smooth updates
    let rafId: number
    const scheduleUpdate = () => {
      rafId = requestAnimationFrame(() => {
        updateVisiblePages()
      })
    }
    
    scheduleUpdate()
    
    // Also listen to wheel events for immediate updates
    const handleWheel = () => scheduleUpdate()
    container.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      container.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [numPages, viewport, calculatePagePositions])

  const computeLineMeasurementData = useCallback(
    (points: number[], pageNumber: number) => {
      if (points.length < 4) {
        return null
      }

      const scaleSetting = getScaleSetting(pageNumber)
      if (!scaleSetting) {
        return null
      }

      const segmentLengths: number[] = []
      let totalLength = 0

      for (let i = 0; i < points.length - 2; i += 2) {
        const pixelDist = calculatePixelDistance(points[i], points[i + 1], points[i + 2], points[i + 3])
        const realDist = calculateRealWorldDistance(pixelDist, pageNumber)
        if (realDist === null) {
          return null
        }
        segmentLengths.push(realDist)
        totalLength += realDist
      }

      return {
        segmentLengths,
        totalLength,
        unit: scaleSetting.unit
      }
    },
    [calculateRealWorldDistance, getScaleSetting]
  )

  const computeAreaMeasurementData = useCallback(
    (points: number[], pageNumber: number) => {
      if (points.length < 6) {
        return null
      }

      const scaleSetting = getScaleSetting(pageNumber)
      if (!scaleSetting) {
        return null
      }
      const pixelArea = calculatePolygonArea(points)
      const realArea = calculateRealWorldArea(pixelArea, pageNumber)
      if (realArea === null) {
        return null
      }
      return {
        area: realArea,
        unit: scaleSetting.unit
      }
    },
    [calculateRealWorldArea, getScaleSetting]
  )

  // Render drawings on the drawing canvas
  const renderDrawings = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) {
      // console.warn('Canvas ref is null, cannot render drawings')
      return
    }

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) {
      // console.warn('Could not get 2d context from canvas')
      return
    }

    // Check if canvas is in a valid state
    try {
      // Test if canvas is accessible
      if (canvas.width === 0 || canvas.height === 0) {
        // console.warn('Canvas has zero dimensions:', { width: canvas.width, height: canvas.height })
        return
      }
      
      // Clear canvas with transparent background
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Ensure context settings are correct
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      // Canvas is ready for drawing
    } catch (error) {
      console.error('Canvas context error, skipping render:', error)
      return
    }

    // Get drawings for current page only (paginated view)
    const currentPageComments = drawings.filter(d => d.type === 'comment' && d.pageNumber === currentPage)
    const currentPageMeasurements = drawings.filter(d => (d.type === 'measurement_line' || d.type === 'measurement_area') && d.pageNumber === currentPage)
    
    // Draw measurement lines for current page
    const isEditMode = selectedTool === 'measurement_edit'

    currentPageMeasurements.forEach(drawing => {
      const isEditingThis = editingMeasurement?.id === drawing.id
      const isSelected = selectedMeasurementIds?.has(drawing.id) || false
      // Get raw points (stored in PDF base coordinates)
      const rawPoints = (isEditingThis ? editingMeasurement?.points : drawing.geometry?.points) || []
      if (drawing.type === 'measurement_line' && rawPoints.length < 4) {
        return
      }
      if (drawing.type === 'measurement_area' && rawPoints.length < 6) {
        return
      }
      
      // Convert PDF-space coordinates to canvas-space coordinates for rendering
      // Points are stored in PDF base space (612x792) and need to be scaled to canvas space
      const points = rawPoints.map((coord, i) => coord * scale)

      const scaleSetting = getScaleSetting(drawing.pageNumber)
      let measurementData = drawing.measurements

      if (isEditingThis) {
        if (drawing.type === 'measurement_line') {
          measurementData = computeLineMeasurementData(points, drawing.pageNumber) || drawing.measurements
        } else if (drawing.type === 'measurement_area') {
          measurementData = computeAreaMeasurementData(points, drawing.pageNumber) || drawing.measurements
        }
      }

      const unit =
        (measurementData && 'unit' in measurementData && measurementData.unit) ||
        scaleSetting?.unit ||
        'ft'
      const baseColor = drawing.style?.color || '#3b82f6'
      // Use orange highlight for selected measurements
      const color = isSelected ? '#f97316' : baseColor

      ctx.save()
      
      // Draw selection glow effect for selected measurements
      if (isSelected) {
        ctx.save()
        ctx.strokeStyle = '#f97316'
        ctx.lineWidth = (drawing.style?.strokeWidth || 2) + 6
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.globalAlpha = 0.3
        
        if (drawing.type === 'measurement_line') {
          ctx.beginPath()
          ctx.moveTo(points[0], points[1])
          for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(points[i], points[i + 1])
          }
          ctx.stroke()
        } else if (drawing.type === 'measurement_area') {
          ctx.beginPath()
          ctx.moveTo(points[0], points[1])
          for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(points[i], points[i + 1])
          }
          ctx.closePath()
          ctx.stroke()
          ctx.fill()
        }
        ctx.restore()
      }
      
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = isSelected ? (drawing.style?.strokeWidth || 2) + 1 : (drawing.style?.strokeWidth || 2)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.setLineDash(isEditingThis ? [6, 4] : [])
      
      if (drawing.type === 'measurement_line') {
        // Draw polyline
        ctx.beginPath()
        ctx.moveTo(points[0], points[1])
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i], points[i + 1])
        }
        ctx.stroke()
        ctx.setLineDash([])
        
        // Draw labels for each segment (only when hovered, selected, or editing)
        const showLabels = hoveredMeasurementId === drawing.id || isSelected || isEditingThis
        if (showLabels && measurementData && 'segmentLengths' in (measurementData as any) && Array.isArray((measurementData as any).segmentLengths) && scaleSetting) {
          const segmentLengths = (measurementData as any).segmentLengths as number[]
          for (let i = 0; i < points.length - 2; i += 2) {
            const x1 = points[i]
            const y1 = points[i + 1]
            const x2 = points[i + 2]
            const y2 = points[i + 3]
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            const length = segmentLengths[i / 2]
            
            // Draw label background
            const label = formatMeasurement(length, unit)
            ctx.font = '10px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(label).width
            const padding = 3
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.fillRect(midX - textWidth / 2 - padding, midY - 6, textWidth + padding * 2, 12)
            
            // Draw label text
            try {
              ctx.fillStyle = '#1f2937'
              ctx.fillText(label, midX, midY)
            } catch (error) {
              console.warn('Error drawing text, skipping:', error)
            }
          }
          
          // Draw total length if multiple segments
          if ((measurementData as any)?.totalLength && points.length > 4) {
            const lastX = points[points.length - 2]
            const lastY = points[points.length - 1]
            const label = `Total: ${formatMeasurement((measurementData as any).totalLength, unit)}`
            ctx.font = '11px Arial'
            ctx.textAlign = 'left'
            const textWidth = ctx.measureText(label).width
            const padding = 3
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.fillRect(lastX + 8, lastY - 8, textWidth + padding * 2, 16)
            
            try {
              ctx.fillStyle = '#1f2937'
              ctx.fillText(label, lastX + 8 + padding, lastY)
            } catch (error) {
              console.warn('Error drawing text, skipping:', error)
            }
          }
        }

        const shouldShowHandles = isEditMode && (isEditingThis || !editingMeasurement)
        if (shouldShowHandles) {
          ctx.save()
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          for (let i = 0; i < points.length; i += 2) {
            const handleX = points[i]
            const handleY = points[i + 1]
            const radius = isEditingThis ? 6 : 5
            ctx.fillStyle = isEditingThis ? '#ffffff' : 'rgba(255,255,255,0.75)'
            ctx.beginPath()
            ctx.arc(handleX, handleY, radius, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
          }
          ctx.restore()
        }
      } else if (drawing.type === 'measurement_area') {
        // Draw polygon
        ctx.beginPath()
        ctx.moveTo(points[0], points[1])
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i], points[i + 1])
        }
        ctx.closePath()
        ctx.fillStyle = `${drawing.style?.color || '#3b82f6'}40`
        ctx.fill()
        ctx.stroke()
        
        // Draw area label at centroid (only when hovered, selected, or editing)
        const showAreaLabel = hoveredMeasurementId === drawing.id || isSelected || isEditingThis
        if (showAreaLabel && measurementData && 'area' in (measurementData as any) && scaleSetting) {
          // Calculate centroid
          let sumX = 0, sumY = 0
          for (let i = 0; i < points.length; i += 2) {
            sumX += points[i]
            sumY += points[i + 1]
          }
          const centroidX = sumX / (points.length / 2)
          const centroidY = sumY / (points.length / 2)
          
          // Format area (convert to sqft if needed)
          let area = (measurementData as any).area
          const areaLabel = formatArea(area, unit)
          
          ctx.font = '11px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const textWidth = ctx.measureText(areaLabel).width
          const padding = 4
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.fillRect(centroidX - textWidth / 2 - padding, centroidY - 7, textWidth + padding * 2, 14)
          
          try {
            ctx.fillStyle = '#1f2937'
            ctx.fillText(areaLabel, centroidX, centroidY)
          } catch (error) {
            console.warn('Error drawing text, skipping:', error)
          }
        }

        // Draw edit handles for area measurements (same as lines)
        const shouldShowAreaHandles = isEditMode && (isEditingThis || !editingMeasurement)
        if (shouldShowAreaHandles) {
          ctx.save()
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          for (let i = 0; i < points.length; i += 2) {
            const handleX = points[i]
            const handleY = points[i + 1]
            const radius = isEditingThis ? 6 : 5
            ctx.fillStyle = isEditingThis ? '#ffffff' : 'rgba(255,255,255,0.75)'
            ctx.beginPath()
            ctx.arc(handleX, handleY, radius, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
          }
          ctx.restore()
        }
      }
      ctx.restore()
    })
    
    // Draw current measurement being drawn (only if on current page)
    if (currentMeasurement && currentMeasurement.geometry?.points && currentMeasurement.pageNumber === currentPage) {
      // Raw points are stored in PDF base coordinates - scale them for canvas rendering
      const rawPoints = currentMeasurement.geometry.points
      const points = rawPoints.map((coord) => coord * scale)
      const scaleSetting = getScaleSetting(currentMeasurement.pageNumber)
      const unit = scaleSetting?.unit || 'ft'
      
      ctx.strokeStyle = currentMeasurement.style?.color || '#3b82f6'
      ctx.fillStyle = currentMeasurement.style?.color || '#3b82f6'
      ctx.lineWidth = currentMeasurement.style?.strokeWidth || 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      if (currentMeasurement.type === 'measurement_line' && points.length >= 4) {
        ctx.beginPath()
        ctx.moveTo(points[0], points[1])
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i], points[i + 1])
        }
        ctx.stroke()
        
        // Show live measurement for last segment
        // Use raw (PDF-space) points for distance calculation since scale settings are in PDF space
        if (rawPoints.length >= 4 && scaleSetting) {
          const x1 = rawPoints[rawPoints.length - 4]
          const y1 = rawPoints[rawPoints.length - 3]
          const x2 = rawPoints[rawPoints.length - 2]
          const y2 = rawPoints[rawPoints.length - 1]
          const pixelDist = calculatePixelDistance(x1, y1, x2, y2)
          const realDist = calculateRealWorldDistance(pixelDist, currentMeasurement.pageNumber)
          
          if (realDist !== null) {
            // Use scaled points for rendering position
            const midX = (points[points.length - 4] + points[points.length - 2]) / 2
            const midY = (points[points.length - 3] + points[points.length - 1]) / 2
            const label = formatMeasurement(realDist, unit)
            
            ctx.font = '10px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(label).width
            const padding = 3
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.fillRect(midX - textWidth / 2 - padding, midY - 6, textWidth + padding * 2, 12)
            
            try {
              ctx.fillStyle = '#1f2937'
              ctx.fillText(label, midX, midY)
            } catch (error) {
              console.warn('Error drawing text, skipping:', error)
            }
          }
        }
      } else if (currentMeasurement.type === 'measurement_area' && points.length >= 6) {
        ctx.beginPath()
        ctx.moveTo(points[0], points[1])
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i], points[i + 1])
        }
        ctx.fillStyle = `${currentMeasurement.style?.color || '#3b82f6'}40`
        ctx.fill()
        ctx.stroke()
        
        // Draw snap-to-close indicator at start point
        const startX = points[0]
        const startY = points[1]
        const snapRadius = SNAP_TO_CLOSE_THRESHOLD * scale
        
        // Always draw a subtle indicator at start point
        ctx.save()
        ctx.strokeStyle = isSnappingToStart ? '#22c55e' : 'rgba(59, 130, 246, 0.5)'
        ctx.lineWidth = isSnappingToStart ? 3 : 2
        ctx.setLineDash(isSnappingToStart ? [] : [4, 4])
        ctx.beginPath()
        ctx.arc(startX, startY, snapRadius, 0, Math.PI * 2)
        ctx.stroke()
        
        // Draw filled circle at start point when snapping
        if (isSnappingToStart) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.3)'
          ctx.fill()
          
          // Draw inner solid circle
          ctx.fillStyle = '#22c55e'
          ctx.beginPath()
          ctx.arc(startX, startY, 4, 0, Math.PI * 2)
          ctx.fill()
          
          // Draw "Click to close" tooltip
          ctx.font = 'bold 9px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          const tooltipText = 'Click to close'
          const tooltipWidth = ctx.measureText(tooltipText).width
          const tooltipPadding = 4
          const tooltipX = startX
          const tooltipY = startY - snapRadius - 6
          
          ctx.fillStyle = '#22c55e'
          ctx.beginPath()
          ctx.roundRect(tooltipX - tooltipWidth / 2 - tooltipPadding, tooltipY - 12, tooltipWidth + tooltipPadding * 2, 14, 3)
          ctx.fill()
          
          ctx.fillStyle = 'white'
          ctx.fillText(tooltipText, tooltipX, tooltipY)
        }
        ctx.restore()
        
        // Show live area if closed - use raw points for calculation
        if (scaleSetting) {
          const pixelArea = calculatePolygonArea(rawPoints)
          const realArea = calculateRealWorldArea(pixelArea, currentMeasurement.pageNumber)
          
          if (realArea !== null) {
            // Use scaled points for rendering position
            let sumX = 0, sumY = 0
            for (let i = 0; i < points.length; i += 2) {
              sumX += points[i]
              sumY += points[i + 1]
            }
            const centroidX = sumX / (points.length / 2)
            const centroidY = sumY / (points.length / 2)
            
            const areaLabel = formatArea(realArea, unit)
            
            ctx.font = '11px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(areaLabel).width
            const padding = 4
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.fillRect(centroidX - textWidth / 2 - padding, centroidY - 7, textWidth + padding * 2, 14)
            
            try {
              ctx.fillStyle = '#1f2937'
              ctx.fillText(areaLabel, centroidX, centroidY)
            } catch (error) {
              console.warn('Error drawing text, skipping:', error)
            }
          }
        }
      }
    }

    // Draw calibration points if in calibration mode
    // Points are stored in PDF space, scale to canvas space for rendering
    if (isCalibrating && calibrationPoints.length > 0) {
      calibrationPoints.forEach((point, index) => {
        const canvasX = point.x * scale
        const canvasY = point.y * scale
        
        ctx.fillStyle = '#ef4444'
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        
        ctx.beginPath()
        ctx.arc(canvasX, canvasY, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        // Draw label
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = '#1f2937'
        ctx.fillText(`Point ${index + 1}`, canvasX, canvasY - 12)
      })
      
      // Draw line between points if we have 2
      if (calibrationPoints.length === 2) {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(calibrationPoints[0].x * scale, calibrationPoints[0].y * scale)
        ctx.lineTo(calibrationPoints[1].x * scale, calibrationPoints[1].y * scale)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Comments are now rendered as HTML elements, not on canvas
  }, [drawings, selectedComment, currentMeasurement, measurementScaleSettings, isCalibrating, calibrationPoints, currentPage, getScaleSetting, editingMeasurement, computeLineMeasurementData, computeAreaMeasurementData, selectedTool, selectedMeasurementIds, isSnappingToStart, hoveredMeasurementId])

  // Set canvas dimensions to match current page (zoom handled by transform)
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      return
    }

    const resizeCanvas = () => {
      // Size canvas to match current PDF page at display scale (zoom is handled by transform)
      // Use actual PDF dimensions to ensure perfect alignment
      const dims = pageDimensions.get(currentPage)
      const pageWidth = dims?.width || (PDF_BASE_WIDTH * scale)
      const pageHeight = dims?.height || (PDF_BASE_HEIGHT * scale)
      
      // Ensure we have valid dimensions
      if (pageWidth <= 0 || pageHeight <= 0) {
        console.warn('Invalid canvas dimensions:', { pageWidth, pageHeight, scale, currentPage })
        return
      }
      
      // Set canvas internal resolution to match display size (1:1 pixel ratio)
      // This ensures crisp rendering that matches the PDF container exactly
      canvas.width = pageWidth
      canvas.height = pageHeight
      canvas.style.width = `${pageWidth}px`
      canvas.style.height = `${pageHeight}px`
      
      // Canvas is centered by the parent container's flex layout
      // Use relative positioning to match PDF positioning
      canvas.style.position = 'relative'
      canvas.style.margin = '0'
      canvas.style.display = 'block'
      canvas.style.visibility = 'visible'
      canvas.style.opacity = '1'
      
      // Force re-render of drawings after canvas resize
      setTimeout(() => {
        renderDrawings()
      }, 0)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [currentPage, pageDimensions, scale, renderDrawings])

  // Auto-fit zoom on first page load (fit to first page width)
  useEffect(() => {
    const container = containerRef.current
    if (!hasAutoFitted.current && pageHeights.size > 0 && container) {
      // Small delay to ensure container has dimensions
      setTimeout(() => {
        const containerRect = container.getBoundingClientRect()
        if (containerRect.width === 0 || containerRect.height === 0) {
          return
        }
        
        const firstPageHeight = pageHeights.get(1)
        if (!firstPageHeight) return
        
        // Estimate width from height (assuming standard page ratio)
        const estimatedWidth = firstPageHeight * (8.5 / 11) // Standard 8.5x11 ratio
        const containerWidth = containerRect.width
        
        // Calculate zoom to fit page width with 5% padding
        const fitZoom = (containerWidth * 0.95) / estimatedWidth
        
        // Limit zoom to reasonable range but default to 100%
        const finalZoom = Math.min(2.0, Math.max(1.0, fitZoom))
        
        // Start at top of first page (panY = 0 means first page starts at top)
        setViewport({
          zoom: finalZoom,
          panX: 0,
          panY: 0
        })
        
        hasAutoFitted.current = true
      }, 100)
    }
  }, [pageHeights.size])

  // Render drawings when dependencies change
  useEffect(() => {
    renderDrawings()
  }, [renderDrawings])

  // Re-render when page changes
  useEffect(() => {
    renderDrawings()
  }, [currentPage, renderDrawings])

  // Re-render when drawings change
  useEffect(() => {
    renderDrawings()
  }, [drawings, renderDrawings])
  

  // Convert screen coordinates to world coordinates (for centered page view)
  // IMPORTANT: Coordinates are stored in PDF coordinate space (actual PDF dimensions divided by scale)
  // This ensures measurements persist correctly across zoom/scale changes and page refreshes
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    
    const containerRect = container.getBoundingClientRect()
    // Get actual PDF page dimensions at display scale
    const dims = pageDimensions.get(currentPage)
    const canvasWidth = dims?.width || (PDF_BASE_WIDTH * scale)
    const canvasHeight = dims?.height || (PDF_BASE_HEIGHT * scale)
    
    // Calculate center offset (page is centered in container via flexbox)
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2
    
    // Convert screen coordinates to canvas coordinates (accounting for pan and zoom)
    // The transform is: translate(panX, panY) scale(zoom) with origin at center
    const canvasX = (screenX - centerX - viewport.panX) / viewport.zoom + (canvasWidth / 2)
    const canvasY = (screenY - centerY - viewport.panY) / viewport.zoom + (canvasHeight / 2)
    
    // Convert canvas coordinates to PDF base coordinates (normalize by scale)
    // This ensures coordinates are stored in a consistent space regardless of scale
    const pdfX = canvasX / scale
    const pdfY = canvasY / scale
    
    return { x: pdfX, y: pdfY }
  }, [viewport, scale, currentPage, pageDimensions])

  // Get page number from Y coordinate
  // Returns null if the y coordinate is outside the document bounds
  const getPageNumber = useCallback((y: number): number | null => {
    const positions = calculatePagePositions()
    if (positions.length === 0) return null
    
    // If scrolled above the document, return null (don't change page)
    if (y < 0) return null
    
    for (let i = positions.length - 1; i >= 0; i--) {
      if (positions[i] && y >= positions[i].y) {
        return i + 1
      }
    }
    // If no position found, return null to indicate we shouldn't change the page
    return null
  }, [calculatePagePositions])

  // Handle goToPage prop to scroll to a specific page
  useEffect(() => {
    if (goToPage && goToPage >= 1 && goToPage <= numPages && pageHeights.size > 0) {
      const positions = calculatePagePositions()
      const targetPosition = positions[goToPage - 1]
      if (targetPosition) {
        // Scroll to the target page by adjusting panY
        // The position is in world coordinates, so we need to account for zoom
        const container = containerRef.current
        if (container) {
          const containerRect = container.getBoundingClientRect()
          const containerCenterY = containerRect.height / 2
          // Calculate panY to center the target page in the viewport
          const targetY = targetPosition.y + targetPosition.height / 2
          const newPanY = containerCenterY / viewport.zoom - targetY
          
          setViewport(prev => ({
            ...prev,
            panY: newPanY
          }))
          setCurrentPage(goToPage)
        }
      }
    }
  }, [goToPage, numPages, pageHeights.size, calculatePagePositions, viewport.zoom])

  // Handle wheel events for zoom and pan (natural scrolling)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    
    const container = containerRef.current
    if (!container) return
    
    if (e.ctrlKey || e.metaKey) {
      // Zoom when Ctrl/Cmd is pressed
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const zoomDelta = -e.deltaY * 0.001
      const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * (1 + zoomDelta)))
      
      setViewport(prev => ({
        zoom: newZoom,
        panX: mouseX - (mouseX - prev.panX) * (newZoom / prev.zoom),
        panY: mouseY - (mouseY - prev.panY) * (newZoom / prev.zoom)
      }))
    } else {
      // Natural scrolling - pan vertically through all pages
      const panSpeed = 0.5
      setViewport(prev => {
        const newPanY = prev.panY - e.deltaY * panSpeed
        // Update current page based on scroll position
        const scrollY = -newPanY / prev.zoom
        const newPage = getPageNumber(scrollY)
        // Only update page if we got a valid page number (not scrolled outside document)
        if (newPage !== null && newPage !== currentPage) {
          setCurrentPage(newPage)
        }
        return {
          ...prev,
          panX: prev.panX - e.deltaX * panSpeed,
          panY: newPanY
        }
      })
      
    }
  }, [viewport, calculatePagePositions, getPageNumber, currentPage])

  // Check if a point intersects with a comment (current page only)
  const isPointInComment = useCallback((worldX: number, worldY: number, drawing: Drawing) => {
    if (drawing.type !== 'comment' || drawing.pageNumber !== currentPage) return false
    
    const geom = drawing.geometry
    if (!geom || typeof geom.x === 'undefined' || typeof geom.y === 'undefined') return false
    
    // Coordinates are at base scale (zoom is handled by transform)
    const drawingX = geom.x
    const drawingY = geom.y
    
    // Increased threshold for easier clicking (at base scale)
    const threshold = 28
    
    const dist = Math.sqrt(Math.pow(worldX - drawingX, 2) + Math.pow(worldY - drawingY, 2))
    return dist <= threshold
  }, [currentPage])

  const getMeasurementHandleAtPoint = useCallback(
    (pageNumber: number, worldX: number, worldY: number): MeasurementHandleHit | null => {
      const threshold = 24
      let closest: MeasurementHandleHit | null = null
      let minDistance = Infinity

      drawings.forEach(drawing => {
        // Check both line and area measurements
        if ((drawing.type !== 'measurement_line' && drawing.type !== 'measurement_area') || drawing.pageNumber !== pageNumber) {
          return
        }

        const points = drawing.geometry?.points
        // Lines need at least 4 coordinates (2 points), areas need at least 6 (3 points)
        const minPoints = drawing.type === 'measurement_line' ? 4 : 6
        if (!points || points.length < minPoints) {
          return
        }

        for (let i = 0; i < points.length; i += 2) {
          const pointX = points[i]
          const pointY = points[i + 1]
          const distance = Math.sqrt(Math.pow(pointX - worldX, 2) + Math.pow(pointY - worldY, 2))

          if (distance <= threshold && distance < minDistance) {
            closest = {
              drawing,
              handleIndex: i / 2
            }
            minDistance = distance
          }
        }
      })

      return closest
    },
    [drawings]
  )

  const getMeasurementSegmentAtPoint = useCallback(
    (pageNumber: number, worldX: number, worldY: number): MeasurementHandleHit | null => {
      const threshold = 18
      let closest: MeasurementHandleHit | null = null
      let minDistance = Infinity

      const distanceToSegment = (
        px: number,
        py: number,
        x1: number,
        y1: number,
        x2: number,
        y2: number
      ) => {
        const dx = x2 - x1
        const dy = y2 - y1
        if (dx === 0 && dy === 0) {
          return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2))
        }
        const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
        const clampedT = Math.max(0, Math.min(1, t))
        const closestX = x1 + clampedT * dx
        const closestY = y1 + clampedT * dy
        return Math.sqrt(Math.pow(px - closestX, 2) + Math.pow(py - closestY, 2))
      }

      drawings.forEach(drawing => {
        // Check both line and area measurements
        if ((drawing.type !== 'measurement_line' && drawing.type !== 'measurement_area') || drawing.pageNumber !== pageNumber) {
          return
        }

        const points = drawing.geometry?.points
        // Lines need at least 4 coordinates (2 points), areas need at least 6 (3 points)
        const minPoints = drawing.type === 'measurement_line' ? 4 : 6
        if (!points || points.length < minPoints) {
          return
        }

        // Check all segments between consecutive points
        for (let i = 0; i < points.length - 2; i += 2) {
          const x1 = points[i]
          const y1 = points[i + 1]
          const x2 = points[i + 2]
          const y2 = points[i + 3]

          const distance = distanceToSegment(worldX, worldY, x1, y1, x2, y2)
          if (distance <= threshold && distance < minDistance) {
            const distToStart = Math.sqrt(Math.pow(worldX - x1, 2) + Math.pow(worldY - y1, 2))
            const distToEnd = Math.sqrt(Math.pow(worldX - x2, 2) + Math.pow(worldY - y2, 2))
            const handleIndex = distToStart <= distToEnd ? i / 2 : i / 2 + 1
            closest = {
              drawing,
              handleIndex
            }
            minDistance = distance
          }
        }

        // For areas, also check the closing segment (last point to first point)
        if (drawing.type === 'measurement_area' && points.length >= 6) {
          const x1 = points[points.length - 2]
          const y1 = points[points.length - 1]
          const x2 = points[0]
          const y2 = points[1]

          const distance = distanceToSegment(worldX, worldY, x1, y1, x2, y2)
          if (distance <= threshold && distance < minDistance) {
            const distToStart = Math.sqrt(Math.pow(worldX - x1, 2) + Math.pow(worldY - y1, 2))
            const distToEnd = Math.sqrt(Math.pow(worldX - x2, 2) + Math.pow(worldY - y2, 2))
            // For closing segment: last point index or first point index (0)
            const handleIndex = distToStart <= distToEnd ? (points.length - 2) / 2 : 0
            closest = {
              drawing,
              handleIndex
            }
            minDistance = distance
          }
        }
      })

      return closest
    },
    [drawings]
  )

  // Get exact segment that was clicked (for adding new points)
  const getSegmentAtPoint = useCallback(
    (pageNumber: number, worldX: number, worldY: number, targetDrawingId?: string): SegmentHit | null => {
      const threshold = 18
      let closest: SegmentHit | null = null
      let minDistance = Infinity

      const distanceToSegment = (
        px: number, py: number,
        x1: number, y1: number,
        x2: number, y2: number
      ) => {
        const dx = x2 - x1
        const dy = y2 - y1
        if (dx === 0 && dy === 0) {
          return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2))
        }
        const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
        const clampedT = Math.max(0, Math.min(1, t))
        const closestX = x1 + clampedT * dx
        const closestY = y1 + clampedT * dy
        return Math.sqrt(Math.pow(px - closestX, 2) + Math.pow(py - closestY, 2))
      }

      drawings.forEach(drawing => {
        // If targetDrawingId is specified, only check that drawing
        if (targetDrawingId && drawing.id !== targetDrawingId) return
        if ((drawing.type !== 'measurement_line' && drawing.type !== 'measurement_area') || drawing.pageNumber !== pageNumber) {
          return
        }

        const points = drawing.geometry?.points
        const minPoints = drawing.type === 'measurement_line' ? 4 : 6
        if (!points || points.length < minPoints) return

        // Check all segments between consecutive points
        for (let i = 0; i < points.length - 2; i += 2) {
          const x1 = points[i]
          const y1 = points[i + 1]
          const x2 = points[i + 2]
          const y2 = points[i + 3]

          const distance = distanceToSegment(worldX, worldY, x1, y1, x2, y2)
          if (distance <= threshold && distance < minDistance) {
            closest = {
              drawing,
              segmentIndex: i / 2, // Index of first point of this segment
              clickX: worldX,
              clickY: worldY
            }
            minDistance = distance
          }
        }

        // For areas, also check the closing segment (last point to first point)
        if (drawing.type === 'measurement_area' && points.length >= 6) {
          const x1 = points[points.length - 2]
          const y1 = points[points.length - 1]
          const x2 = points[0]
          const y2 = points[1]

          const distance = distanceToSegment(worldX, worldY, x1, y1, x2, y2)
          if (distance <= threshold && distance < minDistance) {
            closest = {
              drawing,
              segmentIndex: (points.length - 2) / 2, // Last point index (closing segment)
              clickX: worldX,
              clickY: worldY
            }
            minDistance = distance
          }
        }
      })

      return closest
    },
    [drawings]
  )

  // Get any measurement (line or area) at a point for selection
  const getMeasurementAtPoint = useCallback(
    (pageNumber: number, worldX: number, worldY: number): Drawing | null => {
      const threshold = 20
      
      // Helper: distance from point to line segment
      const distanceToSegment = (
        px: number, py: number,
        x1: number, y1: number,
        x2: number, y2: number
      ) => {
        const dx = x2 - x1
        const dy = y2 - y1
        if (dx === 0 && dy === 0) {
          return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2))
        }
        const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
        const clampedT = Math.max(0, Math.min(1, t))
        const closestX = x1 + clampedT * dx
        const closestY = y1 + clampedT * dy
        return Math.sqrt(Math.pow(px - closestX, 2) + Math.pow(py - closestY, 2))
      }
      
      // Helper: check if point is inside polygon
      const isPointInPolygon = (px: number, py: number, points: number[]) => {
        let inside = false
        const n = points.length / 2
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = points[i * 2], yi = points[i * 2 + 1]
          const xj = points[j * 2], yj = points[j * 2 + 1]
          
          if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside
          }
        }
        return inside
      }
      
      let closestMeasurement: Drawing | null = null
      let minDistance = Infinity
      
      drawings.forEach(drawing => {
        if (drawing.pageNumber !== pageNumber) return
        if (drawing.type !== 'measurement_line' && drawing.type !== 'measurement_area') return
        
        const points = drawing.geometry?.points
        if (!points || points.length < 4) return
        
        if (drawing.type === 'measurement_line') {
          // Check distance to any segment
          for (let i = 0; i < points.length - 2; i += 2) {
            const dist = distanceToSegment(
              worldX, worldY,
              points[i], points[i + 1],
              points[i + 2], points[i + 3]
            )
            if (dist < threshold && dist < minDistance) {
              minDistance = dist
              closestMeasurement = drawing
            }
          }
        } else if (drawing.type === 'measurement_area') {
          // Check if point is inside polygon or near edges
          if (isPointInPolygon(worldX, worldY, points)) {
            closestMeasurement = drawing
            minDistance = 0
          } else {
            // Check distance to edges
            for (let i = 0; i < points.length; i += 2) {
              const nextI = (i + 2) % points.length
              const dist = distanceToSegment(
                worldX, worldY,
                points[i], points[i + 1],
                points[nextI], points[nextI + 1]
              )
              if (dist < threshold && dist < minDistance) {
                minDistance = dist
                closestMeasurement = drawing
              }
            }
          }
        }
      })
      
      return closestMeasurement
    },
    [drawings]
  )

  const finalizeMeasurementFromDrawing = useCallback(
    (measurement: Drawing): Drawing | null => {
      const rawPoints = measurement.geometry?.points
      if (!rawPoints || rawPoints.length < 4) {
        return null
      }

      const sanitizedPoints = (() => {
        const cloned = [...rawPoints]
        if (cloned.length >= 4) {
          const lastX = cloned[cloned.length - 2]
          const lastY = cloned[cloned.length - 1]
          const prevX = cloned[cloned.length - 4]
          const prevY = cloned[cloned.length - 3]
          if (lastX === prevX && lastY === prevY) {
            cloned.splice(cloned.length - 2, 2)
          }
        }
        return cloned
      })()

      if (sanitizedPoints.length < 4) {
        return null
      }

      if (measurement.type === 'measurement_line') {
        const lineData = computeLineMeasurementData(sanitizedPoints, measurement.pageNumber)
        if (!lineData) {
          return null
        }
        return {
          ...measurement,
          geometry: {
            ...measurement.geometry,
            points: sanitizedPoints
          },
          measurements: lineData
        }
      }

      if (measurement.type === 'measurement_area') {
        if (sanitizedPoints.length < 6) {
          return null
        }

        const areaData = computeAreaMeasurementData(sanitizedPoints, measurement.pageNumber)
        if (!areaData) {
          return null
        }
        return {
          ...measurement,
          geometry: {
            ...measurement.geometry,
            points: sanitizedPoints
          },
          measurements: areaData
        }
      }

      return null
    },
    [computeAreaMeasurementData, computeLineMeasurementData]
  )

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = screenToWorld(screenX, screenY)
    // screenToWorld already returns base scale coordinates (zoom is handled by transform)
    const baseWorldX = world.x
    const baseWorldY = world.y
    // Use current page (since we're in paginated view)
    const pageNumber = currentPage

    // Check scale setting exists
    const scaleSetting = getScaleSetting(pageNumber)
    if ((selectedTool === 'measurement_line' || selectedTool === 'measurement_area') && !scaleSetting) {
      if (onOpenScaleSettings) {
        onOpenScaleSettings()
      }
      return
    }

      // Priority 1: Handle calibration mode (highest priority)
      if (isCalibrating) {
        // Handle calibration point clicks (store at base scale)
        if (calibrationPoints.length < 2) {
          const newPoints = [...calibrationPoints, { x: baseWorldX, y: baseWorldY }]
          setCalibrationPoints(newPoints)
          
          // Only reopen modal when we have exactly 2 points
          if (newPoints.length === 2) {
            // Set calibrating to false first
            setIsCalibrating(false)
            // Wait a bit longer for state to update, then reopen modal
            setTimeout(() => {
              if (onOpenScaleSettings) {
                onOpenScaleSettings()
              }
            }, 200)
          }
          // If we only have 1 point, don't do anything - keep modal closed and stay in calibration mode
        }
        return // Exit early - don't process other click handlers
      }
    
    // Priority 2: Check if clicking on an existing comment (current page only)
    const clickedComment = drawings.find(d => 
      d.type === 'comment' && d.pageNumber === pageNumber && isPointInComment(world.x, world.y, d)
    )
    
    if (clickedComment) {
      // Clicking on existing comment - show details
      setSelectedComment(clickedComment)
      setPopupPosition({ x: screenX, y: screenY })
      setShowCommentPopup(true)
      if (onCommentClick) {
        onCommentClick(clickedComment)
      }
    } else if (selectedTool === 'comment' && !isCalibrating) {
      // Place new comment pin (only if not calibrating)
      // Store coordinates at base scale (not zoomed)
      onCommentPinClick(baseWorldX, baseWorldY, pageNumber)
    } else if (selectedTool === 'measurement_edit') {
      // Priority 1: Check if clicking on a handle (vertex point) to drag it
      const existingHandle = getMeasurementHandleAtPoint(pageNumber, baseWorldX, baseWorldY)
      if (existingHandle && existingHandle.drawing.geometry?.points) {
        setEditingMeasurement({
          id: existingHandle.drawing.id,
          type: existingHandle.drawing.type,
          pageNumber: existingHandle.drawing.pageNumber,
          points: [...existingHandle.drawing.geometry.points],
          handleIndex: existingHandle.handleIndex
        })
        setIsAdjustingMeasurement(true)
        return
      }

      // Priority 2: Check if clicking on a segment/edge
      const segmentHit = getSegmentAtPoint(pageNumber, baseWorldX, baseWorldY)
      if (segmentHit && segmentHit.drawing.geometry?.points) {
        // If clicking on the currently selected shape's segment, add a new point
        if (editingMeasurement && editingMeasurement.id === segmentHit.drawing.id) {
          const points = [...editingMeasurement.points]
          const segmentIndex = segmentHit.segmentIndex
          
          // Insert new point after segmentIndex
          // For a segment from point[segmentIndex] to point[segmentIndex+1] (or point[0] for closing segment)
          const insertPosition = (segmentIndex + 1) * 2
          
          // For the closing segment of an area, we need to insert at the end (before wrapping to first)
          const isClosingSegment = segmentHit.drawing.type === 'measurement_area' && 
            segmentIndex === (points.length - 2) / 2
          
          if (isClosingSegment) {
            // Insert at the end of the points array
            points.push(baseWorldX, baseWorldY)
          } else {
            // Insert in the middle
            points.splice(insertPosition, 0, baseWorldX, baseWorldY)
          }
          
          // Update the editing measurement with new point and start dragging it
          const newHandleIndex = isClosingSegment ? (points.length - 2) / 2 : segmentIndex + 1
          setEditingMeasurement({
            ...editingMeasurement,
            points,
            handleIndex: newHandleIndex
          })
          setIsAdjustingMeasurement(true)
          return
        }
        
        // Clicking on a different shape's segment - select it
        setEditingMeasurement({
          id: segmentHit.drawing.id,
          type: segmentHit.drawing.type,
          pageNumber: segmentHit.drawing.pageNumber,
          points: [...segmentHit.drawing.geometry.points],
          handleIndex: segmentHit.segmentIndex
        })
        setIsAdjustingMeasurement(false)
        return
      }

      // Priority 3: Check if clicking inside an area shape (for selection/deletion)
      const clickedMeasurement = getMeasurementAtPoint(pageNumber, baseWorldX, baseWorldY)
      if (clickedMeasurement && clickedMeasurement.geometry?.points) {
        setEditingMeasurement({
          id: clickedMeasurement.id,
          type: clickedMeasurement.type,
          pageNumber: clickedMeasurement.pageNumber,
          points: [...clickedMeasurement.geometry.points],
          handleIndex: 0 // Default to first handle
        })
        setIsAdjustingMeasurement(false)
      } else {
        // Clicked on empty space - deselect
        setEditingMeasurement(null)
        setIsAdjustingMeasurement(false)
      }
    } else if (selectedTool === 'measurement_line' || selectedTool === 'measurement_area') {
      // Start or continue measurement drawing
      if (!currentMeasurement || !isDrawingMeasurement) {
        // Start new measurement (store at base scale)
        const newMeasurement: Drawing = {
          id: Date.now().toString(),
          type: selectedTool,
          geometry: {
            points: [baseWorldX, baseWorldY, baseWorldX, baseWorldY]
          },
          style: {
            color: '#3b82f6',
            strokeWidth: 2,
            opacity: 1
          },
          pageNumber,
          measurements: {
            unit: scaleSetting?.unit || 'ft'
          }
        }
        setCurrentMeasurement(newMeasurement)
        setIsDrawingMeasurement(true)
      } else {
        // Add point to existing measurement (store at base scale)
        const existingPoints = currentMeasurement.geometry.points || []
        if (existingPoints.length < 2) {
          return
        }

        // For area measurements with 3+ points, check if clicking near start point to close the shape
        if (selectedTool === 'measurement_area' && existingPoints.length >= 6) {
          const startX = existingPoints[0]
          const startY = existingPoints[1]
          const distToStart = calculatePixelDistance(baseWorldX, baseWorldY, startX, startY)
          
          if (distToStart <= SNAP_TO_CLOSE_THRESHOLD) {
            // Snap to start point and finalize the measurement
            const updatedPoints = [...existingPoints]
            const lastIndex = updatedPoints.length - 2
            // Set the last preview point to the start point (closing the shape)
            updatedPoints[lastIndex] = startX
            updatedPoints[lastIndex + 1] = startY
            
            const closedMeasurement: Drawing = {
              ...currentMeasurement,
              geometry: {
                ...currentMeasurement.geometry,
                points: updatedPoints
              }
            }
            
            // Finalize the closed measurement
            const finalized = finalizeMeasurementFromDrawing(closedMeasurement)
            if (finalized) {
              onDrawingsChange([...drawings, finalized])
            }
            
            setCurrentMeasurement(null)
            setIsDrawingMeasurement(false)
            setIsSnappingToStart(false)
            return
          }
        }

        const updatedPoints = [...existingPoints]
        const lastIndex = updatedPoints.length - 2
        updatedPoints[lastIndex] = baseWorldX
        updatedPoints[lastIndex + 1] = baseWorldY
        updatedPoints.push(baseWorldX, baseWorldY)

        const updatedMeasurement: Drawing = {
          ...currentMeasurement,
          geometry: {
            ...currentMeasurement.geometry,
            points: updatedPoints
          }
        }

        setCurrentMeasurement(updatedMeasurement)
        // Line measurement now works like area: click to add points, double-click to finalize
      }
    } else if (selectedTool === 'measurement_select') {
      // Find measurement at click point
      const clickedMeasurement = getMeasurementAtPoint(pageNumber, baseWorldX, baseWorldY)
      
      if (clickedMeasurement && onSelectedMeasurementsChange && selectedMeasurementIds) {
        const newSelection = new Set(selectedMeasurementIds)
        
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          // Toggle selection with modifier key
          if (newSelection.has(clickedMeasurement.id)) {
            newSelection.delete(clickedMeasurement.id)
          } else {
            newSelection.add(clickedMeasurement.id)
          }
        } else {
          // Replace selection without modifier
          newSelection.clear()
          newSelection.add(clickedMeasurement.id)
        }
        
        onSelectedMeasurementsChange(newSelection)
      } else if (clickedMeasurement && onSelectedMeasurementsChange) {
        // No existing selection, start new one
        onSelectedMeasurementsChange(new Set([clickedMeasurement.id]))
      } else if (!clickedMeasurement && onSelectedMeasurementsChange && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
        // Clicked on empty space without modifier - clear selection
        onSelectedMeasurementsChange(new Set())
      }
    } else if (selectedTool === 'none') {
      // Start panning
      setIsPanning(true)
      setLastPanPoint({ x: screenX, y: screenY })
    }
  }, [selectedTool, screenToWorld, getPageNumber, onCommentPinClick, drawings, onDrawingsChange, isPointInComment, onCommentClick, currentMeasurement, isDrawingMeasurement, getScaleSetting, onOpenScaleSettings, isCalibrating, calibrationPoints, setCalibrationPoints, getMeasurementHandleAtPoint, getMeasurementSegmentAtPoint, getSegmentAtPoint, getMeasurementAtPoint, finalizeMeasurementFromDrawing, selectedMeasurementIds, onSelectedMeasurementsChange, editingMeasurement])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top

      // Pan the viewport
      setViewport(prev => ({
        ...prev,
        panX: prev.panX + (screenX - lastPanPoint.x),
        panY: prev.panY + (screenY - lastPanPoint.y)
      }))
      setLastPanPoint({ x: screenX, y: screenY })
    } else if (selectedTool === 'measurement_edit' && editingMeasurement && isAdjustingMeasurement) {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const world = screenToWorld(screenX, screenY)
      const baseWorldX = world.x
      const baseWorldY = world.y

      const handleIndex = editingMeasurement.handleIndex
      const updatedPoints = [...editingMeasurement.points]

      const pointXIndex = handleIndex * 2
      const pointYIndex = pointXIndex + 1
      if (pointYIndex >= updatedPoints.length) {
        return
      }

      updatedPoints[pointXIndex] = baseWorldX
      updatedPoints[pointYIndex] = baseWorldY

      setEditingMeasurement(prev =>
        prev
          ? {
              ...prev,
              points: updatedPoints
            }
          : prev
      )
    } else if (isDrawingMeasurement && currentMeasurement) {
      // Update preview point for measurement
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const world = screenToWorld(screenX, screenY)
      
      // screenToWorld already returns base scale coordinates (zoom is handled by transform)
      let baseWorldX = world.x
      let baseWorldY = world.y
      
      // Update last point in measurement for preview (store at base scale)
      const points = currentMeasurement.geometry.points || []
      if (points.length >= 2) {
        // For area measurements with 3+ points, check if near start point to snap
        if (currentMeasurement.type === 'measurement_area' && points.length >= 6) {
          const startX = points[0]
          const startY = points[1]
          const distToStart = calculatePixelDistance(baseWorldX, baseWorldY, startX, startY)
          
          if (distToStart <= SNAP_TO_CLOSE_THRESHOLD) {
            // Snap to start point
            baseWorldX = startX
            baseWorldY = startY
            setIsSnappingToStart(true)
          } else {
            setIsSnappingToStart(false)
          }
        } else {
          setIsSnappingToStart(false)
        }
        
        const updatedPoints = [...points]
        updatedPoints[updatedPoints.length - 2] = baseWorldX
        updatedPoints[updatedPoints.length - 1] = baseWorldY
        setCurrentMeasurement({
          ...currentMeasurement,
          geometry: {
            ...currentMeasurement.geometry,
            points: updatedPoints
          }
        })
      }
    }
    
    // Always check for measurement hover (unless actively panning or drawing)
    // This runs regardless of tool selection to enable hover labels
    if (!isPanning && !isDrawingMeasurement && !isAdjustingMeasurement) {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const screenX = e.clientX - rect.left
        const screenY = e.clientY - rect.top
        const world = screenToWorld(screenX, screenY)
        
        const hoveredMeasurement = getMeasurementAtPoint(currentPage, world.x, world.y)
        setHoveredMeasurementId(hoveredMeasurement?.id || null)
      }
    } else if (isPanning || isDrawingMeasurement) {
      // Clear hover when panning or drawing
      setHoveredMeasurementId(null)
    }
    // Comment hover detection is now handled by HTML elements via onMouseEnter/onMouseLeave
  }, [isPanning, lastPanPoint, screenToWorld, isDrawingMeasurement, currentMeasurement, selectedTool, editingMeasurement, isAdjustingMeasurement, currentPage, getMeasurementAtPoint])

  const finalizeEditingMeasurement = useCallback(() => {
    if (!editingMeasurement) {
      return
    }

    const { id, points, pageNumber, type } = editingMeasurement

    let hasUpdate = false
    const nextDrawings = drawings.map(drawing => {
      if (drawing.id !== id) {
        return drawing
      }

      hasUpdate = true
      const updatedGeometry = {
        ...drawing.geometry,
        points: [...points]
      }

      if (type === 'measurement_line') {
        const lineData = computeLineMeasurementData(points, pageNumber)
        return {
          ...drawing,
          geometry: updatedGeometry,
          measurements: lineData
            ? {
                ...lineData
              }
            : drawing.measurements
        }
      }

      if (type === 'measurement_area') {
        const areaData = computeAreaMeasurementData(points, pageNumber)
        return {
          ...drawing,
          geometry: updatedGeometry,
          measurements: areaData
            ? {
                ...areaData
              }
            : drawing.measurements
        }
      }

      return {
        ...drawing,
        geometry: updatedGeometry
      }
    })

    if (hasUpdate) {
      onDrawingsChange(nextDrawings)
    }

    setEditingMeasurement(null)
    setIsAdjustingMeasurement(false)
  }, [editingMeasurement, drawings, onDrawingsChange, computeLineMeasurementData, computeAreaMeasurementData])

  const deleteMeasurement = useCallback(
    (id: string) => {
      const nextDrawings = drawings.filter(drawing => {
        if (drawing.type === 'measurement_line' || drawing.type === 'measurement_area') {
          return drawing.id !== id
        }
        return true
      })

      if (nextDrawings.length === drawings.length) {
        return
      }

      onDrawingsChange(nextDrawings)
      setEditingMeasurement(null)
      setIsAdjustingMeasurement(false)
    },
    [drawings, onDrawingsChange]
  )

  useEffect(() => {
    if (selectedTool !== 'measurement_edit') {
      setEditingMeasurement(null)
      setIsAdjustingMeasurement(false)
    }
  }, [selectedTool])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
    }

    if (isAdjustingMeasurement && editingMeasurement) {
      finalizeEditingMeasurement()
    }
    // For new measurements, finalize on double-click or right-click will be handled separately
  }, [isPanning, isAdjustingMeasurement, editingMeasurement, finalizeEditingMeasurement])

  // Finalize measurement (calculate and save)
  const finalizeMeasurement = useCallback(() => {
    if (!currentMeasurement || !isDrawingMeasurement) return

    const finalized = finalizeMeasurementFromDrawing(currentMeasurement)
    if (finalized) {
      onDrawingsChange([...drawings, finalized])
    }

    setCurrentMeasurement(null)
    setIsDrawingMeasurement(false)
    setIsSnappingToStart(false)
  }, [currentMeasurement, isDrawingMeasurement, finalizeMeasurementFromDrawing, drawings, onDrawingsChange])

  // Handle double-click to finish measurement
  const handleDoubleClick = useCallback(() => {
    if (isDrawingMeasurement) {
      finalizeMeasurement()
    }
  }, [isDrawingMeasurement, finalizeMeasurement])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.key === 'm' || e.key === 'M') {
        if (isDrawingMeasurement) {
          finalizeMeasurement()
        }
        setSelectedTool('measurement_line')
        e.preventDefault()
      } else if (e.key === 'a' || e.key === 'A') {
        if (isDrawingMeasurement) {
          finalizeMeasurement()
        }
        setSelectedTool('measurement_area')
        e.preventDefault()
      } else if (e.key === 'e' || e.key === 'E') {
        if (isDrawingMeasurement) {
          finalizeMeasurement()
        }
        setCurrentMeasurement(null)
        setIsDrawingMeasurement(false)
        setIsSnappingToStart(false)
        setSelectedTool('measurement_edit')
        e.preventDefault()
      } else if (e.key === 's' || e.key === 'S') {
        // Ignore if typing in an input or pressing Ctrl/Cmd+S (save)
        if (e.ctrlKey || e.metaKey) return
        if (isDrawingMeasurement) {
          finalizeMeasurement()
        }
        setCurrentMeasurement(null)
        setIsDrawingMeasurement(false)
        setIsSnappingToStart(false)
        setSelectedTool('measurement_select')
        e.preventDefault()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTool === 'measurement_edit' && editingMeasurement) {
        e.preventDefault()
        deleteMeasurement(editingMeasurement.id)
      } else if (e.key === 'Escape') {
        if (isDrawingMeasurement) {
          // Finalize the measurement if it has enough points, otherwise just clear
          finalizeMeasurement()
          setSelectedTool('none')
        } else if (selectedTool === 'measurement_edit') {
          setEditingMeasurement(null)
          setIsAdjustingMeasurement(false)
          setSelectedTool('none')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawingMeasurement, finalizeMeasurement, selectedTool, editingMeasurement, deleteMeasurement])

  const handleMouseLeave = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
    }
    if (isAdjustingMeasurement && editingMeasurement) {
      finalizeEditingMeasurement()
    }
    setHoveredComment(null)
  }, [isPanning, isAdjustingMeasurement, editingMeasurement, finalizeEditingMeasurement])

  // Zoom controls
  const handleZoomIn = () => {
    setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 5) }))
  }

  const handleZoomOut = () => {
    setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.1) }))
  }

  // Don't block rendering - show the PDF viewer even if it's still loading
  // The Document component will handle its own loading state

  return (
    <div className="relative h-full w-full bg-gray-100 overflow-hidden">
      {/* Canvas Container - Now fills the whole space */}
      <div 
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        style={{ 
          cursor: hoveredComment ? 'pointer' :
                 isCalibrating ? 'crosshair' :
                 selectedTool === 'none' ? (isPanning ? 'grabbing' : 'grab') : 
                 selectedTool === 'measurement_select' ? 'pointer' :
                 (selectedTool === 'comment' || selectedTool === 'measurement_line' || selectedTool === 'measurement_area') ? 'crosshair' : 'default'
        }}
      >
        {/* Scale Indicator - Floating Top Left */}
        {(() => {
          const scaleSetting = getScaleSetting(currentPage)
          if (!scaleSetting) {
            // Only log if we have settings loaded but none for this page
            if (measurementScaleSettings && Object.keys(measurementScaleSettings).length > 0) {
              console.log('Scale indicator: No setting for current page', {
                currentPage,
                availablePages: Object.keys(measurementScaleSettings).map(k => Number(k)).filter(k => !isNaN(k)),
                allKeys: Object.keys(measurementScaleSettings)
              })
            }
          }
          return scaleSetting
        })() ? (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-md shadow-lg border border-gray-200 z-20 pointer-events-none">
            <div className="text-xs font-semibold text-gray-700">
              Scale: {getScaleSetting(currentPage)?.ratio}
            </div>
            <div className="text-xs text-gray-500">
              {getScaleSetting(currentPage)?.unit}
            </div>
          </div>
        ) : (
          <div className="absolute top-4 left-4 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-md shadow-lg z-20 pointer-events-auto">
            <div className="text-xs font-semibold text-yellow-700 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              Scale not set
            </div>
            <button
              onClick={() => onOpenScaleSettings?.()}
              className="text-xs text-yellow-600 hover:text-yellow-800 underline mt-1"
            >
              Click to set scale
            </button>
          </div>
        )}

        {/* PDF Page - Paginated view (single page) */}
        {!pdfError && pdfUrl && documentReady && workerReady ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
              transformOrigin: 'center center',
              willChange: 'transform',
              pointerEvents: 'none', // Let drawing canvas handle interactions
            }}
          >
            <Document
              key={`document-${pdfUrl}`}
              file={pdfUrl}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading PDF...</p>
                  </div>
                </div>
              }
              error={(error: Error) => {
                console.error('Document loading error:', error)
                return (
                  <div className="p-8 text-center text-red-600">
                    <p className="font-medium mb-2">Failed to load PDF</p>
                    <p className="text-sm text-gray-600">You can still use drawing tools on a blank canvas</p>
                  </div>
                )
              }}
              onLoadSuccess={(pdf: { numPages: number }) => {
                // Guard against state updates after unmount
                if (!componentIsMounted.current) return
                
                // Document component's internal PDF is now fully loaded and ready
                // Increment instance ID to ensure stale page renders don't try to access destroyed document
                documentInstanceId.current += 1
                console.log('PDF Document component loaded successfully, pages:', pdf.numPages, 'instance:', documentInstanceId.current)
                
                // Get page count from the Document component's PDF instance
                // This avoids loading the PDF twice and prevents worker state conflicts
                const loadedPages = pdf.numPages
                setNumPages(loadedPages)
                if (onNumPagesChange) {
                  onNumPagesChange(loadedPages)
                }
                setPdfLoaded(true)
                setPdfError(null)
                setDocumentComponentReady(true)
              }}
              onLoadError={(error: Error) => {
                // Check for PDF.js cleanup errors (harmless)
                if (error.message?.includes('messageHandler') || error.message?.includes('sendWithPromise')) {
                  console.debug('PDF Document cleanup error (harmless during navigation)')
                  return
                }
                // Guard against state updates after unmount
                if (!componentIsMounted.current) return
                
                console.error('PDF Document load error:', error)
                setPdfError('Failed to load PDF document. You can still use drawing tools on a blank canvas.')
                setPdfLoaded(true) // Still allow drawing tools
              }}
            >
              <div 
                className="relative shadow-lg bg-white" 
                data-page-num={currentPage} 
                style={{ 
                  width: `${pageDimensions.get(currentPage)?.width || (PDF_BASE_WIDTH * scale)}px`,
                  backgroundColor: 'white',
                  // Ensure exact positioning to match drawing canvas
                  margin: '0 auto',
                  display: 'block',
                  position: 'relative',
                  flexShrink: 0,
                  // Prevent canvas overflow during quality transitions
                  overflow: 'hidden',
                }}
              >
                {/* Show loading state while Document component initializes its PDF */}
                {!documentComponentReady && (
                  <div 
                    className="flex items-center justify-center bg-white"
                    style={{ 
                      width: `${pageDimensions.get(currentPage)?.width || (PDF_BASE_WIDTH * scale)}px`,
                      minHeight: `${pageDimensions.get(currentPage)?.height || (PDF_BASE_WIDTH * scale * 1.3)}px`,
                    }}
                  >
                    <div className="text-center text-gray-400 text-sm">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Preparing page...
                    </div>
                  </div>
                )}
                {/* Render current page + prefetch adjacent pages - only when Document is ready */}
                {documentComponentReady && numPages > 0 && Array.from(new Set([currentPage, ...Array.from(pagesToRender)]))
                  .filter(pageNum => pageNum >= 1 && pageNum <= numPages)
                  .map(pageNum => {
                  const isCurrentPage = pageNum === currentPage
                  
                  return (
                    <div 
                      key={`page-container-${documentInstanceId.current}-${pageNum}`}
                      style={{ 
                        display: isCurrentPage ? 'block' : 'none',
                        position: isCurrentPage ? 'relative' : 'absolute',
                        visibility: isCurrentPage ? 'visible' : 'hidden',
                        pointerEvents: isCurrentPage ? 'auto' : 'none',
                      }}
                    >
                      <PageErrorBoundary 
                        pageNumber={pageNum}
                        fallback={isCurrentPage ? (
                          <div className="bg-white flex items-center justify-center text-gray-400 text-sm p-4" style={{ width: `${pageDimensions.get(pageNum)?.width || (PDF_BASE_WIDTH * scale)}px`, minHeight: '200px', backgroundColor: 'white' }}>
                            Reloading page {pageNum}...
                          </div>
                        ) : null}
                      >
                        <Page
                          key={`page-${documentInstanceId.current}-${pageNum}`}
                          pageNumber={pageNum}
                          scale={isCurrentPage ? pageScale : scale * 1.5}
                          width={612}
                          renderTextLayer={isCurrentPage && shouldRenderTextLayer}
                          renderAnnotationLayer={false}
                          className="shadow-lg relative"
                          style={{ 
                            display: 'block', 
                            position: 'relative', 
                            zIndex: 1,
                            width: `${pageDimensions.get(pageNum)?.width || (PDF_BASE_WIDTH * scale)}px`,
                            height: 'auto',
                            backgroundColor: 'white',
                          }}
                          loading={isCurrentPage ? (
                            <div className="bg-white flex items-center justify-center text-gray-400 text-sm" style={{ width: `${pageDimensions.get(pageNum)?.width || (PDF_BASE_WIDTH * scale)}px`, backgroundColor: 'white' }}>
                              Loading page {pageNum}...
                            </div>
                          ) : null}
                          onLoadSuccess={(page: { height: number; width: number }) => {
                            // Guard against state updates after unmount
                            if (!componentIsMounted.current) return
                            // Calculate dimensions based on constrained width (612) and PDF aspect ratio
                            // react-pdf scales the PDF to fit the specified width, so we use that as base
                            const baseWidth = 612
                            const aspectRatio = page.height / page.width
                            const scaledWidth = baseWidth * scale
                            const scaledHeight = baseWidth * aspectRatio * scale
                            setPageDimensions((prev: Map<number, { width: number; height: number }>) => {
                              const newDimensions = new Map(prev)
                              newDimensions.set(pageNum, { width: scaledWidth, height: scaledHeight })
                              return newDimensions
                            })
                          }}
                          onLoadError={(error: Error) => {
                            // Ignore errors for destroyed documents (messageHandler null)
                            // This happens during rapid page changes or document reload
                            if (error.message?.includes('messageHandler') || error.message?.includes('sendWithPromise')) {
                              console.debug(`Page ${pageNum} load skipped - document was destroyed (normal during navigation)`)
                              return
                            }
                            if (isCurrentPage) {
                              console.error(`Error loading page ${pageNum}:`, error)
                            }
                          }}
                          onRenderError={(error: Error) => {
                            if (!isCurrentPage) return // Ignore errors on prefetched pages
                            // Silently handle PDF.js cleanup errors
                            if (error.message?.includes('messageHandler') || error.message?.includes('worker') || error.message?.includes('sendWithPromise')) {
                              console.debug('PDF.js worker cleanup error (harmless during navigation)')
                              // Cancel quality upgrade and stay at low quality
                              if (qualityUpgradeTimeoutRef.current) {
                                clearTimeout(qualityUpgradeTimeoutRef.current)
                              }
                              // If we're at high quality, fall back to low
                              if (renderQuality === 'high' && componentIsMounted.current) {
                                setRenderQuality('low')
                              }
                              return
                            }
                            console.error(`Error rendering page ${pageNum}:`, error)
                          }}
                          onRenderSuccess={() => {
                            if (!isCurrentPage) return // Skip post-render processing for prefetched pages
                            if (!componentIsMounted.current) return // Guard against updates after unmount
                            // Ensure canvas quality settings are applied for crisp rendering
                            // IMPORTANT: Apply immediately (no delay) to prevent drawing misalignment during quality transitions
                            if (typeof window !== 'undefined') {
                              // Use requestAnimationFrame for immediate but safe DOM update
                              requestAnimationFrame(() => {
                                if (!componentIsMounted.current) return
                                const pageContainer = document.querySelector(`[data-page-num="${currentPage}"]`) as HTMLElement
                                if (pageContainer) {
                                  // Ensure container has white background
                                  pageContainer.style.backgroundColor = 'white'
                                  
                                  const canvas = pageContainer.querySelector('canvas') as HTMLCanvasElement
                                  if (canvas) {
                                    // Canvas is rendered at high resolution (scale * zoom * devicePixelRatio)
                                    // but MUST be displayed at base size to match drawing canvas exactly
                                    // CSS transform handles visual zoom, keeping coordinate systems aligned
                                    // CRITICAL: Set width FIRST before any other operations to prevent misalignment
                                    const dims = pageDimensions.get(currentPage)
                                    const baseDisplayWidth = dims?.width || (PDF_BASE_WIDTH * scale)
                                    // Force exact width to match drawing canvas exactly - critical for alignment
                                    canvas.style.width = `${baseDisplayWidth}px`
                                    canvas.style.height = 'auto'
                                    canvas.style.maxWidth = `${baseDisplayWidth}px`
                                    canvas.style.minWidth = `${baseDisplayWidth}px`
                                    // Ensure no transforms are applied to canvas element itself
                                    canvas.style.transform = 'none'
                                    canvas.style.objectFit = 'contain'
                                    canvas.style.backgroundColor = 'white'
                                    // Use high-quality rendering for better appearance when zoomed
                                    canvas.style.imageRendering = 'auto'
                                    
                                    const ctx = canvas.getContext('2d', { willReadFrequently: false })
                                    if (ctx) {
                                      // Fill canvas with white background behind PDF content
                                      // This ensures any transparent areas show white instead of showing through
                                      // Using destination-over to draw white behind existing content
                                      const originalComposite = ctx.globalCompositeOperation
                                      ctx.globalCompositeOperation = 'destination-over'
                                      ctx.fillStyle = 'white'
                                      ctx.fillRect(0, 0, canvas.width, canvas.height)
                                      ctx.globalCompositeOperation = originalComposite
                                      
                                      // Enable image smoothing for better quality when zoomed
                                      // The high-resolution render combined with smoothing gives best results
                                      ctx.imageSmoothingEnabled = true
                                      ctx.imageSmoothingQuality = 'high'
                                    }
                                  }
                                }
                              })
                            }
                          }}
                        />
                      </PageErrorBoundary>
                    </div>
                  )
                })}
              </div>
            </Document>
          </div>
        ) : (
          !pdfError && pdfUrl && (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {!workerReady ? 'Initializing PDF viewer...' : !pdfLoaded ? 'Loading PDF...' : 'Preparing pages...'}
                </p>
              </div>
            </div>
          )
        )}


        {/* Fallback Drawing Area - Show when PDF fails */}
        {pdfError && (
          <div
            className="absolute"
            style={{
              transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <div className="w-[800px] h-[600px] bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                <h3 className="text-lg font-medium mb-2">PDF Not Available</h3>
                <p className="text-sm">You can still use drawing tools on this blank canvas</p>
              </div>
            </div>
          </div>
        )}

        {/* Drawing Canvas Overlay - single page */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ 
            pointerEvents: 'auto',
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
            transformOrigin: 'center center',
            width: '100%',
            height: '100%',
            display: !pdfError ? 'flex' : 'none',
            zIndex: 10, // Ensure it's above PDF canvas elements
            // Ensure perfect alignment with PDF container
            alignItems: 'center',
            justifyContent: 'center'
          }}
          // Events already attached to container, removed here to avoid duplication/bubbling issues
        >
          <canvas
            ref={drawingCanvasRef}
            style={{ 
              display: 'block',
              position: 'relative',
              backgroundColor: 'transparent',
              // Ensure pixel-perfect alignment
              margin: '0',
              padding: '0',
              verticalAlign: 'top',
              // Ensure canvas is visible and above PDF
              zIndex: 11,
              visibility: 'visible',
              opacity: 1,
              pointerEvents: 'auto'
            }}
          />
          
          {/* Comment Bubbles - HTML elements that automatically follow CSS transforms */}
          {(() => {
            const currentPageComments = drawings.filter(d => d.type === 'comment' && d.pageNumber === currentPage)
            const dims = pageDimensions.get(currentPage)
            const pageWidth = dims?.width || (PDF_BASE_WIDTH * scale)
            const pageHeight = dims?.height || (PDF_BASE_HEIGHT * scale)
            
            return (
              <div 
                style={{ 
                  position: 'absolute',
                  zIndex: 12,
                  width: `${pageWidth}px`,
                  height: `${pageHeight}px`,
                  // Position to overlay canvas exactly - canvas is centered by flex parent
                  // Use absolute positioning with centering to match canvas position
                  left: '50%',
                  top: '50%',
                  marginLeft: `-${pageWidth / 2}px`,
                  marginTop: `-${pageHeight / 2}px`,
                  pointerEvents: 'none' // Container doesn't capture events, but children will
                }}
              >
                {currentPageComments.map((comment) => {
                  // Check if geometry has valid x and y values
                  if (!comment.geometry || typeof comment.geometry.x === 'undefined' || typeof comment.geometry.y === 'undefined') {
                    return null
                  }
                  
                  return (
                    <CommentBubble
                      key={comment.id}
                      comment={comment}
                      isSelected={selectedComment?.id === comment.id}
                      isHovered={hoveredComment?.id === comment.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        const container = containerRef.current
                        if (!container) return
                        
                        const rect = container.getBoundingClientRect()
                        const screenX = e.clientX - rect.left
                        const screenY = e.clientY - rect.top
                        
                        setSelectedComment(comment)
                        setPopupPosition({ x: screenX, y: screenY })
                        setShowCommentPopup(true)
                        if (onCommentClick) {
                          onCommentClick(comment)
                        }
                      }}
                      onMouseEnter={() => setHoveredComment(comment)}
                      onMouseLeave={() => setHoveredComment(null)}
                    />
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Comment Popup */}
        {showCommentPopup && selectedComment && (
          <CommentPopup
            comment={selectedComment}
            position={popupPosition}
            onClose={() => {
              setShowCommentPopup(false)
              setSelectedComment(null)
            }}
          />
        )}
      </div>

      {/* Floating UI Elements */}

      {/* Top Right: Right Sidebar Toggle & Error */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {/* PDF Error */}
        {pdfError && (
          <div className="pointer-events-auto flex items-center space-x-2 px-3 py-2 bg-red-100 border border-red-200 text-red-700 rounded-md shadow-sm text-sm mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{pdfError}</span>
          </div>
        )}
        
        {/* Right Sidebar Toggle */}
        <div className="pointer-events-auto">
          <Button
            variant="secondary"
            size="icon"
            onClick={onRightSidebarToggle}
            className="h-10 w-10 rounded-full shadow-md bg-white/90 hover:bg-white backdrop-blur-sm border border-gray-200"
            title="Toggle Details Panel"
          >
            {rightSidebarOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <PanelRightOpen className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Bottom Center: Tools Dock */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto">
        <div className="flex items-center gap-1 p-2 bg-white/90 backdrop-blur-md border border-gray-200 shadow-xl rounded-full">
          {/* Pan */}
           <Button 
             variant={selectedTool === 'none' ? 'default' : 'ghost'} 
             size="icon" 
             onClick={() => {
                if (isDrawingMeasurement) {
                  finalizeMeasurement()
                }
                setSelectedTool('none')
             }}
             title="Pan (P)"
             className="rounded-full h-10 w-10"
           >
             <Hand className="h-5 w-5" />
           </Button>
           
           <div className="w-px h-6 bg-gray-200 mx-1" />
           
           {/* Comment */}
           <Button 
             variant={selectedTool === 'comment' ? 'default' : 'ghost'}
             size="icon"
             onClick={() => setSelectedTool('comment')}
             title="Add Comment (C)"
             className="rounded-full h-10 w-10"
           >
             <MessageSquare className="h-5 w-5" />
           </Button>
           
           <div className="w-px h-6 bg-gray-200 mx-1" />
           
           {/* Measurements */}
           <Button 
             variant={selectedTool === 'measurement_line' ? 'default' : 'ghost'}
             size="icon"
             onClick={() => {
                if (isDrawingMeasurement) {
                  finalizeMeasurement()
                }
                setSelectedTool('measurement_line')
             }}
             title="Measure Line (M) - Click to add points, double-click to finish"
             className="rounded-full h-10 w-10"
           >
             <Ruler className="h-5 w-5" />
           </Button>
           <Button 
             variant={selectedTool === 'measurement_area' ? 'default' : 'ghost'}
             size="icon"
             onClick={() => {
                if (isDrawingMeasurement) {
                  finalizeMeasurement()
                }
                setSelectedTool('measurement_area')
             }}
             title="Measure Area (A)"
             className="rounded-full h-10 w-10"
           >
             <Square className="h-5 w-5" />
           </Button>
           <Button 
             variant={selectedTool === 'measurement_edit' ? 'default' : 'ghost'}
             size="icon"
             onClick={() => {
                if (isDrawingMeasurement) {
                  finalizeMeasurement()
                }
                setCurrentMeasurement(null)
                setIsDrawingMeasurement(false)
                setSelectedTool('measurement_edit')
             }}
             title="Edit Measurements (E)"
             className="rounded-full h-10 w-10"
           >
             <Move className="h-5 w-5" />
           </Button>
           <Button 
             variant={selectedTool === 'measurement_select' ? 'default' : 'ghost'}
             size="icon"
             onClick={() => {
                if (isDrawingMeasurement) {
                  finalizeMeasurement()
                }
                setCurrentMeasurement(null)
                setIsDrawingMeasurement(false)
                setSelectedTool('measurement_select')
             }}
             title="Select Measurements (S)"
             className="rounded-full h-10 w-10"
           >
             <MousePointerClick className="h-5 w-5" />
           </Button>
        </div>
      </div>

      {/* Bottom Right: Navigation & Zoom */}
      <div className="absolute bottom-8 right-8 z-50 flex flex-col items-end gap-3 pointer-events-none">
         {/* Zoom Controls */}
         <div className="pointer-events-auto flex items-center gap-1 bg-white/90 backdrop-blur-md border border-gray-200 shadow-lg rounded-full p-1.5">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 rounded-full hover:bg-gray-100" title="Zoom Out"><ZoomOut className="h-4 w-4" /></Button>
            <span className="text-xs font-medium w-12 text-center select-none">{Math.round(viewport.zoom * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 rounded-full hover:bg-gray-100" title="Zoom In"><ZoomIn className="h-4 w-4" /></Button>
            
            {/* Scale Settings Button */}
             <div className="w-px h-4 bg-gray-200 mx-1" />
             <Button variant="ghost" size="icon" onClick={onOpenScaleSettings} className="h-8 w-8 rounded-full hover:bg-gray-100" title="Scale Settings"><Settings className="h-4 w-4" /></Button>
         </div>

         {/* Page Nav */}
         {numPages > 1 && (
           <div className="pointer-events-auto flex items-center gap-1 bg-white/90 backdrop-blur-md border border-gray-200 shadow-lg rounded-full p-1.5">
             <Button 
               variant="ghost" 
               size="icon" 
               onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1)
                    setViewport(prev => ({ ...prev, panX: 0, panY: 0 }))
                  }
               }}
               disabled={currentPage <= 1}
               className="h-8 w-8 rounded-full hover:bg-gray-100"
             >
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <form
                onSubmit={handlePageInputFormSubmit}
                className="flex items-center justify-center"
                noValidate
              >
                <Input
                  value={pageInputValue}
                  onChange={handlePageInputChange}
                  onBlur={handlePageInputBlur}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label="Go to page"
                  className="h-7 w-12 text-center p-0 border-none bg-transparent focus-visible:ring-0 text-sm font-medium"
                />
                <span className="text-xs text-gray-500 mr-2 select-none">/ {numPages}</span>
              </form>
             <Button 
               variant="ghost" 
               size="icon" 
               onClick={() => {
                  if (currentPage < numPages) {
                    setCurrentPage(currentPage + 1)
                    setViewport(prev => ({ ...prev, panX: 0, panY: 0 }))
                  }
               }}
               disabled={currentPage >= numPages}
               className="h-8 w-8 rounded-full hover:bg-gray-100"
             >
               <ChevronRight className="h-4 w-4" />
             </Button>
           </div>
         )}
      </div>
      
      {/* Measurement Edit Overlay (Floating Bottom Left, pushed up slightly) */}
      {selectedTool === 'measurement_edit' && editingMeasurement && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-[60] pointer-events-auto">
          <div className="rounded-full border border-gray-200 bg-white/95 shadow-lg backdrop-blur px-4 py-2 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="font-medium">Editing</span>
              <span className="text-gray-400">|</span>
              <span className="text-xs">Drag points to adjust • Click edge to add point</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs rounded-full px-3"
                onClick={() => deleteMeasurement(editingMeasurement.id)}
              >
                <Trash2 className="h-3 w-3 mr-1.5" />
                Delete
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs rounded-full px-3"
                onClick={() => {
                  setEditingMeasurement(null)
                  setIsAdjustingMeasurement(false)
                  setSelectedTool('none')
                }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
