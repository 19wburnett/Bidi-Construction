'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Move, 
  MessageSquare,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'
import { Drawing } from '@/lib/canvas-utils'

export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

interface PlanCanvasProps {
  pdfImages: HTMLCanvasElement[]
  drawings: Drawing[]
  onDrawingsChange: (drawings: Drawing[]) => void
  rightSidebarOpen: boolean
  onRightSidebarToggle: () => void
  onCommentPinClick: (x: number, y: number, pageNumber: number) => void
  pdfUrl?: string
}

type DrawingTool = 'comment' | 'none'

export default function PlanCanvasEfficient({
  pdfImages,
  drawings,
  onDrawingsChange,
  rightSidebarOpen,
  onRightSidebarToggle,
  onCommentPinClick,
  pdfUrl
}: PlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 })
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('comment')
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [pageOffsets, setPageOffsets] = useState<number[]>([])

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

    // Draw only comments
    drawings.forEach(drawing => {
      if (!drawing.isVisible) return
      if (drawing.type !== 'comment') return

      ctx.strokeStyle = drawing.style.color
      ctx.fillStyle = `${drawing.style.color}20`
      ctx.lineWidth = drawing.style.strokeWidth / viewport.zoom

      const pageOffset = pageOffsets[drawing.pageNumber - 1] || 0
      const x = drawing.geometry.x ?? 0
      const y = (drawing.geometry.y ?? 0) + pageOffset

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
    })

    // No active shape drawing – comments are placed via click

    // Restore context state
    ctx.restore()
  }, [viewport, drawings, pageOffsets])

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

  // Check if a point intersects with a comment
  const isPointInComment = useCallback((x: number, y: number, drawing: Drawing, pageOffset: number) => {
    if (drawing.type !== 'comment') return false
    const geom = drawing.geometry
    if (geom.x === undefined || geom.y === undefined) return false
    const drawY = geom.y + pageOffset
    const commentRadius = 15 / viewport.zoom
    return Math.sqrt(Math.pow(x - geom.x, 2) + Math.pow(y - drawY + commentRadius, 2)) <= commentRadius
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

    if (selectedTool === 'none') {
      // Start panning
      setIsPanning(true)
      setLastPanPoint({ x: screenX, y: screenY })
    } else if (selectedTool === 'comment') {
      // Place comment pin
      onCommentPinClick(world.x, world.y, pageNumber)
    }
  }, [selectedTool, screenToWorld, getPageNumber, onCommentPinClick, pageOffsets])

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
    }
  }, [isPanning, lastPanPoint])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      // End panning
      setIsPanning(false)
    }
  }, [isPanning])

  // Zoom controls
  const handleZoomIn = () => {
    setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 5) }))
  }

  const handleZoomOut = () => {
    setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.1) }))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-2">
      {/* Comment Tool */}
      <div className="flex items-center space-x-1 border-r border-gray-200 pr-4">
        <Button
          variant={selectedTool === 'comment' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedTool('comment')}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
        {selectedTool === 'comment' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTool('none')}
          >
            <Move className="h-4 w-4" />
          </Button>
        )}
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
          cursor: selectedTool === 'none' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair'
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
          {pdfImages.map((canvas, index) => (
            <div key={index} className="mb-5">
              <img 
                src={canvas.toDataURL()} 
                alt={`PDF Page ${index + 1}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block'
                }}
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

