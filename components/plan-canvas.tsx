'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Move, 
  Square, 
  Circle, 
  Pencil, 
  MessageSquare,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ChevronLeft,
  Eraser
} from 'lucide-react'
import { canvasUtils, Drawing } from '@/lib/canvas-utils'
import PdfQualitySettings, { QualityMode } from '@/components/pdf-quality-settings'
import PlanCanvasEfficient from './plan-canvas-efficient'


export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

interface PlanCanvasProps {
  pdfImages: HTMLCanvasElement[] // Changed to canvas-only for better performance
  drawings: Drawing[]
  onDrawingsChange: (drawings: Drawing[]) => void
  rightSidebarOpen: boolean
  onRightSidebarToggle: () => void
  onCommentPinClick: (x: number, y: number, pageNumber: number) => void
  pdfUrl?: string // Add PDF URL for high-res rendering
  useEfficientMode?: boolean // Option to use the new efficient canvas system
}

type DrawingTool = 'select' | 'rectangle' | 'circle' | 'line' | 'comment' | 'erase' | 'pencil'

export default function PlanCanvas({
  pdfImages,
  drawings,
  onDrawingsChange,
  rightSidebarOpen,
  onRightSidebarToggle,
  onCommentPinClick,
  pdfUrl,
  useEfficientMode = true // Use efficient mode by default
}: PlanCanvasProps) {
  // Use the efficient canvas system by default
  if (useEfficientMode) {
    return (
      <PlanCanvasEfficient
        pdfImages={pdfImages}
        drawings={drawings}
        onDrawingsChange={onDrawingsChange}
        rightSidebarOpen={rightSidebarOpen}
        onRightSidebarToggle={onRightSidebarToggle}
        onCommentPinClick={onCommentPinClick}
        pdfUrl={pdfUrl}
      />
    )
  }

  // Legacy SVG-based system (kept for compatibility)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 })
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null)
  const [pageOffsets, setPageOffsets] = useState<number[]>([])
  const [highResImages, setHighResImages] = useState<HTMLCanvasElement[]>([])
  const [isLoadingHighRes, setIsLoadingHighRes] = useState(false)
  const [qualityMode, setQualityMode] = useState<QualityMode>('balanced')

  // Calculate page offsets when PDF images change
  useEffect(() => {
    if (pdfImages.length > 0) {
      const offsets = [0]
      let cumulativeHeight = 0
      
      for (let i = 0; i < pdfImages.length - 1; i++) {
        const canvas = pdfImages[i]
        cumulativeHeight += canvas.height + 20 // 20px gap between pages
        offsets.push(cumulativeHeight)
      }
      setPageOffsets(offsets)
    }
  }, [pdfImages])

  // Load high-resolution images when zoom level increases significantly
  useEffect(() => {
    if (!pdfUrl || pdfImages.length === 0) return

    const loadHighResImages = async () => {
      // Determine zoom threshold based on quality mode
      const zoomThreshold = qualityMode === 'performance' ? 2.5 : 
                           qualityMode === 'balanced' ? 1.5 : 1.2
      
      if (viewport.zoom > zoomThreshold && highResImages.length === 0 && !isLoadingHighRes) {
        setIsLoadingHighRes(true)
        try {
          const highResPromises = pdfImages.map((_, index) => 
            canvasUtils.getHighResPage(pdfUrl, index + 1, viewport.zoom)
          )
          const highRes = await Promise.all(highResPromises)
          setHighResImages(highRes)
        } catch (error) {
          console.error('Error loading high-res images:', error)
        } finally {
          setIsLoadingHighRes(false)
        }
      }
    }

    const timeoutId = setTimeout(loadHighResImages, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [viewport.zoom, pdfUrl, pdfImages.length, highResImages.length, isLoadingHighRes, qualityMode])

  // Get page number from Y coordinate
  const getPageNumber = useCallback((y: number) => {
    for (let i = 0; i < pageOffsets.length; i++) {
      const nextOffset = i < pageOffsets.length - 1 ? pageOffsets[i + 1] : Infinity
      if (y >= pageOffsets[i] && y < nextOffset) {
        return i + 1
      }
    }
    return 1
  }, [pageOffsets])

  // Render function for SVG-based PDF viewing
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || pdfImages.length === 0) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Save context state
    ctx.save()

    // Apply viewport transform
    ctx.translate(viewport.panX, viewport.panY)
    ctx.scale(viewport.zoom, viewport.zoom)

    // Draw PDF pages - use high-res images if available and zoomed in
    let currentY = 0
    const zoomThreshold = qualityMode === 'performance' ? 2.5 : 
                         qualityMode === 'balanced' ? 1.5 : 1.2
    const imagesToUse = viewport.zoom > zoomThreshold && highResImages.length > 0 ? highResImages : pdfImages
    
    imagesToUse.forEach((canvas, index) => {
      // Handle canvas elements only (no more SVG)
      const originalHeight = pdfImages[index].height
      const scaleFactor = viewport.zoom > zoomThreshold && highResImages.length > 0 ? 
        originalHeight / canvas.height : 1
      
      ctx.save()
      if (scaleFactor !== 1) {
        ctx.scale(scaleFactor, scaleFactor)
      }
      ctx.drawImage(canvas, 0, currentY / scaleFactor)
      ctx.restore()
      
      currentY += originalHeight + 20
    })

    // Draw existing drawings
    drawings.forEach(drawing => {
      if (!drawing.isVisible) return

      ctx.strokeStyle = drawing.style.color
      ctx.fillStyle = `${drawing.style.color}20` // 20% opacity
      ctx.lineWidth = drawing.style.strokeWidth / viewport.zoom

      const pageOffset = pageOffsets[drawing.pageNumber - 1] || 0
      const x = drawing.geometry.x
      const y = drawing.geometry.y + pageOffset

      ctx.beginPath()

      switch (drawing.type) {
        case 'rectangle':
          if (drawing.geometry.width && drawing.geometry.height) {
            ctx.rect(x, y, drawing.geometry.width, drawing.geometry.height)
            ctx.fill()
            ctx.stroke()
          }
          break
        case 'circle':
          if (drawing.geometry.radius) {
            ctx.arc(x, y, drawing.geometry.radius, 0, 2 * Math.PI)
            ctx.fill()
            ctx.stroke()
          }
          break
        case 'line':
          if (drawing.geometry.points && drawing.geometry.points.length >= 4) {
            ctx.moveTo(drawing.geometry.points[0], drawing.geometry.points[1] + pageOffset)
            ctx.lineTo(drawing.geometry.points[2], drawing.geometry.points[3] + pageOffset)
            ctx.stroke()
          }
          break
        case 'comment':
          // Draw comment pin
          const pinRadius = 8 / viewport.zoom
          const pinStemHeight = 15 / viewport.zoom
          const pinBaseWidth = 10 / viewport.zoom

          ctx.fillStyle = drawing.style.color
          ctx.strokeStyle = 'white'
          ctx.lineWidth = 2 / viewport.zoom

          // Circle head
          ctx.beginPath()
          ctx.arc(x, y - pinStemHeight, pinRadius, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()

          // Stem
          ctx.beginPath()
          ctx.moveTo(x, y - pinStemHeight + pinRadius)
          ctx.lineTo(x, y)
          ctx.stroke()

          // Base triangle
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x - pinBaseWidth / 2, y + pinBaseWidth / 2)
          ctx.lineTo(x + pinBaseWidth / 2, y + pinBaseWidth / 2)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          break
      }
    })

    // Draw current drawing being created
    if (currentDrawing && currentDrawing.geometry) {
      ctx.strokeStyle = currentDrawing.style?.color || '#ff6b35'
      ctx.fillStyle = `${currentDrawing.style?.color || '#ff6b35'}20`
      ctx.lineWidth = (currentDrawing.style?.strokeWidth || 2) / viewport.zoom

      const pageOffset = pageOffsets[(currentDrawing.pageNumber || 1) - 1] || 0
      const x = currentDrawing.geometry.x
      const y = currentDrawing.geometry.y + pageOffset

      ctx.beginPath()

      switch (currentDrawing.type) {
        case 'rectangle':
          if (currentDrawing.geometry.width && currentDrawing.geometry.height) {
            ctx.rect(x, y, currentDrawing.geometry.width, currentDrawing.geometry.height)
            ctx.fill()
            ctx.stroke()
          }
          break
        case 'circle':
          if (currentDrawing.geometry.radius) {
            ctx.arc(x, y, currentDrawing.geometry.radius, 0, 2 * Math.PI)
            ctx.fill()
            ctx.stroke()
          }
          break
        case 'line':
          if (currentDrawing.geometry.points && currentDrawing.geometry.points.length >= 4) {
            ctx.moveTo(currentDrawing.geometry.points[0], currentDrawing.geometry.points[1] + pageOffset)
            ctx.lineTo(currentDrawing.geometry.points[2], currentDrawing.geometry.points[3] + pageOffset)
            ctx.stroke()
          }
          break
      }
    }

    // Restore context state
    ctx.restore()
  }, [viewport, pdfImages, drawings, currentDrawing, pageOffsets, highResImages, qualityMode])

  // Animation loop
  useEffect(() => {
    let animationId: number
    const animate = () => {
      render()
      animationId = requestAnimationFrame(animate)
    }
    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [render])

  // Set canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (!container) return

      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - viewport.panX) / viewport.zoom,
      y: (screenY - viewport.panY) / viewport.zoom
    }
  }, [viewport])

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback((worldX: number, worldY: number) => {
    return {
      x: worldX * viewport.zoom + viewport.panX,
      y: worldY * viewport.zoom + viewport.panY
    }
  }, [viewport])


  // Handle wheel events for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      
      const canvas = canvasRef.current
      if (!canvas) return
      
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      const zoomDelta = -e.deltaY * 0.001
      const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * (1 + zoomDelta)))
      
      setViewport(prev => ({
        zoom: newZoom,
        panX: mouseX - (mouseX - prev.panX) * (newZoom / prev.zoom),
        panY: mouseY - (mouseY - prev.panY) * (newZoom / prev.zoom)
      }))
    }
  }, [viewport])

  // Check if a point intersects with a drawing
  const isPointInDrawing = useCallback((x: number, y: number, drawing: Drawing, pageOffset: number) => {
    const geom = drawing.geometry
    const drawY = geom.y + pageOffset
    const threshold = 5 / viewport.zoom // Click tolerance

    switch (drawing.type) {
      case 'rectangle':
        if (!geom.width || !geom.height) return false
        return x >= geom.x - threshold && 
               x <= geom.x + geom.width + threshold &&
               y >= drawY - threshold && 
               y <= drawY + geom.height + threshold
      
      case 'circle':
        if (!geom.radius) return false
        const dist = Math.sqrt(Math.pow(x - geom.x, 2) + Math.pow(y - drawY, 2))
        return dist <= geom.radius + threshold
      
      case 'line':
        if (!geom.points || geom.points.length < 4) return false
        // Check distance from point to line segment
        const [x1, y1, x2, y2] = geom.points
        const offsetY1 = y1 + pageOffset
        const offsetY2 = y2 + pageOffset
        const A = offsetY2 - offsetY1
        const B = x1 - x2
        const C = x2 * offsetY1 - x1 * offsetY2
        const distToLine = Math.abs(A * x + B * y + C) / Math.sqrt(A * A + B * B)
        // Also check if point is within the bounds of the line segment
        const minX = Math.min(x1, x2)
        const maxX = Math.max(x1, x2)
        const minY = Math.min(offsetY1, offsetY2)
        const maxY = Math.max(offsetY1, offsetY2)
        return distToLine <= threshold && x >= minX - threshold && x <= maxX + threshold &&
               y >= minY - threshold && y <= maxY + threshold
      
      case 'comment':
        const commentRadius = 15 / viewport.zoom
        return Math.sqrt(Math.pow(x - geom.x, 2) + Math.pow(y - drawY + commentRadius, 2)) <= commentRadius
      
      default:
        return false
    }
  }, [viewport.zoom])

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = screenToWorld(screenX, screenY)
    const pageNumber = getPageNumber(world.y)

    if (selectedTool === 'erase') {
      // Find and remove drawing at this point
      const pageOffset = pageOffsets[pageNumber - 1] || 0
      const clickedDrawing = drawings.find(d => 
        d.pageNumber === pageNumber && isPointInDrawing(world.x, world.y, d, pageOffset)
      )
      
      if (clickedDrawing) {
        onDrawingsChange(drawings.filter(d => d.id !== clickedDrawing.id))
      }
      return
    }

    if (selectedTool === 'select') {
      // Start panning
      setIsDrawing(true)
      setCurrentDrawing({
        id: 'pan',
        lastX: screenX,
        lastY: screenY
      } as any)
    } else if (selectedTool === 'comment') {
      // Place comment pin
      onCommentPinClick(world.x, world.y, pageNumber)
    } else {
      // Start drawing
      setIsDrawing(true)
      setCurrentDrawing({
        id: Date.now().toString(),
        type: selectedTool as any,
        geometry: {
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          radius: 0,
          points: [world.x, world.y],
        },
        style: {
          color: '#ff6b35',
          strokeWidth: 2,
          opacity: 1
        },
        pageNumber
      })
    }
  }, [selectedTool, screenToWorld, getPageNumber, onCommentPinClick, drawings, onDrawingsChange, isPointInDrawing, pageOffsets])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    if (selectedTool === 'select' && currentDrawing.id === 'pan') {
      // Pan the viewport
      const lastX = (currentDrawing as any).lastX || 0
      const lastY = (currentDrawing as any).lastY || 0
      
      setViewport(prev => ({
        ...prev,
        panX: prev.panX + (screenX - lastX),
        panY: prev.panY + (screenY - lastY)
      }))
      setCurrentDrawing(prev => ({
        ...prev,
        lastX: screenX,
        lastY: screenY
      } as any))
    } else if (currentDrawing.type === 'rectangle') {
      const world = screenToWorld(screenX, screenY)
      setCurrentDrawing(prev => {
        if (!prev || !prev.geometry) return prev
        return {
          ...prev,
          geometry: {
            ...prev.geometry,
            width: world.x - (prev.geometry.x || 0),
            height: world.y - (prev.geometry.y || 0)
          }
        }
      })
    } else if (currentDrawing.type === 'circle') {
      const world = screenToWorld(screenX, screenY)
      const radius = Math.sqrt(
        Math.pow(world.x - (currentDrawing.geometry?.x || 0), 2) + 
        Math.pow(world.y - (currentDrawing.geometry?.y || 0), 2)
      )
      setCurrentDrawing(prev => {
        if (!prev || !prev.geometry) return prev
        return {
          ...prev,
          geometry: {
            ...prev.geometry,
            radius
          }
        }
      })
    }
  }, [isDrawing, currentDrawing, selectedTool, screenToWorld])

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentDrawing) return

    if (selectedTool === 'select' && currentDrawing.id === 'pan') {
      // End panning
      setCurrentDrawing(null)
      setIsDrawing(false)
    } else if (currentDrawing.type && currentDrawing.type !== 'comment') {
      // Save the drawing
      if (currentDrawing.geometry && currentDrawing.style) {
        const newDrawing: Drawing = {
          id: currentDrawing.id || Date.now().toString(),
          type: currentDrawing.type as any,
          geometry: currentDrawing.geometry,
          style: currentDrawing.style,
          pageNumber: currentDrawing.pageNumber || 1
        }
        
        onDrawingsChange([...drawings, newDrawing])
      }
      setCurrentDrawing(null)
      setIsDrawing(false)
    }
  }, [isDrawing, currentDrawing, selectedTool, drawings, onDrawingsChange])

  // Zoom controls
  const handleZoomIn = () => {
    setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 5) }))
  }

  const handleZoomOut = () => {
    setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.1) }))
  }

  // Handle quality mode change
  const handleQualityModeChange = useCallback((mode: QualityMode) => {
    setQualityMode(mode)
    // Clear high-res images when changing quality mode
    setHighResImages([])
  }, [])

  // Handle clear cache
  const handleClearCache = useCallback(() => {
    if (pdfUrl) {
      canvasUtils.clearPdfCache(pdfUrl)
      setHighResImages([])
    }
  }, [pdfUrl])

  return (
    <div className="flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-2">
          {/* Drawing Tools */}
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-4">
            <Button
              variant={selectedTool === 'select' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool('select')}
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedTool === 'rectangle' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool('rectangle')}
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedTool === 'circle' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool('circle')}
            >
              <Circle className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedTool === 'line' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool('line')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedTool === 'comment' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool('comment')}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant={selectedTool === 'erase' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool('erase')}
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(viewport.zoom * 100)}%
            </span>
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            {isLoadingHighRes && (
              <div className="flex items-center space-x-1 text-xs text-blue-600">
                <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Loading HD...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Toggle */}
        <div className="flex items-center space-x-2">
          <PdfQualitySettings
            qualityMode={qualityMode}
            onQualityModeChange={handleQualityModeChange}
            onClearCache={handleClearCache}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onRightSidebarToggle}
          >
            {rightSidebarOpen ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          style={{ 
            cursor: selectedTool === 'select' ? 'grab' : selectedTool === 'erase' ? 'grab' : 'crosshair',
            width: '100%',
            height: '100%'
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  )
}
