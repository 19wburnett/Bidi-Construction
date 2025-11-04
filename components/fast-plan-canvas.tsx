'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
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
  Hand
} from 'lucide-react'

import { Drawing } from '@/lib/canvas-utils'
import CommentPopup from '@/components/comment-popup'

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

type DrawingTool = 'comment' | 'none' | 'measurement_line' | 'measurement_area'

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
  const [pageHeights, setPageHeights] = useState<Map<number, number>>(new Map())
  const [documentReady, setDocumentReady] = useState(false) // Track if PDF is ready for rendering
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1])) // Track visible pages for lazy loading
  const hasAutoFitted = useRef(false) // Track if we've already auto-fitted

  // Configure PDF.js worker on mount - only needed for getting page count
  const [workerReady, setWorkerReady] = useState(false)
  
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
            // Increased delay to ensure worker is fully ready
            await new Promise(resolve => setTimeout(resolve, 1000))
            
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
              await new Promise(resolve => setTimeout(resolve, 1000))
              setWorkerReady(true)
            }
          } catch (fallbackError) {
            console.error('CDN fallback also failed:', fallbackError)
            // Still set ready after delay to allow rendering attempts
            setTimeout(() => setWorkerReady(true), 1500)
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
        setDocumentReady(true)

        // Destroy PDF object immediately to free memory
        pdf.destroy()
        console.log('PDF object destroyed after page count extraction')
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

  // Render drawings on the drawing canvas
  const renderDrawings = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Check if canvas is in a valid state
    try {
      // Test if canvas is accessible
      if (canvas.width === 0 || canvas.height === 0) return
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    } catch (error) {
      console.warn('Canvas context error, skipping render:', error)
      return
    }

    // Get drawings for current page only (paginated view)
    const currentPageComments = drawings.filter(d => d.type === 'comment' && d.pageNumber === currentPage)
    const currentPageMeasurements = drawings.filter(d => (d.type === 'measurement_line' || d.type === 'measurement_area') && d.pageNumber === currentPage)
    
    // Draw measurement lines for current page
    currentPageMeasurements.forEach(drawing => {
      if (!drawing.geometry?.points || drawing.geometry.points.length < 4) return
      
      const scaleSetting = getScaleSetting(drawing.pageNumber)
      const unit = scaleSetting?.unit || 'ft'
      // Use points directly at base scale (zoom is handled by transform)
      const points = drawing.geometry.points
      
      ctx.strokeStyle = drawing.style?.color || '#3b82f6'
      ctx.fillStyle = drawing.style?.color || '#3b82f6'
      ctx.lineWidth = drawing.style?.strokeWidth || 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      if (drawing.type === 'measurement_line') {
        // Draw polyline
        ctx.beginPath()
        ctx.moveTo(points[0], points[1])
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i], points[i + 1])
        }
        ctx.stroke()
        
        // Draw labels for each segment
        if (drawing.measurements?.segmentLengths && scaleSetting) {
          for (let i = 0; i < points.length - 2; i += 2) {
            const x1 = points[i]
            const y1 = points[i + 1]
            const x2 = points[i + 2]
            const y2 = points[i + 3]
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            const length = drawing.measurements.segmentLengths[i / 2]
            
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
          if (drawing.measurements.totalLength && points.length > 4) {
            const lastX = points[points.length - 2]
            const lastY = points[points.length - 1]
            const label = `Total: ${formatMeasurement(drawing.measurements.totalLength, unit)}`
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
        if (drawing.measurements?.area && scaleSetting) {
          // Calculate centroid
          let sumX = 0, sumY = 0
          for (let i = 0; i < points.length; i += 2) {
            sumX += points[i]
            sumY += points[i + 1]
          }
          const centroidX = sumX / (points.length / 2)
          const centroidY = sumY / (points.length / 2)
          
          // Format area (convert to sqft if needed)
          let area = drawing.measurements.area
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

    // Draw comment drawings for current page only
    currentPageComments.forEach(drawing => {
      // Check if geometry has valid x and y values
      if (!drawing.geometry || typeof drawing.geometry.x === 'undefined' || typeof drawing.geometry.y === 'undefined') {
        console.warn('Comment missing geometry:', drawing)
        return
      }
      
      // Use world coordinates directly - the canvas transform handles the viewport
      const worldX = drawing.geometry.x
      const worldY = drawing.geometry.y
        
        // Draw comment bubble at world position
        // Note: size is in world coordinates, actual pixel size will be scaled by canvas transform
        const bubbleRadius = 24  // Increased size for better visibility
        
        // Draw selection highlight if this comment is selected
        if (selectedComment?.id === drawing.id) {
          ctx.fillStyle = '#3b82f6'
          ctx.beginPath()
          ctx.arc(worldX, worldY, bubbleRadius + 3, 0, Math.PI * 2)
          ctx.fill()
        }
        
        // Draw comment bubble background
        ctx.fillStyle = drawing.style.color
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2

        ctx.beginPath()
        ctx.arc(worldX, worldY, bubbleRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        // Draw icon for comment type as a simple shape
        ctx.strokeStyle = 'white'
        ctx.fillStyle = 'white'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        
        if (drawing.noteType === 'requirement') {
          // Checkmark - thicker for visibility
          ctx.beginPath()
          ctx.moveTo(worldX - 4, worldY)
          ctx.lineTo(worldX - 1, worldY + 3)
          ctx.lineTo(worldX + 4, worldY - 3)
          ctx.lineWidth = 2.5
          ctx.stroke()
        } else if (drawing.noteType === 'concern') {
          // Exclamation mark
          ctx.beginPath()
          ctx.arc(worldX, worldY - 3, 1.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(worldX, worldY)
          ctx.lineTo(worldX, worldY + 5)
          ctx.stroke()
        } else if (drawing.noteType === 'suggestion') {
          // Star/lightbulb shape
          const sides = 4
          const outerRadius = 3
          ctx.beginPath()
          for (let i = 0; i < sides * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : outerRadius * 0.5
            const angle = (i * Math.PI) / sides
            const x = worldX + radius * Math.cos(angle)
            const y = worldY + radius * Math.sin(angle)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.stroke()
        } else {
          // Default: message icon (two circles)
          ctx.beginPath()
          ctx.arc(worldX - 2, worldY - 1, 2, 0, Math.PI * 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(worldX + 2, worldY + 1, 2.5, 0, Math.PI * 2)
          ctx.stroke()
        }
      })
  }, [drawings, selectedComment, currentMeasurement, viewport, measurementScaleSettings, isCalibrating, calibrationPoints, currentPage, getScaleSetting])

  // Set canvas dimensions to match current page (zoom handled by transform)
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      return
    }

    const resizeCanvas = () => {
      // Size canvas to match current PDF page at base scale (zoom is handled by transform)
      const pageHeight = pageHeights.get(currentPage) || (792 * scale)
      const pageWidth = 612 * scale
      
      canvas.width = pageWidth
      canvas.height = pageHeight
      canvas.style.width = `${pageWidth}px`
      canvas.style.height = `${pageHeight}px`
      
      // Canvas is centered by the parent container's flex layout
      // Use relative positioning to match PDF positioning
      canvas.style.position = 'relative'
      canvas.style.margin = '0'
      
      // Force re-render of drawings after canvas resize
      setTimeout(() => renderDrawings(), 0)
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
        
        // Limit zoom to reasonable range
        const finalZoom = Math.max(0.3, Math.min(2.0, fitZoom))
        
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
        if (newPoints.length === 2) {
          setIsCalibrating(false)
          // Reopen modal with points - use a longer delay to ensure state is updated
          // Use requestAnimationFrame to ensure state updates are processed
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (onOpenScaleSettings) {
                onOpenScaleSettings()
              }
            }, 100)
          })
        }
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
    } else if (selectedTool === 'measurement_line' || selectedTool === 'measurement_area') {
      // Start or continue measurement drawing
      if (!currentMeasurement || !isDrawingMeasurement) {
        // Start new measurement (store at base scale)
        const newMeasurement: Drawing = {
          id: Date.now().toString(),
          type: selectedTool,
          geometry: {
            points: [baseWorldX, baseWorldY]
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
        const updatedPoints = [...(currentMeasurement.geometry.points || []), baseWorldX, baseWorldY]
        setCurrentMeasurement({
          ...currentMeasurement,
          geometry: {
            ...currentMeasurement.geometry,
            points: updatedPoints
          }
        })
      }
    } else if (selectedTool === 'none') {
      // Start panning
      setIsPanning(true)
      setLastPanPoint({ x: screenX, y: screenY })
    }
  }, [selectedTool, screenToWorld, getPageNumber, onCommentPinClick, drawings, onDrawingsChange, isPointInComment, onCommentClick, currentMeasurement, isDrawingMeasurement, getScaleSetting, onOpenScaleSettings, isCalibrating, calibrationPoints, setCalibrationPoints])

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
        const updatedPoints = [...points.slice(0, points.length - 2), baseWorldX, baseWorldY]
        setCurrentMeasurement({
          ...currentMeasurement,
          geometry: {
            ...currentMeasurement.geometry,
            points: updatedPoints
          }
        })
      }
    } else {
      // Check for hovered comment (current page only)
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      const world = screenToWorld(screenX, screenY)

      const hovered = drawings.find(d => 
        d.type === 'comment' && d.pageNumber === currentPage && isPointInComment(world.x, world.y, d)
      )
      setHoveredComment(hovered || null)
    }
  }, [isPanning, lastPanPoint, selectedTool, screenToWorld, currentPage, drawings, isPointInComment, isDrawingMeasurement, currentMeasurement])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
    }
    // For measurements, finalize on double-click or right-click will be handled separately
  }, [isPanning])

  // Finalize measurement (calculate and save)
  const finalizeMeasurement = useCallback(() => {
    if (!currentMeasurement || !isDrawingMeasurement) return

    const scaleSetting = getScaleSetting(currentMeasurement.pageNumber)
    if (!scaleSetting || !currentMeasurement.geometry.points || currentMeasurement.geometry.points.length < 4) {
      setCurrentMeasurement(null)
      setIsDrawingMeasurement(false)
      return
    }

    const points = currentMeasurement.geometry.points
    const unit = scaleSetting.unit || 'ft'

    if (currentMeasurement.type === 'measurement_line') {
      // Calculate segment lengths
      const segmentLengths: number[] = []
      let totalLength = 0
      
      for (let i = 0; i < points.length - 2; i += 2) {
        const pixelDist = calculatePixelDistance(points[i], points[i + 1], points[i + 2], points[i + 3])
        const realDist = calculateRealWorldDistance(pixelDist, currentMeasurement.pageNumber)
        if (realDist !== null) {
          segmentLengths.push(realDist)
          totalLength += realDist
        }
      }

      const finalized: Drawing = {
        ...currentMeasurement,
        measurements: {
          segmentLengths,
          totalLength,
          unit
        }
      }
      
      onDrawingsChange([...drawings, finalized])
    } else if (currentMeasurement.type === 'measurement_area') {
      // Calculate area
      const pixelArea = calculatePolygonArea(points)
      const realArea = calculateRealWorldArea(pixelArea, currentMeasurement.pageNumber)
      
      if (realArea !== null) {
        const finalized: Drawing = {
          ...currentMeasurement,
          measurements: {
            area: realArea,
            unit
          }
        }
        
        onDrawingsChange([...drawings, finalized])
      }
    }

    setCurrentMeasurement(null)
    setIsDrawingMeasurement(false)
  }, [currentMeasurement, isDrawingMeasurement, measurementScaleSettings, drawings, onDrawingsChange, calculateRealWorldDistance, calculateRealWorldArea])

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
      } else if (e.key === 'Escape') {
        if (isDrawingMeasurement) {
          setCurrentMeasurement(null)
          setIsDrawingMeasurement(false)
          setSelectedTool('none')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawingMeasurement, finalizeMeasurement])

  const handleMouseLeave = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
    }
    setHoveredComment(null)
  }, [isPanning])

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
    <div className="flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-2 md:p-4 bg-white border-b border-gray-200 flex-wrap gap-2">
        <div className="flex items-center space-x-1 md:space-x-2 flex-wrap min-w-0 flex-1">
          {/* PDF Error Warning */}
          {pdfError && (
            <div className="flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md text-xs md:text-sm">
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-yellow-600 flex-shrink-0" />
              <span className="text-yellow-700 truncate">{pdfError}</span>
            </div>
          )}

          {/* Pan Tool - Always Visible */}
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-2 md:pr-4">
            <Button
              variant={selectedTool === 'none' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                if (isDrawingMeasurement) {
                  finalizeMeasurement()
                }
                setSelectedTool('none')
              }}
              title="Pan view"
              className="h-8 md:h-9"
            >
              <Hand className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
              <span className="text-xs md:text-sm hidden sm:inline">Pan</span>
            </Button>
          </div>

          {/* Comment Tool */}
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-2 md:pr-4">
            <Button
              variant={selectedTool === 'comment' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool('comment')}
              title="Add comment"
              className="h-8 md:h-9"
            >
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
              <span className="text-xs md:text-sm hidden sm:inline">Add Comment</span>
            </Button>
          </div>

          {/* Measurement Tools */}
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-2 md:pr-4">
            <Button
              variant={selectedTool === 'measurement_line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                if (isDrawingMeasurement) {
                  finalizeMeasurement()
                }
                setSelectedTool('measurement_line')
              }}
              title="Measurement Line (M)"
              className="h-8 md:h-9"
            >
              <Ruler className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
              <span className="text-xs md:text-sm hidden sm:inline">Measure Line</span>
            </Button>
            <Button
              variant={selectedTool === 'measurement_area' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                if (isDrawingMeasurement) {
                  finalizeMeasurement()
                }
                setSelectedTool('measurement_area')
              }}
              title="Measurement Area (A)"
              className="h-8 md:h-9"
            >
              <Square className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
              <span className="text-xs md:text-sm hidden sm:inline">Measure Area</span>
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 md:space-x-2">
            <Button variant="ghost" size="sm" onClick={handleZoomOut} className="h-8 md:h-9">
              <ZoomOut className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <span className="text-xs md:text-sm text-gray-600 min-w-[50px] md:min-w-[60px] text-center">
              {Math.round(viewport.zoom * 100)}%
            </span>
            <Button variant="ghost" size="sm" onClick={handleZoomIn} className="h-8 md:h-9">
              <ZoomIn className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            {onOpenScaleSettings && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onOpenScaleSettings}
                title="Scale Settings"
                className="h-8 md:h-9"
              >
                <Settings className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            )}
            <div className="group relative hidden md:block">
              <Button variant="ghost" size="sm" className="px-2 h-8 md:h-9">
                <Info className="h-3 w-3 md:h-4 md:w-4 text-gray-400" />
              </Button>
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                <div className="bg-gray-900 text-white text-xs rounded-lg p-2 w-48 shadow-lg">
                  <div className="font-semibold mb-1">Navigation Tips:</div>
                  <div>• Scroll to pan</div>
                  <div>• Ctrl/Cmd + Scroll to zoom</div>
                  <div>• Click comment tool to add notes</div>
                </div>
              </div>
            </div>
          </div>

          {/* Page Navigation Controls */}
          {numPages > 1 && (
            <div className="flex items-center space-x-1 md:space-x-2 border-r border-gray-200 pr-2 md:pr-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (currentPage > 1) {
                    setCurrentPage(currentPage - 1)
                    setViewport(prev => ({ ...prev, panX: 0, panY: 0 })) // Reset pan when changing pages
                  }
                }}
                disabled={currentPage <= 1}
                className="h-8 md:h-9"
              >
                <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <span className="text-xs md:text-sm text-gray-600 min-w-[60px] md:min-w-[80px] text-center">
                <span className="hidden sm:inline">Page </span>{currentPage}<span className="hidden sm:inline"> of {numPages}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (currentPage < numPages) {
                    setCurrentPage(currentPage + 1)
                    setViewport(prev => ({ ...prev, panX: 0, panY: 0 })) // Reset pan when changing pages
                  }
                }}
                disabled={currentPage >= numPages}
                className="h-8 md:h-9"
              >
                <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Right Sidebar Toggle - Hidden on mobile since sidebar is a drawer */}
        <div className="flex items-center space-x-2 hidden md:flex">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRightSidebarToggle}
            className="h-8 md:h-9"
          >
            {rightSidebarOpen ? (
              <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
            ) : (
              <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-100"
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
        {/* Scale Indicator */}
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
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-md shadow-lg border border-gray-200 z-20">
            <div className="text-xs font-semibold text-gray-700">
              Scale: {getScaleSetting(currentPage)?.ratio}
            </div>
            <div className="text-xs text-gray-500">
              {getScaleSetting(currentPage)?.unit}
            </div>
          </div>
        ) : (
          <div className="absolute top-4 left-4 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-md shadow-lg z-20">
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
              error={
                <div className="p-8 text-center text-red-600">
                  <p className="font-medium mb-2">Failed to load PDF</p>
                  <p className="text-sm text-gray-600">You can still use drawing tools on a blank canvas</p>
                </div>
              }
            >
              <div 
                className="relative shadow-lg bg-white" 
                data-page-num={currentPage} 
                style={{ 
                  width: `${612 * scale}px`,
                  backgroundColor: 'white',
                }}
              >
                <Page
                  key={`page-${currentPage}`}
                  pageNumber={currentPage}
                  scale={scale * (typeof window !== 'undefined' ? Math.max(2, window.devicePixelRatio || 2) : 2)}
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
                            // but displayed at base size (scale). CSS transform handles visual zoom
                            // This ensures crisp rendering when zoomed in
                            const baseDisplayWidth = 612 * scale
                            canvas.style.width = `${baseDisplayWidth}px`
                            canvas.style.height = 'auto'
                            canvas.style.maxWidth = `${baseDisplayWidth}px`
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
                  onRenderError={(error: Error) => {
                    console.error(`Error rendering page ${currentPage}:`, error)
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
            zIndex: 10 // Ensure it's above PDF canvas elements
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
        >
          <canvas
            ref={drawingCanvasRef}
            style={{ 
              display: 'block',
              position: 'relative',
              backgroundColor: 'transparent',
            }}
          />
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
    </div>
  )
}
