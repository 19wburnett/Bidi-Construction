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
  AlertCircle,
  DollarSign,
  Clock,
  GitCompare,
  Mail
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  const [emailStatuses, setEmailStatuses] = useState<Record<string, any>>({})
  const [allRecipients, setAllRecipients] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed'>('overview')
  const [leftSideTab, setLeftSideTab] = useState<'bids' | 'emails'>('bids')
  const [selectedEmailRecipient, setSelectedEmailRecipient] = useState<any | null>(null)
  const [showEmailResponseForm, setShowEmailResponseForm] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [sendingResponse, setSendingResponse] = useState(false)
  
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
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (bidsError) throw bidsError
      setBids(bidsData || [])

      // Load email statuses for this job
      try {
        const statusResponse = await fetch(`/api/jobs/${jobId}/email-statuses`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log('Email statuses loaded:', statusData)
          if (statusData.recipients && Array.isArray(statusData.recipients)) {
            // Store full recipients array
            setAllRecipients(statusData.recipients)
            console.log(`Loaded ${statusData.recipients.length} email recipients`)
            
            // Create a map by email address for quick lookup
            const statusMap: Record<string, any> = {}
            statusData.recipients.forEach((recipient: any) => {
              statusMap[recipient.subcontractor_email] = recipient
            })
            setEmailStatuses(statusMap)
          } else {
            console.log('No recipients found in response')
            setAllRecipients([])
          }
        } else {
          const errorText = await statusResponse.text()
          console.error('Failed to load email statuses:', statusResponse.status, errorText)
          setAllRecipients([])
        }
      } catch (err) {
        console.error('Error loading email statuses:', err)
        setAllRecipients([])
      }

      // Load takeoff items from plans in this job
      const { data: plansData } = await supabase
        .from('plans')
        .select('id, takeoff_analysis_status, job_id')
        .eq('job_id', jobId)

      if (plansData && plansData.length > 0) {
        const planWithTakeoff = plansData.find(p => p.takeoff_analysis_status === 'completed')
        if (planWithTakeoff && planWithTakeoff.job_id) {
          const { data: takeoffData } = await supabase
            .from('plan_takeoff_analysis')
            .select('items')
            .eq('job_id', planWithTakeoff.job_id)
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
      // Reset to overview tab when bid changes
      setActiveTab('overview')
    }
  }, [selectedBidId])

  // Default to emails tab when there are no bids
  useEffect(() => {
    if (bids.length === 0 && allRecipients.length > 0) {
      setLeftSideTab('emails')
    }
  }, [bids.length, allRecipients.length])

  // Auto-select all takeoff items when they're loaded
  useEffect(() => {
    if (takeoffItems.length > 0 && selectedTakeoffItemIds.size === 0) {
      setSelectedTakeoffItemIds(new Set(takeoffItems.map((item: TakeoffItem) => item.id)))
    }
  }, [takeoffItems])

  const selectedBid = bids.find(b => b.id === selectedBidId)

  // Calculate discrepancies between takeoff and bid
  const calculateDiscrepancies = () => {
    if (!selectedBid || takeoffItems.length === 0) {
      return []
    }

    // Filter to only selected takeoff items
    const selectedTakeoffItems = takeoffItems.filter(item => selectedTakeoffItemIds.has(item.id))
    
    if (selectedTakeoffItems.length === 0 || bidLineItems.length === 0) {
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

  // Calculate simplified comparison metrics
  const calculateSimplifiedMetrics = () => {
    if (!selectedBid || takeoffItems.length === 0) {
      return null
    }

    const selectedTakeoffItems = takeoffItems.filter(item => selectedTakeoffItemIds.has(item.id))
    if (selectedTakeoffItems.length === 0) {
      return null
    }

    const takeoffTotal = selectedTakeoffItems.reduce((sum, item) => {
      return sum + (item.quantity * (item.unit_cost ?? 0))
    }, 0)

    const bidTotal = bidLineItems.reduce((sum, item) => sum + item.amount, 0)
    const overallBidAmount = selectedBid.bid_amount || 0

    // Count matches
    let matchedCount = 0
    let missingCount = 0
    selectedTakeoffItems.forEach(takeoffItem => {
      const matchingBidItem = bidLineItems.find(bidItem => 
        bidItem.description.toLowerCase().includes(takeoffItem.description.toLowerCase()) ||
        takeoffItem.description.toLowerCase().includes(bidItem.description.toLowerCase())
      )
      if (matchingBidItem) {
        matchedCount++
      } else {
        missingCount++
      }
    })

    const discrepancyCount = discrepancies.length
    const matchPercentage = selectedTakeoffItems.length > 0 
      ? Math.round((matchedCount / selectedTakeoffItems.length) * 100) 
      : 0

    return {
      takeoffTotal,
      bidTotal,
      overallBidAmount,
      matchedCount,
      missingCount,
      discrepancyCount,
      matchPercentage,
      selectedTakeoffItemsCount: selectedTakeoffItems.length,
      bidLineItemsCount: bidLineItems.length
    }
  }

  const simplifiedMetrics = calculateSimplifiedMetrics()

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
        className="bg-white rounded-lg shadow-xl max-w-7xl w-[98vw] h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
                 <Card className="border-0 shadow-none flex-1 flex flex-col h-full">
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
               <div className="flex items-center gap-2">
                 <Button variant="ghost" size="sm" onClick={onClose}>
                   ×
                 </Button>
               </div>
             </div>
           </CardHeader>
           
           <CardContent className="flex-1 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-600">Loading bids...</p>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-red-600">{error}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-full overflow-hidden">
                {/* Left: Bids/Emails List with Tabs */}
                <div className="border-r overflow-hidden flex flex-col">
                  <Tabs value={leftSideTab} onValueChange={(v) => setLeftSideTab(v as 'bids' | 'emails')} className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 mb-3 mx-2 mt-2">
                      <TabsTrigger 
                        value="bids"
                        onClick={() => {
                          setSelectedEmailRecipient(null)
                          setShowEmailResponseForm(false)
                          setResponseText('')
                        }}
                      >
                        Bids
                        {bids.length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {bids.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="emails">
                        Emails
                        {allRecipients.length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {allRecipients.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="bids" className="flex-1 overflow-y-auto mt-0 pr-2">
                      <h3 className="font-semibold mb-3 sticky top-0 bg-white pb-2">Bids ({bids.length})</h3>
                      <div className="space-y-3">
                        {bids.map((bid) => (
                          <motion.div
                            key={bid.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <Card 
                              className={`cursor-pointer transition-all ${
                                selectedBidId === bid.id 
                                  ? 'border-orange-500 bg-orange-50 shadow-md' 
                                  : 'hover:border-gray-300'
                              }`}
                              onClick={() => {
                                setSelectedBidId(bid.id)
                                setSelectedEmailRecipient(null)
                                setShowEmailResponseForm(false)
                                setResponseText('')
                                setLeftSideTab('bids')
                              }}
                            >
                              <CardContent className="p-3 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm text-gray-900 truncate">
                                      {bid.subcontractors?.name || bid.subcontractor_email || 'Unknown'}
                                    </h4>
                                    <p className="text-xs text-gray-600 truncate">{bid.subcontractors?.email || bid.subcontractor_email}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 ml-2">
                                    {bid.status && (
                                      <Badge variant={bid.status === 'accepted' ? 'default' : 'outline'} className="text-xs">
                                        {bid.status}
                                      </Badge>
                                    )}
                                    {(() => {
                                      const emailStatus = emailStatuses[bid.subcontractors?.email || bid.subcontractor_email]
                                      if (emailStatus) {
                                        const statusColors: Record<string, string> = {
                                          sent: 'bg-blue-100 text-blue-800',
                                          delivered: 'bg-green-100 text-green-800',
                                          opened: 'bg-purple-100 text-purple-800',
                                          bounced: 'bg-red-100 text-red-800',
                                          failed: 'bg-red-100 text-red-800',
                                          responded: 'bg-orange-100 text-orange-800',
                                          pending: 'bg-gray-100 text-gray-800'
                                        }
                                        return (
                                          <>
                                            <Badge className={`text-xs ${statusColors[emailStatus.status] || 'bg-gray-100 text-gray-800'}`}>
                                              {emailStatus.status}
                                            </Badge>
                                            {emailStatus.has_clarifying_questions && (
                                              <Badge variant="destructive" className="text-xs">
                                                ?
                                              </Badge>
                                            )}
                                          </>
                                        )
                                      }
                                      return null
                                    })()}
                                  </div>
                                </div>
                                
                                {bid.bid_amount && (
                                  <div className="text-xl font-bold text-green-600">
                                    ${bid.bid_amount.toLocaleString()}
                                  </div>
                                )}
                                
                                {bid.subcontractors?.google_review_score && (
                                  <div className="flex items-center text-xs text-gray-600">
                                    ⭐ {bid.subcontractors.google_review_score}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="emails" className="flex-1 overflow-y-auto mt-0 pr-2">
                      <h3 className="font-semibold mb-3 sticky top-0 bg-white pb-2">Email Statuses ({allRecipients.length})</h3>
                      {allRecipients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                          <Mail className="h-12 w-12 mb-3 text-gray-400" />
                          <p className="text-sm text-center">No emails sent</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(() => {
                            const groupedByPackage: Record<string, any[]> = {}
                            allRecipients.forEach((recipient: any) => {
                              const packageId = recipient.bid_package_id || 'unknown'
                              if (!groupedByPackage[packageId]) {
                                groupedByPackage[packageId] = []
                              }
                              groupedByPackage[packageId].push(recipient)
                            })
                            
                            return Object.entries(groupedByPackage).map(([packageId, recipients]) => {
                              const tradeCategory = recipients[0]?.bid_packages?.trade_category || 'Unknown Trade'
                              const hasBids = recipients.filter((r: any) => r.bids && r.bids.length > 0).length
                              
                              return (
                                <div key={packageId} className="space-y-2">
                                  <div className="text-xs font-semibold text-gray-700 mb-2">{tradeCategory}</div>
                                  {recipients.map((recipient: any) => {
                                    const statusColors: Record<string, string> = {
                                      sent: 'bg-blue-100 text-blue-800 border-blue-300',
                                      delivered: 'bg-green-100 text-green-800 border-green-300',
                                      opened: 'bg-purple-100 text-purple-800 border-purple-300',
                                      bounced: 'bg-red-100 text-red-800 border-red-300',
                                      failed: 'bg-red-100 text-red-800 border-red-300',
                                      responded: 'bg-orange-100 text-orange-800 border-orange-300',
                                      pending: 'bg-gray-100 text-gray-800 border-gray-300'
                                    }
                                    
                                    const hasBid = recipient.bids && recipient.bids.length > 0
                                    const bid = hasBid ? recipient.bids[0] : null
                                    
                                    return (
                                      <Card
                                        key={recipient.id}
                                        className={`cursor-pointer transition-all ${
                                          selectedEmailRecipient?.id === recipient.id
                                            ? 'border-orange-500 bg-orange-50 shadow-md'
                                            : hasBid
                                            ? 'bg-green-50 border-green-200'
                                            : 'hover:border-gray-300'
                                        }`}
                                        onClick={() => {
                                          setSelectedEmailRecipient(recipient)
                                          setSelectedBidId(null)
                                          setShowEmailResponseForm(false)
                                          setResponseText('')
                                        }}
                                      >
                                        <CardContent className="p-3 space-y-2">
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-semibold text-sm text-gray-900 truncate">
                                                {recipient.subcontractor_name || recipient.subcontractors?.name || recipient.subcontractor_email}
                                              </h4>
                                              <p className="text-xs text-gray-600 truncate">{recipient.subcontractor_email}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 ml-2">
                                              <Badge className={`text-xs border ${statusColors[recipient.status] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                                                {recipient.status}
                                              </Badge>
                                              {recipient.has_clarifying_questions && (
                                                <Badge variant="destructive" className="text-xs">
                                                  ?
                                                </Badge>
                                              )}
                                              {hasBid && (
                                                <Badge variant="default" className="text-xs bg-green-600">
                                                  Bid
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {hasBid && bid && bid.bid_amount && (
                                            <div className="text-lg font-bold text-green-600">
                                              ${bid.bid_amount.toLocaleString()}
                                            </div>
                                          )}
                                          
                                          {recipient.responded_at && (
                                            <div className="text-xs text-gray-500">
                                              Responded: {new Date(recipient.responded_at).toLocaleDateString()}
                                            </div>
                                          )}
                                        </CardContent>
                                      </Card>
                                    )
                                  })}
                                </div>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Right: Tabbed Content */}
                <div className="overflow-hidden flex flex-col">
                  {selectedEmailRecipient ? (
                    <div className="flex-1 overflow-y-auto">
                      {/* Email Detail View */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold">Email Details</h3>
                            <p className="text-sm text-gray-600">
                              {selectedEmailRecipient.subcontractor_name || selectedEmailRecipient.subcontractors?.name || selectedEmailRecipient.subcontractor_email}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEmailRecipient(null)
                              setShowEmailResponseForm(false)
                              setResponseText('')
                            }}
                          >
                            ×
                          </Button>
                        </div>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Recipient Information</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-600">Email</p>
                                <p className="font-medium">{selectedEmailRecipient.subcontractor_email}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Status</p>
                                <Badge className={`text-xs ${
                                  selectedEmailRecipient.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                  selectedEmailRecipient.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                  selectedEmailRecipient.status === 'opened' ? 'bg-purple-100 text-purple-800' :
                                  selectedEmailRecipient.status === 'responded' ? 'bg-orange-100 text-orange-800' :
                                  selectedEmailRecipient.status === 'bounced' || selectedEmailRecipient.status === 'failed' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {selectedEmailRecipient.status}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              {selectedEmailRecipient.sent_at && (
                                <div>
                                  <p className="text-sm text-gray-600">Sent</p>
                                  <p className="text-sm">{new Date(selectedEmailRecipient.sent_at).toLocaleString()}</p>
                                </div>
                              )}
                              {selectedEmailRecipient.delivered_at && (
                                <div>
                                  <p className="text-sm text-gray-600">Delivered</p>
                                  <p className="text-sm">{new Date(selectedEmailRecipient.delivered_at).toLocaleString()}</p>
                                </div>
                              )}
                              {selectedEmailRecipient.opened_at && (
                                <div>
                                  <p className="text-sm text-gray-600">Opened</p>
                                  <p className="text-sm">{new Date(selectedEmailRecipient.opened_at).toLocaleString()}</p>
                                </div>
                              )}
                              {selectedEmailRecipient.responded_at && (
                                <div>
                                  <p className="text-sm text-gray-600">Responded</p>
                                  <p className="text-sm">{new Date(selectedEmailRecipient.responded_at).toLocaleString()}</p>
                                </div>
                              )}
                            </div>

                            {selectedEmailRecipient.bid_packages && (
                              <div>
                                <p className="text-sm text-gray-600">Trade Category</p>
                                <p className="font-medium">{selectedEmailRecipient.bid_packages.trade_category}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Original Email Sent */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center">
                              <Mail className="h-4 w-4 mr-2 text-blue-600" />
                              Original Email Sent
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {selectedEmailRecipient.bid_packages && (
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Subject</p>
                                <p className="text-sm font-medium">
                                  Bid Request: {selectedEmailRecipient.bid_packages.trade_category}
                                </p>
                              </div>
                            )}
                            {selectedEmailRecipient.sent_at && (
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Sent On</p>
                                <p className="text-sm">{new Date(selectedEmailRecipient.sent_at).toLocaleString()}</p>
                              </div>
                            )}
                            <div className="bg-gray-50 p-3 rounded border border-gray-200">
                              <p className="text-xs text-gray-600 mb-2">Email Content:</p>
                              <p className="text-sm text-gray-700">
                                A bid package email was sent to {selectedEmailRecipient.subcontractor_email} requesting a bid for the {selectedEmailRecipient.bid_packages?.trade_category || 'specified'} trade category. 
                                {selectedEmailRecipient.bid_packages && ' The email included plan attachments and project details.'}
                              </p>
                              {selectedEmailRecipient.reminder_count > 0 && (
                                <p className="text-xs text-gray-500 mt-2">
                                  {selectedEmailRecipient.reminder_count} reminder{selectedEmailRecipient.reminder_count !== 1 ? 's' : ''} sent
                                  {selectedEmailRecipient.last_reminder_sent_at && ` (last: ${new Date(selectedEmailRecipient.last_reminder_sent_at).toLocaleDateString()})`}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Response Content */}
                        {selectedEmailRecipient.response_text && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Response Received</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="prose prose-sm max-w-none">
                                <p className="whitespace-pre-wrap text-sm">{selectedEmailRecipient.response_text}</p>
                              </div>
                              {selectedEmailRecipient.responded_at && (
                                <p className="text-xs text-gray-500 mt-3">
                                  Received: {new Date(selectedEmailRecipient.responded_at).toLocaleString()}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Clarifying Questions */}
                        {selectedEmailRecipient.clarifying_questions && selectedEmailRecipient.clarifying_questions.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center">
                                <AlertCircle className="h-4 w-4 mr-2 text-orange-600" />
                                Clarifying Questions
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="list-disc pl-5 space-y-2">
                                {selectedEmailRecipient.clarifying_questions.map((q: string, idx: number) => (
                                  <li key={idx} className="text-sm text-gray-700">{q}</li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}

                        {/* Bid Information */}
                        {selectedEmailRecipient.bids && selectedEmailRecipient.bids.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center justify-between">
                                <span>Bid Received</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const bidId = selectedEmailRecipient.bids[0].id
                                    if (bidId) {
                                      setSelectedBidId(bidId)
                                      setSelectedEmailRecipient(null)
                                      setLeftSideTab('bids')
                                    }
                                  }}
                                >
                                  View Bid Details
                                </Button>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {selectedEmailRecipient.bids[0].bid_amount && (
                                <div className="text-2xl font-bold text-green-600 mb-2">
                                  ${selectedEmailRecipient.bids[0].bid_amount.toLocaleString()}
                                </div>
                              )}
                              {selectedEmailRecipient.bids[0].timeline && (
                                <p className="text-sm text-gray-600 mb-2">
                                  Timeline: {selectedEmailRecipient.bids[0].timeline}
                                </p>
                              )}
                              {selectedEmailRecipient.bids[0].status && (
                                <Badge variant={selectedEmailRecipient.bids[0].status === 'accepted' ? 'default' : 'outline'}>
                                  {selectedEmailRecipient.bids[0].status}
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {/* Action Buttons */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Actions</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                onClick={() => setShowEmailResponseForm(!showEmailResponseForm)}
                                className="bg-orange-600 hover:bg-orange-700"
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                {selectedEmailRecipient.response_text ? 'Follow Up' : 'Respond'}
                              </Button>
                              {(() => {
                                const bidPackageId = selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id
                                if (!bidPackageId || !selectedEmailRecipient.id) return null
                                
                                return (
                                  <Button
                                    variant="outline"
                                    onClick={async () => {
                                      // Send a reminder/follow-up email
                                      try {
                                        setSendingResponse(true)
                                        setError('')
                                        const response = await fetch(`/api/bid-packages/${bidPackageId}/respond`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            recipientId: selectedEmailRecipient.id,
                                            responseText: 'This is a friendly reminder about the bid request. Please let us know if you have any questions or need additional information.'
                                          })
                                        })
                                        
                                        if (response.ok) {
                                          // Reload data
                                          await loadData()
                                          setShowEmailResponseForm(false)
                                          setResponseText('')
                                        } else {
                                          const errorData = await response.json()
                                          setError(errorData.error || 'Failed to send reminder')
                                        }
                                      } catch (err: any) {
                                        setError(err.message || 'Failed to send reminder')
                                      } finally {
                                        setSendingResponse(false)
                                      }
                                    }}
                                    disabled={sendingResponse}
                                  >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Send Reminder
                                  </Button>
                                )
                              })()}
                            </div>

                            {/* Response Form */}
                            {showEmailResponseForm && (
                              <div className="space-y-3 pt-3 border-t">
                                <div>
                                  <Label htmlFor="response-text">Your Response</Label>
                                  <Textarea
                                    id="response-text"
                                    placeholder="Type your response here..."
                                    value={responseText}
                                    onChange={(e) => setResponseText(e.target.value)}
                                    rows={6}
                                    className="mt-2"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="default"
                                    onClick={async () => {
                                      if (!responseText.trim()) {
                                        setError('Please enter a response')
                                        return
                                      }
                                      
                                      if (!selectedEmailRecipient.id) {
                                        setError('Recipient ID not found')
                                        return
                                      }
                                      
                                      const bidPackageId = selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id
                                      if (!bidPackageId) {
                                        setError('Bid package ID not found')
                                        return
                                      }

                                      // Validate before starting async operation
                                      const requestBody = {
                                        recipientId: selectedEmailRecipient.id,
                                        responseText: responseText.trim()
                                      }
                                      
                                      if (!requestBody.recipientId) {
                                        setError('Recipient ID is missing')
                                        return
                                      }
                                      if (!requestBody.responseText) {
                                        setError('Response text is required')
                                        return
                                      }
                                      
                                      try {
                                        setSendingResponse(true)
                                        setError('')
                                        
                                        const response = await fetch(`/api/bid-packages/${bidPackageId}/respond`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify(requestBody)
                                        })
                                        
                                        if (response.ok) {
                                          // Reload data to get updated email status
                                          await loadData()
                                          setShowEmailResponseForm(false)
                                          setResponseText('')
                                          // Refresh selected recipient
                                          const updatedRecipient = allRecipients.find(r => r.id === selectedEmailRecipient.id)
                                          if (updatedRecipient) {
                                            setSelectedEmailRecipient(updatedRecipient)
                                          }
                                        } else {
                                          const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
                                          setError(errorData.error || 'Failed to send response')
                                        }
                                      } catch (err: any) {
                                        console.error('Error sending response:', err)
                                        setError(err.message || 'Failed to send response')
                                      } finally {
                                        setSendingResponse(false)
                                      }
                                    }}
                                    disabled={sendingResponse || !responseText.trim()}
                                    className="bg-orange-600 hover:bg-orange-700"
                                  >
                                    {sendingResponse ? 'Sending...' : 'Send Response'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setShowEmailResponseForm(false)
                                      setResponseText('')
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                                {error && (
                                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                    {error}
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : selectedBid ? (
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'detailed')} className="h-full flex flex-col">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="detailed">Detailed Comparison</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="overview" className="flex-1 overflow-y-auto mt-0">
                        {/* Simplified Comparison View */}
                        {takeoffItems.length > 0 && simplifiedMetrics ? (
                          <div className="space-y-6">
                            {/* Bid Details Card */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg">Bid Details</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
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
                                    <a href={selectedBid.subcontractors.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                                      {selectedBid.subcontractors.website_url}
                                    </a>
                                  </div>
                                )}
                                {selectedBid.bid_amount && (
                                  <div>
                                    <p className="text-sm text-gray-600">Total Bid Amount</p>
                                    <p className="text-3xl font-bold text-green-600">
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

                            {/* Comparison Summary */}
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg flex items-center">
                                  <GitCompare className="h-5 w-5 mr-2 text-orange-600" />
                                  Comparison Summary
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-6">
                                {/* Cost Comparison */}
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-xs text-gray-600 mb-1">Takeoff Total</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                      ${simplifiedMetrics.takeoffTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{simplifiedMetrics.selectedTakeoffItemsCount} items</p>
                                  </div>
                                  {simplifiedMetrics.bidLineItemsCount > 0 ? (
                                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                                      <p className="text-xs text-gray-600 mb-1">Bid Line Items Total</p>
                                      <p className="text-2xl font-bold text-green-600">
                                        ${simplifiedMetrics.bidTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">{simplifiedMetrics.bidLineItemsCount} items</p>
                                    </div>
                                  ) : (
                                    <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                                      <p className="text-xs text-gray-600 mb-1">No Line Items</p>
                                      <p className="text-sm text-gray-500">Bid has no detailed breakdown</p>
                                    </div>
                                  )}
                                  <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                                    <p className="text-xs text-gray-600 mb-1">Overall Bid Amount</p>
                                    <p className="text-2xl font-bold text-orange-600">
                                      ${simplifiedMetrics.overallBidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>

                                {/* Match Statistics */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 bg-gray-50 rounded-lg border">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-700">Items Matched</span>
                                      <span className="text-lg font-bold text-green-600">{simplifiedMetrics.matchedCount}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-green-600 h-2 rounded-full transition-all"
                                        style={{ width: `${simplifiedMetrics.matchPercentage}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">{simplifiedMetrics.matchPercentage}% match rate</p>
                                  </div>
                                  <div className="p-4 bg-gray-50 rounded-lg border">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-700">Items Missing</span>
                                      <span className="text-lg font-bold text-red-600">{simplifiedMetrics.missingCount}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">Not found in bid</p>
                                  </div>
                                </div>

                                {/* Discrepancies Alert */}
                                {simplifiedMetrics.discrepancyCount > 0 && (
                                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="flex items-center mb-2">
                                      <AlertCircle className="h-5 w-5 text-orange-600 mr-2" />
                                      <span className="font-semibold text-orange-900">
                                        {simplifiedMetrics.discrepancyCount} Discrepancy{simplifiedMetrics.discrepancyCount !== 1 ? 'ies' : ''} Detected
                                      </span>
                                    </div>
                                    <p className="text-sm text-orange-800 mb-3">
                                      Major differences found between your takeoff and this bid (quantity differences &gt;20% or price differences &gt;15%).
                                    </p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setActiveTab('detailed')}
                                      className="border-orange-300 text-orange-700 hover:bg-orange-100"
                                    >
                                      View Detailed Comparison
                                    </Button>
                                  </div>
                                )}

                                {/* No Line Items Alert */}
                                {simplifiedMetrics.bidLineItemsCount === 0 && (
                                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-center mb-2">
                                      <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                                      <span className="font-semibold text-blue-900">
                                        No Bid Line Items Available
                                      </span>
                                    </div>
                                    <p className="text-sm text-blue-800">
                                      This bid doesn't have detailed line items. Only the overall bid amount is available.
                                    </p>
                                  </div>
                                )}

                                {/* View Detailed Comparison Button */}
                                {simplifiedMetrics.bidLineItemsCount > 0 && (
                                  <div className="flex justify-center">
                                    <Button
                                      variant="default"
                                      size="lg"
                                      onClick={() => setActiveTab('detailed')}
                                      className="bg-orange-600 hover:bg-orange-700"
                                    >
                                      <GitCompare className="h-4 w-4 mr-2" />
                                      View Detailed Comparison
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-600">
                            <FileText className="h-16 w-16 mb-4 text-gray-400" />
                            <p>No takeoff data available for comparison</p>
                          </div>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="detailed" className="flex-1 overflow-y-auto mt-0">
                        {/* Detailed Comparison View */}
                        {takeoffItems.length > 0 ? (
                          <div className="space-y-4">
                            {/* Takeoff Items Selection */}
                            <Card className="p-4">
                              <h4 className="font-medium mb-3 text-sm">Select Takeoff Items to Compare:</h4>
                              <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                                {takeoffItems.map((item) => {
                                  const isSelected = selectedTakeoffItemIds.has(item.id)
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
                                        }}
                                      />
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{item.description}</div>
                                        <div className="text-xs text-gray-600">
                                          {item.quantity} {item.unit}
                                          {item.unit_cost !== undefined && item.unit_cost !== null && ` • $${(item.unit_cost ?? 0).toFixed(2)}/${item.unit}`}
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {item.category}
                                      </Badge>
                                    </div>
                                  )
                                })}
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-500">
                                  {selectedTakeoffItemIds.size} of {takeoffItems.length} items selected
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (selectedTakeoffItemIds.size === takeoffItems.length) {
                                      setSelectedTakeoffItemIds(new Set())
                                    } else {
                                      setSelectedTakeoffItemIds(new Set(takeoffItems.map(item => item.id)))
                                    }
                                  }}
                                >
                                  {selectedTakeoffItemIds.size === takeoffItems.length ? 'Deselect All' : 'Select All'}
                                </Button>
                              </div>
                            </Card>

                            {/* Detailed Comparison Table */}
                            {selectedTakeoffItemIds.size > 0 ? (
                              <div className="space-y-4">
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
                                      <div className="divide-y max-h-[600px] overflow-y-auto">
                                        {takeoffItems
                                          .filter(item => selectedTakeoffItemIds.has(item.id))
                                          .map((takeoffItem) => {
                                            const matchingBidItem = bidLineItems.find(bidItem => 
                                              bidItem.description.toLowerCase().includes(takeoffItem.description.toLowerCase()) ||
                                              takeoffItem.description.toLowerCase().includes(bidItem.description.toLowerCase())
                                            )
                                            
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
                            ) : (
                              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                                <GitCompare className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                                <p className="text-sm">Select items above to see the detailed comparison</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-600">
                            <FileText className="h-16 w-16 mb-4 text-gray-400" />
                            <p>No takeoff data available for comparison</p>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  ) : bids.length === 0 && allRecipients.length > 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600">
                      <Mail className="h-16 w-16 mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bids Received Yet</h3>
                      <p className="text-gray-600 mb-4 text-center max-w-md">
                        {allRecipients.length} email{allRecipients.length !== 1 ? 's' : ''} {allRecipients.length === 1 ? 'has' : 'have'} been sent. 
                        View email statuses in the left panel. Once bids are received, they will appear in the Bids tab.
                      </p>
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

