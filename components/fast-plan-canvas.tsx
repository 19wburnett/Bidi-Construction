'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
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
  const [numPages, setNumPages] = useState(1) // Default to 1 page for drawing area
  const [pdfPages, setPdfPages] = useState<HTMLCanvasElement[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set())
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set())
  const hasAutoFitted = useRef(false) // Track if we've already auto-fitted
  
  // Use refs to avoid infinite loops
  const pdfDocumentRef = useRef<any>(null)
  const loadingPagesRef = useRef<Set<number>>(new Set())
  const loadedPagesRef = useRef<Set<number>>(new Set())

  // Load page function - defined outside useEffect to avoid dependency issues
  const loadPage = useCallback(async (pageNum: number) => {
    const pdfDocument = pdfDocumentRef.current
    if (!pdfDocument || loadingPagesRef.current.has(pageNum) || loadedPagesRef.current.has(pageNum)) {
      return
    }
    
    try {
      loadingPagesRef.current.add(pageNum)
      setLoadingPages(new Set(loadingPagesRef.current))
      
      const page = await pdfDocument.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      
      // Create canvas for this page
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height
      
      // Render page to canvas with timeout
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      // Add timeout to prevent hanging (increased to 30s for large plans)
      const renderPromise = page.render(renderContext).promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Render timeout')), 30000)
      )
      
      await Promise.race([renderPromise, timeoutPromise])
      
      // Update state
      setPdfPages(prev => {
        const newPages = [...prev]
        newPages[pageNum - 1] = canvas
        return newPages
      })
      
      loadedPagesRef.current.add(pageNum)
      setLoadedPages(new Set(loadedPagesRef.current))
      
      // Clean up page immediately
      page.cleanup()
      
    } catch (pageError) {
      console.warn(`Failed to render page ${pageNum}:`, pageError)
    } finally {
      loadingPagesRef.current.delete(pageNum)
      setLoadingPages(new Set(loadingPagesRef.current))
    }
  }, [])

  // Handle goToPage prop to navigate to a specific page
  useEffect(() => {
    if (goToPage && goToPage >= 1 && goToPage <= numPages) {
      setCurrentPage(goToPage)
    }
  }, [goToPage, numPages])

  // Notify parent on current page changes
  useEffect(() => {
    if (onPageChange) {
      onPageChange(currentPage)
    }
  }, [currentPage, onPageChange])

  // Progressive PDF loading - load pages on demand
  useEffect(() => {
    const loadPdfDocument = async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        
        // Set worker source
        
        const pdfDocument = await pdfjs.getDocument({
          url: pdfUrl,
          maxImageSize: 10 * 1024 * 1024, // 10MB limit per image for large plans
          disableFontFace: true, // Disable font loading
          disableAutoFetch: true, // Disable auto-fetching
          disableStream: true // Disable streaming
        }).promise
        
        pdfDocumentRef.current = pdfDocument
        setNumPages(pdfDocument.numPages)
        // Notify parent of actual page count
        if (onNumPagesChange) {
          onNumPagesChange(pdfDocument.numPages)
        }
        setPdfLoaded(true)
        setPdfError(null)
        hasAutoFitted.current = false // Reset auto-fit flag when loading new PDF
        
        // Load first page immediately
        loadPage(1)
        
      } catch (error) {
        console.warn('PDF loading failed, using fallback drawing area:', error)
        setPdfError('PDF could not be loaded. You can still use drawing tools on a blank canvas.')
        setPdfLoaded(true) // Still allow drawing
        setNumPages(1)
      }
    }
    
    if (pdfUrl) {
      loadPdfDocument()
    }
    
    // Cleanup function to prevent memory leaks
    return () => {
      if (pdfDocumentRef.current) {
        pdfDocumentRef.current.destroy()
        pdfDocumentRef.current = null
      }
      setPdfPages([])
      setPdfLoaded(false)
      setLoadingPages(new Set())
      setLoadedPages(new Set())
      loadingPagesRef.current.clear()
      loadedPagesRef.current.clear()
      hasAutoFitted.current = false // Reset on cleanup
    }
  }, [pdfUrl, loadPage])

  // Separate effect to handle page loading when current page changes
  useEffect(() => {
    if (!pdfLoaded || numPages <= 1) return
    
    const loadPagesAroundCurrent = () => {
      const pagesToLoad = []
      for (let i = Math.max(1, currentPage - 1); i <= Math.min(numPages, currentPage + 1); i++) {
        if (!loadedPagesRef.current.has(i) && !loadingPagesRef.current.has(i)) {
          pagesToLoad.push(i)
        }
      }
      
      // Load pages with delay to prevent overwhelming
      pagesToLoad.forEach((pageNum, index) => {
        setTimeout(() => loadPage(pageNum), index * 200)
      })
    }
    
    loadPagesAroundCurrent()
  }, [currentPage, pdfLoaded, numPages, loadPage])

  // Handle scale changes - clear and reload pages
  useEffect(() => {
    if (!pdfLoaded) return
    
    // Clear existing pages and reload with new scale
    setPdfPages([])
    loadedPagesRef.current.clear()
    loadingPagesRef.current.clear()
    setLoadedPages(new Set())
    setLoadingPages(new Set())
    
    // Reload the current page and nearby pages
    if (numPages > 0) {
      const loadPagesAroundCurrent = () => {
        for (let i = Math.max(1, currentPage - 1); i <= Math.min(numPages, currentPage + 1); i++) {
          setTimeout(() => loadPage(i), (i - currentPage + 1) * 200)
        }
      }
      loadPagesAroundCurrent()
    }
  }, [scale, pdfLoaded, numPages, currentPage, loadPage])

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

  // Render drawings on the drawing canvas
  const renderDrawings = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Get all drawings for current page (comments and measurements)
    const drawingsForPage = drawings.filter(drawing => drawing.pageNumber === currentPage)
    const commentsForPage = drawingsForPage.filter(d => d.type === 'comment')
    const measurementsForPage = drawingsForPage.filter(d => d.type === 'measurement_line' || d.type === 'measurement_area')
    
    // Draw measurement lines
    measurementsForPage.forEach(drawing => {
      if (!drawing.geometry?.points || drawing.geometry.points.length < 4) return
      
      const scaleSetting = measurementScaleSettings?.[currentPage]
      const unit = scaleSetting?.unit || 'ft'
      const points = drawing.geometry.points
      
      ctx.strokeStyle = drawing.style?.color || '#3b82f6'
      ctx.fillStyle = drawing.style?.color || '#3b82f6'
      ctx.lineWidth = (drawing.style?.strokeWidth || 2) / viewport.zoom
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
            ctx.font = `${12 / viewport.zoom}px Arial`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(label).width
            const padding = 4 / viewport.zoom
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.fillRect(midX - textWidth / 2 - padding, midY - 8 / viewport.zoom, textWidth + padding * 2, 16 / viewport.zoom)
            
            // Draw label text
            ctx.fillStyle = '#1f2937'
            ctx.fillText(label, midX, midY)
          }
          
          // Draw total length if multiple segments
          if (drawing.measurements.totalLength && points.length > 4) {
            const lastX = points[points.length - 2]
            const lastY = points[points.length - 1]
            const label = `Total: ${formatMeasurement(drawing.measurements.totalLength, unit)}`
            ctx.font = `${14 / viewport.zoom}px Arial`
            ctx.textAlign = 'left'
            const textWidth = ctx.measureText(label).width
            const padding = 4 / viewport.zoom
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.fillRect(lastX + 10 / viewport.zoom, lastY - 10 / viewport.zoom, textWidth + padding * 2, 20 / viewport.zoom)
            
            ctx.fillStyle = '#1f2937'
            ctx.fillText(label, lastX + 10 / viewport.zoom + padding, lastY)
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
          
          ctx.font = `${14 / viewport.zoom}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const textWidth = ctx.measureText(areaLabel).width
          const padding = 6 / viewport.zoom
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
          ctx.fillRect(centroidX - textWidth / 2 - padding, centroidY - 10 / viewport.zoom, textWidth + padding * 2, 20 / viewport.zoom)
          
          ctx.fillStyle = '#1f2937'
          ctx.fillText(areaLabel, centroidX, centroidY)
        }
      }
    })
    
    // Draw current measurement being drawn
    if (currentMeasurement && currentMeasurement.geometry?.points) {
      const points = currentMeasurement.geometry.points
      const scaleSetting = measurementScaleSettings?.[currentPage]
      const unit = scaleSetting?.unit || 'ft'
      
      ctx.strokeStyle = currentMeasurement.style?.color || '#3b82f6'
      ctx.fillStyle = currentMeasurement.style?.color || '#3b82f6'
      ctx.lineWidth = (currentMeasurement.style?.strokeWidth || 2) / viewport.zoom
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
          const realDist = calculateRealWorldDistance(pixelDist, currentPage)
          
          if (realDist !== null) {
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            const label = formatMeasurement(realDist, unit)
            
            ctx.font = `${12 / viewport.zoom}px Arial`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(label).width
            const padding = 4 / viewport.zoom
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.fillRect(midX - textWidth / 2 - padding, midY - 8 / viewport.zoom, textWidth + padding * 2, 16 / viewport.zoom)
            
            ctx.fillStyle = '#1f2937'
            ctx.fillText(label, midX, midY)
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
          const realArea = calculateRealWorldArea(pixelArea, currentPage)
          
          if (realArea !== null) {
            let sumX = 0, sumY = 0
            for (let i = 0; i < points.length; i += 2) {
              sumX += points[i]
              sumY += points[i + 1]
            }
            const centroidX = sumX / (points.length / 2)
            const centroidY = sumY / (points.length / 2)
            
            const areaLabel = formatArea(realArea, unit)
            
            ctx.font = `${14 / viewport.zoom}px Arial`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            const textWidth = ctx.measureText(areaLabel).width
            const padding = 6 / viewport.zoom
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.fillRect(centroidX - textWidth / 2 - padding, centroidY - 10 / viewport.zoom, textWidth + padding * 2, 20 / viewport.zoom)
            
            ctx.fillStyle = '#1f2937'
            ctx.fillText(areaLabel, centroidX, centroidY)
          }
        }
      }
    }

    // Draw calibration points if in calibration mode
    if (isCalibrating && calibrationPoints.length > 0) {
      calibrationPoints.forEach((point, index) => {
        ctx.fillStyle = '#ef4444'
        ctx.strokeStyle = 'white'
        ctx.lineWidth = 2 / viewport.zoom
        
        ctx.beginPath()
        ctx.arc(point.x, point.y, 8 / viewport.zoom, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        // Draw label
        ctx.font = `${12 / viewport.zoom}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = '#1f2937'
        ctx.fillText(`Point ${index + 1}`, point.x, point.y - 12 / viewport.zoom)
      })
      
      // Draw line between points if we have 2
      if (calibrationPoints.length === 2) {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2 / viewport.zoom
        ctx.setLineDash([5 / viewport.zoom, 5 / viewport.zoom])
        ctx.beginPath()
        ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y)
        ctx.lineTo(calibrationPoints[1].x, calibrationPoints[1].y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Draw only comment drawings for current page
    
    commentsForPage.forEach(drawing => {
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
  }, [drawings, currentPage, selectedComment, currentMeasurement, viewport, measurementScaleSettings, isCalibrating, calibrationPoints])

  // Set canvas dimensions
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      return
    }

    const resizeCanvas = () => {
      // Size canvas to match PDF dimensions if available
      if (pdfPages.length > 0 && pdfPages[currentPage - 1]) {
        const pdfPage = pdfPages[currentPage - 1]
        canvas.width = pdfPage.width
        canvas.height = pdfPage.height
        canvas.style.width = `${pdfPage.width}px`
        canvas.style.height = `${pdfPage.height}px`
        
        // Force re-render of drawings after canvas resize
        setTimeout(() => renderDrawings(), 0)
      } else {
        // Set minimum dimensions to prevent zero-size canvas
        canvas.width = 800
        canvas.height = 600
        canvas.style.width = '800px'
        canvas.style.height = '600px'
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [pdfPages.length, currentPage, renderDrawings])

  // Auto-fit zoom on first page load (separate effect)
  useEffect(() => {
    const container = containerRef.current
    if (!hasAutoFitted.current && pdfPages.length > 0 && pdfPages[currentPage - 1] && container) {
      const pdfPage = pdfPages[currentPage - 1]
      const containerRect = container.getBoundingClientRect()
      const containerWidth = containerRect.width
      const containerHeight = containerRect.height
      
      // Calculate zoom to fit page with 5% padding
      const scaleX = (containerWidth * 0.95) / pdfPage.width
      const scaleY = (containerHeight * 0.95) / pdfPage.height
      const fitZoom = Math.min(scaleX, scaleY)
      
      // Limit zoom to reasonable range
      const finalZoom = Math.max(0.3, Math.min(2.0, fitZoom))
      
      setViewport({
        zoom: finalZoom,
        panX: 0,
        panY: 0
      })
      
      hasAutoFitted.current = true
    }
  }, [pdfPages.length, currentPage])

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

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - viewport.panX) / viewport.zoom,
      y: (screenY - viewport.panY) / viewport.zoom
    }
  }, [viewport])

  // Get page number from Y coordinate
  const getPageNumber = useCallback((y: number) => {
    const pageHeight = 800 + 20 // 800px page + 20px gap
    return Math.floor(y / pageHeight) + 1
  }, [])

  // Handle wheel events for zoom and pan
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
      // Pan when Ctrl/Cmd is not pressed
      // Use deltaX for horizontal scrolling (shift+scroll or trackpad)
      // Use deltaY for vertical scrolling (normal scroll)
      const panSpeed = 0.5
      setViewport(prev => ({
        ...prev,
        panX: prev.panX - e.deltaX * panSpeed,
        panY: prev.panY - e.deltaY * panSpeed
      }))
    }
  }, [viewport])

  // Check if a point intersects with a comment (only for current page)
  const isPointInComment = useCallback((worldX: number, worldY: number, drawing: Drawing) => {
    // Only check comments on current page
    if (drawing.pageNumber !== currentPage || drawing.type !== 'comment') return false
    
    const geom = drawing.geometry
    // Increased threshold to minimum 20px regardless of zoom for easier clicking
    const threshold = Math.max(28, 20 / viewport.zoom) // Click tolerance scaled by zoom and bubble size
    
    const dist = Math.sqrt(Math.pow(worldX - geom.x, 2) + Math.pow(worldY - geom.y, 2))
    return dist <= threshold
  }, [viewport, currentPage])

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = screenToWorld(screenX, screenY)
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
      // Handle calibration point clicks
      if (calibrationPoints.length < 2) {
        const newPoints = [...calibrationPoints, { x: world.x, y: world.y }]
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
    
    // Priority 2: Check if clicking on an existing comment
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
      onCommentPinClick(world.x, world.y, pageNumber)
    } else if (selectedTool === 'measurement_line' || selectedTool === 'measurement_area') {
      // Start or continue measurement drawing
      if (!currentMeasurement || !isDrawingMeasurement) {
        // Start new measurement
        const newMeasurement: Drawing = {
          id: Date.now().toString(),
          type: selectedTool,
          geometry: {
            points: [world.x, world.y]
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
        // Add point to existing measurement
        const updatedPoints = [...(currentMeasurement.geometry.points || []), world.x, world.y]
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
  }, [selectedTool, screenToWorld, currentPage, onCommentPinClick, drawings, onDrawingsChange, isPointInComment, onCommentClick, currentMeasurement, isDrawingMeasurement, measurementScaleSettings, onOpenScaleSettings, isCalibrating, calibrationPoints])

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
      
      // Update last point in measurement for preview
      const points = currentMeasurement.geometry.points || []
      if (points.length >= 2) {
        const updatedPoints = [...points.slice(0, points.length - 2), world.x, world.y]
        setCurrentMeasurement({
          ...currentMeasurement,
          geometry: {
            ...currentMeasurement.geometry,
            points: updatedPoints
          }
        })
      }
    } else {
      // Check for hovered comment (works in both modes)
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

  if (!pdfLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    )
  }

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

          {/* Pagination Controls */}
          {numPages > 1 && (
            <div className="flex items-center space-x-1 md:space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="h-8 md:h-9"
              >
                <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <span className="text-xs md:text-sm text-gray-600 min-w-[60px] md:min-w-[80px] text-center">
                <span className="hidden sm:inline">Page </span>{currentPage}<span className="hidden sm:inline"> of {numPages}</span>
                {loadingPages.has(currentPage) && (
                  <span className="text-blue-500 ml-1 hidden sm:inline">(Loading...)</span>
                )}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
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
        {/* PDF Pages as Canvas Elements - Show only current page */}
        {!pdfError && pdfPages.length > 0 && pdfPages[currentPage - 1] && (
          <div
            className="absolute"
            style={{
              transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <div className="mb-5">
              <canvas
                ref={(canvas) => {
                  if (canvas && pdfPages[currentPage - 1]) {
                    // Copy the rendered content from our page canvas to the display canvas
                    const ctx = canvas.getContext('2d')!
                    canvas.width = pdfPages[currentPage - 1].width
                    canvas.height = pdfPages[currentPage - 1].height
                    ctx.drawImage(pdfPages[currentPage - 1], 0, 0)
                  }
                }}
                style={{
                  display: 'block',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  pointerEvents: 'none', // Let drawing canvas handle interactions
                  zIndex: '1' // Below the drawing canvas
                }}
              />
            </div>
          </div>
        )}

        {/* Loading indicator for current page */}
        {!pdfError && pdfLoaded && loadingPages.has(currentPage) && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50"
            style={{ zIndex: '5' }}
          >
            <div className="bg-white rounded-lg p-4 shadow-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm text-gray-600">Loading page {currentPage}...</span>
              </div>
            </div>
          </div>
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

        {/* Drawing Canvas Overlay */}
        <div
          className="absolute"
          style={{ 
            top: 0,
            left: 0,
            pointerEvents: 'auto',
            transform: pdfPages.length > 0 && pdfPages[currentPage - 1] ? `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` : 'none',
            transformOrigin: '0 0',
            width: pdfPages[currentPage - 1] ? `${pdfPages[currentPage - 1].width}px` : '0px',
            height: pdfPages[currentPage - 1] ? `${pdfPages[currentPage - 1].height}px` : '0px',
            display: !pdfError && pdfPages.length > 0 && pdfPages[currentPage - 1] ? 'block' : 'none',
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
              position: 'absolute',
              top: 0,
              left: 0,
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
