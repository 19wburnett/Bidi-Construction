'use client'

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { ChevronRight, ChevronDown, Search, Download, FileSpreadsheet, FileText, DollarSign, Expand, Minimize2, Eye, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { exportToCSV, exportToExcel } from '@/lib/takeoff-export'

interface AcceptedBid {
  id: string
  bid_amount: number | null
  accepted_at: string
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
  bid_line_items?: Array<{
    id: string
    description: string
    category: string
    quantity: number | null
    unit: string | null
    unit_price: number | null
    amount: number
  }>
}

interface TakeoffItem {
  id: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number | null
  total_cost?: number | null
}

interface BudgetSpreadsheetProps {
  acceptedBids: AcceptedBid[]
  takeoffItems: TakeoffItem[]
  onBidClick?: (bidId: string) => void
  onViewBidsForTrade?: (tradeCategory: string) => void
  jobId?: string
}

interface GroupedRow {
  type: 'trade' | 'bid' | 'item'
  id: string
  name: string
  data?: TakeoffItem | AcceptedBid
  total?: number
  quantity?: number
  expanded: boolean
  level: number
  children?: GroupedRow[]
  tradeCategory?: string
  bidId?: string
  status?: 'covered' | 'needs_bid'
}

const CATEGORY_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  structural: { color: 'text-orange-800', bgColor: 'bg-orange-100', label: 'Structural' },
  exterior: { color: 'text-green-800', bgColor: 'bg-green-100', label: 'Exterior' },
  interior: { color: 'text-purple-800', bgColor: 'bg-purple-100', label: 'Interior' },
  mep: { color: 'text-yellow-800', bgColor: 'bg-yellow-100', label: 'MEP' },
  finishes: { color: 'text-pink-800', bgColor: 'bg-pink-100', label: 'Finishes' },
  other: { color: 'text-gray-800', bgColor: 'bg-gray-100', label: 'Other' }
}

// Map trade categories to takeoff categories
const normalizeCategory = (category: string): string => {
  const normalized = category.toLowerCase().trim()
  
  // Map common trade categories to takeoff categories
  const tradeToCategoryMap: Record<string, string> = {
    'structural': 'structural',
    'structural steel': 'structural',
    'concrete': 'structural',
    'masonry': 'structural',
    'framing': 'structural',
    'excavation': 'structural',
    'hvac': 'mep',
    'plumbing': 'mep',
    'electrical': 'mep',
    'fire sprinkler': 'mep',
    'flooring': 'finishes',
    'painting': 'finishes',
    'drywall': 'finishes',
    'carpentry': 'finishes',
    'millwork & casework': 'finishes',
    'insulation': 'finishes',
    'siding': 'exterior',
    'roofing': 'exterior',
    'windows & doors': 'exterior',
    'windows': 'exterior',
    'doors': 'exterior'
  }
  
  return tradeToCategoryMap[normalized] || normalized || 'other'
}

export default function BudgetSpreadsheet({
  acceptedBids,
  takeoffItems,
  onBidClick,
  onViewBidsForTrade,
  jobId
}: BudgetSpreadsheetProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set())
  const [expandedBids, setExpandedBids] = useState<Set<string>>(new Set())
  const tradeRefs = useRef<Record<string, HTMLTableRowElement>>({})

  // Format currency helper
  const formatCurrency = (amount: number | undefined | null): string => {
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
    if (item.total_cost !== undefined && item.total_cost !== null && !isNaN(item.total_cost)) {
      return item.total_cost
    }
    if (item.unit_cost !== undefined && item.unit_cost !== null && 
        item.quantity !== undefined && item.quantity !== null &&
        !isNaN(item.unit_cost) && !isNaN(item.quantity)) {
      return item.unit_cost * item.quantity
    }
    return 0
  }, [])

  // Get trade category for a bid
  const getBidTradeCategory = useCallback((bid: AcceptedBid): string => {
    return bid.subcontractors?.trade_category || 
           bid.gc_contacts?.trade_category || 
           bid.bid_packages?.trade_category || 
           'Other'
  }, [])

  // Group bids by trade category
  const bidsByTrade = useMemo(() => {
    const grouped: Record<string, AcceptedBid[]> = {}
    
    acceptedBids.forEach(bid => {
      const tradeCategory = getBidTradeCategory(bid)
      const normalizedTrade = normalizeCategory(tradeCategory)
      
      if (!grouped[normalizedTrade]) {
        grouped[normalizedTrade] = []
      }
      grouped[normalizedTrade].push(bid)
    })
    
    return grouped
  }, [acceptedBids, getBidTradeCategory])

  // Match takeoff items to bids by category
  const matchTakeoffItemsToBids = useCallback((tradeCategory: string, bid: AcceptedBid): TakeoffItem[] => {
    const normalizedTrade = normalizeCategory(tradeCategory)
    
    return takeoffItems.filter(item => {
      const itemCategory = normalizeCategory(item.category)
      return itemCategory === normalizedTrade
    })
  }, [takeoffItems])

  // Get uncovered takeoff items for a trade
  const getUncoveredItems = useCallback((tradeCategory: string): TakeoffItem[] => {
    const normalizedTrade = normalizeCategory(tradeCategory)
    const tradeBids = bidsByTrade[normalizedTrade] || []
    
    // Get all takeoff items for this trade
    const tradeItems = takeoffItems.filter(item => {
      const itemCategory = normalizeCategory(item.category)
      return itemCategory === normalizedTrade
    })
    
    // If no bids, all items are uncovered
    if (tradeBids.length === 0) {
      return tradeItems
    }
    
    // Get all line items from accepted bids for this trade
    const coveredDescriptions = new Set<string>()
    tradeBids.forEach(bid => {
      bid.bid_line_items?.forEach(lineItem => {
        coveredDescriptions.add(lineItem.description.toLowerCase().trim())
      })
    })
    
    // Return items that don't match any bid line items
    return tradeItems.filter(item => {
      const itemDesc = item.description.toLowerCase().trim()
      return !Array.from(coveredDescriptions).some(covered => 
        itemDesc.includes(covered) || covered.includes(itemDesc)
      )
    })
  }, [takeoffItems, bidsByTrade])

  // Build grouped row structure
  const groupedRows = useMemo(() => {
    const rows: GroupedRow[] = []

    // Get all unique trade categories from both bids and takeoff items
    const allTrades = new Set<string>()
    Object.keys(bidsByTrade).forEach(trade => allTrades.add(trade))
    takeoffItems.forEach(item => {
      const normalized = normalizeCategory(item.category)
      allTrades.add(normalized)
    })

    // Build rows for each trade
    Array.from(allTrades).forEach(tradeCategory => {
      const categoryConfig = CATEGORY_CONFIG[tradeCategory] || CATEGORY_CONFIG.other
      const categoryName = categoryConfig.label
      const tradeId = `trade-${tradeCategory}`
      const tradeExpanded = expandedTrades.has(tradeId)

      const tradeBids = bidsByTrade[tradeCategory] || []
      const uncoveredItems = getUncoveredItems(tradeCategory)
      
      // Calculate trade total (sum of all accepted bids)
      const tradeTotal = tradeBids.reduce((sum, bid) => sum + (bid.bid_amount || 0), 0)
      
      // Build bid rows
      const bidRows: GroupedRow[] = tradeBids.map(bid => {
        const bidId = `bid-${bid.id}`
        const bidExpanded = expandedBids.has(bidId)
        const coveredItems = matchTakeoffItemsToBids(tradeCategory, bid)
        
        // Filter by search if needed
        const filteredItems = searchQuery
          ? coveredItems.filter(item =>
              item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.category?.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : coveredItems

        const itemRows: GroupedRow[] = filteredItems.map(item => ({
          type: 'item',
          id: `item-${item.id}`,
          name: item.description || 'Item',
          data: item,
          total: calculateItemCost(item),
          quantity: item.quantity,
          expanded: false,
          level: 2,
          tradeCategory,
          bidId: bid.id,
          status: 'covered'
        }))

        return {
          type: 'bid',
          id: bidId,
          name: bid.subcontractors?.name || bid.gc_contacts?.name || 'Unknown',
          data: bid,
          total: bid.bid_amount || 0,
          expanded: bidExpanded,
          level: 1,
          tradeCategory,
          bidId: bid.id,
          children: itemRows
        }
      })

      // Add uncovered items section if there are any
      if (uncoveredItems.length > 0) {
        const filteredUncovered = searchQuery
          ? uncoveredItems.filter(item =>
              item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.category?.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : uncoveredItems

        if (filteredUncovered.length > 0) {
          const uncoveredItemRows: GroupedRow[] = filteredUncovered.map(item => ({
            type: 'item',
            id: `uncovered-${item.id}`,
            name: item.description || 'Item',
            data: item,
            total: calculateItemCost(item),
            quantity: item.quantity,
            expanded: false,
            level: 2,
            tradeCategory,
            status: 'needs_bid'
          }))

          // Add as a special "Needs Bid" bid row
          bidRows.push({
            type: 'bid',
            id: `needs-bid-${tradeCategory}`,
            name: 'Needs Bid',
            total: uncoveredItems.reduce((sum, item) => sum + calculateItemCost(item), 0),
            expanded: expandedBids.has(`needs-bid-${tradeCategory}`),
            level: 1,
            tradeCategory,
            children: uncoveredItemRows,
            status: 'needs_bid'
          })
        }
      }

      // Show trade if it has bids, uncovered items, or any takeoff items (even if no bids)
      const tradeTakeoffItems = takeoffItems.filter(item => {
        const itemCategory = normalizeCategory(item.category)
        return itemCategory === tradeCategory
      })
      
      // If no bids but has takeoff items, show all items as "Needs Bid"
      if (bidRows.length === 0 && tradeTakeoffItems.length > 0) {
        const filteredItems = searchQuery
          ? tradeTakeoffItems.filter(item =>
              item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.category?.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : tradeTakeoffItems

        if (filteredItems.length > 0) {
          const allItemsAsNeedsBid: GroupedRow[] = filteredItems.map(item => ({
            type: 'item',
            id: `uncovered-${item.id}`,
            name: item.description || 'Item',
            data: item,
            total: calculateItemCost(item),
            quantity: item.quantity,
            expanded: false,
            level: 2,
            tradeCategory,
            status: 'needs_bid'
          }))

          bidRows.push({
            type: 'bid',
            id: `needs-bid-${tradeCategory}`,
            name: 'Needs Bid',
            total: tradeTakeoffItems.reduce((sum, item) => sum + calculateItemCost(item), 0),
            expanded: expandedBids.has(`needs-bid-${tradeCategory}`),
            level: 1,
            tradeCategory,
            children: allItemsAsNeedsBid,
            status: 'needs_bid'
          })
        }
      }

      // Show trade if it has any rows (bids or needs bid items)
      if (bidRows.length > 0) {
        rows.push({
          type: 'trade',
          id: tradeId,
          name: categoryName,
          total: tradeTotal,
          expanded: tradeExpanded,
          level: 0,
          tradeCategory,
          children: bidRows
        })
      }
    })

    return rows
  }, [bidsByTrade, takeoffItems, expandedTrades, expandedBids, searchQuery, matchTakeoffItemsToBids, getUncoveredItems, calculateItemCost])

  // Calculate overall totals
  const overallTotal = useMemo(() => {
    return acceptedBids.reduce((sum, bid) => sum + (bid.bid_amount || 0), 0)
  }, [acceptedBids])

  const totalTakeoffEstimate = useMemo(() => {
    return takeoffItems.reduce((sum, item) => sum + calculateItemCost(item), 0)
  }, [takeoffItems, calculateItemCost])

  const coveragePercentage = useMemo(() => {
    if (totalTakeoffEstimate === 0) return 0
    return Math.round((overallTotal / totalTakeoffEstimate) * 100)
  }, [overallTotal, totalTakeoffEstimate])

  // Toggle trade expansion
  const toggleTrade = useCallback((tradeId: string) => {
    setExpandedTrades(prev => {
      const next = new Set(prev)
      if (next.has(tradeId)) {
        next.delete(tradeId)
      } else {
        next.add(tradeId)
      }
      return next
    })
  }, [])

  // Toggle bid expansion
  const toggleBid = useCallback((bidId: string) => {
    setExpandedBids(prev => {
      const next = new Set(prev)
      if (next.has(bidId)) {
        next.delete(bidId)
      } else {
        next.add(bidId)
      }
      return next
    })
  }, [])

  // Expand/Collapse all
  const expandAll = useCallback(() => {
    const allTrades = new Set(groupedRows.map(row => row.id))
    const allBids = new Set<string>()
    groupedRows.forEach(trade => {
      trade.children?.forEach(bid => {
        if (bid.id) allBids.add(bid.id)
      })
    })
    setExpandedTrades(allTrades)
    setExpandedBids(allBids)
  }, [groupedRows])

  const collapseAll = useCallback(() => {
    setExpandedTrades(new Set())
    setExpandedBids(new Set())
  }, [])

  // Export data
  const exportData = useCallback(() => {
    const exportItems: any[] = []
    
    groupedRows.forEach(trade => {
      trade.children?.forEach(bid => {
        if (bid.type === 'bid' && bid.children) {
          bid.children.forEach(item => {
            if (item.type === 'item' && item.data) {
              const takeoffItem = item.data as TakeoffItem
              exportItems.push({
                Trade: trade.name,
                Bidder: bid.name,
                Status: item.status === 'covered' ? 'Covered' : 'Needs Bid',
                Description: takeoffItem.description,
                Quantity: takeoffItem.quantity,
                Unit: takeoffItem.unit,
                'Unit Cost': takeoffItem.unit_cost,
                'Total Cost': item.total
              })
            }
          })
        }
      })
    })
    
    return exportItems
  }, [groupedRows])

  // Render row
  const renderRow = useCallback((row: GroupedRow) => {
    const config = row.tradeCategory ? CATEGORY_CONFIG[row.tradeCategory] : null

    if (row.type === 'trade') {
      const isExpanded = expandedTrades.has(row.id)
      return (
        <React.Fragment key={row.id}>
          <tr
            ref={(el) => {
              if (el) tradeRefs.current[row.id] = el
            }}
            className={`group cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200`}
            onClick={() => toggleTrade(row.id)}
          >
            <td colSpan={10} className="p-0">
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
                    {(() => {
                      const acceptedBidsCount = row.children?.filter(child => child.status !== 'needs_bid').length || 0
                      const needsBidCount = row.children?.filter(child => child.status === 'needs_bid').length || 0
                      if (acceptedBidsCount > 0 && needsBidCount > 0) {
                        return `${acceptedBidsCount} Accepted, ${needsBidCount} Needs Bid`
                      } else if (acceptedBidsCount > 0) {
                        return `${acceptedBidsCount} Accepted ${acceptedBidsCount === 1 ? 'Bid' : 'Bids'}`
                      } else if (needsBidCount > 0) {
                        return 'Needs Bid'
                      }
                      return '0 Bids'
                    })()}
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

    if (row.type === 'bid') {
      const tradeId = `trade-${row.tradeCategory}`
      if (!expandedTrades.has(tradeId)) {
        return null
      }

      const isExpanded = expandedBids.has(row.id)
      const isNeedsBid = row.status === 'needs_bid'
      
      return (
        <React.Fragment key={row.id}>
          <tr
            className={`border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors group ${isNeedsBid ? 'bg-yellow-50/50' : 'bg-gray-50/50'}`}
            onClick={(e) => {
              e.stopPropagation()
              if (!isNeedsBid && row.bidId && onBidClick) {
                // Open bid in modal
                onBidClick(row.bidId)
              } else {
                // Just expand/collapse
                toggleBid(row.id)
              }
            }}
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
            <td colSpan={3} className="py-2 px-4">
              <span className={`font-medium text-sm flex items-center gap-2 ${isNeedsBid ? 'text-yellow-700' : 'text-gray-700'}`}>
                {isNeedsBid && <XCircle className="h-4 w-4 text-yellow-600" />}
                {!isNeedsBid && row.bidId && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {row.name}
                {!isNeedsBid && row.data && (row.data as AcceptedBid).accepted_at && (
                  <span className="text-xs text-gray-400 font-normal">
                    ({new Date((row.data as AcceptedBid).accepted_at).toLocaleDateString()})
                  </span>
                )}
              </span>
            </td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4"></td>
            <td className="py-2 px-4 text-right font-medium text-gray-700 text-sm">{formatCurrency(row.total)}</td>
            <td className="py-2 px-4">
              {isNeedsBid ? (
                <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50">
                  Needs Bid
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                  Covered
                </Badge>
              )}
            </td>
            <td className="py-2 px-4">
              {isNeedsBid && onViewBidsForTrade && row.tradeCategory ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 border-orange-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewBidsForTrade(row.tradeCategory!)
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Bids
                </Button>
              ) : !isNeedsBid && row.bidId && onBidClick ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onBidClick(row.bidId!)
                  }}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
              ) : null}
            </td>
          </tr>
          {isExpanded && row.children?.map(child => renderRow(child))}
        </React.Fragment>
      )
    }

    // Item row
    if (!row.tradeCategory) {
      return null
    }
    
    const tradeId = `trade-${row.tradeCategory}`
    const bidId = row.bidId ? `bid-${row.bidId}` : `needs-bid-${row.tradeCategory}`
    
    const tradeExpanded = expandedTrades.has(tradeId)
    const bidExpanded = expandedBids.has(bidId)
    
    if (!tradeExpanded || !bidExpanded) {
      return null
    }

    const item = row.data as TakeoffItem
    const itemCost = calculateItemCost(item)
    const isUncovered = row.status === 'needs_bid'

    return (
      <tr
        key={row.id}
        className={`group border-b border-gray-50 hover:bg-orange-50/30 transition-colors ${isUncovered ? 'bg-yellow-50/20' : 'bg-white'}`}
      >
        <td className="py-2 px-4 border-l border-gray-100"></td>
        <td className="py-2 px-4 text-sm font-medium text-gray-900">
          {item.description || 'Item'}
        </td>
        <td className="py-2 px-4 text-sm text-gray-500">—</td>
        <td className="py-2 px-4 text-sm text-gray-600 truncate max-w-[300px]">
          {item.category}
        </td>
        <td className="py-2 px-4 text-right text-sm font-mono text-gray-700">
          {item.quantity.toLocaleString()}
        </td>
        <td className="py-2 px-4 text-sm text-gray-500">
          {item.unit || '—'}
        </td>
        <td className="py-2 px-4 text-right text-sm font-mono text-gray-600">
          {item.unit_cost !== undefined ? formatCurrency(item.unit_cost) : '—'}
        </td>
        <td className="py-2 px-4 text-right font-medium text-gray-900 text-sm font-mono">{formatCurrency(itemCost)}</td>
        <td className="py-2 px-4">
          {isUncovered ? (
            <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50">
              Needs Bid
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
              Covered
            </Badge>
          )}
        </td>
        <td className="py-2 px-4"></td>
      </tr>
    )
  }, [
    expandedTrades,
    expandedBids,
    toggleTrade,
    toggleBid,
    calculateItemCost,
    formatCurrency,
    onBidClick
  ])

  return (
    <div className="space-y-4">
      {/* Header with totals and controls */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-50/50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              <h3 className="font-bold text-lg text-orange-900">Total Budget</h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-900">{formatCurrency(overallTotal)}</div>
              <div className="text-xs text-orange-600">{acceptedBids.length} accepted {acceptedBids.length === 1 ? 'bid' : 'bids'}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(totalTakeoffEstimate)}</div>
              <div className="text-xs text-blue-600">Takeoff Estimate</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-900">{coveragePercentage}%</div>
              <div className="text-xs text-green-600">Coverage</div>
            </div>
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
          <Button variant="outline" size="sm" onClick={expandAll}>
            <Expand className="h-4 w-4 mr-1" /> Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <Minimize2 className="h-4 w-4 mr-1" /> Collapse All
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(exportData())}>
            <FileText className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToExcel(exportData())}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Item Name</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Cost Code</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[150px]">Category</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Quantity</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Unit</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Unit Cost</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Total Cost</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Status</th>
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

      {groupedRows.length === 0 && takeoffItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            No takeoff items found. Run a takeoff analysis to see items in the budget view.
          </p>
        </div>
      )}
    </div>
  )
}

