'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Download, 
  Move, 
  AlertTriangle, 
  CheckCircle, 
  Lightbulb, 
  Clock, 
  Package, 
  FileText,
  MapPin,
  User,
  X as XIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  Pencil
} from 'lucide-react'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

interface BidNote {
  id: string
  note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
  category: string | null
  location: string | null
  content: string
  confidence_score: number
  created_at: string
  page_number?: number | null // Optional page reference from subcontractor
}

interface Bid {
  id: string
  subcontractor_name?: string | null
  subcontractor_email?: string | null
  subcontractors?: {
    name: string
    email: string
  } | null
  bid_notes?: BidNote[]
}

interface PlacedNote extends BidNote {
  x: number
  y: number
  pageNumber: number // Track which page the note is on
  bidId: string
  bidderName: string
}

interface PlanAnnotatorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planFile: string
  planFileName: string
  bids: Bid[]
  jobRequestId: string
}

const NOTE_TYPE_CONFIG = {
  requirement: { 
    icon: FileText, 
    color: 'bg-blue-500', 
    textColor: 'text-blue-900',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-500'
  },
  concern: { 
    icon: AlertTriangle, 
    color: 'bg-red-500', 
    textColor: 'text-red-900',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-500'
  },
  suggestion: { 
    icon: Lightbulb, 
    color: 'bg-green-500', 
    textColor: 'text-green-900',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-500'
  },
  timeline: { 
    icon: Clock, 
    color: 'bg-yellow-500', 
    textColor: 'text-yellow-900',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-500'
  },
  material: { 
    icon: Package, 
    color: 'bg-purple-500', 
    textColor: 'text-purple-900',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-500'
  },
  other: { 
    icon: FileText, 
    color: 'bg-gray-500', 
    textColor: 'text-gray-900',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-500'
  }
}

export default function PlanAnnotatorModal({ 
  open, 
  onOpenChange, 
  planFile, 
  planFileName, 
  bids,
  jobRequestId 
}: PlanAnnotatorModalProps) {
  const [placedNotes, setPlacedNotes] = useState<PlacedNote[]>([])
  const [selectedNote, setSelectedNote] = useState<{ bidId: string; note: BidNote } | null>(null)
  const [draggingNote, setDraggingNote] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [zoom, setZoom] = useState(0.75)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pdfWidth, setPdfWidth] = useState(800)
  const [pageHeights, setPageHeights] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentPageRange, setCurrentPageRange] = useState({ start: 1, end: 25 })
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  const flexContainerRef = useRef<HTMLDivElement>(null)
  
  const PAGES_PER_LOAD = 25 // Load 25 pages at a time
  
  // Custom note creation state
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [customNoteForm, setCustomNoteForm] = useState({
    note_type: 'other' as BidNote['note_type'],
    category: '',
    location: '',
    content: '',
    page_number: ''
  })

  // Custom notes created by the user
  const [customNotes, setCustomNotes] = useState<BidNote[]>([])

  // Get all notes from all bids plus custom notes
  const allNotes = [
    ...bids.flatMap(bid => 
    (bid.bid_notes || []).map(note => ({
      ...note,
      bidId: bid.id,
      bidderName: bid.subcontractors?.name || bid.subcontractor_name || bid.subcontractor_email || 'Unknown'
    }))
    ),
    ...customNotes.map(note => ({
      ...note,
      bidId: 'custom',
      bidderName: 'You'
    }))
  ]

  // Update PDF width when container changes
  useEffect(() => {
    if (pdfContainerRef.current) {
      const updateWidth = () => {
        if (pdfContainerRef.current) {
          const containerWidth = pdfContainerRef.current.offsetWidth
          setPdfWidth(Math.min(containerWidth - 48, 1200)) // Max width 1200px
        }
      }
      updateWidth()
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }
  }, [open])

  // Update page heights when pages render
  useEffect(() => {
    if (numPages && pageRefs.current.length > 0) {
      const updateHeights = () => {
        const heights = pageRefs.current.map(ref => ref?.offsetHeight || 0)
        setPageHeights(heights)
      }
      // Use setTimeout to ensure pages have rendered
      // Longer timeout for when new pages are loading
      const timer = setTimeout(updateHeights, 500)
      return () => clearTimeout(timer)
    }
  }, [numPages, zoom, pdfWidth, currentPageRange.end]) // Add currentPageRange.end to trigger on new page loads

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    pageRefs.current = new Array(numPages).fill(null)
    setIsLoading(false)
    setLoadError(null)
    
    // For large PDFs (>50 pages), load in batches for better performance
    if (numPages > 50) {
      console.warn(`Large PDF detected: ${numPages} pages. Loading in batches of ${PAGES_PER_LOAD} for better performance.`)
      setCurrentPageRange({ start: 1, end: Math.min(PAGES_PER_LOAD, numPages) })
    } else {
      setCurrentPageRange({ start: 1, end: numPages })
    }
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setIsLoading(false)
    setLoadError(error.message || 'Failed to load PDF')
  }

  const onDocumentLoadStart = () => {
    setIsLoading(true)
    setLoadError(null)
  }

  // Auto-place notes that have page_number specified
  // Use a ref to track if we've already auto-placed notes
  const hasAutoPlaced = useRef(false)
  
  useEffect(() => {
    if (!open || !numPages || hasAutoPlaced.current) return

    const notesToAutoPlace: PlacedNote[] = []

    // Check all bidder notes for page_number
    bids.forEach(bid => {
      const notes = bid.bid_notes || []
      notes.forEach(note => {
        if (note.page_number && note.page_number >= 1 && note.page_number <= numPages) {
          const bidderName = bid.subcontractors?.name || bid.subcontractor_name || bid.subcontractor_email || 'Unknown'
          
          // Place at a default position (center-left of the page)
          notesToAutoPlace.push({
            ...note,
            x: 20, // 20% from left
            y: 50, // 50% from top (centered vertically)
            pageNumber: note.page_number,
            bidId: bid.id,
            bidderName
          })
        }
      })
    })

    // Check custom notes for page_number
    customNotes.forEach(note => {
      if (note.page_number && note.page_number >= 1 && note.page_number <= numPages) {
        notesToAutoPlace.push({
          ...note,
          x: 20,
          y: 50,
          pageNumber: note.page_number,
          bidId: 'custom',
          bidderName: 'You'
        })
      }
    })

    if (notesToAutoPlace.length > 0) {
      setPlacedNotes(notesToAutoPlace)
      hasAutoPlaced.current = true
    }
  }, [open, numPages])
  
  // Reset auto-placement flag when modal closes
  useEffect(() => {
    if (!open) {
      hasAutoPlaced.current = false
    }
  }, [open])

  const handleDragStart = (e: React.DragEvent, bidId: string, note: BidNote) => {
    e.dataTransfer.setData('noteData', JSON.stringify({ bidId, note }))
    setIsDraggingOver(true)
  }

  const handleDrop = (e: React.DragEvent, pageNumber: number) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    
    const pageRef = pageRefs.current[pageNumber - 1]
    if (!pageRef) return
    
    // Check if we're moving an existing placed note
    const placedNoteId = e.dataTransfer.getData('placedNoteId')
    if (placedNoteId) {
      // Repositioning an existing note
      const rect = pageRef.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      setPlacedNotes(prev => prev.map(note => 
        note.id === placedNoteId 
          ? { 
              ...note, 
              x: Math.max(0, Math.min(95, x)),
              y: Math.max(0, Math.min(95, y)),
              pageNumber
            }
          : note
      ))
      setDraggingNote(null)
      return
    }
    
    // Adding a new note from the panel
    const noteData = e.dataTransfer.getData('noteData')
    if (!noteData) return

    const { bidId, note } = JSON.parse(noteData)
    const rect = pageRef.getBoundingClientRect()
    
    // Calculate relative position within the PDF page
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const bid = bids.find(b => b.id === bidId)
    const bidderName = bid?.subcontractors?.name || bid?.subcontractor_name || bid?.subcontractor_email || 'Unknown'

    const placedNote: PlacedNote = {
      ...note,
      x: Math.max(0, Math.min(95, x)),
      y: Math.max(0, Math.min(95, y)),
      pageNumber,
      bidId,
      bidderName
    }

    setPlacedNotes(prev => [...prev, placedNote])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isDraggingOver) {
      setIsDraggingOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set to false if leaving the drop zone entirely
    const rect = pdfContainerRef.current?.getBoundingClientRect()
    if (rect) {
      const isOutside = e.clientX < rect.left || e.clientX > rect.right || 
                       e.clientY < rect.top || e.clientY > rect.bottom
      if (isOutside) {
        setIsDraggingOver(false)
      }
    }
  }

  const handleMovePlacedNote = (noteId: string, deltaX: number, deltaY: number) => {
    setPlacedNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { 
            ...note, 
            x: Math.max(0, Math.min(95, note.x + deltaX)),
            y: Math.max(0, Math.min(95, note.y + deltaY))
          }
        : note
    ))
  }

  const handleRemovePlacedNote = (noteId: string) => {
    setPlacedNotes(prev => prev.filter(note => note.id !== noteId))
  }

  const handleCreateCustomNote = () => {
    if (!customNoteForm.content.trim()) {
      alert('Please enter note content')
      return
    }

    const pageNum = customNoteForm.page_number ? parseInt(customNoteForm.page_number) : null
    
    // Validate page number if provided
    if (pageNum !== null && (isNaN(pageNum) || pageNum < 1 || (numPages && pageNum > numPages))) {
      alert(`Please enter a valid page number between 1 and ${numPages || '?'}`)
      return
    }

    const newNote: BidNote = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      note_type: customNoteForm.note_type,
      category: customNoteForm.category || null,
      location: customNoteForm.location || null,
      content: customNoteForm.content,
      confidence_score: 1.0, // Custom notes have 100% confidence
      created_at: new Date().toISOString(),
      page_number: pageNum
    }

    setCustomNotes(prev => [...prev, newNote])
    
    // If page number is specified and PDF is loaded, auto-place the note
    if (pageNum && numPages && pageNum >= 1 && pageNum <= numPages) {
      const placedNote: PlacedNote = {
        ...newNote,
        x: 20,
        y: 50,
        pageNumber: pageNum,
        bidId: 'custom',
        bidderName: 'You'
      }
      setPlacedNotes(prev => [...prev, placedNote])
    }
    
    // Reset form
    setCustomNoteForm({
      note_type: 'other',
      category: '',
      location: '',
      content: '',
      page_number: ''
    })
    setIsCreatingNote(false)
  }

  const handleDownloadAnnotatedPlan = async () => {
    if (placedNotes.length === 0) {
      alert('No annotations to download. Please place some notes on the plan first.')
      return
    }

    try {
      // Show loading state
      const loadingAlert = document.createElement('div')
      loadingAlert.textContent = 'Generating annotated PDF... This may take a moment for large files.'
      loadingAlert.style.cssText = 'position:fixed;top:20px;right:20px;background:#3b82f6;color:white;padding:12px 20px;border-radius:8px;z-index:10000;box-shadow:0 4px 6px rgba(0,0,0,0.1);'
      document.body.appendChild(loadingAlert)

      // Dynamic imports
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      
      // Get unique page numbers that have notes
      const pagesWithNotes = Array.from(new Set(placedNotes.map(note => note.pageNumber || 1))).sort((a, b) => a - b)
      
      // Create new PDF document (start with reasonable defaults)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
      })
      
      let firstPage = true
      
      // Check if we have the flex container ref
      if (!flexContainerRef.current) {
        throw new Error('Could not find the page container. Please try again.')
      }
      
      for (const pageNum of pagesWithNotes) {
        // Get the page container
        const pageRef = pageRefs.current[pageNum - 1]
        if (!pageRef) {
          console.warn(`Could not find page ${pageNum} to capture`)
          continue
        }
        
        // Update loading message
        loadingAlert.textContent = `Capturing page ${pageNum}... (${pagesWithNotes.indexOf(pageNum) + 1}/${pagesWithNotes.length})`
        
        // Temporarily scroll to this page to ensure it's fully rendered
        pageRef.scrollIntoView({ behavior: 'instant', block: 'center' })
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Get the position and dimensions of the page relative to the flex container
        const flexRect = flexContainerRef.current.getBoundingClientRect()
        const pageRect = pageRef.getBoundingClientRect()
        
        // Calculate the region to capture (page + margin area)
        const marginWidth = 320 // Width of margin area with comment cards
        const captureWidth = pageRect.width + marginWidth + 50 // Extra padding
        const captureHeight = pageRect.height + 20 // Small padding
        const captureX = pageRect.left - flexRect.left
        const captureY = pageRect.top - flexRect.top
        
        // Capture the specific region that includes the page and its margin
        const canvas = await html2canvas(flexContainerRef.current, {
          scale: 3, // Higher resolution for better quality and style fidelity
          useCORS: true,
          logging: false,
          backgroundColor: '#f3f4f6',
          allowTaint: true,
          foreignObjectRendering: false, // Better CSS compatibility
          imageTimeout: 0,
          removeContainer: true,
          x: captureX,
          y: captureY,
          width: captureWidth,
          height: captureHeight,
          windowWidth: flexContainerRef.current.scrollWidth,
          windowHeight: flexContainerRef.current.scrollHeight,
          onclone: (clonedDoc) => {
            // Ensure all styles are properly applied in the cloned document
            const clonedContainer = clonedDoc.querySelector('[data-html2canvas-ignore]')
            if (clonedContainer) {
              clonedContainer.removeAttribute('data-html2canvas-ignore')
            }
          }
        })
        
        const imgData = canvas.toDataURL('image/png') // Use PNG for better quality with no compression artifacts
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        
        // Calculate PDF page dimensions to fit the captured content
        const pdfWidth = 1200 // Fixed width for consistency
        const pdfHeight = (imgHeight * pdfWidth) / imgWidth
        
        // Add new page with correct dimensions
        if (!firstPage) {
          pdf.addPage([pdfWidth, pdfHeight])
        } else {
          firstPage = false
        }
        
        // For the first page, we need to delete it and recreate with correct size
        if (pagesWithNotes.indexOf(pageNum) === 0) {
          pdf.deletePage(1)
          pdf.addPage([pdfWidth, pdfHeight])
        }
        
        // Add image to PDF
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW')
        
        loadingAlert.textContent = `Processing page ${pageNum}... (${pagesWithNotes.indexOf(pageNum) + 1}/${pagesWithNotes.length})`
      }
      
      loadingAlert.textContent = 'Finalizing PDF...'
      
      // Download the PDF
      pdf.save(`${planFileName.replace('.pdf', '')}-annotated.pdf`)
      
      // Remove loading alert
      document.body.removeChild(loadingAlert)
      
      alert(`Successfully downloaded annotated PDF with ${placedNotes.length} notes across ${pagesWithNotes.length} page(s)!`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      // Remove loading alert if it exists
      const loadingAlerts = document.querySelectorAll('div[style*="Generating"], div[style*="Capturing"], div[style*="Processing"], div[style*="Finalizing"]')
      loadingAlerts.forEach(alert => {
        try {
          document.body.removeChild(alert)
        } catch (e) {
          // Ignore if already removed
        }
      })
      alert(`Failed to generate annotated PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  
  const handleLoadMorePages = () => {
    if (!numPages) return
    const newEnd = Math.min(currentPageRange.end + PAGES_PER_LOAD, numPages)
    setCurrentPageRange(prev => ({ ...prev, end: newEnd }))
    
    // Force recalculation of page heights after new pages load
    setTimeout(() => {
      const heights = pageRefs.current.map(ref => ref?.offsetHeight || 0)
      setPageHeights(heights)
    }, 1000) // Wait 1 second for pages to fully render
  }
  
  // Memoize PDF options to prevent unnecessary reloads
  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/',
  }), [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] h-[100vh] w-[100vw] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-2 sm:p-4 border-b bg-white flex-shrink-0">
            <DialogHeader className="flex-shrink min-w-0">
              <DialogTitle className="flex items-center space-x-2 text-sm sm:text-base">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">{planFileName}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 overflow-x-auto">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                >
                  <ZoomOut className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <span className="text-xs sm:text-sm font-medium min-w-[50px] sm:min-w-[60px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                >
                  <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
              {/* Download button - hide text on mobile */}
              <Button
                onClick={handleDownloadAnnotatedPlan}
                disabled={placedNotes.length === 0}
                size="sm"
                className="h-8 sm:h-9"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              {/* Close button */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0 sm:h-9 sm:w-9"
              >
                <XIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
            {/* PDF Viewer with Margin Area */}
              <div 
                ref={pdfContainerRef}
              className="flex-1 overflow-auto bg-gray-100 p-2 sm:p-4"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            >
              <div ref={flexContainerRef} className="flex flex-col lg:flex-row" style={{ gap: '12px' }}>
                {/* PDF Area - All Pages */}
                <div className="flex-shrink-0 space-y-4">
                  <Document
                    file={planFile}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    onSourceSuccess={onDocumentLoadStart}
                    options={pdfOptions}
                    loading={
                      <div className="flex items-center justify-center p-12">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                          <p className="text-gray-600">Loading PDF...</p>
                          <p className="text-xs text-gray-500 mt-2">Large files may take a moment</p>
                        </div>
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center p-12">
                        <div className="text-center text-red-600">
                          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                          <p className="font-medium">Failed to load PDF</p>
                          {loadError && (
                            <p className="text-sm mt-2 text-gray-600">{loadError}</p>
                          )}
                          <p className="text-xs mt-4 text-gray-500">
                            The file may be too large or corrupted
                          </p>
                        </div>
                      </div>
                    }
                  >
                    {/* Render pages in current range */}
                    {numPages && Array.from({ length: currentPageRange.end }, (_, i) => i + 1).map((pageNum) => (
                      <div key={pageNum} className="relative mb-4">
                        <div 
                          ref={(el) => { pageRefs.current[pageNum - 1] = el }}
                          className="relative bg-white shadow-lg"
                        >
                          <Page
                            pageNumber={pageNum}
                            width={pdfWidth * zoom}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            loading={
                              <div className="flex items-center justify-center bg-gray-50" style={{ width: pdfWidth * zoom, height: 800 }}>
                                <div className="text-gray-400 text-sm">Loading page {pageNum}...</div>
                              </div>
                            }
                          />
                      
                          {/* PDF Overlay for annotations on this page */}
                          <div 
                            className="absolute inset-0 pointer-events-none"
                            style={{ zIndex: 15 }}
                          >
                            {/* Placed Note Markers for this page only */}
                            {placedNotes
                              .filter(note => (note.pageNumber || 1) === pageNum)
                              .map((note, index) => {
                  const config = NOTE_TYPE_CONFIG[note.note_type]
                  const Icon = config.icon
                  
                  return (
                    <div
                      key={note.id}
                      className="absolute group"
                      style={{
                        left: `${note.x}%`,
                        top: `${note.y}%`,
                                    zIndex: 20,
                                    pointerEvents: 'none'
                                  }}
                                >
                            {/* Connection Line from pin to comment card */}
                            <svg 
                              className="absolute pointer-events-none"
                        style={{ 
                          left: '0px',
                                top: '8px',
                                width: '350px', // Extends to margin area
                                height: '1px',
                                overflow: 'hidden'
                              }}
                            >
                              <line
                                x1="0"
                                y1="0"
                                x2="350"
                                y2="0"
                                stroke={config.color.replace('bg-', '#').replace('blue-500', '3b82f6').replace('red-500', 'ef4444').replace('green-500', '22c55e').replace('yellow-500', 'eab308').replace('purple-500', 'a855f7').replace('gray-500', '6b7280')}
                                strokeWidth="1.5"
                                strokeDasharray="6 3"
                                opacity="0.5"
                              />
                            </svg>
                            
                            {/* Marker Pin - DRAGGABLE */}
                            <div 
                              className={`absolute ${config.color} rounded-full cursor-move shadow-md border-2 border-white hover:scale-125 transition-transform z-30 ${
                                draggingNote === note.id ? 'scale-150 opacity-75' : ''
                              }`}
                        style={{ 
                                width: '16px',
                                height: '16px',
                                left: '-8px',
                                top: '-2px',
                                pointerEvents: 'auto' // Enable dragging
                        }}
                        draggable
                        onDragStart={(e) => {
                                e.stopPropagation()
                          e.dataTransfer.setData('placedNoteId', note.id)
                          e.dataTransfer.effectAllowed = 'move'
                          setDraggingNote(note.id)
                        }}
                        onDragEnd={() => setDraggingNote(null)}
                      />

                                </div>
                              )
                            })}
                          </div>

                          {/* Transparent overlay for drag-and-drop */}
                          <div 
                            className="absolute inset-0"
                            onDrop={(e) => handleDrop(e, pageNum)}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                        style={{ 
                              zIndex: 10,
                              pointerEvents: 'auto'
                            }}
                          />

                          {/* Drop Zone Indicator - only show on first page if no notes */}
                          {pageNum === 1 && placedNotes.length === 0 && !isDraggingOver && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 15 }}>
                              <div className="bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-8 text-center max-w-md">
                                <Move className="h-12 w-12 text-blue-400 mx-auto mb-3" />
                                <p className="text-blue-600 font-medium mb-1">
                                  Drag notes from the right panel onto the plan
                                </p>
                                <p className="text-sm text-blue-500">
                                  Position them where they're relevant on the drawing
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Load More Pages Button */}
                    {numPages && currentPageRange.end < numPages && (
                      <div className="flex justify-center py-8">
                        <Button
                          onClick={handleLoadMorePages}
                          variant="outline"
                          size="lg"
                          className="shadow-lg"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Load Next {Math.min(PAGES_PER_LOAD, numPages - currentPageRange.end)} Pages
                          <span className="ml-2 text-xs text-gray-500">
                            ({currentPageRange.end} of {numPages} loaded)
                          </span>
                        </Button>
                      </div>
                    )}
                  </Document>
                </div>

                {/* Margin Area for Comment Cards - Spans all pages - Hidden on mobile */}
                <div className="hidden lg:block flex-shrink-0 relative" style={{ width: '320px' }}>
                  {pageHeights.length > 0 && placedNotes.map((note, index) => {
                    const config = NOTE_TYPE_CONFIG[note.note_type]
                    const Icon = config.icon
                    
                    // Calculate cumulative offset for this page
                    const notePageNumber = note.pageNumber || 1
                    const pageIndex = notePageNumber - 1
                    const cumulativeOffset = pageHeights.slice(0, pageIndex).reduce((sum, h) => sum + h, 0) + (pageIndex * 16) // 16px gap between pages
                    const pageHeight = pageHeights[pageIndex] || 0
                    const commentTop = cumulativeOffset + (note.y / 100) * pageHeight
                    
                    return (
                      <div
                        key={`comment-${note.id}`}
                        className={`absolute bg-white rounded-lg shadow-lg border-l-4 ${config.borderColor} w-full overflow-hidden transition-all hover:shadow-xl`}
                        style={{ 
                          top: `${commentTop}px`,
                          left: 0,
                          maxHeight: '300px',
                          zIndex: 25
                        }}
                      >
                        {/* Comment Header */}
                        <div className={`${config.bgColor} px-3 py-2 flex items-center justify-between`}>
                          <div className="flex items-center space-x-2">
                            <Icon className={`h-4 w-4 ${config.color.replace('bg-', 'text-')}`} />
                            <span className={`text-xs font-semibold uppercase ${config.textColor}`}>
                              {note.note_type}
                            </span>
                          </div>
                          <button
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            onClick={() => handleRemovePlacedNote(note.id)}
                            title="Remove note"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Comment Body */}
                        <div className="p-3">
                          <p className="text-sm text-gray-800 leading-relaxed mb-2">
                            {note.content}
                          </p>
                          
                          {/* Category and Location badges */}
                          {(note.category || note.location) && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {note.category && (
                                <Badge variant="outline" className="text-xs">
                                  {note.category}
                                </Badge>
                              )}
                              {note.location && (
                                <Badge variant="outline" className="text-xs flex items-center">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {note.location}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Comment Footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="flex items-center text-xs text-gray-600">
                              <User className="h-3 w-3 mr-1" />
                              <span className="font-medium truncate max-w-[140px]">
                                {note.bidderName}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {Math.round(note.confidence_score * 100)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                    </div>
              </div>
            </div>

            {/* Notes Panel - Right Side on desktop, bottom on mobile */}
            <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-white overflow-y-auto flex-shrink-0" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              <div className="p-3 sm:p-4 border-b bg-gray-50 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm sm:text-base">Notes</h3>
                  <Button
                    size="sm"
                    onClick={() => setIsCreatingNote(!isCreatingNote)}
                    className="h-7 text-xs sm:text-sm"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Note
                  </Button>
                </div>
                <p className="text-xs sm:text-sm text-gray-600">
                  Drag notes onto the plan to annotate ({placedNotes.length} placed)
                </p>
              </div>

              <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                {/* Custom Note Creation Form */}
                {isCreatingNote && (
                  <Card className="border-2 border-orange-500">
                    <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm flex items-center">
                          <Pencil className="h-4 w-4 mr-2 text-orange-500" />
                          Create Custom Note
                        </h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsCreatingNote(false)}
                          className="h-6 w-6 p-0"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label htmlFor="note-type" className="text-xs">Note Type</Label>
                          <Select
                            value={customNoteForm.note_type}
                            onValueChange={(value) => setCustomNoteForm(prev => ({ ...prev, note_type: value as BidNote['note_type'] }))}
                          >
                            <SelectTrigger id="note-type" className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="requirement">Requirement</SelectItem>
                              <SelectItem value="concern">Concern</SelectItem>
                              <SelectItem value="suggestion">Suggestion</SelectItem>
                              <SelectItem value="timeline">Timeline</SelectItem>
                              <SelectItem value="material">Material</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="category" className="text-xs">Category (optional)</Label>
                          <Input
                            id="category"
                            placeholder="e.g., Electrical, Plumbing"
                            value={customNoteForm.category}
                            onChange={(e) => setCustomNoteForm(prev => ({ ...prev, category: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label htmlFor="location" className="text-xs">Location (optional)</Label>
                            <Input
                              id="location"
                              placeholder="e.g., Floor 2"
                              value={customNoteForm.location}
                              onChange={(e) => setCustomNoteForm(prev => ({ ...prev, location: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label htmlFor="page_number" className="text-xs">Page # (optional)</Label>
                            <Input
                              id="page_number"
                              type="number"
                              min="1"
                              max={numPages || undefined}
                              placeholder={numPages ? `1-${numPages}` : "Page"}
                              value={customNoteForm.page_number}
                              onChange={(e) => setCustomNoteForm(prev => ({ ...prev, page_number: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="content" className="text-xs">Note Content *</Label>
                          <Textarea
                            id="content"
                            placeholder="Enter your note..."
                            value={customNoteForm.content}
                            onChange={(e) => setCustomNoteForm(prev => ({ ...prev, content: e.target.value }))}
                            className="text-sm min-h-[80px]"
                          />
                        </div>

                        <Button
                          onClick={handleCreateCustomNote}
                          className="w-full h-8"
                          disabled={!customNoteForm.content.trim()}
                        >
                          Create Note
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Custom Notes Section */}
                {customNotes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-xs sm:text-sm flex items-center">
                        <Pencil className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-orange-500" />
                        Your Notes
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {customNotes.filter(n => !placedNotes.some(p => p.id === n.id)).length}/{customNotes.length} remaining
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {customNotes.map(note => {
                        const config = NOTE_TYPE_CONFIG[note.note_type]
                        const Icon = config.icon
                        const isPlaced = placedNotes.some(p => p.id === note.id)

                        return (
                          <div
                            key={note.id}
                            draggable={!isPlaced}
                            onDragStart={(e) => !isPlaced && handleDragStart(e, 'custom', note)}
                            className={`p-2 sm:p-3 rounded-lg border-2 transition-all ${
                              isPlaced 
                                ? 'bg-gray-50 border-gray-200 opacity-50' 
                                : `cursor-move hover:shadow-md ${config.borderColor} ${config.bgColor}`
                            }`}
                          >
                            <div className="flex items-start space-x-2">
                              <div className={`p-1 rounded ${config.color}`}>
                                <Icon className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1 flex-wrap">
                                  <span className={`text-xs font-medium capitalize ${config.textColor}`}>
                                    {note.note_type}
                                  </span>
                                  {note.page_number && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300">
                                      Page {note.page_number}
                                    </Badge>
                                  )}
                                  {note.category && (
                                    <Badge variant="outline" className="text-xs">
                                      {note.category}
                                    </Badge>
                                  )}
                                  {note.location && (
                                    <Badge variant="outline" className="text-xs">
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {note.location}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-gray-700">{note.content}</p>
                                {isPlaced && (
                                  <div className="flex items-center mt-2">
                                    <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                                    <span className="text-xs text-green-600">Placed on plan</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Bidder Notes Section */}
                {bids.map(bid => {
                  const notes = bid.bid_notes || []
                  if (notes.length === 0) return null

                  const placedNoteIds = new Set(placedNotes.map(n => n.id))
                  const unplacedNotes = notes.filter(n => !placedNoteIds.has(n.id))

                  return (
                    <div key={bid.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-xs sm:text-sm truncate max-w-[200px]">
                          {bid.subcontractors?.name || bid.subcontractor_name || bid.subcontractor_email || 'Unknown'}
                        </h4>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {unplacedNotes.length}/{notes.length} remaining
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {notes.map(note => {
                          const config = NOTE_TYPE_CONFIG[note.note_type]
                          const Icon = config.icon
                          const isPlaced = placedNoteIds.has(note.id)

                          return (
                            <div
                              key={note.id}
                              draggable={!isPlaced}
                              onDragStart={(e) => !isPlaced && handleDragStart(e, bid.id, note)}
                              className={`p-2 sm:p-3 rounded-lg border-2 transition-all ${
                                isPlaced 
                                  ? 'bg-gray-50 border-gray-200 opacity-50' 
                                  : `cursor-move hover:shadow-md ${config.borderColor} ${config.bgColor}`
                              }`}
                            >
                              <div className="flex items-start space-x-2">
                                <div className={`p-1 rounded ${config.color}`}>
                                  <Icon className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2 mb-1 flex-wrap">
                                    <span className={`text-xs font-medium capitalize ${config.textColor}`}>
                                      {note.note_type}
                                    </span>
                                    {note.page_number && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300">
                                        Page {note.page_number}
                                      </Badge>
                                    )}
                                    {note.category && (
                                      <Badge variant="outline" className="text-xs">
                                        {note.category}
                                      </Badge>
                                    )}
                                    {note.location && (
                                      <Badge variant="outline" className="text-xs">
                                        <MapPin className="h-3 w-3 mr-1" />
                                        {note.location}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm text-gray-700">{note.content}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Confidence: {Math.round(note.confidence_score * 100)}%
                                  </p>
                                  {isPlaced && (
                                    <div className="flex items-center mt-2">
                                      <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                                      <span className="text-xs text-green-600">Placed on plan</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {allNotes.length === 0 && (
                  <div className="text-center py-8 sm:py-12 text-gray-500">
                    <FileText className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-xs sm:text-sm">No bidder notes available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Stats */}
          <div className="border-t bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-gray-600">
                  <strong>{placedNotes.length}</strong> placed
                </span>
                <span className="text-gray-600">
                  <strong>{allNotes.length - placedNotes.length}</strong> remaining
                </span>
              </div>
              <div className="text-gray-500 text-xs hidden sm:block">
                Drag notes onto the plan to annotate
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

