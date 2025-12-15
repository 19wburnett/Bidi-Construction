'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { modalBackdrop, modalContent } from '@/lib/animations'
import { BidComparisonAISidebar } from '@/components/bid-comparison-ai-sidebar'

interface BidComparisonModalProps {
  jobId: string
  isOpen: boolean
  onClose: () => void
  inline?: boolean
  initialBidId?: string | null
  refreshTrigger?: number
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
  decline_reason?: string | null
  accepted_at?: string | null
  declined_at?: string | null
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
  bid_id: string
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
  subcontractor?: string | null // Trade category/subcontractor type
}

export default function BidComparisonModal({ 
  jobId, 
  isOpen, 
  onClose,
  inline = false,
  initialBidId = null,
  refreshTrigger = 0
}: BidComparisonModalProps) {
  const [selectedBidId, setSelectedBidId] = useState<string | null>(initialBidId)
  const [bids, setBids] = useState<Bid[]>([])
  const [bidLineItems, setBidLineItems] = useState<BidLineItem[]>([])
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([])
  const [selectedTakeoffItemIds, setSelectedTakeoffItemIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailStatuses, setEmailStatuses] = useState<Record<string, any>>({})
  const [allRecipients, setAllRecipients] = useState<any[]>([])
  const [emailThreads, setEmailThreads] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState<'details' | 'comparison'>('details')
  const [leftSideTab, setLeftSideTab] = useState<'bids' | 'emails'>('bids')
  const [selectedEmailRecipient, setSelectedEmailRecipient] = useState<any | null>(null)
  const [responseText, setResponseText] = useState('')
  const [sendingResponse, setSendingResponse] = useState(false)
  const [takeoffSearchTerm, setTakeoffSearchTerm] = useState('')
  const [comparisonMode, setComparisonMode] = useState<'takeoff' | 'bids'>('takeoff')
  const [selectedComparisonBidIds, setSelectedComparisonBidIds] = useState<Set<string>>(new Set())
  const [comparisonBidLineItems, setComparisonBidLineItems] = useState<Record<string, BidLineItem[]>>({})
  const [loadingComparisonBids, setLoadingComparisonBids] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showAISidebar, setShowAISidebar] = useState(false)
  const [aiMatches, setAiMatches] = useState<any>(null)
  const [takeoffAIMatches, setTakeoffAIMatches] = useState<any>(null)
  const [takeoffAIAnalysis, setTakeoffAIAnalysis] = useState<any>(null)
  const [loadingTakeoffAI, setLoadingTakeoffAI] = useState(false)
  const [takeoffAIError, setTakeoffAIError] = useState<string | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [isTakeoffCached, setIsTakeoffCached] = useState(false)
  const [showDeclinePopover, setShowDeclinePopover] = useState(false)
  const [customDeclineReason, setCustomDeclineReason] = useState<string>('')
  const [processingBidAction, setProcessingBidAction] = useState(false)
  const [fetchedEmailContent, setFetchedEmailContent] = useState<Record<string, string>>({})
  const [fetchingEmailContent, setFetchingEmailContent] = useState<Set<string>>(new Set())
  
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && jobId) {
      loadData()
      if (initialBidId) {
        setSelectedBidId(initialBidId)
      }
    }
  }, [isOpen, jobId, initialBidId, refreshTrigger])

  // Poll for email updates every 10 seconds when modal is open
  useEffect(() => {
    if (!isOpen || !jobId) {
      console.log('📧 Polling stopped: isOpen=', isOpen, 'jobId=', jobId)
      return
    }

    console.log('📧 Starting email polling for job:', jobId)

    // Only reload email statuses, not all data (to avoid disrupting user)
    const refreshEmailStatuses = async () => {
      try {
        console.log('📧 Polling: Fetching email statuses for job:', jobId)
        const statusResponse = await fetch(`/api/jobs/${jobId}/email-statuses`, {
          cache: 'no-store', // Ensure we don't get cached responses
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        console.log('📧 Polling: Response status:', statusResponse.status)
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          console.log('📧 Polling: Received data, recipients:', statusData.recipients?.length, 'threads:', statusData.threads?.length)
          
          if (statusData.recipients && Array.isArray(statusData.recipients)) {
            console.log('📧 Polling: recipients is array, length:', statusData.recipients.length)
            console.log('📧 Polling: threads exists?', !!statusData.threads, 'is array?', Array.isArray(statusData.threads), 'length:', statusData.threads?.length)
            if (statusData.threads && Array.isArray(statusData.threads)) {
              console.log('📧 Polling: Processing threads:', statusData.threads.length)
              const threadRecipients = statusData.threads.map((thread: any) => {
                const latest = thread.latest_message
                console.log('📧 Polling: Thread', thread.thread_id, 'has', thread.message_count, 'messages')
                console.log('  - Latest message status:', latest?.status, 'opened_at:', latest?.opened_at, 'responded_at:', latest?.responded_at)
                return latest
              })
              console.log('📧 Polling: All recipient statuses:', threadRecipients.map((r: any) => ({ 
                id: r.id,
                email: r.subcontractor_email, 
                status: r.status,
                opened_at: r.opened_at,
                responded_at: r.responded_at,
                isFromGC: r.isFromGC
              })))
              setAllRecipients(threadRecipients)
              console.log('📧 Polling: Updated allRecipients with', threadRecipients.length, 'recipients')
              
              // Force a re-render by logging the state
              console.log('📧 Polling: Current allRecipients state will have', threadRecipients.length, 'items')
              
              const threadsMap: Record<string, any> = {}
              statusData.threads.forEach((thread: any) => {
                threadsMap[thread.thread_id] = thread
              })
              setEmailThreads(threadsMap)
              console.log('📧 Polling: Updated emailThreads with', Object.keys(threadsMap).length, 'threads')
              
              // Update selected recipient if viewing a thread (use functional update to get current value)
              setSelectedEmailRecipient((current: any | null) => {
                if (!current) return current
                const threadId = current.thread_id || 
                  `thread-${current.bid_package_id || current.bid_packages?.id}-${current.subcontractor_email}`
                const updatedThread = threadsMap[threadId]
                if (updatedThread && updatedThread.latest_message) {
                  return updatedThread.latest_message
                }
                return current
              })
            } else {
              setAllRecipients(statusData.recipients)
              const threadsMap: Record<string, any> = {}
              statusData.recipients.forEach((recipient: any) => {
                const threadId = recipient.thread_id || `thread-${recipient.bid_package_id}-${recipient.subcontractor_email}`
                if (!threadsMap[threadId]) {
                  threadsMap[threadId] = {
                    thread_id: threadId,
                    original_email: recipient,
                    messages: [recipient],
                    latest_message: recipient,
                    message_count: 1
                  }
                } else {
                  threadsMap[threadId].messages.push(recipient)
                  threadsMap[threadId].latest_message = recipient
                  threadsMap[threadId].message_count = threadsMap[threadId].messages.length
                }
              })
              setEmailThreads(threadsMap)
            }
            
            const statusMap: Record<string, any> = {}
            statusData.recipients.forEach((recipient: any) => {
              statusMap[recipient.subcontractor_email] = recipient
            })
            setEmailStatuses(statusMap)
          }
        } else {
          const errorText = await statusResponse.text()
          console.error('📧 Polling: Error response:', statusResponse.status, errorText)
        }
      } catch (err) {
        console.error('📧 Polling: Error polling email statuses:', err)
      }
    }

    // Poll immediately, then every 10 seconds
    refreshEmailStatuses()
    const pollInterval = setInterval(refreshEmailStatuses, 10000)

    return () => {
      console.log('📧 Polling stopped: Cleaning up interval')
      clearInterval(pollInterval)
    }
  }, [isOpen, jobId]) // Removed selectedEmailRecipient from dependencies to avoid restarting polling

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
            // Use threads if available, otherwise use flat recipients list
            if (statusData.threads && Array.isArray(statusData.threads)) {
              // Build recipients list from threads (use latest message for each thread)
              console.log('📧 loadData: Processing threads:', statusData.threads.length)
              const threadRecipients = statusData.threads.map((thread: any) => {
                console.log('📧 loadData: Thread', thread.thread_id, 'has', thread.message_count, 'messages, latest status:', thread.latest_message?.status)
                return thread.latest_message
              })
              setAllRecipients(threadRecipients)
              console.log('📧 loadData: Updated allRecipients with', threadRecipients.length, 'recipients')
              
              // Store full thread data for display
              const threadsMap: Record<string, any> = {}
              statusData.threads.forEach((thread: any) => {
                threadsMap[thread.thread_id] = thread
              })
              setEmailThreads(threadsMap)
              console.log('📧 loadData: Updated emailThreads with', Object.keys(threadsMap).length, 'threads')
            } else {
            setAllRecipients(statusData.recipients)
              // Build threads from recipients if threads not provided
              const threadsMap: Record<string, any> = {}
              statusData.recipients.forEach((recipient: any) => {
                const threadId = recipient.thread_id || `thread-${recipient.bid_package_id}-${recipient.subcontractor_email}`
                if (!threadsMap[threadId]) {
                  threadsMap[threadId] = {
                    thread_id: threadId,
                    original_email: recipient,
                    messages: [recipient],
                    latest_message: recipient,
                    message_count: 1
                  }
                } else {
                  threadsMap[threadId].messages.push(recipient)
                  threadsMap[threadId].latest_message = recipient
                  threadsMap[threadId].message_count = threadsMap[threadId].messages.length
                }
              })
              setEmailThreads(threadsMap)
            }
            
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
            unit_cost: Number(item.unit_cost) || null,
            subcontractor: item.subcontractor || item.trade_category || null
          }))
          
          setTakeoffItems(typedItems)
          // Don't auto-select all items - let filtering handle it
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

  async function loadComparisonBidLineItems(bidIds: string[]) {
    if (bidIds.length === 0) {
      setComparisonBidLineItems({})
      return
    }

    setLoadingComparisonBids(true)
    try {
      const { data, error: itemsError } = await supabase
        .from('bid_line_items')
        .select('*')
        .in('bid_id', bidIds)
        .order('item_number', { ascending: true })

      if (itemsError) throw itemsError

      // Group line items by bid_id
      const grouped: Record<string, BidLineItem[]> = {}
      bidIds.forEach(bidId => {
        grouped[bidId] = []
      })
      
      if (data) {
        data.forEach(item => {
          if (!grouped[item.bid_id]) {
            grouped[item.bid_id] = []
          }
          grouped[item.bid_id].push(item)
        })
      }

      setComparisonBidLineItems(grouped)
    } catch (err) {
      console.error('Error loading comparison bid line items:', err)
    } finally {
      setLoadingComparisonBids(false)
    }
  }

  useEffect(() => {
    if (selectedBidId) {
      loadBidLineItems(selectedBidId)
      setActiveTab('details')
      // Reset comparison mode and selections when bid changes
      setComparisonMode('takeoff')
      setSelectedComparisonBidIds(new Set())
      setShowAISidebar(false)
    }
  }, [selectedBidId])

  useEffect(() => {
    if (comparisonMode === 'bids' && selectedComparisonBidIds.size > 0) {
      loadComparisonBidLineItems(Array.from(selectedComparisonBidIds))
      // Trigger AI analysis when bids are selected
      if (selectedBidId && selectedComparisonBidIds.size > 0) {
        generateAIComparison()
      }
    } else {
      setComparisonBidLineItems({})
      setAiAnalysis(null)
      setAiMatches(null)
    }
  }, [selectedComparisonBidIds, comparisonMode, selectedBidId])

  // Calculate selectedBid and filteredTakeoffItems before useEffects that depend on them
  const selectedBid = bids.find(b => b.id === selectedBidId)
  
  // Get the category of the selected bid
  const getSelectedBidCategory = () => {
    if (!selectedBid) return null
    return selectedBid.subcontractors?.trade_category || 
           selectedBid.gc_contacts?.trade_category || 
           (selectedBid.bid_packages as any)?.trade_category || 
           null
  }

  // Filter takeoff items to only those matching the selected bid's trade category
  const filteredTakeoffItems = useMemo(() => {
    const bidCategory = getSelectedBidCategory()
    if (!bidCategory) {
      // If no bid selected or no category, return empty array (don't show all items)
      return []
    }
    
    if (takeoffItems.length === 0) {
      return []
    }

    // Filter items that match the trade category (case-insensitive)
    return takeoffItems.filter(item => {
      if (!item.subcontractor) return false
      // Normalize both for comparison (trim, lowercase)
      const itemSub = item.subcontractor.trim().toLowerCase()
      const bidCat = bidCategory.trim().toLowerCase()
      return itemSub === bidCat
    })
  }, [selectedBid, takeoffItems])

  useEffect(() => {
    if (comparisonMode === 'takeoff' && selectedBidId && filteredTakeoffItems.length > 0 && bidLineItems.length > 0 && selectedTakeoffItemIds.size > 0) {
      // Trigger AI analysis for takeoff comparison
      generateTakeoffAIComparison()
    } else if (comparisonMode !== 'takeoff') {
      setTakeoffAIMatches(null)
      setTakeoffAIAnalysis(null)
    }
  }, [comparisonMode, selectedBidId, filteredTakeoffItems.length, bidLineItems.length, selectedTakeoffItemIds.size])

  async function generateAIComparison(forceRefresh = false) {
    if (!selectedBidId || selectedComparisonBidIds.size === 0) return

    setLoadingAI(true)
    setAiError(null)
    setIsCached(false)
    
    try {
      const response = await fetch('/api/bids/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedBidId,
          comparisonBidIds: Array.from(selectedComparisonBidIds),
          jobId,
          forceRefresh,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate AI comparison')
      }

      const data = await response.json()
      setAiMatches(data.matches)
      setAiAnalysis(data.analysis)
      setIsCached(data.cached || false)
    } catch (err: any) {
      console.error('Error generating AI comparison:', err)
      setAiError(err.message || 'Failed to generate AI analysis')
    } finally {
      setLoadingAI(false)
    }
  }

  async function generateTakeoffAIComparison(forceRefresh = false) {
    if (!selectedBidId || filteredTakeoffItems.length === 0 || bidLineItems.length === 0) return

    setLoadingTakeoffAI(true)
    setTakeoffAIError(null)
    setIsTakeoffCached(false)
    
    try {
      // Use filtered items that are selected
      const itemsToCompare = filteredTakeoffItems.filter(item => selectedTakeoffItemIds.has(item.id))
      
      const response = await fetch('/api/bids/compare-takeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidId: selectedBidId,
          jobId,
          takeoffItems: itemsToCompare,
          forceRefresh,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate takeoff AI comparison')
      }

      const data = await response.json()
      setTakeoffAIMatches(data.matches)
      setTakeoffAIAnalysis(data.analysis)
      setIsTakeoffCached(data.cached || false)
    } catch (err: any) {
      console.error('Error generating takeoff AI comparison:', err)
      setTakeoffAIError(err.message || 'Failed to generate takeoff AI analysis')
    } finally {
      setLoadingTakeoffAI(false)
    }
  }

  // Default to emails tab when there are no bids
  useEffect(() => {
    if (bids.length === 0 && allRecipients.length > 0) {
      setLeftSideTab('emails')
    }
  }, [bids.length, allRecipients.length])

  // Function to clean email content by removing HTML/CSS and extracting text
  const cleanEmailContent = (content: string): string => {
    if (!content) return ''
    
    // Remove style tags and their content
    let cleaned = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    
    // Remove script tags and their content
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    
    // Remove CSS in style attributes
    cleaned = cleaned.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '')
    
    // Remove HTML tags but keep the text content
    cleaned = cleaned.replace(/<[^>]+>/g, ' ')
    
    // Decode HTML entities
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    
    return cleaned
  }

  // Auto-select all takeoff items when they're loaded
  // Auto-select filtered takeoff items when bid is selected or items change
  useEffect(() => {
    if (filteredTakeoffItems.length > 0) {
      // Only auto-select if no items are currently selected, or if the filtered set changed
      const filteredIds = new Set(filteredTakeoffItems.map(item => item.id))
      const currentSelected = Array.from(selectedTakeoffItemIds)
      
      // If current selection doesn't match filtered items, update it
      if (currentSelected.length === 0 || 
          !currentSelected.every(id => filteredIds.has(id)) ||
          filteredIds.size !== currentSelected.length) {
        setSelectedTakeoffItemIds(filteredIds)
      }
    } else if (selectedBidId && filteredTakeoffItems.length === 0 && takeoffItems.length > 0) {
      // If we have a bid selected but no filtered items, clear selection
      setSelectedTakeoffItemIds(new Set())
    }
  }, [filteredTakeoffItems, selectedBidId, takeoffItems.length])

  useEffect(() => {
    if (selectedBid) {
      console.log('Selected Bid:', selectedBid)
      console.log('Subcontractor Info:', selectedBid.subcontractors)
    }
  }, [selectedBid])

  // Get other bids in the same category (excluding the selected bid)
  const getBidsInSameCategory = () => {
    if (!selectedBid) return []
    const category = getSelectedBidCategory()
    if (!category) return []
    
    return bids.filter(bid => {
      if (bid.id === selectedBidId) return false
      const bidCategory = bid.subcontractors?.trade_category || 
                         bid.gc_contacts?.trade_category || 
                         (bid.bid_packages as any)?.trade_category || 
                         null
      return bidCategory === category
    })
  }

  const sameCategoryBids = getBidsInSameCategory()

  // Calculate discrepancies between takeoff and bid
  const calculateDiscrepancies = () => {
    if (!selectedBid || filteredTakeoffItems.length === 0) {
      return []
    }

    const selectedTakeoffItems = filteredTakeoffItems.filter(item => selectedTakeoffItemIds.has(item.id))
    
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

  const handleSendMessage = async () => {
    if (!responseText.trim() || !selectedEmailRecipient?.id || sendingResponse) return
    const bidPackageId = selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id
    if (!bidPackageId) return

    setSendingResponse(true)
    setError('')
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
        setResponseText('')
        // Reload email statuses to get updated threads
        try {
          const statusResponse = await fetch(`/api/jobs/${jobId}/email-statuses`)
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            if (statusData.recipients && Array.isArray(statusData.recipients)) {
              if (statusData.threads && Array.isArray(statusData.threads)) {
                const threadRecipients = statusData.threads.map((thread: any) => thread.latest_message)
                setAllRecipients(threadRecipients)
                const threadsMap: Record<string, any> = {}
                statusData.threads.forEach((thread: any) => {
                  threadsMap[thread.thread_id] = thread
                })
                setEmailThreads(threadsMap)
                
                // Update selected recipient to show latest thread
                const threadId = selectedEmailRecipient.thread_id || 
                  `thread-${selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id}-${selectedEmailRecipient.subcontractor_email}`
                const updatedThread = threadsMap[threadId]
                if (updatedThread && updatedThread.latest_message) {
                  setSelectedEmailRecipient(updatedThread.latest_message)
                }
              } else {
                setAllRecipients(statusData.recipients)
                const threadsMap: Record<string, any> = {}
                statusData.recipients.forEach((recipient: any) => {
                  const threadId = recipient.thread_id || `thread-${recipient.bid_package_id}-${recipient.subcontractor_email}`
                  if (!threadsMap[threadId]) {
                    threadsMap[threadId] = {
                      thread_id: threadId,
                      original_email: recipient,
                      messages: [recipient],
                      latest_message: recipient,
                      message_count: 1
                    }
                  } else {
                    threadsMap[threadId].messages.push(recipient)
                    threadsMap[threadId].latest_message = recipient
                    threadsMap[threadId].message_count = threadsMap[threadId].messages.length
                  }
                })
                setEmailThreads(threadsMap)
                
                // Update selected recipient
                const updated = statusData.recipients.find((r: any) => 
                  r.thread_id === selectedEmailRecipient.thread_id ||
                  (r.subcontractor_email === selectedEmailRecipient.subcontractor_email && 
                   r.bid_package_id === (selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id))
                )
                if (updated) setSelectedEmailRecipient(updated)
              }
            }
          }
        } catch (e) {
          console.error('Error reloading email threads:', e)
        }
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to send')
      }
    } catch (e: any) {
      setError(e.message || 'Failed to send message')
    } finally {
      setSendingResponse(false)
    }
  }

  const calculateSimplifiedMetrics = () => {
    if (!selectedBid || filteredTakeoffItems.length === 0) {
      return null
    }

    const selectedTakeoffItems = filteredTakeoffItems.filter(item => selectedTakeoffItemIds.has(item.id))
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

  const handleAcceptBid = async () => {
    if (!selectedBid || processingBidAction) return

    setProcessingBidAction(true)
    try {
      const response = await fetch('/api/bids/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId: selectedBid.id })
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to accept bid')
        return
      }

      // Refresh data to show updated status
      await loadData()
      
      // Keep the same bid selected
      setSelectedBidId(selectedBid.id)
    } catch (err: any) {
      setError(err.message || 'Failed to accept bid')
    } finally {
      setProcessingBidAction(false)
    }
  }

  const handleSetToPending = async () => {
    if (!selectedBid || processingBidAction) return

    setProcessingBidAction(true)
    try {
      const response = await fetch('/api/bids/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId: selectedBid.id })
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to set bid to pending')
        return
      }

      // Refresh data to show updated status
      await loadData()
      
      // Keep the same bid selected
      setSelectedBidId(selectedBid.id)
    } catch (err: any) {
      setError(err.message || 'Failed to set bid to pending')
    } finally {
      setProcessingBidAction(false)
    }
  }

  const handleDeclineBid = async (reason: string) => {
    if (!selectedBid || processingBidAction || !reason || !reason.trim()) {
      return
    }

    setProcessingBidAction(true)
    setShowDeclinePopover(false) // Close popover
    try {
      const response = await fetch('/api/bids/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bidId: selectedBid.id,
          declineReason: reason.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to decline bid')
        return
      }

      // Refresh data
      setCustomDeclineReason('')
      await loadData()
      
      // Keep the same bid selected
      setSelectedBidId(selectedBid.id)
    } catch (err: any) {
      setError(err.message || 'Failed to decline bid')
    } finally {
      setProcessingBidAction(false)
    }
  }

  const declineReasons = [
    'Price too high',
    'Incomplete scope',
    'Timeline too long',
    'Missing required documents',
    'Doesn\'t meet specifications',
    'Other'
  ]

  const [downloadingAttachment, setDownloadingAttachment] = useState<string | null>(null)
  const [viewingAttachment, setViewingAttachment] = useState<{ path: string; fileName: string } | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  
  const handleDownloadAttachment = async (path: string, fileName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDownloadingAttachment(path)
    
    try {
      // Extract path from URL if path is a full URL
      let filePath = path
      if (filePath.includes('supabase.co/storage/v1/object/')) {
        // Extract path after 'bid-attachments/'
        const match = filePath.match(/bid-attachments\/(.+)$/)
        if (match) {
          filePath = match[1]
        }
      }
      
      // Use our API endpoint which sets proper Content-Disposition headers
      const downloadUrl = `/api/download-attachment?path=${encodeURIComponent(filePath)}&fileName=${encodeURIComponent(fileName)}`
      
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

  const [pdfError, setPdfError] = useState<string | null>(null)

  // Load PDF as blob for Safari/Mac compatibility
  useEffect(() => {
    if (viewingAttachment) {
      setPdfError(null)
      setPdfBlobUrl(null)
      const loadPdfBlob = async () => {
        try {
          // Extract path from URL if path is a full URL
          let filePath = viewingAttachment.path
          if (filePath.includes('supabase.co/storage/v1/object/')) {
            // Extract path after 'bid-attachments/'
            const match = filePath.match(/bid-attachments\/(.+)$/)
            if (match) {
              filePath = match[1]
            }
          }
          
          const response = await fetch(
            `/api/download-attachment?path=${encodeURIComponent(filePath)}&fileName=${encodeURIComponent(viewingAttachment.fileName)}&view=true`
          )
          
          if (!response.ok) {
            // Try to parse error message
            const errorData = await response.json().catch(() => ({ error: 'Failed to load PDF' }))
            throw new Error(errorData.error || `HTTP ${response.status}: Failed to load PDF`)
          }

          // Check if response is actually a PDF
          const contentType = response.headers.get('content-type')
          if (contentType && !contentType.includes('application/pdf')) {
            // If it's JSON, parse the error
            if (contentType.includes('application/json')) {
              const errorData = await response.json()
              throw new Error(errorData.error || 'Server returned JSON instead of PDF')
            }
            throw new Error(`Unexpected content type: ${contentType}`)
          }

          const blob = await response.blob()
          
          // Verify it's actually a PDF by checking the first few bytes
          // PDFs start with %PDF- (hex: 25 50 44 46 2D)
          const firstBytes = await blob.slice(0, 4).text()
          
          // Check if it's JSON by trying to parse the beginning
          if (firstBytes.trim().startsWith('{') || firstBytes.trim().startsWith('[')) {
            // It's likely JSON, read the full content
            const text = await blob.text()
            try {
              const json = JSON.parse(text)
              // Handle nested error objects
              let errorMsg = json.error
              if (typeof errorMsg === 'string') {
                try {
                  const nestedError = JSON.parse(errorMsg)
                  errorMsg = nestedError.error || nestedError.message || errorMsg
                } catch {
                  // Not nested JSON, use as is
                }
              }
              throw new Error(errorMsg || 'Server returned JSON instead of PDF')
            } catch (parseErr: any) {
              if (parseErr.message && parseErr.message !== text) {
                throw parseErr
              }
              throw new Error('Server returned invalid response (expected PDF, got JSON)')
            }
          }
          
          // Verify it's a PDF by checking the magic bytes
          if (!firstBytes.includes('%PDF')) {
            // Not a PDF, try to see if it's an error message
            const text = await blob.text()
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
              try {
                const json = JSON.parse(text)
                let errorMsg = json.error
                if (typeof errorMsg === 'string') {
                  try {
                    const nestedError = JSON.parse(errorMsg)
                    errorMsg = nestedError.error || nestedError.message || errorMsg
                  } catch {
                    // Not nested JSON
                  }
                }
                throw new Error(errorMsg || 'Server returned JSON instead of PDF')
              } catch {
                throw new Error('Invalid PDF file format')
              }
            }
            throw new Error('Invalid PDF file format')
          }

          const url = URL.createObjectURL(blob)
          setPdfBlobUrl(url)
        } catch (err: any) {
          console.error('Error loading PDF blob:', err)
          setPdfError(err.message || 'Failed to load PDF')
          setPdfBlobUrl(null)
        }
      }
      loadPdfBlob()
    } else {
      // Clean up blob URL when modal closes
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
        setPdfBlobUrl(null)
      }
      setPdfError(null)
    }

    // Cleanup on unmount
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
      }
    }
  }, [viewingAttachment])

  if (!isOpen) return null

  if (inline) {
    return (
      <div className="bg-white rounded-xl shadow-lg w-full h-full overflow-hidden flex flex-col border border-gray-200">
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
                    <div className="flex items-center justify-between mb-2">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadData}
                        disabled={loading}
                        className="ml-2 h-8 w-8 p-0"
                        title="Refresh data"
                      >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
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
                                    <div className="flex items-center gap-1">
                                      {recipient.has_clarifying_questions && (
                                        <Badge variant="destructive" className="h-2 w-2 p-0 rounded-full" />
                                      )}
                                      {recipient.response_text && (
                                        <Badge variant="default" className="h-2 w-2 p-0 rounded-full bg-orange-500" title="Has response" />
                                      )}
                                    </div>
                                  </div>
                                  {recipient.response_text && (
                                    <div className="text-xs text-gray-600 mt-1 mb-2 line-clamp-2 italic">
                                      "{recipient.response_text.substring(0, 80)}{recipient.response_text.length > 80 ? '...' : ''}"
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className={`
                                      text-[10px] px-1.5 py-0 h-5 capitalize border-0
                                      ${recipient.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                        recipient.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                          recipient.status === 'opened' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                                        recipient.status === 'responded' ? 'bg-orange-100 text-orange-700' :
                                        'bg-gray-100 text-gray-600'}
                                    `}>
                                        {recipient.status === 'opened' && <Eye className="h-2.5 w-2.5 mr-1" />}
                                      {recipient.status}
                                    </Badge>
                                      {recipient.status === 'opened' && !recipient.response_text && (
                                        <span className="text-[9px] text-purple-600 font-medium" title="Email opened but not yet responded">
                                          Viewed
                                        </span>
                                      )}
                                    </div>
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
                  // Email View - Chat Style
                  <div className="flex flex-col h-full bg-white">
                    {/* Header */}
                    <div className="border-b bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {selectedEmailRecipient.subcontractor_name || selectedEmailRecipient.subcontractors?.name || selectedEmailRecipient.subcontractor_email}
                        </h2>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {selectedEmailRecipient.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {selectedEmailRecipient.bid_packages?.trade_category || 'General'}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedEmailRecipient(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Chat Messages Container */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 bg-gray-50">
                        {(() => {
                          // Get thread for this recipient
                          const threadId = selectedEmailRecipient.thread_id || 
                            `thread-${selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id}-${selectedEmailRecipient.subcontractor_email}`
                          const thread = emailThreads[threadId]
                          const threadMessages = thread?.messages || [selectedEmailRecipient]
                          
                          // Sort messages by timestamp
                          const sortedMessages = [...threadMessages].sort((a, b) => {
                            const timeA = new Date(a.messageTimestamp || a.responded_at || a.sent_at || a.created_at).getTime()
                            const timeB = new Date(b.messageTimestamp || b.responded_at || b.sent_at || b.created_at).getTime()
                            return timeA - timeB
                          })
                          
                          if (sortedMessages.length === 0) {
                            return (
                              <div className="flex items-center justify-center h-full">
                                <p className="text-gray-400 text-sm">No messages yet</p>
                              </div>
                            )
                          }
                          
                          return sortedMessages.map((message: any, index: number) => {
                            const isFromGC = message.isFromGC !== undefined ? message.isFromGC : !!(message.resend_email_id && message.status === 'sent')
                            // Use fetched content if available, otherwise fall back to stored content
                            const messageContent = fetchedEmailContent[message.id] || message.response_text || message.notes || ''
                            const messageTime = message.responded_at || message.sent_at || message.created_at
                            
                            // Fetch email content if missing and we have a resend_email_id
                            if (!messageContent && message.resend_email_id && !fetchingEmailContent.has(message.id) && !fetchedEmailContent[message.id]) {
                              // Trigger async fetch
                              setFetchingEmailContent(prev => new Set(prev).add(message.id))
                              fetch(`/api/emails/${message.resend_email_id}/content`)
                                .then(res => res.json())
                                .then(data => {
                                  if (data.content) {
                                    setFetchedEmailContent(prev => ({
                                      ...prev,
                                      [message.id]: data.content
                                    }))
                                    // Also update the message in the thread if possible
                                    setEmailThreads(prev => {
                                      const updated = { ...prev }
                                      const threadId = message.thread_id || 
                                        `thread-${message.bid_package_id || message.bid_packages?.id}-${message.subcontractor_email}`
                                      if (updated[threadId]) {
                                        const updatedThread = { ...updated[threadId] }
                                        updatedThread.messages = updatedThread.messages.map((m: any) =>
                                          m.id === message.id ? { ...m, response_text: data.content } : m
                                        )
                                        updatedThread.latest_message = updatedThread.latest_message?.id === message.id
                                          ? { ...updatedThread.latest_message, response_text: data.content }
                                          : updatedThread.latest_message
                                        updated[threadId] = updatedThread
                                      }
                                      return updated
                                    })
                                  }
                                })
                                .catch(err => {
                                  console.error('Failed to fetch email content:', err)
                                })
                                .finally(() => {
                                  setFetchingEmailContent(prev => {
                                    const next = new Set(prev)
                                    next.delete(message.id)
                                    return next
                                  })
                                })
                            }
                            
                            // Debug logging
                            if (isFromGC && !messageContent) {
                              console.log('📧 [UI] GC message with no content:', {
                                id: message.id,
                                status: message.status,
                                hasResponseText: !!message.response_text,
                                responseText: message.response_text,
                                hasNotes: !!message.notes,
                                notes: message.notes,
                                isFromGC: message.isFromGC,
                                resendEmailId: message.resend_email_id
                              })
                            }
                            
                            const senderName = isFromGC ? 'You' : (message.subcontractor_name || message.subcontractors?.name || message.subcontractor_email || 'Subcontractor')
                            const prevMessage = index > 0 ? sortedMessages[index - 1] : null
                            const showAvatar = !prevMessage || prevMessage.isFromGC !== isFromGC
                            const getInitials = (name: string) => {
                              if (!name) return '?'
                              const parts = name.trim().split(/\s+/)
                              if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                              return name.substring(0, 2).toUpperCase()
                            }
                            const formatChatTime = (date: Date) => {
                              const now = new Date()
                              const diffMs = now.getTime() - date.getTime()
                              const diffMins = Math.floor(diffMs / 60000)
                              const diffHours = Math.floor(diffMs / 3600000)
                              const diffDays = Math.floor(diffMs / 86400000)
                              if (diffMins < 1) return 'Just now'
                              if (diffMins < 60) return `${diffMins}m ago`
                              if (diffHours < 24) return `${diffHours}h ago`
                              if (diffDays < 7) return `${diffDays}d ago`
                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            }
                            
                            return (
                              <div
                                key={message.id || `message-${index}`}
                                className={`flex items-end gap-2 ${isFromGC ? 'flex-row-reverse' : 'flex-row'} ${showAvatar ? 'mt-4' : 'mt-1'}`}
                              >
                                {/* Avatar */}
                                {showAvatar ? (
                                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm ${
                                    isFromGC ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                  }`}>
                                    {isFromGC ? 'Y' : getInitials(senderName)}
                                  </div>
                                ) : (
                                  <div className="w-8" />
                                )}
                                
                                {/* Message Bubble */}
                                <div className={`flex flex-col max-w-[75%] ${isFromGC ? 'items-end' : 'items-start'}`}>
                                  {showAvatar && (
                                    <span className={`text-xs text-gray-500 mb-1 px-1 ${isFromGC ? 'text-right' : 'text-left'}`}>
                                      {senderName}
                                    </span>
                                  )}
                                  <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                                    isFromGC
                                      ? 'bg-blue-600 text-white rounded-br-sm'
                                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                                  }`}>
                                    {fetchingEmailContent.has(message.id) ? (
                                      <div className="flex items-center gap-2">
                                        <div className={`animate-spin rounded-full h-3 w-3 border-2 ${isFromGC ? 'border-white border-t-transparent' : 'border-gray-400 border-t-transparent'}`}></div>
                                        <span className="text-xs">Loading...</span>
                                      </div>
                                    ) : (
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {messageContent ? cleanEmailContent(messageContent) : (isFromGC ? 'Email sent' : 'No message content available')}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`text-xs text-gray-400 mt-1 px-1 ${isFromGC ? 'text-right' : 'text-left'}`}>
                                    {formatChatTime(new Date(messageTime))}
                                  </span>
                                </div>
                              </div>
                            )
                          })
                        })()}
                        </div>

                        {/* Reply Input - Chat-like (iMessage style) */}
                        <div className="border-t bg-white p-3 flex-shrink-0">
                          <div className="flex items-end gap-2">
                            <div className="flex-1 flex items-end gap-2">
                              <Textarea
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                placeholder="Type a message..."
                                rows={1}
                                className="resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[44px] max-h-[120px] py-2.5 px-3 text-sm rounded-full"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    if (responseText.trim() && !sendingResponse) {
                                      handleSendMessage()
                                    }
                                  }
                                }}
                                style={{
                                  height: 'auto',
                                  minHeight: '44px',
                                }}
                                onInput={(e) => {
                                  const target = e.target as HTMLTextAreaElement
                                  target.style.height = 'auto'
                                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                                }}
                              />
                              <Button
                                size="icon"
                                disabled={sendingResponse || !responseText.trim()}
                                onClick={handleSendMessage}
                                className="h-[44px] w-[44px] rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                              >
                                {sendingResponse ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                ) : (
                                  <Mail className="h-4 w-4 text-white" />
                                )}
                              </Button>
                            </div>
                            {selectedEmailRecipient.bids?.length > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedBidId(selectedEmailRecipient.bids[0].id)
                                  setSelectedEmailRecipient(null)
                                  setLeftSideTab('bids')
                                }}
                                className="h-[44px] px-3 flex-shrink-0"
                              >
                                View Bid
                              </Button>
                            )}
                          </div>
                          {error && <p className="text-sm text-red-600 mt-2 px-1">{error}</p>}
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
                          <div className="flex flex-col gap-2 mt-4 items-end">
                            {/* Status Badge */}
                            {selectedBid.status === 'accepted' && (
                              <Badge variant="default" className="bg-green-600 mb-2">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Accepted
                              </Badge>
                            )}
                            {selectedBid.status === 'declined' && (
                              <Badge variant="destructive" className="mb-2">
                                <XCircle className="h-3 w-3 mr-1" />
                                Declined
                                {selectedBid.decline_reason && (
                                  <span className="ml-1">({selectedBid.decline_reason})</span>
                                )}
                              </Badge>
                            )}
                            {selectedBid.status === 'pending' && (
                              <Badge variant="outline" className="mb-2">
                                Pending
                              </Badge>
                            )}
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2 justify-end flex-wrap">
                              {/* Always show Decline button if not already declined */}
                              {selectedBid.status !== 'declined' && (
                                <Popover open={showDeclinePopover} onOpenChange={setShowDeclinePopover}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={processingBidAction}
                                      className="border-red-200 text-red-600 hover:bg-red-50"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Decline
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-2" align="end">
                                    <div className="space-y-1">
                                      <div className="px-2 py-1.5 text-sm font-semibold text-gray-700 border-b mb-1">
                                        Select Decline Reason
                                      </div>
                                      {declineReasons.map((reason) => (
                                        <button
                                          key={reason}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (reason === 'Other') {
                                              const customReason = prompt('Please provide a custom decline reason:')
                                              if (customReason && customReason.trim()) {
                                                handleDeclineBid(customReason.trim())
                                              }
                                            } else {
                                              handleDeclineBid(reason)
                                            }
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-red-50 hover:text-red-700 transition-colors"
                                        >
                                          {reason}
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                              {/* Always show Accept button if not already accepted */}
                              {selectedBid.status !== 'accepted' && (
                                <Button
                                  size="sm"
                                  onClick={handleAcceptBid}
                                  disabled={processingBidAction}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Accept Bid
                                </Button>
                              )}
                              {/* Always show Set to Pending if not already pending */}
                              {selectedBid.status !== 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSetToPending}
                                  disabled={processingBidAction}
                                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                >
                                  Set to Pending
                                </Button>
                              )}
                            </div>
                          </div>
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
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                        <span className="truncate text-gray-700" title={att.file_name}>
                                                            {att.file_name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            // Extract path from URL if file_path is a full URL
                                                            let filePath = att.file_path
                                                            if (filePath.includes('supabase.co/storage/v1/object/')) {
                                                                // Extract path after 'bid-attachments/'
                                                                const match = filePath.match(/bid-attachments\/(.+)$/)
                                                                if (match) {
                                                                    filePath = match[1]
                                                                }
                                                            }
                                                            setViewingAttachment({ path: filePath, fileName: att.file_name })
                                                        }}
                                                        >
                                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                                            View
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
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
                          {/* Comparison Mode Toggle */}
                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border">
                            <Button
                              variant={comparisonMode === 'takeoff' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setComparisonMode('takeoff')}
                              className={comparisonMode === 'takeoff' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                            >
                              Compare with Takeoff
                            </Button>
                            <Button
                              variant={comparisonMode === 'bids' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setComparisonMode('bids')}
                              className={comparisonMode === 'bids' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                              disabled={sameCategoryBids.length === 0}
                            >
                              Compare with Other Bids
                              {sameCategoryBids.length > 0 && (
                                <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                                  {sameCategoryBids.length}
                                </Badge>
                              )}
                            </Button>
                          </div>

                          {comparisonMode === 'takeoff' ? (
                            filteredTakeoffItems.length > 0 ? (
                            <>
                              {/* Trade Category Filter Notice */}
                              {getSelectedBidCategory() && (
                                <Card className="bg-blue-50 border-blue-200 mb-4">
                                  <CardContent className="p-3">
                                    <div className="flex items-center gap-2 text-sm text-blue-700">
                                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                        {getSelectedBidCategory()}
                                      </Badge>
                                      <span>Showing {filteredTakeoffItems.length} takeoff item{filteredTakeoffItems.length !== 1 ? 's' : ''} for this trade category</span>
                                      {takeoffItems.length > filteredTakeoffItems.length && (
                                        <span className="text-blue-600 text-xs">
                                          ({takeoffItems.length - filteredTakeoffItems.length} other items hidden)
                                        </span>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
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
                                            if (selectedTakeoffItemIds.size === filteredTakeoffItems.length) {
                                              setSelectedTakeoffItemIds(new Set())
                                            } else {
                                              setSelectedTakeoffItemIds(new Set(filteredTakeoffItems.map(i => i.id)))
                                            }
                                          }}
                                        >
                                          {selectedTakeoffItemIds.size === filteredTakeoffItems.length ? 'None' : 'All'}
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
                                    {filteredTakeoffItems.filter(item => 
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

                                {/* Comparison Table with AI */}
                                <div className="space-y-4">
                                  <Card className="flex flex-col h-full overflow-hidden">
                                    <CardHeader className="py-3 px-4 border-b bg-gray-50 flex flex-row items-center justify-between">
                                      <div className="grid grid-cols-2 gap-4 font-medium text-sm flex-1">
                                        <div className="text-blue-700">Your Takeoff</div>
                                        <div className="text-green-700">Bidder Line Item</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {loadingTakeoffAI && (
                                          <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                            <span>AI analyzing...</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                          {isTakeoffCached && (
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                              Cached
                                            </Badge>
                                          )}
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowAISidebar(!showAISidebar)}
                                            className="flex items-center gap-2"
                                          >
                                            <GitCompare className="h-4 w-4" />
                                            {showAISidebar ? 'Hide' : 'Show'} AI Analysis
                                          </Button>
                                          {isTakeoffCached && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => generateTakeoffAIComparison(true)}
                                              className="text-xs"
                                              title="Refresh analysis"
                                            >
                                              <Clock className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 overflow-y-auto p-0">
                                      {loadingTakeoffAI ? (
                                        <div className="flex items-center justify-center py-12">
                                          <div className="flex flex-col items-center gap-3">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                            <p className="text-gray-500 font-medium">AI analyzing takeoff comparison...</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="divide-y">
                                    {filteredTakeoffItems
                                      .filter(item => selectedTakeoffItemIds.has(item.id))
                                      .map(takeoffItem => {
                                              // Use AI matches if available, otherwise fall back to simple matching
                                              let aiMatch: any = null
                                              if (takeoffAIMatches && takeoffAIMatches.length > 0) {
                                                aiMatch = takeoffAIMatches.find((m: any) => m.takeoffItem.id === takeoffItem.id)
                                              }
                                              
                                              const matchingBidItem = aiMatch?.bidItem || 
                                                (aiMatch ? null : bidLineItems.find(bi => 
                                                  bi.description.toLowerCase().includes(takeoffItem.description.toLowerCase()) ||
                                                  takeoffItem.description.toLowerCase().includes(bi.description.toLowerCase())
                                                ))
                                              
                                              const discrepancy = discrepancies.find(d => d.takeoffItem?.id === takeoffItem.id)
                                              const hasVariance = aiMatch && (aiMatch.quantityVariance || aiMatch.priceVariance)
                                              
                                              return (
                                                <div key={takeoffItem.id} className={`grid grid-cols-2 gap-4 p-4 ${discrepancy || hasVariance ? 'bg-orange-50/30' : ''}`}>
                                                  {/* Takeoff Side */}
                                                  <div className="pr-4 border-r">
                                                    <div className="flex justify-between items-start">
                                                      <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                          <div className="font-medium text-sm text-gray-900">{takeoffItem.description}</div>
                                                          {aiMatch && aiMatch.confidence > 0 && (
                                                            <Badge 
                                                              variant="outline" 
                                                              className={`text-xs ${
                                                                aiMatch.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                aiMatch.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                'bg-orange-50 text-orange-700 border-orange-200'
                                                              }`}
                                                              title={aiMatch.notes || `${aiMatch.matchType} match`}
                                                            >
                                                              {aiMatch.confidence}% match
                                                            </Badge>
                                                          )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                          {takeoffItem.quantity} {takeoffItem.unit} 
                                                          {takeoffItem.unit_cost && ` @ $${takeoffItem.unit_cost}/unit`}
                                                        </div>
                                                      </div>
                                                      {takeoffItem.unit_cost && (
                                                        <div className="font-bold text-blue-600 ml-2">
                                                          ${(takeoffItem.quantity * takeoffItem.unit_cost).toLocaleString()}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Bid Side */}
                                                  <div className="pl-4">
                                                    {matchingBidItem ? (
                                                      <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                          <div className="font-medium text-sm text-gray-900">{matchingBidItem.description}</div>
                                                          <div className="text-xs text-gray-500 mt-1">
                                                            {matchingBidItem.quantity} {matchingBidItem.unit}
                                                            {matchingBidItem.unit_price && ` @ $${matchingBidItem.unit_price}/unit`}
                                                          </div>
                                                          {aiMatch && (aiMatch.quantityVariance || aiMatch.priceVariance) && (
                                                            <div className="mt-2 space-y-1">
                                                              {aiMatch.quantityVariance && aiMatch.quantityVariance > 20 && (
                                                                <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                  Qty variance: {aiMatch.quantityVariance.toFixed(0)}%
                                                                </Badge>
                                                              )}
                                                              {aiMatch.priceVariance && aiMatch.priceVariance > 15 && (
                                                                <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                  Price variance: {aiMatch.priceVariance.toFixed(0)}%
                                                                </Badge>
                                                              )}
                                                            </div>
                                                          )}
                                                          {discrepancy && !aiMatch && (
                                                            <Badge variant="outline" className="mt-2 text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                              {discrepancy.type === 'quantity' ? `Qty mismatch (${discrepancy.percentage?.toFixed(0)}%)` : 'Price mismatch'}
                                                            </Badge>
                                                          )}
                                                        </div>
                                                        <div className={`font-bold ml-2 ${discrepancy || hasVariance ? 'text-orange-600' : 'text-green-600'}`}>
                                                          ${matchingBidItem.amount.toLocaleString()}
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <div className="text-sm text-gray-400 italic flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4" />
                                                        {aiMatch ? 'No match found (AI analyzed)' : 'Not found in bid'}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )
                                            })}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>

                                  {/* AI Analysis Sidebar for Takeoff */}
                                  {comparisonMode === 'takeoff' && (
                                    <BidComparisonAISidebar
                                      isOpen={showAISidebar}
                                      onClose={() => setShowAISidebar(false)}
                                      loading={loadingTakeoffAI}
                                      error={takeoffAIError}
                                      analysis={takeoffAIAnalysis}
                                      bids={selectedBid ? [selectedBid] : []}
                                      onRetry={generateTakeoffAIComparison}
                                    />
                                  )}
                                </div>
                              </div>
                            </>
                            ) : getSelectedBidCategory() && takeoffItems.length > 0 ? (
                               <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                 <GitCompare className="h-16 w-16 mb-4 text-gray-300" />
                                 <p>No takeoff items found for trade category: <strong>{getSelectedBidCategory()}</strong></p>
                                 <p className="text-sm mt-2">The takeoff has {takeoffItems.length} item{takeoffItems.length !== 1 ? 's' : ''}, but none are tagged for this trade.</p>
                               </div>
                            ) : (
                               <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                 <GitCompare className="h-16 w-16 mb-4 text-gray-300" />
                                 <p>No takeoff data available to compare against.</p>
                               </div>
                            )
                          ) : (
                            // Bid-to-Bid Comparison Mode
                            sameCategoryBids.length > 0 ? (
                              <>
                                {/* Bid Selection Panel */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-base">Select Bids to Compare</CardTitle>
                                    <CardDescription>
                                      Choose other bids in the same category ({getSelectedBidCategory() || 'Unknown'}) to compare against
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {sameCategoryBids.map(bid => (
                                        <div
                                          key={bid.id}
                                          onClick={() => {
                                            const newSet = new Set(selectedComparisonBidIds)
                                            if (newSet.has(bid.id)) {
                                              newSet.delete(bid.id)
                                            } else {
                                              newSet.add(bid.id)
                                            }
                                            setSelectedComparisonBidIds(newSet)
                                          }}
                                          className={`
                                            cursor-pointer rounded-lg p-3 border transition-all
                                            ${selectedComparisonBidIds.has(bid.id)
                                              ? 'border-orange-400 bg-orange-50 shadow-md ring-1 ring-orange-400/20'
                                              : 'bg-white border-gray-200 hover:border-orange-200'
                                            }
                                          `}
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-semibold text-sm text-gray-900 truncate">
                                                {bid.subcontractors?.name || bid.gc_contacts?.name || bid.subcontractor_email || 'Unknown'}
                                              </h4>
                                              <p className="text-xs text-gray-500 truncate">
                                                {bid.subcontractors?.email || bid.gc_contacts?.email || bid.subcontractor_email}
                                              </p>
                                            </div>
                                            <Checkbox checked={selectedComparisonBidIds.has(bid.id)} className="pointer-events-none ml-2" />
                                          </div>
                                          <div className="text-lg font-bold text-gray-900">
                                            ${bid.bid_amount?.toLocaleString() ?? '0.00'}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Comparison Table with AI Sidebar */}
                                {selectedComparisonBidIds.size > 0 && (
                                  <div className="space-y-4">
                                    <Card className="overflow-hidden">
                                      <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between">
                                        <CardTitle className="text-base">Line Item Comparison</CardTitle>
                                        <div className="flex items-center gap-2">
                                          {loadingAI && (
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                              <span>AI analyzing...</span>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            {isCached && (
                                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                Cached
                                              </Badge>
                                            )}
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setShowAISidebar(!showAISidebar)}
                                              className="flex items-center gap-2"
                                            >
                                              <GitCompare className="h-4 w-4" />
                                              {showAISidebar ? 'Hide' : 'Show'} AI Analysis
                                            </Button>
                                            {isCached && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => generateAIComparison(true)}
                                                className="text-xs"
                                                title="Refresh analysis"
                                              >
                                                <Clock className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="p-0">
                                        {loadingComparisonBids || loadingAI ? (
                                          <div className="flex items-center justify-center py-12">
                                            <div className="flex flex-col items-center gap-3">
                                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                              <p className="text-gray-500 font-medium">
                                                {loadingAI ? 'AI analyzing bids...' : 'Loading comparison data...'}
                                              </p>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                              <thead className="bg-gray-50 border-b">
                                                <tr>
                                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                                                  <th className="px-4 py-3 text-center font-medium text-gray-700">Selected Bid</th>
                                                  {Array.from(selectedComparisonBidIds).map(bidId => {
                                                    const bid = bids.find(b => b.id === bidId)
                                                    return (
                                                      <th key={bidId} className="px-4 py-3 text-center font-medium text-gray-700">
                                                        {bid?.subcontractors?.name || bid?.gc_contacts?.name || bid?.subcontractor_email || 'Unknown'}
                                                      </th>
                                                    )
                                                  })}
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y">
                                                {bidLineItems.length > 0 ? (
                                                  bidLineItems.map(item => {
                                                    // Use AI matches if available, otherwise fall back to simple matching
                                                    let comparisonItems: Array<{ item: any; confidence?: number; matchType?: string; notes?: string } | null> = []
                                                    
                                                    if (aiMatches && aiMatches.length > 0) {
                                                      const aiMatch = aiMatches.find((m: any) => m.selectedBidItem.id === item.id)
                                                      if (aiMatch) {
                                                        // Use AI-matched items
                                                        comparisonItems = Array.from(selectedComparisonBidIds).map(bidId => {
                                                          const match = aiMatch.comparisonItems.find((ci: any) => ci.bidId === bidId)
                                                          return match ? { item: match.item, confidence: match.confidence, matchType: match.matchType, notes: match.notes } : null
                                                        })
                                                      } else {
                                                        // Fallback to simple matching
                                                        comparisonItems = Array.from(selectedComparisonBidIds).map(bidId => {
                                                          const compItems = comparisonBidLineItems[bidId] || []
                                                          const found = compItems.find(ci =>
                                                            ci.description.toLowerCase().includes(item.description.toLowerCase()) ||
                                                            item.description.toLowerCase().includes(ci.description.toLowerCase())
                                                          )
                                                          return found ? { item: found } : null
                                                        })
                                                      }
                                                    } else {
                                                      // Simple matching when AI not available
                                                      comparisonItems = Array.from(selectedComparisonBidIds).map(bidId => {
                                                        const compItems = comparisonBidLineItems[bidId] || []
                                                        const found = compItems.find(ci =>
                                                          ci.description.toLowerCase().includes(item.description.toLowerCase()) ||
                                                          item.description.toLowerCase().includes(ci.description.toLowerCase())
                                                        )
                                                        return found ? { item: found } : null
                                                      })
                                                    }

                                                    const allAmounts = [item.amount, ...comparisonItems.map(ci => ci?.item?.amount).filter(Boolean)]
                                                    const minAmount = Math.min(...allAmounts.map(a => a || Infinity))
                                                    const maxAmount = Math.max(...allAmounts.map(a => a || Infinity))
                                                    const hasVariance = maxAmount - minAmount > minAmount * 0.1 // 10% variance threshold

                                                    return (
                                                      <tr key={item.id} className={hasVariance ? 'bg-orange-50/30' : ''}>
                                                        <td className="px-4 py-3 font-medium text-gray-900">
                                                          <div className="flex items-center gap-2">
                                                            {item.description}
                                                            {comparisonItems.some(ci => ci?.confidence) && (
                                                              <Badge 
                                                                variant="outline" 
                                                                className={`text-xs ${
                                                                  comparisonItems.some(ci => ci?.confidence && ci.confidence >= 85) ? 'bg-green-50 text-green-700 border-green-200' :
                                                                  comparisonItems.some(ci => ci?.confidence && ci.confidence >= 70) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                  'bg-orange-50 text-orange-700 border-orange-200'
                                                                }`}
                                                                title={comparisonItems.find(ci => ci?.confidence)?.notes || ''}
                                                              >
                                                                {Math.max(...comparisonItems.map(ci => ci?.confidence || 0))}% match
                                                              </Badge>
                                                            )}
                                                          </div>
                                                          {item.notes && (
                                                            <div className="text-xs text-gray-500 font-normal mt-1">{item.notes}</div>
                                                          )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                          <div className="font-semibold text-gray-900">
                                                            ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                          </div>
                                                          {item.unit_price && (
                                                            <div className="text-xs text-gray-500">
                                                              @ ${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}/{item.unit || 'unit'}
                                                            </div>
                                                          )}
                                                          {item.quantity && item.unit && (
                                                            <div className="text-xs text-gray-500">
                                                              {item.quantity} {item.unit}
                                                            </div>
                                                          )}
                                                        </td>
                                                        {comparisonItems.map((compItem, idx) => {
                                                          const bidId = Array.from(selectedComparisonBidIds)[idx]
                                                          const comp = compItem?.item
                                                          const isLower = comp && comp.amount < item.amount
                                                          const isHigher = comp && comp.amount > item.amount
                                                          
                                                          return (
                                                            <td key={`${bidId}-${idx}`} className="px-4 py-3 text-center">
                                                              {comp ? (
                                                                <>
                                                                  <div className={`font-semibold ${isLower ? 'text-green-600' : isHigher ? 'text-red-600' : 'text-gray-900'}`}>
                                                                    ${comp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                  </div>
                                                                  {comp.unit_price && (
                                                                    <div className="text-xs text-gray-500">
                                                                      @ ${comp.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}/{comp.unit || 'unit'}
                                                                    </div>
                                                                  )}
                                                                  {comp.quantity && comp.unit && (
                                                                    <div className="text-xs text-gray-500">
                                                                      {comp.quantity} {comp.unit}
                                                                    </div>
                                                                  )}
                                                                  {compItem?.confidence && (
                                                                    <Badge 
                                                                      variant="outline" 
                                                                      className={`mt-1 text-xs ${
                                                                        compItem.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                        compItem.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                        'bg-orange-50 text-orange-700 border-orange-200'
                                                                      }`}
                                                                      title={compItem.notes || `${compItem.matchType} match`}
                                                                    >
                                                                      {compItem.confidence}%
                                                                    </Badge>
                                                                  )}
                                                                  {hasVariance && !compItem?.confidence && (
                                                                    <Badge variant="outline" className="mt-1 text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                      {comp.amount && item.amount ? (
                                                                        `${((comp.amount - item.amount) / item.amount * 100).toFixed(0)}%`
                                                                      ) : '-'}
                                                                    </Badge>
                                                                  )}
                                                                </>
                                                              ) : (
                                                                <div className="text-sm text-gray-400 italic">-</div>
                                                              )}
                                                            </td>
                                                          )
                                                        })}
                                                      </tr>
                                                    )
                                                  })
                                                ) : (
                                                  <tr>
                                                    <td colSpan={selectedComparisonBidIds.size + 2} className="px-4 py-12 text-center text-gray-500">
                                                      No line items found in the selected bid.
                                                    </td>
                                                  </tr>
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>

                                    {/* AI Analysis Sidebar */}
                                    {comparisonMode === 'bids' && (
                                      <BidComparisonAISidebar
                                        isOpen={showAISidebar}
                                        onClose={() => setShowAISidebar(false)}
                                        loading={loadingAI}
                                        error={aiError}
                                        analysis={aiAnalysis}
                                        bids={bids}
                                        onRetry={generateAIComparison}
                                      />
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                <GitCompare className="h-16 w-16 mb-4 text-gray-300" />
                                <p>No other bids in the same category available for comparison.</p>
                                {getSelectedBidCategory() && (
                                  <p className="text-sm mt-2">Category: {getSelectedBidCategory()}</p>
                                )}
                              </div>
                            )
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

        {/* PDF Viewer Modal */}
        <AnimatePresence>
          {viewingAttachment && (
            <motion.div
              variants={modalBackdrop}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
              onClick={() => setViewingAttachment(null)}
              style={{ pointerEvents: 'auto' }}
            >
              <motion.div
                variants={modalContent}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-white rounded-xl shadow-2xl w-[95vw] h-[95vh] overflow-hidden flex flex-col border border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* PDF Viewer Header */}
                <div className="flex-shrink-0 border-b bg-white px-6 py-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{viewingAttachment.fileName}</h2>
                      <p className="text-sm text-gray-500">PDF Viewer</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDownloadAttachment(viewingAttachment.path, viewingAttachment.fileName, e as any)
                      }}
                      disabled={downloadingAttachment === viewingAttachment.path}
                    >
                      {downloadingAttachment === viewingAttachment.path ? (
                        <>
                          <div className="h-4 w-4 mr-2 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setViewingAttachment(null)} className="rounded-full hover:bg-gray-100">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* PDF Viewer Content */}
                <div className="flex-1 overflow-hidden bg-gray-100">
                  {pdfError ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3 text-center max-w-md px-4">
                        <AlertCircle className="h-12 w-12 text-red-500" />
                        <p className="text-red-600 font-medium">Error loading PDF</p>
                        <p className="text-sm text-gray-600">{pdfError}</p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPdfError(null)
                            // Retry loading
                            const loadPdfBlob = async () => {
                              try {
                                // Extract path from URL if path is a full URL
                                let filePath = viewingAttachment.path
                                if (filePath.includes('supabase.co/storage/v1/object/')) {
                                  const match = filePath.match(/bid-attachments\/(.+)$/)
                                  if (match) {
                                    filePath = match[1]
                                  }
                                }
                                
                                const response = await fetch(
                                  `/api/download-attachment?path=${encodeURIComponent(filePath)}&fileName=${encodeURIComponent(viewingAttachment.fileName)}&view=true`
                                )
                                if (!response.ok) {
                                  const errorData = await response.json().catch(() => ({ error: 'Failed to load PDF' }))
                                  throw new Error(errorData.error || 'Failed to load PDF')
                                }
                                const contentType = response.headers.get('content-type')
                                if (contentType && !contentType.includes('application/pdf') && contentType.includes('application/json')) {
                                  const errorData = await response.json()
                                  throw new Error(errorData.error || 'Server returned JSON instead of PDF')
                                }
                                const blob = await response.blob()
                                const url = URL.createObjectURL(blob)
                                setPdfBlobUrl(url)
                                setPdfError(null)
                              } catch (err: any) {
                                setPdfError(err.message || 'Failed to load PDF')
                              }
                            }
                            loadPdfBlob()
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : pdfBlobUrl ? (
                    <iframe
                      src={pdfBlobUrl}
                      className="w-full h-full border-0"
                      title={viewingAttachment.fileName}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="text-gray-500 font-medium">Loading PDF...</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

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
                    <div className="flex items-center justify-between mb-2">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadData}
                        disabled={loading}
                        className="ml-2 h-8 w-8 p-0"
                        title="Refresh data"
                      >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
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
                                    <div className="flex items-center gap-1">
                                      {recipient.has_clarifying_questions && (
                                        <Badge variant="destructive" className="h-2 w-2 p-0 rounded-full" />
                                      )}
                                      {recipient.response_text && (
                                        <Badge variant="default" className="h-2 w-2 p-0 rounded-full bg-orange-500" title="Has response" />
                                      )}
                                    </div>
                                  </div>
                                  {recipient.response_text && (
                                    <div className="text-xs text-gray-600 mt-1 mb-2 line-clamp-2 italic">
                                      "{recipient.response_text.substring(0, 80)}{recipient.response_text.length > 80 ? '...' : ''}"
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className={`
                                      text-[10px] px-1.5 py-0 h-5 capitalize border-0
                                      ${recipient.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                        recipient.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                          recipient.status === 'opened' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                                        recipient.status === 'responded' ? 'bg-orange-100 text-orange-700' :
                                        'bg-gray-100 text-gray-600'}
                                    `}>
                                        {recipient.status === 'opened' && <Eye className="h-2.5 w-2.5 mr-1" />}
                                      {recipient.status}
                                    </Badge>
                                      {recipient.status === 'opened' && !recipient.response_text && (
                                        <span className="text-[9px] text-purple-600 font-medium" title="Email opened but not yet responded">
                                          Viewed
                                        </span>
                                      )}
                                    </div>
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
                  // Email View - Chat Style
                  <div className="flex flex-col h-full bg-white">
                    {/* Header */}
                    <div className="border-b bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {selectedEmailRecipient.subcontractor_name || selectedEmailRecipient.subcontractors?.name || selectedEmailRecipient.subcontractor_email}
                        </h2>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {selectedEmailRecipient.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {selectedEmailRecipient.bid_packages?.trade_category || 'General'}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedEmailRecipient(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Chat Messages Container */}
                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 bg-gray-50">
                        {(() => {
                          // Get thread for this recipient
                          const threadId = selectedEmailRecipient.thread_id || 
                            `thread-${selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id}-${selectedEmailRecipient.subcontractor_email}`
                          const thread = emailThreads[threadId]
                          const threadMessages = thread?.messages || [selectedEmailRecipient]
                          
                          // Sort messages by timestamp
                          const sortedMessages = [...threadMessages].sort((a, b) => {
                            const timeA = new Date(a.messageTimestamp || a.responded_at || a.sent_at || a.created_at).getTime()
                            const timeB = new Date(b.messageTimestamp || b.responded_at || b.sent_at || b.created_at).getTime()
                            return timeA - timeB
                          })
                          
                          if (sortedMessages.length === 0) {
                            return (
                              <div className="flex items-center justify-center h-full">
                                <p className="text-gray-400 text-sm">No messages yet</p>
                              </div>
                            )
                          }
                          
                          return sortedMessages.map((message: any, index: number) => {
                            const isFromGC = message.isFromGC !== undefined ? message.isFromGC : !!(message.resend_email_id && message.status === 'sent')
                            // Use fetched content if available, otherwise fall back to stored content
                            const messageContent = fetchedEmailContent[message.id] || message.response_text || message.notes || ''
                            const messageTime = message.responded_at || message.sent_at || message.created_at
                            
                            // Fetch email content if missing and we have a resend_email_id
                            if (!messageContent && message.resend_email_id && !fetchingEmailContent.has(message.id) && !fetchedEmailContent[message.id]) {
                              // Trigger async fetch
                              setFetchingEmailContent(prev => new Set(prev).add(message.id))
                              fetch(`/api/emails/${message.resend_email_id}/content`)
                                .then(res => res.json())
                                .then(data => {
                                  if (data.content) {
                                    setFetchedEmailContent(prev => ({
                                      ...prev,
                                      [message.id]: data.content
                                    }))
                                    // Also update the message in the thread if possible
                                    setEmailThreads(prev => {
                                      const updated = { ...prev }
                                      const threadId = message.thread_id || 
                                        `thread-${message.bid_package_id || message.bid_packages?.id}-${message.subcontractor_email}`
                                      if (updated[threadId]) {
                                        const updatedThread = { ...updated[threadId] }
                                        updatedThread.messages = updatedThread.messages.map((m: any) =>
                                          m.id === message.id ? { ...m, response_text: data.content } : m
                                        )
                                        updatedThread.latest_message = updatedThread.latest_message?.id === message.id
                                          ? { ...updatedThread.latest_message, response_text: data.content }
                                          : updatedThread.latest_message
                                        updated[threadId] = updatedThread
                                      }
                                      return updated
                                    })
                                  }
                                })
                                .catch(err => {
                                  console.error('Failed to fetch email content:', err)
                                })
                                .finally(() => {
                                  setFetchingEmailContent(prev => {
                                    const next = new Set(prev)
                                    next.delete(message.id)
                                    return next
                                  })
                                })
                            }
                            
                            // Debug logging
                            if (isFromGC && !messageContent) {
                              console.log('📧 [UI] GC message with no content:', {
                                id: message.id,
                                status: message.status,
                                hasResponseText: !!message.response_text,
                                responseText: message.response_text,
                                hasNotes: !!message.notes,
                                notes: message.notes,
                                isFromGC: message.isFromGC,
                                resendEmailId: message.resend_email_id
                              })
                            }
                            
                            const senderName = isFromGC ? 'You' : (message.subcontractor_name || message.subcontractors?.name || message.subcontractor_email || 'Subcontractor')
                            const prevMessage = index > 0 ? sortedMessages[index - 1] : null
                            const showAvatar = !prevMessage || prevMessage.isFromGC !== isFromGC
                            const getInitials = (name: string) => {
                              if (!name) return '?'
                              const parts = name.trim().split(/\s+/)
                              if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                              return name.substring(0, 2).toUpperCase()
                            }
                            const formatChatTime = (date: Date) => {
                              const now = new Date()
                              const diffMs = now.getTime() - date.getTime()
                              const diffMins = Math.floor(diffMs / 60000)
                              const diffHours = Math.floor(diffMs / 3600000)
                              const diffDays = Math.floor(diffMs / 86400000)
                              if (diffMins < 1) return 'Just now'
                              if (diffMins < 60) return `${diffMins}m ago`
                              if (diffHours < 24) return `${diffHours}h ago`
                              if (diffDays < 7) return `${diffDays}d ago`
                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            }
                            
                            return (
                              <div
                                key={message.id || `message-${index}`}
                                className={`flex items-end gap-2 ${isFromGC ? 'flex-row-reverse' : 'flex-row'} ${showAvatar ? 'mt-4' : 'mt-1'}`}
                              >
                                {/* Avatar */}
                                {showAvatar ? (
                                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm ${
                                    isFromGC ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                  }`}>
                                    {isFromGC ? 'Y' : getInitials(senderName)}
                                  </div>
                                ) : (
                                  <div className="w-8" />
                                )}
                                
                                {/* Message Bubble */}
                                <div className={`flex flex-col max-w-[75%] ${isFromGC ? 'items-end' : 'items-start'}`}>
                                  {showAvatar && (
                                    <span className={`text-xs text-gray-500 mb-1 px-1 ${isFromGC ? 'text-right' : 'text-left'}`}>
                                      {senderName}
                                    </span>
                                  )}
                                  <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                                    isFromGC
                                      ? 'bg-blue-600 text-white rounded-br-sm'
                                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                                  }`}>
                                    {fetchingEmailContent.has(message.id) ? (
                                      <div className="flex items-center gap-2">
                                        <div className={`animate-spin rounded-full h-3 w-3 border-2 ${isFromGC ? 'border-white border-t-transparent' : 'border-gray-400 border-t-transparent'}`}></div>
                                        <span className="text-xs">Loading...</span>
                                      </div>
                                    ) : (
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {messageContent ? cleanEmailContent(messageContent) : (isFromGC ? 'Email sent' : 'No message content available')}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`text-xs text-gray-400 mt-1 px-1 ${isFromGC ? 'text-right' : 'text-left'}`}>
                                    {formatChatTime(new Date(messageTime))}
                                  </span>
                                </div>
                              </div>
                            )
                          })
                        })()}
                        </div>

                        {/* Reply Input - Chat-like (iMessage style) */}
                        <div className="border-t bg-white p-3 flex-shrink-0">
                          <div className="flex items-end gap-2">
                            <div className="flex-1 flex items-end gap-2">
                              <Textarea
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                placeholder="Type a message..."
                                rows={1}
                                className="resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[44px] max-h-[120px] py-2.5 px-3 text-sm rounded-full"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    if (responseText.trim() && !sendingResponse) {
                                      handleSendMessage()
                                    }
                                  }
                                }}
                                style={{
                                  height: 'auto',
                                  minHeight: '44px',
                                }}
                                onInput={(e) => {
                                  const target = e.target as HTMLTextAreaElement
                                  target.style.height = 'auto'
                                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                                }}
                              />
                              <Button
                                size="icon"
                                disabled={sendingResponse || !responseText.trim()}
                                onClick={handleSendMessage}
                                className="h-[44px] w-[44px] rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                              >
                                {sendingResponse ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                ) : (
                                  <Mail className="h-4 w-4 text-white" />
                                )}
                              </Button>
                            </div>
                            {selectedEmailRecipient.bids?.length > 0 && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedBidId(selectedEmailRecipient.bids[0].id)
                                  setSelectedEmailRecipient(null)
                                  setLeftSideTab('bids')
                                }}
                                className="h-[44px] px-3 flex-shrink-0"
                              >
                                View Bid
                              </Button>
                            )}
                          </div>
                          {error && <p className="text-sm text-red-600 mt-2 px-1">{error}</p>}
                        </div>
                      </div>
                ) : selectedBid ? (
                  // Bid View - This is the same content as the inline version, so I'll reference it
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
                          <div className="flex flex-col gap-2 mt-4 items-end">
                            {/* Status Badge */}
                            {selectedBid.status === 'accepted' && (
                              <Badge variant="default" className="bg-green-600 mb-2">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Accepted
                              </Badge>
                            )}
                            {selectedBid.status === 'declined' && (
                              <Badge variant="destructive" className="mb-2">
                                <XCircle className="h-3 w-3 mr-1" />
                                Declined
                                {selectedBid.decline_reason && (
                                  <span className="ml-1">({selectedBid.decline_reason})</span>
                                )}
                              </Badge>
                            )}
                            {selectedBid.status === 'pending' && (
                              <Badge variant="outline" className="mb-2">
                                Pending
                              </Badge>
                            )}
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2 justify-end flex-wrap">
                              {/* Always show Decline button if not already declined */}
                              {selectedBid.status !== 'declined' && (
                                <Popover open={showDeclinePopover} onOpenChange={setShowDeclinePopover}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={processingBidAction}
                                      className="border-red-200 text-red-600 hover:bg-red-50"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Decline
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-2" align="end">
                                    <div className="space-y-1">
                                      <div className="px-2 py-1.5 text-sm font-semibold text-gray-700 border-b mb-1">
                                        Select Decline Reason
                                      </div>
                                      {declineReasons.map((reason) => (
                                        <button
                                          key={reason}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            if (reason === 'Other') {
                                              const customReason = prompt('Please provide a custom decline reason:')
                                              if (customReason && customReason.trim()) {
                                                handleDeclineBid(customReason.trim())
                                              }
                                            } else {
                                              handleDeclineBid(reason)
                                            }
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-red-50 hover:text-red-700 transition-colors"
                                        >
                                          {reason}
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                              {/* Always show Accept button if not already accepted */}
                              {selectedBid.status !== 'accepted' && (
                                <Button
                                  size="sm"
                                  onClick={handleAcceptBid}
                                  disabled={processingBidAction}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Accept Bid
                                </Button>
                              )}
                              {/* Always show Set to Pending if not already pending */}
                              {selectedBid.status !== 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSetToPending}
                                  disabled={processingBidAction}
                                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                >
                                  Set to Pending
                                </Button>
                              )}
                            </div>
                          </div>
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
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                        <span className="truncate text-gray-700" title={att.file_name}>
                                                            {att.file_name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            // Extract path from URL if file_path is a full URL
                                                            let filePath = att.file_path
                                                            if (filePath.includes('supabase.co/storage/v1/object/')) {
                                                                // Extract path after 'bid-attachments/'
                                                                const match = filePath.match(/bid-attachments\/(.+)$/)
                                                                if (match) {
                                                                    filePath = match[1]
                                                                }
                                                            }
                                                            setViewingAttachment({ path: filePath, fileName: att.file_name })
                                                        }}
                                                        >
                                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                                            View
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
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
                          {/* Comparison Mode Toggle */}
                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border">
                            <Button
                              variant={comparisonMode === 'takeoff' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setComparisonMode('takeoff')}
                              className={comparisonMode === 'takeoff' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                            >
                              Compare with Takeoff
                            </Button>
                            <Button
                              variant={comparisonMode === 'bids' ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setComparisonMode('bids')}
                              className={comparisonMode === 'bids' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                              disabled={sameCategoryBids.length === 0}
                            >
                              Compare with Other Bids
                              {sameCategoryBids.length > 0 && (
                                <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                                  {sameCategoryBids.length}
                                </Badge>
                              )}
                            </Button>
                          </div>

                          {comparisonMode === 'takeoff' ? (
                            filteredTakeoffItems.length > 0 ? (
                            <>
                              {/* Trade Category Filter Notice */}
                              {getSelectedBidCategory() && (
                                <Card className="bg-blue-50 border-blue-200 mb-4">
                                  <CardContent className="p-3">
                                    <div className="flex items-center gap-2 text-sm text-blue-700">
                                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                        {getSelectedBidCategory()}
                                      </Badge>
                                      <span>Showing {filteredTakeoffItems.length} takeoff item{filteredTakeoffItems.length !== 1 ? 's' : ''} for this trade category</span>
                                      {takeoffItems.length > filteredTakeoffItems.length && (
                                        <span className="text-blue-600 text-xs">
                                          ({takeoffItems.length - filteredTakeoffItems.length} other items hidden)
                                        </span>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
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
                                            if (selectedTakeoffItemIds.size === filteredTakeoffItems.length) {
                                              setSelectedTakeoffItemIds(new Set())
                                            } else {
                                              setSelectedTakeoffItemIds(new Set(filteredTakeoffItems.map(i => i.id)))
                                            }
                                          }}
                                        >
                                          {selectedTakeoffItemIds.size === filteredTakeoffItems.length ? 'None' : 'All'}
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
                                    {filteredTakeoffItems.filter(item => 
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

                                {/* Comparison Table with AI */}
                                <div className="space-y-4">
                                  <Card className="flex flex-col h-full overflow-hidden">
                                    <CardHeader className="py-3 px-4 border-b bg-gray-50 flex flex-row items-center justify-between">
                                      <div className="grid grid-cols-2 gap-4 font-medium text-sm flex-1">
                                        <div className="text-blue-700">Your Takeoff</div>
                                        <div className="text-green-700">Bidder Line Item</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {loadingTakeoffAI && (
                                          <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                            <span>AI analyzing...</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                          {isTakeoffCached && (
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                              Cached
                                            </Badge>
                                          )}
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowAISidebar(!showAISidebar)}
                                            className="flex items-center gap-2"
                                          >
                                            <GitCompare className="h-4 w-4" />
                                            {showAISidebar ? 'Hide' : 'Show'} AI Analysis
                                          </Button>
                                          {isTakeoffCached && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => generateTakeoffAIComparison(true)}
                                              className="text-xs"
                                              title="Refresh analysis"
                                            >
                                              <Clock className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 overflow-y-auto p-0">
                                      {loadingTakeoffAI ? (
                                        <div className="flex items-center justify-center py-12">
                                          <div className="flex flex-col items-center gap-3">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                            <p className="text-gray-500 font-medium">AI analyzing takeoff comparison...</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="divide-y">
                                    {filteredTakeoffItems
                                      .filter(item => selectedTakeoffItemIds.has(item.id))
                                      .map(takeoffItem => {
                                              // Use AI matches if available, otherwise fall back to simple matching
                                              let aiMatch: any = null
                                              if (takeoffAIMatches && takeoffAIMatches.length > 0) {
                                                aiMatch = takeoffAIMatches.find((m: any) => m.takeoffItem.id === takeoffItem.id)
                                              }
                                              
                                              const matchingBidItem = aiMatch?.bidItem || 
                                                (aiMatch ? null : bidLineItems.find(bi => 
                                                  bi.description.toLowerCase().includes(takeoffItem.description.toLowerCase()) ||
                                                  takeoffItem.description.toLowerCase().includes(bi.description.toLowerCase())
                                                ))
                                              
                                              const discrepancy = discrepancies.find(d => d.takeoffItem?.id === takeoffItem.id)
                                              const hasVariance = aiMatch && (aiMatch.quantityVariance || aiMatch.priceVariance)
                                              
                                              return (
                                                <div key={takeoffItem.id} className={`grid grid-cols-2 gap-4 p-4 ${discrepancy || hasVariance ? 'bg-orange-50/30' : ''}`}>
                                                  {/* Takeoff Side */}
                                                  <div className="pr-4 border-r">
                                                    <div className="flex justify-between items-start">
                                                      <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                          <div className="font-medium text-sm text-gray-900">{takeoffItem.description}</div>
                                                          {aiMatch && aiMatch.confidence > 0 && (
                                                            <Badge 
                                                              variant="outline" 
                                                              className={`text-xs ${
                                                                aiMatch.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                aiMatch.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                'bg-orange-50 text-orange-700 border-orange-200'
                                                              }`}
                                                              title={aiMatch.notes || `${aiMatch.matchType} match`}
                                                            >
                                                              {aiMatch.confidence}% match
                                                            </Badge>
                                                          )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                          {takeoffItem.quantity} {takeoffItem.unit} 
                                                          {takeoffItem.unit_cost && ` @ $${takeoffItem.unit_cost}/unit`}
                                                        </div>
                                                      </div>
                                                      {takeoffItem.unit_cost && (
                                                        <div className="font-bold text-blue-600 ml-2">
                                                          ${(takeoffItem.quantity * takeoffItem.unit_cost).toLocaleString()}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>

                                                  {/* Bid Side */}
                                                  <div className="pl-4">
                                                    {matchingBidItem ? (
                                                      <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                          <div className="font-medium text-sm text-gray-900">{matchingBidItem.description}</div>
                                                          <div className="text-xs text-gray-500 mt-1">
                                                            {matchingBidItem.quantity} {matchingBidItem.unit}
                                                            {matchingBidItem.unit_price && ` @ $${matchingBidItem.unit_price}/unit`}
                                                          </div>
                                                          {aiMatch && (aiMatch.quantityVariance || aiMatch.priceVariance) && (
                                                            <div className="mt-2 space-y-1">
                                                              {aiMatch.quantityVariance && aiMatch.quantityVariance > 20 && (
                                                                <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                  Qty variance: {aiMatch.quantityVariance.toFixed(0)}%
                                                                </Badge>
                                                              )}
                                                              {aiMatch.priceVariance && aiMatch.priceVariance > 15 && (
                                                                <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                  Price variance: {aiMatch.priceVariance.toFixed(0)}%
                                                                </Badge>
                                                              )}
                                                            </div>
                                                          )}
                                                          {discrepancy && !aiMatch && (
                                                            <Badge variant="outline" className="mt-2 text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                              {discrepancy.type === 'quantity' ? `Qty mismatch (${discrepancy.percentage?.toFixed(0)}%)` : 'Price mismatch'}
                                                            </Badge>
                                                          )}
                                                        </div>
                                                        <div className={`font-bold ml-2 ${discrepancy || hasVariance ? 'text-orange-600' : 'text-green-600'}`}>
                                                          ${matchingBidItem.amount.toLocaleString()}
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <div className="text-sm text-gray-400 italic flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4" />
                                                        {aiMatch ? 'No match found (AI analyzed)' : 'Not found in bid'}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )
                                            })}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>

                                  {/* AI Analysis Sidebar for Takeoff */}
                                  {comparisonMode === 'takeoff' && (
                                    <BidComparisonAISidebar
                                      isOpen={showAISidebar}
                                      onClose={() => setShowAISidebar(false)}
                                      loading={loadingTakeoffAI}
                                      error={takeoffAIError}
                                      analysis={takeoffAIAnalysis}
                                      bids={selectedBid ? [selectedBid] : []}
                                      onRetry={generateTakeoffAIComparison}
                                    />
                                  )}
                                </div>
                              </div>
                            </>
                            ) : getSelectedBidCategory() && takeoffItems.length > 0 ? (
                               <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                 <GitCompare className="h-16 w-16 mb-4 text-gray-300" />
                                 <p>No takeoff items found for trade category: <strong>{getSelectedBidCategory()}</strong></p>
                                 <p className="text-sm mt-2">The takeoff has {takeoffItems.length} item{takeoffItems.length !== 1 ? 's' : ''}, but none are tagged for this trade.</p>
                               </div>
                            ) : (
                               <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                 <GitCompare className="h-16 w-16 mb-4 text-gray-300" />
                                 <p>No takeoff data available to compare against.</p>
                               </div>
                            )
                          ) : (
                            // Bid-to-Bid Comparison Mode
                            sameCategoryBids.length > 0 ? (
                              <>
                                {/* Bid Selection Panel */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-base">Select Bids to Compare</CardTitle>
                                    <CardDescription>
                                      Choose other bids in the same category ({getSelectedBidCategory() || 'Unknown'}) to compare against
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {sameCategoryBids.map(bid => (
                                        <div
                                          key={bid.id}
                                          onClick={() => {
                                            const newSet = new Set(selectedComparisonBidIds)
                                            if (newSet.has(bid.id)) {
                                              newSet.delete(bid.id)
                                            } else {
                                              newSet.add(bid.id)
                                            }
                                            setSelectedComparisonBidIds(newSet)
                                          }}
                                          className={`
                                            cursor-pointer rounded-lg p-3 border transition-all
                                            ${selectedComparisonBidIds.has(bid.id)
                                              ? 'border-orange-400 bg-orange-50 shadow-md ring-1 ring-orange-400/20'
                                              : 'bg-white border-gray-200 hover:border-orange-200'
                                            }
                                          `}
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                              <h4 className="font-semibold text-sm text-gray-900 truncate">
                                                {bid.subcontractors?.name || bid.gc_contacts?.name || bid.subcontractor_email || 'Unknown'}
                                              </h4>
                                              <p className="text-xs text-gray-500 truncate">
                                                {bid.subcontractors?.email || bid.gc_contacts?.email || bid.subcontractor_email}
                                              </p>
                                            </div>
                                            <Checkbox checked={selectedComparisonBidIds.has(bid.id)} className="pointer-events-none ml-2" />
                                          </div>
                                          <div className="text-lg font-bold text-gray-900">
                                            ${bid.bid_amount?.toLocaleString() ?? '0.00'}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Comparison Table with AI Sidebar */}
                                {selectedComparisonBidIds.size > 0 && (
                                  <div className="space-y-4">
                                    <Card className="overflow-hidden">
                                      <CardHeader className="bg-gray-50 border-b flex flex-row items-center justify-between">
                                        <CardTitle className="text-base">Line Item Comparison</CardTitle>
                                        <div className="flex items-center gap-2">
                                          {loadingAI && (
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                              <span>AI analyzing...</span>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            {isCached && (
                                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                Cached
                                              </Badge>
                                            )}
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setShowAISidebar(!showAISidebar)}
                                              className="flex items-center gap-2"
                                            >
                                              <GitCompare className="h-4 w-4" />
                                              {showAISidebar ? 'Hide' : 'Show'} AI Analysis
                                            </Button>
                                            {isCached && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => generateAIComparison(true)}
                                                className="text-xs"
                                                title="Refresh analysis"
                                              >
                                                <Clock className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="p-0">
                                        {loadingComparisonBids || loadingAI ? (
                                          <div className="flex items-center justify-center py-12">
                                            <div className="flex flex-col items-center gap-3">
                                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                                              <p className="text-gray-500 font-medium">
                                                {loadingAI ? 'AI analyzing bids...' : 'Loading comparison data...'}
                                              </p>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                              <thead className="bg-gray-50 border-b">
                                                <tr>
                                                  <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                                                  <th className="px-4 py-3 text-center font-medium text-gray-700">Selected Bid</th>
                                                  {Array.from(selectedComparisonBidIds).map(bidId => {
                                                    const bid = bids.find(b => b.id === bidId)
                                                    return (
                                                      <th key={bidId} className="px-4 py-3 text-center font-medium text-gray-700">
                                                        {bid?.subcontractors?.name || bid?.gc_contacts?.name || bid?.subcontractor_email || 'Unknown'}
                                                      </th>
                                                    )
                                                  })}
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y">
                                                {bidLineItems.length > 0 ? (
                                                  bidLineItems.map(item => {
                                                    // Use AI matches if available, otherwise fall back to simple matching
                                                    let comparisonItems: Array<{ item: any; confidence?: number; matchType?: string; notes?: string } | null> = []
                                                    
                                                    if (aiMatches && aiMatches.length > 0) {
                                                      const aiMatch = aiMatches.find((m: any) => m.selectedBidItem.id === item.id)
                                                      if (aiMatch) {
                                                        // Use AI-matched items
                                                        comparisonItems = Array.from(selectedComparisonBidIds).map(bidId => {
                                                          const match = aiMatch.comparisonItems.find((ci: any) => ci.bidId === bidId)
                                                          return match ? { item: match.item, confidence: match.confidence, matchType: match.matchType, notes: match.notes } : null
                                                        })
                                                      } else {
                                                        // Fallback to simple matching
                                                        comparisonItems = Array.from(selectedComparisonBidIds).map(bidId => {
                                                          const compItems = comparisonBidLineItems[bidId] || []
                                                          const found = compItems.find(ci =>
                                                            ci.description.toLowerCase().includes(item.description.toLowerCase()) ||
                                                            item.description.toLowerCase().includes(ci.description.toLowerCase())
                                                          )
                                                          return found ? { item: found } : null
                                                        })
                                                      }
                                                    } else {
                                                      // Simple matching when AI not available
                                                      comparisonItems = Array.from(selectedComparisonBidIds).map(bidId => {
                                                        const compItems = comparisonBidLineItems[bidId] || []
                                                        const found = compItems.find(ci =>
                                                          ci.description.toLowerCase().includes(item.description.toLowerCase()) ||
                                                          item.description.toLowerCase().includes(ci.description.toLowerCase())
                                                        )
                                                        return found ? { item: found } : null
                                                      })
                                                    }

                                                    const allAmounts = [item.amount, ...comparisonItems.map(ci => ci?.item?.amount).filter(Boolean)]
                                                    const minAmount = Math.min(...allAmounts.map(a => a || Infinity))
                                                    const maxAmount = Math.max(...allAmounts.map(a => a || Infinity))
                                                    const hasVariance = maxAmount - minAmount > minAmount * 0.1 // 10% variance threshold

                                                    return (
                                                      <tr key={item.id} className={hasVariance ? 'bg-orange-50/30' : ''}>
                                                        <td className="px-4 py-3 font-medium text-gray-900">
                                                          <div className="flex items-center gap-2">
                                                            {item.description}
                                                            {comparisonItems.some(ci => ci?.confidence) && (
                                                              <Badge 
                                                                variant="outline" 
                                                                className={`text-xs ${
                                                                  comparisonItems.some(ci => ci?.confidence && ci.confidence >= 85) ? 'bg-green-50 text-green-700 border-green-200' :
                                                                  comparisonItems.some(ci => ci?.confidence && ci.confidence >= 70) ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                  'bg-orange-50 text-orange-700 border-orange-200'
                                                                }`}
                                                                title={comparisonItems.find(ci => ci?.confidence)?.notes || ''}
                                                              >
                                                                {Math.max(...comparisonItems.map(ci => ci?.confidence || 0))}% match
                                                              </Badge>
                                                            )}
                                                          </div>
                                                          {item.notes && (
                                                            <div className="text-xs text-gray-500 font-normal mt-1">{item.notes}</div>
                                                          )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                          <div className="font-semibold text-gray-900">
                                                            ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                          </div>
                                                          {item.unit_price && (
                                                            <div className="text-xs text-gray-500">
                                                              @ ${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}/{item.unit || 'unit'}
                                                            </div>
                                                          )}
                                                          {item.quantity && item.unit && (
                                                            <div className="text-xs text-gray-500">
                                                              {item.quantity} {item.unit}
                                                            </div>
                                                          )}
                                                        </td>
                                                        {comparisonItems.map((compItem, idx) => {
                                                          const bidId = Array.from(selectedComparisonBidIds)[idx]
                                                          const comp = compItem?.item
                                                          const isLower = comp && comp.amount < item.amount
                                                          const isHigher = comp && comp.amount > item.amount
                                                          
                                                          return (
                                                            <td key={`${bidId}-${idx}`} className="px-4 py-3 text-center">
                                                              {comp ? (
                                                                <>
                                                                  <div className={`font-semibold ${isLower ? 'text-green-600' : isHigher ? 'text-red-600' : 'text-gray-900'}`}>
                                                                    ${comp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                  </div>
                                                                  {comp.unit_price && (
                                                                    <div className="text-xs text-gray-500">
                                                                      @ ${comp.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}/{comp.unit || 'unit'}
                                                                    </div>
                                                                  )}
                                                                  {comp.quantity && comp.unit && (
                                                                    <div className="text-xs text-gray-500">
                                                                      {comp.quantity} {comp.unit}
                                                                    </div>
                                                                  )}
                                                                  {compItem?.confidence && (
                                                                    <Badge 
                                                                      variant="outline" 
                                                                      className={`mt-1 text-xs ${
                                                                        compItem.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                        compItem.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                        'bg-orange-50 text-orange-700 border-orange-200'
                                                                      }`}
                                                                      title={compItem.notes || `${compItem.matchType} match`}
                                                                    >
                                                                      {compItem.confidence}%
                                                                    </Badge>
                                                                  )}
                                                                  {hasVariance && !compItem?.confidence && (
                                                                    <Badge variant="outline" className="mt-1 text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                      {comp.amount && item.amount ? (
                                                                        `${((comp.amount - item.amount) / item.amount * 100).toFixed(0)}%`
                                                                      ) : '-'}
                                                                    </Badge>
                                                                  )}
                                                                </>
                                                              ) : (
                                                                <div className="text-sm text-gray-400 italic">-</div>
                                                              )}
                                                            </td>
                                                          )
                                                        })}
                                                      </tr>
                                                    )
                                                  })
                                                ) : (
                                                  <tr>
                                                    <td colSpan={selectedComparisonBidIds.size + 2} className="px-4 py-12 text-center text-gray-500">
                                                      No line items found in the selected bid.
                                                    </td>
                                                  </tr>
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>

                                    {/* AI Analysis Sidebar */}
                                    {comparisonMode === 'bids' && (
                                      <BidComparisonAISidebar
                                        isOpen={showAISidebar}
                                        onClose={() => setShowAISidebar(false)}
                                        loading={loadingAI}
                                        error={aiError}
                                        analysis={aiAnalysis}
                                        bids={bids}
                                        onRetry={generateAIComparison}
                                      />
                                    )}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                <GitCompare className="h-16 w-16 mb-4 text-gray-300" />
                                <p>No other bids in the same category available for comparison.</p>
                                {getSelectedBidCategory() && (
                                  <p className="text-sm mt-2">Category: {getSelectedBidCategory()}</p>
                                )}
                              </div>
                            )
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

        {/* PDF Viewer Modal */}
        <AnimatePresence>
          {viewingAttachment && (
            <motion.div
              variants={modalBackdrop}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
              onClick={() => setViewingAttachment(null)}
              style={{ pointerEvents: 'auto' }}
            >
              <motion.div
                variants={modalContent}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-white rounded-xl shadow-2xl w-[95vw] h-[95vh] overflow-hidden flex flex-col border border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* PDF Viewer Header */}
                <div className="flex-shrink-0 border-b bg-white px-6 py-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{viewingAttachment.fileName}</h2>
                      <p className="text-sm text-gray-500">PDF Viewer</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDownloadAttachment(viewingAttachment.path, viewingAttachment.fileName, e as any)
                      }}
                      disabled={downloadingAttachment === viewingAttachment.path}
                    >
                      {downloadingAttachment === viewingAttachment.path ? (
                        <>
                          <div className="h-4 w-4 mr-2 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setViewingAttachment(null)} className="rounded-full hover:bg-gray-100">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* PDF Viewer Content */}
                <div className="flex-1 overflow-hidden bg-gray-100">
                  {pdfError ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3 text-center max-w-md px-4">
                        <AlertCircle className="h-12 w-12 text-red-500" />
                        <p className="text-red-600 font-medium">Error loading PDF</p>
                        <p className="text-sm text-gray-600">{pdfError}</p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPdfError(null)
                            // Retry loading
                            const loadPdfBlob = async () => {
                              try {
                                // Extract path from URL if path is a full URL
                                let filePath = viewingAttachment.path
                                if (filePath.includes('supabase.co/storage/v1/object/')) {
                                  const match = filePath.match(/bid-attachments\/(.+)$/)
                                  if (match) {
                                    filePath = match[1]
                                  }
                                }
                                
                                const response = await fetch(
                                  `/api/download-attachment?path=${encodeURIComponent(filePath)}&fileName=${encodeURIComponent(viewingAttachment.fileName)}&view=true`
                                )
                                if (!response.ok) {
                                  const errorData = await response.json().catch(() => ({ error: 'Failed to load PDF' }))
                                  throw new Error(errorData.error || 'Failed to load PDF')
                                }
                                const contentType = response.headers.get('content-type')
                                if (contentType && !contentType.includes('application/pdf') && contentType.includes('application/json')) {
                                  const errorData = await response.json()
                                  throw new Error(errorData.error || 'Server returned JSON instead of PDF')
                                }
                                const blob = await response.blob()
                                const url = URL.createObjectURL(blob)
                                setPdfBlobUrl(url)
                                setPdfError(null)
                              } catch (err: any) {
                                setPdfError(err.message || 'Failed to load PDF')
                              }
                            }
                            loadPdfBlob()
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : pdfBlobUrl ? (
                    <iframe
                      src={pdfBlobUrl}
                      className="w-full h-full border-0"
                      title={viewingAttachment.fileName}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="text-gray-500 font-medium">Loading PDF...</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </motion.div>
  )
}
