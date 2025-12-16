'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
  const [activeTab, setActiveTab] = useState<'details' | 'comparison' | 'conversation'>('details')
  const [leftSideTab, setLeftSideTab] = useState<'bids' | 'emails'>('bids')
  const [selectedEmailRecipient, setSelectedEmailRecipient] = useState<any | null>(null)
  const [responseText, setResponseText] = useState('')
  const [sendingResponse, setSendingResponse] = useState(false)
  const [takeoffSearchTerm, setTakeoffSearchTerm] = useState('')
  const [bidsSearchTerm, setBidsSearchTerm] = useState('')
  const [emailsSearchTerm, setEmailsSearchTerm] = useState('')
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

  // Helper to validate if an ID is a valid UUID (recipient ID format)
  const isValidRecipientId = useCallback((id: any): boolean => {
    if (!id || typeof id !== 'string') return false
    // UUID format: 8-4-4-4-12 hex characters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(id)
  }, [])

  // Mark incoming emails as read when viewing a thread
  const markEmailAsRead = useCallback(async (recipientId: string, message?: any) => {
    // Validate recipient ID before making API call
    if (!isValidRecipientId(recipientId)) {
      console.warn('Skipping mark as read - invalid recipient ID:', recipientId)
      return
    }
    
    // Double-check: Never mark GC messages as read
    if (message) {
      const isFromGC = message.isFromGC ?? message.is_from_gc ?? false
      if (isFromGC) {
        console.debug('Skipping mark as read - GC message:', recipientId)
        return
      }
      
      // Skip if already marked as read
      if (message.read_by_gc_at) {
        console.debug('Skipping mark as read - already read:', recipientId)
        return
      }
    }
    
    try {
      const response = await fetch(`/api/bid-package-recipients/${recipientId}/mark-read`, {
        method: 'POST'
      })
      if (response.ok) {
        const readTimestamp = new Date().toISOString()
        // Update local state to reflect read status
        setAllRecipients(prev => prev.map(r => 
          r.id === recipientId ? { ...r, read_by_gc_at: readTimestamp } : r
        ))
        // Update threads
        setEmailThreads(prev => {
          const updated = { ...prev }
          Object.keys(updated).forEach(threadId => {
            const thread = updated[threadId]
            if (thread.messages) {
              thread.messages = thread.messages.map((m: any) =>
                m.id === recipientId ? { ...m, read_by_gc_at: readTimestamp } : m
              )
              if (thread.latest_message?.id === recipientId) {
                thread.latest_message = { ...thread.latest_message, read_by_gc_at: readTimestamp }
              }
            }
          })
          return updated
        })
      } else if (response.status === 404) {
        // Recipient not found - might have been deleted or doesn't exist
        // Update local state optimistically so UI reflects read status
        // (even though we can't persist it to the database)
        const readTimestamp = new Date().toISOString()
        
        // Update local state to reflect read status (optimistic update)
        setAllRecipients(prev => prev.map(r => 
          r.id === recipientId ? { ...r, read_by_gc_at: readTimestamp } : r
        ))
        // Update threads
        setEmailThreads(prev => {
          const updated = { ...prev }
          Object.keys(updated).forEach(threadId => {
            const thread = updated[threadId]
            if (thread.messages) {
              thread.messages = thread.messages.map((m: any) =>
                m.id === recipientId ? { ...m, read_by_gc_at: readTimestamp } : m
              )
              if (thread.latest_message?.id === recipientId) {
                thread.latest_message = { ...thread.latest_message, read_by_gc_at: readTimestamp }
              }
            }
          })
          return updated
        })
        
        // Log with message context for debugging
        const messageInfo = message ? {
          isFromGC: message.isFromGC ?? message.is_from_gc ?? false,
          status: message.status,
          email: message.subcontractor_email
        } : 'no message context'
        console.debug('Recipient not found for mark-read (optimistically marked as read locally):', {
          recipientId,
          messageInfo
        })
      } else {
        // Log other errors but don't show to user
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.warn('Failed to mark email as read:', response.status, errorData)
      }
    } catch (error) {
      // Network errors - silently ignore
      console.debug('Error marking email as read (network error):', error)
    }
  }, [isValidRecipientId])

  // Calculate unread count for incoming emails across all threads
  const unreadCount = useMemo(() => {
    // Count unread messages from all threads, not just latest messages
    let count = 0
    Object.values(emailThreads).forEach((thread: any) => {
      if (thread.messages && Array.isArray(thread.messages)) {
        thread.messages.forEach((message: any) => {
          const isIncoming = !(message.isFromGC ?? message.is_from_gc ?? false)
          const isUnread = isIncoming && !message.read_by_gc_at
          if (isUnread) {
            count++
          }
        })
      }
    })
    return count
  }, [emailThreads])

  useEffect(() => {
    if (isOpen && jobId) {
      loadData()
      if (initialBidId) {
        setSelectedBidId(initialBidId)
      }
    }
  }, [isOpen, jobId, initialBidId, refreshTrigger])

  // Mark all unread messages in a thread as read when viewing it
  useEffect(() => {
    if (!selectedEmailRecipient) return
    
    const threadId = selectedEmailRecipient.thread_id || 
      `thread-${selectedEmailRecipient.bid_package_id || selectedEmailRecipient.bid_packages?.id}-${selectedEmailRecipient.subcontractor_email}`
    const thread = emailThreads[threadId]
    
    // If thread exists with messages, mark all unread incoming messages
    if (thread?.messages && Array.isArray(thread.messages)) {
      thread.messages.forEach((message: any) => {
        const isFromGC = message.isFromGC ?? message.is_from_gc ?? false
        const isIncoming = !isFromGC
        // Only mark as read if it's incoming, unread, and has a valid recipient ID
        // Double-check: never mark GC messages as read
        if (isIncoming && !isFromGC && !message.read_by_gc_at && isValidRecipientId(message.id)) {
          markEmailAsRead(message.id, message)
        }
      })
    } else {
      // If no thread data yet, mark the selected recipient itself if it's unread
      const isFromGC = selectedEmailRecipient.isFromGC ?? selectedEmailRecipient.is_from_gc ?? false
      const isIncoming = !isFromGC
      if (isIncoming && !isFromGC && !selectedEmailRecipient.read_by_gc_at && isValidRecipientId(selectedEmailRecipient.id)) {
        markEmailAsRead(selectedEmailRecipient.id, selectedEmailRecipient)
      }
    }
  }, [selectedEmailRecipient?.id, emailThreads, markEmailAsRead, isValidRecipientId])

  // Poll for email updates every 10 seconds when modal is open
  useEffect(() => {
    if (!isOpen || !jobId) {
      return
    }

    // Only reload email statuses, not all data (to avoid disrupting user)
    const refreshEmailStatuses = async () => {
      try {
        const statusResponse = await fetch(`/api/jobs/${jobId}/email-statuses`, {
          cache: 'no-store', // Ensure we don't get cached responses
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          
          if (statusData.recipients && Array.isArray(statusData.recipients)) {
            if (statusData.threads && Array.isArray(statusData.threads)) {
              const threadRecipients = statusData.threads.map((thread: any) => {
                return thread.latest_message
              })
              setAllRecipients(threadRecipients)
              
              const threadsMap: Record<string, any> = {}
              statusData.threads.forEach((thread: any) => {
                threadsMap[thread.thread_id] = thread
              })
              setEmailThreads(threadsMap)
              
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
        }
      } catch (err) {
        console.error('Error polling email statuses:', err)
      }
    }

    // Poll immediately, then every 10 seconds
    refreshEmailStatuses()
    const pollInterval = setInterval(refreshEmailStatuses, 10000)

    return () => {
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
      // AI analysis will now be triggered manually
    } else {
      setComparisonBidLineItems({})
      setAiAnalysis(null)
      setAiMatches(null)
    }
  }, [selectedComparisonBidIds, comparisonMode, selectedBidId])

  // Calculate selectedBid and filteredTakeoffItems before useEffects that depend on them
  const selectedBid = bids.find(b => b.id === selectedBidId)
  
  // Find the recipient associated with the selected bid
  const bidRecipient = useMemo(() => {
    if (!selectedBidId) return null
    
    // Find recipient where bid_id matches or bids array contains this bid
    const recipient = allRecipients.find((r: any) => {
      // Check if recipient has this bid_id
      if (r.bid_id === selectedBidId) return true
      // Check if recipient's bids array contains this bid
      if (r.bids && Array.isArray(r.bids) && r.bids.some((b: any) => b.id === selectedBidId)) return true
      return false
    })
    
    return recipient || null
  }, [selectedBidId, allRecipients])
  
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
      // AI analysis will now be triggered manually
    } else if (comparisonMode !== 'takeoff') {
      setTakeoffAIMatches(null)
      setTakeoffAIAnalysis(null)
    }
  }, [comparisonMode, selectedBidId, filteredTakeoffItems.length, bidLineItems.length, selectedTakeoffItemIds.size])

  const generateAIComparison = useCallback(async (forceRefresh = false) => {
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
  }, [selectedBidId, selectedComparisonBidIds, jobId])

  const generateTakeoffAIComparison = useCallback(async (forceRefresh = false) => {
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
  }, [selectedBidId, filteredTakeoffItems, bidLineItems, selectedTakeoffItemIds, jobId])

  // Default to emails tab when there are no bids
  useEffect(() => {
    if (bids.length === 0 && allRecipients.length > 0) {
      setLeftSideTab('emails')
    }
  }, [bids.length, allRecipients.length])

  // Function to check if content contains HTML
  const containsHTML = (content: string): boolean => {
    if (!content) return false
    return /<[a-z][\s\S]*>/i.test(content)
  }

  // Function to sanitize HTML content (remove scripts, keep styling)
  const sanitizeHTML = (content: string): string => {
    if (!content) return ''
    
    // Remove script tags and their content (security)
    let sanitized = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    
    // Remove event handlers (onclick, onerror, etc.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    
    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, '')
    
    return sanitized
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
                  <div className="border-b bg-white">
                    <div className="p-3">
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
                          {unreadCount > 0 && (
                            <Badge variant="default" className="ml-2 bg-blue-600 text-white animate-pulse">
                              {unreadCount}
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
                    {/* Search Bar - Bids */}
                    {leftSideTab === 'bids' && (
                      <div className="relative px-3 pb-3 border-b bg-white">
                        <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search bids..."
                          value={bidsSearchTerm}
                          onChange={(e) => setBidsSearchTerm(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    )}
                    {/* Search Bar - Emails */}
                    {leftSideTab === 'emails' && (
                      <div className="relative px-3 pb-3 border-b bg-white">
                        <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search emails..."
                          value={emailsSearchTerm}
                          onChange={(e) => setEmailsSearchTerm(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    )}
                  </div>
                  
                  <TabsContent value="bids" className="flex-1 overflow-y-auto p-3 mt-0 space-y-3 min-h-0">
                      {bids.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">No bids received yet</p>
                        </div>
                      )}
                      {(() => {
                        // Filter bids based on search term
                        const filteredBids = bids.filter((bid) => {
                          if (!bidsSearchTerm) return true
                          const searchLower = bidsSearchTerm.toLowerCase()
                          const subcontractorName = (bid.subcontractors?.name || bid.gc_contacts?.name || bid.subcontractor_email || 'Unknown').toLowerCase()
                          const subcontractorEmail = (bid.subcontractors?.email || bid.gc_contacts?.email || bid.subcontractor_email || '').toLowerCase()
                          const tradeCategory = (bid.subcontractors?.trade_category || bid.gc_contacts?.trade_category || (bid.bid_packages as any)?.trade_category || '').toLowerCase()
                          const bidAmount = bid.bid_amount?.toLocaleString() || ''
                          return (
                            subcontractorName.includes(searchLower) ||
                            subcontractorEmail.includes(searchLower) ||
                            tradeCategory.includes(searchLower) ||
                            bidAmount.includes(searchLower)
                          )
                        })
                        
                        // Organize bids by subcontractor type (trade_category)
                        const bidsBySubcontractorType = filteredBids.reduce((acc: any, bid: Bid) => {
                          const tradeCategory = bid.subcontractors?.trade_category || bid.gc_contacts?.trade_category || (bid.bid_packages as any)?.trade_category || 'Uncategorized'
                          if (!acc[tradeCategory]) acc[tradeCategory] = []
                          acc[tradeCategory].push(bid)
                          return acc
                        }, {})
                        
                        // Sort subcontractor types alphabetically
                        const sortedSubcontractorTypes = Object.keys(bidsBySubcontractorType).sort()
                        
                        if (filteredBids.length === 0 && bids.length > 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                              <p className="text-sm">No bids match your search</p>
                            </div>
                          )
                        }
                        
                        return sortedSubcontractorTypes.map((tradeCategory) => (
                          <div key={tradeCategory}>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                              {tradeCategory}
                            </h3>
                            <div className="space-y-2">
                              {bidsBySubcontractorType[tradeCategory].map((bid: Bid) => {
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
                            </div>
                          </div>
                        ))
                      })()}
                  </TabsContent>
                  
                  <TabsContent value="emails" className="flex-1 overflow-y-auto p-3 mt-0 space-y-4 min-h-0">
                      {allRecipients.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">No emails sent</p>
                        </div>
                      ) : (
                        (() => {
                          // Filter recipients based on search term
                          const filteredRecipients = allRecipients.filter((r: any) => {
                            if (!emailsSearchTerm) return true
                            const searchLower = emailsSearchTerm.toLowerCase()
                            const subcontractorName = (r.subcontractor_name || r.subcontractors?.name || r.subcontractor_email || '').toLowerCase()
                            const subcontractorEmail = (r.subcontractor_email || '').toLowerCase()
                            const tradeCategory = (r.bid_packages?.trade_category || 'Other').toLowerCase()
                            const status = (r.status || '').toLowerCase()
                            const responseText = (r.response_text || '').toLowerCase()
                            return (
                              subcontractorName.includes(searchLower) ||
                              subcontractorEmail.includes(searchLower) ||
                              tradeCategory.includes(searchLower) ||
                              status.includes(searchLower) ||
                              responseText.includes(searchLower)
                            )
                          })
                          
                          if (filteredRecipients.length === 0 && allRecipients.length > 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">No emails match your search</p>
                              </div>
                            )
                          }
                          
                          const groupedRecipients = filteredRecipients.reduce((acc: any, r: any) => {
                            const key = r.bid_packages?.trade_category || 'Other'
                            if (!acc[key]) acc[key] = []
                            acc[key].push(r)
                            return acc
                          }, {})
                          
                          return Object.entries(groupedRecipients).map(([category, recipients]: [string, any]) => (
                            <div key={category}>
                              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                                {category}
                              </h3>
                              <div className="space-y-2">
                                {recipients.map((recipient: any) => {
                                // Check if this thread has any unread messages
                                const threadId = recipient.thread_id || `thread-${recipient.bid_package_id || recipient.bid_packages?.id}-${recipient.subcontractor_email}`
                                const thread = emailThreads[threadId]
                                const hasUnreadInThread = thread?.messages?.some((m: any) => {
                                  const isIncoming = !(m.isFromGC ?? m.is_from_gc ?? false)
                                  return isIncoming && !m.read_by_gc_at
                                }) ?? false
                                
                                // Also check the recipient itself (for backward compatibility)
                                const isIncoming = !(recipient.isFromGC ?? recipient.is_from_gc ?? false)
                                const isUnread = isIncoming && !recipient.read_by_gc_at
                                const showUnread = hasUnreadInThread || isUnread
                                
                                return (
                                <div
                                  key={recipient.id}
                                  onClick={() => {
                                    setSelectedEmailRecipient(recipient)
                                    setSelectedBidId(null)
                                    setResponseText('')
                                    // Mark all unread messages in thread as read when viewing
                                    if (hasUnreadInThread && thread?.messages) {
                                      thread.messages.forEach((m: any) => {
                                        const isFromGC = m.isFromGC ?? m.is_from_gc ?? false
                                        const msgIsIncoming = !isFromGC
                                        if (msgIsIncoming && !isFromGC && !m.read_by_gc_at && isValidRecipientId(m.id)) {
                                          markEmailAsRead(m.id, m)
                                        }
                                      })
                                    } else if (isIncoming && !recipient.read_by_gc_at && isValidRecipientId(recipient.id)) {
                                      const isFromGC = recipient.isFromGC ?? recipient.is_from_gc ?? false
                                      if (!isFromGC) {
                                        markEmailAsRead(recipient.id, recipient)
                                      }
                                    }
                                  }}
                                  className={`
                                    cursor-pointer rounded-lg p-3 border transition-all
                                    ${selectedEmailRecipient?.id === recipient.id 
                                      ? 'border-blue-400 bg-white shadow-md ring-1 ring-blue-400/20' 
                                      : showUnread
                                      ? 'bg-blue-50/50 border-blue-300 hover:border-blue-400'
                                      : 'bg-white border-gray-200 hover:border-blue-200'
                                    }
                                  `}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-medium text-sm text-gray-900 truncate max-w-[180px]">
                                      {recipient.subcontractor_name || recipient.subcontractors?.name || recipient.subcontractor_email}
                                    </h4>
                                    <div className="flex items-center gap-1">
                                      {showUnread && (
                                        <Badge variant="default" className="h-2 w-2 p-0 rounded-full bg-blue-600 animate-pulse" title="Unread message" />
                                      )}
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
                                )
                              })}
                              </div>
                            </div>
                          ))
                        })()
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
                            // Use explicit isFromGC from API (fallback to false for safety)
                            const isFromGC = message.isFromGC ?? false
                            // Use fetched content if available, otherwise fall back to stored content
                            const messageContent = fetchedEmailContent[message.id] || message.response_text || message.notes || ''
                            const messageTime = message.responded_at || message.sent_at || message.created_at
                            
                            // Check if this is the original bid email (first message from GC)
                            const isOriginalBidEmail = index === 0 && isFromGC && message.resend_email_id
                            
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
                                    ) : isOriginalBidEmail ? (
                                      <p className="text-sm leading-relaxed italic opacity-90">
                                        Original bid email
                                      </p>
                                    ) : messageContent && containsHTML(messageContent) ? (
                                      <div 
                                        className="text-sm leading-relaxed max-w-none email-content"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(messageContent) }}
                                        style={{
                                          color: isFromGC ? 'white' : 'inherit',
                                          // Ensure links are visible
                                          '--tw-prose-links': isFromGC ? 'white' : 'rgb(59 130 246)',
                                        } as React.CSSProperties}
                                      />
                                    ) : (
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {messageContent || (isFromGC ? 'Email sent' : 'No message content available')}
                                      </p>
                                    )}
                                    {/* View Bid button for messages with bids */}
                                    {!isFromGC && message.bids && message.bids.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-gray-200">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedBidId(message.bids[0].id)
                                            setSelectedEmailRecipient(null)
                                            setLeftSideTab('bids')
                                          }}
                                          className="h-7 text-xs bg-white hover:bg-orange-50 border-orange-300 text-orange-700 hover:text-orange-800"
                                        >
                                          <FileText className="h-3 w-3 mr-1.5" />
                                          View Bid
                                        </Button>
                                      </div>
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
                        <div className="flex items-start gap-6">
                            {/* Action Buttons */}
                          <div className="flex gap-2 flex-wrap">
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
                          {/* Bid Amount */}
                          <div className="text-right">
                            <div className="text-3xl font-bold text-gray-900">
                              ${selectedBid.bid_amount?.toLocaleString() ?? '0.00'}
                            </div>
                            <div className="text-sm text-gray-500">Total Bid Amount</div>
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
                                      <CardTitle className="text-base font-semibold">Item Comparison</CardTitle>
                                      <div className="flex items-center gap-2">
                                        {loadingTakeoffAI && (
                                          <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                            <span>AI analyzing...</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => generateTakeoffAIComparison()}
                                            disabled={loadingTakeoffAI || !selectedBidId || filteredTakeoffItems.length === 0 || bidLineItems.length === 0 || selectedTakeoffItemIds.size === 0}
                                            className="flex items-center gap-2"
                                          >
                                            {loadingTakeoffAI ? (
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                            ) : (
                                              <GitCompare className="h-4 w-4" />
                                            )}
                                            {loadingTakeoffAI ? 'Analyzing...' : 'Run AI Analysis'}
                                          </Button>
                                          {isTakeoffCached && (
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                              Cached
                                            </Badge>
                                          )}
                                          {takeoffAIAnalysis && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setShowAISidebar(!showAISidebar)}
                                              className="flex items-center gap-2"
                                            >
                                              {showAISidebar ? 'Hide' : 'Show'} AI Analysis
                                            </Button>
                                          )}
                                          {isTakeoffCached && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => generateTakeoffAIComparison(true)}
                                              className="text-xs"
                                              title="Refresh analysis"
                                            >
                                              <RefreshCw className="h-3 w-3" />
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
                                        <div className="overflow-y-auto">
                                          {(() => {
                                            const selectedTakeoffItems = filteredTakeoffItems.filter(item => selectedTakeoffItemIds.has(item.id))
                                            
                                            // Group items by category
                                            const takeoffByCategory = selectedTakeoffItems.reduce((acc, item) => {
                                              const cat = item.category || 'Uncategorized'
                                              if (!acc[cat]) acc[cat] = []
                                              acc[cat].push(item)
                                              return acc
                                            }, {} as Record<string, typeof selectedTakeoffItems>)
                                            
                                            const bidByCategory = bidLineItems.reduce((acc, item) => {
                                              const cat = item.category || 'Uncategorized'
                                              if (!acc[cat]) acc[cat] = []
                                              acc[cat].push(item)
                                              return acc
                                            }, {} as Record<string, typeof bidLineItems>)
                                            
                                            // Get all unique categories
                                            const allCategories = Array.from(new Set([
                                              ...Object.keys(takeoffByCategory),
                                              ...Object.keys(bidByCategory)
                                            ])).sort()
                                            
                                            if (allCategories.length === 0) {
                                              return (
                                                <div className="p-12 text-center text-gray-500">
                                                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                                  <p className="font-medium">No items selected for comparison</p>
                                                  <p className="text-sm mt-2">Select items from the left panel to compare</p>
                                                </div>
                                              )
                                            }
                                            
                                            return (
                                              <div className="space-y-6 p-4">
                                                {allCategories.map(category => {
                                                  const takeoffItemsInCat = takeoffByCategory[category] || []
                                                  const bidItemsInCat = bidByCategory[category] || []
                                                  
                                                  // Calculate category totals
                                                  const takeoffTotal = takeoffItemsInCat.reduce((sum, item) => 
                                                    sum + (item.quantity * (item.unit_cost || 0)), 0
                                                  )
                                                  const bidTotal = bidItemsInCat.reduce((sum, item) => sum + item.amount, 0)
                                                  
                                                  // Build AI match map for this category
                                                  const aiMatchMap = new Map<string, any>()
                                                  if (takeoffAIMatches && takeoffAIMatches.length > 0) {
                                                    takeoffItemsInCat.forEach(takeoffItem => {
                                                      const match = takeoffAIMatches.find((m: any) => m.takeoffItem.id === takeoffItem.id)
                                                      if (match) {
                                                        aiMatchMap.set(takeoffItem.id, match)
                                                      }
                                                    })
                                                  }
                                                  
                                                  return (
                                                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                      {/* Category Header */}
                                                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 border-b border-gray-200">
                                                        <div className="flex items-center justify-between">
                                                          <h3 className="font-semibold text-gray-900">{category}</h3>
                                                          <div className="flex items-center gap-4 text-sm">
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-gray-600">Takeoff:</span>
                                                              <span className="font-bold text-blue-700">${takeoffTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-gray-600">Bid:</span>
                                                              <span className="font-bold text-green-700">${bidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                            {takeoffTotal > 0 && bidTotal > 0 && (
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-gray-600">Diff:</span>
                                                                <span className={`font-bold ${bidTotal > takeoffTotal ? 'text-red-600' : 'text-green-600'}`}>
                                                                  {bidTotal > takeoffTotal ? '+' : ''}${(bidTotal - takeoffTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </div>
                                                      
                                                      {/* Items Grid */}
                                                      <div className="grid grid-cols-2 gap-0">
                                                        {/* Takeoff Items Column */}
                                                        <div className="border-r border-gray-200 bg-blue-50/20">
                                                          <div className="px-4 py-2 bg-blue-100/50 border-b border-gray-200">
                                                            <h4 className="text-sm font-semibold text-blue-900">Takeoff Items ({takeoffItemsInCat.length})</h4>
                                                          </div>
                                                          <div className="divide-y divide-gray-200">
                                                            {takeoffItemsInCat.length > 0 ? (
                                                              takeoffItemsInCat.map(takeoffItem => {
                                                                const aiMatch = aiMatchMap.get(takeoffItem.id)
                                                                const hasVariance = aiMatch && (aiMatch.quantityVariance || aiMatch.priceVariance)
                                                                
                                                                return (
                                                                  <div 
                                                                    key={takeoffItem.id} 
                                                                    className={`p-4 hover:bg-blue-50/50 transition-colors ${hasVariance ? 'bg-orange-50/40 border-l-4 border-orange-400' : ''}`}
                                                                  >
                                                                    <div className="space-y-2">
                                                                      <div className="flex items-start justify-between gap-2">
                                                                        <div className="font-semibold text-sm text-gray-900 flex-1">{takeoffItem.description}</div>
                                                                        {aiMatch && aiMatch.confidence > 0 && (
                                                                          <Badge 
                                                                            variant="outline" 
                                                                            className={`text-xs flex-shrink-0 ${
                                                                              aiMatch.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                              aiMatch.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                              'bg-orange-50 text-orange-700 border-orange-200'
                                                                            }`}
                                                                            title={aiMatch.notes || `${aiMatch.matchType} match`}
                                                                          >
                                                                            {aiMatch.confidence}%
                                                                          </Badge>
                                                                        )}
                                                                      </div>
                                                                      <div className="text-xs text-gray-600">
                                                                        {takeoffItem.quantity} {takeoffItem.unit}
                                                                        {takeoffItem.unit_cost && ` @ $${takeoffItem.unit_cost.toLocaleString()}/${takeoffItem.unit}`}
                                                                      </div>
                                                                      {takeoffItem.unit_cost && (
                                                                        <div className="font-bold text-blue-700 text-base">
                                                                          ${(takeoffItem.quantity * takeoffItem.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                        </div>
                                                                      )}
                                                                      {aiMatch && (aiMatch.quantityVariance || aiMatch.priceVariance) && (
                                                                        <div className="mt-2 space-y-1">
                                                                          {aiMatch.quantityVariance && aiMatch.quantityVariance > 20 && (
                                                                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                              Qty: {aiMatch.quantityVariance.toFixed(0)}%
                                                                            </Badge>
                                                                          )}
                                                                          {aiMatch.priceVariance && aiMatch.priceVariance > 15 && (
                                                                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                              Price: {aiMatch.priceVariance.toFixed(0)}%
                                                                            </Badge>
                                                                          )}
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  </div>
                                                                )
                                                              })
                                                            ) : (
                                                              <div className="p-8 text-center text-gray-400 text-sm">
                                                                No takeoff items
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                        
                                                        {/* Bid Items Column */}
                                                        <div className="bg-green-50/20">
                                                          <div className="px-4 py-2 bg-green-100/50 border-b border-gray-200">
                                                            <h4 className="text-sm font-semibold text-green-900">Bid Items ({bidItemsInCat.length})</h4>
                                                          </div>
                                                          <div className="divide-y divide-gray-200">
                                                            {bidItemsInCat.length > 0 ? (
                                                              bidItemsInCat.map(bidItem => {
                                                                // Find if this bid item is matched to any takeoff item
                                                                const matchedTakeoff = takeoffAIMatches?.find((m: any) => m.bidItem?.id === bidItem.id)
                                                                const hasVariance = matchedTakeoff && (matchedTakeoff.quantityVariance || matchedTakeoff.priceVariance)
                                                                
                                                                return (
                                                                  <div 
                                                                    key={bidItem.id} 
                                                                    className={`p-4 hover:bg-green-50/50 transition-colors ${hasVariance ? 'bg-orange-50/40 border-l-4 border-orange-400' : ''}`}
                                                                  >
                                                                    <div className="space-y-2">
                                                                      <div className="flex items-start justify-between gap-2">
                                                                        <div className="font-semibold text-sm text-gray-900 flex-1">{bidItem.description}</div>
                                                                        {matchedTakeoff && matchedTakeoff.confidence > 0 && (
                                                                          <Badge 
                                                                            variant="outline" 
                                                                            className={`text-xs flex-shrink-0 ${
                                                                              matchedTakeoff.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                              matchedTakeoff.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                              'bg-orange-50 text-orange-700 border-orange-200'
                                                                            }`}
                                                                            title={matchedTakeoff.notes || `${matchedTakeoff.matchType} match`}
                                                                          >
                                                                            {matchedTakeoff.confidence}%
                                                                          </Badge>
                                                                        )}
                                                                      </div>
                                                                      {bidItem.notes && (
                                                                        <div className="text-xs text-gray-600 italic">{bidItem.notes}</div>
                                                                      )}
                                                                      <div className="text-xs text-gray-600">
                                                                        {bidItem.quantity} {bidItem.unit}
                                                                        {bidItem.unit_price && ` @ $${bidItem.unit_price.toLocaleString()}/${bidItem.unit || 'unit'}`}
                                                                      </div>
                                                                      <div className={`font-bold text-base ${hasVariance ? 'text-orange-600' : 'text-green-700'}`}>
                                                                        ${bidItem.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                      </div>
                                                                      {matchedTakeoff && (matchedTakeoff.quantityVariance || matchedTakeoff.priceVariance) && (
                                                                        <div className="mt-2 space-y-1">
                                                                          {matchedTakeoff.quantityVariance && matchedTakeoff.quantityVariance > 20 && (
                                                                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                              Qty: {matchedTakeoff.quantityVariance.toFixed(0)}%
                                                                            </Badge>
                                                                          )}
                                                                          {matchedTakeoff.priceVariance && matchedTakeoff.priceVariance > 15 && (
                                                                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                              Price: {matchedTakeoff.priceVariance.toFixed(0)}%
                                                                            </Badge>
                                                                          )}
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  </div>
                                                                )
                                                              })
                                                            ) : (
                                                              <div className="p-8 text-center text-gray-400 text-sm">
                                                                No bid items
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )
                                          })()}
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
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => generateAIComparison()}
                                              disabled={loadingAI || !selectedBidId || selectedComparisonBidIds.size === 0}
                                              className="flex items-center gap-2"
                                            >
                                              {loadingAI ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                              ) : (
                                                <GitCompare className="h-4 w-4" />
                                              )}
                                              {loadingAI ? 'Analyzing...' : 'Run AI Analysis'}
                                            </Button>
                                            {isCached && (
                                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                Cached
                                              </Badge>
                                            )}
                                            {aiAnalysis && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowAISidebar(!showAISidebar)}
                                                className="flex items-center gap-2"
                                              >
                                                {showAISidebar ? 'Hide' : 'Show'} AI Analysis
                                              </Button>
                                            )}
                                            {isCached && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => generateAIComparison(true)}
                                                className="text-xs"
                                                title="Refresh analysis"
                                              >
                                                <RefreshCw className="h-3 w-3" />
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
                                          <div className="overflow-y-auto">
                                            {(() => {
                                              // Group all items by category
                                              const selectedBidByCategory = bidLineItems.reduce((acc, item) => {
                                                const cat = item.category || 'Uncategorized'
                                                if (!acc[cat]) acc[cat] = []
                                                acc[cat].push(item)
                                                return acc
                                              }, {} as Record<string, typeof bidLineItems>)
                                              
                                              const comparisonBidsByCategory: Record<string, Record<string, BidLineItem[]>> = {}
                                              Array.from(selectedComparisonBidIds).forEach(bidId => {
                                                const compItems = comparisonBidLineItems[bidId] || []
                                                compItems.forEach(item => {
                                                  const cat = item.category || 'Uncategorized'
                                                  if (!comparisonBidsByCategory[cat]) comparisonBidsByCategory[cat] = {}
                                                  if (!comparisonBidsByCategory[cat][bidId]) comparisonBidsByCategory[cat][bidId] = []
                                                  comparisonBidsByCategory[cat][bidId].push(item)
                                                })
                                              })
                                              
                                              // Get all unique categories
                                              const allCategories = Array.from(new Set([
                                                ...Object.keys(selectedBidByCategory),
                                                ...Object.keys(comparisonBidsByCategory)
                                              ])).sort()
                                              
                                              if (allCategories.length === 0) {
                                                return (
                                                  <div className="p-12 text-center text-gray-500">
                                                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                                    <p className="font-medium">No line items found in the selected bid</p>
                                                  </div>
                                                )
                                              }
                                              
                                              // Build AI match maps for each comparison bid
                                              const aiMatchMaps: Record<string, Map<string, any>> = {}
                                              if (aiMatches && aiMatches.length > 0) {
                                                Array.from(selectedComparisonBidIds).forEach(bidId => {
                                                  const map = new Map<string, any>()
                                                  bidLineItems.forEach(selectedItem => {
                                                    const aiMatch = aiMatches.find((m: any) => m.selectedBidItem.id === selectedItem.id)
                                                    if (aiMatch) {
                                                      const match = aiMatch.comparisonItems.find((ci: any) => ci.bidId === bidId)
                                                      if (match) {
                                                        map.set(selectedItem.id, match)
                                                      }
                                                    }
                                                  })
                                                  aiMatchMaps[bidId] = map
                                                })
                                              }
                                              
                                              return (
                                                <div className="space-y-6 p-4">
                                                  {allCategories.map(category => {
                                                    const selectedItemsInCat = selectedBidByCategory[category] || []
                                                    const selectedTotal = selectedItemsInCat.reduce((sum, item) => sum + item.amount, 0)
                                                    
                                                    return (
                                                      <div key={category} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                        {/* Category Header */}
                                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 border-b border-gray-200">
                                                          <div className="flex items-center justify-between">
                                                            <h3 className="font-semibold text-gray-900">{category}</h3>
                                                            <div className="flex items-center gap-4 text-sm">
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-gray-600">Selected:</span>
                                                                <span className="font-bold text-blue-700">${selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                              </div>
                                                              {Array.from(selectedComparisonBidIds).map(bidId => {
                                                                const compItems = comparisonBidsByCategory[category]?.[bidId] || []
                                                                const compTotal = compItems.reduce((sum, item) => sum + item.amount, 0)
                                                                const bid = bids.find(b => b.id === bidId)
                                                                return (
                                                                  <div key={bidId} className="flex items-center gap-2">
                                                                    <span className="text-gray-600 text-xs">{bid?.subcontractors?.name || bid?.gc_contacts?.name || 'Bid'}:</span>
                                                                    <span className={`font-bold text-sm ${compTotal > selectedTotal ? 'text-red-600' : compTotal < selectedTotal ? 'text-green-600' : 'text-gray-900'}`}>
                                                                      ${compTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                  </div>
                                                                )
                                                              })}
                                                            </div>
                                                          </div>
                                                        </div>
                                                        
                                                        {/* Items Grid - Horizontal Scroll */}
                                                        <div className="overflow-x-auto">
                                                          <div className="flex gap-0 min-w-max">
                                                            {/* Selected Bid Column */}
                                                            <div className="flex-shrink-0 w-80 border-r-2 border-gray-300 bg-blue-50/20">
                                                              <div className="px-4 py-2 bg-blue-100/50 border-b border-gray-200 sticky left-0 z-10">
                                                                <h4 className="text-sm font-semibold text-blue-900">
                                                                  {selectedBid?.subcontractors?.name || selectedBid?.gc_contacts?.name || 'Selected Bid'} ({selectedItemsInCat.length})
                                                                </h4>
                                                              </div>
                                                              <div className="divide-y divide-gray-200">
                                                                {selectedItemsInCat.length > 0 ? (
                                                                  selectedItemsInCat.map(item => (
                                                                    <div key={item.id} className="p-4 hover:bg-blue-50/50 transition-colors">
                                                                      <div className="space-y-2">
                                                                        <div className="font-semibold text-sm text-gray-900">{item.description}</div>
                                                                        {item.notes && (
                                                                          <div className="text-xs text-gray-600 italic">{item.notes}</div>
                                                                        )}
                                                                        <div className="text-xs text-gray-600">
                                                                          {item.quantity} {item.unit}
                                                                          {item.unit_price && ` @ $${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}/${item.unit || 'unit'}`}
                                                                        </div>
                                                                        <div className="font-bold text-blue-700 text-base">
                                                                          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                        </div>
                                                                      </div>
                                                                    </div>
                                                                  ))
                                                                ) : (
                                                                  <div className="p-8 text-center text-gray-400 text-sm">No items</div>
                                                                )}
                                                              </div>
                                                            </div>
                                                            
                                                            {/* Comparison Bid Columns */}
                                                            {Array.from(selectedComparisonBidIds).map(bidId => {
                                                              const bid = bids.find(b => b.id === bidId)
                                                              const compItems = comparisonBidsByCategory[category]?.[bidId] || []
                                                              const aiMatchMap = aiMatchMaps[bidId] || new Map()
                                                              
                                                              return (
                                                                <div key={bidId} className="flex-shrink-0 w-80 border-r-2 border-gray-300 bg-white last:border-r-0">
                                                                  <div className="px-4 py-2 bg-gray-100/50 border-b border-gray-200 sticky left-0 z-10">
                                                                    <h4 className="text-sm font-semibold text-gray-900">
                                                                      {bid?.subcontractors?.name || bid?.gc_contacts?.name || 'Unknown'} ({compItems.length})
                                                                    </h4>
                                                                  </div>
                                                                  <div className="divide-y divide-gray-200">
                                                                    {compItems.length > 0 ? (
                                                                      compItems.map(compItem => {
                                                                        // Check if this item matches any selected item via AI
                                                                        let match: any = null
                                                                        for (const [selectedItemId, matchData] of aiMatchMap.entries()) {
                                                                          if (matchData.item?.id === compItem.id) {
                                                                            match = matchData
                                                                            break
                                                                          }
                                                                        }
                                                                        
                                                                        // Find corresponding selected item for comparison
                                                                        const correspondingSelected = selectedItemsInCat.find(si => {
                                                                          const m = aiMatchMap.get(si.id)
                                                                          return m?.item?.id === compItem.id
                                                                        })
                                                                        
                                                                        const isLower = correspondingSelected && compItem.amount < correspondingSelected.amount
                                                                        const isHigher = correspondingSelected && compItem.amount > correspondingSelected.amount
                                                                        const hasVariance = correspondingSelected && 
                                                                          Math.abs(compItem.amount - correspondingSelected.amount) > correspondingSelected.amount * 0.1
                                                                        
                                                                        return (
                                                                          <div 
                                                                            key={compItem.id} 
                                                                            className={`p-4 hover:bg-gray-50/50 transition-colors ${hasVariance ? 'bg-orange-50/40 border-l-4 border-orange-400' : ''}`}
                                                                          >
                                                                            <div className="space-y-2">
                                                                              <div className="flex items-start justify-between gap-2">
                                                                                <div className="font-semibold text-sm text-gray-900 flex-1">{compItem.description}</div>
                                                                                {match?.confidence && (
                                                                                  <Badge 
                                                                                    variant="outline" 
                                                                                    className={`text-xs flex-shrink-0 ${
                                                                                      match.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                      match.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                                      'bg-orange-50 text-orange-700 border-orange-200'
                                                                                    }`}
                                                                                    title={match.notes || `${match.matchType} match`}
                                                                                  >
                                                                                    {match.confidence}%
                                                                                  </Badge>
                                                                                )}
                                                                              </div>
                                                                              {compItem.notes && (
                                                                                <div className="text-xs text-gray-600 italic">{compItem.notes}</div>
                                                                              )}
                                                                              <div className="text-xs text-gray-600">
                                                                                {compItem.quantity} {compItem.unit}
                                                                                {compItem.unit_price && ` @ $${compItem.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}/${compItem.unit || 'unit'}`}
                                                                              </div>
                                                                              <div className={`font-bold text-base ${isLower ? 'text-green-700' : isHigher ? 'text-red-600' : 'text-gray-900'}`}>
                                                                                ${compItem.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                              </div>
                                                                              {hasVariance && !match?.confidence && correspondingSelected && (
                                                                                <Badge variant="outline" className="mt-1 text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                                  {((compItem.amount - correspondingSelected.amount) / correspondingSelected.amount * 100).toFixed(0)}% {isLower ? 'lower' : 'higher'}
                                                                                </Badge>
                                                                              )}
                                                                            </div>
                                                                          </div>
                                                                        )
                                                                      })
                                                                    ) : (
                                                                      <div className="p-8 text-center text-gray-400 text-sm">No items</div>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              )
                                                            })}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    )
                                                  })}
                                                </div>
                                              )
                                            })()}
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

                        {/* Email Conversation Tab */}
                        {bidRecipient && (
                          <TabsContent value="conversation" className="mt-0">
                            <div className="flex flex-col h-full bg-white">
                              {/* Chat Messages Container */}
                              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 bg-gray-50 min-h-[400px]">
                                {(() => {
                                  // Get thread for this recipient
                                  const threadId = bidRecipient.thread_id || 
                                    `thread-${bidRecipient.bid_package_id || bidRecipient.bid_packages?.id}-${bidRecipient.subcontractor_email}`
                                  const thread = emailThreads[threadId]
                                  const threadMessages = thread?.messages || [bidRecipient]
                                  
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
                                    const isFromGC = message.isFromGC ?? false
                                    const messageContent = fetchedEmailContent[message.id] || message.response_text || message.notes || ''
                                    const messageTime = message.responded_at || message.sent_at || message.created_at
                                    
                                    // Fetch email content if missing
                                    if (!messageContent && message.resend_email_id && !fetchingEmailContent.has(message.id) && !fetchedEmailContent[message.id]) {
                                      setFetchingEmailContent(prev => new Set(prev).add(message.id))
                                      fetch(`/api/emails/${message.resend_email_id}/content`)
                                        .then(res => res.json())
                                        .then(data => {
                                          if (data.content) {
                                            setFetchedEmailContent(prev => ({
                                              ...prev,
                                              [message.id]: data.content
                                            }))
                                          }
                                        })
                                        .catch(err => console.error('Failed to fetch email content:', err))
                                        .finally(() => {
                                          setFetchingEmailContent(prev => {
                                            const next = new Set(prev)
                                            next.delete(message.id)
                                            return next
                                          })
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
                                        {showAvatar ? (
                                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm ${
                                            isFromGC ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                          }`}>
                                            {isFromGC ? 'Y' : getInitials(senderName)}
                                          </div>
                                        ) : (
                                          <div className="w-8" />
                                        )}
                                        
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
                                            ) : messageContent && containsHTML(messageContent) ? (
                                              <div 
                                                className="text-sm leading-relaxed max-w-none email-content"
                                                dangerouslySetInnerHTML={{ __html: sanitizeHTML(messageContent) }}
                                                style={{
                                                  color: isFromGC ? 'white' : 'inherit',
                                                  '--tw-prose-links': isFromGC ? 'white' : 'rgb(59 130 246)',
                                                } as React.CSSProperties}
                                              />
                                            ) : (
                                              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                                {messageContent || (isFromGC ? 'Email sent' : 'No message content available')}
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

                              {/* Reply Input */}
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
                                            // Use bidRecipient for sending
                                            const sendMessage = async () => {
                                              if (!responseText.trim() || !bidRecipient?.id || sendingResponse) return
                                              const bidPackageId = bidRecipient.bid_package_id || bidRecipient.bid_packages?.id
                                              if (!bidPackageId) return

                                              setSendingResponse(true)
                                              setError('')
                                              try {
                                                const res = await fetch(`/api/bid-packages/${bidPackageId}/respond`, {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    recipientId: bidRecipient.id,
                                                    responseText: responseText.trim()
                                                  })
                                                })
                                                if (res.ok) {
                                                  await loadData()
                                                  setResponseText('')
                                                  // Reload email statuses
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
                                            sendMessage()
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
                                      onClick={async () => {
                                        if (!responseText.trim() || !bidRecipient?.id || sendingResponse) return
                                        const bidPackageId = bidRecipient.bid_package_id || bidRecipient.bid_packages?.id
                                        if (!bidPackageId) return

                                        setSendingResponse(true)
                                        setError('')
                                        try {
                                          const res = await fetch(`/api/bid-packages/${bidPackageId}/respond`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              recipientId: bidRecipient.id,
                                              responseText: responseText.trim()
                                            })
                                          })
                                          if (res.ok) {
                                            await loadData()
                                            setResponseText('')
                                            // Reload email statuses
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
                                      }}
                                      className="h-[44px] w-[44px] rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                      {sendingResponse ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                      ) : (
                                        <Mail className="h-4 w-4 text-white" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                {error && <p className="text-sm text-red-600 mt-2 px-1">{error}</p>}
                              </div>
                            </div>
                          </TabsContent>
                        )}
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
                  <div className="border-b bg-white">
                    <div className="p-3">
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
                          {unreadCount > 0 && (
                            <Badge variant="default" className="ml-2 bg-blue-600 text-white animate-pulse">
                              {unreadCount}
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
                    {/* Search Bar - Bids */}
                    {leftSideTab === 'bids' && (
                      <div className="relative px-3 pb-3 border-b bg-white">
                        <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search bids..."
                          value={bidsSearchTerm}
                          onChange={(e) => setBidsSearchTerm(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    )}
                    {/* Search Bar - Emails */}
                    {leftSideTab === 'emails' && (
                      <div className="relative px-3 pb-3 border-b bg-white">
                        <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search emails..."
                          value={emailsSearchTerm}
                          onChange={(e) => setEmailsSearchTerm(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    )}
                  </div>
                  
                  <TabsContent value="bids" className="flex-1 overflow-y-auto p-3 mt-0 space-y-3 min-h-0">
                      {bids.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">No bids received yet</p>
                        </div>
                      )}
                      {(() => {
                        // Filter bids based on search term
                        const filteredBids = bids.filter((bid) => {
                          if (!bidsSearchTerm) return true
                          const searchLower = bidsSearchTerm.toLowerCase()
                          const subcontractorName = (bid.subcontractors?.name || bid.gc_contacts?.name || bid.subcontractor_email || 'Unknown').toLowerCase()
                          const subcontractorEmail = (bid.subcontractors?.email || bid.gc_contacts?.email || bid.subcontractor_email || '').toLowerCase()
                          const tradeCategory = (bid.subcontractors?.trade_category || bid.gc_contacts?.trade_category || (bid.bid_packages as any)?.trade_category || '').toLowerCase()
                          const bidAmount = bid.bid_amount?.toLocaleString() || ''
                          return (
                            subcontractorName.includes(searchLower) ||
                            subcontractorEmail.includes(searchLower) ||
                            tradeCategory.includes(searchLower) ||
                            bidAmount.includes(searchLower)
                          )
                        })
                        
                        // Organize bids by subcontractor type (trade_category)
                        const bidsBySubcontractorType = filteredBids.reduce((acc: any, bid: Bid) => {
                          const tradeCategory = bid.subcontractors?.trade_category || bid.gc_contacts?.trade_category || (bid.bid_packages as any)?.trade_category || 'Uncategorized'
                          if (!acc[tradeCategory]) acc[tradeCategory] = []
                          acc[tradeCategory].push(bid)
                          return acc
                        }, {})
                        
                        // Sort subcontractor types alphabetically
                        const sortedSubcontractorTypes = Object.keys(bidsBySubcontractorType).sort()
                        
                        if (filteredBids.length === 0 && bids.length > 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                              <p className="text-sm">No bids match your search</p>
                            </div>
                          )
                        }
                        
                        return sortedSubcontractorTypes.map((tradeCategory) => (
                          <div key={tradeCategory}>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                              {tradeCategory}
                            </h3>
                            <div className="space-y-2">
                              {bidsBySubcontractorType[tradeCategory].map((bid: Bid) => {
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
                            </div>
                          </div>
                        ))
                      })()}
                  </TabsContent>
                  
                  <TabsContent value="emails" className="flex-1 overflow-y-auto p-3 mt-0 space-y-4 min-h-0">
                      {allRecipients.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Mail className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">No emails sent</p>
                        </div>
                      ) : (
                        (() => {
                          // Filter recipients based on search term
                          const filteredRecipients = allRecipients.filter((r: any) => {
                            if (!emailsSearchTerm) return true
                            const searchLower = emailsSearchTerm.toLowerCase()
                            const subcontractorName = (r.subcontractor_name || r.subcontractors?.name || r.subcontractor_email || '').toLowerCase()
                            const subcontractorEmail = (r.subcontractor_email || '').toLowerCase()
                            const tradeCategory = (r.bid_packages?.trade_category || 'Other').toLowerCase()
                            const status = (r.status || '').toLowerCase()
                            const responseText = (r.response_text || '').toLowerCase()
                            return (
                              subcontractorName.includes(searchLower) ||
                              subcontractorEmail.includes(searchLower) ||
                              tradeCategory.includes(searchLower) ||
                              status.includes(searchLower) ||
                              responseText.includes(searchLower)
                            )
                          })
                          
                          if (filteredRecipients.length === 0 && allRecipients.length > 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">No emails match your search</p>
                              </div>
                            )
                          }
                          
                          const groupedRecipients = filteredRecipients.reduce((acc: any, r: any) => {
                            const key = r.bid_packages?.trade_category || 'Other'
                            if (!acc[key]) acc[key] = []
                            acc[key].push(r)
                            return acc
                          }, {})
                          
                          return Object.entries(groupedRecipients).map(([category, recipients]: [string, any]) => (
                            <div key={category}>
                              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                                {category}
                              </h3>
                              <div className="space-y-2">
                                {recipients.map((recipient: any) => {
                                // Check if this thread has any unread messages
                                const threadId = recipient.thread_id || `thread-${recipient.bid_package_id || recipient.bid_packages?.id}-${recipient.subcontractor_email}`
                                const thread = emailThreads[threadId]
                                const hasUnreadInThread = thread?.messages?.some((m: any) => {
                                  const isIncoming = !(m.isFromGC ?? m.is_from_gc ?? false)
                                  return isIncoming && !m.read_by_gc_at
                                }) ?? false
                                
                                // Also check the recipient itself (for backward compatibility)
                                const isIncoming = !(recipient.isFromGC ?? recipient.is_from_gc ?? false)
                                const isUnread = isIncoming && !recipient.read_by_gc_at
                                const showUnread = hasUnreadInThread || isUnread
                                
                                return (
                                <div
                                  key={recipient.id}
                                  onClick={() => {
                                    setSelectedEmailRecipient(recipient)
                                    setSelectedBidId(null)
                                    setResponseText('')
                                    // Mark all unread messages in thread as read when viewing
                                    if (hasUnreadInThread && thread?.messages) {
                                      thread.messages.forEach((m: any) => {
                                        const isFromGC = m.isFromGC ?? m.is_from_gc ?? false
                                        const msgIsIncoming = !isFromGC
                                        if (msgIsIncoming && !isFromGC && !m.read_by_gc_at && isValidRecipientId(m.id)) {
                                          markEmailAsRead(m.id, m)
                                        }
                                      })
                                    } else if (isIncoming && !recipient.read_by_gc_at && isValidRecipientId(recipient.id)) {
                                      const isFromGC = recipient.isFromGC ?? recipient.is_from_gc ?? false
                                      if (!isFromGC) {
                                        markEmailAsRead(recipient.id, recipient)
                                      }
                                    }
                                  }}
                                  className={`
                                    cursor-pointer rounded-lg p-3 border transition-all
                                    ${selectedEmailRecipient?.id === recipient.id 
                                      ? 'border-blue-400 bg-white shadow-md ring-1 ring-blue-400/20' 
                                      : showUnread
                                      ? 'bg-blue-50/50 border-blue-300 hover:border-blue-400'
                                      : 'bg-white border-gray-200 hover:border-blue-200'
                                    }
                                  `}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-medium text-sm text-gray-900 truncate max-w-[180px]">
                                      {recipient.subcontractor_name || recipient.subcontractors?.name || recipient.subcontractor_email}
                                    </h4>
                                    <div className="flex items-center gap-1">
                                      {showUnread && (
                                        <Badge variant="default" className="h-2 w-2 p-0 rounded-full bg-blue-600 animate-pulse" title="Unread message" />
                                      )}
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
                                )
                              })}
                              </div>
                            </div>
                          ))
                        })()
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
                            // Use explicit isFromGC from API (fallback to false for safety)
                            const isFromGC = message.isFromGC ?? false
                            // Use fetched content if available, otherwise fall back to stored content
                            const messageContent = fetchedEmailContent[message.id] || message.response_text || message.notes || ''
                            const messageTime = message.responded_at || message.sent_at || message.created_at
                            
                            // Check if this is the original bid email (first message from GC)
                            const isOriginalBidEmail = index === 0 && isFromGC && message.resend_email_id
                            
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
                                    ) : isOriginalBidEmail ? (
                                      <p className="text-sm leading-relaxed italic opacity-90">
                                        Original bid email
                                      </p>
                                    ) : messageContent && containsHTML(messageContent) ? (
                                      <div 
                                        className="text-sm leading-relaxed max-w-none email-content"
                                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(messageContent) }}
                                        style={{
                                          color: isFromGC ? 'white' : 'inherit',
                                          // Ensure links are visible
                                          '--tw-prose-links': isFromGC ? 'white' : 'rgb(59 130 246)',
                                        } as React.CSSProperties}
                                      />
                                    ) : (
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {messageContent || (isFromGC ? 'Email sent' : 'No message content available')}
                                      </p>
                                    )}
                                    {/* View Bid button for messages with bids */}
                                    {!isFromGC && message.bids && message.bids.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-gray-200">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedBidId(message.bids[0].id)
                                            setSelectedEmailRecipient(null)
                                            setLeftSideTab('bids')
                                          }}
                                          className="h-7 text-xs bg-white hover:bg-orange-50 border-orange-300 text-orange-700 hover:text-orange-800"
                                        >
                                          <FileText className="h-3 w-3 mr-1.5" />
                                          View Bid
                                        </Button>
                                      </div>
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
                        <div className="flex items-start gap-6">
                            {/* Action Buttons */}
                          <div className="flex gap-2 flex-wrap">
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
                          {/* Bid Amount */}
                          <div className="text-right">
                            <div className="text-3xl font-bold text-gray-900">
                              ${selectedBid.bid_amount?.toLocaleString() ?? '0.00'}
                            </div>
                            <div className="text-sm text-gray-500">Total Bid Amount</div>
                          </div>
                        </div>
                      </div>

                      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'comparison' | 'conversation')} className="w-full">
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
                          {bidRecipient && (
                            <TabsTrigger 
                              value="conversation"
                              className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 data-[state=active]:bg-transparent data-[state=active]:text-orange-600 px-4 py-3"
                            >
                              Email Conversation
                            </TabsTrigger>
                          )}
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
                                      <CardTitle className="text-base font-semibold">Item Comparison</CardTitle>
                                      <div className="flex items-center gap-2">
                                        {loadingTakeoffAI && (
                                          <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                            <span>AI analyzing...</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => generateTakeoffAIComparison()}
                                            disabled={loadingTakeoffAI || !selectedBidId || filteredTakeoffItems.length === 0 || bidLineItems.length === 0 || selectedTakeoffItemIds.size === 0}
                                            className="flex items-center gap-2"
                                          >
                                            {loadingTakeoffAI ? (
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                            ) : (
                                              <GitCompare className="h-4 w-4" />
                                            )}
                                            {loadingTakeoffAI ? 'Analyzing...' : 'Run AI Analysis'}
                                          </Button>
                                          {isTakeoffCached && (
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                              Cached
                                            </Badge>
                                          )}
                                          {takeoffAIAnalysis && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setShowAISidebar(!showAISidebar)}
                                              className="flex items-center gap-2"
                                            >
                                              {showAISidebar ? 'Hide' : 'Show'} AI Analysis
                                            </Button>
                                          )}
                                          {isTakeoffCached && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => generateTakeoffAIComparison(true)}
                                              className="text-xs"
                                              title="Refresh analysis"
                                            >
                                              <RefreshCw className="h-3 w-3" />
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
                                        <div className="overflow-y-auto">
                                          {(() => {
                                            const selectedTakeoffItems = filteredTakeoffItems.filter(item => selectedTakeoffItemIds.has(item.id))
                                            
                                            // Group items by category
                                            const takeoffByCategory = selectedTakeoffItems.reduce((acc, item) => {
                                              const cat = item.category || 'Uncategorized'
                                              if (!acc[cat]) acc[cat] = []
                                              acc[cat].push(item)
                                              return acc
                                            }, {} as Record<string, typeof selectedTakeoffItems>)
                                            
                                            const bidByCategory = bidLineItems.reduce((acc, item) => {
                                              const cat = item.category || 'Uncategorized'
                                              if (!acc[cat]) acc[cat] = []
                                              acc[cat].push(item)
                                              return acc
                                            }, {} as Record<string, typeof bidLineItems>)
                                            
                                            // Get all unique categories
                                            const allCategories = Array.from(new Set([
                                              ...Object.keys(takeoffByCategory),
                                              ...Object.keys(bidByCategory)
                                            ])).sort()
                                            
                                            if (allCategories.length === 0) {
                                              return (
                                                <div className="p-12 text-center text-gray-500">
                                                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                                  <p className="font-medium">No items selected for comparison</p>
                                                  <p className="text-sm mt-2">Select items from the left panel to compare</p>
                                                </div>
                                              )
                                            }
                                            
                                            return (
                                              <div className="space-y-6 p-4">
                                                {allCategories.map(category => {
                                                  const takeoffItemsInCat = takeoffByCategory[category] || []
                                                  const bidItemsInCat = bidByCategory[category] || []
                                                  
                                                  // Calculate category totals
                                                  const takeoffTotal = takeoffItemsInCat.reduce((sum, item) => 
                                                    sum + (item.quantity * (item.unit_cost || 0)), 0
                                                  )
                                                  const bidTotal = bidItemsInCat.reduce((sum, item) => sum + item.amount, 0)
                                                  
                                                  // Build AI match map for this category
                                                  const aiMatchMap = new Map<string, any>()
                                                  if (takeoffAIMatches && takeoffAIMatches.length > 0) {
                                                    takeoffItemsInCat.forEach(takeoffItem => {
                                                      const match = takeoffAIMatches.find((m: any) => m.takeoffItem.id === takeoffItem.id)
                                                      if (match) {
                                                        aiMatchMap.set(takeoffItem.id, match)
                                                      }
                                                    })
                                                  }
                                                  
                                                  return (
                                                    <div key={category} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                      {/* Category Header */}
                                                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 border-b border-gray-200">
                                                        <div className="flex items-center justify-between">
                                                          <h3 className="font-semibold text-gray-900">{category}</h3>
                                                          <div className="flex items-center gap-4 text-sm">
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-gray-600">Takeoff:</span>
                                                              <span className="font-bold text-blue-700">${takeoffTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                              <span className="text-gray-600">Bid:</span>
                                                              <span className="font-bold text-green-700">${bidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                            {takeoffTotal > 0 && bidTotal > 0 && (
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-gray-600">Diff:</span>
                                                                <span className={`font-bold ${bidTotal > takeoffTotal ? 'text-red-600' : 'text-green-600'}`}>
                                                                  {bidTotal > takeoffTotal ? '+' : ''}${(bidTotal - takeoffTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </div>
                                                      
                                                      {/* Items Grid */}
                                                      <div className="grid grid-cols-2 gap-0">
                                                        {/* Takeoff Items Column */}
                                                        <div className="border-r border-gray-200 bg-blue-50/20">
                                                          <div className="px-4 py-2 bg-blue-100/50 border-b border-gray-200">
                                                            <h4 className="text-sm font-semibold text-blue-900">Takeoff Items ({takeoffItemsInCat.length})</h4>
                                                          </div>
                                                          <div className="divide-y divide-gray-200">
                                                            {takeoffItemsInCat.length > 0 ? (
                                                              takeoffItemsInCat.map(takeoffItem => {
                                                                const aiMatch = aiMatchMap.get(takeoffItem.id)
                                                                const hasVariance = aiMatch && (aiMatch.quantityVariance || aiMatch.priceVariance)
                                                                
                                                                return (
                                                                  <div 
                                                                    key={takeoffItem.id} 
                                                                    className={`p-4 hover:bg-blue-50/50 transition-colors ${hasVariance ? 'bg-orange-50/40 border-l-4 border-orange-400' : ''}`}
                                                                  >
                                                                    <div className="space-y-2">
                                                                      <div className="flex items-start justify-between gap-2">
                                                                        <div className="font-semibold text-sm text-gray-900 flex-1">{takeoffItem.description}</div>
                                                                        {aiMatch && aiMatch.confidence > 0 && (
                                                                          <Badge 
                                                                            variant="outline" 
                                                                            className={`text-xs flex-shrink-0 ${
                                                                              aiMatch.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                              aiMatch.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                              'bg-orange-50 text-orange-700 border-orange-200'
                                                                            }`}
                                                                            title={aiMatch.notes || `${aiMatch.matchType} match`}
                                                                          >
                                                                            {aiMatch.confidence}%
                                                                          </Badge>
                                                                        )}
                                                                      </div>
                                                                      <div className="text-xs text-gray-600">
                                                                        {takeoffItem.quantity} {takeoffItem.unit}
                                                                        {takeoffItem.unit_cost && ` @ $${takeoffItem.unit_cost.toLocaleString()}/${takeoffItem.unit}`}
                                                                      </div>
                                                                      {takeoffItem.unit_cost && (
                                                                        <div className="font-bold text-blue-700 text-base">
                                                                          ${(takeoffItem.quantity * takeoffItem.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                        </div>
                                                                      )}
                                                                      {aiMatch && (aiMatch.quantityVariance || aiMatch.priceVariance) && (
                                                                        <div className="mt-2 space-y-1">
                                                                          {aiMatch.quantityVariance && aiMatch.quantityVariance > 20 && (
                                                                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                              Qty: {aiMatch.quantityVariance.toFixed(0)}%
                                                                            </Badge>
                                                                          )}
                                                                          {aiMatch.priceVariance && aiMatch.priceVariance > 15 && (
                                                                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                              Price: {aiMatch.priceVariance.toFixed(0)}%
                                                                            </Badge>
                                                                          )}
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  </div>
                                                                )
                                                              })
                                                            ) : (
                                                              <div className="p-8 text-center text-gray-400 text-sm">
                                                                No takeoff items
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                        
                                                        {/* Bid Items Column */}
                                                        <div className="bg-green-50/20">
                                                          <div className="px-4 py-2 bg-green-100/50 border-b border-gray-200">
                                                            <h4 className="text-sm font-semibold text-green-900">Bid Items ({bidItemsInCat.length})</h4>
                                                          </div>
                                                          <div className="divide-y divide-gray-200">
                                                            {bidItemsInCat.length > 0 ? (
                                                              bidItemsInCat.map(bidItem => {
                                                                // Find if this bid item is matched to any takeoff item
                                                                const matchedTakeoff = takeoffAIMatches?.find((m: any) => m.bidItem?.id === bidItem.id)
                                                                const hasVariance = matchedTakeoff && (matchedTakeoff.quantityVariance || matchedTakeoff.priceVariance)
                                                                
                                                                return (
                                                                  <div 
                                                                    key={bidItem.id} 
                                                                    className={`p-4 hover:bg-green-50/50 transition-colors ${hasVariance ? 'bg-orange-50/40 border-l-4 border-orange-400' : ''}`}
                                                                  >
                                                                    <div className="space-y-2">
                                                                      <div className="flex items-start justify-between gap-2">
                                                                        <div className="font-semibold text-sm text-gray-900 flex-1">{bidItem.description}</div>
                                                                        {matchedTakeoff && matchedTakeoff.confidence > 0 && (
                                                                          <Badge 
                                                                            variant="outline" 
                                                                            className={`text-xs flex-shrink-0 ${
                                                                              matchedTakeoff.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                              matchedTakeoff.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                              'bg-orange-50 text-orange-700 border-orange-200'
                                                                            }`}
                                                                            title={matchedTakeoff.notes || `${matchedTakeoff.matchType} match`}
                                                                          >
                                                                            {matchedTakeoff.confidence}%
                                                                          </Badge>
                                                                        )}
                                                                      </div>
                                                                      {bidItem.notes && (
                                                                        <div className="text-xs text-gray-600 italic">{bidItem.notes}</div>
                                                                      )}
                                                                      <div className="text-xs text-gray-600">
                                                                        {bidItem.quantity} {bidItem.unit}
                                                                        {bidItem.unit_price && ` @ $${bidItem.unit_price.toLocaleString()}/${bidItem.unit || 'unit'}`}
                                                                      </div>
                                                                      <div className={`font-bold text-base ${hasVariance ? 'text-orange-600' : 'text-green-700'}`}>
                                                                        ${bidItem.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                      </div>
                                                                      {matchedTakeoff && (matchedTakeoff.quantityVariance || matchedTakeoff.priceVariance) && (
                                                                        <div className="mt-2 space-y-1">
                                                                          {matchedTakeoff.quantityVariance && matchedTakeoff.quantityVariance > 20 && (
                                                                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                              Qty: {matchedTakeoff.quantityVariance.toFixed(0)}%
                                                                            </Badge>
                                                                          )}
                                                                          {matchedTakeoff.priceVariance && matchedTakeoff.priceVariance > 15 && (
                                                                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                              Price: {matchedTakeoff.priceVariance.toFixed(0)}%
                                                                            </Badge>
                                                                          )}
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  </div>
                                                                )
                                                              })
                                                            ) : (
                                                              <div className="p-8 text-center text-gray-400 text-sm">
                                                                No bid items
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )
                                          })()}
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
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => generateAIComparison()}
                                              disabled={loadingAI || !selectedBidId || selectedComparisonBidIds.size === 0}
                                              className="flex items-center gap-2"
                                            >
                                              {loadingAI ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                                              ) : (
                                                <GitCompare className="h-4 w-4" />
                                              )}
                                              {loadingAI ? 'Analyzing...' : 'Run AI Analysis'}
                                            </Button>
                                            {isCached && (
                                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                Cached
                                              </Badge>
                                            )}
                                            {aiAnalysis && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowAISidebar(!showAISidebar)}
                                                className="flex items-center gap-2"
                                              >
                                                {showAISidebar ? 'Hide' : 'Show'} AI Analysis
                                              </Button>
                                            )}
                                            {isCached && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => generateAIComparison(true)}
                                                className="text-xs"
                                                title="Refresh analysis"
                                              >
                                                <RefreshCw className="h-3 w-3" />
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
                                          <div className="overflow-y-auto">
                                            {(() => {
                                              // Group all items by category
                                              const selectedBidByCategory = bidLineItems.reduce((acc, item) => {
                                                const cat = item.category || 'Uncategorized'
                                                if (!acc[cat]) acc[cat] = []
                                                acc[cat].push(item)
                                                return acc
                                              }, {} as Record<string, typeof bidLineItems>)
                                              
                                              const comparisonBidsByCategory: Record<string, Record<string, BidLineItem[]>> = {}
                                              Array.from(selectedComparisonBidIds).forEach(bidId => {
                                                const compItems = comparisonBidLineItems[bidId] || []
                                                compItems.forEach(item => {
                                                  const cat = item.category || 'Uncategorized'
                                                  if (!comparisonBidsByCategory[cat]) comparisonBidsByCategory[cat] = {}
                                                  if (!comparisonBidsByCategory[cat][bidId]) comparisonBidsByCategory[cat][bidId] = []
                                                  comparisonBidsByCategory[cat][bidId].push(item)
                                                })
                                              })
                                              
                                              // Get all unique categories
                                              const allCategories = Array.from(new Set([
                                                ...Object.keys(selectedBidByCategory),
                                                ...Object.keys(comparisonBidsByCategory)
                                              ])).sort()
                                              
                                              if (allCategories.length === 0) {
                                                return (
                                                  <div className="p-12 text-center text-gray-500">
                                                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                                    <p className="font-medium">No line items found in the selected bid</p>
                                                  </div>
                                                )
                                              }
                                              
                                              // Build AI match maps for each comparison bid
                                              const aiMatchMaps: Record<string, Map<string, any>> = {}
                                              if (aiMatches && aiMatches.length > 0) {
                                                Array.from(selectedComparisonBidIds).forEach(bidId => {
                                                  const map = new Map<string, any>()
                                                  bidLineItems.forEach(selectedItem => {
                                                    const aiMatch = aiMatches.find((m: any) => m.selectedBidItem.id === selectedItem.id)
                                                    if (aiMatch) {
                                                      const match = aiMatch.comparisonItems.find((ci: any) => ci.bidId === bidId)
                                                      if (match) {
                                                        map.set(selectedItem.id, match)
                                                      }
                                                    }
                                                  })
                                                  aiMatchMaps[bidId] = map
                                                })
                                              }
                                              
                                              return (
                                                <div className="space-y-6 p-4">
                                                  {allCategories.map(category => {
                                                    const selectedItemsInCat = selectedBidByCategory[category] || []
                                                    const selectedTotal = selectedItemsInCat.reduce((sum, item) => sum + item.amount, 0)
                                                    
                                                    return (
                                                      <div key={category} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                                                        {/* Category Header */}
                                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-3 border-b border-gray-200">
                                                          <div className="flex items-center justify-between">
                                                            <h3 className="font-semibold text-gray-900">{category}</h3>
                                                            <div className="flex items-center gap-4 text-sm">
                                                              <div className="flex items-center gap-2">
                                                                <span className="text-gray-600">Selected:</span>
                                                                <span className="font-bold text-blue-700">${selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                              </div>
                                                              {Array.from(selectedComparisonBidIds).map(bidId => {
                                                                const compItems = comparisonBidsByCategory[category]?.[bidId] || []
                                                                const compTotal = compItems.reduce((sum, item) => sum + item.amount, 0)
                                                                const bid = bids.find(b => b.id === bidId)
                                                                return (
                                                                  <div key={bidId} className="flex items-center gap-2">
                                                                    <span className="text-gray-600 text-xs">{bid?.subcontractors?.name || bid?.gc_contacts?.name || 'Bid'}:</span>
                                                                    <span className={`font-bold text-sm ${compTotal > selectedTotal ? 'text-red-600' : compTotal < selectedTotal ? 'text-green-600' : 'text-gray-900'}`}>
                                                                      ${compTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                  </div>
                                                                )
                                                              })}
                                                            </div>
                                                          </div>
                                                        </div>
                                                        
                                                        {/* Items Grid - Horizontal Scroll */}
                                                        <div className="overflow-x-auto">
                                                          <div className="flex gap-0 min-w-max">
                                                            {/* Selected Bid Column */}
                                                            <div className="flex-shrink-0 w-80 border-r-2 border-gray-300 bg-blue-50/20">
                                                              <div className="px-4 py-2 bg-blue-100/50 border-b border-gray-200 sticky left-0 z-10">
                                                                <h4 className="text-sm font-semibold text-blue-900">
                                                                  {selectedBid?.subcontractors?.name || selectedBid?.gc_contacts?.name || 'Selected Bid'} ({selectedItemsInCat.length})
                                                                </h4>
                                                              </div>
                                                              <div className="divide-y divide-gray-200">
                                                                {selectedItemsInCat.length > 0 ? (
                                                                  selectedItemsInCat.map(item => (
                                                                    <div key={item.id} className="p-4 hover:bg-blue-50/50 transition-colors">
                                                                      <div className="space-y-2">
                                                                        <div className="font-semibold text-sm text-gray-900">{item.description}</div>
                                                                        {item.notes && (
                                                                          <div className="text-xs text-gray-600 italic">{item.notes}</div>
                                                                        )}
                                                                        <div className="text-xs text-gray-600">
                                                                          {item.quantity} {item.unit}
                                                                          {item.unit_price && ` @ $${item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}/${item.unit || 'unit'}`}
                                                                        </div>
                                                                        <div className="font-bold text-blue-700 text-base">
                                                                          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                        </div>
                                                                      </div>
                                                                    </div>
                                                                  ))
                                                                ) : (
                                                                  <div className="p-8 text-center text-gray-400 text-sm">No items</div>
                                                                )}
                                                              </div>
                                                            </div>
                                                            
                                                            {/* Comparison Bid Columns */}
                                                            {Array.from(selectedComparisonBidIds).map(bidId => {
                                                              const bid = bids.find(b => b.id === bidId)
                                                              const compItems = comparisonBidsByCategory[category]?.[bidId] || []
                                                              const aiMatchMap = aiMatchMaps[bidId] || new Map()
                                                              
                                                              return (
                                                                <div key={bidId} className="flex-shrink-0 w-80 border-r-2 border-gray-300 bg-white last:border-r-0">
                                                                  <div className="px-4 py-2 bg-gray-100/50 border-b border-gray-200 sticky left-0 z-10">
                                                                    <h4 className="text-sm font-semibold text-gray-900">
                                                                      {bid?.subcontractors?.name || bid?.gc_contacts?.name || 'Unknown'} ({compItems.length})
                                                                    </h4>
                                                                  </div>
                                                                  <div className="divide-y divide-gray-200">
                                                                    {compItems.length > 0 ? (
                                                                      compItems.map(compItem => {
                                                                        // Check if this item matches any selected item via AI
                                                                        let match: any = null
                                                                        for (const [selectedItemId, matchData] of aiMatchMap.entries()) {
                                                                          if (matchData.item?.id === compItem.id) {
                                                                            match = matchData
                                                                            break
                                                                          }
                                                                        }
                                                                        
                                                                        // Find corresponding selected item for comparison
                                                                        const correspondingSelected = selectedItemsInCat.find(si => {
                                                                          const m = aiMatchMap.get(si.id)
                                                                          return m?.item?.id === compItem.id
                                                                        })
                                                                        
                                                                        const isLower = correspondingSelected && compItem.amount < correspondingSelected.amount
                                                                        const isHigher = correspondingSelected && compItem.amount > correspondingSelected.amount
                                                                        const hasVariance = correspondingSelected && 
                                                                          Math.abs(compItem.amount - correspondingSelected.amount) > correspondingSelected.amount * 0.1
                                                                        
                                                                        return (
                                                                          <div 
                                                                            key={compItem.id} 
                                                                            className={`p-4 hover:bg-gray-50/50 transition-colors ${hasVariance ? 'bg-orange-50/40 border-l-4 border-orange-400' : ''}`}
                                                                          >
                                                                            <div className="space-y-2">
                                                                              <div className="flex items-start justify-between gap-2">
                                                                                <div className="font-semibold text-sm text-gray-900 flex-1">{compItem.description}</div>
                                                                                {match?.confidence && (
                                                                                  <Badge 
                                                                                    variant="outline" 
                                                                                    className={`text-xs flex-shrink-0 ${
                                                                                      match.confidence >= 85 ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                      match.confidence >= 70 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                                      'bg-orange-50 text-orange-700 border-orange-200'
                                                                                    }`}
                                                                                    title={match.notes || `${match.matchType} match`}
                                                                                  >
                                                                                    {match.confidence}%
                                                                                  </Badge>
                                                                                )}
                                                                              </div>
                                                                              {compItem.notes && (
                                                                                <div className="text-xs text-gray-600 italic">{compItem.notes}</div>
                                                                              )}
                                                                              <div className="text-xs text-gray-600">
                                                                                {compItem.quantity} {compItem.unit}
                                                                                {compItem.unit_price && ` @ $${compItem.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}/${compItem.unit || 'unit'}`}
                                                                              </div>
                                                                              <div className={`font-bold text-base ${isLower ? 'text-green-700' : isHigher ? 'text-red-600' : 'text-gray-900'}`}>
                                                                                ${compItem.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                              </div>
                                                                              {hasVariance && !match?.confidence && correspondingSelected && (
                                                                                <Badge variant="outline" className="mt-1 text-xs border-orange-200 text-orange-700 bg-orange-50">
                                                                                  {((compItem.amount - correspondingSelected.amount) / correspondingSelected.amount * 100).toFixed(0)}% {isLower ? 'lower' : 'higher'}
                                                                                </Badge>
                                                                              )}
                                                                            </div>
                                                                          </div>
                                                                        )
                                                                      })
                                                                    ) : (
                                                                      <div className="p-8 text-center text-gray-400 text-sm">No items</div>
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              )
                                                            })}
                                                          </div>
                                                        </div>
                                                      </div>
                                                    )
                                                  })}
                                                </div>
                                              )
                                            })()}
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

                        {/* Email Conversation Tab */}
                        {bidRecipient && (
                          <TabsContent value="conversation" className="mt-0">
                            <div className="flex flex-col h-full bg-white">
                              {/* Chat Messages Container */}
                              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 bg-gray-50 min-h-[400px]">
                                {(() => {
                                  // Get thread for this recipient
                                  const threadId = bidRecipient.thread_id || 
                                    `thread-${bidRecipient.bid_package_id || bidRecipient.bid_packages?.id}-${bidRecipient.subcontractor_email}`
                                  const thread = emailThreads[threadId]
                                  const threadMessages = thread?.messages || [bidRecipient]
                                  
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
                                    const isFromGC = message.isFromGC ?? false
                                    const messageContent = fetchedEmailContent[message.id] || message.response_text || message.notes || ''
                                    const messageTime = message.responded_at || message.sent_at || message.created_at
                                    
                                    // Fetch email content if missing
                                    if (!messageContent && message.resend_email_id && !fetchingEmailContent.has(message.id) && !fetchedEmailContent[message.id]) {
                                      setFetchingEmailContent(prev => new Set(prev).add(message.id))
                                      fetch(`/api/emails/${message.resend_email_id}/content`)
                                        .then(res => res.json())
                                        .then(data => {
                                          if (data.content) {
                                            setFetchedEmailContent(prev => ({
                                              ...prev,
                                              [message.id]: data.content
                                            }))
                                          }
                                        })
                                        .catch(err => console.error('Failed to fetch email content:', err))
                                        .finally(() => {
                                          setFetchingEmailContent(prev => {
                                            const next = new Set(prev)
                                            next.delete(message.id)
                                            return next
                                          })
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
                                        {showAvatar ? (
                                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm ${
                                            isFromGC ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                                          }`}>
                                            {isFromGC ? 'Y' : getInitials(senderName)}
                                          </div>
                                        ) : (
                                          <div className="w-8" />
                                        )}
                                        
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
                                            ) : messageContent && containsHTML(messageContent) ? (
                                              <div 
                                                className="text-sm leading-relaxed max-w-none email-content"
                                                dangerouslySetInnerHTML={{ __html: sanitizeHTML(messageContent) }}
                                                style={{
                                                  color: isFromGC ? 'white' : 'inherit',
                                                  '--tw-prose-links': isFromGC ? 'white' : 'rgb(59 130 246)',
                                                } as React.CSSProperties}
                                              />
                                            ) : (
                                              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                                {messageContent || (isFromGC ? 'Email sent' : 'No message content available')}
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

                              {/* Reply Input */}
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
                                            // Use bidRecipient for sending
                                            const sendMessage = async () => {
                                              if (!responseText.trim() || !bidRecipient?.id || sendingResponse) return
                                              const bidPackageId = bidRecipient.bid_package_id || bidRecipient.bid_packages?.id
                                              if (!bidPackageId) return

                                              setSendingResponse(true)
                                              setError('')
                                              try {
                                                const res = await fetch(`/api/bid-packages/${bidPackageId}/respond`, {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    recipientId: bidRecipient.id,
                                                    responseText: responseText.trim()
                                                  })
                                                })
                                                if (res.ok) {
                                                  await loadData()
                                                  setResponseText('')
                                                  // Reload email statuses
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
                                            sendMessage()
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
                                      onClick={async () => {
                                        if (!responseText.trim() || !bidRecipient?.id || sendingResponse) return
                                        const bidPackageId = bidRecipient.bid_package_id || bidRecipient.bid_packages?.id
                                        if (!bidPackageId) return

                                        setSendingResponse(true)
                                        setError('')
                                        try {
                                          const res = await fetch(`/api/bid-packages/${bidPackageId}/respond`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              recipientId: bidRecipient.id,
                                              responseText: responseText.trim()
                                            })
                                          })
                                          if (res.ok) {
                                            await loadData()
                                            setResponseText('')
                                            // Reload email statuses
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
                                      }}
                                      className="h-[44px] w-[44px] rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                      {sendingResponse ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                      ) : (
                                        <Mail className="h-4 w-4 text-white" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                {error && <p className="text-sm text-red-600 mt-2 px-1">{error}</p>}
                              </div>
                            </div>
                          </TabsContent>
                        )}
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
