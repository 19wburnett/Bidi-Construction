'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import { 
  TRADE_CATEGORIES, 
  TRADE_GROUPS, 
  getAllTrades 
} from '@/lib/trade-types'
import { X, Tag, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { PlanTradeTag } from '@/types/takeoff'

interface PlanTradeTagSelectorProps {
  planId: string
  initialTags?: PlanTradeTag[]
  onTagsChange?: (tags: PlanTradeTag[]) => void
  className?: string
}

export default function PlanTradeTagSelector({
  planId,
  initialTags = [],
  onTagsChange,
  className = ''
}: PlanTradeTagSelectorProps) {
  const [tags, setTags] = useState<PlanTradeTag[]>(initialTags)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Load tags on mount
  useEffect(() => {
    loadTags()
  }, [planId])

  // Update when initialTags change
  useEffect(() => {
    if (initialTags.length > 0) {
      setTags(initialTags)
    }
  }, [initialTags])

  async function loadTags() {
    setLoading(true)
    try {
      const response = await fetch(`/api/plans/${planId}/trade-tags`)
      const data = await response.json()
      
      if (data.success && data.tradeTags) {
        setTags(data.tradeTags)
        onTagsChange?.(data.tradeTags)
      }
    } catch (error) {
      console.error('Error loading trade tags:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleTrade(tradeCategory: string) {
    const isSelected = tags.some(tag => tag.trade_category === tradeCategory)
    
    if (isSelected) {
      // Remove tag
      await removeTag(tradeCategory)
    } else {
      // Add tag
      await addTag(tradeCategory)
    }
  }

  async function addTag(tradeCategory: string) {
    setSaving(true)
    try {
      const response = await fetch(`/api/plans/${planId}/trade-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeCategories: [tradeCategory]
        })
      })

      const data = await response.json()
      
      if (data.success) {
        await loadTags() // Reload to get the new tag with ID
      } else {
        throw new Error(data.error || 'Failed to add tag')
      }
    } catch (error) {
      console.error('Error adding tag:', error)
      alert('Failed to add trade tag. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function removeTag(tradeCategory: string) {
    setSaving(true)
    try {
      const response = await fetch(
        `/api/plans/${planId}/trade-tags?trade_category=${encodeURIComponent(tradeCategory)}`,
        {
          method: 'DELETE'
        }
      )

      const data = await response.json()
      
      if (data.success) {
        await loadTags() // Reload to get updated tags
      } else {
        throw new Error(data.error || 'Failed to remove tag')
      }
    } catch (error) {
      console.error('Error removing tag:', error)
      alert('Failed to remove trade tag. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedTradeCategories = useMemo(() => {
    return new Set(tags.map(tag => tag.trade_category))
  }, [tags])

  const [allTrades, setAllTrades] = useState<string[]>([...TRADE_CATEGORIES])

  useEffect(() => {
    async function loadTrades() {
      try {
        const trades = await getAllTrades(supabase)
        setAllTrades(trades)
      } catch (error) {
        console.error('Error loading trades:', error)
        setAllTrades([...TRADE_CATEGORIES])
      }
    }
    loadTrades()
  }, [])

  const filteredTrades = useMemo(() => {
    if (!searchQuery.trim()) {
      return allTrades
    }
    const query = searchQuery.toLowerCase()
    return allTrades.filter(trade => 
      trade.toLowerCase().includes(query)
    )
  }, [allTrades, searchQuery])

  const groupedTrades = useMemo(() => {
    const grouped: Record<string, string[]> = {}
    
    filteredTrades.forEach(trade => {
      // Find which group this trade belongs to
      let groupName = 'Other'
      for (const [group, groupTrades] of Object.entries(TRADE_GROUPS)) {
        if ((groupTrades as readonly string[]).includes(trade)) {
          groupName = group
          break
        }
      }
      
      if (!grouped[groupName]) {
        grouped[groupName] = []
      }
      grouped[groupName].push(trade)
    })
    
    return grouped
  }, [filteredTrades])

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={loading || saving}
          >
            <Tag className="h-4 w-4" />
            {tags.length > 0 ? (
              <>
                {tags.length} Trade{tags.length !== 1 ? 's' : ''}
              </>
            ) : (
              'Assign Trades'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <div className="p-4 space-y-4">
            <div>
              <Label className="text-sm font-semibold">Assign Trade Categories</Label>
              <p className="text-xs text-gray-500 mt-1">
                Select one or more trades that apply to this plan
              </p>
            </div>

            {/* Search */}
            <Input
              placeholder="Search trades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />

            {/* Selected Tags */}
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Selected:</Label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {tag.trade_category}
                      <button
                        onClick={() => removeTag(tag.trade_category)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                        disabled={saving}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Trade List */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {Object.entries(groupedTrades).map(([groupName, groupTrades]) => (
                <div key={groupName} className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-500 uppercase">
                    {groupName}
                  </Label>
                  <div className="space-y-1">
                    {groupTrades.map(trade => {
                      const isSelected = selectedTradeCategories.has(trade)
                      return (
                        <div
                          key={trade}
                          className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => handleToggleTrade(trade)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleTrade(trade)}
                            disabled={saving}
                          />
                          <Label className="text-sm cursor-pointer flex-1">
                            {trade}
                          </Label>
                          {isSelected && (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {filteredTrades.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500">
                No trades found matching "{searchQuery}"
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Display selected tags as badges when not in popover */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map(tag => (
            <Badge
              key={tag.id}
              variant="outline"
              className="text-xs"
            >
              {tag.trade_category}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
