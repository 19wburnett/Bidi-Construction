'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Ruler,
  Square,
  MapPin,
  Settings,
  Trash2,
  Tag,
  MessageSquare,
  Plus
} from 'lucide-react'
import { Drawing } from '@/lib/canvas-utils'
import { MeasurementTag } from '@/lib/measurement-tag-persistence'
import MeasurementTagManager from '@/components/measurement-tag-manager'
import ItemList from '@/components/item-list'
import ThreadedCommentDisplay from '@/components/threaded-comment-display'
import { organizeCommentsIntoThreads, getReplyCount } from '@/lib/comment-utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface MeasurementTagsSidebarProps {
  isOpen: boolean
  onToggle: () => void
  measurements: Drawing[]
  items: Drawing[]
  comments: Drawing[]
  tags: MeasurementTag[]
  onNavigateToMeasurement: (measurement: Drawing) => void
  onMeasurementHighlight: (measurementIds: string[]) => void
  highlightedMeasurementIds: string[]
  selectedMeasurementIds: Set<string>
  onTagChange: () => void
  onDeleteMeasurement: (measurementId: string) => void
  onDeleteTagWithMeasurements: (tagId: string, measurementIds: string[]) => void
  planId: string
  userId?: string
  userEmail?: string
  guestUser?: { id: string; name: string }
  unit?: 'ft' | 'in' | 'm' | 'cm' | 'mm'
  width: number
  onWidthChange: (width: number) => void
  isMobile?: boolean
  isTablet?: boolean
  // Item callbacks
  onItemClick: (item: Drawing) => void
  onItemEdit?: (item: Drawing) => void
  onItemDelete?: (itemId: string) => void
  onItemHover?: (itemId: string | null) => void
  onAddItemType?: (itemType: string, itemCategory?: string, itemLabel?: string) => void
  // Comment callbacks
  onCommentClick?: (comment: Drawing) => void
  onCommentReply?: (parentId: string, content: string) => void
  onCommentResolve?: (commentId: string) => void
  onAddComment?: () => void
}

interface TagGroup {
  tag: { id: string; name: string; color: string }
  lineMeasurements: Drawing[]
  areaMeasurements: Drawing[]
  totalLinearFeet: number
  totalSquareFeet: number
}

export default function MeasurementTagsSidebar({
  isOpen,
  onToggle,
  measurements,
  items,
  comments,
  tags,
  onNavigateToMeasurement,
  onMeasurementHighlight,
  highlightedMeasurementIds,
  selectedMeasurementIds,
  onTagChange,
  onDeleteMeasurement,
  onDeleteTagWithMeasurements,
  planId,
  userId,
  userEmail,
  guestUser,
  unit = 'ft',
  width,
  onWidthChange,
  isMobile = false,
  isTablet = false,
  onItemClick,
  onItemEdit,
  onItemDelete,
  onItemHover,
  onAddItemType,
  onCommentClick,
  onCommentReply,
  onCommentResolve,
  onAddComment
}: MeasurementTagsSidebarProps) {
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [showTagManager, setShowTagManager] = useState(false)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [startX, setStartX] = useState(0)
  const [activeTab, setActiveTab] = useState<'measurements' | 'items' | 'comments'>('measurements')
  const [deleteConfirmTag, setDeleteConfirmTag] = useState<string | null>(null)

  // Group measurements by tag
  const tagGroups = useMemo(() => {
    const groupMap = new Map<string, TagGroup>()

    measurements.forEach(measurement => {
      if (measurement.type !== 'measurement_line' && measurement.type !== 'measurement_area') {
        return
      }

      const tagId = measurement.measurementTag?.id || 'untagged'
      const tag = measurement.measurementTag || { id: 'untagged', name: 'Untagged', color: '#9ca3af' }

      if (!groupMap.has(tagId)) {
        groupMap.set(tagId, {
          tag,
          lineMeasurements: [],
          areaMeasurements: [],
          totalLinearFeet: 0,
          totalSquareFeet: 0
        })
      }

      const group = groupMap.get(tagId)!

      if (measurement.type === 'measurement_line' && measurement.measurements?.totalLength) {
        group.lineMeasurements.push(measurement)
        group.totalLinearFeet += measurement.measurements.totalLength
      } else if (measurement.type === 'measurement_area' && measurement.measurements?.area) {
        group.areaMeasurements.push(measurement)
        group.totalSquareFeet += measurement.measurements.area
      }
    })

    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.tag.id === 'untagged') return 1
      if (b.tag.id === 'untagged') return -1
      return a.tag.name.localeCompare(b.tag.name)
    })
  }, [measurements])

  const totalMeasurements = measurements.filter(
    m => m.type === 'measurement_line' || m.type === 'measurement_area'
  ).length

  const totalItems = items.filter(i => i.type === 'item').length

  const totalComments = comments.filter(c => c.type === 'comment' && !c.parentCommentId).length

  const formatMeasurement = (value: number, measurementUnit: string, isArea: boolean = false) => {
    const displayUnit = isArea ? `sq ${measurementUnit}` : measurementUnit
    return `${value.toFixed(2)} ${displayUnit}`
  }

  const toggleTagExpanded = (tagId: string) => {
    const newExpanded = new Set(expandedTags)
    if (newExpanded.has(tagId)) {
      newExpanded.delete(tagId)
    } else {
      newExpanded.add(tagId)
    }
    setExpandedTags(newExpanded)
  }

  const handleTagHover = (tagId: string) => {
    const measurementIds = measurements
      .filter(m => m.measurementTag?.id === tagId || (!m.measurementTag && tagId === 'untagged'))
      .map(m => m.id)
    onMeasurementHighlight(measurementIds)
  }

  const handleMeasurementClick = (measurement: Drawing) => {
    onNavigateToMeasurement(measurement)
  }

  const handleMeasurementHover = (measurementId: string) => {
    onMeasurementHighlight([measurementId])
  }

  const handleDeleteMeasurement = (e: React.MouseEvent, measurementId: string) => {
    e.stopPropagation()
    if (confirm('Delete this measurement?')) {
      onDeleteMeasurement(measurementId)
    }
  }

  const handleDeleteTag = (e: React.MouseEvent, tagId: string, measurementIds: string[]) => {
    e.stopPropagation()
    if (deleteConfirmTag === tagId) {
      onDeleteTagWithMeasurements(tagId, measurementIds)
      setDeleteConfirmTag(null)
    } else {
      setDeleteConfirmTag(tagId)
      // Auto-clear after 3 seconds
      setTimeout(() => setDeleteConfirmTag(null), 3000)
    }
  }

  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    setStartX(e.clientX)
    e.preventDefault()
  }

  // Add event listeners for resize using useEffect
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX
      const newWidth = Math.min(600, Math.max(240, width + delta))
      onWidthChange(newWidth)
      setStartX(e.clientX)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, startX, width, onWidthChange])

  // Collapsed state - just show toggle button
  if (!isOpen) {
    return (
      <div className="relative z-20">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="fixed left-2 top-1/2 -translate-y-1/2 z-30 h-12 w-8 p-0 bg-white shadow-lg border-gray-200 hover:bg-gray-50"
          title="Open Measurements Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const measurementsContent = (
    <div className="flex flex-col h-full">
      {/* Tag Manager Section */}
      <AnimatePresence>
        {showTagManager && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-200 overflow-hidden flex-shrink-0"
          >
            <div className="p-3 bg-gray-50">
              <MeasurementTagManager
                planId={planId}
                userId={userId}
                guestUser={guestUser}
                selectedTagId={selectedTagId}
                onTagSelect={setSelectedTagId}
                onTagChange={onTagChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag Groups */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tagGroups.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Ruler className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No measurements yet</p>
            <p className="text-xs mt-1">
              Use the measurement tools to add lines and areas
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tagGroups.map((group) => {
              const isExpanded = expandedTags.has(group.tag.id)
              const allMeasurements = [...group.lineMeasurements, ...group.areaMeasurements]
              const measurementCount = allMeasurements.length
              const isConfirmingDelete = deleteConfirmTag === group.tag.id

              if (measurementCount === 0) return null

              return (
                <Collapsible
                  key={group.tag.id}
                  open={isExpanded}
                  onOpenChange={() => toggleTagExpanded(group.tag.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className="w-full p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onMouseEnter={() => handleTagHover(group.tag.id)}
                      onMouseLeave={() => onMeasurementHighlight([])}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ChevronDown
                            className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${
                              isExpanded ? '' : '-rotate-90'
                            }`}
                          />
                          <div
                            className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                            style={{ backgroundColor: group.tag.color }}
                          />
                          <span className="text-sm font-medium text-gray-800 truncate">
                            {group.tag.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {measurementCount}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 w-6 p-0 ${
                              isConfirmingDelete 
                                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            onClick={(e) => handleDeleteTag(e, group.tag.id, allMeasurements.map(m => m.id))}
                            title={isConfirmingDelete 
                              ? "Click again to confirm deletion" 
                              : group.tag.id === 'untagged' 
                                ? "Delete all untagged measurements" 
                                : "Delete tag and all measurements"
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Summary totals */}
                      <div className="mt-2 ml-6 space-y-1">
                        {group.totalSquareFeet > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <Square className="h-3 w-3 text-green-500" />
                              <span>Area</span>
                            </div>
                            <span className="font-mono font-semibold text-green-700">
                              {formatMeasurement(group.totalSquareFeet, unit, true)}
                            </span>
                          </div>
                        )}
                        {group.totalLinearFeet > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <Ruler className="h-3 w-3 text-blue-500" />
                              <span>Linear</span>
                            </div>
                            <span className="font-mono font-semibold text-blue-700">
                              {formatMeasurement(group.totalLinearFeet, unit)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="bg-gray-50 border-t border-gray-100">
                      {allMeasurements.map((measurement) => {
                        const isLine = measurement.type === 'measurement_line'
                        const value = isLine
                          ? measurement.measurements?.totalLength || 0
                          : measurement.measurements?.area || 0
                        const isHighlighted = highlightedMeasurementIds.includes(measurement.id)
                        const isSelected = selectedMeasurementIds.has(measurement.id)

                        return (
                          <div
                            key={measurement.id}
                            className={`px-4 py-2 ml-6 border-l-2 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-100 border-blue-500'
                                : isHighlighted
                                ? 'bg-yellow-50 border-yellow-400'
                                : 'border-transparent hover:bg-gray-100'
                            }`}
                            onClick={() => handleMeasurementClick(measurement)}
                            onMouseEnter={() => handleMeasurementHover(measurement.id)}
                            onMouseLeave={() => onMeasurementHighlight([])}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isLine ? (
                                  <Ruler className="h-3.5 w-3.5 text-blue-500" />
                                ) : (
                                  <Square className="h-3.5 w-3.5 text-green-500" />
                                )}
                                <span className="text-xs font-mono font-medium text-gray-700">
                                  {formatMeasurement(value, unit, !isLine)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <MapPin className="h-2.5 w-2.5 mr-0.5" />
                                  p.{measurement.pageNumber}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={(e) => handleDeleteMeasurement(e, measurement.id)}
                                  title="Delete measurement"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {measurement.label && (
                              <p className="text-xs text-gray-500 mt-1 truncate ml-5">
                                {measurement.label}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer with totals */}
      {tagGroups.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-xs text-gray-500 font-medium mb-2">Grand Total</div>
          <div className="space-y-1">
            {tagGroups.reduce((acc, g) => acc + g.totalSquareFeet, 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Square className="h-4 w-4 text-green-500" />
                  <span>Total Area</span>
                </div>
                <span className="font-mono font-bold text-green-700">
                  {formatMeasurement(
                    tagGroups.reduce((acc, g) => acc + g.totalSquareFeet, 0),
                    unit,
                    true
                  )}
                </span>
              </div>
            )}
            {tagGroups.reduce((acc, g) => acc + g.totalLinearFeet, 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Ruler className="h-4 w-4 text-blue-500" />
                  <span>Total Linear</span>
                </div>
                <span className="font-mono font-bold text-blue-700">
                  {formatMeasurement(
                    tagGroups.reduce((acc, g) => acc + g.totalLinearFeet, 0),
                    unit
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-white z-10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Plan Details</h3>
          </div>
          <div className="flex items-center gap-1">
            {activeTab === 'measurements' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTagManager(!showTagManager)}
                className="h-8 w-8 p-0"
                title="Manage Tags"
              >
                <Settings className="h-4 w-4 text-gray-500" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-8 w-8 p-0"
              title="Close Panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as 'measurements' | 'items' | 'comments')} 
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="grid w-full grid-cols-3 mx-3 mt-2 mb-0 flex-shrink-0" style={{ width: 'calc(100% - 24px)' }}>
          <TabsTrigger value="measurements" className="text-xs px-1">
            <Ruler className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Measure</span>
            {totalMeasurements > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {totalMeasurements}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="items" className="text-xs px-1">
            <Tag className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Items</span>
            {totalItems > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {totalItems}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="comments" className="text-xs px-1">
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Notes</span>
            {totalComments > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                {totalComments}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="measurements" className="flex-1 overflow-hidden m-0 mt-2">
          {measurementsContent}
        </TabsContent>

        <TabsContent value="items" className="flex-1 overflow-y-auto m-0 mt-2 p-3">
          <ItemList
            items={items}
            onItemClick={onItemClick}
            onItemEdit={onItemEdit}
            onItemDelete={onItemDelete}
            onItemHover={onItemHover}
            onAddItemType={onAddItemType}
          />
        </TabsContent>

        <TabsContent value="comments" className="flex-1 overflow-y-auto m-0 mt-2 p-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">
                Comments ({totalComments})
              </h4>
              {onAddComment && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAddComment}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
            {totalComments === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm text-gray-600 mb-3">No comments yet</p>
                {onAddComment && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAddComment}
                    className="h-8"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Comment
                  </Button>
                )}
              </div>
            ) : (() => {
              const commentMap = new Map<string, Drawing>()
              comments.filter(d => d.type === 'comment').forEach(c => commentMap.set(c.id, c))
              
              return organizeCommentsIntoThreads(comments.filter(d => d.type === 'comment'))
                .map(comment => (
                  <div
                    key={comment.id}
                    className="cursor-pointer"
                    onClick={() => onCommentClick?.(comment)}
                  >
                    <ThreadedCommentDisplay
                      comment={comment}
                      onReply={onCommentReply || (() => {})}
                      onResolve={onCommentResolve || (() => {})}
                      currentUserId={userId}
                      currentUserName={userEmail}
                      getReplyCount={(commentId) => {
                        const foundComment = commentMap.get(commentId)
                        return foundComment ? getReplyCount(foundComment) : 0
                      }}
                    />
                  </div>
                ))
            })()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )

  // Mobile/Tablet: Render as overlay drawer
  if (isMobile || isTablet) {
    return (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onToggle}
        />
        
        {/* Drawer */}
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed left-0 top-0 bottom-0 w-[85vw] max-w-[320px] bg-white shadow-xl z-50 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {sidebarContent}
        </motion.div>
      </>
    )
  }

  // Desktop: Render as sidebar
  return (
    <div
      className="bg-white border-r border-gray-200 flex flex-col relative z-20 h-full max-h-[calc(100vh-80px)]"
      style={{ width: `${width}px`, minWidth: '240px', maxWidth: '600px' }}
    >
      {sidebarContent}
      
      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 bottom-0 w-1 bg-gray-200 hover:bg-gray-300 cursor-ew-resize transition-colors"
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
