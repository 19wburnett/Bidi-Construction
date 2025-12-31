'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Eye, 
  Plus, 
  X,
  DollarSign,
  Package,
  Loader2
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

interface Bid {
  id: string
  bid_amount: number | null
  status: string | null
  subcontractors?: {
    name: string
    email: string
    trade_category: string | null
  } | null
  gc_contacts?: {
    name: string
    email: string
    trade_category: string
  } | null
  bid_packages?: {
    trade_category: string
  } | null
}

interface TakeoffItem {
  id: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number | null
  total_cost?: number | null
  subcontractor?: string | null
}

interface BudgetTradeCardProps {
  tradeName: string
  tradeCategory: string
  takeoffItems: TakeoffItem[]
  assignedBid: Bid | null
  isConfirmed: boolean
  isConfirming?: boolean
  availableBidsCount: number
  onBidAssigned?: (bidId: string) => void
  onBidUnassigned?: () => void
  onConfirm?: (confirmed: boolean) => void
  onViewBids?: () => void
  onCreateBidPackage?: () => void
  onBidClick?: (bidId: string) => void
}

export default function BudgetTradeCard({
  tradeName,
  tradeCategory,
  takeoffItems,
  assignedBid,
  isConfirmed,
  isConfirming = false,
  availableBidsCount,
  onBidAssigned,
  onBidUnassigned,
  onConfirm,
  onViewBids,
  onCreateBidPackage,
  onBidClick
}: BudgetTradeCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `trade-drop-${tradeCategory}`,
    data: {
      type: 'trade',
      tradeCategory
    }
  })

  const getBidName = (bid: Bid) => {
    return bid.subcontractors?.name || 
           bid.gc_contacts?.name || 
           'Unknown'
  }

  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const calculateTakeoffTotal = () => {
    return takeoffItems.reduce((sum, item) => {
      if (item.total_cost !== null && item.total_cost !== undefined) {
        return sum + item.total_cost
      }
      if (item.unit_cost !== null && item.unit_cost !== undefined) {
        return sum + (item.unit_cost * item.quantity)
      }
      return sum
    }, 0)
  }

  // Determine card state
  const getCardState = () => {
    if (isConfirmed && assignedBid) {
      return 'confirmed'
    }
    if (assignedBid) {
      return 'assigned'
    }
    if (availableBidsCount > 0) {
      return 'has_bids'
    }
    return 'needs_bid'
  }

  const cardState = getCardState()

  // Get status badge
  const getStatusBadge = () => {
    switch (cardState) {
      case 'confirmed':
        return (
          <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Confirmed
          </Badge>
        )
      case 'assigned':
        return (
          <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50">
            <Package className="h-3 w-3 mr-1" />
            Assigned
          </Badge>
        )
      case 'has_bids':
        return (
          <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
            <Eye className="h-3 w-3 mr-1" />
            {availableBidsCount} {availableBidsCount === 1 ? 'Bid' : 'Bids'} Available
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
            <AlertCircle className="h-3 w-3 mr-1" />
            Needs Bid
          </Badge>
        )
    }
  }

  // Get card border color based on state
  const getBorderColor = () => {
    switch (cardState) {
      case 'confirmed':
        return 'border-green-300'
      case 'assigned':
        return 'border-orange-300'
      case 'has_bids':
        return 'border-blue-200'
      default:
        return 'border-red-200'
    }
  }

  // Get background color based on state
  const getBgColor = () => {
    switch (cardState) {
      case 'confirmed':
        return 'bg-green-50/30'
      case 'assigned':
        return 'bg-orange-50/30'
      case 'has_bids':
        return 'bg-blue-50/20'
      default:
        return 'bg-red-50/20'
    }
  }

  const dropZoneClass = isOver 
    ? 'ring-2 ring-orange-500 ring-offset-2 bg-orange-100 border-orange-400' 
    : ''

  return (
    <Card
      ref={setNodeRef}
      className={`transition-all ${getBorderColor()} ${getBgColor()} ${dropZoneClass} ${
        isOver ? 'shadow-lg scale-[1.02]' : 'hover:shadow-md'
      }`}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 mb-1">
              {tradeName}
            </h3>
            {takeoffItems.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="takeoff-items" className="border-0">
                  <AccordionTrigger className="py-2 text-sm text-gray-600 hover:no-underline">
                    <span>
                      {takeoffItems.length} {takeoffItems.length === 1 ? 'item' : 'items'} from takeoff
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {takeoffItems.map((item) => {
                        const itemCost = item.total_cost !== null && item.total_cost !== undefined
                          ? item.total_cost
                          : (item.unit_cost !== null && item.unit_cost !== undefined
                            ? item.unit_cost * item.quantity
                            : 0)
                        
                        return (
                          <div
                            key={item.id}
                            className="p-2 bg-gray-50 rounded border border-gray-200 text-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {item.description || 'Item'}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                                  <span>
                                    {item.quantity.toLocaleString()} {item.unit || 'units'}
                                  </span>
                                  {item.unit_cost !== null && item.unit_cost !== undefined && (
                                    <>
                                      <span>•</span>
                                      <span>{formatCurrency(item.unit_cost)} per {item.unit || 'unit'}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">
                                  {formatCurrency(itemCost)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No takeoff items for this trade
              </p>
            )}
          </div>
          {getStatusBadge()}
        </div>

        {/* Takeoff Estimate */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Takeoff Estimate</span>
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(calculateTakeoffTotal())}
            </span>
          </div>
        </div>

        {/* Assigned/Confirmed Bid Display */}
        {assignedBid && (
          <div className={`mb-4 p-4 rounded-lg border-2 ${
            isConfirmed 
              ? 'bg-green-50 border-green-300' 
              : 'bg-orange-50 border-orange-300'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">
                    {getBidName(assignedBid)}
                  </h4>
                  {isConfirmed && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <p className="text-xs text-gray-600">
                  {assignedBid.subcontractors?.email || assignedBid.gc_contacts?.email || ''}
                </p>
              </div>
              {!isConfirmed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onBidUnassigned?.()
                  }}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {assignedBid.subcontractors?.trade_category || 
                 assignedBid.gc_contacts?.trade_category || 
                 assignedBid.bid_packages?.trade_category || 
                 'Other'}
              </Badge>
              <div className="flex items-center gap-1 text-xl font-bold text-gray-900">
                <DollarSign className="h-5 w-5" />
                {formatCurrency(assignedBid.bid_amount)}
              </div>
            </div>

            {!isConfirmed && assignedBid && (
              <div className="mt-3 pt-3 border-t border-orange-200">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`confirm-${tradeCategory}`}
                    checked={false}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        onConfirm?.(true)
                      }
                    }}
                    disabled={isConfirming}
                  />
                  <label
                    htmlFor={`confirm-${tradeCategory}`}
                    className="text-sm text-gray-700 cursor-pointer flex-1"
                  >
                    {isConfirming ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Confirming...
                      </span>
                    ) : (
                      'Confirm and accept this bid'
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drop Zone Indicator */}
        {!assignedBid && (
          <div className={`mb-4 p-4 rounded-lg border-2 border-dashed transition-colors ${
            isOver 
              ? 'border-orange-400 bg-orange-100' 
              : 'border-gray-300 bg-gray-50 hover:border-orange-300 hover:bg-orange-50/50'
          }`}>
            <div className="text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">
                {isOver ? 'Drop bid here' : 'Drag a bid here to assign'}
              </p>
            </div>
          </div>
        )}

        {/* Confirmation Checkbox (when bid is assigned) */}
        {assignedBid && isConfirmed && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800 font-medium">
                Bid confirmed and accepted
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {!assignedBid && availableBidsCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onViewBids?.()
              }}
              className="flex-1"
            >
              <Eye className="h-3 w-3 mr-1" />
              View Bids ({availableBidsCount})
            </Button>
          )}
          {cardState === 'needs_bid' && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onCreateBidPackage?.()
              }}
              className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Bid Package
            </Button>
          )}
          {assignedBid && onBidClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onBidClick(assignedBid.id)
              }}
              className="flex-1"
            >
              <Eye className="h-3 w-3 mr-1" />
              View Bid Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

