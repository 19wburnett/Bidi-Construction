'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  Plus,
  Edit,
  Trash2,
  ChevronRight
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { TRADE_CATEGORIES, getAllTrades } from '@/lib/trade-types'
import { useAuth } from '@/app/providers'

interface TimelineItem {
  id: string
  job_id: string
  trade_category: string
  subcontractor_name?: string | null
  start_date: string
  end_date: string
  description?: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'delayed'
  display_order: number
  created_at: string
  updated_at: string
}

interface JobTimelineProps {
  jobId: string
  canEdit?: boolean
  shareToken?: string
  onUpdate?: () => void
}

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800 border-blue-300',
  in_progress: 'bg-green-100 text-green-800 border-green-300',
  completed: 'bg-gray-100 text-gray-800 border-gray-300',
  delayed: 'bg-red-100 text-red-800 border-red-300'
}

const STATUS_ICONS = {
  scheduled: Clock,
  in_progress: PlayCircle,
  completed: CheckCircle,
  delayed: AlertCircle
}

export default function JobTimeline({ jobId, canEdit = false, shareToken, onUpdate }: JobTimelineProps) {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [availableTrades, setAvailableTrades] = useState<string[]>([...TRADE_CATEGORIES])
  const [loadingTrades, setLoadingTrades] = useState(false)
  
  const [formData, setFormData] = useState({
    trade_category: '',
    subcontractor_name: '',
    start_date: '',
    end_date: '',
    description: '',
    status: 'scheduled' as TimelineItem['status']
  })

  const supabase = createClient()
  const { user } = useAuth()

  useEffect(() => {
    loadTimeline()
    loadTrades()
  }, [jobId, shareToken])

  async function loadTrades() {
    if (!user) {
      setAvailableTrades([...TRADE_CATEGORIES])
      return
    }
    
    try {
      setLoadingTrades(true)
      const trades = await getAllTrades(supabase)
      setAvailableTrades(trades)
    } catch (error) {
      console.error('Error loading trades:', error)
      setAvailableTrades([...TRADE_CATEGORIES])
    } finally {
      setLoadingTrades(false)
    }
  }

  async function loadTimeline() {
    try {
      setLoading(true)
      const url = shareToken 
        ? `/api/jobs/${jobId}/timeline?shareToken=${shareToken}`
        : `/api/jobs/${jobId}/timeline`
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to load timeline')
      
      const data = await response.json()
      setTimelineItems(data.timelineItems || [])
    } catch (error) {
      console.error('Error loading timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEditDialog = (item?: TimelineItem) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        trade_category: item.trade_category,
        subcontractor_name: item.subcontractor_name || '',
        start_date: item.start_date,
        end_date: item.end_date,
        description: item.description || '',
        status: item.status
      })
    } else {
      setEditingItem(null)
      setFormData({
        trade_category: '',
        subcontractor_name: '',
        start_date: '',
        end_date: '',
        description: '',
        status: 'scheduled'
      })
    }
    setIsEditDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      const url = `/api/jobs/${jobId}/timeline`
      const method = editingItem ? 'PUT' : 'POST'
      const body = editingItem
        ? { id: editingItem.id, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save timeline item')
      }

      setIsEditDialogOpen(false)
      setEditingItem(null)
      loadTimeline()
      onUpdate?.()
    } catch (error: any) {
      console.error('Error saving timeline item:', error)
      alert(error.message || 'Failed to save timeline item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this timeline item?')) return

    try {
      const response = await fetch(`/api/jobs/${jobId}/timeline?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete timeline item')

      loadTimeline()
      onUpdate?.()
    } catch (error: any) {
      console.error('Error deleting timeline item:', error)
      alert('Failed to delete timeline item')
    }
  }

  // Calculate timeline visualization
  const sortedItems = [...timelineItems].sort((a, b) => {
    const dateCompare = new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    if (dateCompare !== 0) return dateCompare
    return a.display_order - b.display_order
  })

  const minDate = sortedItems.length > 0 
    ? new Date(Math.min(...sortedItems.map(item => new Date(item.start_date).getTime())))
    : new Date()
  const maxDate = sortedItems.length > 0
    ? new Date(Math.max(...sortedItems.map(item => new Date(item.end_date).getTime())))
    : new Date()
  
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)))

  const getItemPosition = (item: TimelineItem) => {
    const startDays = Math.max(0, Math.floor((new Date(item.start_date).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)))
    const duration = Math.max(1, Math.ceil((new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) / (1000 * 60 * 60 * 24)))
    const leftPercent = (startDays / totalDays) * 100
    const widthPercent = (duration / totalDays) * 100
    return { leftPercent, widthPercent, duration }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">Loading timeline...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Project Timeline
              </CardTitle>
              <CardDescription>
                Schedule showing when different trades work on this project
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={() => handleOpenEditDialog()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sortedItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No timeline items yet</p>
              {canEdit && (
                <Button onClick={() => handleOpenEditDialog()} className="mt-4" variant="outline">
                  Add First Timeline Item
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Timeline Visualization */}
              <div className="relative">
                <div className="h-2 bg-gray-200 rounded-full mb-8 relative">
                  {/* Timeline bar */}
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-0.5 bg-gray-300"></div>
                  </div>
                  
                  {/* Timeline items */}
                  <div className="relative" style={{ minHeight: '120px' }}>
                    {sortedItems.map((item, index) => {
                      const { leftPercent, widthPercent, duration } = getItemPosition(item)
                      const StatusIcon = STATUS_ICONS[item.status]
                      
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="absolute"
                          style={{
                            left: `${leftPercent}%`,
                            width: `${Math.max(2, widthPercent)}%`,
                            top: index % 2 === 0 ? '0' : '60px'
                          }}
                        >
                          <div className="relative group">
                            <div className={`absolute top-0 left-0 right-0 h-2 rounded-full ${STATUS_COLORS[item.status]}`}></div>
                            <div className="mt-4 flex flex-col items-center">
                              <div className={`px-3 py-2 rounded-lg border-2 shadow-sm min-w-[200px] max-w-[300px] ${STATUS_COLORS[item.status]}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <StatusIcon className="h-4 w-4 shrink-0" />
                                      <span className="font-semibold text-sm truncate">{item.trade_category}</span>
                                    </div>
                                    {item.subcontractor_name && (
                                      <p className="text-xs text-gray-600 truncate mb-1">{item.subcontractor_name}</p>
                                    )}
                                    <p className="text-xs text-gray-600">
                                      {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
                                    </p>
                                    {item.description && (
                                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                                    )}
                                  </div>
                                  {canEdit && (
                                    <div className="flex gap-1 shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => handleOpenEditDialog(item)}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-red-600"
                                        onClick={() => handleDelete(item.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* List View */}
              <div className="space-y-3">
                {sortedItems.map((item) => {
                  const StatusIcon = STATUS_ICONS[item.status]
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg ${STATUS_COLORS[item.status]}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{item.trade_category}</h4>
                          <Badge variant="outline" className={STATUS_COLORS[item.status]}>
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {item.subcontractor_name && (
                          <p className="text-sm text-gray-600 mb-1">{item.subcontractor_name}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{new Date(item.start_date).toLocaleDateString()}</span>
                          <ChevronRight className="h-4 w-4" />
                          <span>{new Date(item.end_date).toLocaleDateString()}</span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-700 mt-2">{item.description}</p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditDialog(item)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{editingItem ? 'Edit Timeline Item' : 'Add Timeline Item'}</DialogTitle>
            <DialogDescription>
              Schedule when a subcontractor or trade will work on this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <div>
              <Label>Trade Category *</Label>
              <Select
                value={formData.trade_category}
                onValueChange={(value) => setFormData({ ...formData, trade_category: value })}
                disabled={loadingTrades}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loadingTrades ? "Loading trades..." : "Select trade"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] z-[100001]">
                  {availableTrades.map(trade => (
                    <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subcontractor Name (Optional)</Label>
              <Input
                value={formData.subcontractor_name}
                onChange={(e) => setFormData({ ...formData, subcontractor_name: e.target.value })}
                placeholder="e.g., ABC Electric"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as TimelineItem['status'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional notes about this timeline item..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.trade_category || !formData.start_date || !formData.end_date}>
              {saving ? 'Saving...' : editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

