'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, ChevronDown, MapPin, Ruler, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, Save, X, Building2, Home, Layers, Zap, Paintbrush, Package } from 'lucide-react'

export interface BoundingBox {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface TakeoffItem {
  id?: string
  name: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number
  total_cost?: number
  category: string
  subcategory?: string
  subcontractor?: string
  cost_code?: string
  cost_code_description?: string
  location?: string
  notes?: string
  dimensions?: string
  bounding_box?: BoundingBox
  ai_provider?: string
  confidence?: number
  parent_id?: string
  user_created?: boolean
  user_modified?: boolean
}

interface TakeoffAccordionProps {
  items: TakeoffItem[]
  summary?: {
    total_items?: number
    categories?: Record<string, number>
    subcategories?: Record<string, number>
    total_area_sf?: number
    plan_scale?: string
    confidence?: string
    notes?: string
  }
  onItemHighlight?: (bbox: BoundingBox) => void
  onPageNavigate?: (page: number) => void
  editable?: boolean
  onItemsChange?: (items: TakeoffItem[]) => void
}

// Category configuration for styling
const CATEGORY_CONFIG = {
  structural: { color: 'bg-orange-100 text-orange-800', label: 'Structural', icon: Building2 },
  exterior: { color: 'bg-green-100 text-green-800', label: 'Exterior', icon: Home },
  interior: { color: 'bg-purple-100 text-purple-800', label: 'Interior', icon: Layers },
  mep: { color: 'bg-yellow-100 text-yellow-800', label: 'MEP', icon: Zap },
  finishes: { color: 'bg-pink-100 text-pink-800', label: 'Finishes', icon: Paintbrush },
  other: { color: 'bg-gray-100 text-gray-800', label: 'Other', icon: Package }
}

export default function TakeoffAccordion({ items, summary, onItemHighlight, onPageNavigate, editable = false, onItemsChange }: TakeoffAccordionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [draftItem, setDraftItem] = useState<Partial<TakeoffItem> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState<string>('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingSubcategory, setEditingSubcategory] = useState<{category: string, subcategory: string} | null>(null)
  const [draftCategoryName, setDraftCategoryName] = useState<string>('')
  const [draftSubcategoryName, setDraftSubcategoryName] = useState<string>('')

  // Ensure items is always an array
  const safeItems = Array.isArray(items) ? items : []

  // Organize items into 3-level hierarchy: Category → Subcontractor → Items
  // Note: Items with parent_id are excluded from main hierarchy - they only appear as sub-items
  const { hierarchy, categoryDisplayName } = useMemo(() => {
    const organized: Record<string, Record<string, TakeoffItem[]>> = {}
    const displayName: Record<string, string> = {}

    safeItems.forEach(item => {
      // Skip items with parent_id - they are sub-items and should only appear in sub-items section
      if (item.parent_id) {
        return
      }

      const rawCategory = (item.category || 'Other').trim()
      const categoryKey = rawCategory.toLowerCase()
      // Use subcontractor as the subcategory level, default to "Unassigned"
      const subcontractor = item.subcontractor || 'Unassigned'

      if (!organized[categoryKey]) {
        organized[categoryKey] = {}
      }

      if (!organized[categoryKey][subcontractor]) {
        organized[categoryKey][subcontractor] = []
      }

      if (!displayName[categoryKey]) {
        displayName[categoryKey] = rawCategory
      }

      organized[categoryKey][subcontractor].push(item)
    })

    return { hierarchy: organized, categoryDisplayName: displayName }
  }, [safeItems])

  const childrenByParentId = useMemo(() => {
    const map: Record<string, TakeoffItem[]> = {}
    items.forEach(it => {
      if (it.parent_id) {
        if (!map[it.parent_id]) map[it.parent_id] = []
        map[it.parent_id].push(it)
      }
    })
    return map
  }, [items])

  const upsertItem = (updated: TakeoffItem) => {
    const next = items.map(i => (i.id === updated.id ? updated : i))
    onItemsChange?.(next)
  }

  const deleteItem = (id?: string) => {
    if (!id) return
    // remove item and any children
    const next = items.filter(i => i.id !== id && i.parent_id !== id)
    onItemsChange?.(next)
  }

  const addItem = (category: string, subcategory?: string, parentId?: string) => {
    const base: TakeoffItem = {
      id: crypto.randomUUID(),
      name: 'New Item',
      description: '',
      quantity: 1,
      unit: 'unit',
      category,
      subcategory,
      parent_id: parentId,
      user_created: true
    }
    onItemsChange?.([...items, base])
    setEditingId(base.id!)
    setDraftItem(base)
  }

  const addCategory = () => {
    const name = (newCategoryName || '').trim()
    if (!name) return
    addItem(name, 'Uncategorized')
    setNewCategoryName('')
  }

  const startEdit = (item: TakeoffItem) => {
    setEditingId(item.id || null)
    setDraftItem({ ...item })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraftItem(null)
  }

  // Keep draftItem in sync when items change (e.g., when parent updates items array)
  // This ensures that newly added items remain in edit mode when items prop updates
  // Only update if draftItem is missing or stale (not while user is actively editing)
  useEffect(() => {
    if (editingId && items.length > 0) {
      const currentItem = items.find(i => i.id === editingId)
      if (currentItem) {
        // Only update if draftItem doesn't exist or is for a different item
        // This prevents overwriting user's input while they're typing
        if (!draftItem || draftItem.id !== editingId) {
          setDraftItem({ ...currentItem })
        }
      } else {
        // Item was deleted, cancel editing
        cancelEdit()
      }
    }
  }, [items, editingId])

  const saveEdit = () => {
    if (!draftItem || !editingId) return
    // Calculate total_cost from quantity and unit_cost
    const unitCost = draftItem.unit_cost || 0
    const quantity = draftItem.quantity || 0
    const totalCost = unitCost * quantity
    
    const updated: TakeoffItem = {
      ...(items.find(i => i.id === editingId) as TakeoffItem),
      ...draftItem,
      total_cost: totalCost,
      user_modified: true
    }
    upsertItem(updated)
    cancelEdit()
  }

  const startEditCategory = (categoryKey: string) => {
    setEditingCategory(categoryKey)
    // Find the display name for this category from the first item with this category
    const firstItem = items.find(item => {
      const itemCategory = (item.category || 'Other').trim()
      return itemCategory.toLowerCase() === categoryKey.toLowerCase()
    })
    const displayName = firstItem?.category || categoryDisplayName[categoryKey] || categoryKey
    setDraftCategoryName(displayName)
  }

  const saveCategoryEdit = () => {
    if (!editingCategory || !draftCategoryName.trim()) {
      cancelCategoryEdit()
      return
    }
    
    const newCategoryName = draftCategoryName.trim()
    // Update all items with this category
    const updatedItems = items.map(item => {
      const itemCategory = (item.category || 'Other').trim()
      const categoryKey = itemCategory.toLowerCase()
      if (categoryKey === editingCategory.toLowerCase()) {
        return { ...item, category: newCategoryName, user_modified: true }
      }
      return item
    })
    
    onItemsChange?.(updatedItems)
    cancelCategoryEdit()
  }

  const cancelCategoryEdit = () => {
    setEditingCategory(null)
    setDraftCategoryName('')
  }

  const startEditSubcategory = (category: string, subcategory: string) => {
    setEditingSubcategory({ category, subcategory })
    setDraftSubcategoryName(subcategory)
  }

  const saveSubcategoryEdit = () => {
    if (!editingSubcategory || !draftSubcategoryName.trim()) {
      cancelSubcategoryEdit()
      return
    }
    
    const newSubcategoryName = draftSubcategoryName.trim()
    // Update all items with this category + subcategory combination
    const updatedItems = items.map(item => {
      const itemCategory = (item.category || 'Other').trim()
      const itemSubcategory = item.subcategory || 'Uncategorized'
      const categoryKey = itemCategory.toLowerCase()
      
      if (categoryKey === editingSubcategory.category.toLowerCase() && 
          itemSubcategory === editingSubcategory.subcategory) {
        return { ...item, subcategory: newSubcategoryName, user_modified: true }
      }
      return item
    })
    
    onItemsChange?.(updatedItems)
    cancelSubcategoryEdit()
  }

  const cancelSubcategoryEdit = () => {
    setEditingSubcategory(null)
    setDraftSubcategoryName('')
  }

  // Format currency helper
  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Calculate cost for an item (including children if any)
  const calculateItemCost = useMemo(() => {
    return (item: TakeoffItem): number => {
      let itemCost = item.total_cost || 0
      // If total_cost is not set but unit_cost and quantity are, calculate it
      if (!itemCost && item.unit_cost !== undefined && item.quantity) {
        itemCost = item.unit_cost * item.quantity
      }
      
      // Add sub-items cost
      if (item.id && childrenByParentId[item.id]) {
        childrenByParentId[item.id].forEach(child => {
          const childCost = child.total_cost || (child.unit_cost || 0) * (child.quantity || 0)
          itemCost += childCost
        })
      }
      return itemCost
    }
  }, [childrenByParentId])

  // Filter items based on search
  const filteredHierarchy = useMemo(() => {
    if (!searchQuery) return hierarchy
    
    const query = searchQuery.toLowerCase()
    const filtered: Record<string, Record<string, TakeoffItem[]>> = {}
    
    Object.entries(hierarchy).forEach(([category, subcategories]) => {
      Object.entries(subcategories).forEach(([subcategory, subcatItems]) => {
        const matchingItems = subcatItems.filter(item =>
          item.name?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.cost_code?.includes(query) ||
          item.location?.toLowerCase().includes(query)
        )
        
        if (matchingItems.length > 0) {
          if (!filtered[category]) {
            filtered[category] = {}
          }
          filtered[category][subcategory] = matchingItems
        }
      })
    })
    
    return filtered
  }, [hierarchy, searchQuery])

  // Calculate totals for each level (including cost)
  const categoryTotals = useMemo(() => {
    const totals: Record<string, { items: number; quantity: number; cost: number }> = {}
    
    Object.entries(hierarchy).forEach(([category, subcategories]) => {
      let itemCount = 0
      let quantitySum = 0
      let costSum = 0
      
      Object.values(subcategories).forEach(subcatItems => {
        itemCount += subcatItems.length
        subcatItems.forEach(item => {
          quantitySum += item.quantity || 0
          costSum += calculateItemCost(item)
        })
      })
      
      totals[category] = { items: itemCount, quantity: quantitySum, cost: costSum }
    })
    
    return totals
  }, [hierarchy, childrenByParentId])

  const subcategoryTotals = useMemo(() => {
    const totals: Record<string, { items: number; quantity: number; cost: number }> = {}
    
    Object.values(hierarchy).forEach(subcategories => {
      Object.entries(subcategories).forEach(([subcategory, subcatItems]) => {
        let quantitySum = 0
        let costSum = 0
        subcatItems.forEach(item => {
          quantitySum += item.quantity || 0
          costSum += calculateItemCost(item)
        })
        
        totals[subcategory] = {
          items: subcatItems.length,
          quantity: quantitySum,
          cost: costSum
        }
      })
    })
    
    return totals
  }, [hierarchy, childrenByParentId])

  // Calculate overall total
  const overallTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + calculateItemCost(item), 0)
  }, [items, calculateItemCost])

  return (
    <div className="space-y-4">
      {/* Overall Total Summary */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-50/50 dark:from-orange-950/30 dark:to-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <h3 className="font-bold text-lg text-orange-900 dark:text-orange-100">Total Estimate</h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {formatCurrency(overallTotal)}
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search items, cost codes, or locations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Add Category */}
      {editable && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="outline" onClick={addCategory}>
            <Plus className="h-4 w-4 mr-1" /> Add Category
          </Button>
        </div>
      )}

      {/* Level 1: Main Categories */}
      <Accordion type="multiple" className="space-y-2">
        {Object.entries(filteredHierarchy).map(([category, subcategories]) => {
          const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other
          const totals = categoryTotals[category]
          const displayCategory = categoryDisplayName[category] || category
          
          return (
            <AccordionItem key={category} value={category} className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    {React.createElement(config.icon, { className: 'h-5 w-5' })}
                    <div className="text-left">
                      {editable && editingCategory === category ? (
                        <Input
                          value={draftCategoryName}
                          onChange={(e) => setDraftCategoryName(e.target.value)}
                          className="h-8 w-48 text-lg font-bold"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation()
                              saveCategoryEdit()
                            } else if (e.key === 'Escape') {
                              e.stopPropagation()
                              cancelCategoryEdit()
                            }
                          }}
                        />
                      ) : (
                        <h3 className="font-bold text-lg">{displayCategory}</h3>
                      )}
                      <p className="text-xs text-gray-500">
                        {totals.items} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editable && editingCategory === category ? (
                      <>
                        <div 
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 py-1 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); saveCategoryEdit() }}
                        >
                          <Save className="h-3 w-3 mr-1" /> Save
                        </div>
                        <div 
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); cancelCategoryEdit() }}
                        >
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </div>
                      </>
                    ) : (
                      <>
                        <Badge className={config.color}>
                          {totals.items} items
                        </Badge>
                        <Badge variant="outline" className="font-semibold text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                          {formatCurrency(totals.cost)}
                        </Badge>
                        {editable && (
                          <>
                            <div 
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); startEditCategory(category) }}
                            >
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </div>
                            <div 
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); addItem(displayCategory) }}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add Item
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="px-2 pb-2">
                {/* Level 2: Subcategories */}
                <Accordion type="multiple" className="space-y-1">
                  {Object.entries(subcategories).map(([subcategory, subcatItems]) => {
                    const subcatTotals = subcategoryTotals[subcategory]
                    
                    return (
                      <AccordionItem
                        key={`${category}-${subcategory}`}
                        value={`${category}-${subcategory}`}
                        className="border-l-2 border-orange-200 ml-4"
                      >
                        <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-orange-50/50">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="text-left">
                              {editable && editingSubcategory?.category === category && editingSubcategory?.subcategory === subcategory ? (
                                <Input
                                  value={draftSubcategoryName}
                                  onChange={(e) => setDraftSubcategoryName(e.target.value)}
                                  className="h-7 w-40 text-sm font-semibold"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.stopPropagation()
                                      saveSubcategoryEdit()
                                    } else if (e.key === 'Escape') {
                                      e.stopPropagation()
                                      cancelSubcategoryEdit()
                                    }
                                  }}
                                />
                              ) : (
                                <h4 className="font-semibold text-sm">{subcategory}</h4>
                              )}
                              <p className="text-xs text-gray-500">
                                {subcatTotals.items} items
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {editable && editingSubcategory?.category === category && editingSubcategory?.subcategory === subcategory ? (
                                <>
                                  <div 
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3 py-1 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); saveSubcategoryEdit() }}
                                  >
                                    <Save className="h-3 w-3 mr-1" /> Save
                                  </div>
                                  <div 
                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); cancelSubcategoryEdit() }}
                                  >
                                    <X className="h-3 w-3 mr-1" /> Cancel
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Badge variant="outline" className="text-xs">
                                    {subcatTotals.items}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs font-semibold text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                                    {formatCurrency(subcatTotals.cost)}
                                  </Badge>
                                  {editable && (
                                    <>
                                      <div 
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); startEditSubcategory(category, subcategory) }}
                                      >
                                        <Pencil className="h-3 w-3 mr-1" /> Edit
                                      </div>
                                      <div 
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); addItem(displayCategory, subcategory) }}
                                      >
                                        <Plus className="h-4 w-4 mr-1" /> Add Item
                                      </div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        
                        <AccordionContent className="px-2 pb-2">
                          {/* Level 3: Line Items */}
                          <div className="space-y-2 ml-4">
                            {subcatItems.map((item, index) => {
                              // Clean notes to remove consensus metadata
                              const cleanedNotes = item.notes && !item.notes.includes('Consensus from unknown') && !item.notes.startsWith('High-confidence consensus from unknown') 
                                ? item.notes 
                                : item.notes?.split('|').slice(1).join('|').trim() || null
                              
                              return (
                              <Card
                                key={`${item.id || `${category}-${subcategory}-${index}`}`}
                                className={`hover:shadow-lg transition-all ${
                                  item.bounding_box ? 'cursor-pointer hover:border-orange-500' : ''
                                }`}
                                onClick={() => item.bounding_box && onItemHighlight?.(item.bounding_box)}
                              >
								<CardContent className="p-5">
                                  <div className="space-y-3">
                                    {/* Item Header */}
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start gap-2 mb-2">
                                          {editingId === item.id && editable ? (
                                            <Input
                                              value={draftItem?.name || ''}
                                              onChange={(e) => setDraftItem(d => ({ ...(d || {}), name: e.target.value }))}
                                              className="h-8 flex-1"
                                              autoFocus
                                              placeholder="Item name"
                                            />
                                          ) : (
                                            <h5 className="font-semibold text-base leading-tight text-gray-900">
                                              {item.name}
                                            </h5>
                                          )}
                                          {item.bounding_box && (
                                            <Badge 
                                              variant="secondary" 
                                              className="text-xs cursor-pointer hover:bg-orange-50 transition-colors shrink-0 border-orange-200"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                onPageNavigate?.(item.bounding_box!.page)
                                              }}
                                            >
                                              <MapPin className="h-3 w-3 mr-1 text-orange-600" />
                                              Page {item.bounding_box.page}
                                            </Badge>
                                          )}
                                        </div>
                                        {editingId === item.id && editable ? (
                                          <Textarea
                                            value={draftItem?.description || ''}
                                            onChange={(e) => setDraftItem(d => ({ ...(d || {}), description: e.target.value }))}
                                            className="h-20 text-sm"
                                            placeholder="Description"
                                          />
                                        ) : (
                                          item.description && item.name !== item.description && (
                                            <p className="text-sm text-gray-600 leading-relaxed">
                                              {item.description}
                                            </p>
                                          )
                                        )}
                                      </div>
                                    </div>

                                    {/* Cost Code & Location Row */}
                                    {(item.cost_code || item.location) && (
                                      <div className="flex items-center gap-3 flex-wrap">
                                        {item.cost_code && (
                                          <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className="text-xs font-mono bg-gray-50">
                                              {item.cost_code}
                                            </Badge>
                                            {item.cost_code_description && (
                                              <span className="text-xs text-gray-500">
                                                {item.cost_code_description}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        {item.location && (
                                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                            <span className="text-gray-500">Section:</span>
                                            <span className="font-medium">{item.location}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Dimensions */}
                                    {item.dimensions && (
                                      <div className="text-xs text-gray-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <Ruler className="h-3.5 w-3.5 text-orange-600" />
                                          <span className="font-medium">{item.dimensions}</span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Notes */}
                                    {cleanedNotes && (
                                      <div className="text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                        <div className="flex items-start gap-2">
                                          <span className="text-base">💡</span>
                                          <span className="leading-relaxed">{cleanedNotes}</span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Quantity & Cost Display */}
                                    <div className="border-t pt-3">
                                      {editingId === item.id && editable ? (
                                        <div className="flex gap-2">
                                          <Input
                                            value={String(draftItem?.quantity ?? '')}
                                            onChange={(e) => {
                                              const qty = Number(e.target.value) || 0
                                              const unitCost = draftItem?.unit_cost || 0
                                              setDraftItem(d => ({ 
                                                ...(d || {}), 
                                                quantity: qty,
                                                total_cost: qty * unitCost
                                              }))
                                            }}
                                            className="h-9 w-20"
                                            placeholder="Qty"
                                          />
                                          <Input
                                            value={draftItem?.unit || ''}
                                            onChange={(e) => setDraftItem(d => ({ ...(d || {}), unit: e.target.value }))}
                                            className="h-9 w-24"
                                            placeholder="Unit"
                                          />
                                          <Input
                                            type="number"
                                            step="0.01"
                                            value={String(draftItem?.unit_cost ?? '')}
                                            onChange={(e) => {
                                              const unitCost = Number(e.target.value) || 0
                                              const qty = draftItem?.quantity || 0
                                              setDraftItem(d => ({ 
                                                ...(d || {}), 
                                                unit_cost: unitCost,
                                                total_cost: qty * unitCost
                                              }))
                                            }}
                                            className="h-9 flex-1"
                                            placeholder="$/unit"
                                          />
                                        </div>
												) : (
													<div className="grid grid-cols-3 gap-4">
														<div className="text-center">
															<div className="text-lg font-bold text-gray-900">
																{item.quantity}
															</div>
															<div className="text-xs text-gray-600 mt-0.5">{item.unit}</div>
														</div>
														<div className="text-center border-x">
															<div className="text-base font-semibold text-gray-900">
																{item.unit_cost !== undefined ? formatCurrency(item.unit_cost) : '—'}
															</div>
															<div className="text-xs text-gray-600 mt-0.5">per {item.unit}</div>
														</div>
														<div className="text-center">
															<div className="text-xl font-bold text-green-700">
																{calculateItemCost(item) > 0 ? formatCurrency(calculateItemCost(item)) : '—'}
															</div>
															<div className="text-xs text-gray-600 mt-0.5">Total</div>
														</div>
													</div>
												)}
                                    </div>

                                    {editable && (
                                      <div className="flex items-center gap-2 pt-2">
                                        {editingId === item.id ? (
                                          <>
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit() }}>
                                              <Save className="h-4 w-4 mr-1" /> Save
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); cancelEdit() }}>
                                              <X className="h-4 w-4 mr-1" /> Cancel
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startEdit(item) }}>
                                              <Pencil className="h-4 w-4 mr-1" /> Edit
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}>
                                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); addItem(item.category, item.subcategory, item.id) }}>
                                              <Plus className="h-4 w-4 mr-1" /> Add Sub-item
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Sub-items */}
                                    {editable && item.id && (childrenByParentId[item.id]?.length ?? 0) > 0 && (
                                      <div className="mt-3 ml-4 border-l-2 border-orange-200 pl-3 space-y-2">
                                        <div className="text-xs font-semibold text-gray-600 mb-1">Sub-items:</div>
                                        {childrenByParentId[item.id]!.map((child) => {
                                          const childCost = calculateItemCost(child)
                                          const isEditing = editingId === child.id
                                          return (
                                            <div key={child.id} className="bg-gray-50 dark:bg-gray-800 rounded p-2 space-y-2">
                                              {isEditing ? (
                                                <>
                                                  <div className="space-y-2">
                                                    <Input
                                                      value={draftItem?.name || ''}
                                                      onChange={(e) => setDraftItem(d => ({ ...(d || {}), name: e.target.value }))}
                                                      className="h-8 text-xs"
                                                      placeholder="Item name"
                                                      autoFocus
                                                    />
                                                    <Textarea
                                                      value={draftItem?.description || ''}
                                                      onChange={(e) => setDraftItem(d => ({ ...(d || {}), description: e.target.value }))}
                                                      className="h-16 text-xs"
                                                      placeholder="Description"
                                                    />
                                                    <div className="flex gap-2">
                                                      <Input
                                                        value={String(draftItem?.quantity ?? '')}
                                                        onChange={(e) => {
                                                          const qty = Number(e.target.value) || 0
                                                          const unitCost = draftItem?.unit_cost || 0
                                                          setDraftItem(d => ({ 
                                                            ...(d || {}), 
                                                            quantity: qty,
                                                            total_cost: qty * unitCost
                                                          }))
                                                        }}
                                                        className="h-8 w-20 text-xs"
                                                        placeholder="Qty"
                                                      />
                                                      <Input
                                                        value={draftItem?.unit || ''}
                                                        onChange={(e) => setDraftItem(d => ({ ...(d || {}), unit: e.target.value }))}
                                                        className="h-8 w-24 text-xs"
                                                        placeholder="Unit"
                                                      />
                                                      <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={String(draftItem?.unit_cost ?? '')}
                                                        onChange={(e) => {
                                                          const unitCost = Number(e.target.value) || 0
                                                          const qty = draftItem?.quantity || 0
                                                          setDraftItem(d => ({ 
                                                            ...(d || {}), 
                                                            unit_cost: unitCost,
                                                            total_cost: qty * unitCost
                                                          }))
                                                        }}
                                                        className="h-8 flex-1 text-xs"
                                                        placeholder="$/unit"
                                                      />
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); saveEdit() }}>
                                                      <Save className="h-3 w-3 mr-1" /> Save
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); cancelEdit() }}>
                                                      <X className="h-3 w-3 mr-1" /> Cancel
                                                    </Button>
                                                  </div>
                                                </>
                                              ) : (
                                                <div className="flex items-center justify-between">
                                                  <div className="text-xs text-gray-700 dark:text-gray-300 flex-1">
                                                    <span className="font-medium">{child.name}</span>
                                                    {child.description && child.name !== child.description && (
                                                      <div className="text-gray-500 text-xs mt-1">{child.description}</div>
                                                    )}
                                                    <div className="text-gray-500 mt-1">
                                                      {child.quantity} {child.unit}
                                                      {child.unit_cost !== undefined && (
                                                        <span className="ml-2">@ {formatCurrency(child.unit_cost)}/{child.unit}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    {childCost > 0 && (
                                                      <Badge variant="outline" className="text-xs font-semibold text-green-700 dark:text-green-400">
                                                        {formatCurrency(childCost)}
                                                      </Badge>
                                                    )}
                                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); startEdit(child) }}>
                                                      <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteItem(child.id) }}>
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })}
                                        {calculateItemCost(item) !== (item.total_cost || (item.unit_cost || 0) * (item.quantity || 0)) && (
                                          <div className="text-xs text-right text-gray-600 dark:text-gray-400 pt-1 border-t">
                                            Sub-items total: {formatCurrency(
                                              (childrenByParentId[item.id] || []).reduce((sum, child) => sum + calculateItemCost(child), 0)
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                              )
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {/* Empty State */}
      {Object.keys(filteredHierarchy).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            {searchQuery ? 'No items match your search' : 'No items to display'}
          </p>
        </div>
      )}
    </div>
  )
}


