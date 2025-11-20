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
  PanelRightClose
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

// Inject styles to ensure react-pdf canvas is visible
if (typeof window !== 'undefined') {
  // Check if styles already injected
  if (!document.getElementById('react-pdf-canvas-fix')) {
    const style = document.createElement('style')
    style.id = 'react-pdf-canvas-fix'
    style.textContent = `
      .react-pdf__Page__canvas {
        display: block !important;
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

// Helper functions for measurements (pure functions, can be outside component)
const calculatePixelDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}

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
}

type DrawingTool = 'comment' | 'none' | 'measurement_line' | 'measurement_area' | 'measurement_edit'

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
  onSetCalibrating
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
  const [pageHeights, setPageHeights] = useState<Map<number, number>>(new Map())
  const [documentReady, setDocumentReady] = useState(false) // Track if PDF is ready for rendering
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1])) // Track visible pages for lazy loading
  const hasAutoFitted = useRef(false) // Track if we've already auto-fitted

  // Configure PDF.js worker on mount - only needed for getting page count
  const [workerReady, setWorkerReady] = useState(false)
  
  // Render PDF at fixed high resolution for consistent coordinate system
  // Always use the same render scale regardless of zoom to ensure comments stay aligned
  // CSS transform handles visual zoom, so we don't need to include zoom in render scale
  const pageScale = useMemo(() => {
    const BASE_WIDTH = 612
    const BASE_HEIGHT = 792
    const MAX_CANVAS_DIMENSION = 8192
    const MIN_EFFECTIVE_DPR = 2

    const rawDevicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : MIN_EFFECTIVE_DPR
    const effectiveDevicePixelRatio = Math.max(MIN_EFFECTIVE_DPR, rawDevicePixelRatio)
    const desiredScale = scale * 3 * effectiveDevicePixelRatio
    const minQualityScale = scale * 2

    const baselineScale = Math.max(minQualityScale, desiredScale)
    const maxScaleByWidth = MAX_CANVAS_DIMENSION / BASE_WIDTH
    const maxScaleByHeight = MAX_CANVAS_DIMENSION / BASE_HEIGHT
    const cappedScale = Math.min(baselineScale, maxScaleByWidth, maxScaleByHeight)

    if (typeof window !== 'undefined' && cappedScale < desiredScale - 0.01) {
      console.warn('Capping PDF render scale to avoid canvas error state', {
        desiredScale,
        cappedScale,
        maxScaleByWidth,
        maxScaleByHeight,
        effectiveDevicePixelRatio
      })
    }

    return cappedScale
  }, [scale])
  
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
            console.log('PDF.js worker configured:', pdfjs.pdfjs.GlobalWorkerOptions.workerSrc)
            
            // Give the worker more time to initialize properly
            // Increased delay to ensure worker is fully ready (especially for slower systems)
            await new Promise(resolve => setTimeout(resolve, 1500))
            
            // Verify worker is actually ready
            if (pdfjs.pdfjs.GlobalWorkerOptions.workerSrc) {
              console.log('PDF.js worker ready')
              setWorkerReady(true)
            } else {
              console.warn('PDF.js worker not properly configured, retrying...')
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
              console.log('PDF.js worker configured with CDN fallback')
              await new Promise(resolve => setTimeout(resolve, 1500))
              setWorkerReady(true)
            }
          } catch (fallbackError) {
            console.error('CDN fallback also failed:', fallbackError)
            // Still set ready after delay to allow rendering attempts
            setTimeout(() => setWorkerReady(true), 2000)
          }
        }
      }
      
      initWorker()
    }
  }, [workerReady])

  // Load PDF to get page count only, then destroy PDF object
  useEffect(() => {
    if (!pdfUrl || !workerReady || pdfLoaded) return

    const loadPageCount = async () => {
      try {
        const pdfjs = await import('react-pdf')
        if (!pdfjs.pdfjs) {
          throw new Error('PDF.js not available')
        }

        // Load PDF just to get page count
        const pdf = await pdfjs.pdfjs.getDocument(pdfUrl).promise
        const loadedPages = pdf.numPages
        console.log('PDF loaded successfully, pages:', loadedPages)
        
        setNumPages(loadedPages)
        if (onNumPagesChange) {
          onNumPagesChange(loadedPages)
        }
        setPdfLoaded(true)
        setPdfError(null)
        
        // Add a longer delay before marking document as ready to ensure worker is fully stable
        // This prevents "messageHandler is null" errors when Page components render
        // Increased delay to handle slower systems
        setTimeout(() => {
          setDocumentReady(true)
        }, 800)

        // Clean up document resources without tearing down the shared worker
        if (typeof pdf.cleanup === 'function') {
          await pdf.cleanup()
          console.log('PDF resources cleaned up after page count extraction')
        }
      } catch (error) {
        console.error('PDF loading failed:', error)
        setPdfError('PDF could not be loaded. You can still use drawing tools on a blank canvas.')
        setPdfLoaded(true) // Still allow drawing
      }
    }

    loadPageCount()
  }, [pdfUrl, workerReady, pdfLoaded, onNumPagesChange])

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
      const points = (isEditingThis ? editingMeasurement?.points : drawing.geometry?.points) || []
      if (drawing.type === 'measurement_line' && points.length < 4) {
        return
      }
      if (drawing.type === 'measurement_area' && points.length < 6) {
        return
      }

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
      const color = drawing.style?.color || '#3b82f6'

      ctx.save()
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = drawing.style?.strokeWidth || 2
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
        
        // Draw labels for each segment
        if (measurementData && 'segmentLengths' in (measurementData as any) && Array.isArray((measurementData as any).segmentLengths) && scaleSetting) {
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
            ctx.font = '12px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(label).width
            const padding = 4
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.fillRect(midX - textWidth / 2 - padding, midY - 8, textWidth + padding * 2, 16)
            
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
            ctx.font = '14px Arial'
            ctx.textAlign = 'left'
            const textWidth = ctx.measureText(label).width
            const padding = 4
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.fillRect(lastX + 10, lastY - 10, textWidth + padding * 2, 20)
            
            try {
              ctx.fillStyle = '#1f2937'
              ctx.fillText(label, lastX + 10 + padding, lastY)
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
        
        // Draw area label at centroid
        if (measurementData && 'area' in (measurementData as any) && scaleSetting) {
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
          
          ctx.font = '14px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const textWidth = ctx.measureText(areaLabel).width
          const padding = 6
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.fillRect(centroidX - textWidth / 2 - padding, centroidY - 10, textWidth + padding * 2, 20)
          
          try {
            ctx.fillStyle = '#1f2937'
            ctx.fillText(areaLabel, centroidX, centroidY)
          } catch (error) {
            console.warn('Error drawing text, skipping:', error)
          }
        }
      }
      ctx.restore()
    })
    
    // Draw current measurement being drawn (only if on current page)
    if (currentMeasurement && currentMeasurement.geometry?.points && currentMeasurement.pageNumber === currentPage) {
      // Use points directly at base scale (zoom is handled by transform)
      const points = currentMeasurement.geometry.points
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
        if (points.length >= 4 && scaleSetting) {
          const x1 = points[points.length - 4]
          const y1 = points[points.length - 3]
          const x2 = points[points.length - 2]
          const y2 = points[points.length - 1]
          const pixelDist = calculatePixelDistance(x1, y1, x2, y2)
          const realDist = calculateRealWorldDistance(pixelDist, currentMeasurement.pageNumber)
          
          if (realDist !== null) {
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            const label = formatMeasurement(realDist, unit)
            
            ctx.font = '12px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(label).width
            const padding = 4
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.fillRect(midX - textWidth / 2 - padding, midY - 8, textWidth + padding * 2, 16)
            
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
        
        // Show live area if closed
        if (scaleSetting) {
          const pixelArea = calculatePolygonArea(points)
          const realArea = calculateRealWorldArea(pixelArea, currentMeasurement.pageNumber)
          
          if (realArea !== null) {
            let sumX = 0, sumY = 0
            for (let i = 0; i < points.length; i += 2) {
              sumX += points[i]
              sumY += points[i + 1]
            }
            const centroidX = sumX / (points.length / 2)
            const centroidY = sumY / (points.length / 2)
            
            const areaLabel = formatArea(realArea, unit)
            
            ctx.font = '14px Arial'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(areaLabel).width
            const padding = 6
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.fillRect(centroidX - textWidth / 2 - padding, centroidY - 10, textWidth + padding * 2, 20)
            
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
    if (isCalibrating && calibrationPoints.length > 0) {
      calibrationPoints.forEach((point, index) => {
        ctx.fillStyle = '#ef4444'
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2
        
        ctx.beginPath()
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        // Draw label
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = '#1f2937'
        ctx.fillText(`Point ${index + 1}`, point.x, point.y - 12)
      })
      
      // Draw line between points if we have 2
      if (calibrationPoints.length === 2) {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y)
        ctx.lineTo(calibrationPoints[1].x, calibrationPoints[1].y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Comments are now rendered as HTML elements, not on canvas
  }, [drawings, selectedComment, currentMeasurement, measurementScaleSettings, isCalibrating, calibrationPoints, currentPage, getScaleSetting, editingMeasurement, computeLineMeasurementData, computeAreaMeasurementData, selectedTool])

  // Set canvas dimensions to match current page (zoom handled by transform)
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      return
    }

    const resizeCanvas = () => {
      // Size canvas to match current PDF page at base scale (zoom is handled by transform)
      // Use the same dimensions as the PDF container to ensure perfect alignment
      const pageHeight = pageHeights.get(currentPage) || (792 * scale)
      const pageWidth = 612 * scale
      
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
  }, [currentPage, pageHeights, scale, renderDrawings])

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
  // Note: Zoom is applied via CSS transform, so coordinates are stored at base scale
  // The canvas and PDF both use base scale coordinates, then CSS transform handles zoom
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    
    const containerRect = container.getBoundingClientRect()
    const pageWidth = 612 * scale
    const pageHeight = pageHeights.get(currentPage) || (792 * scale)
    
    // Calculate center offset (page is centered in container via flexbox)
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2
    
    // Convert screen coordinates to world coordinates (page top-left is origin at 0,0)
    // The transform is: translate(panX, panY) scale(zoom) with origin at center
    // To reverse: (screen - center - pan) / zoom gives coordinates relative to center
    // Then add pageWidth/2 and pageHeight/2 to get coordinates relative to page top-left
    const worldX = (screenX - centerX - viewport.panX) / viewport.zoom + (pageWidth / 2)
    const worldY = (screenY - centerY - viewport.panY) / viewport.zoom + (pageHeight / 2)
    
    return { x: worldX, y: worldY }
  }, [viewport, scale, currentPage, pageHeights])

  // Get page number from Y coordinate
  const getPageNumber = useCallback((y: number) => {
    const positions = calculatePagePositions()
    for (let i = positions.length - 1; i >= 0; i--) {
      if (positions[i] && y >= positions[i].y) {
        return i + 1
      }
    }
    // If no position found or all pages not loaded yet, return 1
    return 1
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
        const positions = calculatePagePositions()
        const scrollY = -newPanY / prev.zoom
        const newPage = getPageNumber(scrollY)
        if (newPage !== currentPage) {
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
        if (drawing.type !== 'measurement_line' || drawing.pageNumber !== pageNumber) {
          return
        }

        const points = drawing.geometry?.points
        if (!points || points.length < 4) {
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
        if (drawing.type !== 'measurement_line' || drawing.pageNumber !== pageNumber) {
          return
        }

        const points = drawing.geometry?.points
        if (!points || points.length < 4) {
          return
        }

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
      })

      return closest
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

      const nearbySegment = getMeasurementSegmentAtPoint(pageNumber, baseWorldX, baseWorldY)
      if (nearbySegment && nearbySegment.drawing.geometry?.points) {
        setEditingMeasurement({
          id: nearbySegment.drawing.id,
          type: nearbySegment.drawing.type,
          pageNumber: nearbySegment.drawing.pageNumber,
          points: [...nearbySegment.drawing.geometry.points],
          handleIndex: nearbySegment.handleIndex
        })
        setIsAdjustingMeasurement(false)
      } else {
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

        if (selectedTool === 'measurement_line' && !e.shiftKey) {
          const sanitizedPoints = updatedPoints.slice(0, Math.max(updatedPoints.length - 2, 0))
          if (sanitizedPoints.length >= 4) {
            const measurementToFinalize: Drawing = {
              ...updatedMeasurement,
              geometry: {
                ...updatedMeasurement.geometry,
                points: sanitizedPoints
              }
            }
            const finalized = finalizeMeasurementFromDrawing(measurementToFinalize)
            if (finalized) {
              onDrawingsChange([...drawings, finalized])
              setCurrentMeasurement(null)
              setIsDrawingMeasurement(false)
            }
          }
        }
      }
    } else if (selectedTool === 'none') {
      // Start panning
      setIsPanning(true)
      setLastPanPoint({ x: screenX, y: screenY })
    }
  }, [selectedTool, screenToWorld, getPageNumber, onCommentPinClick, drawings, onDrawingsChange, isPointInComment, onCommentClick, currentMeasurement, isDrawingMeasurement, getScaleSetting, onOpenScaleSettings, isCalibrating, calibrationPoints, setCalibrationPoints, getMeasurementHandleAtPoint, getMeasurementSegmentAtPoint, finalizeMeasurementFromDrawing])

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
      const baseWorldX = world.x
      const baseWorldY = world.y
      
      // Update last point in measurement for preview (store at base scale)
      const points = currentMeasurement.geometry.points || []
      if (points.length >= 2) {
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
    // Comment hover detection is now handled by HTML elements via onMouseEnter/onMouseLeave
  }, [isPanning, lastPanPoint, screenToWorld, isDrawingMeasurement, currentMeasurement, selectedTool, editingMeasurement, isAdjustingMeasurement])

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
        setSelectedTool('measurement_edit')
        e.preventDefault()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTool === 'measurement_edit' && editingMeasurement) {
        e.preventDefault()
        deleteMeasurement(editingMeasurement.id)
      } else if (e.key === 'Escape') {
        if (isDrawingMeasurement) {
          setCurrentMeasurement(null)
          setIsDrawingMeasurement(false)
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
        {!pdfError && pdfUrl && documentReady && numPages > 0 && workerReady ? (
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
              onLoadSuccess={() => {
                // Document is fully loaded, ensure worker is ready
                console.log('PDF Document loaded successfully')
              }}
              onLoadError={(error: Error) => {
                console.error('PDF Document load error:', error)
                setPdfError('Failed to load PDF document')
              }}
            >
              <div 
                className="relative shadow-lg bg-white" 
                data-page-num={currentPage} 
                style={{ 
                  width: `${612 * scale}px`,
                  backgroundColor: 'white',
                  // Ensure exact positioning to match drawing canvas
                  margin: '0 auto',
                  display: 'block',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <Page
                  key={`page-${currentPage}`}
                  pageNumber={currentPage}
                  scale={pageScale}
                  width={612}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-lg relative"
                  style={{ 
                    display: 'block', 
                    position: 'relative', 
                    zIndex: 1,
                    width: `${612 * scale}px`,
                    height: 'auto',
                    backgroundColor: 'white',
                  }}
                  loading={
                    <div className="bg-white flex items-center justify-center text-gray-400 text-sm" style={{ width: `${612 * scale}px`, backgroundColor: 'white' }}>
                      Loading page {currentPage}...
                    </div>
                  }
                  onLoadSuccess={(page: { height: number; width: number }) => {
                    // Calculate height using display scale (zoom is handled by transform)
                    const height = page.height * scale
                    setPageHeights((prev: Map<number, number>) => {
                      const newHeights = new Map(prev)
                      newHeights.set(currentPage, height)
                      return newHeights
                    })
                  }}
                  onLoadError={(error: Error) => {
                    console.error(`Error loading page ${currentPage}:`, error)
                    // Don't crash the app, just log the error
                  }}
                  onRenderError={(error: Error) => {
                    console.error(`Error rendering page ${currentPage}:`, error)
                    // If it's a worker error, reset document ready state to force re-initialization
                    if (error.message?.includes('messageHandler') || error.message?.includes('worker') || error.message?.includes('sendWithPromise')) {
                      console.warn('PDF.js worker error detected, resetting document ready state')
                      setDocumentReady(false)
                      // Wait a bit then try again
                      setTimeout(() => {
                        setDocumentReady(true)
                      }, 1000)
                    }
                  }}
                  onRenderSuccess={() => {
                    // Ensure canvas quality settings are applied for crisp rendering
                    if (typeof window !== 'undefined') {
                      setTimeout(() => {
                        const pageContainer = document.querySelector(`[data-page-num="${currentPage}"]`) as HTMLElement
                        if (pageContainer) {
                          // Ensure container has white background
                          pageContainer.style.backgroundColor = 'white'
                          
                          const canvas = pageContainer.querySelector('canvas') as HTMLCanvasElement
                          if (canvas) {
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
                            
                            // Canvas is rendered at high resolution (scale * zoom * devicePixelRatio)
                            // but MUST be displayed at base size (612 * scale) to match drawing canvas exactly
                            // CSS transform handles visual zoom, keeping coordinate systems aligned
                            const baseDisplayWidth = 612 * scale
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
                            
                            // Also ensure the canvas element itself has white background via CSS
                            const canvasStyle = window.getComputedStyle(canvas)
                            if (canvasStyle.backgroundColor === 'transparent' || canvasStyle.backgroundColor === 'rgba(0, 0, 0, 0)') {
                              canvas.style.backgroundColor = 'white'
                            }
                          }
                        }
                      }, 100)
                    }
                  }}
                />
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
            const pageHeight = pageHeights.get(currentPage) || (792 * scale)
            const pageWidth = 612 * scale
            
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
             title="Measure Line (M)"
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
              <span className="text-xs">Drag points to adjust</span>
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
