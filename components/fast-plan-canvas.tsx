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
  Eraser,
  AlertTriangle
} from 'lucide-react'

import { Drawing } from '@/lib/canvas-utils'

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
}

type DrawingTool = 'select' | 'rectangle' | 'circle' | 'line' | 'comment' | 'erase' | 'pencil'

export default function FastPlanCanvas({
  pdfUrl,
  drawings,
  onDrawingsChange,
  rightSidebarOpen,
  onRightSidebarToggle,
  onCommentPinClick
}: FastPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 })
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [numPages, setNumPages] = useState(1) // Default to 1 page for drawing area
  const [pdfPages, setPdfPages] = useState<HTMLCanvasElement[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set())
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set())
  
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
      const viewport = page.getViewport({ scale: 1.5 })
      
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
      
      // Add timeout to prevent hanging
      const renderPromise = page.render(renderContext).promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Render timeout')), 10000)
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

  // Progressive PDF loading - load pages on demand
  useEffect(() => {
    const loadPdfDocument = async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        
        // Set memory limits to prevent crashes
        pdfjs.GlobalWorkerOptions.maxImageSize = 1024 * 1024 // 1MB limit
        pdfjs.GlobalWorkerOptions.disableFontFace = true // Disable font loading to save memory
        
        const pdfDocument = await pdfjs.getDocument({
          url: pdfUrl,
          maxImageSize: 1024 * 1024, // 1MB limit per image
          disableFontFace: true, // Disable font loading
          disableAutoFetch: true, // Disable auto-fetching
          disableStream: true // Disable streaming
        }).promise
        
        pdfDocumentRef.current = pdfDocument
        setNumPages(pdfDocument.numPages)
        setPdfLoaded(true)
        setPdfError(null)
        
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

    // Draw existing drawings for current page only
    drawings.forEach(drawing => {
      if (!drawing.isVisible || drawing.pageNumber !== currentPage) return

      ctx.strokeStyle = drawing.style.color
      ctx.fillStyle = `${drawing.style.color}20` // 20% opacity
      ctx.lineWidth = drawing.style.strokeWidth / viewport.zoom

      // No page offset needed since we only show current page
      const x = drawing.geometry.x
      const y = drawing.geometry.y

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
            ctx.moveTo(drawing.geometry.points[0], drawing.geometry.points[1])
            ctx.lineTo(drawing.geometry.points[2], drawing.geometry.points[3])
            ctx.stroke()
          }
          break
        case 'pencil':
          if (drawing.geometry.points && drawing.geometry.points.length >= 2) {
            ctx.beginPath()
            ctx.moveTo(drawing.geometry.points[0], drawing.geometry.points[1])
            for (let i = 2; i < drawing.geometry.points.length; i += 2) {
              ctx.lineTo(drawing.geometry.points[i], drawing.geometry.points[i + 1])
            }
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

    // Draw current drawing being created (only if on current page)
    if (currentDrawing && currentDrawing.geometry && currentDrawing.pageNumber === currentPage) {
      ctx.strokeStyle = currentDrawing.style?.color || '#ff6b35'
      ctx.fillStyle = `${currentDrawing.style?.color || '#ff6b35'}20`
      ctx.lineWidth = (currentDrawing.style?.strokeWidth || 2) / viewport.zoom

      // No page offset needed since we only show current page
      const x = currentDrawing.geometry.x
      const y = currentDrawing.geometry.y

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
            ctx.moveTo(currentDrawing.geometry.points[0], currentDrawing.geometry.points[1])
            ctx.lineTo(currentDrawing.geometry.points[2], currentDrawing.geometry.points[3])
            ctx.stroke()
          }
          break
        case 'pencil':
          if (currentDrawing.geometry.points && currentDrawing.geometry.points.length >= 2) {
            ctx.beginPath()
            ctx.moveTo(currentDrawing.geometry.points[0], currentDrawing.geometry.points[1])
            for (let i = 2; i < currentDrawing.geometry.points.length; i += 2) {
              ctx.lineTo(currentDrawing.geometry.points[i], currentDrawing.geometry.points[i + 1])
            }
            ctx.stroke()
          }
          break
      }
    }

    // Restore context state
    ctx.restore()
  }, [viewport, drawings, currentDrawing, currentPage])

  // Set canvas dimensions
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect()
      
      // Size canvas to match PDF dimensions if available, otherwise use container
      if (pdfPages.length > 0 && pdfPages[currentPage - 1]) {
        const pdfPage = pdfPages[currentPage - 1]
        canvas.width = pdfPage.width
        canvas.height = pdfPage.height
        canvas.style.width = `${pdfPage.width}px`
        canvas.style.height = `${pdfPage.height}px`
      } else {
        // Fallback to container size
        canvas.width = rect.width
        canvas.height = rect.height
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
      }
      
      // Set canvas style properties
      canvas.style.position = 'absolute'
      canvas.style.top = '0'
      canvas.style.left = '0'
      canvas.style.zIndex = '10' // Ensure it's above PDF canvas elements
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [pdfPages.length, currentPage])

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

  // Check if a point intersects with a drawing (only for current page)
  const isPointInDrawing = useCallback((x: number, y: number, drawing: Drawing) => {
    // Only check drawings on current page
    if (drawing.pageNumber !== currentPage) return false
    
    const geom = drawing.geometry
    // No page offset needed since we only show current page
    const drawY = geom.y
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
        // No page offset needed
        const offsetY1 = y1
        const offsetY2 = y2
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
      
      case 'pencil':
        if (!geom.points || geom.points.length < 4) return false
        // Check distance from point to any line segment in the pencil path
        for (let i = 0; i < geom.points.length - 2; i += 2) {
          const [x1, y1, x2, y2] = [geom.points[i], geom.points[i + 1], geom.points[i + 2], geom.points[i + 3]]
          const A = y2 - y1
          const B = x1 - x2
          const C = x2 * y1 - x1 * y2
          const distToLine = Math.abs(A * x + B * y + C) / Math.sqrt(A * A + B * B)
          const minX = Math.min(x1, x2)
          const maxX = Math.max(x1, x2)
          const minY = Math.min(y1, y2)
          const maxY = Math.max(y1, y2)
          if (distToLine <= threshold && x >= minX - threshold && x <= maxX + threshold &&
              y >= minY - threshold && y <= maxY + threshold) {
            return true
          }
        }
        return false
      
      case 'comment':
        const commentRadius = 15 / viewport.zoom
        return Math.sqrt(Math.pow(x - geom.x, 2) + Math.pow(y - drawY + commentRadius, 2)) <= commentRadius
      
      default:
        return false
    }
  }, [viewport.zoom, currentPage])

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const world = screenToWorld(screenX, screenY)
    // Always use current page since we only show one page at a time
    const pageNumber = currentPage

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
  }, [selectedTool, screenToWorld, currentPage, onCommentPinClick, drawings, onDrawingsChange, isPointInDrawing])

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
      } else if (currentDrawing.type === 'pencil') {
        setCurrentDrawing(prev => {
          if (!prev || !prev.geometry) return prev
          return {
            ...prev,
            geometry: {
              ...prev.geometry,
              points: [...(prev.geometry.points || []), world.x, world.y]
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
          {/* PDF Error Warning */}
          {pdfError && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-100 border border-yellow-300 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-700">{pdfError}</span>
            </div>
          )}

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

          {/* Pagination Controls */}
          {numPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 min-w-[80px] text-center">
                Page {currentPage} of {numPages}
                {loadingPages.has(currentPage) && (
                  <span className="text-blue-500 ml-1">(Loading...)</span>
                )}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
                disabled={currentPage >= numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
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
        <canvas
          ref={drawingCanvasRef}
          className="absolute"
          style={{ 
            pointerEvents: 'auto',
            width: '100%',
            height: '100%',
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
            zIndex: '10' // Ensure it's above PDF canvas elements
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  )
}
