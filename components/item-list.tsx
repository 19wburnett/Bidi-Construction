'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, MapPin, Pencil, Trash2, Tag } from 'lucide-react'
import { Drawing } from '@/lib/canvas-utils'
import { ITEM_TYPES, getItemTypeById, CATEGORY_LABELS, type ItemTypeDefinition } from '@/lib/item-types'

interface ItemListProps {
  items: Drawing[]
  onItemClick: (item: Drawing) => void
  onItemEdit?: (item: Drawing) => void
  onItemDelete?: (itemId: string) => void
}

type GroupByOption = 'type' | 'category' | 'page' | 'none'

export default function ItemList({
  items,
  onItemClick,
  onItemEdit,
  onItemDelete
}: ItemListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupByOption>('category')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  // Filter items based on search and filters
  const filteredItems = useMemo(() => {
    let filtered = items.filter(item => item.type === 'item')

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(item => item.itemCategory === filterCategory)
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.itemType === filterType)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item => {
        const itemType = getItemTypeById(item.itemType || '')
        const typeLabel = itemType?.label || item.itemType || ''
        const label = item.itemLabel || ''
        const notes = item.itemNotes || ''
        
        return (
          typeLabel.toLowerCase().includes(query) ||
          label.toLowerCase().includes(query) ||
          notes.toLowerCase().includes(query) ||
          item.itemType?.toLowerCase().includes(query) ||
          item.itemCategory?.toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }, [items, searchQuery, filterCategory, filterType])

  // Group items
  const groupedItems = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Items': filteredItems }
    }

    const grouped: Record<string, Drawing[]> = {}

    filteredItems.forEach(item => {
      let key: string

      if (groupBy === 'category') {
        key = item.itemCategory || CATEGORY_LABELS.other
      } else if (groupBy === 'type') {
        const itemType = getItemTypeById(item.itemType || '')
        key = itemType?.label || item.itemType || 'Unknown'
      } else if (groupBy === 'page') {
        key = `Page ${item.pageNumber}`
      } else {
        key = 'All Items'
      }

      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(item)
    })

    // Sort groups
    const sortedGroups: Record<string, Drawing[]> = {}
    Object.keys(grouped)
      .sort((a, b) => {
        if (groupBy === 'page') {
          const pageA = parseInt(a.replace('Page ', '')) || 0
          const pageB = parseInt(b.replace('Page ', '')) || 0
          return pageA - pageB
        }
        return a.localeCompare(b)
      })
      .forEach(key => {
        sortedGroups[key] = grouped[key]
      })

    return sortedGroups
  }, [filteredItems, groupBy])

  // Get unique item types for filter
  const uniqueItemTypes = useMemo(() => {
    const types = new Set<string>()
    items.forEach(item => {
      if (item.itemType) {
        types.add(item.itemType)
      }
    })
    return Array.from(types).sort()
  }, [items])

  // Get unique categories for filter
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>()
    items.forEach(item => {
      if (item.itemCategory) {
        categories.add(item.itemCategory)
      }
    })
    return Array.from(categories).sort()
  }, [items])

  const handleItemClick = (item: Drawing) => {
    onItemClick(item)
  }

  const handleEdit = (e: React.MouseEvent, item: Drawing) => {
    e.stopPropagation()
    if (onItemEdit) {
      onItemEdit(item)
    }
  }

  const handleDelete = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation()
    if (onItemDelete && confirm('Are you sure you want to delete this item?')) {
      onItemDelete(itemId)
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900">
          Items ({filteredItems.length})
        </h4>
      </div>

      {/* Search and Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {uniqueCategories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueItemTypes.map(typeId => {
                const itemType = getItemTypeById(typeId)
                return (
                  <SelectItem key={typeId} value={typeId}>
                    {itemType?.label || typeId}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupByOption)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Grouping</SelectItem>
            <SelectItem value="category">Group by Category</SelectItem>
            <SelectItem value="type">Group by Type</SelectItem>
            <SelectItem value="page">Group by Page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Tag className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-sm text-gray-600 mb-3">
            {searchQuery || filterCategory !== 'all' || filterType !== 'all'
              ? 'No items match your filters'
              : 'No items tagged yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([groupKey, groupItems]) => (
            <div key={groupKey}>
              {groupBy !== 'none' && (
                <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                  {groupKey} ({groupItems.length})
                </div>
              )}
              <div className="space-y-2">
                {groupItems.map(item => {
                  const itemType = getItemTypeById(item.itemType || '')
                  const Icon = itemType?.icon || Tag
                  const color = itemType?.color || '#3b82f6'
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex-shrink-0 p-2 rounded-lg"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {item.itemLabel || itemType?.label || item.itemType || 'Unknown Item'}
                            </span>
                            {itemType && (
                              <Badge variant="outline" className="text-xs">
                                {itemType.label}
                              </Badge>
                            )}
                          </div>
                          {item.itemNotes && (
                            <p className="text-xs text-gray-600 mb-1 line-clamp-2">
                              {item.itemNotes}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin className="h-3 w-3" />
                            <span>Page {item.pageNumber}</span>
                            {item.itemCategory && (
                              <>
                                <span>•</span>
                                <Badge variant="secondary" className="text-xs">
                                  {CATEGORY_LABELS[item.itemCategory as keyof typeof CATEGORY_LABELS] || item.itemCategory}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {onItemEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => handleEdit(e, item)}
                              title="Edit item"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {onItemDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={(e) => handleDelete(e, item.id)}
                              title="Delete item"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


