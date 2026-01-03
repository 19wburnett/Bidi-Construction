'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Receipt, Package, Hammer, FileText, DollarSign, Wrench } from 'lucide-react'

interface BidLineItem {
  id: string
  item_number: number
  description: string
  category: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
  is_optional?: boolean | null
  option_group?: string | null
}

interface BidLineItemsDisplayProps {
  lineItems: BidLineItem[]
  totalAmount?: number | null
}

const CATEGORY_CONFIG = {
  labor: {
    icon: Hammer,
    color: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-700',
    label: 'Labor'
  },
  materials: {
    icon: Package,
    color: 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-400 border-green-200 dark:border-green-700',
    label: 'Materials'
  },
  equipment: {
    icon: Wrench,
    color: 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-700',
    label: 'Equipment'
  },
  permits: {
    icon: FileText,
    color: 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-700',
    label: 'Permits'
  },
  other: {
    icon: DollarSign,
    color: 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    label: 'Other'
  }
}

export default function BidLineItemsDisplay({ lineItems, totalAmount }: BidLineItemsDisplayProps) {
  // Track which optional items are selected
  const [selectedOptionalItems, setSelectedOptionalItems] = useState<Set<string>>(new Set())

  if (!lineItems || lineItems.length === 0) {
    return null
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatNumber = (num: number | null) => {
    if (num === null || num === undefined) return '-'
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)
  }

  // Toggle optional item selection
  const toggleOptionalItem = (itemId: string) => {
    setSelectedOptionalItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  // Calculate total from line items (standard items + selected optional items)
  const standardItems = lineItems.filter(item => !item.is_optional)
  const selectedOptionalItemsList = lineItems.filter(
    item => item.is_optional && selectedOptionalItems.has(item.id)
  )
  const calculatedTotal = [
    ...standardItems,
    ...selectedOptionalItemsList
  ].reduce((sum, item) => sum + (item.amount || 0), 0)
  const optionalTotal = lineItems.filter(item => item.is_optional).reduce((sum, item) => sum + (item.amount || 0), 0)
  const selectedOptionalTotal = selectedOptionalItemsList.reduce((sum, item) => sum + (item.amount || 0), 0)

  // Separate standard and optional items
  const standardLineItems = lineItems.filter(item => !item.is_optional)
  const optionalLineItems = lineItems.filter(item => item.is_optional)

  // Group optional items by option_group
  const optionalByGroup = optionalLineItems.reduce((acc, item) => {
    const group = item.option_group || 'Other Options'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(item)
    return acc
  }, {} as Record<string, BidLineItem[]>)

  // Group standard items by category
  const itemsByCategory = standardLineItems.reduce((acc, item) => {
    const category = item.category || 'other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {} as Record<string, BidLineItem[]>)

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Receipt className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <CardTitle className="text-lg">Cost Breakdown</CardTitle>
          </div>
          <Badge variant="outline" className="text-sm font-semibold dark:border-gray-700 dark:text-gray-300">
            {lineItems.length} {lineItems.length === 1 ? 'Item' : 'Items'}
          </Badge>
        </div>
        <CardDescription>
          Detailed line-by-line cost breakdown provided by contractor
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(itemsByCategory).map(([category, items]) => {
            const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other
            const Icon = config.icon
            const categoryTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)

            return (
              <div key={category} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center justify-between border-b dark:border-gray-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <h4 className="font-semibold text-gray-900 dark:text-white">{config.label}</h4>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {formatCurrency(categoryTotal)}
                  </span>
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-start space-x-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                              #{item.item_number}
                            </span>
                            <p className="text-sm text-gray-900 dark:text-white font-medium">
                              {item.description}
                            </p>
                            {item.is_optional && (
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300">
                                Optional
                              </Badge>
                            )}
                          </div>
                          
                          {/* Quantity and Unit Info */}
                          {(item.quantity || item.unit || item.unit_price) && (
                            <div className="mt-1 flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                              {item.quantity && item.unit && (
                                <span>
                                  {formatNumber(item.quantity)} {item.unit}
                                </span>
                              )}
                              {item.unit_price && (
                                <span>
                                  @ {formatCurrency(item.unit_price)}/{item.unit || 'unit'}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Notes */}
                          {item.notes && (
                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 italic">
                              {item.notes}
                            </p>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="text-right ml-4">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {formatCurrency(item.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Optional Items Section */}
          {optionalLineItems.length > 0 && (
            <div className="border-t-2 border-orange-300 dark:border-orange-700 pt-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-400">Optional Items</h3>
              </div>
              {Object.entries(optionalByGroup).map(([groupName, groupItems]) => {
                const groupTotal = groupItems.reduce((sum, item) => sum + (item.amount || 0), 0)
                return (
                  <div key={groupName} className="space-y-2 border-l-4 border-l-orange-400 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                        {groupName}
                      </Badge>
                      <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                        {formatCurrency(groupTotal)}
                      </span>
                    </div>
                    {groupItems.map((item) => {
                      const itemCategory = item.category || 'other'
                      const config = CATEGORY_CONFIG[itemCategory as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other
                      const isSelected = selectedOptionalItems.has(item.id)
                      return (
                        <div 
                          key={item.id} 
                          className={`rounded-lg p-3 border transition-colors ${
                            isSelected 
                              ? 'bg-orange-100 dark:bg-orange-900/50 border-orange-400 dark:border-orange-600' 
                              : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-start space-x-2">
                                <Checkbox
                                  id={`optional-${item.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => toggleOptionalItem(item.id)}
                                  className="mt-0.5"
                                />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                                  #{item.item_number}
                                </span>
                                <p className="text-sm text-gray-900 dark:text-white font-medium">
                                  {item.description}
                                </p>
                              </div>
                              {(item.quantity || item.unit || item.unit_price) && (
                                <div className="mt-1 flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                                  {item.quantity && item.unit && (
                                    <span>
                                      {formatNumber(item.quantity)} {item.unit}
                                    </span>
                                  )}
                                  {item.unit_price && (
                                    <span>
                                      @ {formatCurrency(item.unit_price)}/{item.unit || 'unit'}
                                    </span>
                                  )}
                                </div>
                              )}
                              {item.notes && (
                                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 italic">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-bold text-orange-700 dark:text-orange-400">
                                {formatCurrency(item.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              <div className="text-xs text-gray-500 dark:text-gray-400 italic pt-2 border-t border-orange-200 dark:border-orange-800">
                <div className="flex justify-between items-center mb-1">
                  <span>All optional items total: {formatCurrency(optionalTotal)}</span>
                </div>
                {selectedOptionalTotal > 0 && (
                  <div className="flex justify-between items-center font-semibold text-orange-700 dark:text-orange-400">
                    <span>Selected optional items: {formatCurrency(selectedOptionalTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="border-t-2 border-gray-300 dark:border-gray-700 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                Total {selectedOptionalTotal > 0 ? '(Standard + Selected Options)' : '(Standard Items)'}
              </span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(calculatedTotal)}
              </span>
            </div>
            
            {/* Show warning if bid_amount doesn't match calculated total */}
            {totalAmount && Math.abs(totalAmount - calculatedTotal) > 0.01 && (
              <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 rounded p-2">
                Note: Bid total ({formatCurrency(totalAmount)}) differs from line items total
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
