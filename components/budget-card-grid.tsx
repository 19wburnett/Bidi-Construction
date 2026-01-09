'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { DndContext, DragOverlay, closestCenter, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { DollarSign, CheckCircle2, AlertCircle, Loader2, Search, Filter, ArrowUpDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import BudgetTradeCard from '@/components/budget-trade-card'
import BudgetBidPanel from '@/components/budget-bid-panel'

interface Bid {
  id: string
  bid_amount: number | null
  status: string | null
  accepted_at?: string | null
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

interface BudgetCardGridProps {
  acceptedBids: Bid[]
  takeoffItems: TakeoffItem[]
  allBids: Bid[]
  onBidClick?: (bidId: string) => void
  onViewBidsForTrade?: (tradeCategory: string) => void
  onCreateBidPackage?: (tradeCategory: string) => void
  onBidAccepted?: () => void // Callback to refresh data after bid acceptance
  jobId?: string
  bidPackages?: Array<{ trade_category: string }>
}

export default function BudgetCardGrid({
  acceptedBids,
  takeoffItems,
  allBids,
  onBidClick,
  onViewBidsForTrade,
  onCreateBidPackage,
  onBidAccepted,
  jobId,
  bidPackages = []
}: BudgetCardGridProps) {
  // State for bid assignments (local, not persisted until confirmed)
  const [bidAssignments, setBidAssignments] = useState<Record<string, string>>({}) // tradeCategory -> bidId
  const [confirmingBids, setConfirmingBids] = useState<Set<string>>(new Set()) // bidIds being confirmed
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'has_bids' | 'has_assigned' | 'needs_bid'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'has_bids' | 'has_assigned' | 'needs_bid'>('name')
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const [savingAssignments, setSavingAssignments] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Get bid trade category
  const getBidTradeCategory = useCallback((bid: Bid): string => {
    return bid.subcontractors?.trade_category || 
           bid.gc_contacts?.trade_category || 
           bid.bid_packages?.trade_category || 
           'Other'
  }, [])

  // Load budget assignments from API
  const loadBudgetAssignments = useCallback(async () => {
    if (!jobId) return

    setLoadingAssignments(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/budget-assignments`)
      if (!response.ok) {
        console.error('Failed to load budget assignments')
        return
      }

      const data = await response.json()
      const assignments: Array<{ trade_category: string; bid_id: string; is_confirmed: boolean }> = data.assignments || []

      // Convert to local state format (only non-confirmed assignments)
      const localAssignments: Record<string, string> = {}
      assignments.forEach(assignment => {
        // Only load non-confirmed assignments (confirmed ones are in acceptedBids)
        if (!assignment.is_confirmed) {
          localAssignments[assignment.trade_category] = assignment.bid_id
        }
      })

      setBidAssignments(localAssignments)
    } catch (error) {
      console.error('Error loading budget assignments:', error)
    } finally {
      setLoadingAssignments(false)
    }
  }, [jobId])

  // Save budget assignments to API (debounced)
  const saveBudgetAssignments = useCallback(async () => {
    if (!jobId) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce save by 500ms
    saveTimeoutRef.current = setTimeout(async () => {
      setSavingAssignments(true)
      try {
        // Convert assignments to API format
        const assignments = Object.entries(bidAssignments).map(([tradeCategory, bidId]) => ({
          trade_category: tradeCategory,
          bid_id: bidId,
          is_confirmed: false // Only save non-confirmed assignments
        }))

        const response = await fetch(`/api/jobs/${jobId}/budget-assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments })
        })

        if (!response.ok) {
          console.error('Failed to save budget assignments')
        }
      } catch (error) {
        console.error('Error saving budget assignments:', error)
      } finally {
        setSavingAssignments(false)
      }
    }, 500)
  }, [jobId, bidAssignments])

  // Load assignments on mount
  useEffect(() => {
    loadBudgetAssignments()
  }, [loadBudgetAssignments])

  // Save assignments when they change
  useEffect(() => {
    if (!loadingAssignments) {
      saveBudgetAssignments()
    }
  }, [bidAssignments, loadingAssignments, saveBudgetAssignments])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Group takeoff items by trade (use subcontractor field, fallback to category)
  const tradeGroups = useMemo(() => {
    const groups: Record<string, TakeoffItem[]> = {}
    
    takeoffItems.forEach(item => {
      const trade = item.subcontractor || item.category || 'Other'
      if (!groups[trade]) {
        groups[trade] = []
      }
      groups[trade].push(item)
    })
    
    return groups
  }, [takeoffItems])

  // Get all unique trades (from takeoff items and bid packages)
  const allTrades = useMemo(() => {
    const trades = new Set<string>()
    
    // Add trades from takeoff items
    Object.keys(tradeGroups).forEach(trade => trades.add(trade))
    
    // Add trades from bid packages
    bidPackages.forEach(pkg => {
      if (pkg.trade_category) {
        trades.add(pkg.trade_category)
      }
    })
    
    return Array.from(trades).sort()
  }, [tradeGroups, bidPackages])

  // Get bids by trade category
  const bidsByTrade = useMemo(() => {
    const grouped: Record<string, Bid[]> = {}
    
    allBids.forEach(bid => {
      const tradeCategory = getBidTradeCategory(bid)
      if (!grouped[tradeCategory]) {
        grouped[tradeCategory] = []
      }
      grouped[tradeCategory].push(bid)
    })
    
    return grouped
  }, [allBids, getBidTradeCategory])

  // Get accepted bids by trade
  const acceptedBidsByTrade = useMemo(() => {
    const grouped: Record<string, Bid> = {}
    
    acceptedBids.forEach(bid => {
      const tradeCategory = getBidTradeCategory(bid)
      // If multiple accepted bids for same trade, use the most recent
      if (!grouped[tradeCategory] || 
          (bid.accepted_at && grouped[tradeCategory].accepted_at && 
           new Date(bid.accepted_at) > new Date(grouped[tradeCategory].accepted_at!))) {
        grouped[tradeCategory] = bid
      }
    })
    
    return grouped
  }, [acceptedBids, getBidTradeCategory])

  // Get assigned bid for a trade
  const getAssignedBid = useCallback((tradeCategory: string): Bid | null => {
    // First check if there's an accepted bid for this trade
    if (acceptedBidsByTrade[tradeCategory]) {
      return acceptedBidsByTrade[tradeCategory]
    }
    
    // Then check if there's an assigned (but not confirmed) bid
    const assignedBidId = bidAssignments[tradeCategory]
    if (assignedBidId) {
      return allBids.find(b => b.id === assignedBidId) || null
    }
    
    return null
  }, [acceptedBidsByTrade, bidAssignments, allBids])

  // Helper function to check if a trade has bids
  const tradeHasBids = useCallback((tradeCategory: string): boolean => {
    return (bidsByTrade[tradeCategory]?.length || 0) > 0
  }, [bidsByTrade])

  // Helper function to check if a trade has an assigned bid
  const tradeHasAssignedBid = useCallback((tradeCategory: string): boolean => {
    return !!getAssignedBid(tradeCategory)
  }, [getAssignedBid])

  // Helper function to check if a trade needs a bid
  const tradeNeedsBid = useCallback((tradeCategory: string): boolean => {
    return !tradeHasBids(tradeCategory) && !tradeHasAssignedBid(tradeCategory)
  }, [tradeHasBids, tradeHasAssignedBid])

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let filtered = [...allTrades]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(tradeCategory => {
        // Search in trade name
        if (tradeCategory.toLowerCase().includes(query)) {
          return true
        }
        
        // Search in takeoff items
        const tradeItems = tradeGroups[tradeCategory] || []
        const matchesItem = tradeItems.some(item => 
          item.description?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query)
        )
        
        if (matchesItem) {
          return true
        }
        
        // Search in assigned bid
        const assignedBid = getAssignedBid(tradeCategory)
        if (assignedBid) {
          const bidName = assignedBid.subcontractors?.name || assignedBid.gc_contacts?.name || ''
          if (bidName.toLowerCase().includes(query)) {
            return true
          }
        }
        
        return false
      })
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(tradeCategory => {
        switch (filterStatus) {
          case 'has_bids':
            return tradeHasBids(tradeCategory)
          case 'has_assigned':
            return tradeHasAssignedBid(tradeCategory)
          case 'needs_bid':
            return tradeNeedsBid(tradeCategory)
          default:
            return true
        }
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.localeCompare(b)
        case 'has_bids':
          const aHasBids = tradeHasBids(a)
          const bHasBids = tradeHasBids(b)
          if (aHasBids === bHasBids) return a.localeCompare(b)
          return aHasBids ? -1 : 1
        case 'has_assigned':
          const aHasAssigned = tradeHasAssignedBid(a)
          const bHasAssigned = tradeHasAssignedBid(b)
          if (aHasAssigned === bHasAssigned) return a.localeCompare(b)
          return aHasAssigned ? -1 : 1
        case 'needs_bid':
          const aNeedsBid = tradeNeedsBid(a)
          const bNeedsBid = tradeNeedsBid(b)
          if (aNeedsBid === bNeedsBid) return a.localeCompare(b)
          return aNeedsBid ? -1 : 1
        default:
          return a.localeCompare(b)
      }
    })

    return filtered
  }, [allTrades, searchQuery, filterStatus, sortBy, tradeGroups, getAssignedBid, tradeHasBids, tradeHasAssignedBid, tradeNeedsBid])

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  // Handle drag end (bid assignment)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)

    if (!over) return

    // Extract bid ID from drag data
    const activeData = active.data.current
    if (!activeData || activeData.type !== 'bid' || !activeData.bid) return

    const bidId = activeData.bid.id
    const dropZone = over.id as string

      if (dropZone.startsWith('trade-drop-')) {
        // Extract trade category from drop zone ID
        const tradeCategory = dropZone.replace('trade-drop-', '')
        
        // Assign bid to trade (will auto-save via useEffect)
        setBidAssignments(prev => ({
          ...prev,
          [tradeCategory]: bidId
        }))
      }
  }

  // Handle bid unassignment
  const handleBidUnassigned = useCallback((tradeCategory: string) => {
    setBidAssignments(prev => {
      const next = { ...prev }
      delete next[tradeCategory]
      return next
    })
    // Save will be triggered by useEffect
  }, [])

  // Handle bid confirmation (accept bid)
  const handleBidConfirm = useCallback(async (tradeCategory: string, confirmed: boolean) => {
    const assignedBidId = bidAssignments[tradeCategory]
    if (!assignedBidId) return

    setConfirmingBids(prev => new Set(prev).add(assignedBidId))

    try {
      if (confirmed) {
        // Accept the bid
        const response = await fetch('/api/bids/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bidId: assignedBidId })
        })

        if (!response.ok) {
          throw new Error('Failed to accept bid')
        }

        // Remove from assignments since it's now accepted
        const updatedAssignments = { ...bidAssignments }
        delete updatedAssignments[tradeCategory]
        setBidAssignments(updatedAssignments)

        // Save updated assignments immediately (without the confirmed one)
        if (jobId) {
          const assignments = Object.entries(updatedAssignments).map(([tc, bidId]) => ({
            trade_category: tc,
            bid_id: bidId,
            is_confirmed: false
          }))

          await fetch(`/api/jobs/${jobId}/budget-assignments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignments })
          })
        }

        // Refresh data via callback or reload page
        if (onBidAccepted) {
          onBidAccepted()
        } else {
          // Fallback to page reload if no callback provided
          window.location.reload()
        }
      } else {
        // Unassign (just remove from local state)
        handleBidUnassigned(tradeCategory)
      }
    } catch (error) {
      console.error('Error confirming bid:', error)
      alert('Failed to accept bid. Please try again.')
    } finally {
      setConfirmingBids(prev => {
        const next = new Set(prev)
        next.delete(assignedBidId)
        return next
      })
    }
  }, [bidAssignments, handleBidUnassigned, jobId, onBidAccepted])


  // Check if bid is confirmed (accepted)
  const isBidConfirmed = useCallback((tradeCategory: string): boolean => {
    return !!acceptedBidsByTrade[tradeCategory]
  }, [acceptedBidsByTrade])

  // Calculate budget totals
  const budgetTotals = useMemo(() => {
    const confirmedTotal = acceptedBids.reduce((sum, bid) => 
      sum + (bid.bid_amount || 0), 0
    )
    
    const assignedTotal = Object.values(bidAssignments).reduce((sum, bidId) => {
      const bid = allBids.find(b => b.id === bidId)
      return sum + (bid?.bid_amount || 0)
    }, 0)
    
    return {
      confirmed: confirmedTotal,
      assigned: assignedTotal,
      total: confirmedTotal + assignedTotal
    }
  }, [acceptedBids, bidAssignments, allBids])

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Get dragged bid for overlay
  const draggedBid = useMemo(() => {
    if (!activeDragId || !activeDragId.toString().startsWith('bid-')) return null
    const bidId = activeDragId.toString().replace('bid-', '')
    return allBids.find(b => b.id === bidId) || null
  }, [activeDragId, allBids])

  // Get bids that are already assigned or confirmed (to exclude from available bids)
  const usedBidIds = useMemo(() => {
    const used = new Set<string>()
    
    // Add all accepted bids
    acceptedBids.forEach(bid => used.add(bid.id))
    
    // Add all assigned bids (even if not confirmed)
    Object.values(bidAssignments).forEach(bidId => used.add(bidId))
    
    return used
  }, [acceptedBids, bidAssignments])

  // Filter out used bids from available bids
  const availableBids = useMemo(() => {
    return allBids.filter(bid => !usedBidIds.has(bid.id))
  }, [allBids, usedBidIds])

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Budget Summary */}
        <Card className="bg-gradient-to-r from-orange-50 to-orange-50/50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              Budget Summary
            </CardTitle>
            <CardDescription>
              Confirmed bids and assigned bids for your budget
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-green-900">
                  {formatCurrency(budgetTotals.confirmed)}
                </div>
                <div className="text-sm text-gray-600 mt-1">Confirmed Budget</div>
                <Badge variant="outline" className="mt-2 border-green-300 text-green-700 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {acceptedBids.length} {acceptedBids.length === 1 ? 'Bid' : 'Bids'} Accepted
                </Badge>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-orange-900">
                  {formatCurrency(budgetTotals.assigned)}
                </div>
                <div className="text-sm text-gray-600 mt-1">Assigned (Not Confirmed)</div>
                <Badge variant="outline" className="mt-2 border-orange-300 text-orange-700 bg-orange-50">
                  {Object.keys(bidAssignments).length} {Object.keys(bidAssignments).length === 1 ? 'Bid' : 'Bids'} Assigned
                </Badge>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-2xl font-bold text-blue-900">
                  {formatCurrency(budgetTotals.total)}
                </div>
                <div className="text-sm text-gray-600 mt-1">Total Budget</div>
                <Badge variant="outline" className="mt-2 border-blue-300 text-blue-700 bg-blue-50">
                  {allTrades.length} {allTrades.length === 1 ? 'Trade' : 'Trades'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content - List Layout */}
        <div className="flex gap-6 relative">
          {/* Trade Cards List */}
          <div className="flex-1">
            {/* Search Bar and Filters - Sticky */}
            <div className="sticky top-0 z-20 mb-4 bg-white pb-4 pt-0 -mt-4 space-y-3">
              <Input
                placeholder="Search trades, items, or bids..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
                className="pr-3 shadow-sm"
              />
              
              {/* Filter and Sort Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-status" className="text-xs text-gray-600 flex items-center gap-1.5">
                    <Filter className="h-3 w-3" />
                    Filter
                  </Label>
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as typeof filterStatus)}>
                    <SelectTrigger id="filter-status" className="h-9 text-sm">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="has_bids">Has Bids</SelectItem>
                      <SelectItem value="has_assigned">Has Assigned Bid</SelectItem>
                      <SelectItem value="needs_bid">Needs Bid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="sort-by" className="text-xs text-gray-600 flex items-center gap-1.5">
                    <ArrowUpDown className="h-3 w-3" />
                    Sort
                  </Label>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                    <SelectTrigger id="sort-by" className="h-9 text-sm">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="has_bids">Has Bids First</SelectItem>
                      <SelectItem value="has_assigned">Assigned First</SelectItem>
                      <SelectItem value="needs_bid">Needs Bid First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {allTrades.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600 mb-4">
                    No takeoff items found. Run a takeoff analysis to see items in the budget view.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Navigate to takeoff tab or trigger takeoff
                      window.location.hash = '#takeoff'
                    }}
                  >
                    Go to Takeoff
                  </Button>
                </CardContent>
              </Card>
            ) : filteredTrades.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600">
                    No trades found matching "{searchQuery}"
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredTrades.map(tradeCategory => {
                  const tradeItems = tradeGroups[tradeCategory] || []
                  const assignedBid = getAssignedBid(tradeCategory)
                  const isConfirmed = isBidConfirmed(tradeCategory)
                  const availableBids = bidsByTrade[tradeCategory] || []
                  const isConfirming = assignedBid ? confirmingBids.has(assignedBid.id) : false

                  return (
                    <BudgetTradeCard
                      key={tradeCategory}
                      tradeName={tradeCategory}
                      tradeCategory={tradeCategory}
                      takeoffItems={tradeItems}
                      assignedBid={assignedBid}
                      isConfirmed={isConfirmed}
                      isConfirming={isConfirming}
                      availableBidsCount={availableBids.length}
                      onBidAssigned={(bidId) => {
                        setBidAssignments(prev => ({
                          ...prev,
                          [tradeCategory]: bidId
                        }))
                      }}
                      onBidUnassigned={() => handleBidUnassigned(tradeCategory)}
                      onConfirm={(confirmed) => handleBidConfirm(tradeCategory, confirmed)}
                      onViewBids={() => onViewBidsForTrade?.(tradeCategory)}
                      onCreateBidPackage={() => onCreateBidPackage?.(tradeCategory)}
                      onBidClick={onBidClick}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Available Bids Panel - Sticky */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-4">
              <BudgetBidPanel
                bids={availableBids}
                onBidClick={onBidClick}
              />
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedBid ? (
            <Card className="bg-white border-2 border-orange-400 shadow-xl p-4 min-w-[200px]">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-600" />
                <div>
                  <div className="font-semibold text-sm">
                    {draggedBid.subcontractors?.name || draggedBid.gc_contacts?.name || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-600">
                    {formatCurrency(draggedBid.bid_amount || 0)}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

