'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Search, MapPin, Pencil, Trash2, Tag, Plus } from 'lucide-react'
import { Drawing } from '@/lib/canvas-utils'
import { ITEM_TYPES, getItemTypeById, CATEGORY_LABELS, type ItemTypeDefinition } from '@/lib/item-types'

interface ItemListProps {
  items: Drawing[]
  onItemClick: (item: Drawing) => void
  onItemEdit?: (item: Drawing) => void
  onItemDelete?: (itemId: string) => void
  onItemHover?: (itemId: string | null) => void
  onAddItemType?: (itemType: string, itemCategory?: string, itemLabel?: string) => void
}

type GroupByOption = 'type' | 'category' | 'page' | 'none'

export default function ItemList({
  items,
  onItemClick,
  onItemEdit,
  onItemDelete,
  onItemHover,
  onAddItemType
}: ItemListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<GroupByOption>('type')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPage, setFilterPage] = useState<string>('all')
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)

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

    // Filter by page
    if (filterPage !== 'all') {
      const pageNum = parseInt(filterPage)
      if (!isNaN(pageNum)) {
        filtered = filtered.filter(item => item.pageNumber === pageNum)
      }
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
  }, [items, searchQuery, filterCategory, filterType, filterPage])

  // Group items by type (itemType + itemLabel combination for identical items)
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
        // Group by itemType + itemLabel combination to group identical items
        const itemType = getItemTypeById(item.itemType || '')
        const typeLabel = itemType?.label || item.itemType || 'Unknown'
        const itemLabel = item.itemLabel || ''
        // Create a unique key for items of the same type and label
        key = itemLabel ? `${typeLabel} - ${itemLabel}` : typeLabel
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
        // Sort by count (descending) then alphabetically
        const countA = grouped[a].length
        const countB = grouped[b].length
        if (countA !== countB) {
          return countB - countA
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

  // Get unique pages for filter
  const uniquePages = useMemo(() => {
    const pages = new Set<number>()
    items.forEach(item => {
      if (item.pageNumber) {
        pages.add(item.pageNumber)
      }
    })
    return Array.from(pages).sort((a, b) => a - b)
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

        <Select value={filterPage} onValueChange={setFilterPage}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="All Pages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pages</SelectItem>
            {uniquePages.map(pageNum => (
              <SelectItem key={pageNum} value={pageNum.toString()}>
                Page {pageNum}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            {searchQuery || filterCategory !== 'all' || filterType !== 'all' || filterPage !== 'all'
              ? 'No items match your filters'
              : 'No items tagged yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {groupBy === 'none' ? (
            <div className="space-y-2">
              {filteredItems.map(item => {
                const itemType = getItemTypeById(item.itemType || '')
                const Icon = itemType?.icon || Tag
                const color = itemType?.color || '#3b82f6'
                
                const isHovered = hoveredItemId === item.id
                
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    onMouseEnter={() => {
                      setHoveredItemId(item.id)
                      onItemHover?.(item.id)
                    }}
                    onMouseLeave={() => {
                      setHoveredItemId(null)
                      onItemHover?.(null)
                    }}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 p-2 rounded-lg transition-all duration-200"
                        style={{ 
                          backgroundColor: isHovered ? `${color}30` : `${color}20`, 
                          color,
                          transform: isHovered ? 'scale(1.15)' : 'scale(1)'
                        }}
                      >
                        <Icon className="h-4 w-4 transition-all duration-200" style={{ transform: isHovered ? 'scale(1.1)' : 'scale(1)' }} />
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
          ) : (
            <Accordion type="multiple" className="w-full" defaultValue={Object.keys(groupedItems).slice(0, 5)}>
              {Object.entries(groupedItems).map(([groupKey, groupItems]) => {
                const firstItem = groupItems[0]
                const itemType = getItemTypeById(firstItem.itemType || '')
                const Icon = itemType?.icon || Tag
                const color = itemType?.color || '#3b82f6'
                
                const handleAddMore = (e: React.MouseEvent) => {
                  e.stopPropagation()
                  if (onAddItemType) {
                    onAddItemType(
                      firstItem.itemType || '',
                      firstItem.itemCategory,
                      firstItem.itemLabel || undefined
                    )
                  }
                }
                
                return (
                  <AccordionItem key={groupKey} value={groupKey} className="border-b">
                    <div className="flex items-center gap-2">
                      <AccordionTrigger className="hover:no-underline py-3 flex-1">
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <div
                            className="flex-shrink-0 p-1.5 rounded-md"
                            style={{ backgroundColor: `${color}20`, color }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900">
                              {groupKey}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {groupItems.length} {groupItems.length === 1 ? 'item' : 'items'}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      {onAddItemType && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-gray-100 mr-2"
                          onClick={handleAddMore}
                          title="Add more of this item type"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <AccordionContent className="pt-2 pb-3">
                      <div className="space-y-2 pl-9">
                        {groupItems.map(item => {
                          const itemType = getItemTypeById(item.itemType || '')
                          const Icon = itemType?.icon || Tag
                          const color = itemType?.color || '#3b82f6'
                          const isHovered = hoveredItemId === item.id
                          
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleItemClick(item)}
                              onMouseEnter={() => setHoveredItemId(item.id)}
                              onMouseLeave={() => setHoveredItemId(null)}
                              className="p-2.5 border rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  className="flex-shrink-0 p-1.5 rounded-md transition-all duration-200"
                                  style={{ 
                                    backgroundColor: isHovered ? `${color}30` : `${color}20`, 
                                    color,
                                    transform: isHovered ? 'scale(1.15)' : 'scale(1)'
                                  }}
                                >
                                  <Icon className="h-3.5 w-3.5 transition-all duration-200" style={{ transform: isHovered ? 'scale(1.1)' : 'scale(1)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
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
                                    className="h-6 w-6 p-0"
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
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </div>
      )}
    </div>
  )
}





