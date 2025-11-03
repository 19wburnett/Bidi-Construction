'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'
import { 
  Eye,
  MessageSquare,
  Edit,
  User,
  Clock,
  AlertCircle,
  BarChart3,
  AlertTriangle,
  ChevronLeft
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SharePermissions, PlanShare } from '@/types/takeoff'
import FastPlanCanvas from '@/components/fast-plan-canvas'
import CommentPinForm from '@/components/comment-pin-form'
import ThreadedCommentDisplay from '@/components/threaded-comment-display'
import { Drawing } from '@/lib/canvas-utils'
import { organizeCommentsIntoThreads, getReplyCount } from '@/lib/comment-utils'
import { CommentPersistence } from '@/lib/comment-persistence'

type AnalysisMode = 'takeoff' | 'quality' | 'comments'

export default function GuestPlanViewer() {
  const params = useParams()
  const [share, setShare] = useState<PlanShare | null>(null)
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestNameSubmitted, setGuestNameSubmitted] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [commentFormOpen, setCommentFormOpen] = useState(false)
  const [commentPosition, setCommentPosition] = useState({ x: 0, y: 0, pageNumber: 1 })
  const [activeTab, setActiveTab] = useState<AnalysisMode>('takeoff')
  const [takeoffData, setTakeoffData] = useState<any>(null)
  const [qualityData, setQualityData] = useState<any>(null)
  
  const supabase = createClient()

  const shareToken = params.shareToken as string

  useEffect(() => {
    if (shareToken) {
      loadShareData()
    }
  }, [shareToken])

  async function loadShareData() {
    try {
      // Load share details
      const { data: shareData, error: shareError } = await supabase
        .from('plan_shares')
        .select('*')
        .eq('share_token', shareToken)
        .single()

      if (shareError) throw shareError

      // Check if share is expired
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        throw new Error('This share link has expired')
      }

      setShare(shareData)

      // Load plan details
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', shareData.plan_id)
        .single()

      if (planError) throw planError
      setPlan(planData)

      // Get signed URL for PDF
      if (planData?.file_path) {
        let pdfUrlValue = planData.file_path
        
        console.log('Loading PDF:', pdfUrlValue)
        
        // If it's already a full URL, use it directly
        if (pdfUrlValue.startsWith('http')) {
          setPdfUrl(pdfUrlValue)
        } else {
          // Try to get signed URL from storage
          try {
            const { data: urlData, error: urlError } = await supabase.storage
              .from('job-plans')
              .createSignedUrl(pdfUrlValue, 3600)

            if (urlError) {
              console.error('Error creating signed URL:', urlError)
              // If creating signed URL fails, try using the path directly as it might be public
              setPdfUrl(pdfUrlValue)
            } else if (urlData) {
              pdfUrlValue = urlData.signedUrl
              console.log('Got signed URL:', pdfUrlValue)
              setPdfUrl(pdfUrlValue)
            }
          } catch (storageError) {
            console.error('Storage error:', storageError)
            // Fallback: use the path directly
            setPdfUrl(pdfUrlValue)
          }
        }
      } else {
        console.error('No file_path found in plan data')
      }

      // Load existing comments for this plan so they show in the sidebar
      try {
        const commentPersistence = new CommentPersistence(planData.id)
        const existingComments = await commentPersistence.loadComments()
        if (Array.isArray(existingComments)) {
          setDrawings(existingComments)
        }
      } catch (loadCommentsError) {
        console.warn('Unable to load existing comments for shared view:', loadCommentsError)
      }

      // Update access count
      await supabase
        .from('plan_shares')
        .update({ 
          accessed_count: shareData.accessed_count + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', shareData.id)
      
      // Load takeoff analysis if available
      const { data: takeoffAnalysis } = await supabase
        .from('plan_takeoff_analysis')
        .select('*')
        .eq('plan_id', planData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (takeoffAnalysis) {
        setTakeoffData(takeoffAnalysis)
      }
      
      // Load quality analysis if available
      const { data: qualityAnalysis } = await supabase
        .from('plan_quality_analysis')
        .select('*')
        .eq('plan_id', planData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (qualityAnalysis) {
        setQualityData(qualityAnalysis)
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }

  const handleGuestNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (guestName.trim()) {
      setGuestNameSubmitted(true)
    }
  }

  // Handle comment pin click (to place new comment)
  const handleCommentPinClick = useCallback((x: number, y: number, pageNumber: number) => {
    if (!share || (share.permissions !== 'comment' && share.permissions !== 'all')) {
      return
    }
    setCommentPosition({ x, y, pageNumber })
    setCommentFormOpen(true)
  }, [share])

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
        category: comment.category,
        label: comment.category,
        location: comment.location,
        layerName: comment.location,
        isVisible: true,
        isLocked: false,
        userId: 'guest',
        userName: guestName,
        createdAt: new Date().toISOString()
      }

      await setDrawings([...drawings, newDrawing])
      setCommentFormOpen(false)
    } catch (error) {
      console.error('Error saving comment:', error)
      alert('Failed to save comment. Please try again.')
    }
  }, [commentPosition, drawings, guestName])

  // Handle comment reply
  const handleCommentReply = useCallback(async (parentId: string, content: string) => {
    try {
      const parentComment = drawings.find(d => d.id === parentId)
      if (!parentComment) {
        throw new Error('Parent comment not found')
      }

      const newReply: Drawing = {
        id: Date.now().toString(),
        type: 'comment',
        geometry: parentComment.geometry,
        style: {
          color: '#3b82f6',
          strokeWidth: 2,
          opacity: 1
        },
        pageNumber: parentComment.pageNumber,
        notes: content,
        noteType: 'other',
        isVisible: true,
        isLocked: false,
        userId: 'guest',
        userName: guestName,
        createdAt: new Date().toISOString(),
        parentCommentId: parentId
      }

      await setDrawings([...drawings, newReply])
    } catch (error) {
      console.error('Error saving reply:', error)
      alert('Failed to save reply. Please try again.')
    }
  }, [drawings, guestName])

  // Handle comment resolution
  const handleCommentResolve = useCallback(async (commentId: string) => {
    try {
      const updatedDrawings = drawings.map(d => {
        if (d.id === commentId) {
          return {
            ...d,
            isResolved: true,
            resolvedAt: new Date().toISOString(),
            resolvedBy: 'guest',
            resolvedByUsername: guestName
          }
        }
        return d
      })

      await setDrawings(updatedDrawings)
    } catch (error) {
      console.error('Error resolving comment:', error)
      alert('Failed to resolve comment. Please try again.')
    }
  }, [drawings, guestName])

  // Handle drawings change
  const handleDrawingsChange = useCallback(async (newDrawings: Drawing[]) => {
    setDrawings(newDrawings)
  }, [])

  const getPermissionIcon = (permissions: SharePermissions) => {
    switch (permissions) {
      case 'view_only': return Eye
      case 'markup': return Edit
      case 'comment': return MessageSquare
      case 'all': return Edit
      default: return Eye
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-gray-600">Loading plan...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Plan</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!share || !plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Not Found</h2>
          <p className="text-gray-600">This share link is invalid or has been removed.</p>
        </div>
      </div>
    )
  }

  if (!guestNameSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full mx-4"
        >
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center">
                <User className="h-5 w-5 mr-2 text-orange-600" />
                Guest Access
              </CardTitle>
              <CardDescription>
                Please enter your name to view this shared plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGuestNameSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="guestName">Your Name</Label>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Enter your name"
                    required
                  />
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    {(() => {
                      const Icon = getPermissionIcon(share.permissions)
                      return <Icon className="h-4 w-4 mr-2 text-blue-600" />
                    })()}
                    <span className="text-sm font-medium text-blue-900">
                      {share.permissions === 'view_only' && 'View Only Access'}
                      {share.permissions === 'markup' && 'Markup Access'}
                      {share.permissions === 'comment' && 'Comment Access'}
                      {share.permissions === 'all' && 'Full Access'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700">
                    {share.permissions === 'view_only' && 'You can only view the plan'}
                    {share.permissions === 'markup' && 'You can view and add markups'}
                    {share.permissions === 'comment' && 'You can view and add comments'}
                    {share.permissions === 'all' && 'You can view, markup, and comment'}
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  const canComment = share.permissions === 'comment' || share.permissions === 'all'
  const canView = share.permissions === 'view_only' || share.permissions === 'markup' || share.permissions === 'comment' || share.permissions === 'all'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-3 md:p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 truncate">{plan.title || plan.file_name}</h1>
            <p className="text-xs md:text-sm text-gray-600">Shared plan • {guestName}</p>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="text-xs md:text-sm text-gray-600">
              {(() => {
                const Icon = getPermissionIcon(share.permissions)
                return (
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <Icon className="h-3 w-3 md:h-4 md:w-4" />
                    <span className="hidden sm:inline">
                      {share.permissions === 'view_only' && 'View Only'}
                      {share.permissions === 'markup' && 'Markup Access'}
                      {share.permissions === 'comment' && 'Comment Access'}
                      {share.permissions === 'all' && 'Full Access'}
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex relative">
		<div className={`flex-1 ${rightSidebarOpen ? 'mr-0 md:mr-96' : ''} transition-all min-w-0`}>
          {canView ? (
            pdfUrl ? (
              <FastPlanCanvas
                pdfUrl={pdfUrl}
                drawings={drawings}
                onDrawingsChange={handleDrawingsChange}
                rightSidebarOpen={rightSidebarOpen}
                onRightSidebarToggle={() => setRightSidebarOpen(!rightSidebarOpen)}
                onCommentPinClick={canComment ? handleCommentPinClick : () => {}}
                goToPage={undefined}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                  <h2 className="text-xl font-bold text-gray-900 mb-2">PDF Not Available</h2>
                  <p className="text-gray-600">The plan file could not be loaded. Please contact the plan owner.</p>
                  <p className="text-sm text-gray-500 mt-2">Plan: {plan.title || plan.file_name}</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-600">You don't have permission to view this plan.</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Sidebar with Analysis - Drawer on mobile/tablet */}
		{rightSidebarOpen && (
		  <>
		    {/* Overlay for mobile/tablet */}
		    <div 
		      className="fixed inset-0 bg-black bg-opacity-50 z-40 md:z-10 block md:hidden"
		      onClick={() => setRightSidebarOpen(false)}
		    />
		    
		  <div className="fixed right-0 top-0 md:top-16 bottom-0 w-full md:w-[650px] max-w-sm md:max-w-none bg-white border-l border-gray-200 overflow-y-auto z-50 md:z-10 shadow-xl md:shadow-none">
            <div className="p-3 md:p-4">
              <div className="flex items-center justify-between mb-3 md:mb-4 sticky top-0 bg-white z-10 pb-2">
                <h3 className="font-semibold text-gray-900 text-base md:text-lg">Analysis</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRightSidebarOpen(false)}
                  className="h-9 w-9"
                >
                  ×
                </Button>
              </div>
              
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AnalysisMode)}>
                <TabsList className="grid w-full grid-cols-3 mb-3 md:mb-4 gap-1">
                  <TabsTrigger value="takeoff" className="text-xs md:text-sm px-2 md:px-4">
                    <BarChart3 className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                    <span className="hidden sm:inline">Takeoff</span>
                  </TabsTrigger>
                  <TabsTrigger value="quality" className="text-xs md:text-sm px-2 md:px-4">
                    <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                    <span className="hidden sm:inline">Quality</span>
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="text-xs md:text-sm px-2 md:px-4">
                    <MessageSquare className="h-3 w-3 md:h-4 md:w-4 md:mr-1" />
                    <span className="hidden sm:inline">Comments</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="takeoff" className="space-y-3">
                  {takeoffData ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-900">Takeoff Items</div>
                      <div className="text-sm text-gray-600">
                        {takeoffData.items?.length || 0} items found
                      </div>
                      {Array.isArray(takeoffData.items) && takeoffData.items.length > 0 && (
                        <div className="space-y-2 mt-4">
                          {takeoffData.items.slice(0, 10).map((item: any, index: number) => (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg">
                              <div className="font-medium text-sm">{item.description || item.name || 'Item'}</div>
                              {item.quantity && (
                                <div className="text-xs text-gray-600">
                                  Quantity: {item.quantity} {item.unit || ''}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-sm text-gray-600">No takeoff analysis available</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="quality" className="space-y-3">
                  {qualityData ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-900">Quality Analysis</div>
                      <div className="text-sm text-gray-600">
                        {Array.isArray(qualityData.issues) ? qualityData.issues.length : 0} issues found
                      </div>
                      {Array.isArray(qualityData.issues) && qualityData.issues.length > 0 && (
                        <div className="space-y-2 mt-4">
                          {qualityData.issues.slice(0, 10).map((issue: any, index: number) => (
                            <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="font-medium text-sm text-red-900">
                                {issue.severity || issue.type || 'Issue'}
                              </div>
                              <div className="text-xs text-red-700 mt-1">{issue.description || issue.message}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-sm text-gray-600">No quality analysis available</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="comments" className="space-y-3">
                  <div className="text-sm font-medium text-gray-900 mb-2">
                    Comments ({drawings.filter(d => d.type === 'comment' && !d.parentCommentId).length})
                  </div>
                  {drawings.filter(d => d.type === 'comment' && !d.parentCommentId).length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-sm text-gray-600">No comments yet</p>
                    </div>
                  ) : (() => {
                    const commentMap = new Map<string, Drawing>()
                    drawings.filter(d => d.type === 'comment').forEach(c => commentMap.set(c.id, c))
                    
                    return organizeCommentsIntoThreads(drawings.filter(d => d.type === 'comment'))
                      .map(comment => (
                        <div key={comment.id}>
                          <ThreadedCommentDisplay
                            comment={comment}
                            onReply={handleCommentReply}
                            onResolve={handleCommentResolve}
                            currentUserId={guestName}
                            currentUserName={guestName}
                            getReplyCount={(commentId) => {
                              const foundComment = commentMap.get(commentId)
                              return foundComment ? getReplyCount(foundComment) : 0
                            }}
                          />
                        </div>
                      ))
                  })()}
                </TabsContent>
              </Tabs>
            </div>
          </div>
          </>
        )}
        
        {!rightSidebarOpen && (
          <button
            onClick={() => setRightSidebarOpen(true)}
            className="fixed bottom-4 right-4 md:right-4 md:top-1/2 md:-translate-y-1/2 bg-white border border-gray-200 rounded-full md:rounded-l-lg px-3 md:px-2 py-3 md:py-4 shadow-lg md:shadow-md z-40 h-12 w-12 md:h-auto md:w-auto flex items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 rotate-180 md:rotate-0" />
          </button>
        )}
      </div>

      {/* Comment Form Modal */}
      {canComment && (
        <CommentPinForm
          open={commentFormOpen}
          onOpenChange={setCommentFormOpen}
          x={commentPosition.x}
          y={commentPosition.y}
          pageNumber={commentPosition.pageNumber}
          onSave={handleCommentSave}
        />
      )}
    </div>
  )
}
