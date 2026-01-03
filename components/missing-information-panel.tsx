'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, X, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { MissingInformation } from '@/types/takeoff'

interface MissingInformationPanelProps {
  missingInformation: MissingInformation[]
  onResolve?: (itemId: string) => void
  onUnresolve?: (itemId: string) => void
}

export default function MissingInformationPanel({
  missingInformation,
  onResolve,
  onUnresolve
}: MissingInformationPanelProps) {
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterImpact, setFilterImpact] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  if (!missingInformation || missingInformation.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Missing Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>No missing information identified</p>
            <p className="text-sm mt-1">All required measurements and quantities are available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'measurement':
        return '📏'
      case 'quantity':
        return '🔢'
      case 'specification':
        return '📋'
      case 'detail':
        return '📝'
      default:
        return '❓'
    }
  }

  const categories = Array.from(new Set(missingInformation.map(m => m.category)))
  const impacts = Array.from(new Set(missingInformation.map(m => m.impact)))

  const filtered = missingInformation.filter(item => {
    if (filterCategory && item.category !== filterCategory) return false
    if (filterImpact && item.impact !== filterImpact) return false
    return true
  })

  const groupedByCategory = filtered.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, MissingInformation[]>)

  const summary = {
    total: missingInformation.length,
    by_category: categories.reduce((acc, cat) => {
      acc[cat] = missingInformation.filter(m => m.category === cat).length
      return acc
    }, {} as Record<string, number>),
    by_impact: impacts.reduce((acc, imp) => {
      acc[imp] = missingInformation.filter(m => m.impact === imp).length
      return acc
    }, {} as Record<string, number>),
    critical: missingInformation.filter(m => m.impact === 'critical').length
  }

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Missing Information
          <Badge variant="outline" className="ml-2">
            {summary.total} items
          </Badge>
          {summary.critical > 0 && (
            <Badge variant="outline" className="ml-2 border-red-300 text-red-700 bg-red-50">
              {summary.critical} critical
            </Badge>
          )}
        </CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <select
            value={filterCategory || ''}
            onChange={(e) => setFilterCategory(e.target.value || null)}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={filterImpact || ''}
            onChange={(e) => setFilterImpact(e.target.value || null)}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="">All Impact Levels</option>
            {impacts.map(imp => (
              <option key={imp} value={imp}>{imp}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(summary.by_category).map(([cat, count]) => (
            <div key={cat} className="p-2 bg-gray-50 rounded border">
              <div className="font-semibold">{getCategoryIcon(cat)} {cat}</div>
              <div className="text-gray-600">{count}</div>
            </div>
          ))}
        </div>

        {/* Grouped by Category */}
        {Object.entries(groupedByCategory).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)} ({items.length})
            </h4>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const itemId = item.item_id || `item_${idx}`
                const isExpanded = expandedItems.has(itemId)
                const isResolved = false // Would come from props or state

                return (
                  <div
                    key={itemId}
                    className={`p-3 border rounded-lg ${
                      item.impact === 'critical'
                        ? 'bg-red-50 border-red-200'
                        : item.impact === 'high'
                        ? 'bg-orange-50 border-orange-200'
                        : item.impact === 'medium'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleExpanded(itemId)}
                            className="p-0.5 hover:bg-gray-200 rounded"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                          <span className="font-medium text-sm">{item.item_name}</span>
                          <Badge variant="outline" className={`text-xs ${getImpactColor(item.impact)}`}>
                            {item.impact}
                          </Badge>
                        </div>
                        {isExpanded && (
                          <div className="mt-2 space-y-2 pl-6 text-sm">
                            <div>
                              <div className="font-medium text-gray-700">What's Missing:</div>
                              <div className="text-gray-600">{item.missing_data}</div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-700">Why Needed:</div>
                              <div className="text-gray-600">{item.why_needed}</div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-700">Where to Find:</div>
                              <div className="text-gray-600">{item.where_to_find}</div>
                            </div>
                            {item.location && (
                              <div>
                                <div className="font-medium text-gray-700">Location:</div>
                                <div className="text-gray-600">{item.location}</div>
                              </div>
                            )}
                            {item.suggested_action && (
                              <div>
                                <div className="font-medium text-gray-700">Suggested Action:</div>
                                <div className="text-gray-600">{item.suggested_action}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {onResolve && (
                        <button
                          onClick={() => onResolve(itemId)}
                          className="ml-2 p-1 text-green-600 hover:bg-green-100 rounded"
                          title="Mark as resolved"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
