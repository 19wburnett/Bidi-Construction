// Example usage of the new efficient canvas-based plan viewer
// This replaces the SVG-based system that was causing memory issues

import PlanCanvasEfficient from '@/components/plan-canvas-efficient'
import { canvasUtils } from '@/lib/canvas-utils'
import { useState, useEffect } from 'react'

export default function PlanViewerExample({ pdfUrl }: { pdfUrl: string }) {
  const [pdfImages, setPdfImages] = useState<HTMLCanvasElement[]>([])
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [loading, setLoading] = useState(true)

  // Load PDF images using the new efficient canvas-only method
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true)
        // Use the new canvas-only loading method
        const images = await canvasUtils.loadPdfImages(pdfUrl, 2)
        setPdfImages(images)
      } catch (error) {
        console.error('Error loading PDF:', error)
      } finally {
        setLoading(false)
      }
    }

    if (pdfUrl) {
      loadPdf()
    }
  }, [pdfUrl])

  const handleDrawingsChange = (newDrawings: Drawing[]) => {
    setDrawings(newDrawings)
  }

  const handleCommentPinClick = (x: number, y: number, pageNumber: number) => {
    // Handle comment pin placement
    console.log('Comment pin clicked:', { x, y, pageNumber })
  }

  if (loading) {
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
    <PlanCanvasEfficient
      pdfImages={pdfImages}
      drawings={drawings}
      onDrawingsChange={handleDrawingsChange}
      rightSidebarOpen={false}
      onRightSidebarToggle={() => {}}
      onCommentPinClick={handleCommentPinClick}
      pdfUrl={pdfUrl}
    />
  )
}

