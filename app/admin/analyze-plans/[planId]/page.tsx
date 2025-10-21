'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Save,
  Send,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import TakeoffItemForm, { TakeoffItem } from '@/components/admin/takeoff-item-form'
import QualityIssueForm, { QualityIssue } from '@/components/admin/quality-issue-form'
import AnalysisItemsList from '@/components/admin/analysis-items-list'

// Dynamically import react-pdf
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <FallingBlocksLoader />
      </div>
    )
  }
) as any

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
) as any

interface Plan {
  id: string
  title: string | null
  file_name: string
  file_path: string
  user_id: string
  project_name: string | null
  num_pages: number
  takeoff_analysis_status: string | null
  quality_analysis_status: string | null
  users?: { email: string }
}

interface Drawing {
  id: string
  type: string
  geometry: {
    x1: number
    y1: number
    x2?: number
    y2?: number
    isRelative?: boolean
  }
  style: {
    color: string
    strokeWidth: number
    opacity: number
  }
  page_number: number
  analysis_item_id?: string
  analysis_type?: string
}

export default function AdminAnalyzePlanPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const planId = params.planId as string

  // Plan state
  const [plan, setPlan] = useState<Plan | null>(null)
  const [planUrl, setPlanUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pdfJsReady, setPdfJsReady] = useState(false)
  const [documentReady, setDocumentReady] = useState(false)
  const [pdfError, setPdfError] = useState(false)

  // Canvas state
  const [zoom, setZoom] = useState(0.5)
  const [viewport, setViewport] = useState({ x: 0, y: 0 })
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  // Analysis state
  const [activeTab, setActiveTab] = useState('takeoff')
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([])
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([])
  const [isPlacingMarker, setIsPlacingMarker] = useState(false)
  const [editingTakeoffItem, setEditingTakeoffItem] = useState<TakeoffItem | null>(null)
  const [editingQualityIssue, setEditingQualityIssue] = useState<QualityIssue | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Check admin status
  useEffect(() => {
    checkAdminStatus()
  }, [user])

  async function checkAdminStatus() {
    if (!user) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error || !data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (error) {
      console.error('Error checking admin status:', error)
      router.push('/dashboard')
    }
  }

  // Initialize PDF.js
  useEffect(() => {
    const initPdfJs = async () => {
      try {
        import('react-pdf/dist/Page/AnnotationLayer.css' as any)
        import('react-pdf/dist/Page/TextLayer.css' as any)
        
        const pdfjs = await import('react-pdf')
        pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        
        await new Promise(resolve => setTimeout(resolve, 3000))
        setPdfJsReady(true)
      } catch (error) {
        console.error('Error initializing PDF.js:', error)
      }
    }
    
    initPdfJs()
  }, [])

  useEffect(() => {
    if (user && planId && pdfJsReady) {
      setDocumentReady(false)
      
      const timer = setTimeout(async () => {
        await loadPlan()
        setTimeout(() => {
          setDocumentReady(true)
        }, 1500)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [user, planId, pdfJsReady])

  async function loadPlan() {
    try {
      const supabase = createClient()

      // Load plan with user info
      const { data: planData, error: planError } = await supabase
        .from('plans')
        .select('*, users(email)')
        .eq('id', planId)
        .single()

      if (planError) throw planError
      setPlan(planData)

      // Get signed URL
      const { data: urlData } = await supabase.storage
        .from('plans')
        .createSignedUrl(planData.file_path, 3600)

      if (urlData) {
        setPlanUrl(urlData.signedUrl)
      }

      // Load existing analysis data
      await loadExistingAnalysis()

    } catch (error) {
      console.error('Error loading plan:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadExistingAnalysis() {
    try {
      const supabase = createClient()

      // Load takeoff analysis
      const { data: takeoffData } = await supabase
        .from('plan_takeoff_analysis')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (takeoffData && takeoffData.items) {
        setTakeoffItems(takeoffData.items)
      }

      // Load quality analysis
      const { data: qualityData } = await supabase
        .from('plan_quality_analysis')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (qualityData && qualityData.issues) {
        setQualityIssues(qualityData.issues)
      }

      // Load existing markers
      const { data: markersData } = await supabase
        .from('plan_drawings')
        .select('*')
        .eq('plan_id', planId)
        .not('analysis_item_id', 'is', null)

      if (markersData) {
        setDrawings(markersData)
      }

    } catch (error) {
      console.error('Error loading existing analysis:', error)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  // Redraw canvas with markers
  const redrawCanvas = useCallback(() => {
    canvasRefs.current.forEach((canvas, pageNum) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()

      ctx.save()
      ctx.translate(viewport.x, viewport.y)
      ctx.scale(zoom, zoom)

      // Draw markers for this page
      drawings.forEach(drawing => {
        if (drawing.page_number !== pageNum) return

        const x = drawing.geometry.x1
        const y = drawing.geometry.y1

        // Draw marker circle
        ctx.beginPath()
        ctx.arc(x, y, 15 / zoom, 0, 2 * Math.PI)
        ctx.fillStyle = drawing.style.color
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2 / zoom
        ctx.stroke()

        // Draw number label
        const itemIndex = drawings.filter(d => 
          d.analysis_type === drawing.analysis_type && 
          d.page_number <= pageNum
        ).indexOf(drawing) + 1

        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${12 / zoom}px Arial`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(itemIndex.toString(), x, y)
      })

      ctx.restore()
    })
  }, [drawings, zoom, viewport])

  useEffect(() => {
    const timer = setTimeout(redrawCanvas, 50)
    return () => clearTimeout(timer)
  }, [drawings, zoom, viewport, redrawCanvas])

  // Update canvas sizes
  useEffect(() => {
    const updateCanvasSizes = () => {
      canvasRefs.current.forEach((canvas) => {
        const pdfPageElement = canvas.parentElement
        if (pdfPageElement) {
          const rect = pdfPageElement.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            canvas.width = rect.width
            canvas.height = rect.height
          }
        }
      })
      redrawCanvas()
    }

    const timer1 = setTimeout(updateCanvasSizes, 100)
    const timer2 = setTimeout(updateCanvasSizes, 300)
    const timer3 = setTimeout(updateCanvasSizes, 500)
    window.addEventListener('resize', updateCanvasSizes)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      window.removeEventListener('resize', updateCanvasSizes)
    }
  }, [zoom, planUrl, numPages, redrawCanvas])

  // State to store temporary marker position for forms
  const [tempMarkerPosition, setTempMarkerPosition] = useState<{ x: number; y: number; page: number } | null>(null)

  // Handle marker placement
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlacingMarker) return

    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const pageNum = parseInt(canvas.getAttribute('data-page') || '1')
    
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const worldX = (screenX - viewport.x) / zoom
    const worldY = (screenY - viewport.y) / zoom

    // Store marker position temporarily
    setTempMarkerPosition({ x: worldX, y: worldY, page: pageNum })
    
    // Reset marker placement mode
    setIsPlacingMarker(false)
  }

  // Add takeoff item with marker
  const handleAddTakeoffItem = (item: TakeoffItem) => {
    if (editingTakeoffItem) {
      // Update existing item
      setTakeoffItems(prev => prev.map(i => i.id === item.id ? item : i))
      
      // Update marker if it exists
      if (item.marker) {
        setDrawings(prev => prev.map(d => 
          d.analysis_item_id === item.id 
            ? {
                ...d,
                geometry: { x1: item.marker!.x, y1: item.marker!.y, isRelative: false },
                page_number: item.marker!.page
              }
            : d
        ))
      }
      setEditingTakeoffItem(null)
    } else {
      // Add new item
      setTakeoffItems(prev => [...prev, item])
      
      // Create marker if coordinates provided
      if (item.marker) {
        const marker: Drawing = {
          id: `marker-${item.id}`,
          type: 'note',
          geometry: { x1: item.marker.x, y1: item.marker.y, isRelative: false },
          style: { color: '#3b82f6', strokeWidth: 3, opacity: 1 },
          page_number: item.marker.page,
          analysis_item_id: item.id,
          analysis_type: 'takeoff'
        }
        setDrawings(prev => [...prev, marker])
      }
    }
  }

  // Add quality issue with marker
  const handleAddQualityIssue = (issue: QualityIssue) => {
    if (editingQualityIssue) {
      setQualityIssues(prev => prev.map(i => i.id === issue.id ? issue : i))
      
      if (issue.marker) {
        setDrawings(prev => prev.map(d => 
          d.analysis_item_id === issue.id 
            ? {
                ...d,
                geometry: { x1: issue.marker!.x, y1: issue.marker!.y, isRelative: false },
                page_number: issue.marker!.page
              }
            : d
        ))
      }
      setEditingQualityIssue(null)
    } else {
      setQualityIssues(prev => [...prev, issue])
      
      if (issue.marker) {
        const marker: Drawing = {
          id: `marker-${issue.id}`,
          type: 'note',
          geometry: { x1: issue.marker.x, y1: issue.marker.y, isRelative: false },
          style: { color: '#f97316', strokeWidth: 3, opacity: 1 },
          page_number: issue.marker.page,
          analysis_item_id: issue.id,
          analysis_type: 'quality'
        }
        setDrawings(prev => [...prev, marker])
      }
    }
  }

  // Delete item
  const handleDeleteItem = (id: string) => {
    if (activeTab === 'takeoff') {
      setTakeoffItems(prev => prev.filter(i => i.id !== id))
    } else {
      setQualityIssues(prev => prev.filter(i => i.id !== id))
    }
    // Remove associated marker
    setDrawings(prev => prev.filter(d => d.analysis_item_id !== id))
  }

  // Save draft
  async function saveDraft() {
    if (!user || !plan) return

    setIsSaving(true)
    try {
      const supabase = createClient()

      if (activeTab === 'takeoff' && takeoffItems.length > 0) {
        // Calculate summary
        const summary = {
          total_items: takeoffItems.length,
          categories: Array.from(new Set(takeoffItems.map(i => i.category))),
          total_cost: takeoffItems.reduce((sum, i) => sum + (i.quantity * (i.unit_cost || 0)), 0)
        }

        await supabase
          .from('plan_takeoff_analysis')
          .upsert({
            plan_id: planId,
            user_id: user.id,
            items: takeoffItems,
            summary
          }, { onConflict: 'plan_id' })

        // Save markers
        for (const marker of drawings.filter(d => d.analysis_type === 'takeoff')) {
          await supabase
            .from('plan_drawings')
            .upsert({
              id: marker.id,
              plan_id: planId,
              user_id: user.id,
              page_number: marker.page_number,
              drawing_type: marker.type,
              geometry: marker.geometry,
              style: marker.style,
              analysis_item_id: marker.analysis_item_id,
              analysis_type: marker.analysis_type
            }, { onConflict: 'id' })
        }
      }

      if (activeTab === 'quality' && qualityIssues.length > 0) {
        const overallScore = 1 - (qualityIssues.filter(i => i.severity === 'critical').length * 0.3 +
          qualityIssues.filter(i => i.severity === 'warning').length * 0.1) / qualityIssues.length

        await supabase
          .from('plan_quality_analysis')
          .upsert({
            plan_id: planId,
            user_id: user.id,
            issues: qualityIssues,
            overall_score: Math.max(0, overallScore),
            recommendations: qualityIssues.map(i => i.recommendation).filter(Boolean)
          }, { onConflict: 'plan_id' })

        // Save markers
        for (const marker of drawings.filter(d => d.analysis_type === 'quality')) {
          await supabase
            .from('plan_drawings')
            .upsert({
              id: marker.id,
              plan_id: planId,
              user_id: user.id,
              page_number: marker.page_number,
              drawing_type: marker.type,
              geometry: marker.geometry,
              style: marker.style,
              analysis_item_id: marker.analysis_item_id,
              analysis_type: marker.analysis_type
            }, { onConflict: 'id' })
        }
      }

      alert('Draft saved successfully!')
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }

  // Submit analysis
  async function submitAnalysis() {
    if (!user || !plan) return

    const analysisType = activeTab as 'takeoff' | 'quality'
    const items = analysisType === 'takeoff' ? takeoffItems : qualityIssues

    if (items.length === 0) {
      alert(`Please add at least one ${analysisType} item before submitting`)
      return
    }

    if (!confirm(`Submit ${analysisType} analysis? The user will be notified via email.`)) {
      return
    }

    setIsSaving(true)
    try {
      // Save draft first
      await saveDraft()

      const supabase = createClient()

      // Update plan status
      await supabase
        .from('plans')
        .update({ 
          [`${analysisType}_analysis_status`]: 'completed',
          [`has_${analysisType}_analysis`]: true 
        })
        .eq('id', planId)

      // Send email notification
      await fetch('/api/send-analysis-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          type: analysisType,
          userEmail: plan.users?.email
        })
      })

      alert(`${analysisType === 'takeoff' ? 'Takeoff' : 'Quality'} analysis submitted successfully! User has been notified.`)
      router.push('/admin/analyze-plans')
    } catch (error) {
      console.error('Error submitting analysis:', error)
      alert('Failed to submit analysis')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading || !pdfJsReady || !documentReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FallingBlocksLoader />
          <p className="text-sm text-gray-600 mt-4">
            {!pdfJsReady ? 'Initializing PDF viewer...' : !documentReady ? 'Preparing document...' : 'Loading plan...'}
          </p>
        </div>
      </div>
    )
  }

  if (!plan || !user || !isAdmin) {
    return null
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Top Toolbar */}
      <div className="bg-white dark:bg-black border-b dark:border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/analyze-plans')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="font-semibold text-lg dark:text-white">{plan.title || plan.file_name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {plan.users?.email} • {numPages ? `${numPages} page${numPages !== 1 ? 's' : ''}` : 'Loading...'}
            </p>
          </div>
          {isPlacingMarker && (
            <Badge className="bg-orange-500">
              Click on plan to place marker
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Plan Viewer */}
        <div 
          className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900 relative" 
          ref={containerRef}
          style={{ cursor: isPlacingMarker ? 'crosshair' : 'default' }}
        >
          <div className="relative inline-block">
            {planUrl && (
              <Document
                file={planUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error: Error) => {
                  console.error('PDF load error:', error)
                  setPdfError(true)
                }}
                loading={
                  <div className="flex items-center justify-center p-12">
                    <FallingBlocksLoader />
                  </div>
                }
                error={
                  <div className="flex items-center justify-center p-12">
                    <div className="text-center text-red-600">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                      <p className="font-medium">Failed to load PDF</p>
                      <p className="text-sm mt-2">
                        {pdfError && 'Attempting to recover...'}
                        {!pdfError && 'Please try refreshing the page'}
                      </p>
                    </div>
                  </div>
                }
              >
                <div className="space-y-6">
                  {numPages && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                    <div key={`page-${pageNum}`} className="relative bg-white shadow-lg">
                      <div className="absolute -top-8 left-0 text-sm text-gray-500 font-medium">
                        Page {pageNum} of {numPages}
                      </div>
                      
                      <div className="relative">
                        <Page
                          key={`pdf-page-${pageNum}`}
                          pageNumber={pageNum}
                          scale={zoom}
                          width={800}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          onLoadSuccess={() => {
                            setTimeout(() => {
                              const canvas = canvasRefs.current.get(pageNum)
                              if (canvas && canvas.parentElement) {
                                const rect = canvas.parentElement.getBoundingClientRect()
                                if (rect.width > 0 && rect.height > 0) {
                                  canvas.width = rect.width
                                  canvas.height = rect.height
                                  redrawCanvas()
                                }
                              }
                            }, 100)
                          }}
                        />

                        <canvas
                          ref={(el) => {
                            if (el) {
                              canvasRefs.current.set(pageNum, el)
                              const pdfPageElement = el.parentElement
                              if (pdfPageElement) {
                                const rect = pdfPageElement.getBoundingClientRect()
                                if (rect.width > 0 && rect.height > 0) {
                                  el.width = rect.width
                                  el.height = rect.height
                                }
                              }
                            } else {
                              canvasRefs.current.delete(pageNum)
                            }
                          }}
                          data-page={pageNum}
                          className="absolute top-0 left-0"
                          onClick={handleCanvasClick}
                          style={{
                            pointerEvents: isPlacingMarker ? 'auto' : 'none',
                            cursor: isPlacingMarker ? 'crosshair' : 'default',
                            zIndex: 10
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Document>
            )}
          </div>
        </div>

        {/* Right: Analysis Panel */}
        <div className="w-96 bg-white dark:bg-gray-900 border-l dark:border-gray-800 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 m-4">
              <TabsTrigger value="takeoff">Takeoff</TabsTrigger>
              <TabsTrigger value="quality">Quality</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <TabsContent value="takeoff" className="mt-0 space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Add Takeoff Item</h3>
                    <TakeoffItemForm
                      onAddItem={handleAddTakeoffItem}
                      onPlaceMarker={() => setIsPlacingMarker(true)}
                      isPlacingMarker={isPlacingMarker}
                      markerPosition={tempMarkerPosition}
                      editingItem={editingTakeoffItem}
                      onCancelEdit={() => setEditingTakeoffItem(null)}
                    />
                  </CardContent>
                </Card>

                <div>
                  <h3 className="font-semibold mb-2">Items ({takeoffItems.length})</h3>
                  <AnalysisItemsList
                    items={takeoffItems}
                    type="takeoff"
                    onEdit={(item) => setEditingTakeoffItem(item as TakeoffItem)}
                    onDelete={handleDeleteItem}
                  />
                </div>
              </TabsContent>

              <TabsContent value="quality" className="mt-0 space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-4">Add Quality Issue</h3>
                    <QualityIssueForm
                      onAddIssue={handleAddQualityIssue}
                      onPlaceMarker={() => setIsPlacingMarker(true)}
                      isPlacingMarker={isPlacingMarker}
                      markerPosition={tempMarkerPosition}
                      editingIssue={editingQualityIssue}
                      onCancelEdit={() => setEditingQualityIssue(null)}
                    />
                  </CardContent>
                </Card>

                <div>
                  <h3 className="font-semibold mb-2">Issues ({qualityIssues.length})</h3>
                  <AnalysisItemsList
                    items={qualityIssues}
                    type="quality"
                    onEdit={(item) => setEditingQualityIssue(item as QualityIssue)}
                    onDelete={handleDeleteItem}
                  />
                </div>
              </TabsContent>
            </div>

            {/* Action Buttons */}
            <div className="border-t dark:border-gray-800 p-4 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={saveDraft}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </>
                )}
              </Button>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={submitAnalysis}
                disabled={isSaving || (activeTab === 'takeoff' ? takeoffItems.length === 0 : qualityIssues.length === 0)}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit & Notify User
                  </>
                )}
              </Button>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

