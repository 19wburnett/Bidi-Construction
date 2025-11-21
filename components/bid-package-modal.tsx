'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { getJobForUser } from '@/lib/job-access'
import { useAuth } from '@/app/providers'
import { 
  Package,
  Users,
  Calendar,
  FileText,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  Eye,
  Trash2,
  Plus,
  Minus,
  Star,
  Globe,
  Mail,
  Wrench,
  Hammer,
  Home,
  DoorOpen,
  Layers,
  Square,
  Snowflake,
  SquareStack,
  Paintbrush,
  Box,
  Wind,
  Droplet,
  Zap,
  ChevronRight,
  ChevronDown,
  CheckCircle2
} from 'lucide-react'
import { modalBackdrop, modalContent, successCheck, staggerContainer, staggerItem } from '@/lib/animations'
import { BidPackage, Job, JobReport } from '@/types/takeoff'
import { TRADE_CATEGORIES, TRADE_GROUPS, getAllTrades, normalizeTrade } from '@/lib/trade-types'

interface BidPackageModalProps {
  jobId: string
  planId: string
  takeoffItems: Array<{
    id: string
    category: string
    description: string
    quantity: number
    unit: string
    unit_cost?: number
    subcontractor?: string
  }>
  isOpen: boolean
  onClose: () => void
  onPackageCreated?: (pkg: BidPackage) => void
}

interface TakeoffItem {
  id: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number
  subcontractor?: string
}

interface Subcontractor {
  id: string
  name: string
  email: string
  trade_category: string
  location?: string
  website_url?: string
  google_review_score?: number | null
  google_reviews_link?: string | null
  time_in_business?: string | null
  jobs_completed?: number | null
  licensed?: boolean | null
  bonded?: boolean | null
  phone?: string | null
  source: 'gc' | 'bidi'
}

const TRADE_ICONS: Record<string, any> = {
  'Excavation': Wrench,
  'Concrete': Building2,
  'Masonry': Building2,
  'Structural': Building2,
  'Structural Steel': Building2,
  'Framing': Hammer,
  'Carpentry': Hammer,
  'Roofing': Home,
  'Windows & Doors': DoorOpen,
  'Siding': Layers,
  'Drywall': Square,
  'Insulation': Snowflake,
  'Flooring': SquareStack,
  'Painting': Paintbrush,
  'Millwork & Casework': Box,
  'HVAC': Wind,
  'Plumbing': Droplet,
  'Electrical': Zap,
  'Fire Sprinkler': Droplet
}

const STEP_NAMES = [
  'Select Trades',
  'Select Line Items',
  'Attach Reports',
  'Select Subcontractors',
  'Email Status'
]

export default function BidPackageModal({ 
  jobId,
  planId,
  takeoffItems: propsTakeoffItems,
  isOpen, 
  onClose, 
  onPackageCreated 
}: BidPackageModalProps) {
  const [job, setJob] = useState<Job | null>(null)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([])
  const [selectedTrades, setSelectedTrades] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [selectedSubs, setSelectedSubs] = useState<string[]>([])
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState(1)
  const [tradeSearch, setTradeSearch] = useState('')
  const [customTrade, setCustomTrade] = useState('')
  const [otherSelected, setOtherSelected] = useState(false)
  // Subcontractor filters & directory toggles
  const [includeMyContacts, setIncludeMyContacts] = useState(true)
  const [includeBidiDirectory, setIncludeBidiDirectory] = useState(true)
  const [minGoogleReview, setMinGoogleReview] = useState<string>('')
  const [minJobsCompleted, setMinJobsCompleted] = useState<string>('')
  const [licensedOnly, setLicensedOnly] = useState(false)
  const [bondedOnly, setBondedOnly] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState<{ name: string; email: string; trade_category: string; location: string }>(
    { name: '', email: '', trade_category: '', location: '' }
  )
  const [previewOpen, setPreviewOpen] = useState(false)
  const [lineItemSearch, setLineItemSearch] = useState('')
  const [selectedTradeLineItems, setSelectedTradeLineItems] = useState<Record<string, string[]>>({})
  const [activeTrade, setActiveTrade] = useState<string | null>(null)
  const [createdPackages, setCreatedPackages] = useState<BidPackage[]>([])
  const [recipients, setRecipients] = useState<any[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [allTrades, setAllTrades] = useState<string[]>([])
  const [loadingTrades, setLoadingTrades] = useState(false)
  const [showMoreItems, setShowMoreItems] = useState<Record<string, boolean>>({})
  const [showCustomLineItemForm, setShowCustomLineItemForm] = useState(false)
  const [reports, setReports] = useState<JobReport[]>([])
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([])
  
  const { user } = useAuth()
  const supabase = createClient()

  const [newItem, setNewItem] = useState<{ description: string; quantity: string; unit: string; unit_cost: string }>({
    description: '',
    quantity: '',
    unit: '',
    unit_cost: ''
  })

  const loadCustomTrades = useCallback(async () => {
    if (!user) return
    setLoadingTrades(true)
    try {
      const trades = await getAllTrades(supabase)
      setAllTrades(trades)
    } catch (err: any) {
      console.error('Error loading custom trades:', err)
      setAllTrades([...TRADE_CATEGORIES])
    } finally {
      setLoadingTrades(false)
    }
  }, [user, supabase])

  // Keep custom trade in sync with selected trades and save to database
  useEffect(() => {
    const trimmed = customTrade.trim()
    if (otherSelected && trimmed) {
      // Add to selected trades immediately
      setSelectedTrades(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
      
      // Save to database if not already there
      if (user && trimmed && !allTrades.includes(trimmed)) {
        supabase
          .from('custom_trades')
          .insert({ name: trimmed, created_by: user.id })
          .then(({ error }) => {
            if (error && error.code !== '23505') { // Ignore duplicate key errors
              console.error('Error saving custom trade:', error)
            } else if (!error) {
              // Reload trades to include the new one
              loadCustomTrades()
            }
          })
      }
    } else if ((!otherSelected || !trimmed) && selectedTrades.length > 0) {
      setSelectedTrades(prev => prev.filter(t => t !== trimmed))
    }
  }, [otherSelected, customTrade, user, allTrades, supabase, loadCustomTrades])

  useEffect(() => {
    setSelectedTradeLineItems(prev => {
      if (selectedTrades.length === 0) {
        return Object.keys(prev).length === 0 ? prev : {}
      }
      const next: Record<string, string[]> = {}
      let changed = Object.keys(prev).length !== selectedTrades.length
      for (const trade of selectedTrades) {
        const existing = prev[trade] ?? []
        next[trade] = existing
        if (!prev[trade]) changed = true
      }
      return changed ? next : prev
    })
  }, [selectedTrades])

  useEffect(() => {
    if (selectedTrades.length === 0) {
      setActiveTrade(null)
      setShowMoreItems({})
      return
    }
    setActiveTrade(prev => {
      if (prev && selectedTrades.includes(prev)) return prev
      return selectedTrades[0]
    })
  }, [selectedTrades])

  useEffect(() => {
    if (isOpen && jobId) {
      loadData()
      loadCustomTrades()
    }
  }, [isOpen, jobId, loadCustomTrades])

  async function loadData() {
    try {
      if (!user || !jobId) {
        return
      }

      // Load job details
      const membership = await getJobForUser(supabase, jobId, user.id, '*')

      if (!membership?.job) {
        throw new Error('Job not found or access denied')
      }

      setJob(membership.job)

      // Load my contacts (gc_contacts)
      const [{ data: myData, error: myErr }, { data: bidiData, error: bidiErr }] = await Promise.all([
        supabase.from('gc_contacts').select('*'),
        supabase
          .from('subcontractors')
          .select('*')
      ])

      if (myErr) throw myErr
      if (bidiErr) throw bidiErr

      const myContacts: Subcontractor[] = (myData || []).map((r: any) => ({
        id: `gc:${r.id}`,
        name: r.name,
        email: r.email,
        trade_category: r.trade_category,
        location: r.location,
        phone: r.phone ?? null,
        source: 'gc'
      }))

      const bidiContacts: Subcontractor[] = (bidiData || []).map((r: any) => ({
        id: `bidi:${r.id}`,
        name: r.name,
        email: r.email,
        trade_category: r.trade_category,
        location: r.location,
        website_url: r.website_url,
        google_review_score: r.google_review_score != null ? Number(r.google_review_score) : null,
        google_reviews_link: r.google_reviews_link,
        time_in_business: r.time_in_business,
        jobs_completed: r.jobs_completed,
        licensed: r.licensed ?? null,
        bonded: r.bonded ?? null,
        phone: r.phone ?? null,
        source: 'bidi'
      }))

      setSubcontractors([...myContacts, ...bidiContacts])

      // Use takeoff items from props and add defaults for the selected trade when chosen later
      setTakeoffItems(propsTakeoffItems)

    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    }
  }

  const handleCreatePackage = async () => {
    if (!user || !job) return

    setLoading(true)
    setError('')

    try {
      // Create one bid package per selected trade based on assigned line items
      const rowsToInsert = selectedTrades.map(trade => {
        const assignedIds = selectedTradeLineItems[trade] ?? []
        const minimumLineItems = assignedIds
          .map(id => takeoffItemById[id])
          .filter((item): item is TakeoffItem => Boolean(item))
          .map(item => ({
            id: item.id,
            category: trade,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_cost: item.unit_cost
          }))

        return {
          job_id: jobId,
          trade_category: trade,
          description: description || null,
          minimum_line_items: minimumLineItems,
          status: 'draft',
          deadline: deadline ? new Date(deadline).toISOString() : null
        }
      })

      const { data, error: insertError } = await supabase
        .from('bid_packages')
        .insert(rowsToInsert)
        .select()

      if (insertError) throw insertError

      // Link reports to bid packages
      if (selectedReportIds.length > 0 && Array.isArray(data)) {
        const reportRows = []
        for (const pkg of data) {
          for (const reportId of selectedReportIds) {
            reportRows.push({
              bid_package_id: pkg.id,
              report_id: reportId
            })
          }
        }
        
        const { error: reportLinkError } = await supabase
          .from('bid_package_reports')
          .insert(reportRows)
          
        if (reportLinkError) console.error('Error linking reports:', reportLinkError)
      }

      // Send emails to selected subcontractors (grouped per trade)
      if (selectedSubs.length > 0 && Array.isArray(data)) {
        const normalizedLookup = new Map(
          selectedTrades.map(trade => [normalizeTrade(trade), trade])
        )
        const selectedSubcontractors = subcontractors.filter(sub => selectedSubs.includes(sub.id))
        const byTrade: Record<string, Subcontractor[]> = {}
        for (const sub of selectedSubcontractors) {
          const canonicalTrade = normalizedLookup.get(normalizeTrade(sub.trade_category)) ?? sub.trade_category
          if (!byTrade[canonicalTrade]) byTrade[canonicalTrade] = []
          byTrade[canonicalTrade].push(sub)
        }

        // Send emails for each bid package
        for (const pkg of data) {
          const tradeSubs = byTrade[pkg.trade_category] || []
          if (tradeSubs.length > 0) {
            try {
              const response = await fetch('/api/bid-packages/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bidPackageId: pkg.id,
                  subcontractorIds: tradeSubs.map(sub => sub.id),
                  planId: planId,
                  reportIds: selectedReportIds // Pass report IDs to API
                })
              })

              if (!response.ok) {
                const errorData = await response.json()
                console.error('Error sending emails:', errorData)
              }
            } catch (err) {
              console.error('Error sending emails:', err)
            }
          }
        }
      }

      if (Array.isArray(data)) {
        setCreatedPackages(data)
        data.forEach(pkg => onPackageCreated?.(pkg))
        
        // Load recipients for created packages
        if (selectedSubs.length > 0) {
          await loadRecipients(data.map(p => p.id))
        }
        
        // Move to Step 5 to show email status
        setStep(5)
      } else {
        setSuccess(true)
        setTimeout(() => {
          handleClose()
        }, 2000)
      }

    } catch (err: any) {
      setError(err.message || 'Failed to create bid package')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSuccess(false)
    setStep(1)
    setSelectedTrades([])
    setDescription('')
    setSelectedSubs([])
    setDeadline('')
    setError('')
    setSelectedTradeLineItems({})
    setActiveTrade(null)
    setLineItemSearch('')
    setCreatedPackages([])
    setRecipients([])
    onClose()
  }

  const loadRecipients = async (packageIds: string[]) => {
    setLoadingRecipients(true)
    try {
      const allRecipients: any[] = []
      for (const packageId of packageIds) {
        const response = await fetch(`/api/bid-packages/${packageId}/recipients`)
        if (response.ok) {
          const data = await response.json()
          if (data.recipients) {
            allRecipients.push(...data.recipients)
          }
        }
      }
      setRecipients(allRecipients)
    } catch (err) {
      console.error('Error loading recipients:', err)
    } finally {
      setLoadingRecipients(false)
    }
  }

  const takeoffItemById = useMemo(() => {
    const map: Record<string, TakeoffItem> = {}
    for (const item of takeoffItems) {
      map[item.id] = item
    }
    return map
  }, [takeoffItems])

  const filteredTakeoffItems = takeoffItems
  const visibleTakeoffItems = useMemo(() => {
    const normalizedSearch = lineItemSearch.trim().toLowerCase()
    if (!normalizedSearch) return filteredTakeoffItems
    return filteredTakeoffItems.filter(item => {
      const description = item.description?.toLowerCase() ?? ''
      const category = item.category?.toLowerCase() ?? ''
      const unit = item.unit?.toLowerCase() ?? ''
      return (
        description.includes(normalizedSearch) ||
        category.includes(normalizedSearch) ||
        unit.includes(normalizedSearch)
      )
    })
  }, [filteredTakeoffItems, lineItemSearch])

  const lineItemsForActiveTrade = useMemo(() => {
    // Map old category system to trade names for better matching
    const categoryToTradeMap: Record<string, string[]> = {
      'mep': ['HVAC', 'Plumbing', 'Electrical', 'Fire Sprinkler'],
      'structural': ['Structural', 'Structural Steel', 'Concrete', 'Masonry', 'Framing', 'Excavation'],
      'finishes': ['Flooring', 'Painting', 'Drywall', 'Carpentry', 'Millwork & Casework', 'Insulation'],
      'interior': ['Drywall', 'Painting', 'Carpentry', 'Millwork & Casework', 'Windows & Doors'],
      'exterior': ['Siding', 'Roofing', 'Windows & Doors']
    }
    
    if (!activeTrade) {
      // If no active trade selected, show items that match any selected trade via subcontractor or category
      if (selectedTrades.length === 0) return { prioritized: visibleTakeoffItems, remaining: [] }
      
      const normalizedSelectedTrades = new Set(selectedTrades.map(t => normalizeTrade(t)))
      const filtered = visibleTakeoffItems.filter(item => {
        const itemSubcontractorNormalized = item.subcontractor ? normalizeTrade(item.subcontractor) : ''
        const itemCategoryNormalized = item.category ? normalizeTrade(item.category) : ''
        
        // Direct matches
        const matchesSubcontractor = itemSubcontractorNormalized && normalizedSelectedTrades.has(itemSubcontractorNormalized)
        const matchesCategory = itemCategoryNormalized && normalizedSelectedTrades.has(itemCategoryNormalized)
        
        // Check if category maps to any selected trade
        const categoryTrades = categoryToTradeMap[itemCategoryNormalized] || []
        const matchesCategoryMapping = categoryTrades.some(trade => normalizedSelectedTrades.has(normalizeTrade(trade)))
        
        return matchesSubcontractor || matchesCategory || matchesCategoryMapping
      })
      return { prioritized: filtered, remaining: [] }
    }
    
    const normalizedActiveTrade = normalizeTrade(activeTrade)
    const assignedIds = new Set(selectedTradeLineItems[activeTrade] ?? [])

    const prioritized: TakeoffItem[] = []
    const remaining: TakeoffItem[] = []

    for (const item of visibleTakeoffItems) {
      // Normalize item fields for comparison
      const itemSubcontractorNormalized = item.subcontractor ? normalizeTrade(item.subcontractor) : ''
      const itemCategoryNormalized = item.category ? normalizeTrade(item.category) : ''
      
      // Check if item matches the active trade
      const matchesCategory = normalizedActiveTrade && itemCategoryNormalized === normalizedActiveTrade
      const matchesSubcontractor = itemSubcontractorNormalized && itemSubcontractorNormalized === normalizedActiveTrade
      
      // Check if category maps to active trade
      const categoryTrades = categoryToTradeMap[itemCategoryNormalized] || []
      const matchesCategoryMapping = categoryTrades.some(trade => normalizeTrade(trade) === normalizedActiveTrade)
      
      const isAssigned = assignedIds.has(item.id)
      
      // Prioritize items that match the active trade (via category, subcontractor, or category mapping) or are already assigned
      if (matchesCategory || matchesSubcontractor || matchesCategoryMapping || isAssigned) {
        prioritized.push(item)
      } else {
        // Add all other items to remaining (subcontractors might do multiple trades)
        remaining.push(item)
      }
    }

    // If no prioritized items but there are remaining items, show them as prioritized
    // This handles the case where items don't have subcontractor tags but should still be visible
    if (prioritized.length === 0 && remaining.length > 0) {
      return { prioritized: remaining, remaining: [] }
    }

    return { prioritized, remaining }
  }, [activeTrade, visibleTakeoffItems, selectedTradeLineItems, selectedTrades])
  const canonicalTradeByNormalized = useMemo(() => {
    const map: Record<string, string> = {}
    for (const trade of selectedTrades) {
      const normalized = normalizeTrade(trade)
      if (!normalized) continue
      if (!map[normalized]) {
        map[normalized] = trade
      }
    }
    return map
  }, [selectedTrades])

  const selectedLineItems = useMemo(() => {
    const seen = new Set<string>()
    const items: TakeoffItem[] = []
    for (const ids of Object.values(selectedTradeLineItems)) {
      for (const id of ids) {
        if (seen.has(id)) continue
        const item = takeoffItemById[id]
        if (item) {
          items.push(item)
          seen.add(id)
        }
      }
    }
    return items
  }, [selectedTradeLineItems, takeoffItemById])

  const totalSelectedLineItemCount = selectedLineItems.length

  const lineItemsByTrade = useMemo(() => {
    const map: Record<string, TakeoffItem[]> = {}
    for (const [trade, ids] of Object.entries(selectedTradeLineItems)) {
      const items = ids
        .map(id => takeoffItemById[id])
        .filter((item): item is TakeoffItem => Boolean(item))
      map[trade] = items
    }
    return map
  }, [selectedTradeLineItems, takeoffItemById])

  const tradeAssignmentByItemId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [trade, ids] of Object.entries(selectedTradeLineItems)) {
      for (const id of ids) {
        map[id] = trade
      }
    }
    return map
  }, [selectedTradeLineItems])

  const selectedSubcontractorsByTrade = useMemo(() => {
    const map: Record<string, Subcontractor[]> = {}
    for (const sub of subcontractors) {
      if (!selectedSubs.includes(sub.id)) continue
      const normalized = normalizeTrade(sub.trade_category)
      const canonicalTrade = canonicalTradeByNormalized[normalized]
      if (!canonicalTrade) continue
      if (!map[canonicalTrade]) {
        map[canonicalTrade] = []
      }
      map[canonicalTrade].push(sub)
    }
    return map
  }, [subcontractors, selectedSubs, canonicalTradeByNormalized])

  const unassignedLineItems = useMemo(() => {
    const items: TakeoffItem[] = []
    for (const [trade, ids] of Object.entries(selectedTradeLineItems)) {
      if (!selectedTrades.includes(trade)) {
        ids.forEach(id => {
          const item = takeoffItemById[id]
          if (item) items.push(item)
        })
      }
    }
    return items
  }, [selectedTradeLineItems, selectedTrades, takeoffItemById])

  const handleToggleLineItemSelection = (trade: string | null, itemId: string, checked: boolean) => {
    if (!trade) return
    setSelectedTradeLineItems(prev => {
      if (!selectedTrades.includes(trade)) return prev
      let changed = false
      const next: Record<string, string[]> = {}
      for (const tradeName of selectedTrades) {
        const existing = prev[tradeName] ?? []
        if (tradeName === trade) {
          const set = new Set(existing)
          if (checked) {
            if (!set.has(itemId)) {
              set.add(itemId)
              changed = true
            }
          } else if (set.delete(itemId)) {
            changed = true
          }
          next[tradeName] = Array.from(set)
        } else if (checked && existing.includes(itemId)) {
          const filtered = existing.filter(id => id !== itemId)
          if (filtered.length !== existing.length) {
            changed = true
          }
          next[tradeName] = filtered
        } else {
          next[tradeName] = existing
        }
      }
      return changed ? next : prev
    })
  }

  const filteredSubcontractors = subcontractors
    .filter(sub => (includeMyContacts && sub.source === 'gc') || (includeBidiDirectory && sub.source === 'bidi'))
    .filter(sub => {
      if (selectedTrades.length === 0) return true
      const subTrade = (sub.trade_category || '').trim().toLowerCase()
      return selectedTrades.some(t => {
        const selected = (t || '').trim().toLowerCase()
        if (!selected || !subTrade) return false
        if (selected === subTrade) return true
        // Normalize common synonyms: treat "electrical" and "electrician" the same
        if (selected.startsWith('electric') && subTrade.startsWith('electric')) return true
        return false
      })
    })
    .filter(sub => {
      if (licensedOnly && sub.source === 'bidi') return !!sub.licensed
      return licensedOnly ? sub.source === 'gc' ? true : !!sub.licensed : true
    })
    .filter(sub => {
      if (bondedOnly && sub.source === 'bidi') return !!sub.bonded
      return bondedOnly ? sub.source === 'gc' ? true : !!sub.bonded : true
    })
    .filter(sub => {
      const minRevStr = (minGoogleReview || '').trim()
      if (minRevStr === '' || sub.source !== 'bidi') return true
      const minRev = Number(minRevStr)
      if (isNaN(minRev)) return true
      const score = typeof sub.google_review_score === 'number' ? sub.google_review_score : Number(sub.google_review_score ?? NaN)
      return !isNaN(score) ? score >= minRev : false
    })
    .filter(sub => {
      const minJobsStr = (minJobsCompleted || '').trim()
      if (minJobsStr === '' || sub.source !== 'bidi') return true
      const minJobs = Number(minJobsStr)
      if (isNaN(minJobs)) return true
      const jobs = typeof sub.jobs_completed === 'number' ? sub.jobs_completed : Number(sub.jobs_completed ?? 0)
      return jobs >= minJobs
    })

  const canProceedToStep2 = selectedTrades.length > 0
  const canProceedToStep3 = totalSelectedLineItemCount > 0
  const canCreatePackage = selectedSubs.length > 0

  if (!isOpen) return null

  return (
    <motion.div
      variants={modalBackdrop}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={handleClose}
      style={{ pointerEvents: 'auto' }}
    >
      <motion.div
        variants={modalContent}
        initial="initial"
        animate="animate"
        exit="exit"
        className="bg-white rounded-lg shadow-xl w-[80vw] h-[80vh] max-w-[90vw] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="border-0 shadow-none flex flex-col h-full">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2 text-orange-600" />
                  Create Bid Package
                </CardTitle>
                <CardDescription>
                  Create a bid request for subcontractors
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                ×
              </Button>
            </div>
            
            {/* Step Navigation */}
            <div className="flex items-center justify-between mt-4">
              {STEP_NAMES.map((stepName, index) => {
                const stepNum = index + 1
                const isCompleted = step > stepNum
                const isCurrent = step === stepNum
                const isClickable = isCompleted || stepNum === step
                
                return (
                  <div key={stepNum} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (isClickable) {
                          setStep(stepNum)
                        }
                      }}
                      disabled={!isClickable}
                      className={`flex items-center flex-1 ${
                        isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-50'
                      }`}
                    >
                      <div className="flex items-center flex-1">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                            isCurrent
                              ? 'bg-orange-600 border-orange-600 text-white'
                              : isCompleted
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-300 text-gray-500'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <span className="text-sm font-semibold">{stepNum}</span>
                          )}
                        </div>
                        <div className="ml-3 flex-1">
                          <div className={`text-xs font-medium ${isCurrent ? 'text-orange-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                            Step {stepNum}
                          </div>
                          <div className={`text-sm font-semibold ${isCurrent ? 'text-gray-900' : 'text-gray-600'}`}>
                            {stepName}
                          </div>
                        </div>
                      </div>
                    </button>
                    {stepNum < STEP_NAMES.length && (
                      <ChevronRight className="h-5 w-5 text-gray-400 mx-2 flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-hidden flex flex-col min-h-0">
            <AnimatePresence mode="wait">
              {!success ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  {/* Job Info */}
                  {job && (
                    <motion.div
                      variants={staggerItem}
                      className="p-4 bg-gray-50 rounded-lg"
                    >
                      <h3 className="font-semibold text-gray-900 mb-2">{job.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {job.location}
                        </div>
                        {job.budget_range && (
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            {job.budget_range}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

              {/* Step 1: Trades & Description */}
                  {step === 1 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="flex flex-col h-full min-h-0"
                    >
                      <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                        <motion.div variants={staggerItem} className="space-y-4">
                          <div>
                            <Label className="text-base font-semibold">Trade Categories *</Label>
                            <Input
                              placeholder="Search trades (e.g., Electrical, Roofing, Fire Alarm)"
                              value={tradeSearch}
                              onChange={(e) => setTradeSearch(e.target.value)}
                              className="mt-2"
                            />
                          </div>
                          
                          {/* Grouped Trade Cards */}
                          {Object.entries(TRADE_GROUPS).map(([groupName, groupTrades]) => {
                            // Filter trades that are in this group and match search, and exist in allTrades
                            const filteredTrades = groupTrades.filter(trade => 
                              allTrades.includes(trade) &&
                              trade.toLowerCase().includes(tradeSearch.toLowerCase())
                            )
                            if (filteredTrades.length === 0) return null
                            
                            return (
                              <div key={groupName} className="space-y-2">
                                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{groupName}</h4>
                                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                  {filteredTrades.map((trade) => {
                                    const Icon = TRADE_ICONS[trade] || Package
                                    const isSelected = selectedTrades.includes(trade)
                                    return (
                                      <button
                                        key={trade}
                                        type="button"
                                        onClick={() => {
                                          setSelectedTrades(prev => 
                                            isSelected 
                                              ? prev.filter(t => t !== trade)
                                              : [...prev, trade]
                                          )
                                        }}
                                        className={`p-2 border-2 rounded-lg transition-all hover:shadow-sm ${
                                          isSelected
                                            ? 'border-orange-500 bg-orange-50 shadow-sm'
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                      >
                                        <div className="flex flex-col items-center text-center space-y-1">
                                          <div className={`p-1.5 rounded-full ${
                                            isSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                                          }`}>
                                            <Icon className="h-3.5 w-3.5" />
                                          </div>
                                          <span className={`text-xs font-medium leading-tight ${
                                            isSelected ? 'text-orange-900' : 'text-gray-900'
                                          }`}>
                                            {trade}
                                          </span>
                                          {isSelected && (
                                            <CheckCircle2 className="h-3 w-3 text-orange-500" />
                                          )}
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                          
                          {/* Custom Trades Not in Groups */}
                          {(() => {
                            const allGroupedTrades = new Set(Object.values(TRADE_GROUPS).flat() as string[])
                            const customTradesNotInGroups = allTrades.filter(trade => 
                              !allGroupedTrades.has(trade) &&
                              trade.toLowerCase().includes(tradeSearch.toLowerCase())
                            )
                            
                            if (customTradesNotInGroups.length === 0) return null
                            
                            return (
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Custom Trades</h4>
                                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                  {customTradesNotInGroups.map((trade) => {
                                    const Icon = TRADE_ICONS[trade] || Package
                                    const isSelected = selectedTrades.includes(trade)
                                    return (
                                      <button
                                        key={trade}
                                        type="button"
                                        onClick={() => {
                                          setSelectedTrades(prev => 
                                            isSelected 
                                              ? prev.filter(t => t !== trade)
                                              : [...prev, trade]
                                          )
                                        }}
                                        className={`p-2 border-2 rounded-lg transition-all hover:shadow-sm ${
                                          isSelected
                                            ? 'border-orange-500 bg-orange-50 shadow-sm'
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                      >
                                        <div className="flex flex-col items-center text-center space-y-1">
                                          <div className={`p-1.5 rounded-full ${
                                            isSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                                          }`}>
                                            <Icon className="h-3.5 w-3.5" />
                                          </div>
                                          <span className={`text-xs font-medium leading-tight ${
                                            isSelected ? 'text-orange-900' : 'text-gray-900'
                                          }`}>
                                            {trade}
                                          </span>
                                          {isSelected && (
                                            <CheckCircle2 className="h-3 w-3 text-orange-500" />
                                          )}
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}
                          
                          {/* Custom Trade Card */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Other</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setOtherSelected(!otherSelected)}
                                className={`p-2 border-2 rounded-lg transition-all hover:shadow-sm text-left ${
                                  otherSelected
                                    ? 'border-orange-500 bg-orange-50 shadow-sm'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <div className={`p-1.5 rounded-full ${
                                    otherSelected ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </div>
                                  <span className={`text-xs font-medium ${
                                    otherSelected ? 'text-orange-900' : 'text-gray-900'
                                  }`}>
                                    Add Custom Trade
                                  </span>
                                </div>
                              </button>
                              {otherSelected && (
                                <div className="md:col-span-1">
                                  <Input
                                    placeholder="Type a custom trade (e.g., Geotechnical, Pool Contractor)"
                                    value={customTrade}
                                    onChange={(e) => setCustomTrade(e.target.value)}
                                    className="h-9 text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </div>

                      <motion.div variants={staggerItem} className="flex-shrink-0 pt-4 border-t mt-4">
                        <Button 
                          onClick={() => setStep(2)}
                          disabled={!canProceedToStep2}
                          className="w-full"
                        >
                          Next: Select Line Items
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* Step 2: Line Items */}
                  {step === 2 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 h-full min-h-0 overflow-hidden"
                    >
                      {/* Left Pane: Trade Tabs and Line Items */}
                      <div className="flex flex-col min-h-0 h-full overflow-hidden">
                        <div className="flex-shrink-0 space-y-4 mb-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h3 className="text-base md:text-lg font-semibold">Minimum Line Items</h3>
                            <Badge variant="outline" className="text-xs md:text-sm">
                              {totalSelectedLineItemCount} selected
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {selectedTrades.map(trade => {
                                const count = (selectedTradeLineItems[trade] ?? []).length
                                const isActive = trade === activeTrade
                                return (
                                  <Button
                                    key={trade}
                                    type="button"
                                    variant={isActive ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setActiveTrade(trade)}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="truncate max-w-[140px]">{trade}</span>
                                    <Badge variant={isActive ? 'secondary' : 'outline'} className="text-[11px]">
                                      {count}
                                    </Badge>
                                  </Button>
                                )
                              })}
                              {selectedTrades.length === 0 && (
                                <div className="text-sm text-gray-500">
                                  Add at least one trade in Step 1 to assign line items.
                                </div>
                              )}
                            </div>
                            {selectedTrades.length > 0 && !activeTrade && (
                              <div className="text-sm text-gray-500">
                                Select a trade to start assigning line items.
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Search line items..."
                              value={lineItemSearch}
                              onChange={(e) => setLineItemSearch(e.target.value)}
                              disabled={!activeTrade}
                              className="flex-1"
                            />
                            {activeTrade && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (!activeTrade) return
                                  const allVisibleItems = [
                                    ...lineItemsForActiveTrade.prioritized,
                                    ...(showMoreItems[activeTrade] ? lineItemsForActiveTrade.remaining : [])
                                  ]
                                  const allItemIds = new Set(allVisibleItems.map(item => item.id))
                                  const currentSelected = new Set(selectedTradeLineItems[activeTrade] ?? [])
                                  
                                  // Check if all are selected (then deselect all) or select all
                                  const allSelected = allVisibleItems.length > 0 && allVisibleItems.every(item => currentSelected.has(item.id))
                                  
                                  setSelectedTradeLineItems(prev => {
                                    const next: Record<string, string[]> = {}
                                    for (const trade of selectedTrades) {
                                      if (trade === activeTrade) {
                                        if (allSelected) {
                                          // Deselect all
                                          next[trade] = []
                                        } else {
                                          // Select all visible items
                                          const existing = prev[trade] ?? []
                                          const combined = new Set(existing)
                                          allItemIds.forEach(id => combined.add(id))
                                          next[trade] = Array.from(combined)
                                        }
                                      } else {
                                        // Remove items from other trades if selecting all
                                        if (!allSelected) {
                                          const existing = prev[trade] ?? []
                                          next[trade] = existing.filter(id => !allItemIds.has(id))
                                        } else {
                                          next[trade] = prev[trade] ?? []
                                        }
                                      }
                                    }
                                    return next
                                  })
                                }}
                              >
                                {(() => {
                                  const allVisibleItems = [
                                    ...lineItemsForActiveTrade.prioritized,
                                    ...(showMoreItems[activeTrade] ? lineItemsForActiveTrade.remaining : [])
                                  ]
                                  const currentSelected = new Set(selectedTradeLineItems[activeTrade] ?? [])
                                  const allSelected = allVisibleItems.length > 0 && allVisibleItems.every(item => currentSelected.has(item.id))
                                  return allSelected ? 'Deselect All' : 'Select All'
                                })()}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 min-h-0">
                        {activeTrade ? (
                          <>
                            {/* Prioritized items (tagged to this subcontractor type) */}
                            {lineItemsForActiveTrade.prioritized.length === 0 && lineItemsForActiveTrade.remaining.length === 0 && (
                              <div className="p-6 text-center text-sm text-gray-500 border rounded-lg">
                                No line items found. Try selecting different trades or check if items have subcontractor tags assigned.
                              </div>
                            )}
                            {lineItemsForActiveTrade.prioritized.map((item) => {
                              const assignedTrade = tradeAssignmentByItemId[item.id]
                              const isSelected = assignedTrade === activeTrade
                              const isAssignedElsewhere = assignedTrade && assignedTrade !== activeTrade
                              const totalCost = item.unit_cost ? (item.quantity * item.unit_cost) : null
                              return (
                                <motion.div
                                  key={item.id}
                                  variants={staggerItem}
                                  className={`p-4 border-2 rounded-lg transition-all ${
                                    isSelected
                                      ? 'bg-orange-50 border-orange-400 shadow-sm'
                                      : isAssignedElsewhere
                                        ? 'bg-gray-50 border-gray-300 opacity-60'
                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) =>
                                        handleToggleLineItemSelection(activeTrade, item.id, checked === true)
                                      }
                                      className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="font-medium text-gray-900 flex-1">{item.description}</div>
                                        {isAssignedElsewhere && (
                                          <Badge variant="secondary" className="text-[10px] text-gray-700 bg-gray-200 shrink-0">
                                            {assignedTrade}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 flex-wrap">
                                        {item.subcontractor && (
                                          <Badge variant="outline" className="text-xs">
                                            {item.subcontractor}
                                          </Badge>
                                        )}
                                        <span className="text-sm text-gray-600">
                                          {item.quantity} {item.unit}
                                          {item.unit_cost && ` @ $${item.unit_cost.toFixed(2)}/${item.unit}`}
                                        </span>
                                      </div>
                                      {totalCost !== null && (
                                        <div className="mt-2 text-sm font-semibold text-green-600">
                                          Total: ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )
                            })}

                            {/* See More button */}
                            {lineItemsForActiveTrade.remaining.length > 0 && (
                              <div className="pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowMoreItems(prev => ({
                                    ...prev,
                                    [activeTrade]: !prev[activeTrade]
                                  }))}
                                  className="w-full"
                                >
                                  {showMoreItems[activeTrade] ? 'Show Less' : `See More (${lineItemsForActiveTrade.remaining.length} additional items)`}
                                </Button>
                              </div>
                            )}

                            {/* Remaining items (shown when "See More" is clicked) */}
                            {showMoreItems[activeTrade] && lineItemsForActiveTrade.remaining.map((item) => {
                              const assignedTrade = tradeAssignmentByItemId[item.id]
                              const isSelected = assignedTrade === activeTrade
                              const isAssignedElsewhere = assignedTrade && assignedTrade !== activeTrade
                              const totalCost = item.unit_cost ? (item.quantity * item.unit_cost) : null
                              return (
                                <motion.div
                                  key={item.id}
                                  variants={staggerItem}
                                  className={`p-4 border-2 rounded-lg transition-all ${
                                    isSelected
                                      ? 'bg-orange-50 border-orange-400 shadow-sm'
                                      : isAssignedElsewhere
                                        ? 'bg-gray-50 border-gray-300 opacity-60'
                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) =>
                                        handleToggleLineItemSelection(activeTrade, item.id, checked === true)
                                      }
                                      className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="font-medium text-gray-900 flex-1">{item.description}</div>
                                        {isAssignedElsewhere && (
                                          <Badge variant="secondary" className="text-[10px] text-gray-700 bg-gray-200 shrink-0">
                                            {assignedTrade}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 flex-wrap">
                                        {item.subcontractor && (
                                          <Badge variant="outline" className="text-xs">
                                            {item.subcontractor}
                                          </Badge>
                                        )}
                                        <span className="text-sm text-gray-600">
                                          {item.quantity} {item.unit}
                                          {item.unit_cost && ` @ $${item.unit_cost.toFixed(2)}/${item.unit}`}
                                        </span>
                                      </div>
                                      {totalCost !== null && (
                                        <div className="mt-2 text-sm font-semibold text-green-600">
                                          Total: ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )
                            })}
                          </>
                        ) : (
                          <div className="p-6 text-center text-sm text-gray-500 border rounded-lg">
                            Select a trade to view available line items.
                          </div>
                        )}

                        {activeTrade && lineItemsForActiveTrade.prioritized.length === 0 && lineItemsForActiveTrade.remaining.length === 0 && (
                          <div className="p-6 text-center text-sm text-gray-500 border rounded-lg">
                            No line items match your search for this trade.
                          </div>
                        )}
                        </div>

                        {/* Add custom line item - Collapsible */}
                        <div className="flex-shrink-0 border rounded-lg bg-gray-50 overflow-hidden mt-4">
                          <button
                            type="button"
                            onClick={() => setShowCustomLineItemForm(!showCustomLineItemForm)}
                            className="w-full p-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                          >
                            <h4 className="font-semibold text-xs md:text-sm flex items-center gap-2">
                              <Plus className="h-4 w-4" />
                              Add Custom Line Item
                            </h4>
                            <ChevronDown 
                              className={`h-4 w-4 transition-transform ${showCustomLineItemForm ? 'rotate-180' : ''}`}
                            />
                          </button>
                          {showCustomLineItemForm && (
                            <div className="p-3 pt-0 space-y-3 border-t">
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                                <Select
                                  value={activeTrade ?? ''}
                                  onValueChange={(val) => {
                                    if (!selectedTrades.includes(val)) return
                                    setActiveTrade(val)
                                  }}
                                  disabled={selectedTrades.length === 0}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Trade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedTrades.map((trade) => (
                                      <SelectItem key={trade} value={trade}>
                                        {trade}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="Description"
                                  value={newItem.description}
                                  onChange={(e) => setNewItem(v => ({ ...v, description: e.target.value }))}
                                />
                                <Input
                                  placeholder="Quantity"
                                  value={newItem.quantity}
                                  onChange={(e) => setNewItem(v => ({ ...v, quantity: e.target.value }))}
                                />
                                <Input
                                  placeholder="Unit"
                                  value={newItem.unit}
                                  onChange={(e) => setNewItem(v => ({ ...v, unit: e.target.value }))}
                                />
                                <Input
                                  placeholder="Unit Cost"
                                  value={newItem.unit_cost}
                                  onChange={(e) => setNewItem(v => ({ ...v, unit_cost: e.target.value }))}
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    if (!activeTrade || !newItem.description) return
                                    const qty = Number(newItem.quantity) || 1
                                    const unitCost = newItem.unit_cost ? Number(newItem.unit_cost) : undefined
                                    const created: TakeoffItem = {
                                      id: `custom-${Date.now()}`,
                                      category: activeTrade,
                                      description: newItem.description,
                                      quantity: qty,
                                      unit: newItem.unit || 'unit',
                                      unit_cost: unitCost
                                    }
                                    setTakeoffItems(prev => [created, ...prev])
                                    setSelectedTradeLineItems(prev => {
                                      if (!selectedTrades.includes(activeTrade)) return prev
                                      const next: Record<string, string[]> = {}
                                      let changed = false
                                      for (const trade of selectedTrades) {
                                        const existing = prev[trade] ?? []
                                        if (trade === activeTrade) {
                                          const set = new Set(existing)
                                          const sizeBefore = set.size
                                          set.add(created.id)
                                          if (set.size !== sizeBefore) changed = true
                                          next[trade] = Array.from(set)
                                        } else {
                                          next[trade] = existing
                                        }
                                      }
                                      return changed ? next : prev
                                    })
                                    setNewItem({ description: '', quantity: '', unit: '', unit_cost: '' })
                                  }}
                                >
                                  Add Item
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Navigation buttons - fixed at bottom */}
                        <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 md:space-x-3 pt-2 border-t mt-4">
                          <Button 
                            variant="outline" 
                            onClick={() => setStep(1)}
                            className="flex-1 h-10 md:h-auto"
                          >
                            Back
                          </Button>
                          <Button 
                            onClick={() => setStep(3)}
                            disabled={!canProceedToStep3}
                            className="flex-1 h-10 md:h-auto"
                          >
                            Next: Select Subcontractors
                          </Button>
                        </div>
                      </div>

                      {/* Right Pane: Selected Items Summary */}
                      <div className="hidden lg:block flex flex-col min-h-0 h-full">
                        {totalSelectedLineItemCount > 0 ? (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-gradient-to-b from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg shadow-lg flex flex-col h-full min-h-0"
                          >
                            <h4 className="font-semibold text-blue-900 mb-3 flex items-center text-lg flex-shrink-0">
                              <FileText className="h-5 w-5 mr-2" />
                              Summary ({totalSelectedLineItemCount})
                            </h4>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                              {selectedTrades.map(trade => {
                                const items = lineItemsByTrade[trade] ?? []
                                if (items.length === 0) return null
                                return (
                                  <div key={trade} className="bg-white border-2 border-blue-200 rounded-lg p-3 space-y-2 shadow-sm">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="text-xs font-semibold">{trade}</Badge>
                                      <span className="text-xs text-gray-500 font-medium">{items.length} item{items.length === 1 ? '' : 's'}</span>
                                    </div>
                                    <ul className="space-y-2">
                                      {items.map(item => {
                                        const totalCost = item.unit_cost ? item.quantity * item.unit_cost : null
                                        const originalMatchesTrade = normalizeTrade(item.category) === normalizeTrade(trade)
                                        return (
                                          <li key={item.id} className="flex flex-col gap-1 pb-2 border-b border-blue-100 last:border-0 last:pb-0">
                                            <div className="font-medium text-sm text-gray-900">{item.description}</div>
                                            <div className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                                              <span className="font-mono">{item.quantity} {item.unit}</span>
                                              {item.unit_cost && (
                                                <>
                                                  <span>×</span>
                                                  <span className="font-mono">${item.unit_cost.toFixed(2)}</span>
                                                  <span>/{item.unit}</span>
                                                </>
                                              )}
                                              {item.subcontractor && item.subcontractor !== trade && (
                                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                                  {item.subcontractor}
                                                </Badge>
                                              )}
                                            </div>
                                            {totalCost !== null && (
                                              <div className="text-right text-sm font-bold text-green-600">
                                                ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                              </div>
                                            )}
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  </div>
                                )
                              })}
                            </div>
                            <div className="mt-4 pt-4 border-t-2 border-blue-400 bg-white rounded-lg p-3 shadow-sm flex-shrink-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-blue-900 text-base">Grand Total:</span>
                                <span className="text-2xl font-bold text-green-600">
                                  $
                                  {selectedLineItems
                                    .reduce((sum, item) => {
                                      const totalCost = item.unit_cost ? (item.quantity * item.unit_cost) : 0
                                      return sum + totalCost
                                    }, 0)
                                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="p-6 text-center text-sm text-gray-500 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex-shrink-0">
                            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>No items selected yet</p>
                            <p className="text-xs mt-1">Select line items to see summary</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Attach Reports */}
                  {step === 3 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-6 h-full flex flex-col"
                    >
                      <div className="flex items-center justify-between flex-shrink-0">
                        <h3 className="text-lg font-semibold">Attach Reports</h3>
                        <Badge variant="outline">{selectedReportIds.length} attached</Badge>
                      </div>
                      <div className="text-sm text-gray-600 mb-4 flex-shrink-0">
                        Select reports to include with this bid package. Subcontractors will receive links to download them.
                      </div>

                      <div className="flex-1 min-h-0 border rounded-md overflow-y-auto p-4 bg-gray-50">
                        {reports.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <FileText className="h-12 w-12 mb-2 opacity-20" />
                            <p>No reports available</p>
                            <p className="text-xs mt-1">Upload reports in the Plans tab first</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {reports.map((report) => {
                              const isSelected = selectedReportIds.includes(report.id)
                              return (
                                <div
                                  key={report.id}
                                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-200'
                                      : 'bg-white border-gray-200 hover:bg-gray-50'
                                  }`}
                                  onClick={() => {
                                    setSelectedReportIds((prev) =>
                                      isSelected
                                        ? prev.filter((id) => id !== report.id)
                                        : [...prev, report.id]
                                    )
                                  }}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => {
                                      setSelectedReportIds((prev) =>
                                        isSelected
                                          ? prev.filter((id) => id !== report.id)
                                          : [...prev, report.id]
                                      )
                                    }}
                                    className="mr-3"
                                  />
                                  <FileText className={`h-5 w-5 mr-3 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                                  <div className="flex-1">
                                    <p className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                      {report.title || report.file_name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(report.created_at).toLocaleDateString()} • {(report.file_size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 mt-4 flex-shrink-0">
                        <Button
                          variant="outline"
                          onClick={() => setStep(2)}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={() => setStep(4)}
                          className="flex-1"
                        >
                          Next
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Subcontractors */}
                  {step === 4 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-6 h-full min-h-0"
                    >
                      {/* Left Pane: Filters, Summary, Controls */}
                      <div className="flex flex-col min-h-0 h-full">
                        <div className="flex items-center justify-between gap-3 flex-shrink-0 mb-4">
                          <h3 className="text-lg font-semibold">Subcontractors</h3>
                          <Badge variant="outline">
                            {selectedSubs.length} selected
                          </Badge>
                        </div>

                        {/* Trade Package Summary - Scrollable */}
                        <div className="flex-1 min-h-0 flex flex-col mb-4">
                          {(selectedTrades.length > 0 || totalSelectedLineItemCount > 0 || selectedSubs.length > 0) ? (
                            <div className="p-3 md:p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col min-h-0 h-full">
                              <div className="flex items-center justify-between gap-3 flex-shrink-0 mb-3">
                                <h4 className="text-sm md:text-base font-semibold text-gray-900 flex items-center gap-2">
                                  <Package className="h-4 w-4 text-orange-600" />
                                  Trade Package Summary
                                </h4>
                              </div>
                              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                {selectedTrades.map(trade => {
                                  const tradeLineItems = lineItemsByTrade[trade] || []
                                  const tradeSubs = selectedSubcontractorsByTrade[trade] || []
                                  return (
                                    <div key={trade} className="p-3 border border-gray-200 bg-white rounded-lg space-y-2">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="font-semibold text-gray-900">{trade}</div>
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                          <Badge variant="outline" className="text-xs">
                                            {tradeLineItems.length} line item{tradeLineItems.length === 1 ? '' : 's'}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs">
                                            {tradeSubs.length} subcontractor{tradeSubs.length === 1 ? '' : 's'}
                                          </Badge>
                                        </div>
                                      </div>
                                      {tradeLineItems.length > 0 ? (
                                        <ul className="text-xs md:text-sm text-gray-700 list-disc pl-4 space-y-1">
                                          {tradeLineItems.map(item => {
                                            const totalCost = item.unit_cost ? item.quantity * item.unit_cost : null
                                            const originalMatchesTrade = normalizeTrade(item.category) === normalizeTrade(trade)
                                            return (
                                              <li key={item.id} className="flex flex-col gap-1">
                                                <span>{item.description}</span>
                                                <span className="text-gray-500">
                                                  ({item.quantity} {item.unit}
                                                  {item.unit_cost ? ` @ $${item.unit_cost}/${item.unit}` : ''}
                                                  )
                                                  {item.subcontractor && item.subcontractor !== trade && (
                                                    <span className="ml-1 text-amber-600">
                                                      Tagged: {item.subcontractor}
                                                    </span>
                                                  )}
                                                  {totalCost !== null && (
                                                    <span className="ml-1 text-green-600 font-medium">
                                                      = ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                  )}
                                                </span>
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      ) : (
                                        <div className="text-xs text-gray-500 italic">
                                          No line items currently mapped to this trade. Select this trade in Step 2 to assign line items.
                                        </div>
                                      )}
                                      {tradeSubs.length > 0 && (
                                        <div className="text-xs text-gray-600">
                                          <span className="font-medium text-gray-700">Recipients:</span>{' '}
                                          {tradeSubs.map(sub => sub.name).join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                {unassignedLineItems.length > 0 && (
                                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs md:text-sm text-amber-900 space-y-1">
                                    <div className="font-semibold">Line items without a matching selected trade</div>
                                    <p>
                                      These items will not be included in any bid package unless you add a trade that matches their category:
                                    </p>
                                    <ul className="list-disc pl-4 space-y-1">
                                      {unassignedLineItems.map(item => (
                                        <li key={item.id}>
                                          {item.description}{' '}
                                          {item.subcontractor && (
                                            <span className="text-amber-700">
                                              (Tagged: {item.subcontractor})
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 md:p-4 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center h-full">
                              <div className="text-center text-sm text-gray-500">
                                <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                <p>No trades or line items selected yet</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Filters & directory toggles - Scrollable section */}
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 mb-4">
                          <div className="p-3 border rounded-lg space-y-2">
                            <h4 className="font-semibold text-xs md:text-sm">Directories</h4>
                            <label className="flex items-center space-x-2">
                              <Checkbox checked={includeMyContacts} onCheckedChange={(v: boolean) => setIncludeMyContacts(v)} />
                              <span className="text-sm">My Contacts</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <Checkbox checked={includeBidiDirectory} onCheckedChange={(v: boolean) => setIncludeBidiDirectory(v)} />
                              <span className="text-sm">Bidi Directory</span>
                            </label>
                          </div>
                          <div className="p-3 border rounded-lg space-y-2">
                            <h4 className="font-semibold text-xs md:text-sm">Filters</h4>
                            <div className="space-y-2">
                              <div>
                                <div className="text-xs text-gray-600 mb-1">Min Google rating</div>
                                <div className="flex items-center space-x-1">
                                  {[1,2,3,4,5].map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setMinGoogleReview(String(n))}
                                      className="p-1 rounded hover:bg-gray-100"
                                      aria-label={`Minimum ${n} star${n>1 ? 's' : ''}`}
                                    >
                                      <Star className={(Number(minGoogleReview) >= n ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300') + ' h-5 w-5'} />
                                    </button>
                                  ))}
                                  <Button variant="ghost" size="sm" onClick={() => setMinGoogleReview('')}>Clear</Button>
                                </div>
                              </div>
                              <Input placeholder="Min jobs completed" value={minJobsCompleted} onChange={(e) => setMinJobsCompleted(e.target.value)} />
                            </div>
                            <div className="flex items-center space-x-4">
                              <label className="flex items-center space-x-2">
                                <Checkbox checked={licensedOnly} onCheckedChange={(v: boolean) => setLicensedOnly(v)} />
                                <span className="text-sm">Licensed only</span>
                              </label>
                              <label className="flex items-center space-x-2">
                                <Checkbox checked={bondedOnly} onCheckedChange={(v: boolean) => setBondedOnly(v)} />
                                <span className="text-sm">Bonded only</span>
                              </label>
                            </div>
                          </div>

                          {/* Add Contact */}
                          <div className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <h4 className="font-semibold text-xs md:text-sm">Add Contact</h4>
                              <Button variant="outline" size="sm" onClick={() => setShowAddContact(s => !s)} className="h-8 md:h-9">
                                {showAddContact ? 'Close' : 'Add'}
                              </Button>
                            </div>
                            {showAddContact && (
                              <div className="mt-2 md:mt-3 grid grid-cols-1 gap-2">
                                <Input placeholder="Name" value={newContact.name} onChange={(e) => setNewContact(v => ({ ...v, name: e.target.value }))} />
                                <Input placeholder="Email" value={newContact.email} onChange={(e) => setNewContact(v => ({ ...v, email: e.target.value }))} />
                                <Select value={newContact.trade_category} onValueChange={(val) => setNewContact(v => ({ ...v, trade_category: val }))}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Trade" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TRADE_CATEGORIES.map(t => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input placeholder="Location" value={newContact.location} onChange={(e) => setNewContact(v => ({ ...v, location: e.target.value }))} />
                                <div className="flex justify-end">
                                  <Button
                                    variant="secondary"
                                    onClick={async () => {
                                      if (!newContact.name || !newContact.email || !newContact.trade_category) return
                                      const { data, error: insErr } = await supabase
                                        .from('gc_contacts')
                                        .insert([{ name: newContact.name, email: newContact.email, trade_category: newContact.trade_category, location: newContact.location, gc_id: user?.id }])
                                        .select()
                                      if (insErr) {
                                        setError(insErr.message)
                                        return
                                      }
                                      const created = (data?.[0])
                                      if (created) {
                                        const sc: Subcontractor = {
                                          id: `gc:${created.id}`,
                                          name: created.name,
                                          email: created.email,
                                          trade_category: created.trade_category,
                                          location: created.location,
                                          source: 'gc'
                                        }
                                        setSubcontractors(prev => [sc, ...prev])
                                        setShowAddContact(false)
                                        setNewContact({ name: '', email: '', trade_category: '', location: '' })
                                      }
                                    }}
                                  >Save</Button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Package Description & Deadline */}
                          <div className="space-y-3 pt-2 border-t">
                            <div className="p-3 border rounded-lg space-y-2 bg-blue-50 border-blue-200">
                              <Label className="text-sm font-semibold">Package Description</Label>
                              <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the scope of work, requirements, and any special instructions for the subcontractors..."
                                rows={4}
                                className="resize-none"
                              />
                              <p className="text-xs text-gray-500">
                                This description will be included in the bid request email sent to selected subcontractors.
                              </p>
                            </div>

                            <div className="p-3 border rounded-lg space-y-2 bg-blue-50 border-blue-200">
                              <Label className="text-sm font-semibold">Bid Deadline</Label>
                              <Input
                                type="datetime-local"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                              />
                              <p className="text-xs text-gray-500">
                                Set a deadline for when subcontractors should submit their bids.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons - Fixed at bottom */}
                        <div className="flex flex-col gap-2 pt-2 border-t flex-shrink-0">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (filteredSubcontractors.length === 0) return
                                const current = new Set(selectedSubs)
                                for (const sub of filteredSubcontractors) current.add(sub.id)
                                setSelectedSubs(Array.from(current))
                              }}
                              disabled={filteredSubcontractors.length === 0}
                              className="flex-1"
                            >
                              Select all
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (filteredSubcontractors.length === 0) return
                                const toRemove = new Set(filteredSubcontractors.map(s => s.id))
                                setSelectedSubs(prev => prev.filter(id => !toRemove.has(id)))
                              }}
                              disabled={filteredSubcontractors.length === 0}
                              className="flex-1"
                            >
                              Clear
                            </Button>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setStep(3)}
                              className="flex-1 h-10 md:h-auto"
                            >
                              Back
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setPreviewOpen(true)}
                              disabled={!canCreatePackage || loading}
                              className="flex-1 h-10 md:h-auto"
                            >
                              Preview
                            </Button>
                            <Button 
                              onClick={handleCreatePackage}
                              disabled={!canCreatePackage || loading}
                              className="flex-1 h-10 md:h-auto"
                            >
                              {loading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-2" />
                                  Create & Send
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Right Pane: Subcontractor List */}
                      <div className="flex flex-col min-h-0 h-full">
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                          {filteredSubcontractors.length === 0 ? (
                            <div className="text-center py-8">
                              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                              <h4 className="font-semibold text-gray-900 mb-2">No subcontractors found</h4>
                              <p className="text-sm text-gray-600 mb-4">
                                No subcontractors found for selected trades. Add contacts first.
                              </p>
                              <Button variant="outline">
                                Add Contacts
                              </Button>
                            </div>
                          ) : (
                            filteredSubcontractors.map((sub) => (
                              <motion.div
                                key={sub.id}
                                variants={staggerItem}
                                className={`p-4 border-2 rounded-lg transition-all ${
                                  selectedSubs.includes(sub.id)
                                    ? 'bg-orange-50 border-orange-400 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={selectedSubs.includes(sub.id)}
                                    onCheckedChange={(checked: boolean) => {
                                      if (checked) {
                                        setSelectedSubs(prev => [...prev, sub.id])
                                      } else {
                                        setSelectedSubs(prev => prev.filter(id => id !== sub.id))
                                      }
                                    }}
                                    className="mt-1"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                          className="h-10 w-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold shrink-0"
                                          aria-label={(sub.name || '').trim() ? `Avatar for ${sub.name}` : 'Avatar'}
                                          title={sub.name || ''}
                                        >
                                          {(sub.name || '').trim().charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium truncate">
                                            {sub.website_url ? (
                                              <a
                                                href={sub.website_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:underline"
                                              >
                                                {sub.name}
                                              </a>
                                            ) : (
                                              sub.name
                                            )}
                                          </div>
                                          <div className="mt-1 text-sm text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                                            {sub.email && (
                                              <a
                                                href={`mailto:${sub.email}`}
                                                className="truncate hover:underline"
                                                title={sub.email}
                                              >
                                                {sub.email}
                                              </a>
                                            )}
                                            {sub.location && (
                                              <span className="inline-flex items-center gap-1 truncate">
                                                <MapPin className="h-3 w-3" /> {sub.location}
                                              </span>
                                            )}
                                            {sub.phone && (
                                              <span className="truncate" title={sub.phone}>{sub.phone}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                                          {sub.trade_category}
                                        </Badge>
                                        {sub.website_url && (
                                          <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                                            <a href={sub.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                                              <Globe className="h-3 w-3" />
                                              Website
                                            </a>
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    {sub.source === 'bidi' && (
                                      <div className="flex flex-wrap items-center gap-2 mt-2">
                                        {(() => {
                                          const rating = (sub as any).google_review_score
                                          return (typeof rating === 'number' && rating > 0) ? (
                                            <Badge variant="outline" className="text-xs">
                                              <Star className="h-3 w-3 mr-1 text-yellow-400 fill-yellow-400" /> {rating.toFixed(1)}
                                            </Badge>
                                          ) : null
                                        })()}
                                        {typeof sub.jobs_completed === 'number' && (
                                          <Badge variant="outline" className="text-xs">
                                            {sub.jobs_completed} jobs
                                          </Badge>
                                        )}
                                        {sub.licensed && <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">Licensed</Badge>}
                                        {sub.bonded && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">Bonded</Badge>}
                                      </div>
                                    )}
                                    {(() => {
                                      const tradeKey = normalizeTrade(sub.trade_category)
                                      const canonicalTrade = canonicalTradeByNormalized[tradeKey]
                                      const itemsForSub = canonicalTrade ? lineItemsByTrade[canonicalTrade] || [] : []
                                      return itemsForSub.length > 0 ? (
                                        <div className="mt-2 text-xs text-gray-500">
                                          <span className="font-semibold text-gray-600">Assigned line items:</span>{' '}
                                          {itemsForSub.map(item => item.description).join(', ')}
                                        </div>
                                      ) : null
                                    })()}
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </div>
                      {previewOpen && (
                        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
                          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewOpen(false)} />
                          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold">Preview Bid Package</h3>
                              <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>×</Button>
                            </div>

                            <div className="space-y-6">
                              {selectedTrades.map((trade) => {
                                const recipients = selectedSubcontractorsByTrade[trade] ?? []
                                const assignedIds = selectedTradeLineItems[trade] ?? []
                                const lineItems = assignedIds
                                  .map(id => takeoffItemById[id])
                                  .filter((item): item is TakeoffItem => Boolean(item))
                                const subject = `${job?.name || 'Project'} - Bid Request: ${trade}`
                                const prettyDeadline = deadline ? new Date(deadline).toLocaleString() : 'No deadline set'
                                const attachments = [
                                  `Project Plan - ${job?.name || 'Project'} (Plan ID: ${planId}) - Link included`,
                                  ...reports
                                    .filter(r => selectedReportIds.includes(r.id))
                                    .map(r => `Report: ${r.title || r.file_name} - Link included`)
                                ]
                                return (
                                  <div key={trade} className="p-4 border rounded-lg space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-semibold">{trade}</h4>
                                      <Badge variant="outline">{recipients.length} recipient{recipients.length === 1 ? '' : 's'}</Badge>
                                    </div>
                                    <div className="text-sm">
                                      <div className="mb-2"><span className="font-medium">To:</span> {recipients.map(r => r.email).join(', ') || '—'}</div>
                                      <div className="mb-2"><span className="font-medium">Subject:</span> {subject}</div>
                                      <div className="mb-2">
                                        <span className="font-medium">Body:</span>
                                        <div className="mt-1 whitespace-pre-wrap border rounded-md p-3 bg-gray-50">
{`${description || ''}

Project: ${job?.name || ''}
Location: ${job?.location || ''}
Trade: ${trade}
Deadline: ${prettyDeadline}

Minimum required line items:
${lineItems.length > 0 ? lineItems.map(li => `- ${li.description} (${li.quantity} ${li.unit}${li.unit_cost ? ` @ $${li.unit_cost}/${li.unit}` : ''})`).join('\n') : '- (none selected)' }

View Plans: [Link to Download Plans]

Please reply with your bid and any questions.

Thank you,`}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="font-medium">Included Links:</span>
                                        <ul className="list-disc pl-5 mt-1">
                                          {attachments.map(a => (
                                            <li key={a} className="text-sm">{a}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <div className="mt-6 flex gap-3">
                              <Button variant="outline" className="flex-1" onClick={() => setPreviewOpen(false)}>Close</Button>
                              <Button className="flex-1" disabled={!canCreatePackage || loading} onClick={() => { setPreviewOpen(false); handleCreatePackage(); }}>
                                {loading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Now
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Step 5: Email Status & Responses */}
                  {step === 5 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Email Status & Responses</h3>
                        <Badge variant="outline">
                          {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {loadingRecipients ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                          <span>Loading email statuses...</span>
                        </div>
                      ) : recipients.length === 0 ? (
                        <div className="text-center py-8">
                          <Mail className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                          <p className="text-gray-600">No recipients found. Emails may still be sending.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {createdPackages.map(pkg => {
                            const packageRecipients = recipients.filter(r => r.bid_package_id === pkg.id)
                            const clarifyingQuestionsRecipients = packageRecipients.filter(r => r.has_clarifying_questions)
                            
                            return (
                              <Card key={pkg.id} className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-semibold">{pkg.trade_category}</h4>
                                  <Badge variant="outline">{packageRecipients.length} sent</Badge>
                                </div>
                                
                                <div className="space-y-3">
                                  {packageRecipients.map((recipient: any) => {
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
                                      <div key={recipient.id} className="flex items-start justify-between p-3 border rounded-lg">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium">{recipient.subcontractor_name || recipient.subcontractor_email}</span>
                                            <Badge className={statusColors[recipient.status] || 'bg-gray-100 text-gray-800'}>
                                              {recipient.status}
                                            </Badge>
                                            {recipient.has_clarifying_questions && (
                                              <Badge variant="destructive" className="text-xs">
                                                Has Questions
                                              </Badge>
                                            )}
                                            {recipient.bids && recipient.bids.length > 0 && (
                                              <Badge variant="default" className="text-xs">
                                                Bid Received
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {recipient.subcontractor_email}
                                          </div>
                                          {recipient.response_text && (
                                            <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                              <strong>Response:</strong> {recipient.response_text.substring(0, 200)}
                                              {recipient.response_text.length > 200 && '...'}
                                            </div>
                                          )}
                                          {recipient.clarifying_questions && recipient.clarifying_questions.length > 0 && (
                                            <div className="mt-2 text-sm">
                                              <strong className="text-orange-600">Questions:</strong>
                                              <ul className="list-disc pl-5 mt-1">
                                                {recipient.clarifying_questions.map((q: string, idx: number) => (
                                                  <li key={idx} className="text-gray-700">{q}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-2 ml-4">
                                          {recipient.has_clarifying_questions && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                // TODO: Open response modal
                                                setError('Response feature coming soon')
                                              }}
                                            >
                                              Respond
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </Card>
                            )
                          })}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setStep(4)}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleClose}
                          className="flex-1"
                        >
                          Done
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                        <p className="text-red-600 text-sm">{error}</p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center space-y-6"
                >
                  <motion.div
                    variants={successCheck}
                    initial="initial"
                    animate="animate"
                  >
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Bid Package{selectedTrades.length > 1 ? 's' : ''} Created!</h3>
                    <p className="text-gray-600">
                      {selectedTrades.length} package{selectedTrades.length !== 1 ? 's' : ''} sent to {selectedSubs.length} subcontractor{selectedSubs.length !== 1 ? 's' : ''}
                    </p>
                  </motion.div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
                    <ul className="text-sm text-blue-800 space-y-1 text-left">
                      <li>• Subcontractors will receive email with project details</li>
                      <li>• They can reply with their bids</li>
                      <li>• Bids will appear in your job dashboard</li>
                      <li>• You can compare and accept the best bid</li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

