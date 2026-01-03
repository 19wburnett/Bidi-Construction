'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { 
  FileText, 
  Search, 
  Download, 
  Trash2, 
  Pencil,
  Check,
  X,
  ArrowRight,
  Tag,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { Plan, PlanTradeTag } from '@/types/takeoff'
import PlanTradeTagSelector from '@/components/plan-trade-tag-selector'
import { getAllTrades } from '@/lib/trade-types'
import { createClient } from '@/lib/supabase'
import { staggerContainer, staggerItem } from '@/lib/animations'

interface TradeOrganizedPlansViewProps {
  plans: Plan[]
  jobId: string
  onPlanDelete?: (planId: string) => void
  onPlanDownload?: (plan: Plan) => void
  onPlanEdit?: (plan: Plan) => void
  editingPlanId?: string | null
  editingTitle?: string
  onEditingTitleChange?: (title: string) => void
  onSaveTitle?: () => void
  onCancelEditing?: () => void
  searchQuery?: string
  className?: string
}

export default function TradeOrganizedPlansView({
  plans,
  jobId,
  onPlanDelete,
  onPlanDownload,
  onPlanEdit,
  editingPlanId,
  editingTitle,
  onEditingTitleChange,
  onSaveTitle,
  onCancelEditing,
  searchQuery = '',
  className = ''
}: TradeOrganizedPlansViewProps) {
  const [tradeFilter, setTradeFilter] = useState<string>('all')
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set())
  const [planTradeTags, setPlanTradeTags] = useState<Record<string, PlanTradeTag[]>>({})
  const [loadingTags, setLoadingTags] = useState<Set<string>>(new Set())
  const [allTrades, setAllTrades] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    loadTrades()
    loadAllPlanTags()
  }, [plans])

  async function loadTrades() {
    try {
      const trades = await getAllTrades(supabase)
      setAllTrades(trades)
    } catch (error) {
      console.error('Error loading trades:', error)
    }
  }

  async function loadAllPlanTags() {
    const tags: Record<string, PlanTradeTag[]> = {}
    const loading = new Set<string>()

    for (const plan of plans) {
      loading.add(plan.id)
      try {
        const response = await fetch(`/api/plans/${plan.id}/trade-tags`)
        const data = await response.json()
        if (data.success && data.tradeTags) {
          tags[plan.id] = data.tradeTags
        }
      } catch (error) {
        console.error(`Error loading tags for plan ${plan.id}:`, error)
      }
      loading.delete(plan.id)
    }

    setPlanTradeTags(tags)
    setLoadingTags(new Set())
  }

  async function loadPlanTags(planId: string) {
    if (loadingTags.has(planId)) return

    setLoadingTags(prev => new Set(prev).add(planId))
    try {
      const response = await fetch(`/api/plans/${planId}/trade-tags`)
      const data = await response.json()
      if (data.success && data.tradeTags) {
        setPlanTradeTags(prev => ({
          ...prev,
          [planId]: data.tradeTags
        }))
      }
    } catch (error) {
      console.error(`Error loading tags for plan ${planId}:`, error)
    } finally {
      setLoadingTags(prev => {
        const next = new Set(prev)
        next.delete(planId)
        return next
      })
    }
  }

  // Group plans by trade
  const plansByTrade = useMemo(() => {
    const grouped: Record<string, Plan[]> = {}

    plans.forEach(plan => {
      const tags = planTradeTags[plan.id] || []
      
      // Filter by search query
      const matchesSearch = !searchQuery || 
        (plan.title || plan.file_name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.project_location?.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return

      // Filter by trade filter
      if (tradeFilter !== 'all' && tradeFilter !== 'General') {
        const hasMatchingTrade = tags.some(tag => tag.trade_category === tradeFilter)
        if (!hasMatchingTrade) return
      } else if (tradeFilter === 'General') {
        // Only show untagged plans when filtering by General
        if (tags.length > 0) return
      }

      if (tags.length === 0) {
        // Untagged plans go under "General"
        if (!grouped['General']) {
          grouped['General'] = []
        }
        grouped['General'].push(plan)
      } else {
        tags.forEach(tag => {
          if (!grouped[tag.trade_category]) {
            grouped[tag.trade_category] = []
          }
          // Only add if not already added (avoid duplicates)
          if (!grouped[tag.trade_category].includes(plan)) {
            grouped[tag.trade_category].push(plan)
          }
        })
      }
    })

    return grouped
  }, [plans, planTradeTags, searchQuery, tradeFilter])

  // Get all unique trades from plans (including "General" if there are untagged plans)
  const availableTrades = useMemo(() => {
    const trades = new Set<string>()
    Object.values(planTradeTags).forEach(tags => {
      tags.forEach(tag => trades.add(tag.trade_category))
    })
    // Add "General" if there are any untagged plans
    const hasUntagged = plans.some(plan => !planTradeTags[plan.id] || planTradeTags[plan.id].length === 0)
    if (hasUntagged) {
      trades.add('General')
    }
    return Array.from(trades).sort()
  }, [planTradeTags, plans])

  const toggleTrade = (trade: string) => {
    setExpandedTrades(prev => {
      const next = new Set(prev)
      if (next.has(trade)) {
        next.delete(trade)
      } else {
        next.add(trade)
      }
      return next
    })
  }

  const handleTagsChange = (planId: string, tags: PlanTradeTag[]) => {
    setPlanTradeTags(prev => ({
      ...prev,
      [planId]: tags
    }))
    // Reload all tags to ensure consistency
    loadAllPlanTags()
  }

  return (
    <div className={className}>
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <Select value={tradeFilter} onValueChange={setTradeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by trade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {availableTrades.map(trade => (
              <SelectItem key={trade} value={trade}>
                {trade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Trade Groups */}
      <div className="space-y-4">
        {/* Plans by Trade (including General for untagged) */}
        {Object.entries(plansByTrade)
          .sort(([a], [b]) => {
            // Sort "General" to the end
            if (a === 'General') return 1
            if (b === 'General') return -1
            return a.localeCompare(b)
          })
          .map(([trade, tradePlans]) => {
            const isExpanded = expandedTrades.has(trade)
            return (
              <Card key={trade}>
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleTrade(trade)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-gray-500" />
                        <h3 className="font-semibold text-lg">{trade}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {tradePlans.length} plan{tradePlans.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          {tradePlans.map(plan => (
                            <PlanCard
                              key={plan.id}
                              plan={plan}
                              jobId={jobId}
                              tags={planTradeTags[plan.id] || []}
                              onTagsChange={(tags) => handleTagsChange(plan.id, tags)}
                              onDelete={onPlanDelete}
                              onDownload={onPlanDownload}
                              onEdit={onPlanEdit}
                              editingPlanId={editingPlanId}
                              editingTitle={editingTitle}
                              onEditingTitleChange={onEditingTitleChange}
                              onSaveTitle={onSaveTitle}
                              onCancelEditing={onCancelEditing}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            )
          })}

        {/* Empty State */}
        {Object.keys(plansByTrade).length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || tradeFilter !== 'all' ? 'No plans found' : 'No plans uploaded yet'}
              </h3>
              <p className="text-gray-600">
                {searchQuery || tradeFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Upload your first plan to get started'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

interface PlanCardProps {
  plan: Plan
  jobId: string
  tags: PlanTradeTag[]
  onTagsChange: (tags: PlanTradeTag[]) => void
  onDelete?: (planId: string) => void
  onDownload?: (plan: Plan) => void
  onEdit?: (plan: Plan) => void
  editingPlanId?: string | null
  editingTitle?: string
  onEditingTitleChange?: (title: string) => void
  onSaveTitle?: () => void
  onCancelEditing?: () => void
}

function PlanCard({
  plan,
  jobId,
  tags,
  onTagsChange,
  onDelete,
  onDownload,
  onEdit,
  editingPlanId,
  editingTitle,
  onEditingTitleChange,
  onSaveTitle,
  onCancelEditing
}: PlanCardProps) {
  const isEditing = editingPlanId === plan.id

  return (
    <div className="flex items-stretch gap-3 group">
      {isEditing ? (
        <div className="flex-1 flex items-center p-3 bg-white border rounded-lg shadow-sm ring-2 ring-orange-500">
          <FileText className="h-6 w-6 text-orange-600 mr-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Input
                value={editingTitle}
                onChange={(e) => onEditingTitleChange?.(e.target.value)}
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveTitle?.()
                  if (e.key === 'Escape') onCancelEditing?.()
                }}
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onSaveTitle}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onCancelEditing}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Link href={`/dashboard/jobs/${jobId}/plans/${plan.id}`} className="flex-1 flex">
          <div className="flex-1 flex items-center p-3 bg-white border rounded-lg hover:border-orange-500 hover:shadow-md transition-all cursor-pointer">
            <FileText className="h-6 w-6 text-orange-600 mr-3 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 truncate">
                  {plan.title || plan.file_name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onEdit?.(plan)
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Badge variant="secondary" className="text-xs">{plan.status}</Badge>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">
                  {plan.num_pages} page{plan.num_pages !== 1 ? 's' : ''}
                </span>
                {tags.length > 0 && (
                  <>
                    <span className="text-xs text-gray-400">•</span>
                    <div className="flex gap-1 flex-wrap">
                      {tags.map(tag => (
                        <Badge key={tag.id} variant="outline" className="text-xs">
                          {tag.trade_category}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
          </div>
        </Link>
      )}

      <div className="flex flex-col gap-2">
        <PlanTradeTagSelector
          planId={plan.id}
          initialTags={tags}
          onTagsChange={onTagsChange}
          className="flex-shrink-0"
        />
        <div className="flex gap-2">
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onDownload(plan)}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDelete(plan.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
