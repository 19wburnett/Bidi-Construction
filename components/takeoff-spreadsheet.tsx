'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Search, Download, FileSpreadsheet, FileText, Plus, Pencil, Trash2, Save, X, MapPin, DollarSign, Expand, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TakeoffItem, BoundingBox } from './takeoff-accordion'
import { exportToCSV, exportToExcel } from '@/lib/takeoff-export'
import { getAllTrades } from '@/lib/trade-types'
import { createClient } from '@/lib/supabase'

interface TakeoffSpreadsheetProps {
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

interface GroupedRow {
  type: 'category' | 'subcontractor' | 'item'
  id: string
  name: string
  data?: TakeoffItem
  total?: number
  quantity?: number
  expanded: boolean
  level: number
  children?: GroupedRow[]
  categoryKey?: string
  subcontractor?: string
}

const CATEGORY_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  structural: { color: 'text-orange-800', bgColor: 'bg-orange-100', label: 'Structural' },
  exterior: { color: 'text-green-800', bgColor: 'bg-green-100', label: 'Exterior' },
  interior: { color: 'text-purple-800', bgColor: 'bg-purple-100', label: 'Interior' },
  mep: { color: 'text-yellow-800', bgColor: 'bg-yellow-100', label: 'MEP' },
  finishes: { color: 'text-pink-800', bgColor: 'bg-pink-100', label: 'Finishes' },
  other: { color: 'text-gray-800', bgColor: 'bg-gray-100', label: 'Other' }
}

export default function TakeoffSpreadsheet({
  items,
  summary,
  onItemHighlight,
  onPageNavigate,
  editable = false,
  onItemsChange
}: TakeoffSpreadsheetProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedSubcontractors, setExpandedSubcontractors] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [newSubcontractorName, setNewSubcontractorName] = useState<string>('')
  const [showNewSubcontractorInput, setShowNewSubcontractorInput] = useState<string | null>(null)
  const [subcontractorSearchQuery, setSubcontractorSearchQuery] = useState<string>('')
  const [allTrades, setAllTrades] = useState<string[]>([])
  const tableRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLTableRowElement>>({})
  const subcontractorDropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load custom trades on mount
  useEffect(() => {
    async function loadTrades() {
      try {
        const trades = await getAllTrades(supabase)
        setAllTrades(trades)
      } catch (err) {
        console.error('Error loading trades:', err)
        // Fallback to empty array - will be populated when trades load
      }
    }
    loadTrades()
  }, [])

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

  // Calculate item cost
  const calculateItemCost = useCallback((item: TakeoffItem): number => {
    // If total_cost is explicitly set and is a valid number, use it
    if (item.total_cost !== undefined && item.total_cost !== null && !isNaN(item.total_cost)) {
      return item.total_cost
    }
    // Otherwise calculate from unit_cost * quantity
    if (item.unit_cost !== undefined && item.unit_cost !== null && 
        item.quantity !== undefined && item.quantity !== null &&
        !isNaN(item.unit_cost) && !isNaN(item.quantity)) {
      return item.unit_cost * item.quantity
    }
    return 0
  }, [])

  // Helper function to coalesce string values (try multiple field names)
  const coalesceString = (...values: any[]): string => {
    for (const val of values) {
      if (val !== null && val !== undefined && val !== '') {
        return String(val)
      }
    }
    return ''
  }

  // Helper function to parse quantity (handles old formats with qty, amount, etc.)
  const parseQuantity = (item: any): number => {
    const rawQuantity = item.quantity ?? item.qty ?? item.amount ?? item.count ?? 0
    if (typeof rawQuantity === 'number') {
      return isNaN(rawQuantity) ? 0 : rawQuantity
    }
    const parsed = parseFloat(String(rawQuantity))
    return isNaN(parsed) ? 0 : parsed
  }

  // Normalize items to ensure they have required fields and handle old formats
  const normalizedItems = useMemo(() => {
    // Handle various formats:
    // 1. Direct array: [{...}, {...}]
    // 2. Wrapped: { items: [...] } or { takeoffs: [...] }
    // 3. String JSON that needs parsing
    let sourceItems: any[] = []
    
    if (Array.isArray(items)) {
      // Direct array format (most common)
      sourceItems = items
    } else if (items && typeof items === 'object') {
      // Wrapped format
      const itemsObj = items as any
      if (Array.isArray(itemsObj.takeoffs)) {
        sourceItems = itemsObj.takeoffs
      } else if (Array.isArray(itemsObj.items)) {
        sourceItems = itemsObj.items
      } else if (Array.isArray(itemsObj.results?.items)) {
        // API response format: { results: { items: [...] } }
        sourceItems = itemsObj.results.items
      }
    } else if (typeof items === 'string') {
      // String JSON that needs parsing
      try {
        const parsed = JSON.parse(items)
        if (Array.isArray(parsed)) {
          sourceItems = parsed
        } else if (Array.isArray(parsed.items)) {
          sourceItems = parsed.items
        } else if (Array.isArray(parsed.takeoffs)) {
          sourceItems = parsed.takeoffs
        }
      } catch (e) {
        console.error('Failed to parse items string:', e)
        sourceItems = []
      }
    }

    return sourceItems.map((item: any) => {
      // Normalize name (try multiple field names)
      const name = coalesceString(
        item.name,
        item.item_name,
        item.title,
        item.label,
        item.description,
        item.item_description,
        'Unnamed Item'
      )

      // Normalize description
      const description = coalesceString(
        item.description,
        item.item_description,
        item.details,
        item.summary,
        item.notes,
        name
      )

      // Normalize category (handle old formats)
      const category = coalesceString(
        item.category,
        item.Category,
        item.trade_category,
        item.discipline,
        item.scope,
        item.segment,
        item.group,
        item.item_type, // Old format might use item_type
        'other'
      ).toLowerCase().trim()

      // Normalize subcategory
      const subcategory = coalesceString(
        item.subcategory,
        item.sub_category,
        item.Subcategory,
        item.scope_detail
      )

      // Normalize location
      const location = coalesceString(
        item.location,
        item.location_reference,
        item.location_ref,
        item.area,
        item.room,
        item.zone,
        item.sheet_reference,
        item.sheet,
        item.sheetTitle
      )

      // Parse quantity (handle old formats)
      const quantity = parseQuantity(item)

      // Normalize unit
      const unit = coalesceString(
        item.unit,
        item.unit_of_measure,
        item.uom,
        'unit'
      )

      // Parse costs
      let unitCost: number | undefined = undefined
      if (typeof item.unit_cost === 'number') {
        unitCost = isNaN(item.unit_cost) ? undefined : item.unit_cost
      } else if (item.unit_cost) {
        const parsed = parseFloat(String(item.unit_cost))
        unitCost = isNaN(parsed) ? undefined : parsed
      }
      
      // Calculate total_cost if not provided
      let totalCost: number | undefined = undefined
      if (typeof item.total_cost === 'number') {
        totalCost = isNaN(item.total_cost) ? undefined : item.total_cost
      } else if (item.total_cost) {
        const parsed = parseFloat(String(item.total_cost))
        totalCost = isNaN(parsed) ? undefined : parsed
      }
      
      // If total_cost is not set but we have unit_cost and quantity, calculate it
      if (totalCost === undefined && unitCost !== undefined && quantity !== undefined && quantity > 0) {
        totalCost = unitCost * quantity
      }

      // Normalize bounding box (handle old detection_coordinates format)
      let boundingBox: BoundingBox | undefined = undefined
      if (item.bounding_box) {
        boundingBox = {
          page: item.bounding_box.page || item.bounding_box.pageNumber || item.plan_page_number || 1,
          x: item.bounding_box.x || 0,
          y: item.bounding_box.y || 0,
          width: item.bounding_box.width || 0,
          height: item.bounding_box.height || 0
        }
      } else if (item.detection_coordinates) {
        boundingBox = {
          page: item.plan_page_number || item.page_number || item.pageNumber || item.page || 1,
          x: item.detection_coordinates.x || 0,
          y: item.detection_coordinates.y || 0,
          width: item.detection_coordinates.width || 0,
          height: item.detection_coordinates.height || 0
        }
      } else if (item.plan_page_number || item.page_number || item.pageNumber || item.page) {
        // If we have a page number but no coordinates, create a minimal bounding box
        boundingBox = {
          page: item.plan_page_number || item.page_number || item.pageNumber || item.page || 1,
          x: 0,
          y: 0,
          width: 0,
          height: 0
        }
      }

      // Ensure item has required fields and normalize structure
      return {
        id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        quantity,
        unit,
        unit_cost: unitCost,
        total_cost: totalCost,
        category,
        subcategory: subcategory || undefined,
        subcontractor: item.subcontractor || undefined,
        cost_code: item.cost_code || item.costCode || undefined,
        cost_code_description: item.cost_code_description || item.costCodeDescription || undefined,
        location: location || undefined,
        notes: item.notes || undefined,
        dimensions: item.dimensions || undefined,
        bounding_box: boundingBox,
        confidence: typeof item.confidence === 'number' ? item.confidence : (item.confidence_score || undefined),
        ai_provider: item.ai_provider || item.aiProvider || undefined,
        parent_id: item.parent_id || item.parentId || undefined,
        user_created: item.user_created || item.userCreated || false,
        user_modified: item.user_modified || item.userModified || false
      } as TakeoffItem
    })
  }, [items])

  // Build grouped row structure
  const groupedRows = useMemo(() => {
    const rows: GroupedRow[] = []
    const organized: Record<string, Record<string, TakeoffItem[]>> = {}

    // Organize items by category → subcontractor
    normalizedItems.forEach(item => {
      if (item.parent_id) return // Skip sub-items for now

      const category = (item.category || 'Other').toLowerCase().trim()
      const subcontractor = item.subcontractor || 'Unassigned'

      if (!organized[category]) {
        organized[category] = {}
      }
      if (!organized[category][subcontractor]) {
        organized[category][subcontractor] = []
      }
      organized[category][subcontractor].push(item)
    })

    // Build grouped rows
    Object.entries(organized).forEach(([categoryKey, subcontractors]) => {
      const categoryConfig = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG.other
      const categoryName = categoryConfig.label
      const categoryId = `category-${categoryKey}`
      const categoryExpanded = expandedCategories.has(categoryId)

      // Calculate category total
      let categoryTotal = 0
      const subcontractorRows: GroupedRow[] = []

      Object.entries(subcontractors).forEach(([subcontractor, subcontractorItems]) => {
        const subcontractorId = `${categoryId}-sub-${subcontractor}`
        const subcontractorExpanded = expandedSubcontractors.has(subcontractorId)

        // Calculate subcontractor total
        const subcontractorTotal = subcontractorItems.reduce((sum, item) => sum + calculateItemCost(item), 0)
        categoryTotal += subcontractorTotal

        // Filter items by search if needed
        const filteredItems = searchQuery
          ? subcontractorItems.filter(item =>
              item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.location?.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : subcontractorItems

        if (filteredItems.length === 0 && searchQuery) return

        // Create item rows
        const itemRows: GroupedRow[] = filteredItems.map(item => ({
          type: 'item',
          id: item.id || `item-${Math.random()}`,
          name: item.name,
          data: item,
          expanded: false,
          level: 2,
          categoryKey,
          subcontractor
        }))

        subcontractorRows.push({
          type: 'subcontractor',
          id: subcontractorId,
          name: subcontractor,
          total: subcontractorTotal,
          quantity: subcontractorItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
          expanded: subcontractorExpanded,
          level: 1,
          categoryKey,
          subcontractor,
          children: itemRows
        })
      })

      rows.push({
        type: 'category',
        id: categoryId,
        name: categoryName,
        total: categoryTotal,
        expanded: categoryExpanded,
        level: 0,
        categoryKey,
        children: subcontractorRows
      })
    })

    return rows
  }, [normalizedItems, expandedCategories, expandedSubcontractors, searchQuery, calculateItemCost])

  // Calculate overall total
  const overallTotal = useMemo(() => {
    return normalizedItems.reduce((sum, item) => sum + calculateItemCost(item), 0)
  }, [normalizedItems, calculateItemCost])

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  // Toggle subcontractor expansion
  const toggleSubcontractor = useCallback((subcontractorId: string) => {
    setExpandedSubcontractors(prev => {
      const next = new Set(prev)
      if (next.has(subcontractorId)) {
        next.delete(subcontractorId)
      } else {
        next.add(subcontractorId)
      }
      return next
    })
  }, [])

  // Expand/Collapse all
  const expandAll = useCallback(() => {
    const allCategories = new Set(groupedRows.map(row => row.id))
    const allSubcontractors = new Set<string>()
    groupedRows.forEach(cat => {
      cat.children?.forEach(sub => {
        if (sub.id) allSubcontractors.add(sub.id)
      })
    })
    setExpandedCategories(allCategories)
    setExpandedSubcontractors(allSubcontractors)
  }, [groupedRows])

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set())
    setExpandedSubcontractors(new Set())
  }, [])

  // Start editing a cell
  const startEdit = useCallback((rowId: string, field: string, currentValue: any) => {
    setEditingCell({ rowId, field })
    // For subcontractor field, use special value for unassigned instead of empty string
    if (field === 'subcontractor') {
      setEditValue(currentValue || '__unassigned__')
    } else if (field === 'quantity' || field === 'unit_cost') {
      // For numeric fields, show the number without formatting
      setEditValue(currentValue !== undefined && currentValue !== null ? String(currentValue) : '')
    } else {
      setEditValue(String(currentValue || ''))
    }
  }, [])

  // Save edit
  const saveEdit = useCallback(() => {
    if (!editingCell || !onItemsChange) return

    const item = normalizedItems.find(i => i.id === editingCell.rowId)
    if (!item) return

    const updated = { ...item, user_modified: true }

    if (editingCell.field === 'name') {
      updated.name = editValue.trim() || item.name
    } else if (editingCell.field === 'description') {
      const trimmed = editValue.trim()
      updated.description = trimmed || item.description || ''
    } else if (editingCell.field === 'quantity') {
      updated.quantity = parseFloat(editValue) || 0
      updated.total_cost = updated.quantity * (updated.unit_cost || 0)
    } else if (editingCell.field === 'unit') {
      updated.unit = editValue.trim() || 'unit'
    } else if (editingCell.field === 'unit_cost') {
      updated.unit_cost = parseFloat(editValue) || 0
      updated.total_cost = (updated.quantity || 0) * updated.unit_cost
    } else if (editingCell.field === 'subcontractor') {
      // Handle subcontractor type (convert __unassigned__ to undefined)
      updated.subcontractor = editValue === '__unassigned__' ? undefined : (editValue || undefined)
    } else if (editingCell.field === 'location') {
      updated.location = editValue.trim() || undefined
    }

    const updatedItems = normalizedItems.map(i => (i.id === editingCell.rowId ? updated : i))
    onItemsChange(updatedItems)
    setEditingCell(null)
    setEditValue('')
  }, [editingCell, editValue, normalizedItems, onItemsChange])

  // Cancel edit
  const cancelEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
    setSubcontractorSearchQuery('')
  }, [])

  // Close subcontractor dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        editingCell?.field === 'subcontractor' &&
        subcontractorDropdownRef.current &&
        !subcontractorDropdownRef.current.contains(event.target as Node)
      ) {
        // Check if click is not on the input itself
        const target = event.target as HTMLElement
        if (!target.closest('.subcontractor-dropdown-container')) {
          cancelEdit()
        }
      }
    }

    if (editingCell?.field === 'subcontractor') {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [editingCell, cancelEdit])

  // Delete item
  const deleteItem = useCallback((itemId: string) => {
    if (!onItemsChange) return
    const updatedItems = normalizedItems.filter(i => i.id !== itemId && i.parent_id !== itemId)
    onItemsChange(updatedItems)
  }, [normalizedItems, onItemsChange])

  // Add new subcontractor
  const addSubcontractor = useCallback((categoryKey: string, name: string) => {
    if (!name.trim() || !onItemsChange) return
    
    // Create a new item with this subcontractor
    const newItem: TakeoffItem = {
      id: crypto.randomUUID(),
      name: 'New Item',
      description: '',
      quantity: 1,
      unit: 'unit',
      category: categoryKey,
      subcontractor: name.trim(),
      user_created: true
    }
    
    onItemsChange([...normalizedItems, newItem])
    setNewSubcontractorName('')
    setShowNewSubcontractorInput(null)
    
    // Expand to show the new item
    const categoryId = `category-${categoryKey}`
    const subcontractorId = `${categoryId}-sub-${name.trim()}`
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.add(categoryId)
      return next
    })
    setExpandedSubcontractors(prev => {
      const next = new Set(prev)
      next.add(subcontractorId)
      return next
    })
  }, [normalizedItems, onItemsChange])

  // Get unique subcontractors for a category
  const getSubcontractorsForCategory = useCallback((categoryKey: string): string[] => {
    const categoryItems = normalizedItems.filter(item => 
      (item.category || 'Other').toLowerCase().trim() === categoryKey && !item.parent_id
    )
    const subcontractors = new Set<string>()
    categoryItems.forEach(item => {
      if (item.subcontractor) {
        subcontractors.add(item.subcontractor)
      }
    })
    return Array.from(subcontractors).sort()
  }, [normalizedItems])

  // Scroll to category
  const scrollToCategory = useCallback((categoryId: string) => {
    const row = categoryRefs.current[categoryId]
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'start' })
      toggleCategory(categoryId)
    }
  }, [toggleCategory])

  // Render row
  const renderRow = useCallback((row: GroupedRow) => {
    const config = row.categoryKey ? CATEGORY_CONFIG[row.categoryKey] : null

    if (row.type === 'category') {
      const isExpanded = expandedCategories.has(row.id)
      return (
        <React.Fragment key={row.id}>
          <tr
            ref={(el) => {
              if (el) categoryRefs.current[row.id] = el
            }}
            className={`${config?.bgColor || 'bg-gray-100'} border-b-2 border-gray-300 cursor-pointer hover:opacity-90`}
            onClick={() => toggleCategory(row.id)}
          >
            <td colSpan={11} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <span className="font-bold text-lg">{row.name}</span>
                  <Badge variant="outline" className="ml-2">
                    {row.children?.length || 0} subcontractors
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {row.children?.reduce((sum, sub) => sum + (sub.children?.length || 0), 0) || 0} items
                  </span>
                  <span className="font-bold text-lg">{formatCurrency(row.total)}</span>
                </div>
              </div>
            </td>
          </tr>
          {isExpanded && row.children?.map(child => renderRow(child))}
        </React.Fragment>
      )
    }

    if (row.type === 'subcontractor') {
      const categoryId = `category-${row.categoryKey}`
      if (!expandedCategories.has(categoryId)) {
        return null
      }

      const isExpanded = expandedSubcontractors.has(row.id)
      return (
        <React.Fragment key={row.id}>
          <tr
            className="bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
            onClick={() => toggleSubcontractor(row.id)}
          >
            <td className="p-2 pl-8">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </td>
            <td colSpan={2} className="p-2">
              <span className="font-semibold">{row.name}</span>
            </td>
            <td className="p-2"></td>
            <td className="p-2 text-right">{row.quantity?.toLocaleString()}</td>
            <td className="p-2"></td>
            <td className="p-2"></td>
            <td className="p-2 text-right font-semibold">{formatCurrency(row.total)}</td>
            <td className="p-2"></td>
            <td className="p-2"></td>
            <td className="p-2"></td>
          </tr>
          {isExpanded && row.children?.map(child => renderRow(child))}
        </React.Fragment>
      )
    }

    // Item row
    if (!row.categoryKey || !row.subcontractor) {
      return null
    }
    
    const categoryId = `category-${row.categoryKey}`
    // Construct subcontractorId to match the format used when creating subcontractor rows
    // Format: category-{categoryKey}-sub-{subcontractor}
    const subcontractorId = `${categoryId}-sub-${row.subcontractor}`
    
    // Only render if both category and subcontractor are expanded
    const categoryExpanded = expandedCategories.has(categoryId)
    const subcontractorExpanded = expandedSubcontractors.has(subcontractorId)
    
    if (!categoryExpanded || !subcontractorExpanded) {
      return null
    }

    const item = row.data!
    const isEditing = editingCell?.rowId === row.id
    const itemCost = calculateItemCost(item)

    return (
      <tr
        key={row.id}
        className="border-b border-gray-100 hover:bg-gray-50"
        onClick={(e) => {
          if (item.bounding_box && onItemHighlight) {
            e.stopPropagation()
            onItemHighlight(item.bounding_box)
          }
        }}
      >
        <td className="p-2 pl-12"></td>
        <td className="p-2">
          {isEditing && editingCell?.field === 'name' ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="h-8"
            />
          ) : (
            <div
              className={editable ? 'cursor-pointer hover:bg-gray-100 rounded px-1' : ''}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'name', item.name)
              }}
            >
              {item.name}
            </div>
          )}
        </td>
        <td className="p-2 text-sm text-gray-600">
          {isEditing && editingCell?.field === 'description' ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="h-8 text-sm"
              placeholder="Description..."
            />
          ) : (
            <div
              className={editable ? 'cursor-pointer hover:bg-gray-100 rounded px-1' : ''}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'description', item.description || '')
              }}
            >
              {item.description && item.name !== item.description ? item.description : <span className="text-gray-400">—</span>}
            </div>
          )}
        </td>
        <td className="p-2">
          {isEditing && editingCell?.field === 'subcontractor' ? (
            <div className="relative subcontractor-dropdown-container" ref={subcontractorDropdownRef}>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 z-10" />
                <Input
                  value={subcontractorSearchQuery}
                  onChange={(e) => setSubcontractorSearchQuery(e.target.value)}
                  onFocus={(e) => {
                    e.stopPropagation()
                    setSubcontractorSearchQuery('')
                  }}
                  placeholder="Search subcontractor types..."
                  className="h-8 w-48 pl-7 pr-8"
                  autoFocus
                />
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              <div 
                className="absolute z-50 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="px-3 py-2 text-xs text-gray-500 cursor-pointer hover:bg-gray-50 border-b"
                  onClick={(e) => {
                    e.stopPropagation()
                    const item = normalizedItems.find(i => i.id === row.id)
                    if (item && onItemsChange) {
                      const updated = { ...item, subcontractor: undefined, user_modified: true }
                      const updatedItems = normalizedItems.map(i => (i.id === row.id ? updated : i))
                      onItemsChange(updatedItems)
                    }
                    setEditingCell(null)
                    setEditValue('')
                    setSubcontractorSearchQuery('')
                  }}
                >
                  Unassigned
                </div>
                {allTrades
                  .filter(type => 
                    subcontractorSearchQuery === '' || 
                    type.toLowerCase().includes(subcontractorSearchQuery.toLowerCase())
                  )
                  .map(type => (
                    <div
                      key={type}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        const item = normalizedItems.find(i => i.id === row.id)
                        if (item && onItemsChange) {
                          const updated = { ...item, subcontractor: type, user_modified: true }
                          const updatedItems = normalizedItems.map(i => (i.id === row.id ? updated : i))
                          onItemsChange(updatedItems)
                        }
                        setEditingCell(null)
                        setEditValue('')
                        setSubcontractorSearchQuery('')
                      }}
                    >
                      {type}
                    </div>
                  ))}
                {allTrades.filter(type => 
                  subcontractorSearchQuery === '' || 
                  type.toLowerCase().includes(subcontractorSearchQuery.toLowerCase())
                ).length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400 text-center">
                    No matches found
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={editable ? 'cursor-pointer hover:bg-gray-100 rounded px-1' : ''}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'subcontractor', item.subcontractor || '')
              }}
            >
              {item.subcontractor || <span className="text-gray-400">Unassigned</span>}
            </div>
          )}
        </td>
        <td className="p-2 text-right">
          {isEditing && editingCell?.field === 'quantity' ? (
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="h-8 w-20 text-right"
            />
          ) : (
            <div
              className={editable ? 'cursor-pointer hover:bg-gray-100 rounded px-1 text-right' : 'text-right'}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'quantity', item.quantity)
              }}
            >
              {item.quantity.toLocaleString()}
            </div>
          )}
        </td>
        <td className="p-2 text-sm text-gray-600">
          {isEditing && editingCell?.field === 'unit' ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="h-8 w-16"
              placeholder="Unit"
            />
          ) : (
            <div
              className={editable ? 'cursor-pointer hover:bg-gray-100 rounded px-1' : ''}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'unit', item.unit || '')
              }}
            >
              {item.unit || <span className="text-gray-400">—</span>}
            </div>
          )}
        </td>
        <td className="p-2 text-right">
          {isEditing && editingCell?.field === 'unit_cost' ? (
            <Input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="h-8 w-24 text-right"
            />
          ) : (
            <div
              className={editable ? 'cursor-pointer hover:bg-gray-100 rounded px-1 text-right' : 'text-right'}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'unit_cost', item.unit_cost)
              }}
            >
              {item.unit_cost !== undefined ? formatCurrency(item.unit_cost) : '—'}
            </div>
          )}
        </td>
        <td className="p-2 text-right font-semibold">{formatCurrency(itemCost)}</td>
        <td className="p-2 text-sm text-gray-600">
          {isEditing && editingCell?.field === 'location' ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="h-8 text-sm"
              placeholder="Location..."
            />
          ) : (
            <div
              className={editable ? 'cursor-pointer hover:bg-gray-100 rounded px-1' : ''}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'location', item.location || '')
              }}
            >
              {item.location || <span className="text-gray-400">—</span>}
            </div>
          )}
        </td>
        <td className="p-2">
          {item.bounding_box && (
            <Badge
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-orange-50"
              onClick={(e) => {
                e.stopPropagation()
                onPageNavigate?.(item.bounding_box!.page)
              }}
            >
              <MapPin className="h-3 w-3 mr-1" />
              {item.bounding_box.page}
            </Badge>
          )}
        </td>
        <td className="p-2">
          {editable && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  startEdit(row.id, 'name', item.name)
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteItem(row.id)
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </td>
      </tr>
    )
  }, [
    expandedCategories,
    expandedSubcontractors,
    editingCell,
    editValue,
    editable,
    toggleCategory,
    toggleSubcontractor,
    startEdit,
    saveEdit,
    cancelEdit,
    deleteItem,
    calculateItemCost,
    onItemHighlight,
    onPageNavigate,
    formatCurrency
  ])

  // Get category list for navigation
  const categoryList = useMemo(() => {
    return groupedRows.map(row => ({
      id: row.id,
      name: row.name,
      total: row.total || 0,
      categoryKey: row.categoryKey || ''
    }))
  }, [groupedRows])

  return (
    <div className="space-y-4">
      {/* Header with totals and controls */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-50/50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-orange-600" />
            <h3 className="font-bold text-lg text-orange-900">Total Estimate</h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-900">{formatCurrency(overallTotal)}</div>
            <div className="text-xs text-orange-600">{normalizedItems.length} {normalizedItems.length === 1 ? 'item' : 'items'}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={expandAll}>
            <Expand className="h-4 w-4 mr-1" /> Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <Minimize2 className="h-4 w-4 mr-1" /> Collapse All
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(normalizedItems)}>
            <FileText className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToExcel(normalizedItems)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* Category Navigation Sidebar */}
      {categoryList.length > 0 && (
        <div className="bg-white border rounded-lg p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">Quick Navigation:</span>
            {categoryList.map(cat => {
              const config = cat.categoryKey ? CATEGORY_CONFIG[cat.categoryKey] : null
              return (
                <Button
                  key={cat.id}
                  variant="outline"
                  size="sm"
                  onClick={() => scrollToCategory(cat.id)}
                  className={`text-xs ${config?.color || 'text-gray-800'} ${config?.bgColor || 'bg-gray-100'} hover:opacity-80`}
                >
                  {cat.name} ({formatCurrency(cat.total)})
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div ref={tableRef} className="border rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
              <tr>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 w-8"></th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600">Item Name</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600">Subcontractor</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-600">Quantity</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600">Unit</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-600">Unit Cost</th>
                <th className="p-3 text-right text-xs font-semibold text-gray-600">Total Cost</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600">Location</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600">Page</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(row => (
                <React.Fragment key={row.id}>
                  {renderRow(row)}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {groupedRows.length === 0 && (
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

