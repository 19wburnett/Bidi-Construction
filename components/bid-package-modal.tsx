'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Globe
} from 'lucide-react'
import { modalBackdrop, modalContent, successCheck, staggerContainer, staggerItem } from '@/lib/animations'
import { BidPackage, Job } from '@/types/takeoff'

const normalizeTrade = (trade?: string | null) => (trade || '').trim().toLowerCase()

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

const TRADE_CATEGORIES = [
  // Trimmed core categories (keep names aligned with existing data)
  'Earthwork & Excavation',
  'Concrete',
  'Masonry',
  'Structural Steel',
  'Carpentry',
  'Roofing',
  'Windows & Doors',
  'Siding',
  'Drywall',
  'Insulation',
  'Flooring',
  'Painting',
  'Millwork & Casework',
  'HVAC',
  'Plumbing',
  'Electrical'
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
  
  const { user } = useAuth()
  const supabase = createClient()

  const [newItem, setNewItem] = useState<{ description: string; quantity: string; unit: string; unit_cost: string }>({
    description: '',
    quantity: '',
    unit: '',
    unit_cost: ''
  })

  // Keep custom trade in sync with selected trades
  useEffect(() => {
    const trimmed = customTrade.trim()
    if (otherSelected && trimmed) {
      setSelectedTrades(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    } else if ((!otherSelected || !trimmed) && selectedTrades.length > 0) {
      setSelectedTrades(prev => prev.filter(t => t !== trimmed))
    }
  }, [otherSelected, customTrade])

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
    }
  }, [isOpen, jobId])

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

      // Send emails to selected subcontractors (grouped per trade)
      if (selectedSubs.length > 0) {
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
        console.log('Would send emails grouped by trade:', byTrade)
      }

      setSuccess(true)
      if (Array.isArray(data)) {
        data.forEach(pkg => onPackageCreated?.(pkg))
      }

      // Auto-close after success animation
      setTimeout(() => {
        handleClose()
      }, 2000)

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
    onClose()
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
    if (!activeTrade) return visibleTakeoffItems
    const normalized = normalizeTrade(activeTrade)
    const assignedIds = new Set(selectedTradeLineItems[activeTrade] ?? [])

    const prioritized: TakeoffItem[] = []
    const remaining: TakeoffItem[] = []

    for (const item of visibleTakeoffItems) {
      const matchesTrade = normalized && normalizeTrade(item.category) === normalized
      if (matchesTrade || assignedIds.has(item.id)) {
        prioritized.push(item)
      } else {
        remaining.push(item)
      }
    }

    return [...prioritized, ...remaining]
  }, [activeTrade, visibleTakeoffItems, selectedTradeLineItems])
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
        className="bg-white rounded-lg shadow-xl w-[80vw] max-w-6xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="border-0 shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
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
          </CardHeader>
          
          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {!success ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
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
                      className="space-y-6"
                    >
                  <motion.div variants={staggerItem} className="space-y-3">
                        <Label>Trade Categories *</Label>
                        <Input
                          placeholder="Search trades (e.g., Electrical, Roofing, Fire Alarm)"
                          value={tradeSearch}
                          onChange={(e) => setTradeSearch(e.target.value)}
                        />
                        <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                          {TRADE_CATEGORIES.filter(trade => trade.toLowerCase().includes(tradeSearch.toLowerCase())).map((trade) => (
                            <label key={trade} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-gray-50">
                              <Checkbox
                                checked={selectedTrades.includes(trade)}
                                onCheckedChange={(checked: boolean) => {
                                  setSelectedTrades(prev => checked ? [...prev, trade] : prev.filter(t => t !== trade))
                                }}
                              />
                              <span className="text-sm">{trade}</span>
                            </label>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <Checkbox
                              checked={otherSelected}
                              onCheckedChange={(checked: boolean) => setOtherSelected(checked)}
                            />
                            <span className="text-sm">Other</span>
                          </label>
                          {otherSelected && (
                            <Input
                              placeholder="Type a custom trade (e.g., Geotechnical, Pool Contractor)"
                              value={customTrade}
                              onChange={(e) => setCustomTrade(e.target.value)}
                            />
                          )}
                        </div>
                  </motion.div>

                      <motion.div variants={staggerItem} className="space-y-3">
                        <Label>Package Description</Label>
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe the scope of work, requirements, and any special instructions..."
                          rows={4}
                        />
                      </motion.div>

                      <motion.div variants={staggerItem} className="space-y-3">
                        <Label>Bid Deadline</Label>
                        <Input
                          type="datetime-local"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      </motion.div>

                      <motion.div variants={staggerItem}>
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
                      className="space-y-4 md:space-y-6"
                    >
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

                      <Input
                        placeholder="Search line items..."
                        value={lineItemSearch}
                        onChange={(e) => setLineItemSearch(e.target.value)}
                        disabled={!activeTrade}
                      />

                      <div className="space-y-2 md:space-y-3 max-h-64 overflow-y-auto">
                        {activeTrade ? (
                          lineItemsForActiveTrade.map((item) => {
                            const assignedTrade = tradeAssignmentByItemId[item.id]
                            const isSelected = assignedTrade === activeTrade
                            const isAssignedElsewhere = assignedTrade && assignedTrade !== activeTrade
                            const totalCost = item.unit_cost ? (item.quantity * item.unit_cost) : null
                            return (
                              <motion.div
                                key={item.id}
                                variants={staggerItem}
                                className={`flex flex-col md:flex-row md:items-center md:space-x-3 p-3 border rounded-lg transition-colors ${
                                  isSelected
                                    ? 'bg-orange-50 border-orange-300'
                                    : isAssignedElsewhere
                                      ? 'bg-gray-50 border-gray-300'
                                      : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start md:items-center gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                      handleToggleLineItemSelection(activeTrade, item.id, checked === true)
                                    }
                                  />
                                  <div className="flex-1">
                                    <div className="font-medium">{item.description}</div>
                                    <div className="text-sm text-gray-600">
                                      {item.quantity} {item.unit}
                                      {item.unit_cost && ` • $${item.unit_cost.toFixed(2)}/${item.unit}`}
                                    </div>
                                    {totalCost !== null && (
                                      <div className="text-sm font-semibold text-green-600 mt-1">
                                        Total: ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-3 md:mt-0 md:justify-end gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {item.category || 'Uncategorized'}
                                  </Badge>
                                  {isAssignedElsewhere && (
                                    <Badge variant="secondary" className="text-[11px] text-gray-700 bg-gray-200">
                                      Assigned to {assignedTrade}
                                    </Badge>
                                  )}
                                </div>
                              </motion.div>
                            )
                          })
                        ) : (
                          <div className="p-6 text-center text-sm text-gray-500 border rounded-lg">
                            Select a trade to view available line items.
                          </div>
                        )}

                        {activeTrade && lineItemsForActiveTrade.length === 0 && (
                          <div className="p-6 text-center text-sm text-gray-500 border rounded-lg">
                            No line items match your search for this trade.
                          </div>
                        )}
                      </div>

                      {/* Selected Items Summary */}
                      {totalSelectedLineItemCount > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                            <FileText className="h-4 w-4 mr-2" />
                            Selected Items Summary ({totalSelectedLineItemCount})
                          </h4>
                          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                            {selectedTrades.map(trade => {
                              const items = lineItemsByTrade[trade] ?? []
                              if (items.length === 0) return null
                              return (
                                <div key={trade} className="bg-white border border-blue-100 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-xs">{trade}</Badge>
                                    <span className="text-xs text-gray-500">{items.length} item{items.length === 1 ? '' : 's'}</span>
                                  </div>
                                  <ul className="space-y-2">
                                    {items.map(item => {
                                      const totalCost = item.unit_cost ? item.quantity * item.unit_cost : null
                                      const originalMatchesTrade = normalizeTrade(item.category) === normalizeTrade(trade)
                                      return (
                                        <li key={item.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                          <div>
                                            <div className="font-medium text-sm">{item.description}</div>
                                            <div className="text-xs text-gray-600">
                                              <span className="font-mono">{item.quantity} {item.unit}</span>
                                              {item.unit_cost && (
                                                <>
                                                  {' × '}
                                                  <span className="font-mono">${item.unit_cost.toFixed(2)}</span>
                                                  {'/'}{item.unit}
                                                </>
                                              )}
                                              {!originalMatchesTrade && (
                                                <span className="ml-2 text-amber-600">
                                                  Source category: {item.category || 'Uncategorized'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {totalCost !== null && (
                                            <div className="text-right text-xs md:text-sm font-semibold text-green-600">
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
                          <div className="mt-3 pt-3 border-t border-blue-300 flex items-center justify-between">
                            <span className="font-semibold text-blue-900">Grand Total:</span>
                            <span className="text-xl font-bold text-green-600">
                              $
                              {selectedLineItems
                                .reduce((sum, item) => {
                                  const totalCost = item.unit_cost ? (item.quantity * item.unit_cost) : 0
                                  return sum + totalCost
                                }, 0)
                                .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </motion.div>
                      )}

                      {/* Add custom line item */}
                      <div className="p-2 md:p-3 border rounded-lg space-y-2 md:space-y-3">
                        <h4 className="font-semibold text-xs md:text-sm">Add Custom Line Item</h4>
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

                      <div className="flex flex-col sm:flex-row gap-2 md:space-x-3">
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
                    </motion.div>
                  )}

                  {/* Step 3: Subcontractors */}
                  {step === 3 && (
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold">Subcontractors</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {selectedSubs.length} selected
                          </Badge>
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
                          >
                            Select all (filtered)
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
                          >
                            Clear filtered
                          </Button>
                        </div>
                      </div>

                      {(selectedTrades.length > 0 || totalSelectedLineItemCount > 0 || selectedSubs.length > 0) && (
                        <div className="p-3 md:p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm md:text-base font-semibold text-gray-900 flex items-center gap-2">
                              <Package className="h-4 w-4 text-orange-600" />
                              Trade Package Summary
                            </h4>
                            <span className="text-xs text-gray-500">
                              Line items are grouped by their assigned trade.
                            </span>
                          </div>
                          <div className="space-y-3">
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
                                              {!originalMatchesTrade && (
                                                <span className="ml-1 text-amber-600">
                                                  Source category: {item.category || 'Uncategorized'}
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
                                      <span className="text-amber-700">
                                        ({item.category || 'Uncategorized'})
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Filters & directory toggles */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                        <div className="p-2 md:p-3 border rounded-lg space-y-2">
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
                        <div className="p-2 md:p-3 border rounded-lg space-y-2">
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
                      </div>

                      {/* Add Contact (personal) */}
                      <div className="p-2 md:p-3 border rounded-lg">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="font-semibold text-xs md:text-sm">Add Contact (My Contacts)</h4>
                          <Button variant="outline" size="sm" onClick={() => setShowAddContact(s => !s)} className="h-8 md:h-9">
                            {showAddContact ? 'Close' : 'Add'}
                          </Button>
                        </div>
                        {showAddContact && (
                          <div className="mt-2 md:mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
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
                            <div className="md:col-span-4 flex justify-end">
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

                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {filteredSubcontractors.map((sub) => (
                          <motion.div
                            key={sub.id}
                            variants={staggerItem}
                            className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                          >
                            <Checkbox
                              checked={selectedSubs.includes(sub.id)}
                              onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                  setSelectedSubs(prev => [...prev, sub.id])
                                } else {
                                  setSelectedSubs(prev => prev.filter(id => id !== sub.id))
                                }
                              }}
                            />
                            <div
                              className="h-9 w-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold shrink-0"
                              aria-label={(sub.name || '').trim() ? `Avatar for ${sub.name}` : 'Avatar'}
                              title={sub.name || ''}
                            >
                              {(sub.name || '').trim().charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-3">
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
                                <Badge variant="outline" className="text-xs whitespace-nowrap">
                                  {sub.trade_category}
                                </Badge>
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
                                {sub.source === 'bidi' && (
                                  <>
                                    {(() => {
                                      const rating = Number((sub as any).google_review_score)
                                      return !isNaN(rating) ? (
                                        <span className="inline-flex items-center gap-1">
                                          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" /> {rating.toFixed(1)}
                                        </span>
                                      ) : null
                                    })()}
                                    {typeof sub.jobs_completed === 'number' && (
                                      <span>{sub.jobs_completed} jobs</span>
                                    )}
                                    {sub.licensed && <span>Licensed</span>}
                                    {sub.bonded && <span>Bonded</span>}
                                  </>
                                )}
                              </div>
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
                            {sub.website_url && (
                              <Button asChild variant="secondary" size="sm">
                                <a href={sub.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                                  <Globe className="h-4 w-4 mr-1" /> Website
                                </a>
                              </Button>
                            )}
                          </motion.div>
                        ))}
                      </div>

                      {filteredSubcontractors.length === 0 && (
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
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 md:space-x-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setStep(2)}
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
                          Preview Email
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
                              Create & Send Package
                            </>
                          )}
                        </Button>
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
                                  `Project Plan - ${job?.name || 'Project'} (Plan ID: ${planId})`,
                                  `Bid Package - ${trade} (PDF)`
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

Please reply with your bid and any questions.

Thank you,`}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="font-medium">Attachments:</span>
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

