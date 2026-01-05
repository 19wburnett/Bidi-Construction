'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Search, Download, FileSpreadsheet, FileText, Plus, Pencil, Trash2, Save, X, MapPin, DollarSign, Expand, Minimize2, FolderInput, AlertTriangle, Lightbulb, Ruler } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TakeoffItem, TakeoffItemAssumption, BoundingBox } from './takeoff-accordion'
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
    scope_first_message?: string
  }
  measurementGuidance?: {
    message: string
    next_step: string
    items_needing_measurement: number
  }
  onItemHighlight?: (bbox: BoundingBox) => void
  onPageNavigate?: (page: number) => void
  onOpenChatTab?: () => void
  editable?: boolean
  onItemsChange?: (items: TakeoffItem[]) => void
  missingInformation?: Array<{
    item_id?: string
    item_name: string
    category: string
    missing_data: string
    why_needed: string
    where_to_find: string
    impact: 'critical' | 'high' | 'medium' | 'low'
  }>
  scopeFirst?: boolean
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
  measurementGuidance,
  onItemHighlight,
  onPageNavigate,
  onOpenChatTab,
  editable = false,
  onItemsChange,
  missingInformation = [],
  scopeFirst = false
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
  const [showAddItemMenu, setShowAddItemMenu] = useState(false)
  const addItemMenuRef = useRef<HTMLDivElement>(null)
  const [movingItemId, setMovingItemId] = useState<string | null>(null)
  const [expandedAssumptions, setExpandedAssumptions] = useState<Set<string>>(new Set())
  const [columnVisibility, setColumnVisibility] = useState({
    costCode: true,
    description: true,
    location: true,
    page: true
  })
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

      // Normalize cost_type
      const costType = item.cost_type && ['labor', 'materials', 'allowance', 'other'].includes(item.cost_type.toLowerCase())
        ? item.cost_type.toLowerCase() as 'labor' | 'materials' | 'allowance' | 'other'
        : undefined

      // Ensure item has required fields and normalize structure
      return {
        id: item.id || `item-${Math.random().toString(36).slice(2, 11)}`,
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
        cost_type: costType,
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

  // Toggle assumptions expansion for an item
  const toggleAssumptions = useCallback((itemId: string) => {
    setExpandedAssumptions(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
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
    } else if (field === 'cost_type') {
      setEditValue(currentValue || '__none__')
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
    } else if (editingCell.field === 'cost_code') {
      updated.cost_code = editValue.trim() || undefined
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
    } else if (editingCell.field === 'cost_type') {
      const costType = editValue && ['labor', 'materials', 'allowance', 'other'].includes(editValue.toLowerCase())
        ? editValue.toLowerCase() as 'labor' | 'materials' | 'allowance' | 'other'
        : undefined
      updated.cost_type = costType
    } else if (editingCell.field === 'page') {
      const pageNum = parseInt(editValue, 10)
      if (!isNaN(pageNum) && pageNum > 0) {
        // Update or create bounding_box with the new page number
        updated.bounding_box = {
          ...(item.bounding_box || { x: 0, y: 0, width: 0, height: 0 }),
          page: pageNum
        }
      } else if (!editValue.trim()) {
        // Clear the bounding box if page is cleared
        updated.bounding_box = undefined
      }
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

  // Close add item menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showAddItemMenu &&
        addItemMenuRef.current &&
        !addItemMenuRef.current.contains(event.target as Node)
      ) {
        setShowAddItemMenu(false)
      }
    }

    if (showAddItemMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showAddItemMenu])

  // Close move item menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (movingItemId) {
        setMovingItemId(null)
      }
    }

    if (movingItemId) {
      // Delay to prevent immediate close on the same click
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [movingItemId])

  // Add new item
  const addItem = useCallback((categoryKey?: string, subcontractor?: string) => {
    if (!onItemsChange) return
    
    // Use provided category/subcontractor or defaults
    const targetCategory = categoryKey || 'other'
    const targetSubcontractor = subcontractor || undefined
    
    // Create a new item with sensible defaults
    const newItem: TakeoffItem = {
      id: crypto.randomUUID(),
      name: 'New Item',
      description: '',
      quantity: 1,
      unit: 'unit',
      unit_cost: 0,
      total_cost: 0,
      category: targetCategory,
      subcontractor: targetSubcontractor,
      cost_type: undefined,
      user_created: true
    }
    
    const updatedItems = [...normalizedItems, newItem]
    onItemsChange(updatedItems)
    
    // Expand the target category and subcontractor to show the new item
    const categoryId = `category-${targetCategory}`
    const subcontractorId = `${categoryId}-sub-${targetSubcontractor || 'Unassigned'}`
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
    
    // Scroll to the new item after a brief delay to allow rendering
    setTimeout(() => {
      const row = categoryRefs.current[categoryId]
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }, [normalizedItems, onItemsChange])

  // Delete item
  const deleteItem = useCallback((itemId: string) => {
    if (!onItemsChange) return
    const updatedItems = normalizedItems.filter(i => i.id !== itemId && i.parent_id !== itemId)
    onItemsChange(updatedItems)
  }, [normalizedItems, onItemsChange])

  // Move item to different category
  const moveItemToCategory = useCallback((itemId: string, newCategory: string) => {
    if (!onItemsChange) return
    const item = normalizedItems.find(i => i.id === itemId)
    if (!item) return
    
    const updated = { ...item, category: newCategory, user_modified: true }
    const updatedItems = normalizedItems.map(i => (i.id === itemId ? updated : i))
    onItemsChange(updatedItems)
    setMovingItemId(null)
    
    // Expand the target category to show where the item moved
    const categoryId = `category-${newCategory}`
    const subcontractorId = `${categoryId}-sub-${item.subcontractor || 'Unassigned'}`
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
      cost_type: undefined,
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
            className={`group cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200`}
            onClick={() => toggleCategory(row.id)}
          >
            <td colSpan={13} className="p-0">
              <div className={`flex items-center justify-between py-3 px-4 ${config?.bgColor || 'bg-gray-50'} border-l-4 ${config?.color?.replace('text-', 'border-') || 'border-gray-400'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded-md hover:bg-black/5 transition-colors`}>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                  <span className={`font-bold text-sm uppercase tracking-wide ${config?.color || 'text-gray-800'}`}>{row.name}</span>
                  <Badge variant="secondary" className="ml-2 bg-white/50 text-xs font-normal border-gray-200 text-gray-600">
                    {row.children?.length || 0} Subs
                  </Badge>
                  <Badge variant="secondary" className="ml-1 bg-white/50 text-xs font-normal border-gray-200 text-gray-600">
                    {row.children?.reduce((sum, sub) => sum + (sub.children?.length || 0), 0) || 0} Items
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-900">{formatCurrency(row.total)}</span>
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
            className="bg-gray-50/50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors group"
            onClick={() => toggleSubcontractor(row.id)}
          >
            <td className="py-2 px-4 pl-8 border-l border-gray-100">
               <div className={`p-1 rounded-md w-fit hover:bg-black/5 transition-colors`}>
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-gray-400" />
                )}
              </div>
            </td>
            <td colSpan={4} className="py-2 px-4">
              <span className="font-medium text-gray-700 text-sm flex items-center gap-2">
                {row.name}
                <span className="text-xs text-gray-400 font-normal">({row.quantity?.toLocaleString()} items)</span>
              </span>
            </td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4 text-right font-medium text-gray-700 text-sm">{formatCurrency(row.total)}</td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4">
              {editable && (
                <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-gray-400 hover:text-orange-600"
                    onClick={(e) => {
                      e.stopPropagation()
                      const subcontractorName = row.subcontractor === 'Unassigned' ? undefined : row.subcontractor
                      addItem(row.categoryKey, subcontractorName)
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </td>
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
    const subcontractorId = `${categoryId}-sub-${row.subcontractor}`
    
    const categoryExpanded = expandedCategories.has(categoryId)
    const subcontractorExpanded = expandedSubcontractors.has(subcontractorId)
    
    if (!categoryExpanded || !subcontractorExpanded) {
      return null
    }

    const item = row.data!
    const isEditing = editingCell?.rowId === row.id
    const itemCost = calculateItemCost(item)
    
    // Find missing information for this item
    const itemMissingInfo = missingInformation.filter(mi => 
      mi.item_id === item.id || mi.item_name === item.name || mi.item_name === item.description
    )
    const hasMissingInfo = itemMissingInfo.length > 0
    const criticalMissing = itemMissingInfo.some(mi => mi.impact === 'critical')
    const highMissing = itemMissingInfo.some(mi => mi.impact === 'high')
    
    // Get missing info tooltip text
    const missingInfoTooltip = itemMissingInfo.length > 0
      ? itemMissingInfo.map(mi => `${mi.missing_data} (${mi.impact} impact)`).join(', ')
      : ''

    // Check for assumptions
    const hasAssumptions = item.assumptions && item.assumptions.length > 0
    const assumptionsExpanded = expandedAssumptions.has(row.id)
    const needsMeasurement = item.needs_measurement === true || item.quantity === 0

    // Get assumption type colors
    const getAssumptionTypeColor = (type: string) => {
      switch (type) {
        case 'material': return 'bg-blue-100 text-blue-700 border-blue-200'
        case 'pricing': return 'bg-green-100 text-green-700 border-green-200'
        case 'method': return 'bg-purple-100 text-purple-700 border-purple-200'
        case 'code': return 'bg-amber-100 text-amber-700 border-amber-200'
        default: return 'bg-gray-100 text-gray-700 border-gray-200'
      }
    }

    return (
      <tr
        key={row.id}
        className="group border-b border-gray-50 hover:bg-orange-50/30 transition-colors bg-white"
        onClick={(e) => {
          if (item.bounding_box && onItemHighlight) {
            e.stopPropagation()
            onItemHighlight(item.bounding_box)
          }
        }}
      >
        <td className="py-2 px-4 border-l border-gray-100 relative">
            {item.bounding_box && (
              <div className="absolute inset-y-0 left-0 w-1 bg-orange-200 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
            {hasMissingInfo && (
              <div 
                className="absolute top-2 left-2"
                title={missingInfoTooltip}
              >
                <AlertTriangle 
                  className={`h-4 w-4 ${
                    criticalMissing 
                      ? 'text-red-600' 
                      : highMissing 
                      ? 'text-orange-600' 
                      : 'text-yellow-600'
                  }`} 
                />
              </div>
            )}
        </td>
        <td className="py-2 px-4 text-sm">
          {/* Info badges row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Needs Measurement indicator */}
            {needsMeasurement && (
              <Badge 
                variant="outline" 
                className="text-[10px] h-5 px-1.5 bg-blue-50 border-blue-200 text-blue-700 cursor-help"
                title={item.measurement_instructions || 'Quantity needs to be measured from plans'}
              >
                <Ruler className="h-3 w-3 mr-0.5" />
                Needs Qty
              </Badge>
            )}
            {/* Assumptions indicator */}
            {hasAssumptions && (
              <Badge 
                variant="outline" 
                className="text-[10px] h-5 px-1.5 bg-amber-50 border-amber-200 text-amber-700 cursor-pointer hover:bg-amber-100 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleAssumptions(row.id)
                }}
                title="Click to view assumptions"
              >
                <Lightbulb className="h-3 w-3 mr-0.5" />
                {item.assumptions!.length} Assumption{item.assumptions!.length > 1 ? 's' : ''}
                <ChevronDown className={`h-3 w-3 ml-0.5 transition-transform ${assumptionsExpanded ? 'rotate-180' : ''}`} />
              </Badge>
            )}
            {/* Missing info indicator */}
            {hasMissingInfo && (
              <Badge 
                variant="outline" 
                className={`text-[10px] h-5 px-1.5 ${
                  criticalMissing 
                    ? 'bg-red-50 border-red-200 text-red-700' 
                    : highMissing 
                    ? 'bg-orange-50 border-orange-200 text-orange-700' 
                    : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                }`}
                title={missingInfoTooltip}
              >
                <AlertTriangle className="h-3 w-3 mr-0.5" />
                {itemMissingInfo.length} Missing
              </Badge>
            )}
          </div>
          {/* Expanded assumptions panel */}
          {hasAssumptions && assumptionsExpanded && (
            <div className="mt-2 mb-2 p-2 bg-amber-50/50 border border-amber-100 rounded-md text-xs space-y-1.5">
              <div className="font-medium text-amber-800 mb-1.5 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                AI Assumptions
              </div>
              {item.assumptions!.map((assumption, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${getAssumptionTypeColor(assumption.type)}`}>
                    {assumption.type}
                  </Badge>
                  <div className="flex-1">
                    <span className="text-gray-700">{assumption.assumption}</span>
                    {assumption.basis && (
                      <span className="text-gray-500 ml-1">— {assumption.basis}</span>
                    )}
                  </div>
                </div>
              ))}
              {/* Measurement guidance section */}
              {(item.measurement_instructions || item.quantity === 0) && (
                <div className="mt-2 pt-2 border-t border-amber-200 bg-blue-50/50 -mx-2 px-2 py-2 rounded-b-md">
                  <div className="font-medium text-blue-700 flex items-center gap-1 mb-1.5">
                    <Ruler className="h-3 w-3" />
                    How to Measure This Item
                  </div>
                  {item.measurement_instructions ? (
                    <p className="text-gray-700 mb-2">{item.measurement_instructions}</p>
                  ) : (
                    <p className="text-gray-600 mb-2 italic">
                      {item.unit === 'LF' && 'Measure the total linear feet from your plans using the scale provided.'}
                      {item.unit === 'SF' && 'Calculate the square footage by multiplying length × width from your plans.'}
                      {item.unit === 'EA' && 'Count the total number of this item shown in your plans.'}
                      {item.unit === 'CY' && 'Calculate volume in cubic yards (length × width × depth ÷ 27).'}
                      {item.unit === 'SQ' && 'Calculate roofing squares (total SF ÷ 100).'}
                      {!['LF', 'SF', 'EA', 'CY', 'SQ'].includes(item.unit) && 'Measure according to the unit specified and enter below.'}
                    </p>
                  )}
                  {item.quantity === 0 && editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200 h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEdit(row.id, 'quantity', item.quantity)
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Enter Measurement
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Item name */}
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
              className="h-8 text-sm"
            />
          ) : (
            <div
              className={`font-medium text-gray-900 ${editable ? 'cursor-text hover:text-orange-600' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'name', item.name)
              }}
            >
              {item.name}
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-sm">
            {isEditing && editingCell?.field === 'cost_code' ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="h-8 text-sm font-mono"
              placeholder="Code"
            />
          ) : (
            <div
              className={`text-gray-500 font-mono text-xs ${editable ? 'cursor-text hover:text-orange-600' : ''} ${!item.cost_code ? 'opacity-50 italic' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'cost_code', item.cost_code || '')
              }}
            >
              {item.cost_code || 'Add code'}
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-sm text-gray-600">
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
              className={`truncate max-w-[300px] ${editable ? 'cursor-text hover:text-orange-600' : ''}`}
              title={item.description}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'description', item.description || '')
              }}
            >
              {item.description && item.name !== item.description ? item.description : <span className="text-gray-300">—</span>}
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-sm">
          {isEditing && editingCell?.field === 'subcontractor' ? (
            <div className="relative subcontractor-dropdown-container" ref={subcontractorDropdownRef}>
              {/* Existing dropdown logic - simplified for brevity but keeping functional */}
              <div className="relative">
                <Input
                  value={subcontractorSearchQuery}
                  onChange={(e) => setSubcontractorSearchQuery(e.target.value)}
                  placeholder="Type..."
                  className="h-8 w-full text-xs"
                  autoFocus
                />
              </div>
               <div 
                className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
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
                      className="px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0"
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
              </div>
            </div>
          ) : (
            <div
              className={`text-gray-600 ${editable ? 'cursor-pointer hover:text-orange-600' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'subcontractor', item.subcontractor || '')
              }}
            >
              <Badge variant="outline" className="font-normal text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200">
                {item.subcontractor || 'Unassigned'}
              </Badge>
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-sm">
          {isEditing && editingCell?.field === 'cost_type' ? (
            <Select
              value={editValue || '__none__'}
              onValueChange={(value) => {
                setEditValue(value)
                const item = normalizedItems.find(i => i.id === row.id)
                if (item && onItemsChange) {
                  const costType = value && value !== '__none__' && ['labor', 'materials', 'allowance', 'other'].includes(value.toLowerCase())
                    ? value.toLowerCase() as 'labor' | 'materials' | 'allowance' | 'other'
                    : undefined
                  const updated = { ...item, cost_type: costType, user_modified: true }
                  const updatedItems = normalizedItems.map(i => (i.id === row.id ? updated : i))
                  onItemsChange(updatedItems)
                  setEditingCell(null)
                  setEditValue('')
                }
              }}
            >
              <SelectTrigger className="h-8 w-full text-sm" onClick={(e) => e.stopPropagation()}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent onClick={(e) => e.stopPropagation()}>
                <SelectItem value="__none__">None</SelectItem>
                <SelectItem value="labor">Labor</SelectItem>
                <SelectItem value="materials">Materials</SelectItem>
                <SelectItem value="allowance">Allowance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div
              className={`${editable ? 'cursor-pointer hover:text-orange-600' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'cost_type', item.cost_type || '')
              }}
            >
              {item.cost_type ? (
                <Badge 
                  variant="outline" 
                  className={`font-normal text-xs ${
                    item.cost_type === 'labor' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    item.cost_type === 'materials' ? 'bg-green-50 text-green-700 border-green-200' :
                    item.cost_type === 'allowance' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {item.cost_type.charAt(0).toUpperCase() + item.cost_type.slice(1)}
                </Badge>
              ) : (
                <span className="text-gray-400 text-xs italic">Add type</span>
              )}
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-right text-sm">
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
              className="h-8 w-20 text-right text-sm"
            />
          ) : (
            <div
              className={`font-mono ${
                item.quantity === 0 && editable
                  ? 'cursor-pointer'
                  : editable 
                  ? 'cursor-text hover:text-orange-600 text-gray-700' 
                  : 'text-gray-700'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'quantity', item.quantity)
              }}
            >
              {item.quantity === 0 && editable ? (
                <Badge 
                  variant="outline" 
                  className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 cursor-pointer animate-pulse"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Enter Qty
                </Badge>
              ) : (
                item.quantity.toLocaleString()
              )}
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-sm text-gray-500">
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
              className="h-8 w-16 text-sm"
            />
          ) : (
            <div
              className={editable ? 'cursor-text hover:text-orange-600' : ''}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'unit', item.unit || '')
              }}
            >
              {item.unit || '—'}
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-right text-sm">
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
              className="h-8 w-24 text-right text-sm"
            />
          ) : (
            <div
              className={`font-mono text-gray-600 ${editable ? 'cursor-text hover:text-orange-600' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'unit_cost', item.unit_cost)
              }}
            >
              {item.unit_cost !== undefined ? formatCurrency(item.unit_cost) : '—'}
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-right font-medium text-gray-900 text-sm font-mono">{formatCurrency(itemCost)}</td>
        <td className="py-2 px-4 text-sm text-gray-500">
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
            />
          ) : (
            <div
              className={`truncate max-w-[150px] ${editable ? 'cursor-text hover:text-orange-600' : ''}`}
              title={item.location}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) startEdit(row.id, 'location', item.location || '')
              }}
            >
              {item.location || '—'}
            </div>
          )}
        </td>
        <td className="py-2 px-4 text-center">
          {isEditing && editingCell?.field === 'page' ? (
            <Input
              type="number"
              min="1"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              autoFocus
              className="h-7 w-16 text-center text-sm mx-auto"
              onClick={(e) => e.stopPropagation()}
            />
          ) : item.bounding_box?.page ? (
            <Badge
              variant="outline"
              className={`text-[10px] h-5 px-1.5 bg-gray-50 hover:bg-orange-50 cursor-pointer transition-colors border-gray-200 ${editable ? 'hover:border-orange-300' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                if (editable) {
                  startEdit(row.id, 'page', item.bounding_box?.page || '')
                } else {
                  onPageNavigate?.(item.bounding_box!.page)
                }
              }}
            >
              <MapPin className="h-3 w-3 mr-1 text-orange-500" />
              {item.bounding_box.page}
            </Badge>
          ) : editable ? (
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5 bg-gray-50 hover:bg-orange-50 cursor-pointer transition-colors border-gray-200 hover:border-orange-300 text-gray-400"
              onClick={(e) => {
                e.stopPropagation()
                startEdit(row.id, 'page', '')
              }}
            >
              <Plus className="h-3 w-3 mr-0.5" />
              Page
            </Badge>
          ) : null}
        </td>
        <td className="py-2 px-4">
          <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {editable && (
              <>
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-gray-400 hover:text-blue-600"
                    title="Move to category"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMovingItemId(movingItemId === row.id ? null : row.id)
                    }}
                  >
                    <FolderInput className="h-3 w-3" />
                  </Button>
                  {movingItemId === row.id && (
                    <div 
                      className="absolute z-50 right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-1">
                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Move to Category
                        </div>
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                          <button
                            key={key}
                            disabled={key === row.categoryKey}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                              key === row.categoryKey 
                                ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => moveItemToCategory(row.id, key)}
                          >
                            <div className={`w-2 h-2 rounded-full ${config.bgColor} ${config.color.replace('text-', 'border-')} border-2`} />
                            <span className={key === row.categoryKey ? 'text-gray-400' : config.color}>
                              {config.label}
                              {key === row.categoryKey && ' (current)'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                 <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-gray-400 hover:text-gray-700"
                   onClick={(e) => {
                    e.stopPropagation()
                    startEdit(row.id, 'name', item.name)
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-gray-400 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteItem(row.id)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
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
    addItem,
    calculateItemCost,
    onItemHighlight,
    onPageNavigate,
    formatCurrency,
    normalizedItems,
    onItemsChange,
    subcontractorSearchQuery,
    allTrades,
    movingItemId,
    moveItemToCategory,
    toggleAssumptions,
    expandedAssumptions,
    missingInformation
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

  // Calculate items needing measurement
  const itemsNeedingMeasurement = useMemo(() => {
    return normalizedItems.filter(item => item.needs_measurement || item.quantity === 0).length
  }, [normalizedItems])

  return (
    <div className="space-y-4">
      {/* Scope-First Guidance Banner */}
      {(scopeFirst || itemsNeedingMeasurement > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Ruler className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">
                {measurementGuidance?.message || 'Scope Defined - Ready for Measurements'}
              </h3>
              <p className="text-sm text-blue-700 mb-2">
                {measurementGuidance?.next_step || 
                  `AI has identified ${itemsNeedingMeasurement} items from your plans. Now you need to measure quantities.`
                }
              </p>
              
              {/* Step-by-step workflow */}
              <div className="bg-white/60 rounded-md p-3 mb-3 border border-blue-100">
                <div className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide">How to Complete Your Takeoff:</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</div>
                    <div>
                      <div className="font-medium text-blue-900">Find the Item</div>
                      <div className="text-blue-600">Click the page badge to jump to that location in your plans</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</div>
                    <div>
                      <div className="font-medium text-blue-900">Measure It</div>
                      <div className="text-blue-600">Use the plan's scale to measure lengths, areas, or count items</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</div>
                    <div>
                      <div className="font-medium text-blue-900">Enter Quantity</div>
                      <div className="text-blue-600">Click the quantity cell in the table below to enter your measurement</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="bg-blue-100 border-blue-300 text-blue-700">
                  {itemsNeedingMeasurement} items need quantities
                </Badge>
                {onOpenChatTab && (
                  <Button 
                    size="sm" 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={onOpenChatTab}
                  >
                    <Lightbulb className="h-4 w-4 mr-1" />
                    Get AI Help Measuring
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                <span className="text-xs text-blue-600">
                  Tip: The Chat tab can guide you step-by-step through measuring each item
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
          {editable && (
            <div className="relative" ref={addItemMenuRef}>
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setShowAddItemMenu(!showAddItemMenu)} 
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Item
                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showAddItemMenu ? 'rotate-180' : ''}`} />
              </Button>
              {showAddItemMenu && (
                <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Select Category
                    </div>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors`}
                        onClick={() => {
                          addItem(key)
                          setShowAddItemMenu(false)
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full ${config.bgColor} ${config.color.replace('text-', 'border-')} border-2`} />
                        <span className={config.color}>{config.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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

      {/* Table */}
      <div ref={tableRef} className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto overscroll-x-contain -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full border-collapse min-w-[1000px] sm:min-w-0">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8" title="Missing information indicator"></th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Item Name</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Cost Code</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Description</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[150px]">Subcontractor</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Cost Type</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Quantity</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Unit</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Unit Cost</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Total Cost</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Location</th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Page</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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

