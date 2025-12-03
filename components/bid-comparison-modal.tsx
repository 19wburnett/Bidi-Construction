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
  Mail,
  Check,
  X,
  ChevronRight,
  Building2,
  Phone,
  Globe,
  Calendar,
  Search,
  Download
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { modalBackdrop, modalContent } from '@/lib/animations'

interface BidComparisonModalProps {
  jobId: string
  isOpen: boolean
  onClose: () => void
}

interface Bid {
  id: string
  subcontractor_id: string | null
  contact_id: string | null
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
    trade_category: string | null
  } | null
  gc_contacts?: {
    id: string
    name: string
    email: string
    phone: string | null
    trade_category: string
    location: string
    company: string | null
  } | null
  bid_packages?: {
    id: string
    trade_category: string
  } | null
  bid_attachments?: {
    id: string
    file_name: string
    file_path: string
  }[]
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
  cost_code?: string | null
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
  const [activeTab, setActiveTab] = useState<'details' | 'comparison'>('details')
  const [leftSideTab, setLeftSideTab] = useState<'bids' | 'emails'>('bids')
  const [selectedEmailRecipient, setSelectedEmailRecipient] = useState<any | null>(null)
  const [showEmailResponseForm, setShowEmailResponseForm] = useState(false)
  const [responseText, setResponseText] = useState('')
  const [sendingResponse, setSendingResponse] = useState(false)
  const [takeoffSearchTerm, setTakeoffSearchTerm] = useState('')
  
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
      // Load bids for this job with subcontractor and contact information joined
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
            google_reviews_link,
            trade_category
          ),
          gc_contacts (
            id,
            name,
            email,
            phone,
            trade_category,
            location,
            company
          ),
          bid_packages (
            id,
            trade_category
          ),
          bid_attachments (
            id,
            file_name,
            file_path
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (bidsError) throw bidsError
      console.log('Loaded bids:', bidsData)
      if (bidsData) {
        bidsData.forEach(b => {
          if (b.bid_attachments && b.bid_attachments.length > 0) {
            console.log(`Bid ${b.id} has attachments:`, b.bid_attachments)
          }
        })
      }
      setBids(bidsData || [])

      // Load email statuses for this job
      try {
        const statusResponse = await fetch(`/api/jobs/${jobId}/email-statuses`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          if (statusData.recipients && Array.isArray(statusData.recipients)) {
            setAllRecipients(statusData.recipients)
            const statusMap: Record<string, any> = {}
            statusData.recipients.forEach((recipient: any) => {
              statusMap[recipient.subcontractor_email] = recipient
            })
            setEmailStatuses(statusMap)
          } else {
            setAllRecipients([])
          }
        }
      } catch (err) {
        console.error('Error loading email statuses:', err)
        setAllRecipients([])
      }

      // Load takeoff items directly from job-level analysis
      const { data: takeoffData } = await supabase
        .from('plan_takeoff_analysis')
        .select('items')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (takeoffData && takeoffData.items) {
        let itemsArray: any[] = []
        try {
          if (typeof takeoffData.items === 'string') {
            const parsed = JSON.parse(takeoffData.items)
            itemsArray = parsed.takeoffs || parsed.items || (Array.isArray(parsed) ? parsed : [])
          } else if (Array.isArray(takeoffData.items)) {
            itemsArray = takeoffData.items
          }
        } catch (parseError) {
          console.error('Error parsing takeoff items:', parseError)
        }

        if (itemsArray.length > 0) {
          const typedItems: TakeoffItem[] = itemsArray.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            category: item.category || 'Uncategorized',
            description: item.description || item.name || 'Item',
            quantity: Number(item.quantity) || 0,
            unit: item.unit || 'ea',
            unit_cost: Number(item.unit_cost) || null
          }))
          
          setTakeoffItems(typedItems)
          if (selectedTakeoffItemIds.size === 0) {
            setSelectedTakeoffItemIds(new Set(typedItems.map(item => item.id)))
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
      setActiveTab('details')
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
  
  useEffect(() => {
    if (selectedBid) {
      console.log('Selected Bid:', selectedBid)
      console.log('Subcontractor Info:', selectedBid.subcontractors)
    }
  }, [selectedBid])

  // Calculate discrepancies between takeoff and bid
  const calculateDiscrepancies = () => {
    if (!selectedBid || takeoffItems.length === 0) {
      return []
    }

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

  const [downloadingAttachment, setDownloadingAttachment] = useState<string | null>(null)
  
  const handleDownloadAttachment = async (path: string, fileName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDownloadingAttachment(path)
    
    try {
      // Use our API endpoint which sets proper Content-Disposition headers
      const downloadUrl = `/api/download-attachment?path=${encodeURIComponent(path)}&fileName=${encodeURIComponent(fileName)}`
      
      // Create a link and trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      
      setTimeout(() => {
        document.body.removeChild(link)
      }, 100)
    } catch (err: any) {
      console.error('Error downloading attachment:', err)
    } finally {
      // Add a small delay before removing loading state so user sees feedback
      setTimeout(() => setDownloadingAttachment(null), 500)
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
      style={{ pointerEvents: 'auto' }}
    >
      <motion.div
        variants={modalContent}
        initial="initial"
        animate="animate"
        exit="exit"
        className="bg-white rounded-xl shadow-2xl w-[98vw] h-[95vh] overflow-hidden flex flex-col border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-white px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Bid Review & Comparison</h2>
              <p className="text-sm text-gray-500">Compare bids against your takeoff analysis</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                <p className="text-gray-500 font-medium">Loading bids...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Left Sidebar: Bids & Emails List */}
              <div className="w-[320px] border-r flex flex-col bg-gray-50/50 overflow-hidden">
                <Tabs value={leftSideTab} onValueChange={(v) => setLeftSideTab(v as 'bids' | 'emails')} className="flex-1 flex flex-col min-h-0">
                  <div className="p-3 border-b bg-white">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="bids" className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                        Bids
                        {bids.length > 0 && (
                          <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-600">
                            {bids.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="emails" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                        Emails
                        {allRecipients.length > 0 && (
                          <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-600">
                            {allRecipients.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="bids" className="flex-1 overflow-y-auto p-3 mt-0 space-y-3 min-h-0">
                    {bids.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">No bids received yet</p>
                      </div>
                    )}
                    {bids.map((bid) => {
                      const bidPackage = (bid.bid_packages as any)
                      return (
                      <div
                        key={bid.id}
                        onClick={() => {
                          setSelectedBidId(bid.id)
                          setSelectedEmailRecipient(null)
                          setShowEmailResponseForm(false)
                          setResponseText('')
                          setLeftSideTab('bids')
                        }}
                        className={`
                          cursor-pointer rounded-lg p-4 border transition-all hover:shadow-sm
                          ${selectedBidId === bid.id 
                            ? 'border-orange-400 bg-white shadow-md ring-1 ring-orange-400/20' 
                            : 'bg-white border-gray-200 hover:border-orange-200'
                          }
                        `}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold text-sm text-gray-900 truncate max-w-[160px]">
                              {bid.subcontractors?.name || bid.gc_contacts?.name || bid.subcontractor_email || 'Unknown'}
                            </h4>
                            <p className="text-xs text-gray-500 truncate max-w-[160px]">
                              {bid.subcontractors?.email || bid.gc_contacts?.email || bid.subcontractor_email}
                            </p>
                          </div>
                          {bid.subcontractors?.trade_category && (
                            <Badge variant="outline" className="text-[10px]">
                              {bid.subcontractors.trade_category}
                            </Badge>
                          )}
                          {!bid.subcontractors?.trade_category && bid.gc_contacts?.trade_category && (
                            <Badge variant="outline" className="text-[10px]">
                              {bid.gc_contacts.trade_category}
                            </Badge>
                          )}
                          {!bid.subcontractors?.trade_category && !bid.gc_contacts?.trade_category && bidPackage && (
                            <Badge variant="outline" className="text-[10px]">
                              {bidPackage.trade_category}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="text-lg font-bold text-gray-900">
                            ${bid.bid_amount?.toLocaleString() ?? '0.00'}
                          </span>
                          <span className="text-xs text-gray-500">total</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(bid.created_at).toLocaleDateString()}
                          </div>
                          {bid.subcontractors?.google_review_score && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <span>★</span>
                              {bid.subcontractors.google_review_score}
                            </div>
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </TabsContent>
                  
                  <TabsContent value="emails" className="flex-1 overflow-y-auto p-3 mt-0 space-y-3 min-h-0">
                    {allRecipients.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">No emails sent</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(allRecipients.reduce((acc: any, r: any) => {
                          const key = r.bid_packages?.trade_category || 'Other'
                          if (!acc[key]) acc[key] = []
                          acc[key].push(r)
                          return acc
                        }, {})).map(([category, recipients]: [string, any]) => (
                          <div key={category}>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                              {category}
                            </h3>
                            <div className="space-y-2">
                              {recipients.map((recipient: any) => (
                                <div
                                  key={recipient.id}
                                  onClick={() => {
                                    setSelectedEmailRecipient(recipient)
                                    setSelectedBidId(null)
                                    setShowEmailResponseForm(false)
                                    setResponseText('')
                                  }}
                                  className={`
                                    cursor-pointer rounded-lg p-3 border transition-all
                                    ${selectedEmailRecipient?.id === recipient.id 
                                      ? 'border-blue-400 bg-white shadow-md ring-1 ring-blue-400/20' 
                                      : 'bg-white border-gray-200 hover:border-blue-200'
                                    }
                                  `}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-medium text-sm text-gray-900 truncate max-w-[180px]">
                                      {recipient.subcontractor_name || recipient.subcontractors?.name || recipient.subcontractor_email}
                                    </h4>
                                    {recipient.has_clarifying_questions && (
                                      <Badge variant="destructive" className="h-2 w-2 p-0 rounded-full" />
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <Badge variant="outline" className={`
                                      text-[10px] px-1.5 py-0 h-5 capitalize border-0
                                      ${recipient.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                        recipient.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                        recipient.status === 'opened' ? 'bg-purple-100 text-purple-700' :
                                        recipient.status === 'responded' ? 'bg-orange-100 text-orange-700' :
                                        'bg-gray-100 text-gray-600'}
                                    `}>
                                      {recipient.status}
                                    </Badge>
                                    {recipient.bids?.length > 0 && (
                                      <Badge className="text-[10px] h-5 bg-green-600 px-1.5">Bid</Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col bg-white">
                {selectedEmailRecipient ? (
                  // Email View
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-3xl mx-auto space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">Email Details</h2>
                          <p className="text-gray-500">
                            Communication with {selectedEmailRecipient.subcontractor_name || selectedEmailRecipient.subcontractors?.name || selectedEmailRecipient.subcontractor_email}
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setSelectedEmailRecipient(null)}>Close</Button>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-sm text-gray-500 mb-1">Status</div>
                            <div className="font-semibold capitalize">{selectedEmailRecipient.status}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-sm text-gray-500 mb-1">Last Activity</div>
                            <div className="font-semibold">
                              {new Date(selectedEmailRecipient.updated_at || selectedEmailRecipient.created_at).toLocaleDateString()}
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-sm text-gray-500 mb-1">Bid Package</div>
                            <div className="font-semibold">
                              {selectedEmailRecipient.bid_packages?.trade_category || 'General'}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Response/Thread Content */}
                      <div className="space-y-4">
                        {selectedEmailRecipient.response_text && (
                          <Card className="border-orange-200 bg-orange-50">
                            <CardHeader>
                              <CardTitle className="text-base text-orange-900">Response from Subcontractor</CardTitle>
                              <CardDescription className="text-orange-700">
                                Received {new Date(selectedEmailRecipient.responded_at).toLocaleString()}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <p className="whitespace-pre-wrap text-gray-800">{selectedEmailRecipient.response_text}</p>
                            </CardContent>
                          </Card>
                        )}

                        {/* Reply Action */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Reply</CardTitle>
                          </CardHeader>
                          <CardContent>
                             {!showEmailResponseForm ? (
                               <div className="flex gap-3">
                                 <Button onClick={() => setShowEmailResponseForm(true)}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send Message
                                 </Button>
                                 {selectedEmailRecipient.bids?.length > 0 && (
                                   <Button variant="outline" onClick={() => {
                                      setSelectedBidId(selectedEmailRecipient.bids[0].id)
                                      setSelectedEmailRecipient(null)
                                      setLeftSideTab('bids')
                                   }}>
                                      View Bid
                                   </Button>
                                 )}
                               </div>
                             ) : (
                               <div className="space-y-4">
                                 <Textarea
                                    value={responseText}
                                    onChange={(e) => setResponseText(e.target.value)}
                                    placeholder="Type your message here..."
                                    rows={5}
                                 />
                                 <div className="flex gap-3">
                                   <Button 
                                      disabled={sendingResponse || !responseText.trim()}
                                      onClick={async () => {
                                        if (!responseText.trim() || !selectedEmailRecipient.id) return
                                        const bidPackageId = selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id
                                        if (!bidPackageId) return

                                        setSendingResponse(true)
                                        try {
                                          const res = await fetch(`/api/bid-packages/${bidPackageId}/respond`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              recipientId: selectedEmailRecipient.id,
                                              responseText: responseText.trim()
                                            })
                                          })
                                          if (res.ok) {
                                            await loadData()
                                            setShowEmailResponseForm(false)
                                            setResponseText('')
                                            const updated = allRecipients.find(r => r.id === selectedEmailRecipient.id)
                                            if (updated) setSelectedEmailRecipient(updated)
                                          } else {
                                            const err = await res.json()
                                            setError(err.error || 'Failed to send')
                                          }
                                        } catch (e: any) {
                                          setError(e.message)
                                        } finally {
                                          setSendingResponse(false)
                                        }
                                      }}
                                   >
                                      {sendingResponse ? 'Sending...' : 'Send Message'}
                                   </Button>
                                   <Button variant="ghost" onClick={() => setShowEmailResponseForm(false)}>Cancel</Button>
                                 </div>
                                 {error && <p className="text-sm text-red-600">{error}</p>}
                               </div>
                             )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                ) : selectedBid ? (
                  // Bid View
                  <div className="flex flex-col h-full">
                    {/* Subcontractor Header */}
                    <div className="bg-white border-b p-6 pb-0">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-gray-900">
                              {selectedBid.subcontractors?.name || selectedBid.gc_contacts?.name || selectedBid.subcontractor_email || 'Unknown Subcontractor'}
                            </h2>
                            <Badge variant={selectedBid.status === 'accepted' ? 'default' : 'outline'}>
                              {selectedBid.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {selectedBid.subcontractors?.email || selectedBid.gc_contacts?.email || selectedBid.subcontractor_email}
                            </div>
                            {(selectedBid.subcontractors?.phone || selectedBid.gc_contacts?.phone) && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3.5 w-3.5" />
                                {selectedBid.subcontractors?.phone || selectedBid.gc_contacts?.phone}
                              </div>
                            )}
                            {selectedBid.subcontractors?.website_url && (
                              <div className="flex items-center gap-1">
                                <Globe className="h-3.5 w-3.5" />
                                <a href={selectedBid.subcontractors.website_url} target="_blank" rel="noreferrer" className="hover:underline text-blue-600">
                                  Website
                                </a>
                              </div>
                            )}
                            {selectedBid.subcontractors?.google_review_score && (
                              <div className="flex items-center gap-1 text-orange-600">
                                <span>★</span>
                                {selectedBid.subcontractors.google_reviews_link ? (
                                  <a 
                                    href={selectedBid.subcontractors.google_reviews_link} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="hover:underline font-medium"
                                  >
                                    {selectedBid.subcontractors.google_review_score}
                                  </a>
                                ) : (
                                  <span className="font-medium">{selectedBid.subcontractors.google_review_score}</span>
                                )}
                                <span className="text-gray-400 text-xs">/ 5.0</span>
                              </div>
                            )}
                            {selectedBid.gc_contacts?.company && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {selectedBid.gc_contacts.company}
                              </div>
                            )}
                            {selectedBid.gc_contacts?.location && (
                              <div className="flex items-center gap-1">
                                <span>{selectedBid.gc_contacts.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-gray-900">
                            ${selectedBid.bid_amount?.toLocaleString() ?? '0.00'}
                          </div>
                          <div className="text-sm text-gray-500">Total Bid Amount</div>
                        </div>
                      </div>

                      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'comparison')} className="w-full">
                        <TabsList className="bg-transparent border-b rounded-none p-0 h-auto w-full justify-start gap-6">
                          <TabsTrigger 
                            value="details"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 px-4 py-3"
                          >
                            Bid Details
                          </TabsTrigger>
                          <TabsTrigger 
                            value="comparison"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 px-4 py-3"
                          >
                            Comparison Analysis
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
                      <Tabs value={activeTab} className="space-y-6">
                        <TabsContent value="details" className="mt-0 space-y-6">
                          {/* Stats Cards */}
                          <div className={`grid grid-cols-1 gap-4 ${selectedBid.bid_attachments && selectedBid.bid_attachments.length > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                            <Card>
                              <CardContent className="p-4">
                                <div className="text-sm font-medium text-gray-500 mb-1">Scope Coverage</div>
                                <div className="text-2xl font-bold text-gray-900">{bidLineItems.length} Items</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="text-sm font-medium text-gray-500 mb-1">Timeline</div>
                                <div className="text-2xl font-bold text-gray-900">{selectedBid.timeline || 'Not specified'}</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="p-4">
                                <div className="text-sm font-medium text-gray-500 mb-1">AI Summary</div>
                                <div className="text-sm text-gray-600 line-clamp-2">{selectedBid.ai_summary || 'No summary available'}</div>
                              </CardContent>
                            </Card>
                            {selectedBid.bid_attachments && selectedBid.bid_attachments.length > 0 && (
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="text-sm font-medium text-gray-500 mb-1">Attachments</div>
                                        <div className="space-y-2">
                                            {selectedBid.bid_attachments.map(att => (
                                                <div key={att.id} className="flex items-center justify-between gap-2 text-sm">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                        <span className="truncate text-gray-700" title={att.file_name}>
                                                            {att.file_name}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex-shrink-0"
                                                        onClick={(e) => handleDownloadAttachment(att.file_path, att.file_name, e)}
                                                        disabled={downloadingAttachment === att.file_path}
                                                    >
                                                        {downloadingAttachment === att.file_path ? (
                                                          <>
                                                            <div className="h-3.5 w-3.5 mr-1 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                            Downloading...
                                                          </>
                                                        ) : (
                                                          <>
                                                            <Download className="h-3.5 w-3.5 mr-1" />
                                                            Download
                                                          </>
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                          </div>

                          {/* Line Items Table - Redesigned */}
                          <Card className="overflow-hidden border-gray-200 shadow-sm">
                            <CardHeader className="bg-white border-b py-4">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-600" />
                                Bid Line Items
                              </CardTitle>
                            </CardHeader>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                  <tr>
                                    <th className="px-6 py-3 font-medium w-[100px]">Cost Code</th>
                                    <th className="px-6 py-3 font-medium">Description</th>
                                    <th className="px-6 py-3 font-medium">Category</th>
                                    <th className="px-6 py-3 font-medium text-right">Qty</th>
                                    <th className="px-6 py-3 font-medium text-right">Unit Price</th>
                                    <th className="px-6 py-3 font-medium text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {bidLineItems.length > 0 ? (
                                    bidLineItems.map((item) => (
                                      <tr key={item.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4 text-gray-500">
                                          {item.cost_code ? (
                                            <span className="font-mono text-xs">{item.cost_code}</span>
                                          ) : (
                                            item.item_number
                                          )}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                          {item.description}
                                          {item.notes && <div className="text-xs text-gray-500 font-normal mt-1">{item.notes}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                          <Badge variant="secondary" className="font-normal bg-gray-100 text-gray-600">
                                            {item.category}
                                          </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right tabular-nums">
                                          {item.quantity ? (
                                            <span>
                                              {item.quantity} <span className="text-gray-400 text-xs">{item.unit}</span>
                                            </span>
                                          ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right tabular-nums">
                                          {item.unit_price ? `$${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium tabular-nums">
                                          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No line items found in this bid.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                                {bidLineItems.length > 0 && (
                                  <tfoot className="bg-gray-50 border-t font-semibold text-gray-900">
                                    <tr>
                                      <td colSpan={5} className="px-6 py-4 text-right">Total</td>
                                      <td className="px-6 py-4 text-right">
                                        ${bidLineItems.reduce((sum, i) => sum + i.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          </Card>

                          {/* Notes Section */}
                          {selectedBid.notes && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base">Bidder Notes</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-gray-700 whitespace-pre-wrap">{selectedBid.notes}</p>
                              </CardContent>
                            </Card>
                          )}
                        </TabsContent>

                        <TabsContent value="comparison" className="mt-0 space-y-6">
                          {takeoffItems.length > 0 ? (
                            <>
                              {/* Comparison Summary Cards */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-blue-50 border-blue-100">
                                  <CardContent className="p-4 text-center">
                                    <div className="text-sm text-blue-600 font-medium mb-1">Takeoff Estimate</div>
                                    <div className="text-2xl font-bold text-blue-700">
                                      ${(simplifiedMetrics?.takeoffTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-green-50 border-green-100">
                                  <CardContent className="p-4 text-center">
                                    <div className="text-sm text-green-600 font-medium mb-1">Bid Total</div>
                                    <div className="text-2xl font-bold text-green-700">
                                      ${(simplifiedMetrics?.bidTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card className={`border-l-4 ${simplifiedMetrics && simplifiedMetrics.discrepancyCount > 0 ? 'border-l-orange-500' : 'border-l-green-500'}`}>
                                  <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                      <div className="text-sm text-gray-500">Match Rate</div>
                                      <div className="text-2xl font-bold text-gray-900">{simplifiedMetrics?.matchPercentage || 0}%</div>
                                    </div>
                                    {simplifiedMetrics && simplifiedMetrics.discrepancyCount > 0 && (
                                      <div className="text-right">
                                        <div className="text-sm text-orange-600 font-medium">Discrepancies</div>
                                        <div className="text-2xl font-bold text-orange-600">{simplifiedMetrics.discrepancyCount}</div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Comparison Tool */}
                              <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6 h-[600px]">
                                {/* Selection Panel */}
                                <Card className="flex flex-col h-full">
                                  <CardHeader className="py-3 px-4 border-b">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium">Takeoff Items</CardTitle>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 text-xs"
                                          onClick={() => {
                                            if (selectedTakeoffItemIds.size === takeoffItems.length) {
                                              setSelectedTakeoffItemIds(new Set())
                                            } else {
                                              setSelectedTakeoffItemIds(new Set(takeoffItems.map(i => i.id)))
                                            }
                                          }}
                                        >
                                          {selectedTakeoffItemIds.size === takeoffItems.length ? 'None' : 'All'}
                                        </Button>
                                      </div>
                                      <div className="relative">
                                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                        <Input
                                          placeholder="Search items..."
                                          value={takeoffSearchTerm}
                                          onChange={(e) => setTakeoffSearchTerm(e.target.value)}
                                          className="h-8 pl-8 text-xs"
                                        />
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {takeoffItems
                                      .filter(item => 
                                        !takeoffSearchTerm || 
                                        item.description.toLowerCase().includes(takeoffSearchTerm.toLowerCase()) ||
                                        item.category.toLowerCase().includes(takeoffSearchTerm.toLowerCase())
                                      )
                                      .map(item => (
                                      <div 
                                        key={item.id}
                                        onClick={() => {
                                          const newSet = new Set(selectedTakeoffItemIds)
                                          if (newSet.has(item.id)) newSet.delete(item.id)
                                          else newSet.add(item.id)
                                          setSelectedTakeoffItemIds(newSet)
                                        }}
                                        className={`
                                          flex items-center gap-3 p-2 rounded-md cursor-pointer text-sm transition-colors
                                          ${selectedTakeoffItemIds.has(item.id) ? 'bg-orange-50 text-orange-900' : 'hover:bg-gray-100 text-gray-600'}
                                        `}
                                      >
                                        <Checkbox checked={selectedTakeoffItemIds.has(item.id)} className="pointer-events-none" />
                                        <div className="flex-1 truncate">
                                          <div className="font-medium truncate">{item.description}</div>
                                          <div className="text-xs opacity-70">{item.quantity} {item.unit}</div>
                                        </div>
                                      </div>
                                    ))}
                                    {takeoffItems.filter(item => 
                                      !takeoffSearchTerm || 
                                      item.description.toLowerCase().includes(takeoffSearchTerm.toLowerCase()) ||
                                      item.category.toLowerCase().includes(takeoffSearchTerm.toLowerCase())
                                    ).length === 0 && (
                                      <div className="text-center py-4 text-xs text-gray-500">
                                        No items found
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>

                                {/* Comparison Table */}
                                <Card className="flex flex-col h-full overflow-hidden">
                                  <CardHeader className="py-3 px-4 border-b bg-gray-50">
                                    <div className="grid grid-cols-2 gap-4 font-medium text-sm">
                                      <div className="text-blue-700">Your Takeoff</div>
                                      <div className="text-green-700">Bidder Line Item</div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="flex-1 overflow-y-auto p-0">
                                    <div className="divide-y">
                                      {takeoffItems
                                        .filter(item => selectedTakeoffItemIds.has(item.id))
                                        .map(takeoffItem => {
                                          const matchingBidItem = bidLineItems.find(bi => 
                                            bi.description.toLowerCase().includes(takeoffItem.description.toLowerCase()) ||
                                            takeoffItem.description.toLowerCase().includes(bi.description.toLowerCase())
                                          )
                                          const discrepancy = discrepancies.find(d => d.takeoffItem?.id === takeoffItem.id)
                                          
                                          return (
                                            <div key={takeoffItem.id} className={`grid grid-cols-2 gap-4 p-4 ${discrepancy ? 'bg-orange-50/30' : ''}`}>
                                              {/* Takeoff Side */}
                                              <div className="pr-4 border-r">
                                                <div className="flex justify-between items-start">
                                                  <div>
                                                    <div className="font-medium text-sm text-gray-900">{takeoffItem.description}</div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                      {takeoffItem.quantity} {takeoffItem.unit} 
                                                      {takeoffItem.unit_cost && ` @ $${takeoffItem.unit_cost}/unit`}
                                                    </div>
                                                  </div>
                                                  {takeoffItem.unit_cost && (
                                                    <div className="font-bold text-blue-600">
                                                      ${(takeoffItem.quantity * takeoffItem.unit_cost).toLocaleString()}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Bid Side */}
                                              <div className="pl-4">
                                                {matchingBidItem ? (
                                                  <div className="flex justify-between items-start">
                                                    <div>
                                                      <div className="font-medium text-sm text-gray-900">{matchingBidItem.description}</div>
                                                      <div className="text-xs text-gray-500 mt-1">
                                                        {matchingBidItem.quantity} {matchingBidItem.unit}
                                                        {matchingBidItem.unit_price && ` @ $${matchingBidItem.unit_price}/unit`}
                                                      </div>
                                                      {discrepancy && (
                                                        <Badge variant="outline" className="mt-2 text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                          {discrepancy.type === 'quantity' ? `Qty mismatch (${discrepancy.percentage?.toFixed(0)}%)` : 'Price mismatch'}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                    <div className={`font-bold ${discrepancy ? 'text-orange-600' : 'text-green-600'}`}>
                                                      ${matchingBidItem.amount.toLocaleString()}
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <div className="text-sm text-gray-400 italic flex items-center gap-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    Not found in bid
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )
                                        })}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </>
                          ) : (
                             <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                               <GitCompare className="h-16 w-16 mb-4 text-gray-300" />
                               <p>No takeoff data available to compare against.</p>
                             </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                ) : (
                  // Empty State
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-50">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                      <Search className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Select a Bid or Email</h3>
                    <p className="max-w-sm text-center mt-2 text-sm">
                      Choose a bid from the sidebar to view its details and compare it against your takeoff, or view email communications.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
