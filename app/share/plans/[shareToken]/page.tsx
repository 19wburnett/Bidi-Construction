'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase'
import { 
  Eye,
  MessageSquare,
  Edit,
  ZoomIn,
  ZoomOut,
  Move,
  Square,
  Circle as LucideCircle,
  Pencil,
  Save,
  User,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { staggerContainer, staggerItem, cardHover, successCheck } from '@/lib/animations'
import { SharePermissions, PlanShare } from '@/types/takeoff'

// Dynamically import Konva components
const Stage = dynamic(() => import('react-konva').then((mod) => mod.Stage), { ssr: false })
const Layer = dynamic(() => import('react-konva').then((mod) => mod.Layer), { ssr: false })
const Image = dynamic(() => import('react-konva').then((mod) => mod.Image), { ssr: false })
const Rect = dynamic(() => import('react-konva').then((mod) => mod.Rect), { ssr: false })
const KonvaCircle = dynamic(() => import('react-konva').then((mod) => mod.Circle), { ssr: false })
const Line = dynamic(() => import('react-konva').then((mod) => mod.Line), { ssr: false })

type DrawingTool = 'select' | 'rectangle' | 'circle' | 'line' | 'note'

interface Drawing {
  id: string
  type: 'rectangle' | 'circle' | 'line' | 'note'
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  points?: number[]
  color: string
  strokeWidth: number
  label?: string
  notes?: string
  guestName?: string
}

interface Comment {
  id: string
  content: string
  guestName: string
  created_at: string
  x?: number
  y?: number
}

export default function GuestPlanViewer() {
  const params = useParams()
  const [share, setShare] = useState<PlanShare | null>(null)
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestNameSubmitted, setGuestNameSubmitted] = useState(false)
  const [pdfImage, setPdfImage] = useState<HTMLImageElement | null>(null)
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null)
  const [stageScale, setStageScale] = useState(1)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)
  
  const stageRef = useRef<any>(null)
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

      // Load PDF as image
      if (planData?.file_path) {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => setPdfImage(img)
        img.src = planData.file_path
      }

      // Update access count
      await supabase
        .from('plan_shares')
        .update({ 
          accessed_count: shareData.accessed_count + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', shareData.id)

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

  const handleStageClick = (e: any) => {
    if (!guestNameSubmitted || !share) return

    if (selectedTool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage()
      if (clickedOnEmpty) {
        setSelectedId(null)
      }
    } else if (share.permissions === 'markup' || share.permissions === 'all') {
      // Start drawing
      const pos = e.target.getStage().getPointerPosition()
      setIsDrawing(true)
      setCurrentDrawing({
        id: Date.now().toString(),
        type: selectedTool as any,
        x: pos.x,
        y: pos.y,
        color: '#ff6b35',
        strokeWidth: 2,
        guestName
      })
    }
  }

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !currentDrawing) return

    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    
    setCurrentDrawing(prev => ({
      ...prev,
      width: pos.x - (prev?.x || 0),
      height: pos.y - (prev?.y || 0)
    }))
  }

  const handleMouseUp = () => {
    if (isDrawing && currentDrawing) {
      setDrawings(prev => [...prev, currentDrawing as Drawing])
      setCurrentDrawing(null)
      setIsDrawing(false)
    }
  }

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    
    const newScale = e.evt.deltaY < 0 
      ? oldScale * 1.1 
      : oldScale / 1.1
    
    stage.scale({ x: newScale, y: newScale })
    setStageScale(newScale)
    
    // Adjust position to zoom toward cursor
    const newPos = {
      x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
      y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale)
    }
    stage.position(newPos)
  }, [])

  const handleAddComment = async () => {
    if (!newComment.trim() || !guestNameSubmitted) return

    setSaving(true)
    try {
      const comment: Comment = {
        id: Date.now().toString(),
        content: newComment,
        guestName,
        created_at: new Date().toISOString()
      }

      setComments(prev => [...prev, comment])
      setNewComment('')
      
      // Here you would save to database
      // For now, just show success
      setTimeout(() => setSaving(false), 1000)
    } catch (err) {
      console.error('Error adding comment:', err)
      setSaving(false)
    }
  }

  const renderDrawing = (drawing: Drawing) => {
    const commonProps = {
      id: drawing.id,
      x: drawing.x,
      y: drawing.y,
      stroke: drawing.color,
      strokeWidth: drawing.strokeWidth,
      fill: `${drawing.color}20`,
      draggable: selectedTool === 'select' && (share?.permissions === 'markup' || share?.permissions === 'all'),
      onClick: () => setSelectedId(drawing.id),
      onTap: () => setSelectedId(drawing.id)
    }

    switch (drawing.type) {
      case 'rectangle':
        return (
          <Rect
            {...commonProps}
            width={drawing.width || 0}
            height={drawing.height || 0}
          />
        )
      case 'circle':
        return (
          <KonvaCircle
            {...commonProps}
            radius={drawing.radius || 0}
          />
        )
      case 'line':
        return (
          <Line
            {...commonProps}
            points={drawing.points || []}
          />
        )
      default:
        return null
    }
  }

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{plan.title || plan.file_name}</h1>
            <p className="text-sm text-gray-600">Shared by {share.created_by}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{guestName}</span> • {Math.round(stageScale * 100)}%
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments ({comments.length})
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Main Canvas */}
        <div className="flex-1 relative">
          {/* Toolbar */}
          <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-2">
            <div className="flex items-center space-x-2">
              {(share.permissions === 'markup' || share.permissions === 'all') && (
                <>
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
                    <LucideCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === 'line' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedTool('line')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <Button variant="ghost" size="sm" onClick={() => setStageScale(prev => prev * 1.2)}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStageScale(prev => prev / 1.2)}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <Stage
            ref={stageRef}
            width={window.innerWidth - (showComments ? 320 : 0)}
            height={window.innerHeight - 100}
            onWheel={handleWheel}
            onClick={handleStageClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            draggable={selectedTool === 'select'}
          >
            {/* Background Layer */}
            <Layer listening={false}>
              {pdfImage && (
                <Image
                  image={pdfImage}
                  width={pdfImage.width}
                  height={pdfImage.height}
                />
              )}
            </Layer>
            
            {/* Drawings Layer */}
            <Layer>
              {drawings.map(renderDrawing)}
              {currentDrawing && renderDrawing(currentDrawing as Drawing)}
            </Layer>
          </Stage>
        </div>

        {/* Comments Sidebar */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-80 bg-white border-l border-gray-200 flex flex-col"
            >
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Comments</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="space-y-4"
                >
                  {comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      variants={staggerItem}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{comment.guestName}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {(share.permissions === 'comment' || share.permissions === 'all') && (
                <div className="p-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || saving}
                      className="w-full"
                    >
                      {saving ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Add Comment
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
