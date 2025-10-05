'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
}

interface BidLineItemsDisplayProps {
  lineItems: BidLineItem[]
  totalAmount?: number | null
}

const CATEGORY_CONFIG = {
  labor: {
    icon: Hammer,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    label: 'Labor'
  },
  materials: {
    icon: Package,
    color: 'bg-green-100 text-green-800 border-green-200',
    label: 'Materials'
  },
  equipment: {
    icon: Wrench,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    label: 'Equipment'
  },
  permits: {
    icon: FileText,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    label: 'Permits'
  },
  other: {
    icon: DollarSign,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    label: 'Other'
  }
}

export default function BidLineItemsDisplay({ lineItems, totalAmount }: BidLineItemsDisplayProps) {
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

  // Calculate total from line items
  const calculatedTotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)

  // Group items by category
  const itemsByCategory = lineItems.reduce((acc, item) => {
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
            <Receipt className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Cost Breakdown</CardTitle>
          </div>
          <Badge variant="outline" className="text-sm font-semibold">
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
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <h4 className="font-semibold text-gray-900">{config.label}</h4>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {formatCurrency(categoryTotal)}
                  </span>
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-start space-x-2">
                            <span className="text-xs font-medium text-gray-500 mt-0.5">
                              #{item.item_number}
                            </span>
                            <p className="text-sm text-gray-900 font-medium">
                              {item.description}
                            </p>
                          </div>
                          
                          {/* Quantity and Unit Info */}
                          {(item.quantity || item.unit || item.unit_price) && (
                            <div className="mt-1 flex items-center space-x-2 text-xs text-gray-600">
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
                            <p className="mt-1 text-xs text-gray-600 italic">
                              {item.notes}
                            </p>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="text-right ml-4">
                          <p className="text-sm font-bold text-gray-900">
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

          {/* Total */}
          <div className="border-t-2 border-gray-300 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(calculatedTotal)}
              </span>
            </div>
            
            {/* Show warning if bid_amount doesn't match calculated total */}
            {totalAmount && Math.abs(totalAmount - calculatedTotal) > 0.01 && (
              <div className="mt-2 text-xs text-orange-600 bg-orange-50 rounded p-2">
                Note: Bid total ({formatCurrency(totalAmount)}) differs from line items total
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
