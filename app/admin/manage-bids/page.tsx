'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Building2, 
  ArrowLeft, 
  Search,
  Plus, 
  Edit, 
  Trash2,
  DollarSign,
  FileText,
  X,
  Save,
  CheckCircle,
  AlertCircle,
  Contact,
  ChevronsUpDown,
  Check,
  Upload,
  Loader2,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import UserMasqueradeSelector from '@/components/admin/user-masquerade-selector'
import { cn } from '@/lib/utils'

interface Bid {
  id: string
  job_id: string | null
  bid_package_id: string | null
  subcontractor_id: string | null
  contact_id: string | null
  bid_amount: number | null
  timeline: string | null
  notes: string | null
  raw_email: string
  status: string
  created_at: string
  subcontractors: {
    id: string
    name: string
    email: string
  } | null
  gc_contacts?: {
    id: string
    name: string
    email: string
    trade_category: string
    location: string
  } | null
  jobs: {
    id: string
    name: string
    sub_title?: string
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
  category: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

interface Job {
  id: string
  name: string
  status: string
  user_id: string
}

interface Subcontractor {
  id: string
  name: string
  email: string
}

interface Contact {
  id: string
  name: string
  email: string
  trade_category: string
  location: string
  company?: string | null
  phone?: string | null
}

interface ParsedLineItem {
  description: string
  category: 'labor' | 'materials' | 'equipment' | 'permits' | 'other' | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  amount: number
  notes: string | null
}

interface ParsedInvoiceData {
  company: {
    name: string | null
    email: string | null
    phone: string | null
    address: string | null
  }
  jobReference: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  lineItems: ParsedLineItem[]
  subtotal: number | null
  tax: number | null
  total: number
  timeline: string | null
  notes: string | null
  paymentTerms: string | null
}

type InvoiceParseState = 'idle' | 'uploading' | 'parsing' | 'success' | 'error'

const CATEGORIES = [
  'Concrete',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Roofing',
  'Flooring',
  'Painting',
  'Drywall',
  'Carpentry',
  'Landscaping',
  'Excavation',
  'Insulation',
  'Windows & Doors',
  'Siding',
  'General Construction',
  'Other'
]

const UNITS = [
  'EA',
  'SF',
  'SY',
  'LF',
  'CY',
  'TON',
  'LB',
  'HR',
  'DAY',
  'UNIT',
  'LS'
]

export default function ManageBidsPage() {
  const [bids, setBids] = useState<Bid[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [bidLineItems, setBidLineItems] = useState<BidLineItem[]>([])
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  
  // Bid Form State
  const [showBidForm, setShowBidForm] = useState(false)
  const [isEditingBid, setIsEditingBid] = useState(false)
  const [currentBidId, setCurrentBidId] = useState<string | null>(null)
  const [bidFormData, setBidFormData] = useState({
    job_id: '',
    subcontractor_id: '',
    contact_id: '',
    notes: '',
    status: 'pending'
  })
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isSubPopoverOpen, setIsSubPopoverOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    item_number: 1,
    description: '',
    category: '',
    quantity: '',
    unit: '',
    unit_price: '',
    amount: '',
    notes: ''
  })

  // Invoice Upload Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceParseState, setInvoiceParseState] = useState<InvoiceParseState>('idle')
  const [invoiceError, setInvoiceError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [parsedInvoice, setParsedInvoice] = useState<ParsedInvoiceData | null>(null)
  const [invoiceLineItems, setInvoiceLineItems] = useState<ParsedLineItem[]>([])
  const [invoiceJobId, setInvoiceJobId] = useState('')
  const [invoiceSubId, setInvoiceSubId] = useState('')
  const [invoiceContactId, setInvoiceContactId] = useState('')
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [invoiceTimeline, setInvoiceTimeline] = useState('')
  const [createNewSubFromInvoice, setCreateNewSubFromInvoice] = useState(false)
  const [newSubNameFromInvoice, setNewSubNameFromInvoice] = useState('')
  const [newSubEmailFromInvoice, setNewSubEmailFromInvoice] = useState('')
  const [newSubTradeFromInvoice, setNewSubTradeFromInvoice] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    checkAdminStatus()
    fetchBids()
    fetchJobs()
    fetchSubcontractors()
    // Only fetch admin's contacts on initial load if user exists
    if (user) {
      fetchContactsForGc(user.id)
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (selectedBidId) {
      fetchBidLineItems(selectedBidId)
    } else {
      setBidLineItems([])
    }
  }, [selectedBidId])

  const checkAdminStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking admin status:', error)
        return
      }

      if (!data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (err) {
      console.error('Error checking admin status:', err)
    }
  }

  const fetchBids = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          subcontractors (
            id,
            name,
            email
          ),
          gc_contacts (
            id,
            name,
            email,
            trade_category,
            location
          ),
          jobs (
            id,
            name
          ),
          bid_line_items (
            amount
          ),
          bid_attachments (
            id,
            file_name,
            file_path
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      
      // Calculate total amount from line items
      const bidsWithCalculatedAmount = (data || []).map((bid: any) => {
        const totalAmount = bid.bid_line_items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0
        return {
          ...bid,
          bid_amount: totalAmount
        }
      })
      
      setBids(bidsWithCalculatedAmount)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bids')
    } finally {
      setLoading(false)
    }
  }

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, name, status, user_id')
        .in('status', ['active', 'draft', 'needs_takeoff', 'needs_packages', 'waiting_for_bids']) // Show all active statuses
        .order('created_at', { ascending: false })

      if (error) throw error
      setJobs(data || [])
    } catch (err: any) {
      console.error('Error fetching jobs:', err)
    }
  }

  const fetchSubcontractors = async () => {
    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, name, email')
        .order('name', { ascending: true })

      if (error) throw error
      setSubcontractors(data || [])
    } catch (err: any) {
      console.error('Error fetching subcontractors:', err)
    }
  }

  const fetchContactsForGc = async (gcId: string) => {
    try {
      const { data, error } = await supabase
        .from('gc_contacts')
        .select('id, name, email, trade_category, location, company, phone, gc_id')
        .eq('gc_id', gcId)
        .order('name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (err: any) {
      console.error('Error fetching contacts:', err)
      setContacts([])
    }
  }

  const fetchContacts = async (jobId?: string) => {
    if (!jobId) {
      // If no job selected, fetch admin's contacts
      if (user) {
        fetchContactsForGc(user.id)
      }
      return
    }

    try {
      console.log('🔍 Fetching contacts for job:', jobId)
      
      // Get the job to find the owner (user_id)
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('user_id')
        .eq('id', jobId)
        .single()

      if (jobError) {
        console.error('❌ Error fetching job:', jobError)
        throw jobError
      }

      console.log('📋 Job data:', job)
      console.log('👤 Job owner (user_id):', job?.user_id)

      // Get all job members (GCs with access to this job)
      const { data: jobMembers, error: membersError } = await supabase
        .from('job_members')
        .select('user_id')
        .eq('job_id', jobId)

      if (membersError) {
        console.error('❌ Error fetching job members:', membersError)
        throw membersError
      }

      console.log('👥 Job members:', jobMembers)
      console.log('📊 Number of job members:', jobMembers?.length || 0)

      // Collect all GC IDs: job owner + all job members
      const gcIds = new Set<string>()
      
      // Add job owner
      if (job?.user_id) {
        gcIds.add(job.user_id)
        console.log('✅ Added job owner to GC IDs:', job.user_id)
      }
      
      // Add all job members
      if (jobMembers && jobMembers.length > 0) {
        jobMembers.forEach(member => {
          if (member.user_id) {
            gcIds.add(member.user_id)
            console.log('✅ Added job member to GC IDs:', member.user_id)
          }
        })
      }

      console.log('🆔 All GC IDs to fetch contacts from:', Array.from(gcIds))
      console.log('📈 Total unique GC IDs:', gcIds.size)

      if (gcIds.size === 0) {
        console.warn('⚠️ No GC IDs found, setting contacts to empty')
        setContacts([])
        return
      }

      // Fetch contacts from all GCs that have access to this job
      const { data, error } = await supabase
        .from('gc_contacts')
        .select('id, name, email, trade_category, location, company, phone, gc_id')
        .in('gc_id', Array.from(gcIds))
        .order('name', { ascending: true })

      if (error) {
        console.error('❌ Error fetching contacts:', error)
        throw error
      }

      console.log('📇 Contacts found:', data)
      console.log('📊 Number of contacts:', data?.length || 0)
      
      if (data && data.length > 0) {
        console.log('📋 Contact details:')
        data.forEach(contact => {
          console.log(`  - ${contact.name} (${contact.email}) - GC ID: ${contact.gc_id}`)
        })
      } else {
        console.warn('⚠️ No contacts found for these GC IDs')
      }

      setContacts(data || [])
    } catch (err: any) {
      console.error('❌ Error fetching contacts:', err)
      setContacts([])
    }
  }

  const fetchBidLineItems = async (bidId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('bid_line_items')
        .select('*')
        .eq('bid_id', bidId)
        .order('item_number', { ascending: true })

      if (error) throw error
      setBidLineItems(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bid line items')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => {
      const updated = { ...prev, [name]: value }
      
      // Auto-calculate amount if quantity and unit_price are both provided
      if (name === 'quantity' || name === 'unit_price') {
        const quantity = name === 'quantity' ? parseFloat(value) : parseFloat(prev.quantity)
        const unitPrice = name === 'unit_price' ? parseFloat(value) : parseFloat(prev.unit_price)
        
        if (quantity && unitPrice) {
          updated.amount = (quantity * unitPrice).toFixed(2)
        } else {
          updated.amount = ''
        }
      }
      
      return updated
    })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Bid Management Handlers
  const openCreateBid = () => {
    setBidFormData({
      job_id: '',
      subcontractor_id: '',
      contact_id: '',
      notes: '',
      status: 'pending'
    })
    setSelectedFiles([])
    setIsEditingBid(false)
    setCurrentBidId(null)
    setShowBidForm(true)
  }

  const openEditBid = (bid: Bid, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the bid row
    setBidFormData({
      job_id: bid.job_id || '',
      subcontractor_id: bid.subcontractor_id || '',
      contact_id: bid.contact_id || '',
      notes: bid.notes || '',
      status: bid.status || 'pending'
    })
    setSelectedFiles([])
    setIsEditingBid(true)
    setCurrentBidId(bid.id)
    setShowBidForm(true)
    // If editing a bid with a contact, fetch contacts for that job
    if (bid.job_id) {
      fetchContacts(bid.job_id)
    }
  }

  const handleBidFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError('')

      // Validate that at least one recipient is selected
      if (!bidFormData.contact_id && !bidFormData.subcontractor_id) {
        setError('Please select either a subcontractor or a contact')
        setLoading(false)
        return
      }

      let subcontractorId = bidFormData.subcontractor_id || null
      let contactId = bidFormData.contact_id || null
      let rawEmail = 'manual_entry@placeholder.com'

      // Handle contact selection - use contact_id directly
      if (bidFormData.contact_id) {
        const contact = contacts.find(c => c.id === bidFormData.contact_id)
        if (contact) {
          rawEmail = contact.email
          contactId = contact.id
          subcontractorId = null // Clear subcontractor_id when using contact
        }
      } else if (bidFormData.subcontractor_id) {
        const selectedSub = subcontractors.find(s => s.id === bidFormData.subcontractor_id)
        rawEmail = selectedSub?.email || 'manual_entry@placeholder.com'
        contactId = null // Clear contact_id when using subcontractor
      }
      
      const bidData = {
        job_id: bidFormData.job_id || null,
        subcontractor_id: subcontractorId,
        contact_id: contactId,
        raw_email: rawEmail,
        notes: bidFormData.notes || null,
        status: bidFormData.status
      }

      let targetBidId = currentBidId

      if (isEditingBid && currentBidId) {
        const { error } = await supabase
          .from('bids')
          .update(bidData)
          .eq('id', currentBidId)

        if (error) throw error
        setSuccess('Bid updated successfully')
      } else {
        const { data, error } = await supabase
          .from('bids')
          .insert([bidData])
          .select('id')
          .single()

        if (error) throw error
        targetBidId = data.id
        setSuccess('Bid created successfully')
      }

      // Handle File Uploads
      if (selectedFiles.length > 0 && targetBidId && user) {
         const uploadPromises = selectedFiles.map(async (file) => {
           const fileExt = file.name.split('.').pop()
           const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
           const filePath = `${user.id}/${fileName}` // Use simple user.id prefix as per policy

           const { error: uploadError } = await supabase.storage
             .from('bid-attachments')
             .upload(filePath, file)

           if (uploadError) throw new Error(`Upload failed for ${file.name}: ${uploadError.message}`)

           const { error: attachmentError } = await supabase
              .from('bid_attachments')
              .insert({
                 bid_id: targetBidId,
                 file_name: file.name,
                 file_path: filePath,
                 file_size: file.size,
                 file_type: file.type
              })
           
           if (attachmentError) throw new Error(`Attachment record failed for ${file.name}: ${attachmentError.message}`)
         })

         await Promise.all(uploadPromises)
      }

      setShowBidForm(false)
      fetchBids()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save bid')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = (closeForm: boolean = true) => {
    setFormData({
      item_number: bidLineItems.length > 0 ? Math.max(...bidLineItems.map(item => item.item_number)) + 1 : 1,
      description: '',
      category: '',
      quantity: '',
      unit: '',
      unit_price: '',
      amount: '',
      notes: ''
    })
    if (closeForm) {
      setShowAddForm(false)
    }
    setEditingItemId(null)
  }

  const handleEdit = (item: BidLineItem) => {
    setFormData({
      item_number: item.item_number,
      description: item.description,
      category: item.category || '',
      quantity: item.quantity?.toString() || '',
      unit: item.unit || '',
      unit_price: item.unit_price?.toString() || '',
      amount: item.amount.toString(),
      notes: item.notes || ''
    })
    setEditingItemId(item.id)
    setShowAddForm(true)
  }

  const handleDownloadAttachment = async (path: string, fileName: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const { data, error } = await supabase.storage
        .from('bid-attachments')
        .createSignedUrl(path, 60) // 60 seconds validity

      if (error) throw error
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    } catch (err: any) {
      console.error('Error downloading attachment:', err)
      setError('Failed to download attachment')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBidId) {
      setError('Please select a bid first')
      return
    }

    try {
      setError('')
      setSuccess('')

      const lineItemData = {
        bid_id: selectedBidId,
        item_number: parseInt(formData.item_number.toString()),
        description: formData.description,
        category: formData.category || null,
        quantity: formData.quantity ? parseFloat(formData.quantity) : null,
        unit: formData.unit || null,
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
        amount: parseFloat(formData.amount) || 0,
        notes: formData.notes || null
      }

      if (editingItemId) {
        // Update existing item
        const { error } = await supabase
          .from('bid_line_items')
          .update(lineItemData)
          .eq('id', editingItemId)

        if (error) throw error
        setSuccess('Line item updated successfully')
      } else {
        // Insert new item
        const { error } = await supabase
          .from('bid_line_items')
          .insert([lineItemData])

        if (error) throw error
        setSuccess('Line item added successfully')
      }

      // Refresh line items
      await fetchBidLineItems(selectedBidId)
      resetForm()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save line item')
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this line item?')) {
      return
    }

    try {
      setError('')
      const { error } = await supabase
        .from('bid_line_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
      setSuccess('Line item deleted successfully')
      
      // Refresh line items
      if (selectedBidId) {
        await fetchBidLineItems(selectedBidId)
      }
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete line item')
    }
  }

  // Invoice Upload Functions
  const handleInvoiceDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleInvoiceDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.type === 'application/pdf') {
        handleInvoiceFileSelect(file)
      } else {
        setInvoiceError('Please upload a PDF file')
        setInvoiceParseState('error')
      }
    }
  }

  const handleInvoiceFileSelect = async (file: File) => {
    setInvoiceFile(file)
    setInvoiceParseState('uploading')
    setInvoiceError('')
    setParsedInvoice(null)

    try {
      setInvoiceParseState('parsing')
      
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/parse-invoice', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse invoice')
      }

      setParsedInvoice(result.data)
      setInvoiceLineItems(result.data.lineItems || [])
      setInvoiceNotes(result.data.notes || '')
      setInvoiceTimeline(result.data.timeline || '')

      // Try to match subcontractor
      if (result.data.company?.name) {
        const matchedSub = subcontractors.find(sub => 
          sub.name.toLowerCase().includes(result.data.company.name.toLowerCase()) ||
          result.data.company.name.toLowerCase().includes(sub.name.toLowerCase())
        )
        if (matchedSub) {
          setInvoiceSubId(matchedSub.id)
        } else {
          const matchedContact = contacts.find(contact =>
            contact.name.toLowerCase().includes(result.data.company.name.toLowerCase()) ||
            result.data.company.name.toLowerCase().includes(contact.name.toLowerCase())
          )
          if (matchedContact) {
            setInvoiceContactId(matchedContact.id)
          } else {
            setCreateNewSubFromInvoice(true)
            setNewSubNameFromInvoice(result.data.company.name || '')
            setNewSubEmailFromInvoice(result.data.company.email || '')
          }
        }
      }

      // Try to match job
      if (result.data.jobReference) {
        const matchedJob = jobs.find(job =>
          job.name.toLowerCase().includes(result.data.jobReference.toLowerCase()) ||
          result.data.jobReference.toLowerCase().includes(job.name.toLowerCase())
        )
        if (matchedJob) {
          setInvoiceJobId(matchedJob.id)
        }
      }

      setInvoiceParseState('success')
    } catch (err: any) {
      console.error('Error parsing invoice:', err)
      setInvoiceError(err.message || 'Failed to parse invoice')
      setInvoiceParseState('error')
    }
  }

  const updateInvoiceLineItem = (index: number, field: keyof ParsedLineItem, value: any) => {
    setInvoiceLineItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeInvoiceLineItem = (index: number) => {
    setInvoiceLineItems(prev => prev.filter((_, i) => i !== index))
  }

  const addInvoiceLineItem = () => {
    setInvoiceLineItems(prev => [...prev, {
      description: '',
      category: null,
      quantity: null,
      unit: null,
      unitPrice: null,
      amount: 0,
      notes: null,
    }])
  }

  const invoiceTotal = invoiceLineItems.reduce((sum, item) => sum + (item.amount || 0), 0)

  const handleSaveInvoiceBid = async () => {
    if (!invoiceJobId) {
      setInvoiceError('Please select a job')
      return
    }

    if (!invoiceSubId && !invoiceContactId && !createNewSubFromInvoice) {
      setInvoiceError('Please select or create a subcontractor')
      return
    }

    if (invoiceLineItems.length === 0) {
      setInvoiceError('Please add at least one line item')
      return
    }

    setSavingInvoice(true)
    setInvoiceError('')

    try {
      let subcontractorId = invoiceSubId || null
      let contactId = invoiceContactId || null

      // Create new subcontractor if needed
      if (createNewSubFromInvoice && newSubNameFromInvoice) {
        const { data: newSub, error: subError } = await supabase
          .from('subcontractors')
          .insert({
            name: newSubNameFromInvoice,
            email: newSubEmailFromInvoice || null,
            trade_category: newSubTradeFromInvoice || 'General',
          })
          .select()
          .single()

        if (subError) throw subError
        subcontractorId = newSub.id
        // Refresh subcontractors list
        await fetchSubcontractors()
      }

      // Create the bid
      const { data: bidData, error: bidError } = await supabase
        .from('bids')
        .insert({
          job_id: invoiceJobId,
          subcontractor_id: subcontractorId,
          contact_id: contactId,
          bid_amount: null, // Will be calculated from line items by trigger
          timeline: invoiceTimeline || null,
          notes: invoiceNotes || null,
          status: 'pending',
          raw_email: `Parsed from invoice: ${invoiceFile?.name || 'Unknown'}`,
        })
        .select()
        .single()

      if (bidError) throw bidError

      // Create line items
      const lineItemsToInsert = invoiceLineItems
        .filter(item => item.description.trim() !== '')
        .map((item, index) => ({
          bid_id: bidData.id,
          item_number: index + 1,
          description: item.description,
          category: item.category || null,
          quantity: item.quantity || null,
          unit: item.unit || null,
          unit_price: item.unitPrice || null,
          amount: item.amount,
          notes: item.notes || null,
        }))

      if (lineItemsToInsert.length > 0) {
        const { error: lineItemsError } = await supabase
          .from('bid_line_items')
          .insert(lineItemsToInsert)

        if (lineItemsError) throw lineItemsError
      }

      // Success - close modal and refresh
      setSuccess('Bid created from invoice successfully!')
      resetInvoiceModal()
      await fetchBids()
      setSelectedBidId(bidData.id)
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      console.error('Error saving bid from invoice:', err)
      setInvoiceError(err.message || 'Failed to save bid')
    } finally {
      setSavingInvoice(false)
    }
  }

  const resetInvoiceModal = () => {
    setShowInvoiceModal(false)
    setInvoiceParseState('idle')
    setInvoiceFile(null)
    setParsedInvoice(null)
    setInvoiceLineItems([])
    setInvoiceJobId('')
    setInvoiceSubId('')
    setInvoiceContactId('')
    setInvoiceNotes('')
    setInvoiceTimeline('')
    setCreateNewSubFromInvoice(false)
    setNewSubNameFromInvoice('')
    setNewSubEmailFromInvoice('')
    setNewSubTradeFromInvoice('')
    setInvoiceError('')
  }

  const filteredBids = bids.filter(bid => {
    const searchLower = searchQuery.toLowerCase()
    const subcontractorName = bid.subcontractors?.name?.toLowerCase() || ''
    const subcontractorEmail = bid.subcontractors?.email?.toLowerCase() || ''
    const contactName = bid.gc_contacts?.name?.toLowerCase() || ''
    const contactEmail = bid.gc_contacts?.email?.toLowerCase() || ''
    const bidEmail = bid.raw_email?.toLowerCase() || ''
    const jobName = bid.jobs?.name?.toLowerCase() || ''
    const bidAmount = bid.bid_amount?.toString() || ''
    
    return (
      subcontractorName.includes(searchLower) ||
      subcontractorEmail.includes(searchLower) ||
      contactName.includes(searchLower) ||
      contactEmail.includes(searchLower) ||
      bidEmail.includes(searchLower) ||
      jobName.includes(searchLower) ||
      bidAmount.includes(searchLower)
    )
  })

  const selectedBid = bids.find(b => b.id === selectedBidId)

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FallingBlocksLoader />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Bid Line Items</h1>
                <p className="text-sm text-gray-600">Add and manage detailed line items for bids</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <UserMasqueradeSelector />
              <Link href="/admin/demo-settings">
                <Button variant="outline" className="hidden sm:flex">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
                <Button variant="outline" size="sm" className="sm:hidden">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <NotificationBell />
              <ProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Bids List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Bids</CardTitle>
                  <CardDescription>Select a bid to manage its line items</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowInvoiceModal(true)} size="sm" variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Invoice
                  </Button>
                  <Button onClick={openCreateBid} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Bid
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search bids..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Bids List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredBids.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No bids found</p>
                  </div>
                ) : (
                  filteredBids.map((bid) => (
                    <Card
                      key={bid.id}
                      className={`cursor-pointer transition-all ${
                        selectedBidId === bid.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedBidId(bid.id)
                        setShowAddForm(false)
                        setEditingItemId(null)
                        resetForm()
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {bid.subcontractors?.name || bid.gc_contacts?.name || bid.raw_email || 'Unknown'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {bid.subcontractors?.email || bid.gc_contacts?.email || bid.raw_email}
                            </p>
                            {bid.jobs?.name && (
                              <p className="text-xs text-gray-500 mt-1">Job: {bid.jobs.name}</p>
                            )}
                            {bid.bid_amount && (
                              <p className="text-lg font-bold text-green-600 mt-2">
                                ${bid.bid_amount.toLocaleString()}
                              </p>
                            )}
                            {bid.bid_attachments && bid.bid_attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs text-gray-500 font-medium">Attachments:</p>
                                {bid.bid_attachments.map(att => (
                                  <div key={att.id} className="flex items-center text-xs text-blue-600 hover:text-blue-800">
                                    <FileText className="h-3 w-3 mr-1" />
                                    <a 
                                      href="#" 
                                      onClick={(e) => handleDownloadAttachment(att.file_path, att.file_name, e)}
                                      className="underline truncate max-w-[200px]"
                                    >
                                      {att.file_name}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end space-y-2">
                            <Badge variant={bid.status === 'accepted' ? 'default' : 'outline'}>
                              {bid.status}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => openEditBid(bid, e)}
                            >
                              <Edit className="h-4 w-4 text-gray-500 hover:text-gray-900" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Line Items Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {selectedBid ? `Line Items for ${selectedBid.subcontractors?.name || selectedBid.raw_email || 'Bid'}` : 'Line Items'}
                  </CardTitle>
                  <CardDescription>
                    {selectedBid 
                      ? `Manage line items for this bid (${bidLineItems.length} items)`
                      : 'Select a bid to manage its line items'}
                  </CardDescription>
                </div>
                                 {selectedBid && (
                   <Button
                     onClick={() => {
                       setEditingItemId(null)
                       resetForm(false)
                       setShowAddForm(true)
                     }}
                     disabled={showAddForm}
                   >
                     <Plus className="h-4 w-4 mr-2" />
                     Add Item
                   </Button>
                 )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedBid ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p>Select a bid from the list to manage its line items</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Add/Edit Form */}
                  {showAddForm && (
                    <Card className="border-2 border-orange-200">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {editingItemId ? 'Edit Line Item' : 'Add New Line Item'}
                          </CardTitle>
                          <Button variant="ghost" size="sm" onClick={() => resetForm()}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="item_number">Item Number *</Label>
                              <Input
                                id="item_number"
                                name="item_number"
                                type="number"
                                required
                                value={formData.item_number}
                                onChange={handleInputChange}
                                min="1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="category">Category</Label>
                              <Select
                                value={formData.category}
                                onValueChange={(value) => handleSelectChange('category', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="description">Description *</Label>
                            <Textarea
                              id="description"
                              name="description"
                              required
                              value={formData.description}
                              onChange={handleInputChange}
                              placeholder="Enter item description..."
                              rows={2}
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="quantity">Quantity</Label>
                              <Input
                                id="quantity"
                                name="quantity"
                                type="number"
                                step="0.01"
                                value={formData.quantity}
                                onChange={handleInputChange}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <Label htmlFor="unit">Unit</Label>
                              <Select
                                value={formData.unit}
                                onValueChange={(value) => handleSelectChange('unit', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITS.map(unit => (
                                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="unit_price">Unit Price</Label>
                              <Input
                                id="unit_price"
                                name="unit_price"
                                type="number"
                                step="0.01"
                                value={formData.unit_price}
                                onChange={handleInputChange}
                                placeholder="0.00"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="amount">Amount *</Label>
                            <Input
                              id="amount"
                              name="amount"
                              type="number"
                              step="0.01"
                              required
                              value={formData.amount}
                              onChange={handleInputChange}
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                              id="notes"
                              name="notes"
                              value={formData.notes}
                              onChange={handleInputChange}
                              placeholder="Additional notes..."
                              rows={2}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => resetForm()}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              className="flex-1 bg-orange-600 hover:bg-orange-700"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              {editingItemId ? 'Update' : 'Add'} Item
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {/* Line Items List */}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {bidLineItems.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No line items yet. Click "Add Item" to create one.</p>
                      </div>
                    ) : (
                      bidLineItems.map((item) => (
                        <Card key={item.id} className="hover:bg-gray-50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="font-mono text-sm text-gray-500">#{item.item_number}</span>
                                  <h4 className="font-semibold">{item.description}</h4>
                                  {item.category && (
                                    <Badge variant="outline" className="text-xs">
                                      {item.category}
                                    </Badge>
                                  )}
                                </div>
                                {item.quantity && item.unit && item.unit_price && (
                                  <p className="text-sm text-gray-600 mb-1">
                                    {item.quantity} {item.unit} @ ${item.unit_price.toFixed(2)}/{item.unit}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="text-xs text-gray-500 italic">{item.notes}</p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="text-right mr-4">
                                  <p className="font-bold text-gray-900">
                                    ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                  disabled={showAddForm}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(item.id)}
                                  disabled={showAddForm}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  {/* Total */}
                  {bidLineItems.length > 0 && (
                    <Card className="bg-gray-50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">Total:</span>
                          <span className="font-bold text-xl text-green-600">
                            ${bidLineItems.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {selectedBid?.bid_amount && (
                          <div className="flex justify-between items-center mt-2 text-sm">
                            <span className="text-gray-600">Bid Amount:</span>
                            <span className="text-gray-900">
                              ${selectedBid.bid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bid Create/Edit Modal */}
        <Dialog open={showBidForm} onOpenChange={setShowBidForm}>
          <DialogContent className="sm:max-w-[600px] p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-semibold">{isEditingBid ? 'Edit Bid' : 'Create New Bid'}</DialogTitle>
              <DialogDescription className="text-gray-500 mt-1.5">
                {isEditingBid ? 'Update the bid details below.' : 'Fill in the details to create a new bid for a job and subcontractor.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleBidFormSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="job_id" className="text-sm font-medium">Job *</Label>
                  <Select
                    value={bidFormData.job_id}
                    onValueChange={(value) => {
                      console.log('🎯 Job selected:', value)
                      setBidFormData(prev => ({ ...prev, job_id: value, contact_id: '', subcontractor_id: '' }))
                      // Fetch contacts from all GCs that have access to this job
                      console.log('📞 Calling fetchContacts with jobId:', value)
                      fetchContacts(value)
                    }}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} <span className="text-gray-400 text-xs ml-2">({job.status})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subcontractor_id" className="text-sm font-medium">Subcontractor or Contact *</Label>
                  <Popover open={isSubPopoverOpen} onOpenChange={setIsSubPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between bg-white"
                        disabled={!bidFormData.job_id}
                      >
                        {!bidFormData.job_id
                          ? "Select a job first..."
                          : bidFormData.contact_id
                            ? contacts.find((c) => c.id === bidFormData.contact_id)?.name
                            : bidFormData.subcontractor_id
                              ? subcontractors.find((sub) => sub.id === bidFormData.subcontractor_id)?.name
                              : "Select subcontractor or contact..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0 z-[100001]" align="start">
                      <Command shouldFilter={true}>
                        <CommandInput placeholder="Search subcontractors or contacts..." />
                        <CommandList>
                          <CommandEmpty>No subcontractor or contact found.</CommandEmpty>
                          {contacts.length > 0 && (
                            <CommandGroup heading={bidFormData.job_id ? "Job GCs' Contacts" : "My Contacts"}>
                              {contacts.map((contact) => (
                                <CommandItem
                                  key={`contact-${contact.id}`}
                                  value={`${contact.name} ${contact.email} ${contact.trade_category || ''}`}
                                  onSelect={() => {
                                    setBidFormData(prev => ({ 
                                      ...prev, 
                                      contact_id: contact.id,
                                      subcontractor_id: ''
                                    }))
                                    setIsSubPopoverOpen(false)
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      bidFormData.contact_id === contact.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <Contact className="mr-2 h-4 w-4 text-blue-500" />
                                  <div className="flex flex-col">
                                    <span>{contact.name}</span>
                                    <span className="text-xs text-gray-500">{contact.trade_category} • {contact.email}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                          <CommandGroup heading="Bidi Network Subcontractors">
                            {subcontractors.map((sub) => (
                              <CommandItem
                                key={sub.id}
                                value={`${sub.name} ${sub.email}`}
                                onSelect={() => {
                                  setBidFormData(prev => ({ 
                                    ...prev, 
                                    subcontractor_id: sub.id,
                                    contact_id: ''
                                  }))
                                  setIsSubPopoverOpen(false)
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    bidFormData.subcontractor_id === sub.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{sub.name}</span>
                                  <span className="text-xs text-gray-500">{sub.email}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                    <Select
                      value={bidFormData.status}
                      onValueChange={(value) => setBidFormData(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                  <Textarea
                    id="notes"
                    value={bidFormData.notes}
                    onChange={(e) => setBidFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add internal notes..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file" className="text-sm font-medium">Attach Original Bid(s) (PDF)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setSelectedFiles(Array.from(e.target.files))
                      }
                    }}
                  />
                  {selectedFiles.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      <p className="font-medium mb-1">Selected files:</p>
                      <ul className="list-disc list-inside">
                        {selectedFiles.map((file, index) => (
                          <li key={index}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowBidForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white">
                  {isEditingBid ? 'Save Changes' : 'Create Bid'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Invoice Upload Modal */}
        <Dialog open={showInvoiceModal} onOpenChange={(open) => !open && resetInvoiceModal()}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                Upload Invoice / Bid PDF
              </DialogTitle>
              <DialogDescription>
                Upload a PDF invoice or bid. AI will extract line items automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 pt-4">
            {/* Upload Zone - Show when idle or error */}
            {(invoiceParseState === 'idle' || invoiceParseState === 'error') && (
              <div className="space-y-4">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                    dragActive 
                      ? "border-orange-500 bg-orange-50" 
                      : "border-gray-300 hover:border-orange-400 hover:bg-gray-50"
                  )}
                  onDragEnter={handleInvoiceDrag}
                  onDragLeave={handleInvoiceDrag}
                  onDragOver={handleInvoiceDrag}
                  onDrop={handleInvoiceDrop}
                  onClick={() => document.getElementById('invoice-file-input')?.click()}
                >
                  <input
                    id="invoice-file-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleInvoiceFileSelect(e.target.files[0])
                      }
                    }}
                  />
                  <Upload className={cn(
                    "h-12 w-12 mx-auto mb-3",
                    dragActive ? "text-orange-500" : "text-gray-400"
                  )} />
                  <p className="font-medium text-gray-700 mb-1">
                    {dragActive ? 'Drop your PDF here' : 'Drop PDF here or click to upload'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports invoice and bid PDFs from subcontractors
                  </p>
                </div>

                {invoiceParseState === 'error' && invoiceError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Error parsing invoice</p>
                      <p className="text-sm text-red-600 mt-1">{invoiceError}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Parsing Progress */}
            {(invoiceParseState === 'uploading' || invoiceParseState === 'parsing') && (
              <div className="py-12 text-center">
                <Loader2 className="h-12 w-12 text-orange-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {invoiceParseState === 'uploading' ? 'Uploading...' : 'Parsing Invoice...'}
                </h3>
                <p className="text-gray-600">
                  {invoiceParseState === 'uploading' 
                    ? 'Uploading your PDF file' 
                    : 'AI is extracting line items from your invoice'}
                </p>
                {invoiceFile && (
                  <p className="text-sm text-gray-500 mt-4">
                    File: {invoiceFile.name}
                  </p>
                )}
              </div>
            )}

            {/* Parsed Data Preview & Edit */}
            {invoiceParseState === 'success' && parsedInvoice && (
              <div className="space-y-4">
                {/* Success Banner */}
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Invoice parsed successfully</p>
                      <p className="text-sm text-green-600">{invoiceLineItems.length} line items extracted</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setInvoiceParseState('idle')
                    setInvoiceFile(null)
                    setParsedInvoice(null)
                  }}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Upload Different
                  </Button>
                </div>

                {/* Error message */}
                {invoiceError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800">{invoiceError}</p>
                  </div>
                )}

                {/* Job Selection */}
                <div className="space-y-2">
                  <Label>Job *</Label>
                  {parsedInvoice.jobReference && (
                    <p className="text-xs text-gray-500">
                      Extracted reference: "{parsedInvoice.jobReference}"
                    </p>
                  )}
                  <Select value={invoiceJobId} onValueChange={setInvoiceJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.name} <span className="text-gray-400 text-xs ml-2">({job.status})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subcontractor Selection */}
                <div className="space-y-2">
                  <Label>Subcontractor *</Label>
                  {parsedInvoice.company?.name && (
                    <p className="text-xs text-gray-500">
                      Extracted: "{parsedInvoice.company.name}" {parsedInvoice.company.email && `• ${parsedInvoice.company.email}`}
                    </p>
                  )}
                  {!createNewSubFromInvoice ? (
                    <div className="space-y-2">
                      <Select 
                        value={invoiceSubId || invoiceContactId} 
                        onValueChange={(value) => {
                          // Check if it's a subcontractor or contact
                          const isSub = subcontractors.some(s => s.id === value)
                          if (isSub) {
                            setInvoiceSubId(value)
                            setInvoiceContactId('')
                          } else {
                            setInvoiceContactId(value)
                            setInvoiceSubId('')
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subcontractor..." />
                        </SelectTrigger>
                        <SelectContent>
                          {subcontractors.length > 0 && (
                            <>
                              <SelectItem value="__header_subs" disabled className="font-semibold text-gray-500">
                                Subcontractors
                              </SelectItem>
                              {subcontractors.map(sub => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  {sub.name} <span className="text-gray-400 text-xs">({sub.email})</span>
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {contacts.length > 0 && (
                            <>
                              <SelectItem value="__header_contacts" disabled className="font-semibold text-gray-500 mt-2">
                                Your Contacts
                              </SelectItem>
                              {contacts.map(contact => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.name} <span className="text-gray-400 text-xs">({contact.email})</span>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCreateNewSubFromInvoice(true)
                          setInvoiceSubId('')
                          setInvoiceContactId('')
                          setNewSubNameFromInvoice(parsedInvoice.company?.name || '')
                          setNewSubEmailFromInvoice(parsedInvoice.company?.email || '')
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create New Subcontractor
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">New Subcontractor</span>
                        <Button variant="ghost" size="sm" onClick={() => setCreateNewSubFromInvoice(false)}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Company Name *</Label>
                          <Input
                            value={newSubNameFromInvoice}
                            onChange={e => setNewSubNameFromInvoice(e.target.value)}
                            placeholder="Company name"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input
                            type="email"
                            value={newSubEmailFromInvoice}
                            onChange={e => setNewSubEmailFromInvoice(e.target.value)}
                            placeholder="email@example.com"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Trade Category</Label>
                          <Select value={newSubTradeFromInvoice} onValueChange={setNewSubTradeFromInvoice}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select trade..." />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Line Items</Label>
                    <Button variant="outline" size="sm" onClick={addInvoiceLineItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto border rounded-lg p-2">
                    {invoiceLineItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start p-2 bg-gray-50 rounded">
                        <div className="col-span-5">
                          <Input
                            value={item.description}
                            onChange={e => updateInvoiceLineItem(index, 'description', e.target.value)}
                            placeholder="Description"
                            className="text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Select
                            value={item.category || ''}
                            onValueChange={value => updateInvoiceLineItem(index, 'category', value || null)}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Cat." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="labor">Labor</SelectItem>
                              <SelectItem value="materials">Materials</SelectItem>
                              <SelectItem value="equipment">Equipment</SelectItem>
                              <SelectItem value="permits">Permits</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1">
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={e => updateInvoiceLineItem(index, 'quantity', parseFloat(e.target.value) || null)}
                            placeholder="Qty"
                            className="text-sm"
                          />
                        </div>
                        <div className="col-span-1">
                          <Input
                            value={item.unit || ''}
                            onChange={e => updateInvoiceLineItem(index, 'unit', e.target.value || null)}
                            placeholder="Unit"
                            className="text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.amount || ''}
                            onChange={e => updateInvoiceLineItem(index, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="Amount"
                            className="text-sm"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeInvoiceLineItem(index)}
                            className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-right">
                      <span className="text-gray-600 mr-2">Total:</span>
                      <span className="text-xl font-bold text-green-600">
                        ${invoiceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Timeline</Label>
                    <Input
                      value={invoiceTimeline}
                      onChange={e => setInvoiceTimeline(e.target.value)}
                      placeholder="e.g., 2-3 weeks"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={invoiceNotes}
                      onChange={e => setInvoiceNotes(e.target.value)}
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={resetInvoiceModal}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveInvoiceBid}
                    disabled={savingInvoice || !invoiceJobId || invoiceLineItems.length === 0}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {savingInvoice ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Bid
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
