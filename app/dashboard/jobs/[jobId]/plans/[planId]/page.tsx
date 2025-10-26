'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  ArrowLeft,
  Share2,
  Package,
  Eye,
  Settings,
  Save,
  Download,
  BarChart3,
  AlertTriangle,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileText,
  MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { drawerSlide } from '@/lib/animations'
import { Job, Plan } from '@/types/takeoff'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import FastPlanCanvas from '@/components/fast-plan-canvas'
import CommentPinForm from '@/components/comment-pin-form'
import { DrawingPersistence, canvasUtils } from '@/lib/canvas-utils'
import { Drawing } from '@/lib/canvas-utils'

type AnalysisMode = 'takeoff' | 'quality' | 'comments' | 'share'

export default function EnhancedPlanViewer() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [activeTab, setActiveTab] = useState<AnalysisMode>('takeoff')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [planUrl, setPlanUrl] = useState<string>('')
  const [commentFormOpen, setCommentFormOpen] = useState(false)
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0, pageNumber: 1 })
  
  const drawingPersistenceRef = useRef<DrawingPersistence | null>(null)
  const supabase = createClient()

  const jobId = params.jobId as string
  const planId = params.planId as string

  // Initialize drawing persistence
  useEffect(() => {
    if (user && planId) {
      drawingPersistenceRef.current = new DrawingPersistence(planId, user.id)
    }
    return () => {
      if (drawingPersistenceRef.current) {
        drawingPersistenceRef.current.cleanup()
      }
    }
  }, [user, planId])

  // Load data and PDF images
  useEffect(() => {
    if (user && jobId && planId) {
      loadData()
    }
  }, [user, jobId, planId])

  async function loadData() {
    try {
      setLoading(true)

      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user?.id)
        .single()

      if (jobError) throw jobError
      setJob(jobData)

      // Load plan details
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .eq('job_id', jobId)
        .single()

      if (planError) throw planError
      setPlan(planData)

      // Get signed URL for PDF
      if (planData?.file_path) {
        let pdfUrl = planData.file_path
        
        if (!pdfUrl.startsWith('http')) {
          // Extract storage path from full URL if needed
          const storagePath = pdfUrl.includes('/storage/v1/object/public/') 
            ? pdfUrl.split('/storage/v1/object/public/')[1]
            : pdfUrl

          const { data: urlData } = await supabase.storage
            .from('job-plans')
            .createSignedUrl(storagePath, 3600)

          if (urlData) {
            pdfUrl = urlData.signedUrl
          }
        }
        
        setPlanUrl(pdfUrl)
        
        // Load existing drawings
        if (drawingPersistenceRef.current) {
          const existingDrawings = await drawingPersistenceRef.current.loadDrawings()
          setDrawings(existingDrawings)
        }
      }

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle drawings change and save
  const handleDrawingsChange = useCallback(async (newDrawings: Drawing[]) => {
    setDrawings(newDrawings)
    if (drawingPersistenceRef.current) {
      try {
        await drawingPersistenceRef.current.saveDrawings(newDrawings)
      } catch (error) {
        console.error('Error saving drawings:', error)
        // Optionally show a toast notification to the user
        // For now, we'll just log the error and continue
      }
    }
  }, [])

  // Handle comment pin click
  const handleCommentPinClick = useCallback((x: number, y: number, pageNumber: number) => {
    setCommentPosition({ x, y, pageNumber })
    setCommentFormOpen(true)
  }, [])

  // Handle comment save
  const handleCommentSave = useCallback(async (comment: {
    noteType: 'requirement' | 'concern' | 'suggestion' | 'other'
    content: string
    category?: string
    location?: string
  }) => {
    try {
      const newDrawing: Drawing = {
        id: Date.now().toString(),
        type: 'comment',
        geometry: {
          x: commentPosition.x,
          y: commentPosition.y,
        },
        style: {
          color: '#3b82f6',
          strokeWidth: 2,
          opacity: 1
        },
        pageNumber: commentPosition.pageNumber,
        notes: comment.content,
        noteType: comment.noteType,
        label: comment.category,
        layerName: comment.location
      }

      await handleDrawingsChange([...drawings, newDrawing])
    } catch (error) {
      console.error('Error saving comment:', error)
      // Optionally show a toast notification to the user
      alert('Failed to save comment. Please try again.')
    }
  }, [commentPosition, drawings, handleDrawingsChange])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!job || !plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Not Found</h2>
          <p className="text-gray-600 mb-4">This plan doesn't exist or you don't have access to it.</p>
          <Link href={`/dashboard/jobs/${jobId}`}>
            <Button>Back to Job</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/dashboard/jobs/${jobId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Job
                </Button>
              </Link>
              <div className="text-sm text-gray-600">
                <span className="font-medium">{job.name}</span> - {plan.title || plan.file_name}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => console.log('Share clicked')}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="ghost" size="sm" onClick={() => console.log('Create Package clicked')}>
                <Package className="h-4 w-4 mr-2" />
                Create Package
              </Button>
              <Button variant="ghost" size="sm" onClick={() => console.log('View Bids clicked')}>
                <Eye className="h-4 w-4 mr-2" />
                View Bids
              </Button>
              <Button variant="ghost" size="sm" onClick={() => console.log('Save clicked')}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => console.log('Download clicked')}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={() => console.log('Settings clicked')}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex">
          <div className="flex-1">
            {planUrl ? (
              <FastPlanCanvas
                pdfUrl={planUrl}
                drawings={drawings}
                onDrawingsChange={handleDrawingsChange}
                rightSidebarOpen={rightSidebarOpen}
                onRightSidebarToggle={() => setRightSidebarOpen(!rightSidebarOpen)}
                onCommentPinClick={handleCommentPinClick}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <FallingBlocksLoader />
                  <p className="text-sm text-gray-600 mt-4">Loading PDF...</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <AnimatePresence>
            {rightSidebarOpen && (
              <motion.div
                variants={drawerSlide}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto"
              >
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Analysis</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRightSidebarOpen(false)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AnalysisMode)} className="h-full">
                    <TabsList className="grid w-full grid-cols-4 m-4 mb-0">
                      <TabsTrigger value="takeoff" className="text-xs">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Takeoff
                      </TabsTrigger>
                      <TabsTrigger value="quality" className="text-xs">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Quality
                      </TabsTrigger>
                      <TabsTrigger value="comments" className="text-xs">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Comments
                      </TabsTrigger>
                      <TabsTrigger value="share" className="text-xs">
                        <Share2 className="h-4 w-4 mr-1" />
                        Share
                      </TabsTrigger>
                    </TabsList>
                    
                    <div className="p-4 h-full overflow-y-auto">
                      <TabsContent value="takeoff" className="h-full">
                        <div className="space-y-4">
                          <Button className="w-full">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Run AI Takeoff
                          </Button>
                          <div className="text-center py-8">
                            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <h4 className="font-semibold text-gray-900 mb-2">No takeoff data yet</h4>
                            <p className="text-sm text-gray-600">Run AI analysis to generate takeoff items</p>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="quality" className="h-full">
                        <div className="space-y-4">
                          <Button className="w-full">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Run Quality Check
                          </Button>
                          <div className="text-center py-8">
                            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <h4 className="font-semibold text-gray-900 mb-2">No quality analysis yet</h4>
                            <p className="text-sm text-gray-600">Run AI analysis to check for issues</p>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="comments" className="h-full">
                        <div className="space-y-4">
                          <div className="text-sm text-gray-600 mb-2">
                            {drawings.filter(d => d.type === 'comment').length} comments placed
                          </div>
                          {drawings.filter(d => d.type === 'comment').map(comment => (
                            <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge variant="outline" className="text-xs">
                                  {comment.noteType}
                                </Badge>
                                <span className="text-xs text-gray-500">Page {comment.pageNumber}</span>
                              </div>
                              <p className="text-sm text-gray-800">{comment.notes}</p>
                              {comment.category && (
                                <p className="text-xs text-gray-600 mt-1">Category: {comment.category}</p>
                              )}
                              {comment.location && (
                                <p className="text-xs text-gray-600">Location: {comment.location}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="share" className="h-full">
                        <div className="space-y-4">
                          <Button className="w-full">
                            <Share2 className="h-4 w-4 mr-2" />
                            Generate Share Link
                          </Button>
                          <div className="text-center py-8">
                            <Share2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <h4 className="font-semibold text-gray-900 mb-2">No share links yet</h4>
                            <p className="text-sm text-gray-600">Create a share link to collaborate with others</p>
                          </div>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Comment Form Modal */}
      <CommentPinForm
        open={commentFormOpen}
        onOpenChange={setCommentFormOpen}
        x={commentPosition.x}
        y={commentPosition.y}
        pageNumber={commentPosition.pageNumber}
        onSave={handleCommentSave}
      />
    </div>
  )
}