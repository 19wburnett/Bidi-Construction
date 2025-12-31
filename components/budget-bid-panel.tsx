'use client'

import React, { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Search, GripVertical, DollarSign, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

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

interface BudgetBidPanelProps {
  bids: Bid[]
  onBidClick?: (bidId: string) => void
  className?: string
}

// Draggable bid card component
function DraggableBidCard({ bid, onBidClick }: { bid: Bid; onBidClick?: (bidId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bid-${bid.id}`,
    data: {
      type: 'bid',
      bid: bid
    }
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1
      }
    : undefined

  const getBidTradeCategory = () => {
    return bid.subcontractors?.trade_category || 
           bid.gc_contacts?.trade_category || 
           bid.bid_packages?.trade_category || 
           'Other'
  }

  const getBidName = () => {
    return bid.subcontractors?.name || 
           bid.gc_contacts?.name || 
           'Unknown'
  }

  const getStatusBadge = () => {
    const status = bid.status || 'pending'
    switch (status) {
      case 'accepted':
        return (
          <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        )
      case 'declined':
        return (
          <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
            <XCircle className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-50 shadow-lg z-50' : 'hover:shadow-md'
      }`}
      onClick={() => onBidClick?.(bid.id)}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-gray-900 truncate">
                  {getBidName()}
                </h4>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {bid.subcontractors?.email || bid.gc_contacts?.email}
                </p>
              </div>
              {getStatusBadge()}
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <Badge variant="secondary" className="text-xs">
                {getBidTradeCategory()}
              </Badge>
              {bid.bid_amount !== null && (
                <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                  <DollarSign className="h-3 w-3" />
                  {bid.bid_amount.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BudgetBidPanel({
  bids,
  onBidClick,
  className = ''
}: BudgetBidPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Group bids by trade category
  const bidsByTrade = useMemo(() => {
    const grouped: Record<string, Bid[]> = {}
    
    bids.forEach(bid => {
      const tradeCategory = bid.subcontractors?.trade_category || 
                           bid.gc_contacts?.trade_category || 
                           bid.bid_packages?.trade_category || 
                           'Other'
      
      if (!grouped[tradeCategory]) {
        grouped[tradeCategory] = []
      }
      grouped[tradeCategory].push(bid)
    })
    
    return grouped
  }, [bids])

  // Filter bids
  const filteredBidsByTrade = useMemo(() => {
    const filtered: Record<string, Bid[]> = {}
    
    Object.entries(bidsByTrade).forEach(([trade, tradeBids]) => {
      const filteredBids = tradeBids.filter(bid => {
        const bidName = bid.subcontractors?.name || bid.gc_contacts?.name || 'Unknown'
        const email = bid.subcontractors?.email || bid.gc_contacts?.email || ''
        const tradeCategory = bid.subcontractors?.trade_category || 
                             bid.gc_contacts?.trade_category || 
                             bid.bid_packages?.trade_category || 
                             'Other'
        
        return !searchQuery || 
          bidName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tradeCategory.toLowerCase().includes(searchQuery.toLowerCase())
      })
      
      if (filteredBids.length > 0) {
        filtered[trade] = filteredBids
      }
    })
    
    return filtered
  }, [bidsByTrade, searchQuery])

  const totalBids = bids.length
  const filteredCount = Object.values(filteredBidsByTrade).reduce((sum, bids) => sum + bids.length, 0)

  return (
    <div className={`border rounded-lg bg-white shadow-sm ${className}`}>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Available Bids</h3>
          <Badge variant="secondary" className="text-xs">
            {totalBids}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </div>

      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search bids..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="!pl-10 pr-3"
            />
          </div>

          {/* Bids grouped by trade */}
          {filteredCount === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No bids found matching your search
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {Object.entries(filteredBidsByTrade).map(([trade, tradeBids]) => (
                <div key={trade} className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {trade} ({tradeBids.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {tradeBids.map(bid => (
                      <DraggableBidCard
                        key={bid.id}
                        bid={bid}
                        onBidClick={onBidClick}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

