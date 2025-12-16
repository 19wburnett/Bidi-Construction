'use client'

import React, { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { ChevronDown, ChevronUp, Search, GripVertical, DollarSign, CheckCircle2, Clock, XCircle } from 'lucide-react'
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

interface AvailableBidsPanelProps {
  bids: Bid[]
  scenarioBidIds?: Set<string>
  onBidClick?: (bidId: string) => void
  className?: string
}

// Draggable bid card component
function DraggableBidCard({ bid, scenarioBidIds, onBidClick }: { bid: Bid; scenarioBidIds?: Set<string>; onBidClick?: (bidId: string) => void }) {
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

  const isInScenario = scenarioBidIds?.has(bid.id)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'
      } ${isInScenario ? 'border-orange-300 bg-orange-50/50' : ''}`}
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

            {isInScenario && (
              <div className="mt-2 pt-2 border-t border-orange-200">
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-100">
                  In Scenario
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AvailableBidsPanel({
  bids,
  scenarioBidIds,
  onBidClick,
  className = ''
}: AvailableBidsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

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
        // Search filter
        const matchesSearch = !searchQuery || 
          getBidName(bid).toLowerCase().includes(searchQuery.toLowerCase()) ||
          (bid.subcontractors?.email || bid.gc_contacts?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          trade.toLowerCase().includes(searchQuery.toLowerCase())
        
        // Status filter
        const matchesStatus = !statusFilter || bid.status === statusFilter
        
        return matchesSearch && matchesStatus
      })
      
      if (filteredBids.length > 0) {
        filtered[trade] = filteredBids
      }
    })
    
    return filtered
  }, [bidsByTrade, searchQuery, statusFilter])

  const totalBids = bids.length
  const filteredCount = Object.values(filteredBidsByTrade).reduce((sum, bids) => sum + bids.length, 0)

  function getBidName(bid: Bid): string {
    return bid.subcontractors?.name || 
           bid.gc_contacts?.name || 
           'Unknown'
  }

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
          {/* Search and filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search bids..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter(null)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === null
                    ? 'bg-orange-100 text-orange-700 border border-orange-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === 'pending'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('accepted')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === 'accepted'
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Accepted
              </button>
              <button
                onClick={() => setStatusFilter('declined')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === 'declined'
                    ? 'bg-red-100 text-red-700 border border-red-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Declined
              </button>
            </div>
          </div>

          {/* Bids grouped by trade */}
          {filteredCount === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No bids found matching your filters
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
                        scenarioBidIds={scenarioBidIds}
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

