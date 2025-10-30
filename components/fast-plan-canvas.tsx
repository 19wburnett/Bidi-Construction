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
  Star
} from 'lucide-react'

import { Drawing } from '@/lib/canvas-utils'
import CommentPopup from '@/components/comment-popup'

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
}

type DrawingTool = 'comment' | 'none'

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
  onClearCache
}: FastPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const [viewport, setViewport] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 })
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('comment')
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [selectedComment, setSelectedComment] = useState<Drawing | null>(null)
  const [showCommentPopup, setShowCommentPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
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

  // Progressive PDF loading - load pages on demand
  useEffect(() => {
    const loadPdfDocument = async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        
        // Set worker source
        
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

  // Render drawings on the drawing canvas
  const renderDrawings = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Debug: Draw a test marker at top-left to verify canvas is rendering
    ctx.fillStyle = 'red'
    ctx.fillRect(0, 0, 20, 20)

    // Draw only comment drawings for current page
    const commentsForPage = drawings.filter(drawing => drawing.type === 'comment' && drawing.pageNumber === currentPage)
    
    // Debug log
    console.log('Rendering comments:', { 
      total: commentsForPage.length, 
      page: currentPage,
      canvasSize: `${canvas.width}x${canvas.height}` 
    })
    
    commentsForPage.forEach(drawing => {
        // Check if geometry has valid x and y values
        if (!drawing.geometry || typeof drawing.geometry.x === 'undefined' || typeof drawing.geometry.y === 'undefined') {
          console.warn('Comment missing geometry:', drawing)
          return
        }
        
        // Use world coordinates directly - the canvas transform handles the viewport
        const worldX = drawing.geometry.x
        const worldY = drawing.geometry.y
        
        console.log('Drawing comment at:', { worldX, worldY, pageNumber: drawing.pageNumber, canvas: { width: canvas.width, height: canvas.height } })
        
        // Draw comment bubble at world position
        // Note: size is in world coordinates, actual pixel size will be scaled by canvas transform
        const bubbleRadius = 12
        
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
  }, [drawings, currentPage, selectedComment])

  // Set canvas dimensions
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      console.log('Canvas setup failed:', { canvas: !!canvas, container: !!container })
      return
    }

    const resizeCanvas = () => {
      // Size canvas to match PDF dimensions if available, otherwise use container
      if (pdfPages.length > 0 && pdfPages[currentPage - 1]) {
        const pdfPage = pdfPages[currentPage - 1]
        canvas.width = pdfPage.width
        canvas.height = pdfPage.height
        canvas.style.width = `${pdfPage.width}px`
        canvas.style.height = `${pdfPage.height}px`
        console.log('Canvas sized for PDF:', { width: canvas.width, height: canvas.height, pageWidth: pdfPage.width, pageHeight: pdfPage.height })
      } else {
        console.log('No PDF pages available yet, waiting...', { pdfPagesLength: pdfPages.length, currentPage })
        // Don't resize canvas yet - wait for PDF pages to load
        return
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [pdfPages.length, currentPage])

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
      console.log('Auto-fitted zoom:', { finalZoom, containerWidth, containerHeight, pageWidth: pdfPage.width, pageHeight: pdfPage.height })
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
    const threshold = 15 / viewport.zoom // Click tolerance for comment bubbles (scaled by zoom)
    
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

    if (selectedTool === 'comment') {
      // Check if clicking on an existing comment
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
      } else {
        // Place new comment pin
        onCommentPinClick(world.x, world.y, pageNumber)
      }
    } else if (selectedTool === 'none') {
      // Start panning
      setIsPanning(true)
      setLastPanPoint({ x: screenX, y: screenY })
    }
  }, [selectedTool, screenToWorld, currentPage, onCommentPinClick, drawings, onDrawingsChange, isPointInComment, onCommentClick])

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
    }
  }, [isPanning, lastPanPoint])

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
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

          {/* Comment Tool */}
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-4">
            <Button
              variant={selectedTool === 'comment' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool('comment')}
              title="Add comment"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="text-sm">Add Comment</span>
            </Button>
            {selectedTool === 'comment' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTool('none')}
                title="Pan view"
              >
                <span className="text-sm">Pan</span>
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
            <div className="group relative">
              <Button variant="ghost" size="sm" className="px-2">
                <Info className="h-4 w-4 text-gray-400" />
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
          cursor: selectedTool === 'none' ? (isPanning ? 'grabbing' : 'grab') : 
                 selectedTool === 'comment' ? 'crosshair' : 'default'
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
          onMouseLeave={handleMouseUp}
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
