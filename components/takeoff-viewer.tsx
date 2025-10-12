'use client'

import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  Maximize2,
  Minimize2,
  Layers,
  Eye,
  EyeOff,
  Users
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
}

interface TakeoffItem {
  id: string
  item_type: string
  category: string
  description: string
  quantity: number
  unit: string
  location_reference: string | null
  confidence_score: number | null
  detection_coordinates: any | null
  plan_page_number: number | null
  detected_by: 'ai' | 'manual' | 'imported'
}

interface ActiveUser {
  id: string
  email: string
  current_view: string
  last_seen_at: string
}

interface TakeoffViewerProps {
  planFileUrl: string
  takeoffId: string
  items: TakeoffItem[]
  onItemClick?: (item: TakeoffItem) => void
  readOnly?: boolean
}

export default function TakeoffViewer({
  planFileUrl,
  takeoffId,
  items,
  onItemClick,
  readOnly = false
}: TakeoffViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showOverlays, setShowOverlays] = useState(true)
  const [showAIDetections, setShowAIDetections] = useState(true)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  
  const containerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Filter items for current page
  const currentPageItems = items.filter(
    item => !item.plan_page_number || item.plan_page_number === pageNumber
  )

  // Load PDF document
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  // Zoom controls
  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0))
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5))
  const resetZoom = () => setScale(1.0)

  // Page navigation
  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1))
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages))

  // Rotation
  const rotate = () => setRotation(prev => (prev + 90) % 360)

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Update presence in real-time
  useEffect(() => {
    const updatePresence = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('takeoff_presence')
        .upsert({
          takeoff_id: takeoffId,
          user_id: user.id,
          current_view: 'pdf',
          last_seen_at: new Date().toISOString(),
          cursor_position: { page: pageNumber, scale, rotation }
        })
    }

    updatePresence()
    const interval = setInterval(updatePresence, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [takeoffId, pageNumber, scale, rotation])

  // Subscribe to presence changes
  useEffect(() => {
    const channel = supabase
      .channel(`takeoff_presence:${takeoffId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'takeoff_presence',
          filter: `takeoff_id=eq.${takeoffId}`
        },
        async (payload) => {
          // Fetch all active users (seen in last 30 seconds)
          const { data } = await supabase
            .from('takeoff_presence')
            .select('*, users(email)')
            .eq('takeoff_id', takeoffId)
            .gte('last_seen_at', new Date(Date.now() - 30000).toISOString())

          if (data) {
            setActiveUsers(data.map((p: any) => ({
              id: p.user_id,
              email: p.users?.email || 'Unknown',
              current_view: p.current_view,
              last_seen_at: p.last_seen_at
            })))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [takeoffId])

  // Render detection overlay
  const renderDetectionOverlay = (item: TakeoffItem) => {
    if (!item.detection_coordinates || !showAIDetections || item.detected_by !== 'ai') {
      return null
    }

    const coords = item.detection_coordinates
    const isHovered = hoveredItem === item.id
    const isSelected = selectedItem === item.id

    // Simple bounding box rendering
    // Coordinates should be in format: { x, y, width, height } normalized to 0-1
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${coords.x * 100}%`,
      top: `${coords.y * 100}%`,
      width: `${coords.width * 100}%`,
      height: `${coords.height * 100}%`,
      border: isSelected ? '3px solid #ea580c' : isHovered ? '2px solid #fb923c' : '2px solid #fdba74',
      backgroundColor: isSelected ? 'rgba(234, 88, 12, 0.1)' : isHovered ? 'rgba(251, 146, 60, 0.1)' : 'rgba(253, 186, 116, 0.05)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      pointerEvents: 'auto',
      zIndex: isSelected ? 20 : isHovered ? 15 : 10
    }

    return (
      <div
        key={item.id}
        style={style}
        onClick={() => {
          setSelectedItem(item.id)
          onItemClick?.(item)
        }}
        onMouseEnter={() => setHoveredItem(item.id)}
        onMouseLeave={() => setHoveredItem(null)}
        title={`${item.description} (${item.quantity} ${item.unit})`}
      >
        {isHovered && (
          <div className="absolute -top-8 left-0 bg-black text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
            {item.description}
            <br />
            <span className="text-orange-300">{item.quantity} {item.unit}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="relative h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-2">
          {/* Page Navigation */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            Page {pageNumber} of {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <Button variant="outline" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={zoomIn} disabled={scale >= 3.0}>
            <ZoomIn className="h-4 w-4" />
          </Button>

          {/* Rotation */}
          <Button variant="outline" size="sm" onClick={rotate}>
            <RotateCw className="h-4 w-4" />
          </Button>

          {/* Overlay Toggle */}
          <Button
            variant={showOverlays ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOverlays(!showOverlays)}
            title="Toggle all overlays"
          >
            <Layers className="h-4 w-4" />
          </Button>

          {/* AI Detections Toggle */}
          <Button
            variant={showAIDetections ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAIDetections(!showAIDetections)}
            title="Toggle AI detections"
          >
            {showAIDetections ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>

          {/* Fullscreen */}
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {/* Download */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(planFileUrl, '_blank')}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Active Users Indicator */}
      {activeUsers.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b flex items-center space-x-2">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-900 font-medium">
            {activeUsers.length} {activeUsers.length === 1 ? 'user' : 'users'} viewing
          </span>
          <div className="flex -space-x-2">
            {activeUsers.slice(0, 5).map((user, index) => (
              <div
                key={user.id}
                className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold border-2 border-white"
                title={user.email}
              >
                {user.email.charAt(0).toUpperCase()}
              </div>
            ))}
            {activeUsers.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold border-2 border-white">
                +{activeUsers.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200 p-4 relative"
      >
        <div className="flex justify-center">
          <div className="relative inline-block">
            <Document
              file={planFileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                </div>
              }
              error={
                <div className="p-8 text-center">
                  <p className="text-red-600 mb-2">Failed to load PDF</p>
                  <Button onClick={() => window.location.reload()}>Retry</Button>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotate={rotation}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
              />
            </Document>

            {/* Detection Overlays */}
            {showOverlays && (
              <div className="absolute inset-0 pointer-events-none">
                {currentPageItems.map(item => renderDetectionOverlay(item))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t bg-gray-50 flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span>
            {currentPageItems.length} {currentPageItems.length === 1 ? 'item' : 'items'} on this page
          </span>
          {currentPageItems.filter(i => i.detected_by === 'ai').length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {currentPageItems.filter(i => i.detected_by === 'ai').length} AI detected
            </Badge>
          )}
        </div>
        {selectedItem && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedItem(null)}
          >
            Clear selection
          </Button>
        )}
      </div>
    </Card>
  )
}

