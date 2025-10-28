'use client'

import { useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ZoomIn,
  ZoomOut,
  Plus,
  Pencil,
  MessageSquare,
  X as XIcon,
  MapPin,
  User,
  Save,
  Loader2,
  Users
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

interface GuestUser {
  id: string
  name: string
  email?: string
  sessionToken: string
}

interface Annotation {
  id: string
  x: number
  y: number
  pageNumber: number
  content: string
  annotation_type: 'note' | 'question' | 'concern' | 'suggestion' | 'highlight'
  author_name: string
  author_type: 'guest' | 'user'
  created_at: string
}

interface GuestPlanAnnotatorProps {
  planId: string
  planFile: string
  planFileName: string
  guestUser: GuestUser
  allowComments: boolean
  allowDrawings: boolean
}

const ANNOTATION_TYPE_CONFIG = {
  note: { 
    color: 'bg-blue-500', 
    textColor: 'text-blue-900',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-500',
    label: 'Note'
  },
  question: { 
    color: 'bg-purple-500', 
    textColor: 'text-purple-900',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-500',
    label: 'Question'
  },
  concern: { 
    color: 'bg-red-500', 
    textColor: 'text-red-900',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-500',
    label: 'Concern'
  },
  suggestion: { 
    color: 'bg-green-500', 
    textColor: 'text-green-900',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-500',
    label: 'Suggestion'
  },
  highlight: { 
    color: 'bg-yellow-500', 
    textColor: 'text-yellow-900',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-500',
    label: 'Highlight'
  }
}

export default function GuestPlanAnnotator({
  planId,
  planFile,
  planFileName,
  guestUser,
  allowComments,
  allowDrawings
}: GuestPlanAnnotatorProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [zoom, setZoom] = useState(0.75)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pdfWidth, setPdfWidth] = useState(800)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentPageRange, setCurrentPageRange] = useState({ start: 1, end: 25 })
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])
  
  const PAGES_PER_LOAD = 25
  
  // Comment creation state
  const [isCreatingComment, setIsCreatingComment] = useState(false)
  const [pendingComment, setPendingComment] = useState<{
    x: number
    y: number
    pageNumber: number
  } | null>(null)
  const [commentForm, setCommentForm] = useState({
    annotation_type: 'note' as Annotation['annotation_type'],
    content: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  // Load annotations and generate PDF URL
  useEffect(() => {
    if (planId) {
      loadAnnotations()
      generatePdfUrl()
    }
  }, [planId])

  async function generatePdfUrl() {
    try {
      // If planFile is already a full URL, use it directly
      if (planFile.startsWith('http')) {
        setPdfUrl(planFile)
        return
      }

      const supabase = createClient()
      
      // Try to generate signed URL for the PDF file
      const { data: urlData, error } = await supabase.storage
        .from('job-plans')
        .createSignedUrl(planFile, 3600) // 1 hour expiration
      
      if (error) {
        console.error('Error creating signed URL:', error)
        // Try to use the file path as-is (might be public)
        setPdfUrl(planFile)
        return
      }
      
      if (urlData) {
        setPdfUrl(urlData.signedUrl)
      }
    } catch (error) {
      console.error('Error generating PDF URL:', error)
      // Fallback: use the file path directly
      setPdfUrl(planFile)
    }
  }

  // Update PDF width when container changes
  useEffect(() => {
    if (pdfContainerRef.current) {
      const updateWidth = () => {
        if (pdfContainerRef.current) {
          const containerWidth = pdfContainerRef.current.offsetWidth
          setPdfWidth(Math.min(containerWidth - 48, 1200))
        }
      }
      updateWidth()
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }
  }, [])

  async function loadAnnotations() {
    try {
      // Simplified: Don't load annotations for now since the view doesn't exist
      // You can implement this later when the database schema is set up
      setAnnotations([])
      
      // If you want to load annotations later, use plan_drawings table instead:
      // const supabase = createClient()
      // const { data, error } = await supabase
      //   .from('plan_drawings')
      //   .select('*')
      //   .eq('plan_id', planId)
      //   .order('created_at', { ascending: false })
      
    } catch (error) {
      console.error('Error loading annotations:', error)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    pageRefs.current = new Array(numPages).fill(null)
    setIsLoading(false)
    setLoadError(null)
    
    if (numPages > 50) {
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

  const handlePageClick = (e: React.MouseEvent, pageNumber: number) => {
    if (!allowComments) return
    
    const pageRef = pageRefs.current[pageNumber - 1]
    if (!pageRef) return
    
    const rect = pageRef.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setPendingComment({
      x: Math.max(0, Math.min(95, x)),
      y: Math.max(0, Math.min(95, y)),
      pageNumber
    })
    setIsCreatingComment(true)
  }

  const handleSaveComment = async () => {
    if (!pendingComment || !commentForm.content.trim()) {
      alert('Please enter a comment')
      return
    }

    setIsSaving(true)

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('plan_annotations')
        .insert({
          plan_file_url: planFile,
          annotation_type: commentForm.annotation_type,
          x_coordinate: pendingComment.x,
          y_coordinate: pendingComment.y,
          content: commentForm.content.trim(),
          guest_user_id: guestUser.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving annotation:', error)
        alert('Failed to save comment. Please try again.')
        return
      }

      // Add to local state
      const newAnnotation: Annotation = {
        id: data.id,
        x: pendingComment.x,
        y: pendingComment.y,
        pageNumber: pendingComment.pageNumber,
        content: commentForm.content.trim(),
        annotation_type: commentForm.annotation_type,
        author_name: guestUser.name,
        author_type: 'guest',
        created_at: data.created_at
      }

      setAnnotations(prev => [newAnnotation, ...prev])
      
      // Reset form
      setIsCreatingComment(false)
      setPendingComment(null)
      setCommentForm({
        annotation_type: 'note',
        content: ''
      })

    } catch (error) {
      console.error('Error saving comment:', error)
      alert('Failed to save comment. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelComment = () => {
    setIsCreatingComment(false)
    setPendingComment(null)
    setCommentForm({
      annotation_type: 'note',
      content: ''
    })
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  
  const handleLoadMorePages = () => {
    if (!numPages) return
    const newEnd = Math.min(currentPageRange.end + PAGES_PER_LOAD, numPages)
    setCurrentPageRange(prev => ({ ...prev, end: newEnd }))
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
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
          </div>

          {allowComments && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Click on plan to add comments
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {annotations.length} {annotations.length === 1 ? 'Comment' : 'Comments'}
          </Badge>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* PDF Viewer */}
        <div 
          ref={pdfContainerRef}
          className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950 p-4"
        >
          <div className="flex flex-col items-center">
            {!pdfUrl ? (
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-orange-600" />
                  <p className="text-gray-600 dark:text-gray-400">Preparing PDF...</p>
                </div>
              </div>
            ) : (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                onSourceSuccess={onDocumentLoadStart}
                loading={
                  <div className="flex items-center justify-center p-12">
                    <div className="text-center">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-orange-600" />
                      <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
                    </div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-12">
                    <div className="text-center text-red-600">
                      <p className="font-medium">Failed to load PDF</p>
                      {loadError && <p className="text-sm mt-2">{loadError}</p>}
                    </div>
                  </div>
                }
              >
              {numPages && Array.from({ length: currentPageRange.end }, (_, i) => i + 1).map((pageNum) => (
                <div key={pageNum} className="relative mb-4">
                  <div 
                    ref={(el) => { pageRefs.current[pageNum - 1] = el }}
                    className="relative bg-white shadow-lg cursor-crosshair"
                    onClick={(e) => handlePageClick(e, pageNum)}
                  >
                    <Page
                      pageNumber={pageNum}
                      width={pdfWidth * zoom}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                    
                    {/* Render annotations */}
                    <div className="absolute inset-0 pointer-events-none">
                      {annotations
                        .filter(ann => ann.pageNumber === pageNum)
                        .map((ann) => {
                          const config = ANNOTATION_TYPE_CONFIG[ann.annotation_type]
                          return (
                            <div
                              key={ann.id}
                              className="absolute group pointer-events-auto"
                              style={{
                                left: `${ann.x}%`,
                                top: `${ann.y}%`,
                                zIndex: 20
                              }}
                            >
                              {/* Pin marker */}
                              <div 
                                className={`${config.color} rounded-full border-2 border-white shadow-lg`}
                                style={{ 
                                  width: '16px',
                                  height: '16px',
                                  marginLeft: '-8px',
                                  marginTop: '-8px'
                                }}
                              />
                              
                              {/* Tooltip on hover */}
                              <div className={`absolute left-4 top-0 w-64 ${config.bgColor} border-2 ${config.borderColor} rounded-lg shadow-xl p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50`}>
                                <div className="flex items-center justify-between mb-2">
                                  <Badge className={config.color}>
                                    {config.label}
                                  </Badge>
                                  <div className="flex items-center text-xs text-gray-600">
                                    <User className="h-3 w-3 mr-1" />
                                    {ann.author_name}
                                  </div>
                                </div>
                                <p className="text-sm text-gray-800">{ann.content}</p>
                                <p className="text-xs text-gray-500 mt-2">
                                  {new Date(ann.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      
                      {/* Pending comment marker */}
                      {pendingComment && pendingComment.pageNumber === pageNum && (
                        <div
                          className="absolute"
                          style={{
                            left: `${pendingComment.x}%`,
                            top: `${pendingComment.y}%`,
                            zIndex: 30
                          }}
                        >
                          <div className="bg-orange-500 rounded-full border-2 border-white shadow-lg animate-pulse"
                            style={{ 
                              width: '16px',
                              height: '16px',
                              marginLeft: '-8px',
                              marginTop: '-8px'
                            }}
                          />
                        </div>
                      )}
                    </div>
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
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Load Next {Math.min(PAGES_PER_LOAD, numPages - currentPageRange.end)} Pages
                  </Button>
                </div>
              )}
              </Document>
            )}
          </div>
        </div>

        {/* Comments Panel */}
        <div className="w-96 border-l dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
            <h3 className="font-semibold text-lg flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Comments
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {annotations.length} total
            </p>
          </div>

          <div className="p-4 space-y-4">
            {/* Comment Creation Form */}
            {isCreatingComment && (
              <Card className="border-2 border-orange-500">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm flex items-center">
                      <Pencil className="h-4 w-4 mr-2 text-orange-500" />
                      New Comment
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelComment}
                      className="h-6 w-6 p-0"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <Label htmlFor="annotation-type" className="text-xs">Type</Label>
                    <Select
                      value={commentForm.annotation_type}
                      onValueChange={(value) => setCommentForm(prev => ({ 
                        ...prev, 
                        annotation_type: value as Annotation['annotation_type']
                      }))}
                    >
                      <SelectTrigger id="annotation-type" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="question">Question</SelectItem>
                        <SelectItem value="concern">Concern</SelectItem>
                        <SelectItem value="suggestion">Suggestion</SelectItem>
                        <SelectItem value="highlight">Highlight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="content" className="text-xs">Comment *</Label>
                    <Textarea
                      id="content"
                      placeholder="Enter your comment..."
                      value={commentForm.content}
                      onChange={(e) => setCommentForm(prev => ({ ...prev, content: e.target.value }))}
                      className="text-sm min-h-[80px]"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveComment}
                      className="flex-1 bg-orange-500 hover:bg-orange-600"
                      disabled={isSaving || !commentForm.content.trim()}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Comment
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelComment}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* List of annotations */}
            {annotations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm">No comments yet</p>
                {allowComments && (
                  <p className="text-xs mt-2">Click on the plan to add the first comment</p>
                )}
              </div>
            ) : (
              annotations.map((ann) => {
                const config = ANNOTATION_TYPE_CONFIG[ann.annotation_type]
                return (
                  <Card key={ann.id} className={`border-l-4 ${config.borderColor}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={config.color} variant="secondary">
                          {config.label}
                        </Badge>
                        <div className="flex items-center text-xs text-gray-600">
                          <User className="h-3 w-3 mr-1" />
                          {ann.author_name}
                        </div>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                        {ann.content}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(ann.created_at).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

