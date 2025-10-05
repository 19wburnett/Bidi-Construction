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
  subcontractor_name: string | null
  subcontractor_email: string
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
  const [currentPageRange, setCurrentPageRange] = useState({ start: 1, end: 5 })
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  
  const PAGES_PER_LOAD = 5 // Load 5 pages at a time
  
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
      bidderName: bid.subcontractor_name || bid.subcontractor_email
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
    
    // For large PDFs, only load first 5 pages initially
    if (numPages > 10) {
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
          const bidderName = bid.subcontractor_name || bid.subcontractor_email || 'Unknown'
          
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
    const bidderName = bid?.subcontractor_name || bid?.subcontractor_email || 'Unknown'

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
      loadingAlert.textContent = 'Generating annotated PDF... This may take a moment.'
      loadingAlert.style.cssText = 'position:fixed;top:20px;right:20px;background:#3b82f6;color:white;padding:12px 20px;border-radius:8px;z-index:10000;'
      document.body.appendChild(loadingAlert)

      // Dynamic import of pdf-lib
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
      
      // Fetch the original PDF
      const existingPdfBytes = await fetch(planFile).then(res => res.arrayBuffer())
      
      // Load the PDF
      const pdfDoc = await PDFDocument.load(existingPdfBytes)
      const pages = pdfDoc.getPages()
      
      // Embed font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      
      // Get unique page numbers that have notes
      const pagesWithNotes = Array.from(new Set(placedNotes.map(note => note.pageNumber || 1)))
      
      // Process only pages with notes
      let totalNotesDrawn = 0
      for (const pageNum of pagesWithNotes) {
        const pageIndex = pageNum - 1
        if (pageIndex < 0 || pageIndex >= pages.length) continue
        
        const page = pages[pageIndex]
        const { width: pageWidth, height: pageHeight } = page.getSize()
        
        // Get notes for this page
        const pageNotes = placedNotes.filter(note => (note.pageNumber || 1) === pageNum)
        
        // Pre-calculate the maximum height needed for all notes on this page
        let maxHeightNeeded = pageHeight
        
        for (const note of pageNotes) {
          const pinY = pageHeight - (note.y / 100) * pageHeight
          
          // Calculate comment height
          const words = note.content.split(' ')
          let estimatedLines = 0
          let currentLine = ''
          for (const word of words) {
            const testLine = currentLine + word + ' '
            const textWidth = font.widthOfTextAtSize(testLine, 8)
            if (textWidth > 264) { // commentWidth - 16
              estimatedLines++
              currentLine = word + ' '
            } else {
              currentLine = testLine
            }
          }
          if (currentLine.length > 0) estimatedLines++
          
          let totalHeight = 35
          if (note.category) totalHeight += 12
          if (note.location) totalHeight += 12
          totalHeight += 5
          totalHeight += (estimatedLines * 12) + 10
          totalHeight += 15
          const commentHeight = Math.max(100, totalHeight)
          
          // Calculate where the comment box would be positioned
          let commentY = pinY - (commentHeight / 2)
          if (commentY < 10) commentY = 10
          
          const commentTop = commentY + commentHeight
          
          // Track the highest point any comment reaches
          if (commentTop > maxHeightNeeded) {
            maxHeightNeeded = commentTop
          }
        }
        
        // Add generous padding (100px at top to ensure boxes don't get cut off)
        maxHeightNeeded += 100
        
        // Expand the page to include margin and ensure all comments fit
        const marginWidth = 350
        page.setSize(pageWidth + marginWidth, maxHeightNeeded)
        
        // Draw each note
        for (const note of pageNotes) {
          try {
            totalNotesDrawn++
            const config = NOTE_TYPE_CONFIG[note.note_type]
          
          // Convert percentage position to PDF coordinates (PDF origin is bottom-left)
          // IMPORTANT: Use pageHeight (original) for the Y percentage calculation, not maxHeightNeeded
          const pinX = (note.x / 100) * pageWidth
          const pinY = pageHeight - (note.y / 100) * pageHeight
          
          // Draw pin (small circle)
          const pinRadius = 6
          page.drawCircle({
            x: pinX,
            y: pinY,
            size: pinRadius,
            color: getColorFromConfig(config.color, rgb),
            borderColor: rgb(1, 1, 1),
            borderWidth: 2,
          })
          
          // Draw connection line to margin
          const marginX = pageWidth + 20
          page.drawLine({
            start: { x: pinX, y: pinY },
            end: { x: marginX, y: pinY },
            thickness: 1,
            color: getColorFromConfig(config.color, rgb),
            opacity: 0.5,
            dashArray: [6, 3],
          })
          
          // Calculate comment box dimensions
          const words = note.content.split(' ')
          const commentWidth = 280
          const fontSize = 8
          const lineHeight = 12
          
          // Estimate number of lines needed for content
          let estimatedLines = 0
          let currentLine = ''
          for (const word of words) {
            const testLine = currentLine + word + ' '
            const textWidth = font.widthOfTextAtSize(testLine, fontSize)
            if (textWidth > commentWidth - 16) {
              estimatedLines++
              currentLine = word + ' '
            } else {
              currentLine = testLine
            }
          }
          if (currentLine.length > 0) estimatedLines++
          
          // Calculate total height needed
          let totalHeight = 35 // Header (type + bidder)
          if (note.category) totalHeight += 12
          if (note.location) totalHeight += 12
          totalHeight += 5 // Spacing before content
          totalHeight += (estimatedLines * lineHeight) + 10 // Content
          totalHeight += 15 // Bottom padding for confidence score
          
          const commentHeight = Math.max(100, totalHeight)
          const commentX = marginX + 10
          
          // Center comment box on pin (page has been expanded to fit)
          let commentY = pinY - (commentHeight / 2)
          // Ensure it doesn't go below the bottom
          if (commentY < 10) commentY = 10
          
          // Draw comment background
          page.drawRectangle({
            x: commentX,
            y: commentY,
            width: commentWidth,
            height: commentHeight,
            color: rgb(1, 1, 1),
            borderColor: getColorFromConfig(config.color, rgb),
            borderWidth: 3,
          })
          
          // Draw note type header
          page.drawText(note.note_type.toUpperCase(), {
            x: commentX + 8,
            y: commentY + commentHeight - 15,
            size: 9,
            font: boldFont,
            color: getColorFromConfig(config.color, rgb),
          })
          
          // Draw bidder name
          page.drawText(note.bidderName, {
            x: commentX + 8,
            y: commentY + commentHeight - 28,
            size: 8,
            font: font,
            color: rgb(0.3, 0.3, 0.3),
          })
          
          // Draw category and location if available
          let currentY = commentY + commentHeight - 40
          if (note.category) {
            page.drawText(`Category: ${note.category}`, {
              x: commentX + 8,
              y: currentY,
              size: 7,
              font: font,
              color: rgb(0.4, 0.4, 0.4),
            })
            currentY -= 12
          }
          if (note.location) {
            page.drawText(`Location: ${note.location}`, {
              x: commentX + 8,
              y: currentY,
              size: 7,
              font: font,
              color: rgb(0.4, 0.4, 0.4),
            })
            currentY -= 12
          }
          
          // Draw full note content with word wrap (no truncation)
          currentY -= 5 // Add spacing before content
          let line = ''
          
          for (const word of words) {
            const testLine = line + word + ' '
            const textWidth = font.widthOfTextAtSize(testLine, fontSize)
            
            if (textWidth > commentWidth - 16 && line.length > 0) {
              // Draw the current line
              page.drawText(line.trim(), {
                x: commentX + 8,
                y: currentY,
                size: fontSize,
                font: font,
                color: rgb(0, 0, 0),
              })
              line = word + ' '
              currentY -= lineHeight
              
              // Stop if we're about to go below the bottom padding
              if (currentY < commentY + 20) break
            } else {
              line = testLine
            }
          }
          
          // Draw remaining text
          if (line.trim().length > 0 && currentY >= commentY + 20) {
            page.drawText(line.trim(), {
              x: commentX + 8,
              y: currentY,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0),
            })
          }
          
          // Draw confidence score
          page.drawText(`${Math.round(note.confidence_score * 100)}%`, {
            x: commentX + commentWidth - 30,
            y: commentY + 5,
            size: 7,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
          })
          
          } catch (noteError) {
            console.error(`Error drawing note ${totalNotesDrawn}:`, noteError)
            // Continue with other notes even if one fails
          }
        }
      }
      
      // Save the PDF
      const pdfBytes = await pdfDoc.save()
      
      // Remove loading alert
      document.body.removeChild(loadingAlert)
      
      // Create blob and download
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${planFileName.replace('.pdf', '')}-annotated.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      alert(`Successfully downloaded PDF with ${totalNotesDrawn} annotations!`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      // Remove loading alert if it exists
      const loadingAlert = document.querySelector('div[style*="Generating annotated PDF"]')
      if (loadingAlert) document.body.removeChild(loadingAlert)
      alert(`Failed to generate annotated PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Helper function to convert Tailwind color classes to RGB
  function getColorFromConfig(colorClass: string, rgbFn: (r: number, g: number, b: number) => any) {
    const colorMap: Record<string, [number, number, number]> = {
      'bg-blue-500': [0.23, 0.51, 0.96],
      'bg-red-500': [0.94, 0.27, 0.27],
      'bg-green-500': [0.13, 0.77, 0.37],
      'bg-yellow-500': [0.92, 0.70, 0.03],
      'bg-purple-500': [0.66, 0.33, 0.97],
      'bg-gray-500': [0.42, 0.45, 0.50],
    }
    const color = colorMap[colorClass] || [0.5, 0.5, 0.5]
    return rgbFn(color[0], color[1], color[2])
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
          <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>{planFileName}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleDownloadAnnotatedPlan}
                disabled={placedNotes.length === 0}
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Annotated Plan
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* PDF Viewer with Margin Area */}
              <div 
                ref={pdfContainerRef}
              className="flex-1 overflow-auto bg-gray-100 p-4"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            >
              <div className="flex" style={{ gap: '24px' }}>
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

                {/* Margin Area for Comment Cards - Spans all pages */}
                <div className="flex-shrink-0 relative" style={{ width: '320px' }}>
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

            {/* Notes Panel - Right Side */}
            <div className="w-96 border-l bg-white overflow-y-auto flex-shrink-0" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              <div className="p-4 border-b bg-gray-50 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Notes</h3>
                  <Button
                    size="sm"
                    onClick={() => setIsCreatingNote(!isCreatingNote)}
                    className="h-7"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Note
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Drag notes onto the plan to annotate ({placedNotes.length} placed)
                </p>
              </div>

              <div className="p-4 space-y-4">
                {/* Custom Note Creation Form */}
                {isCreatingNote && (
                  <Card className="border-2 border-orange-500">
                    <CardContent className="p-4 space-y-3">
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
                      <h4 className="font-medium text-sm flex items-center">
                        <Pencil className="h-4 w-4 mr-2 text-orange-500" />
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
                            className={`p-3 rounded-lg border-2 transition-all ${
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
                                <p className="text-sm text-gray-700">{note.content}</p>
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
                        <h4 className="font-medium text-sm">
                          {bid.subcontractor_name || bid.subcontractor_email}
                        </h4>
                        <Badge variant="outline" className="text-xs">
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
                              className={`p-3 rounded-lg border-2 transition-all ${
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
                                  <p className="text-sm text-gray-700">{note.content}</p>
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
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm">No bidder notes available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Stats */}
          <div className="border-t bg-gray-50 px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span className="text-gray-600">
                  <strong>{placedNotes.length}</strong> notes placed
                </span>
                <span className="text-gray-600">
                  <strong>{allNotes.length - placedNotes.length}</strong> notes remaining
                </span>
              </div>
              <div className="text-gray-500 text-xs">
                Drag notes onto the plan to annotate • Hover over placed notes to see details
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

