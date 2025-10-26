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
  ChevronLeft
} from 'lucide-react'
import { canvasUtils } from '@/lib/canvas-utils'
import PdfQualitySettings, { QualityMode } from '@/components/pdf-quality-settings'

export interface Drawing {
  id: string
  type: 'rectangle' | 'circle' | 'line' | 'comment'
  geometry: {
    x: number
    y: number
    width?: number
    height?: number
    radius?: number
    points?: number[] // For lines: [x1, y1, x2, y2, ...]
  }
  style: {
    color: string
    strokeWidth: number
    opacity?: number
  }
  pageNumber: number
  // For comments
  label?: string
  notes?: string
  noteType?: 'requirement' | 'concern' | 'suggestion' | 'other'
  category?: string
  location?: string
  layerName?: string
  zIndex?: number
  isVisible?: boolean
  isLocked?: boolean
}

export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

interface PlanCanvasProps {
  pdfImages: (HTMLCanvasElement | SVGElement)[]
  drawings: Drawing[]
  onDrawingsChange: (drawings: Drawing[]) => void
  rightSidebarOpen: boolean
  onRightSidebarToggle: () => void
  onCommentPinClick: (x: number, y: number, pageNumber: number) => void
  pdfUrl?: string // Add PDF URL for high-res rendering
}

type DrawingTool = 'select' | 'rectangle' | 'circle' | 'line' | 'comment'

export default function PlanCanvas({
  pdfImages,
  drawings,
  onDrawingsChange,
  rightSidebarOpen,
  onRightSidebarToggle,
  onCommentPinClick,
  pdfUrl
}: PlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 })
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null)
  const [pageOffsets, setPageOffsets] = useState<number[]>([])
  const [highResImages, setHighResImages] = useState<(HTMLCanvasElement | SVGElement)[]>([])
  const [isLoadingHighRes, setIsLoadingHighRes] = useState(false)
  const [qualityMode, setQualityMode] = useState<QualityMode>('balanced')
  const [useSvgRendering, setUseSvgRendering] = useState(true)

  // Calculate page offsets when PDF images change
  useEffect(() => {
    if (pdfImages.length > 0) {
      const offsets = [0]
      let cumulativeHeight = 0
      
      for (let i = 0; i < pdfImages.length - 1; i++) {
        const element = pdfImages[i]
        const height = element instanceof HTMLCanvasElement ? element.height : 
                      element instanceof SVGElement ? parseFloat(element.getAttribute('height') || '0') : 0
        cumulativeHeight += height + 20 // 20px gap between pages
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

  // Render drawings on canvas overlay
  const renderDrawings = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Save context state
    ctx.save()

    // Apply viewport transform
    ctx.translate(viewport.panX, viewport.panY)
    ctx.scale(viewport.zoom, viewport.zoom)

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
  }, [viewport, drawings, currentDrawing, pageOffsets])

  // Animation loop for drawings
  useEffect(() => {
    let animationId: number
    const animate = () => {
      renderDrawings()
      animationId = requestAnimationFrame(animate)
    }
    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [renderDrawings])

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
      
      const container = containerRef.current
      if (!container) return
      
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
    }
  }, [viewport])

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = screenToWorld(screenX, screenY)
    const pageNumber = getPageNumber(world.y)

    if (selectedTool === 'select') {
      // Start panning
      setIsDrawing(true)
      setCurrentDrawing({
        id: 'pan',
        lastX: screenX,
        lastY: screenY
      })
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
  }, [selectedTool, screenToWorld, getPageNumber, onCommentPinClick])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentDrawing) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    if (selectedTool === 'select' && currentDrawing.id === 'pan') {
      // Pan the viewport
      const lastX = currentDrawing.lastX || 0
      const lastY = currentDrawing.lastY || 0
      
      setViewport(prev => ({
        ...prev,
        panX: prev.panX + (screenX - lastX),
        panY: prev.panY + (screenY - lastY)
      }))
      setCurrentDrawing(prev => ({
        ...prev,
        lastX: screenX,
        lastY: screenY
      }))
    } else if (currentDrawing.type === 'rectangle') {
      const world = screenToWorld(screenX, screenY)
      setCurrentDrawing(prev => ({
        ...prev,
        geometry: {
          ...prev.geometry,
          width: world.x - (prev.geometry.x || 0),
          height: world.y - (prev.geometry.y || 0)
        }
      }))
    } else if (currentDrawing.type === 'circle') {
      const world = screenToWorld(screenX, screenY)
      const radius = Math.sqrt(
        Math.pow(world.x - (currentDrawing.geometry.x || 0), 2) + 
        Math.pow(world.y - (currentDrawing.geometry.y || 0), 2)
      )
      setCurrentDrawing(prev => ({
        ...prev,
        geometry: {
          ...prev.geometry,
          radius
        }
      }))
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
      const newDrawing: Drawing = {
        id: currentDrawing.id || Date.now().toString(),
        type: currentDrawing.type as any,
        geometry: currentDrawing.geometry,
        style: currentDrawing.style,
        pageNumber: currentDrawing.pageNumber || 1
      }
      
      onDrawingsChange([...drawings, newDrawing])
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

  // Handle SVG rendering mode change
  const handleSvgRenderingChange = useCallback((useSvg: boolean) => {
    setUseSvgRendering(useSvg)
    canvasUtils.setRenderingMode(useSvg)
    // Clear cache when switching modes
    if (pdfUrl) {
      canvasUtils.clearPdfCache(pdfUrl)
      setHighResImages([])
    }
  }, [pdfUrl])

  // Calculate which images to use
  const zoomThreshold = qualityMode === 'performance' ? 2.5 : 
                       qualityMode === 'balanced' ? 1.5 : 1.2
  const imagesToUse = viewport.zoom > zoomThreshold && highResImages.length > 0 ? highResImages : pdfImages

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
            useSvgRendering={useSvgRendering}
            onSvgRenderingChange={handleSvgRenderingChange}
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

      {/* PDF Container with SVG rendering */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-100"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          cursor: selectedTool === 'select' ? 'grab' : 'crosshair'
        }}
      >
        {/* PDF Pages Container */}
        <div
          className="absolute"
          style={{
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {imagesToUse.map((pdfElement, index) => {
            if (pdfElement instanceof SVGElement) {
              // Render SVG directly for perfect vector quality
              return (
                <div key={index} className="mb-5">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: pdfElement.outerHTML 
                    }}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block'
                    }}
                  />
                </div>
              )
            } else if (pdfElement instanceof HTMLCanvasElement) {
              // Fallback to canvas rendering
              return (
                <div key={index} className="mb-5">
                  <img 
                    src={pdfElement.toDataURL()} 
                    alt={`PDF Page ${index + 1}`}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block'
                    }}
                  />
                </div>
              )
            }
            return null
          })}
        </div>

        {/* Drawing Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ 
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    </div>
  )
}
