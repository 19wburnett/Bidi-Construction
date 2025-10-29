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
  X
} from 'lucide-react'
import { modalBackdrop, modalContent, staggerContainer, staggerItem } from '@/lib/animations'

interface BidComparisonModalProps {
  jobId: string
  isOpen: boolean
  onClose: () => void
}

interface Bid {
  id: string
  subcontractor_name: string | null
  subcontractor_email: string
  phone: string | null
  website: string | null
  google_rating: number | null
  google_review_count: number | null
  bid_amount: number | null
  timeline: string | null
  notes: string | null
  ai_summary: string | null
  raw_email: string
  created_at: string
  status: string
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
  unit_cost: number
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
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
      // Load bids for this job (bids are associated with job_requests, not jobs)
      // We need to query bids that might be associated with job_requests that belong to this job
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .eq('job_request_id', jobId)
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
    }
  }, [selectedBidId])

  const selectedBid = bids.find(b => b.id === selectedBidId)

  // Calculate discrepancies between takeoff and bid
  const calculateDiscrepancies = () => {
    if (!selectedBid || takeoffItems.length === 0 || bidLineItems.length === 0) {
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
    takeoffItems.forEach(takeoffItem => {
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
        className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="border-0 shadow-none flex-1 flex flex-col">
          <CardHeader className="flex-shrink-0">
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
          
          <CardContent className="flex-1 overflow-hidden flex flex-col">
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
              <div className="grid grid-cols-2 gap-4 h-full overflow-hidden">
                {/* Left: Bids List */}
                <div className="border-r pr-4 overflow-y-auto">
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
                                  {bid.subcontractor_name || bid.subcontractor_email}
                                </h4>
                                <p className="text-sm text-gray-600">{bid.subcontractor_email}</p>
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
                            
                            {bid.google_rating && (
                              <div className="flex items-center text-sm text-gray-600">
                                ⭐ {bid.google_rating}
                                {bid.google_review_count && (
                                  <span className="ml-1">({bid.google_review_count} reviews)</span>
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
                                <p className="font-medium">{selectedBid.subcontractor_name || selectedBid.subcontractor_email}</p>
                              </div>
                              {selectedBid.phone && (
                                <div>
                                  <p className="text-sm text-gray-600">Phone</p>
                                  <p className="font-medium">{selectedBid.phone}</p>
                                </div>
                              )}
                            </div>
                            {selectedBid.website && (
                              <div>
                                <p className="text-sm text-gray-600">Website</p>
                                <a href={selectedBid.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {selectedBid.website}
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
                          <h3 className="font-semibold mb-3">Comparison with Takeoff</h3>
                          
                          {discrepancies.length > 0 && (
                            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                              <div className="flex items-center mb-2">
                                <AlertCircle className="h-4 w-4 text-orange-600 mr-2" />
                                <span className="font-semibold text-orange-900">
                                  {discrepancies.length} Discrepancy(ies) Detected
                                </span>
                              </div>
                              <p className="text-sm text-orange-800">
                                Major differences found between your takeoff and this bid.
                              </p>
                            </div>
                          )}

                          {bidLineItems.length > 0 ? (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {bidLineItems.map((item) => (
                                <Card key={item.id} className="p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-mono text-xs text-gray-500">#{item.item_number}</span>
                                        <p className="font-medium">{item.description}</p>
                                        {item.category && (
                                          <Badge variant="outline" className="text-xs">
                                            {item.category}
                                          </Badge>
                                        )}
                                      </div>
                                      {item.quantity && item.unit && item.unit_price && (
                                        <div className="text-sm text-gray-600 mt-1">
                                          {item.quantity} {item.unit} @ ${item.unit_price}/{item.unit}
                                        </div>
                                      )}
                                      {item.notes && (
                                        <p className="text-xs text-gray-600 mt-1">{item.notes}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-gray-900">
                                        ${item.amount.toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-600">
                              <p>No line items available for this bid.</p>
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

