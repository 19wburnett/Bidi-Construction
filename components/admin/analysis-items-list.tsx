'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit2, Trash2, MapPin } from 'lucide-react'
import { TakeoffItem } from './takeoff-item-form'
import { QualityIssue } from './quality-issue-form'

interface AnalysisItemsListProps {
  items: (TakeoffItem | QualityIssue)[]
  type: 'takeoff' | 'quality'
  onEdit: (item: TakeoffItem | QualityIssue) => void
  onDelete: (id: string) => void
  onHighlight?: (item: TakeoffItem | QualityIssue) => void
}

export default function AnalysisItemsList({
  items,
  type,
  onEdit,
  onDelete,
  onHighlight
}: AnalysisItemsListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No {type} items added yet</p>
        <p className="text-xs mt-1">Use the form above to add items</p>
      </div>
    )
  }

  // Calculate summary for takeoff items
  const summary = type === 'takeoff' ? {
    totalItems: items.length,
    totalQuantity: items.reduce((sum, item) => sum + ((item as TakeoffItem).quantity || 0), 0),
    totalCost: items.reduce((sum, item) => {
      const takeoffItem = item as TakeoffItem
      return sum + ((takeoffItem.quantity || 0) * (takeoffItem.unit_cost || 0))
    }, 0),
    categories: [...new Set(items.map(item => (item as TakeoffItem).category))].length
  } : null

  return (
    <div className="space-y-4">
      {/* Items list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {items.map((item, index) => (
          <Card 
            key={item.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onHighlight?.(item)}
          >
            <CardContent className="p-3">
              {type === 'takeoff' ? (
                // Takeoff Item
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-blue-600 text-sm">
                        #{index + 1}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {(item as TakeoffItem).category}
                      </Badge>
                      {item.marker && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          Page {item.marker.page}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium text-sm mb-1">
                      {(item as TakeoffItem).name}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>
                        {(item as TakeoffItem).quantity} {(item as TakeoffItem).unit}
                      </span>
                      {(item as TakeoffItem).unit_cost && (
                        <span>
                          ${(item as TakeoffItem).unit_cost}/unit • ${((item as TakeoffItem).quantity * (item as TakeoffItem).unit_cost!).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {(item as TakeoffItem).notes && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {(item as TakeoffItem).notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(item)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this item?')) {
                          onDelete(item.id)
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                // Quality Issue
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-orange-600 text-sm">
                        #{index + 1}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          (item as QualityIssue).severity === 'critical' ? 'bg-red-50 border-red-300 text-red-700' :
                          (item as QualityIssue).severity === 'warning' ? 'bg-orange-50 border-orange-300 text-orange-700' :
                          'bg-blue-50 border-blue-300 text-blue-700'
                        }`}
                      >
                        {(item as QualityIssue).severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {(item as QualityIssue).category}
                      </Badge>
                      {item.marker && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          Page {item.marker.page}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mb-1 line-clamp-2">
                      {(item as QualityIssue).description}
                    </p>
                    {(item as QualityIssue).location && (
                      <p className="text-xs text-gray-500">
                        📍 {(item as QualityIssue).location}
                      </p>
                    )}
                    {(item as QualityIssue).recommendation && (
                      <p className="text-xs text-blue-600 mt-1 line-clamp-1">
                        💡 {(item as QualityIssue).recommendation}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(item)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this issue?')) {
                          onDelete(item.id)
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary for takeoff */}
      {type === 'takeoff' && summary && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <h4 className="font-semibold text-sm mb-2">Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium ml-1">{summary.totalItems}</span>
              </div>
              <div>
                <span className="text-gray-600">Categories:</span>
                <span className="font-medium ml-1">{summary.categories}</span>
              </div>
              {summary.totalCost > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-600">Est. Total Cost:</span>
                  <span className="font-medium ml-1">${summary.totalCost.toFixed(2)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary for quality */}
      {type === 'quality' && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-3">
            <h4 className="font-semibold text-sm mb-2">Summary</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Total Issues:</span>
                <span className="font-medium ml-1">{items.length}</span>
              </div>
              <div>
                <span className="text-red-600">Critical:</span>
                <span className="font-medium ml-1">
                  {items.filter(i => (i as QualityIssue).severity === 'critical').length}
                </span>
              </div>
              <div>
                <span className="text-orange-600">Warnings:</span>
                <span className="font-medium ml-1">
                  {items.filter(i => (i as QualityIssue).severity === 'warning').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


