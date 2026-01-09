'use client'

import React, { useState, useMemo } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  ChevronDown, 
  MapPin, 
  Ruler, 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Info,
  TrendingUp,
  Users,
  Target,
  Building2,
  Home,
  Layers,
  Zap,
  Paintbrush,
  Package
} from 'lucide-react'

export interface BoundingBox {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface EnhancedTakeoffItem {
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
  consensus_count?: number
}

export interface ConsensusMetadata {
  confidence: number
  consensusCount: number
  disagreements: Array<{
    type: string
    description: string
    models: string[]
    values: Record<string, any>
    recommendation: string
  }>
  modelAgreements: Array<{
    model: string
    specialization: string
    itemsFound: number
    confidence: number
    strengths: string[]
    weaknesses: string[]
  }>
}

export interface SpecializedInsight {
  type: 'code_compliance' | 'cost_optimization' | 'quality_improvement' | 'safety_concern'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  recommendation: string
  models: string[]
}

interface EnhancedTakeoffAccordionProps {
  items: EnhancedTakeoffItem[]
  summary?: {
    total_items?: number
    categories?: Record<string, number>
    subcategories?: Record<string, number>
    total_area_sf?: number
    plan_scale?: string
    confidence?: string
    notes?: string
  }
  consensus?: ConsensusMetadata
  specializedInsights?: SpecializedInsight[]
  recommendations?: string[]
  metadata?: {
    providersRun: string[]
    successfulProviders: number
    totalTokensUsed: number
  }
  onItemHighlight?: (bbox: BoundingBox) => void
}

// Category configuration for styling
const CATEGORY_CONFIG = {
  structural: { color: 'bg-blue-100 text-blue-800', label: 'Structural', icon: Building2 },
  exterior: { color: 'bg-green-100 text-green-800', label: 'Exterior', icon: Home },
  interior: { color: 'bg-purple-100 text-purple-800', label: 'Interior', icon: Layers },
  mep: { color: 'bg-yellow-100 text-yellow-800', label: 'MEP', icon: Zap },
  finishes: { color: 'bg-pink-100 text-pink-800', label: 'Finishes', icon: Paintbrush },
  other: { color: 'bg-gray-100 text-gray-800', label: 'Other', icon: Package }
}

// Impact color configuration
const IMPACT_CONFIG = {
  high: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
  medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Info },
  low: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle }
}

export default function EnhancedTakeoffAccordion({ 
  items, 
  summary, 
  consensus,
  specializedInsights = [],
  recommendations = [],
  metadata,
  onItemHighlight 
}: EnhancedTakeoffAccordionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [openCategories, setOpenCategories] = useState<string[]>([])
  const [openSubcategories, setOpenSubcategories] = useState<string[]>([])

  // Organize items into 3-level hierarchy
  const hierarchy = useMemo(() => {
    const organized: Record<string, Record<string, EnhancedTakeoffItem[]>> = {}
    
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
    const filtered: Record<string, Record<string, EnhancedTakeoffItem[]>> = {}
    
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
      {/* Enhanced Header with Consensus Info */}
      {consensus && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-blue-600" />
              Enhanced Multi-Model Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Models</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">{consensus.consensusCount}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Consensus</span>
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {Math.round(consensus.confidence * 100)}%
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">Disagreements</span>
                </div>
                <div className="text-2xl font-bold text-orange-700">
                  {consensus.disagreements.length}
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Items</span>
                </div>
                <div className="text-2xl font-bold text-purple-700">{items.length}</div>
              </div>
            </div>
            
            {/* Model Agreements */}
            {consensus.modelAgreements.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Model Performance:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {consensus.modelAgreements.map((agreement, index) => (
                    <div key={index} className="bg-white rounded-lg p-2 border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{agreement.model}</span>
                        <Badge variant="outline" className="text-xs">
                          {agreement.itemsFound} items
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">
                        <div>Specialization: {agreement.specialization}</div>
                        <div>Confidence: {Math.round(agreement.confidence * 100)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Specialized Insights */}
      {specializedInsights.length > 0 && (
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-purple-600" />
              Specialized Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {specializedInsights.map((insight, index) => {
              const ImpactIcon = IMPACT_CONFIG[insight.impact].icon
              const impactColor = IMPACT_CONFIG[insight.impact].color
              
              return (
                <div key={index} className={`p-3 rounded-lg border ${impactColor}`}>
                  <div className="flex items-start gap-2">
                    <ImpactIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <p className="text-xs text-gray-700 mb-2">{insight.description}</p>
                      <p className="text-xs font-medium">{insight.recommendation}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-gray-600">Models:</span>
                        <div className="flex gap-1">
                          {insight.models.map((model, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {model}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Disagreements */}
      {consensus?.disagreements && consensus.disagreements.length > 0 && (
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Model Disagreements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {consensus.disagreements.map((disagreement, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-orange-200">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-orange-800">
                      {disagreement.description}
                    </h4>
                    <p className="text-xs text-gray-700 mb-2">{disagreement.recommendation}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Models:</span>
                      <div className="flex gap-1">
                        {disagreement.models.map((model, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {model}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search Bar */}
      <Input
        placeholder="Search items, cost codes, or locations..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        leftIcon={<Search className="h-4 w-4" />}
      />

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
                    {React.createElement(config.icon, { className: 'h-5 w-5' })}
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
                                          {item.consensus_count && item.consensus_count > 1 && (
                                            <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                                              <Users className="h-3 w-3 mr-1" />
                                              {item.consensus_count} models
                                            </Badge>
                                          )}
                                        </div>
                                        {item.description && item.name !== item.description && (
                                          <p className="text-xs text-gray-600 mt-1">
                                            {item.description}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <Badge variant="secondary" className="text-xs shrink-0">
                                          {item.quantity} {item.unit}
                                        </Badge>
                                        {item.confidence && (
                                          <Badge 
                                            variant="outline" 
                                            className={`text-xs ${
                                              item.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                                              item.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                                              'bg-red-100 text-red-800'
                                            }`}
                                          >
                                            {Math.round(item.confidence * 100)}%
                                          </Badge>
                                        )}
                                      </div>
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
