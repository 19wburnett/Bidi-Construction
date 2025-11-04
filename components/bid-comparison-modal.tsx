'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  MapPin,
  Clock,
  Trash2,
  Copy,
  X,
  CheckSquare,
  Square,
  GitCompare
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { modalBackdrop, modalContent, staggerContainer, staggerItem } from '@/lib/animations'

interface BidComparisonModalProps {
  jobId: string
  isOpen: boolean
  onClose: () => void
}

interface Bid {
  id: string
  subcontractor_id: string | null
  subcontractor_email: string
  bid_amount: number | null
  timeline: string | null
  notes: string | null
  ai_summary: string | null
  raw_email: string
  created_at: string
  status: string
  subcontractors: {
    id: string
    name: string
    email: string
    phone: string | null
    website_url: string | null
    google_review_score: number | null
    google_reviews_link: string | null
  } | null
}

interface BidLineItem {
  id: string
  item_number: number
  description: string
  category: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
}

interface TakeoffItem {
  id: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number | null
}

export default function BidComparisonModal({ 
  jobId, 
  isOpen, 
  onClose 
}: BidComparisonModalProps) {
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [bidLineItems, setBidLineItems] = useState<BidLineItem[]>([])
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([])
  const [selectedTakeoffItemIds, setSelectedTakeoffItemIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showComparison, setShowComparison] = useState(false)
  
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && jobId) {
      loadData()
    }
  }, [isOpen, jobId])

  async function loadData() {
    setLoading(true)
    setError('')
    
    try {
      // Load bids for this job with subcontractor information joined
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          *,
          subcontractors (
            id,
            name,
            email,
            phone,
            website_url,
            google_review_score,
            google_reviews_link
          )
        `)
        .or(`job_id.eq.${jobId},job_request_id.eq.${jobId}`)
        .order('created_at', { ascending: false })

      if (bidsError) throw bidsError
      setBids(bidsData || [])

      // Load takeoff items from plans in this job
      const { data: plansData } = await supabase
        .from('plans')
        .select('id, takeoff_analysis_status')
        .eq('job_id', jobId)

      if (plansData && plansData.length > 0) {
        const planWithTakeoff = plansData.find(p => p.takeoff_analysis_status === 'completed')
        if (planWithTakeoff) {
          const { data: takeoffData } = await supabase
            .from('plan_takeoff_analysis')
            .select('items')
            .eq('plan_id', planWithTakeoff.id)
            .single()

          if (takeoffData && takeoffData.items) {
            setTakeoffItems(takeoffData.items)
            // Select all items by default
            setSelectedTakeoffItemIds(new Set(takeoffData.items.map((item: TakeoffItem) => item.id)))
          }
        }
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load bids')
    } finally {
      setLoading(false)
    }
  }

  async function loadBidLineItems(bidId: string) {
    try {
      const { data, error: itemsError } = await supabase
        .from('bid_line_items')
        .select('*')
        .eq('bid_id', bidId)
        .order('item_number', { ascending: true })

      if (itemsError) throw itemsError
      setBidLineItems(data || [])
    } catch (err) {
      console.error('Error loading bid line items:', err)
    }
  }

  useEffect(() => {
    if (selectedBidId) {
      loadBidLineItems(selectedBidId)
      // Reset comparison when bid changes
      setShowComparison(false)
    }
  }, [selectedBidId])

  const selectedBid = bids.find(b => b.id === selectedBidId)

  // Calculate discrepancies between takeoff and bid
  const calculateDiscrepancies = () => {
    if (!selectedBid || takeoffItems.length === 0 || bidLineItems.length === 0 || !showComparison) {
      return []
    }

    // Filter to only selected takeoff items
    const selectedTakeoffItems = takeoffItems.filter(item => selectedTakeoffItemIds.has(item.id))
    
    if (selectedTakeoffItems.length === 0) {
      return []
    }

    const discrepancies: Array<{
      type: 'missing' | 'quantity' | 'price'
      takeoffItem?: TakeoffItem
      bidItem?: BidLineItem
      difference?: number
      percentage?: number
    }> = []

    // Check for missing items
    selectedTakeoffItems.forEach(takeoffItem => {
      const matchingBidItem = bidLineItems.find(bidItem => 
        bidItem.description.toLowerCase().includes(takeoffItem.description.toLowerCase()) ||
        takeoffItem.description.toLowerCase().includes(bidItem.description.toLowerCase())
      )

      if (!matchingBidItem) {
        discrepancies.push({
          type: 'missing',
          takeoffItem
        })
      } else {
        // Check quantity differences (more than 20%)
        if (matchingBidItem.quantity && takeoffItem.quantity) {
          const quantityDiff = Math.abs(matchingBidItem.quantity - takeoffItem.quantity)
          const percentage = (quantityDiff / takeoffItem.quantity) * 100
          
          if (percentage > 20) {
            discrepancies.push({
              type: 'quantity',
              takeoffItem,
              bidItem: matchingBidItem,
              difference: quantityDiff,
              percentage
            })
          }
        }

        // Check price differences (more than 15%)
        if (matchingBidItem.unit_price && takeoffItem.unit_cost) {
          const priceDiff = Math.abs(matchingBidItem.unit_price - takeoffItem.unit_cost)
          const percentage = (priceDiff / takeoffItem.unit_cost) * 100
          
          if (percentage > 15) {
            discrepancies.push({
              type: 'price',
              takeoffItem,
              bidItem: matchingBidItem,
              difference: priceDiff,
              percentage
            })
          }
        }
      }
    })

    return discrepancies
  }

  const discrepancies = calculateDiscrepancies()

  if (!isOpen) return null

  return (
    <motion.div
      variants={modalBackdrop}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
      style={{ pointerEvents: 'auto' }}
    >
      <motion.div
        variants={modalContent}
        initial="initial"
        animate="animate"
        exit="exit"
        className="bg-white rounded-lg shadow-xl max-w-6xl w-[95vw] md:w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
                 <Card className="border-0 shadow-none flex-1 flex flex-col max-h-[90vh]">
           <CardHeader className="flex-shrink-0 border-b">
             <div className="flex items-center justify-between">
               <div>
                 <CardTitle className="flex items-center">
                   <FileText className="h-5 w-5 mr-2 text-orange-600" />
                   View & Compare Bids
                 </CardTitle>
                 <CardDescription>
                   Compare bids against your takeoff analysis
                 </CardDescription>
               </div>
               <Button variant="ghost" size="sm" onClick={onClose}>
                 ×
               </Button>
             </div>
           </CardHeader>
           
           <CardContent className="flex-1 overflow-y-auto flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-600">Loading bids...</p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-red-600">{error}</p>
              </div>
            ) : bids.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64">
                <FileText className="h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bids Yet</h3>
                <p className="text-gray-600">No bids have been received for this job.</p>
              </div>
            ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                 {/* Left: Bids List */}
                 <div className="border-r-0 md:border-r pr-0 md:pr-4 overflow-y-auto min-h-0">
                  <h3 className="font-semibold mb-3">Bids ({bids.length})</h3>
                  <div className="space-y-3">
                    {bids.map((bid) => (
                      <motion.div
                        key={bid.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card 
                          className={`cursor-pointer transition-all ${
                            selectedBidId === bid.id 
                              ? 'border-orange-500 bg-orange-50' 
                              : 'hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedBidId(bid.id)}
                        >
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-gray-900">
                                  {bid.subcontractors?.name || bid.subcontractor_email || 'Unknown'}
                                </h4>
                                <p className="text-sm text-gray-600">{bid.subcontractors?.email || bid.subcontractor_email}</p>
                              </div>
                              {bid.status && (
                                <Badge variant={bid.status === 'accepted' ? 'default' : 'outline'}>
                                  {bid.status}
                                </Badge>
                              )}
                            </div>
                            
                            {bid.bid_amount && (
                              <div className="text-2xl font-bold text-green-600">
                                ${bid.bid_amount.toLocaleString()}
                              </div>
                            )}
                            
                            {bid.subcontractors?.google_review_score && (
                              <div className="flex items-center text-sm text-gray-600">
                                ⭐ {bid.subcontractors.google_review_score}
                                {bid.subcontractors.google_reviews_link && (
                                  <span className="ml-1">(see reviews)</span>
                                )}
                              </div>
                            )}
                            
                            {bid.timeline && (
                              <div className="text-sm text-gray-600">
                                <Clock className="h-4 w-4 inline mr-1" />
                                {bid.timeline}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Right: Bid Details & Comparison */}
                <div className="overflow-y-auto">
                  {selectedBid ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-3">Bid Details</h3>
                        <Card>
                          <CardContent className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-sm text-gray-600">Subcontractor</p>
                                <p className="font-medium">{selectedBid.subcontractors?.name || selectedBid.subcontractor_email || 'Unknown'}</p>
                              </div>
                              {selectedBid.subcontractors?.phone && (
                                <div>
                                  <p className="text-sm text-gray-600">Phone</p>
                                  <p className="font-medium">{selectedBid.subcontractors.phone}</p>
                                </div>
                              )}
                            </div>
                            {selectedBid.subcontractors?.website_url && (
                              <div>
                                <p className="text-sm text-gray-600">Website</p>
                                <a href={selectedBid.subcontractors.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {selectedBid.subcontractors.website_url}
                                </a>
                              </div>
                            )}
                            {selectedBid.bid_amount && (
                              <div>
                                <p className="text-sm text-gray-600">Total Bid Amount</p>
                                <p className="text-2xl font-bold text-green-600">
                                  ${selectedBid.bid_amount.toLocaleString()}
                                </p>
                              </div>
                            )}
                            {selectedBid.notes && (
                              <div>
                                <p className="text-sm text-gray-600">Notes</p>
                                <p className="text-sm">{selectedBid.notes}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      {takeoffItems.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Comparison with Takeoff</h3>
                          </div>

                          {/* Takeoff Items Selection */}
                          <div className="mb-4">
                            <Card className="p-3">
                              <h4 className="font-medium mb-2 text-sm">Select Takeoff Items to Compare:</h4>
                              <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                                                                 {takeoffItems.map((item) => {
                                   const isSelected = selectedTakeoffItemIds.has(item.id)
                                   const totalCost = (item.unit_cost !== undefined && item.unit_cost !== null) ? (item.quantity * item.unit_cost) : null
                                   return (
                                    <div
                                      key={item.id}
                                      className={`flex items-center space-x-3 p-2 border rounded-lg transition-colors ${
                                        isSelected ? 'bg-orange-50 border-orange-300' : 'hover:bg-gray-50'
                                      }`}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked: boolean) => {
                                          const newSet = new Set(selectedTakeoffItemIds)
                                          if (checked) {
                                            newSet.add(item.id)
                                          } else {
                                            newSet.delete(item.id)
                                          }
                                          setSelectedTakeoffItemIds(newSet)
                                          // Reset comparison when selection changes
                                          setShowComparison(false)
                                        }}
                                      />
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{item.description}</div>
                                                                                 <div className="text-xs text-gray-600">
                                           {item.quantity} {item.unit}
                                                                                       {item.unit_cost !== undefined && item.unit_cost !== null && ` • $${(item.unit_cost ?? 0).toFixed(2)}/${item.unit}`}
                                         </div>
                                                                                 {isSelected && totalCost !== null && totalCost !== undefined && (
                                           <div className="text-xs font-semibold text-green-600 mt-1">
                                             Total: ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                           </div>
                                         )}
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {item.category}
                                      </Badge>
                                    </div>
                                  )
                                })}
                              </div>
                              
                              {/* Selected Items Summary */}
                              {selectedTakeoffItemIds.size > 0 && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <h5 className="font-semibold text-blue-900 mb-2 text-sm flex items-center">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Selected Items Summary ({selectedTakeoffItemIds.size})
                                  </h5>
                                  <div className="space-y-2 max-h-32 overflow-y-auto">
                                                                         {takeoffItems
                                       .filter(item => selectedTakeoffItemIds.has(item.id))
                                       .map((item) => {
                                         const totalCost = (item.unit_cost !== undefined && item.unit_cost !== null) ? (item.quantity * item.unit_cost) : null
                                         return (
                                           <div
                                             key={item.id}
                                             className="flex items-start justify-between p-2 bg-white rounded border border-blue-100"
                                           >
                                             <div className="flex-1">
                                               <div className="font-medium text-xs">{item.description}</div>
                                               <div className="text-xs text-gray-600 mt-1">
                                                 <span className="font-mono">{item.quantity} {item.unit}</span>
                                                                                                   {item.unit_cost !== undefined && item.unit_cost !== null && (
                                                    <>
                                                      {' × '}
                                                      <span className="font-mono">${(item.unit_cost ?? 0).toFixed(2)}</span>
                                                      {'/'}{item.unit}
                                                    </>
                                                  )}
                                               </div>
                                               <Badge variant="outline" className="text-xs mt-1">
                                                 {item.category}
                                               </Badge>
                                             </div>
                                             {totalCost !== null && totalCost !== undefined && (
                                               <div className="ml-4 text-right">
                                                 <div className="font-bold text-green-600 text-sm">
                                                   ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                 </div>
                                               </div>
                                             )}
                                           </div>
                                         )
                                       })}
                                  </div>
                                                                     <div className="mt-2 pt-2 border-t border-blue-300 flex items-center justify-between">
                                     <span className="font-semibold text-blue-900 text-sm">Grand Total:</span>
                                     <span className="text-lg font-bold text-green-600">
                                       $
                                       {takeoffItems
                                         .filter(item => selectedTakeoffItemIds.has(item.id))
                                         .reduce((sum, item) => {
                                           const totalCost = (item.unit_cost ?? 0) * item.quantity
                                           return sum + totalCost
                                         }, 0)
                                         .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                     </span>
                                   </div>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-500">
                                  {selectedTakeoffItemIds.size} of {takeoffItems.length} items selected
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (selectedTakeoffItemIds.size === takeoffItems.length) {
                                        setSelectedTakeoffItemIds(new Set())
                                      } else {
                                        setSelectedTakeoffItemIds(new Set(takeoffItems.map(item => item.id)))
                                      }
                                      setShowComparison(false)
                                    }}
                                  >
                                    {selectedTakeoffItemIds.size === takeoffItems.length ? 'Deselect All' : 'Select All'}
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                      if (selectedTakeoffItemIds.size === 0) {
                                        setError('Please select at least one takeoff item to compare')
                                        return
                                      }
                                      setShowComparison(true)
                                      setError('')
                                    }}
                                    disabled={selectedTakeoffItemIds.size === 0}
                                    className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    title={selectedTakeoffItemIds.size === 0 ? 'Please select at least one takeoff item to compare' : bidLineItems.length === 0 ? 'No bid line items available - comparison will show takeoff items only' : 'Compare selected takeoff items with bid'}
                                  >
                                    <GitCompare className="h-4 w-4 mr-2" />
                                    Compare Selected Items
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          </div>

                                                                                {showComparison && (
                             <div className="space-y-4">
                               {/* Summary Alerts */}
                               {bidLineItems.length === 0 && (
                                 <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                   <div className="flex items-center mb-2">
                                     <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                                     <span className="font-semibold text-blue-900">
                                       No Bid Line Items Available
                                     </span>
                                   </div>
                                   <p className="text-sm text-blue-800">
                                     This bid doesn't have detailed line items. Showing takeoff items only. Total bid amount: ${selectedBid?.bid_amount?.toLocaleString() || 'N/A'}
                                   </p>
                                 </div>
                               )}

                               {discrepancies.length > 0 && (
                                 <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                   <div className="flex items-center mb-2">
                                     <AlertCircle className="h-5 w-5 text-orange-600 mr-2" />
                                     <span className="font-semibold text-orange-900">
                                       {discrepancies.length} Discrepancy(ies) Detected
                                     </span>
                                   </div>
                                   <p className="text-sm text-orange-800">
                                     Major differences found between your takeoff and this bid.
                                   </p>
                                 </div>
                               )}

                               {/* Side-by-Side Comparison Table */}
                               <Card className="overflow-hidden">
                                 <CardHeader className="bg-gray-50 border-b p-4">
                                   <div className="grid grid-cols-2 gap-4">
                                     <div>
                                       <h4 className="font-semibold text-gray-900 flex items-center">
                                         <FileText className="h-4 w-4 mr-2 text-blue-600" />
                                         Your Takeoff
                                       </h4>
                                       <p className="text-xs text-gray-600 mt-1">
                                         {selectedTakeoffItemIds.size} item{selectedTakeoffItemIds.size !== 1 ? 's' : ''} selected
                                       </p>
                                     </div>
                                     <div>
                                       <h4 className="font-semibold text-gray-900 flex items-center">
                                         <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                                         Bid Line Items
                                       </h4>
                                       <p className="text-xs text-gray-600 mt-1">
                                         {bidLineItems.length} line item{bidLineItems.length !== 1 ? 's' : ''}
                                       </p>
                                     </div>
                                   </div>
                                 </CardHeader>
                                 
                                 <CardContent className="p-0">
                                   {bidLineItems.length > 0 ? (
                                     <div className="divide-y max-h-[500px] overflow-y-auto">
                                       {takeoffItems
                                         .filter(item => selectedTakeoffItemIds.has(item.id))
                                         .map((takeoffItem) => {
                                           // Find matching bid item
                                           const matchingBidItem = bidLineItems.find(bidItem => 
                                             bidItem.description.toLowerCase().includes(takeoffItem.description.toLowerCase()) ||
                                             takeoffItem.description.toLowerCase().includes(bidItem.description.toLowerCase())
                                           )
                                           
                                           // Check if this item has discrepancies
                                           const itemDiscrepancy = discrepancies.find(d => 
                                             d.takeoffItem?.id === takeoffItem.id
                                           )
                                           
                                                                                       const takeoffTotal = (takeoffItem.unit_cost ?? 0) * takeoffItem.quantity
                                            const bidTotal = matchingBidItem?.amount || 0
                                            const difference = bidTotal - takeoffTotal
                                            const hasDiscrepancy = itemDiscrepancy !== undefined
                                            
                                            return (
                                              <div
                                                key={takeoffItem.id}
                                                className={`grid grid-cols-2 gap-4 p-4 hover:bg-gray-50 transition-colors ${
                                                  hasDiscrepancy ? 'bg-orange-50/50' : 'bg-white'
                                                }`}
                                              >
                                                {/* Takeoff Item Column */}
                                                <div className="border-r pr-4">
                                                  <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                      <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-xs">
                                                          {takeoffItem.category}
                                                        </Badge>
                                                        {hasDiscrepancy && (
                                                          <Badge variant="destructive" className="text-xs">
                                                            {itemDiscrepancy.type === 'missing' && 'Missing'}
                                                            {itemDiscrepancy.type === 'quantity' && 'Qty Diff'}
                                                            {itemDiscrepancy.type === 'price' && 'Price Diff'}
                                                          </Badge>
                                                        )}
                                                      </div>
                                                      <p className="font-medium text-sm text-gray-900 mb-1">
                                                        {takeoffItem.description}
                                                      </p>
                                                                                                            <div className="text-xs text-gray-600 space-y-0.5">
                                                         <div>
                                                           <span className="font-mono">{takeoffItem.quantity}</span> {takeoffItem.unit}
                                                         </div>
                                                                                                                 {takeoffItem.unit_cost !== undefined && takeoffItem.unit_cost !== null && (
                                                          <div>
                                                            @ <span className="font-mono">${(takeoffItem.unit_cost ?? 0).toFixed(2)}</span>/{takeoffItem.unit}
                                                          </div>
                                                        )}
                                                       </div>
                                                    </div>
                                                    <div className="text-right ml-4">
                                                      {takeoffItem.unit_cost !== undefined && takeoffItem.unit_cost !== null ? (
                                                        <div className="text-lg font-bold text-blue-600">
                                                          ${takeoffTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                      ) : (
                                                        <div className="text-sm text-gray-400 italic">
                                                          No cost data
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                 {itemDiscrepancy && itemDiscrepancy.percentage && (
                                                   <div className="mt-2 text-xs text-orange-600">
                                                     {itemDiscrepancy.type === 'quantity' && (
                                                       <span>Quantity difference: {itemDiscrepancy.percentage.toFixed(1)}%</span>
                                                     )}
                                                     {itemDiscrepancy.type === 'price' && (
                                                       <span>Price difference: {itemDiscrepancy.percentage.toFixed(1)}%</span>
                                                     )}
                                                   </div>
                                                 )}
                                               </div>
                                               
                                               {/* Bid Item Column */}
                                               <div className="pl-4">
                                                 {matchingBidItem ? (
                                                   <div>
                                                     <div className="flex items-start justify-between mb-2">
                                                       <div className="flex-1">
                                                         <div className="flex items-center gap-2 mb-1">
                                                           {matchingBidItem.category && (
                                                             <Badge variant="outline" className="text-xs">
                                                               {matchingBidItem.category}
                                                             </Badge>
                                                           )}
                                                           <span className="font-mono text-xs text-gray-500">
                                                             #{matchingBidItem.item_number}
                                                           </span>
                                                         </div>
                                                         <p className="font-medium text-sm text-gray-900 mb-1">
                                                           {matchingBidItem.description}
                                                         </p>
                                                         <div className="text-xs text-gray-600 space-y-0.5">
                                                           {matchingBidItem.quantity && matchingBidItem.unit && (
                                                             <div>
                                                               <span className="font-mono">{matchingBidItem.quantity}</span> {matchingBidItem.unit}
                                                             </div>
                                                           )}
                                                                                                                       {matchingBidItem.unit_price && matchingBidItem.unit && (
                                                              <div>
                                                                @ <span className="font-mono">${(matchingBidItem.unit_price ?? 0).toFixed(2)}</span>/{matchingBidItem.unit}
                                                              </div>
                                                            )}
                                                           {matchingBidItem.notes && (
                                                             <div className="text-gray-500 italic mt-1">
                                                               {matchingBidItem.notes}
                                                             </div>
                                                           )}
                                                         </div>
                                                       </div>
                                                       <div className="text-right ml-4">
                                                         <div className={`text-lg font-bold ${
                                                           hasDiscrepancy ? 'text-orange-600' : 'text-green-600'
                                                         }`}>
                                                           ${bidTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                         </div>
                                                         {difference !== 0 && (
                                                           <div className={`text-xs mt-1 ${
                                                             difference > 0 ? 'text-red-600' : 'text-green-600'
                                                           }`}>
                                                             {difference > 0 ? '+' : ''}${difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                           </div>
                                                         )}
                                                       </div>
                                                     </div>
                                                   </div>
                                                 ) : (
                                                   <div className="flex items-center justify-center h-full min-h-[60px] text-gray-400">
                                                     <div className="text-center">
                                                       <AlertCircle className="h-6 w-6 mx-auto mb-1 text-orange-400" />
                                                       <p className="text-xs">Not found in bid</p>
                                                     </div>
                                                   </div>
                                                 )}
                                               </div>
                                             </div>
                                           )
                                         })}
                                       
                                       {/* Summary Totals */}
                                       <div className="bg-gray-50 p-4 border-t-2 border-gray-300">
                                         <div className="grid grid-cols-2 gap-4">
                                                                                       <div className="text-right pr-4">
                                              <div className="text-xs text-gray-600 mb-1">Takeoff Total</div>
                                              <div className="text-xl font-bold text-blue-600">
                                                $
                                                {takeoffItems
                                                  .filter(item => selectedTakeoffItemIds.has(item.id))
                                                  .reduce((sum, item) => sum + (item.quantity * (item.unit_cost ?? 0)), 0)
                                                  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </div>
                                            </div>
                                           <div className="pl-4">
                                             <div className="text-xs text-gray-600 mb-1">Bid Total</div>
                                             <div className="text-xl font-bold text-green-600">
                                               ${bidLineItems
                                                 .reduce((sum, item) => sum + item.amount, 0)
                                                 .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                             </div>
                                             <div className="text-xs text-gray-500 mt-1">
                                               (from {bidLineItems.length} line item{bidLineItems.length !== 1 ? 's' : ''})
                                             </div>
                                           </div>
                                         </div>
                                         {selectedBid?.bid_amount && (
                                           <div className="mt-3 pt-3 border-t border-gray-300 text-center">
                                             <div className="text-xs text-gray-600 mb-1">Overall Bid Amount</div>
                                             <div className="text-2xl font-bold text-gray-900">
                                               ${selectedBid.bid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                             </div>
                                           </div>
                                         )}
                                       </div>
                                     </div>
                                   ) : (
                                     <div className="p-8 text-center text-gray-500">
                                       <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                                       <p>No bid line items to compare.</p>
                                       <p className="text-sm mt-2">
                                         Showing {selectedTakeoffItemIds.size} selected takeoff item{selectedTakeoffItemIds.size !== 1 ? 's' : ''} only.
                                       </p>
                                     </div>
                                   )}
                                 </CardContent>
                               </Card>
                             </div>
                           )}

                          {!showComparison && selectedTakeoffItemIds.size > 0 && (
                            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                              <GitCompare className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm">Select items above and click "Compare Selected Items" to see the comparison</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600">
                      <FileText className="h-16 w-16 mb-4" />
                      <p>Select a bid to view details and comparison</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

