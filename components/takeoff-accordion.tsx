'use client'

import { useState, useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, ChevronDown, MapPin, Ruler } from 'lucide-react'

export interface BoundingBox {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface TakeoffItem {
  name: string
  description: string
  quantity: number
  unit: string
  category: string
  subcategory?: string
  cost_code?: string
  cost_code_description?: string
  location?: string
  notes?: string
  dimensions?: string
  bounding_box?: BoundingBox
  ai_provider?: string
  confidence?: number
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
}

// Category configuration for styling
const CATEGORY_CONFIG = {
  structural: { color: 'bg-blue-100 text-blue-800', label: 'Structural', icon: '🏗️' },
  exterior: { color: 'bg-green-100 text-green-800', label: 'Exterior', icon: '🏠' },
  interior: { color: 'bg-purple-100 text-purple-800', label: 'Interior', icon: '🛋️' },
  mep: { color: 'bg-yellow-100 text-yellow-800', label: 'MEP', icon: '⚡' },
  finishes: { color: 'bg-pink-100 text-pink-800', label: 'Finishes', icon: '🎨' },
  other: { color: 'bg-gray-100 text-gray-800', label: 'Other', icon: '📦' }
}

export default function TakeoffAccordion({ items, summary, onItemHighlight }: TakeoffAccordionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [openCategories, setOpenCategories] = useState<string[]>([])
  const [openSubcategories, setOpenSubcategories] = useState<string[]>([])

  // Organize items into 3-level hierarchy
  const hierarchy = useMemo(() => {
    const organized: Record<string, Record<string, TakeoffItem[]>> = {}
    
    items.forEach(item => {
      const category = item.category?.toLowerCase() || 'other'
      const subcategory = item.subcategory || 'Uncategorized'
      
      if (!organized[category]) {
        organized[category] = {}
      }
      
      if (!organized[category][subcategory]) {
        organized[category][subcategory] = []
      }
      
      organized[category][subcategory].push(item)
    })
    
    return organized
  }, [items])

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

  // Calculate totals for each level
  const categoryTotals = useMemo(() => {
    const totals: Record<string, { items: number; quantity: number }> = {}
    
    Object.entries(hierarchy).forEach(([category, subcategories]) => {
      let itemCount = 0
      let quantitySum = 0
      
      Object.values(subcategories).forEach(subcatItems => {
        itemCount += subcatItems.length
        subcatItems.forEach(item => {
          quantitySum += item.quantity || 0
        })
      })
      
      totals[category] = { items: itemCount, quantity: quantitySum }
    })
    
    return totals
  }, [hierarchy])

  const subcategoryTotals = useMemo(() => {
    const totals: Record<string, { items: number; quantity: number }> = {}
    
    Object.values(hierarchy).forEach(subcategories => {
      Object.entries(subcategories).forEach(([subcategory, subcatItems]) => {
        let quantitySum = 0
        subcatItems.forEach(item => {
          quantitySum += item.quantity || 0
        })
        
        totals[subcategory] = {
          items: subcatItems.length,
          quantity: quantitySum
        }
      })
    })
    
    return totals
  }, [hierarchy])

  return (
    <div className="space-y-4">
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

      {/* Level 1: Main Categories */}
      <Accordion type="multiple" className="space-y-2">
        {Object.entries(filteredHierarchy).map(([category, subcategories]) => {
          const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other
          const totals = categoryTotals[category]
          
          return (
            <AccordionItem key={category} value={category} className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-50">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div className="text-left">
                      <h3 className="font-bold text-lg capitalize">{config.label}</h3>
                      <p className="text-xs text-gray-500">
                        {totals.items} items
                      </p>
                    </div>
                  </div>
                  <Badge className={config.color}>
                    {totals.items} items
                  </Badge>
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
                              <h4 className="font-semibold text-sm">{subcategory}</h4>
                              <p className="text-xs text-gray-500">
                                {subcatTotals.items} items
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {subcatTotals.items}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        
                        <AccordionContent className="px-2 pb-2">
                          {/* Level 3: Line Items */}
                          <div className="space-y-2 ml-4">
                            {subcatItems.map((item, index) => (
                              <Card
                                key={`${category}-${subcategory}-${index}`}
                                className={`hover:shadow-md transition-all ${
                                  item.bounding_box ? 'cursor-pointer hover:border-blue-500' : ''
                                }`}
                                onClick={() => item.bounding_box && onItemHighlight?.(item.bounding_box)}
                              >
                                <CardContent className="p-3">
                                  <div className="space-y-2">
                                    {/* Item Header */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h5 className="font-medium text-sm leading-tight">
                                            {item.name}
                                          </h5>
                                          {item.bounding_box && (
                                            <Badge variant="outline" className="text-xs">
                                              <MapPin className="h-3 w-3 mr-1" />
                                              Page {item.bounding_box.page}
                                            </Badge>
                                          )}
                                        </div>
                                        {item.description && item.name !== item.description && (
                                          <p className="text-xs text-gray-600 mt-1">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>
                                      <Badge variant="secondary" className="text-xs shrink-0">
                                        {item.quantity} {item.unit}
                                      </Badge>
                                    </div>

                                    {/* Cost Code */}
                                    {item.cost_code && (
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs font-mono">
                                          {item.cost_code}
                                        </Badge>
                                        {item.cost_code_description && (
                                          <span className="text-xs text-gray-500">
                                            {item.cost_code_description}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Metadata */}
                                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                      {item.dimensions && (
                                        <div className="flex items-center gap-1">
                                          <Ruler className="h-3 w-3" />
                                          <span>{item.dimensions}</span>
                                        </div>
                                      )}
                                      {item.location && (
                                        <div className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          <span>{item.location}</span>
                                        </div>
                                      )}
                                      {item.ai_provider && (
                                        <div className="flex items-center gap-1">
                                          <Badge variant="outline" className="text-xs">
                                            {item.ai_provider}
                                          </Badge>
                                        </div>
                                      )}
                                    </div>

                                    {/* Notes */}
                                    {item.notes && (
                                      <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 italic">
                                        💡 {item.notes}
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
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


