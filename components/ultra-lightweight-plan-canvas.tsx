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

interface UltraLightweightPlanCanvasProps {
  pdfUrl: string
  drawings: Drawing[]
  onDrawingsChange: (drawings: Drawing[]) => void
  rightSidebarOpen: boolean
  onRightSidebarToggle: () => void
  onCommentPinClick: (x: number, y: number, pageNumber: number) => void
}

type DrawingTool = 'select' | 'rectangle' | 'circle' | 'line' | 'comment' | 'erase'

export default function UltraLightweightPlanCanvas({
  pdfUrl,
  drawings,
  onDrawingsChange,
  rightSidebarOpen,
  onRightSidebarToggle,
  onCommentPinClick
}: UltraLightweightPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 })
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [numPages, setNumPages] = useState(0)

  // Load PDF and get page count (minimal memory usage)
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        
        const pdf = await pdfjs.getDocument(pdfUrl).promise
        setNumPages(pdf.numPages)
        setPdfLoaded(true)
        
        // Immediately destroy the PDF object to free memory
        pdf.destroy()
      } catch (error) {
        console.error('Error loading PDF:', error)
      }
    }

    if (pdfUrl) {
      loadPdf()
    }
  }, [pdfUrl])

  // Render drawings on the drawing canvas
  const renderDrawings = useCallback(() => {
    const canvas = drawingCanvasRef.current
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

      // Calculate page offset (assuming 800px width per page + 20px gap)
      const pageOffset = (drawing.pageNumber - 1) * (800 + 20)
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

      const pageOffset = ((currentDrawing.pageNumber || 1) - 1) * (800 + 20)
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
  }, [viewport, drawings, currentDrawing])

  // Set canvas dimensions
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  // Render drawings when dependencies change
  useEffect(() => {
    renderDrawings()
  }, [renderDrawings])

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

  // Check if a point intersects with a drawing
  const isPointInDrawing = useCallback((x: number, y: number, drawing: Drawing) => {
    const geom = drawing.geometry
    const pageOffset = (drawing.pageNumber - 1) * (800 + 20)
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
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = screenToWorld(screenX, screenY)
    const pageNumber = getPageNumber(world.y)

    if (selectedTool === 'erase') {
      // Find and remove drawing at this point
      const clickedDrawing = drawings.find(d => 
        d.pageNumber === pageNumber && isPointInDrawing(world.x, world.y, d)
      )
      
      if (clickedDrawing) {
        onDrawingsChange(drawings.filter(d => d.id !== clickedDrawing.id))
      }
      return
    }

    if (selectedTool === 'select') {
      // Start panning
      setIsPanning(true)
      setLastPanPoint({ x: screenX, y: screenY })
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
  }, [selectedTool, screenToWorld, getPageNumber, onCommentPinClick, drawings, onDrawingsChange, isPointInDrawing])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    if (isPanning) {
      // Pan the viewport
      setViewport(prev => ({
        ...prev,
        panX: prev.panX + (screenX - lastPanPoint.x),
        panY: prev.panY + (screenY - lastPanPoint.y)
      }))
      setLastPanPoint({ x: screenX, y: screenY })
    } else if (isDrawing && currentDrawing) {
      const world = screenToWorld(screenX, screenY)
      
      if (currentDrawing.type === 'rectangle') {
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
      } else if (currentDrawing.type === 'line') {
        setCurrentDrawing(prev => {
          if (!prev || !prev.geometry) return prev
          return {
            ...prev,
            geometry: {
              ...prev.geometry,
              points: [(prev.geometry.x || 0), (prev.geometry.y || 0), world.x, world.y]
            }
          }
        })
      }
    }
  }, [isPanning, isDrawing, currentDrawing, screenToWorld, lastPanPoint])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      // End panning
      setIsPanning(false)
    } else if (isDrawing && currentDrawing && currentDrawing.type && currentDrawing.type !== 'comment') {
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
  }, [isPanning, isDrawing, currentDrawing, drawings, onDrawingsChange])

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
          </div>
        </div>

        {/* Right Sidebar Toggle */}
        <div className="flex items-center space-x-2">
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
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-100"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          cursor: selectedTool === 'select' ? (isPanning ? 'grabbing' : 'grab') : 
                 selectedTool === 'erase' ? 'grab' : 'crosshair'
        }}
      >
        {/* PDF Container - Direct URL embedding */}
        <div
          className="absolute"
          style={{
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {Array.from({ length: numPages }, (_, index) => (
            <div key={index} className="mb-5">
              <iframe
                src={`${pdfUrl}#page=${index + 1}&toolbar=0&navpanes=0&scrollbar=0&zoom=${Math.round(viewport.zoom * 100)}`}
                width="800"
                height="600"
                style={{
                  border: 'none',
                  display: 'block',
                  pointerEvents: 'none' // Let drawing canvas handle interactions
                }}
                title={`PDF Page ${index + 1}`}
              />
            </div>
          ))}
        </div>

        {/* Drawing Canvas Overlay */}
        <canvas
          ref={drawingCanvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ 
            pointerEvents: 'auto',
            width: '100%',
            height: '100%'
          }}
        />
      </div>
    </div>
  )
}

