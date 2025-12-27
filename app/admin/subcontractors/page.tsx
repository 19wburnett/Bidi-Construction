'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Users,
  MapPin,
  Mail,
  Phone,
  Briefcase,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  ArrowUpDown,
  Filter,
  Calendar,
  Sparkles,
  Eye,
  Image as ImageIcon
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import NotificationBell from '@/components/notification-bell'
import ProfileDropdown from '@/components/profile-dropdown'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import SubcontractorPhotoManager from '@/components/subcontractor-photo-manager'
import ProfilePictureUpload from '@/components/profile-picture-upload'

import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'

type SortKey = 'created_at' | 'name' | 'trade_category' | 'location'
type SortDirection = 'asc' | 'desc'
type CheckboxState = boolean | 'indeterminate'

interface Subcontractor {
  id: string
  email: string
  name: string
  trade_category: string
  location: string
  created_at: string
  phone: string | null
  website_url: string | null
  google_review_score: number | null
  google_reviews_link: string | null
  time_in_business: string | null
  jobs_completed: number | null
  references: unknown
  licensed: boolean | null
  bonded: boolean | null
  notes: string | null
  profile_picture_url: string | null
}

interface FormState {
  name: string
  email: string
  trade_category: string
  location: string
  phone: string
  website_url: string
  google_review_score: string
  google_reviews_link: string
  time_in_business: string
  jobs_completed: string
  references: string
  licensed: string
  bonded: string
  notes: string
  profile_picture_url: string
}

const TRADE_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Roofing',
  'Flooring',
  'Painting',
  'Drywall',
  'Carpentry',
  'Concrete',
  'Landscaping',
  'Excavation',
  'Insulation',
  'Windows & Doors',
  'Siding',
  'General Construction',
  'Renovation',
  'Other'
]

type EditableField =
  | 'name'
  | 'email'
  | 'phone'
  | 'trade_category'
  | 'location'
  | 'website_url'
  | 'google_review_score'
  | 'google_reviews_link'
  | 'time_in_business'
  | 'jobs_completed'
  | 'licensed'
  | 'bonded'
  | 'notes'
  | 'references'

const editableFieldOrder: EditableField[] = [
  'name',
  'email',
  'phone',
  'trade_category',
  'location',
  'website_url',
  'google_review_score',
  'google_reviews_link',
  'time_in_business',
  'jobs_completed',
  'licensed',
  'bonded',
  'notes',
  'references'
]

const requiredInlineFields: EditableField[] = ['name', 'email', 'trade_category', 'location']

const NEW_ROW_PREFIX = 'temp-'

export default function AdminSubcontractorCRMPage() {
  const supabase = createClient()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [isAdmin, setIsAdmin] = useState(false)
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true)
  const [tableLoading, setTableLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [tradeFilter, setTradeFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tradeSearchTerm, setTradeSearchTerm] = useState('')

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'created_at',
    direction: 'desc'
  })

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [activeSubcontractorId, setActiveSubcontractorId] = useState<string | null>(null)
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [photoManagerSubcontractorId, setPhotoManagerSubcontractorId] = useState<string | null>(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [formState, setFormState] = useState<FormState>({
    name: '',
    email: '',
    trade_category: '',
    location: '',
    phone: '',
    website_url: '',
    google_review_score: '',
    google_reviews_link: '',
    time_in_business: '',
    jobs_completed: '',
    references: '',
    licensed: 'unknown',
    bonded: 'unknown',
    notes: '',
    profile_picture_url: ''
  })

  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({})
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditableField } | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, Partial<Record<EditableField, string>>>>({})
  const filteredSubcontractorsRef = useRef<Subcontractor[]>([])

  const initialFormState: FormState = {
    name: '',
    email: '',
    trade_category: '',
    location: '',
    phone: '',
    website_url: '',
    google_review_score: '',
    google_reviews_link: '',
    time_in_business: '',
    jobs_completed: '',
    references: '',
    licensed: 'unknown',
    bonded: 'unknown',
    notes: '',
    profile_picture_url: ''
  }

  const knownTradeCategories = useMemo(() => {
    const categories = new Set<string>()
    TRADE_CATEGORIES.forEach((trade) => categories.add(trade))
    subcontractors.forEach((sub) => {
      const trade = sub.trade_category?.trim()
      if (trade) {
        categories.add(trade)
      }
    })
    return Array.from(categories).sort((a, b) => a.localeCompare(b))
  }, [subcontractors])

  const resetMessages = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  const checkAdminStatus = useCallback(async () => {
    if (!user) {
      setIsAdmin(false)
      setIsCheckingAdmin(false)
      return
    }

    try {
      const { data, error: adminError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (adminError) {
        console.error('Error checking admin status:', adminError)
        setError('Unable to confirm admin access.')
        setIsAdmin(false)
      } else {
        setIsAdmin(Boolean(data?.is_admin))
        if (!data?.is_admin) {
          router.push('/dashboard')
        }
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
      setError('Unable to confirm admin access.')
      setIsAdmin(false)
    } finally {
      setIsCheckingAdmin(false)
    }
  }, [router, supabase, user])

  const fetchSubcontractors = useCallback(async () => {
    try {
      setTableLoading(true)
      resetMessages()

      const { data, error: fetchError } = await supabase
        .from('subcontractors')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Failed to fetch subcontractors:', fetchError)
        setError('Failed to fetch subcontractors.')
        return
      }

      setSubcontractors(data ?? [])
    } catch (err) {
      console.error('Unexpected error fetching subcontractors', err)
      setError('Unexpected error fetching subcontractors.')
    } finally {
      setTableLoading(false)
    }
  }, [resetMessages, supabase])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    checkAdminStatus()
  }, [authLoading, checkAdminStatus, router, user])

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchSubcontractors()
    }
  }, [authLoading, fetchSubcontractors, isAdmin])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => subcontractors.some((sub) => sub.id === id)))
  }, [subcontractors])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => subcontractors.some((sub) => sub.id === id)))
  }, [subcontractors])

  const openEditDialog = (record: Subcontractor) => {
    resetMessages()
    setDialogMode('edit')
    setActiveSubcontractorId(record.id)
    setFormState({
      name: record.name ?? '',
      email: record.email ?? '',
      trade_category: record.trade_category ?? '',
      location: record.location ?? '',
      phone: record.phone ?? '',
      website_url: record.website_url ?? '',
      google_review_score:
        record.google_review_score !== null && record.google_review_score !== undefined
          ? String(record.google_review_score)
          : '',
      google_reviews_link: record.google_reviews_link ?? '',
      time_in_business: record.time_in_business ?? '',
      jobs_completed:
        record.jobs_completed !== null && record.jobs_completed !== undefined ? String(record.jobs_completed) : '',
      references: record.references ? JSON.stringify(record.references, null, 2) : '',
      licensed:
        record.licensed === null || record.licensed === undefined
          ? 'unknown'
          : record.licensed
          ? 'true'
          : 'false',
      bonded:
        record.bonded === null || record.bonded === undefined
          ? 'unknown'
          : record.bonded
          ? 'true'
          : 'false',
      notes: record.notes ?? '',
      profile_picture_url: record.profile_picture_url ?? ''
    })
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setIsSaving(false)
    setActiveSubcontractorId(null)
    setFormState(initialFormState)
  }

  const handleFormChange = (field: keyof FormState, value: string) => {
    console.log(`Form field changed: ${field} = ${value}`)
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()
    console.log('Form submitted, current formState:', formState)

    if (!formState.name || !formState.email || !formState.trade_category || !formState.location) {
      setError('Please provide name, email, trade, and location.')
      return
    }

    let reviewScore: number | null = null
    if (formState.google_review_score.trim()) {
      reviewScore = Number(formState.google_review_score.trim())
      if (Number.isNaN(reviewScore)) {
        setError('Google review score must be a number.')
        return
      }
    }

    let jobsCompleted: number | null = null
    if (formState.jobs_completed.trim()) {
      jobsCompleted = Number(formState.jobs_completed.trim())
      if (Number.isNaN(jobsCompleted)) {
        setError('Jobs completed must be a number.')
        return
      }
    }

    let parsedReferences: unknown = null
    if (formState.references.trim()) {
      try {
        parsedReferences = JSON.parse(formState.references.trim())
      } catch (parseError) {
        console.error('Invalid references JSON', parseError)
        setError('References must be valid JSON (array or object).')
        return
      }
    }

    const payload: Record<string, any> = {
      name: formState.name.trim(),
      email: formState.email.trim().toLowerCase(),
      trade_category: formState.trade_category,
      location: formState.location.trim(),
      phone: formState.phone.trim() || null,
      website_url: formState.website_url.trim() || null,
      google_review_score: reviewScore,
      google_reviews_link: formState.google_reviews_link.trim() || null,
      time_in_business: formState.time_in_business.trim() || null,
      jobs_completed: jobsCompleted,
      references: parsedReferences,
      licensed:
        formState.licensed === 'unknown'
          ? null
          : formState.licensed === 'true'
          ? true
          : formState.licensed === 'false'
          ? false
          : null,
      bonded:
        formState.bonded === 'unknown'
          ? null
          : formState.bonded === 'true'
          ? true
          : formState.bonded === 'false'
          ? false
          : null,
      notes: formState.notes.trim() || null,
    }
    
    // Only include profile_picture_url if it has a value
    if (formState.profile_picture_url && formState.profile_picture_url.trim()) {
      payload.profile_picture_url = formState.profile_picture_url.trim()
    } else {
      payload.profile_picture_url = null
    }
    
    console.log('Form submission payload:', payload)
    console.log('profile_picture_url in payload:', payload.profile_picture_url)
    console.log('Current formState.profile_picture_url:', formState.profile_picture_url)

    try {
      setIsSaving(true)

      if (dialogMode === 'create') {
        const { error: insertError } = await supabase.from('subcontractors').insert([payload])

        if (insertError) {
          if (insertError.code === '23505') {
            setError('A subcontractor with this email already exists.')
          } else {
            console.error('Failed to add subcontractor:', insertError)
            setError('Failed to add subcontractor.')
          }
          return
        }

        setSuccess('Subcontractor added successfully.')
      } else if (dialogMode === 'edit' && activeSubcontractorId) {
        console.log('Updating subcontractor ID:', activeSubcontractorId)
        console.log('Updating subcontractor with payload:', JSON.stringify(payload, null, 2))
        
        // Use API route that uses admin client to bypass RLS
        const response = await fetch(`/api/subcontractors/${activeSubcontractorId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Failed to update subcontractor:', errorData)
          setError(`Failed to update subcontractor: ${errorData.error || 'Unknown error'}`)
          return
        }

        const result = await response.json()
        console.log('Update successful:', result)
        setSuccess('Subcontractor updated successfully.')
      }

      closeDialog()
      fetchSubcontractors()
    } catch (err) {
      console.error('Unexpected error saving subcontractor:', err)
      setError('Unexpected error saving subcontractor.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (record: Subcontractor) => {
    resetMessages()
    const confirmation = confirm(`Are you sure you want to delete ${record.name}?`)
    if (!confirmation) return

    try {
      const { error: deleteError } = await supabase.from('subcontractors').delete().eq('id', record.id)

      if (deleteError) {
        console.error('Failed to delete subcontractor:', deleteError)
        setError('Failed to delete subcontractor.')
        return
      }

      setSuccess('Subcontractor deleted.')
      fetchSubcontractors()
    } catch (err) {
      console.error('Unexpected error deleting subcontractor:', err)
      setError('Unexpected error deleting subcontractor.')
    }
  }

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        }
      }

      return { key, direction: key === 'created_at' ? 'desc' : 'asc' }
    })
  }

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const selectedSubcontractors = useMemo(
    () => subcontractors.filter((record) => selectedIdSet.has(record.id)),
    [subcontractors, selectedIdSet]
  )

  const tradeSuggestions = useMemo(() => {
    const query = formState.trade_category.trim().toLowerCase()
    const suggestions = query
      ? knownTradeCategories.filter((trade) => trade.toLowerCase().includes(query))
      : knownTradeCategories
    return suggestions.slice(0, 12)
  }, [formState.trade_category, knownTradeCategories])

  const selectedEmailsList = useMemo(
    () => selectedSubcontractors.map((record) => record.email).join('; '),
    [selectedSubcontractors]
  )

  const filteredSubcontractors = useMemo(() => {
    let data = [...subcontractors]

    if (searchTerm) {
      const lowered = searchTerm.toLowerCase()
      data = data.filter((record) => {
        const matchesName = record.name?.toLowerCase().includes(lowered) ?? false
        const matchesEmail = record.email?.toLowerCase().includes(lowered) ?? false
        const matchesLocation = record.location?.toLowerCase().includes(lowered) ?? false

        return matchesName || matchesEmail || matchesLocation
      })
    }

    if (tradeFilter !== 'all') {
      data = data.filter((record) => record.trade_category === tradeFilter)
    }

    if (locationFilter) {
      const locationLower = locationFilter.toLowerCase()
      data = data.filter((record) => (record.location ?? '').toLowerCase().includes(locationLower))
    }

    data.sort((a, b) => {
      const { key, direction } = sortConfig
      const multiplier = direction === 'asc' ? 1 : -1

      if (key === 'created_at') {
        return multiplier * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      }

      const valueA = (a[key] ?? '').toString().toLowerCase()
      const valueB = (b[key] ?? '').toString().toLowerCase()
      return multiplier * valueA.localeCompare(valueB)
    })

    return data
  }, [locationFilter, searchTerm, sortConfig, subcontractors, tradeFilter])

  const filteredSubcontractorIds = useMemo(
    () => filteredSubcontractors.map((record) => record.id),
    [filteredSubcontractors]
  )

  useEffect(() => {
    filteredSubcontractorsRef.current = filteredSubcontractors
  }, [filteredSubcontractors])

  const allFilteredSelected =
    filteredSubcontractors.length > 0 && filteredSubcontractors.every((record) => selectedIdSet.has(record.id))
  const someFilteredSelected = filteredSubcontractors.some((record) => selectedIdSet.has(record.id))
  const bulkSelectionState: CheckboxState = allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false

  const handleToggleSelect = (id: string, checked: CheckboxState) => {
    const shouldSelect = checked === true || checked === 'indeterminate'
    setSelectedIds((prev) => {
      if (shouldSelect) {
        if (prev.includes(id)) {
          return prev
        }
        return [...prev, id]
      }
      return prev.filter((existingId) => existingId !== id)
    })
  }

  const handleToggleSelectAll = (checked: CheckboxState) => {
    const shouldSelectAll = checked === true || checked === 'indeterminate'
    if (shouldSelectAll) {
      setSelectedIds((prev) => {
        const merged = new Set(prev)
        filteredSubcontractors.forEach((record) => merged.add(record.id))
        return Array.from(merged)
      })
    } else {
      const removalSet = new Set(filteredSubcontractorIds)
      setSelectedIds((prev) => prev.filter((id) => !removalSet.has(id)))
    }
  }

  const handleClearSelection = () => {
    setSelectedIds([])
  }

  const openEmailComposer = () => {
    if (selectedSubcontractors.length === 0) return

    const primaryTrade =
      selectedSubcontractors.length === 1 ? selectedSubcontractors[0].trade_category : 'your trade crews'

    const subject =
      selectedSubcontractors.length === 1
        ? `Project opportunity for ${primaryTrade}`
        : `Project opportunity for ${selectedSubcontractors.length} subcontractors`

    const namesPreview =
      selectedSubcontractors.length === 1
        ? selectedSubcontractors[0].name
        : selectedSubcontractors.length <= 3
        ? selectedSubcontractors.map((sub) => sub.name).join(', ')
        : `${selectedSubcontractors.length} subcontractors`

    const greeting =
      selectedSubcontractors.length === 1
        ? `Hi ${selectedSubcontractors[0].name.split(' ')[0] || selectedSubcontractors[0].name},`
        : 'Hi team,'

    const body = `${greeting}

We have a new project opportunity that looks like a fit for ${namesPreview}. Reply if you'd like the full bid package, plans, and next steps from Bidi.

Thanks,
The Bidi Team`

    setEmailSubject(subject)
    setEmailBody(body)
    setCopyStatus('idle')
    setIsEmailDialogOpen(true)
  }

  const handleCloseEmailComposer = () => {
    setIsEmailDialogOpen(false)
    setCopyStatus('idle')
  }

  const copyEmailsToClipboard = async () => {
    if (!selectedEmailsList) {
      setCopyStatus('error')
      return
    }

    try {
      await navigator.clipboard.writeText(selectedEmailsList)
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch (err) {
      console.error('Failed to copy emails', err)
      setCopyStatus('error')
    }
  }

  const handleLaunchEmailClient = () => {
    if (selectedSubcontractors.length === 0) return

    const bcc = selectedSubcontractors.map((sub) => sub.email).join(',')
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`
    window.location.href = mailtoUrl
  }

  const getCellKey = (id: string, field: EditableField) => `${id}-${field}`

  const setCellInputRef = (
    id: string,
    field: EditableField,
    node: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  ) => {
    const key = getCellKey(id, field)
    if (node) {
      inputRefs.current[key] = node
    } else {
      delete inputRefs.current[key]
    }
  }

  const convertValueToDraftString = (field: EditableField, value: unknown): string => {
    switch (field) {
      case 'google_review_score':
        return typeof value === 'number' && !Number.isNaN(value) ? String(value) : ''
      case 'jobs_completed':
        return typeof value === 'number' && !Number.isNaN(value) ? String(value) : ''
      case 'licensed':
      case 'bonded':
        if (value === true) return 'true'
        if (value === false) return 'false'
        return 'unknown'
      case 'notes':
      case 'name':
      case 'email':
      case 'phone':
      case 'trade_category':
      case 'location':
      case 'website_url':
      case 'google_reviews_link':
      case 'time_in_business':
        return typeof value === 'string' ? value : ''
      case 'references':
        if (!value) return ''
        if (typeof value === 'string') return value
        try {
          return JSON.stringify(value, null, 2)
        } catch {
          return ''
        }
      default:
        return ''
    }
  }

  const convertRecordToDraft = (record: Subcontractor) => {
    return editableFieldOrder.reduce<Record<EditableField, string>>((acc, field) => {
      const value = record[field as keyof Subcontractor]
      acc[field] = convertValueToDraftString(field, value)
      return acc
    }, {} as Record<EditableField, string>)
  }

  const ensureDraftForRow = (record: Subcontractor) => {
    setDraftValues((prev) => {
      if (prev[record.id]) {
        return prev
      }
      return {
        ...prev,
        [record.id]: convertRecordToDraft(record)
      }
    })
  }

  const getDraftValue = (record: Subcontractor, field: EditableField) => {
    const draft = draftValues[record.id]
    if (draft && field in draft) {
      return draft[field] ?? ''
    }
    return convertValueToDraftString(field, record[field as keyof Subcontractor])
  }

  const updateDraftValue = (rowId: string, field: EditableField, value: string) => {
    setDraftValues((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] ?? {}),
        [field]: value
      }
    }))
  }

  const isTempRow = (rowId: string) => rowId.startsWith(NEW_ROW_PREFIX)

  const createEmptyRow = (id: string): Subcontractor => ({
    id,
    name: '',
    email: '',
    trade_category: '',
    location: '',
    created_at: new Date().toISOString(),
    phone: '',
    website_url: '',
    google_review_score: null,
    google_reviews_link: '',
    time_in_business: '',
    jobs_completed: null,
    references: null,
    licensed: null,
    bonded: null,
    notes: ''
  })

  const validateEmail = (value: string) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailPattern.test(value)
  }

  const parseFieldValue = (field: EditableField, rawValue: string) => {
    const trimmed = rawValue?.trim?.() ?? ''

    switch (field) {
      case 'name':
        if (!trimmed) {
          return { value: '', error: 'Name is required.' }
        }
        return { value: trimmed }
      case 'email':
        if (!trimmed) {
          return { value: '', error: 'Email is required.' }
        }
        if (!validateEmail(trimmed)) {
          return { value: '', error: 'Enter a valid email address.' }
        }
        return { value: trimmed.toLowerCase() }
      case 'trade_category':
        if (!trimmed) {
          return { value: '', error: 'Trade is required.' }
        }
        return { value: trimmed }
      case 'location':
        if (!trimmed) {
          return { value: '', error: 'Location is required.' }
        }
        return { value: trimmed }
      case 'phone':
        return { value: trimmed || null }
      case 'website_url':
        return { value: trimmed || null }
      case 'google_review_score':
        if (!trimmed) {
          return { value: null }
        }
        const score = Number(trimmed)
        if (Number.isNaN(score)) {
          return { value: null, error: 'Google review score must be a number.' }
        }
        if (score < 0 || score > 5) {
          return { value: null, error: 'Google review score must be between 0 and 5.' }
        }
        return { value: Number(score.toFixed(2)) }
      case 'google_reviews_link':
        return { value: trimmed || null }
      case 'time_in_business':
        return { value: trimmed || null }
      case 'jobs_completed':
        if (!trimmed) {
          return { value: null }
        }
        const jobs = Number.parseInt(trimmed, 10)
        if (Number.isNaN(jobs)) {
          return { value: null, error: 'Jobs completed must be a number.' }
        }
        if (jobs < 0) {
          return { value: null, error: 'Jobs completed must be zero or greater.' }
        }
        return { value: jobs }
      case 'licensed':
      case 'bonded':
        if (!trimmed || trimmed === 'unknown') {
          return { value: null }
        }
        if (trimmed === 'true') {
          return { value: true }
        }
        if (trimmed === 'false') {
          return { value: false }
        }
        return { value: null, error: 'Please choose Yes, No, or Unknown.' }
      case 'notes':
        return { value: trimmed || null }
      case 'references':
        if (!trimmed) {
          return { value: null }
        }
        try {
          return { value: JSON.parse(trimmed) }
        } catch {
          return { value: null, error: 'References must be valid JSON.' }
        }
      default:
        return { value: trimmed }
    }
  }

  const areValuesEqual = (current: unknown, next: unknown) => {
    if (current === next) return true
    if (current == null && next == null) return true

    if (typeof current === 'number' && typeof next === 'number') {
      return Number.isNaN(current) && Number.isNaN(next) ? true : current === next
    }

    if (typeof current === 'object' && typeof next === 'object') {
      try {
        return JSON.stringify(current) === JSON.stringify(next)
      } catch {
        return false
      }
    }

    return false
  }

  const updateLocalRowValue = (rowId: string, field: EditableField, value: unknown) => {
    setSubcontractors((prev) =>
      prev.map((record) => {
        if (record.id !== rowId) {
          return record
        }

        return {
          ...record,
          [field]: value
        } as Subcontractor
      })
    )

    setDraftValues((prev) => {
      const existing = prev[rowId]
      if (!existing) return prev
      return {
        ...prev,
        [rowId]: {
          ...existing,
          [field]: convertValueToDraftString(field, value)
        }
      }
    })
  }

  const buildInsertPayload = (rowId: string) => {
    const draft = draftValues[rowId]
    const errors: string[] = []
    const payload: Record<string, unknown> = {}

    editableFieldOrder.forEach((field) => {
      const raw = draft?.[field] ?? ''
      const { value, error } = parseFieldValue(field, raw)
      if (error) {
        if (requiredInlineFields.includes(field) || raw.trim() !== '') {
          errors.push(error)
        }
      }
      if (value !== undefined) {
        payload[field] = value
      }
    })

    if (errors.length > 0) {
      return { payload: null, error: errors[0] }
    }

    return { payload, error: null }
  }

  const startEditingCell = (record: Subcontractor, field: EditableField) => {
    resetMessages()
    ensureDraftForRow(record)
    setEditingCell({ id: record.id, field })
  }

  const handleCellCommit = async (
    rowId: string,
    field: EditableField,
    overrideRawValue?: string
  ): Promise<{ success: boolean; resolvedRowId: string }> => {
    const record = subcontractors.find((sub) => sub.id === rowId)
    if (!record) {
      setError('Unable to locate row for editing.')
      return { success: false, resolvedRowId: rowId }
    }

    const rawValueFromState =
      draftValues[rowId]?.[field] ?? convertValueToDraftString(field, record[field as keyof Subcontractor])
    const rawValue = overrideRawValue ?? rawValueFromState
    const { value, error: parseError } = parseFieldValue(field, rawValue)

    if (parseError) {
      setError(parseError)
      return { success: false, resolvedRowId: rowId }
    }

    const currentValue = record[field as keyof Subcontractor]

    if (areValuesEqual(currentValue, value)) {
      return { success: true, resolvedRowId: rowId }
    }

    updateLocalRowValue(rowId, field, value)

    if (isTempRow(rowId)) {
      const draft = draftValues[rowId] ?? convertRecordToDraft(record)
      const updatedDraft = {
        ...draft,
        [field]: convertValueToDraftString(field, value)
      }
      setDraftValues((prev) => ({
        ...prev,
        [rowId]: updatedDraft
      }))

      const isRowComplete = requiredInlineFields.every((requiredField) => {
        const draftValue = updatedDraft[requiredField]?.trim?.() ?? ''
        return draftValue.length > 0
      })

      if (!isRowComplete) {
        return { success: true, resolvedRowId: rowId }
      }

      const { payload, error: payloadError } = buildInsertPayload(rowId)

      if (payloadError || !payload) {
        setError(payloadError ?? 'Unable to save new row.')
        return { success: false, resolvedRowId: rowId }
      }

      try {
        const { data, error: insertError } = await supabase
          .from('subcontractors')
          .insert(payload)
          .select()
          .single()

        if (insertError) {
          console.error('Failed to insert subcontractor inline:', insertError)
          setError('Failed to save new subcontractor.')
          return { success: false, resolvedRowId: rowId }
        }

        if (data) {
          const nextRowId = (data as Subcontractor).id
          setSubcontractors((prev) =>
            prev.map((item) => (item.id === rowId ? (data as Subcontractor) : item))
          )

          setDraftValues((prev) => {
            const next = { ...prev }
            delete next[rowId]
            return {
              ...next,
              [data.id]: convertRecordToDraft(data as Subcontractor)
            }
          })

          setEditingCell((prev) => {
            if (prev && prev.id === rowId) {
              return { id: nextRowId, field: prev.field }
            }
            return prev
          })

          return { success: true, resolvedRowId: nextRowId }
        }
      } catch (insertErr) {
        console.error('Unexpected error inserting subcontractor inline:', insertErr)
        setError('Unexpected error saving subcontractor.')
        return { success: false, resolvedRowId: rowId }
      }

      return { success: true, resolvedRowId: rowId }
    }

    try {
      const { error: updateError } = await supabase
        .from('subcontractors')
        .update({ [field]: value })
        .eq('id', rowId)

      if (updateError) {
        console.error('Failed to update subcontractor inline:', updateError)
        setError('Failed to save changes.')
        return { success: false, resolvedRowId: rowId }
      }
    } catch (updateErr) {
      console.error('Unexpected error updating subcontractor inline:', updateErr)
      setError('Unexpected error saving changes.')
      return { success: false, resolvedRowId: rowId }
    }

    return { success: true, resolvedRowId: rowId }
  }

  const handleCancelInlineEdit = (rowId: string, field: EditableField) => {
    const record = subcontractors.find((sub) => sub.id === rowId)
    if (!record) return

    setDraftValues((prev) => {
      const existing = prev[rowId]
      if (!existing) return prev
      return {
        ...prev,
        [rowId]: {
          ...existing,
          [field]: convertValueToDraftString(field, record[field as keyof Subcontractor])
        }
      }
    })

    setEditingCell(null)
  }

  const moveToAdjacentCell = (
    currentRowId: string,
    field: EditableField,
    direction: 'next' | 'prev'
  ) => {
    const rowOrder = filteredSubcontractorsRef.current
    const currentRowIndex = rowOrder.findIndex((row) => row.id === currentRowId)
    const fieldIndex = editableFieldOrder.indexOf(field)

    if (fieldIndex === -1 || currentRowIndex === -1) {
      setEditingCell(null)
      return
    }

    if (direction === 'next') {
      if (fieldIndex < editableFieldOrder.length - 1) {
        const nextField = editableFieldOrder[fieldIndex + 1]
        const row = rowOrder[currentRowIndex]
        startEditingCell(row, nextField)
        return
      }

      if (currentRowIndex < rowOrder.length - 1) {
        const nextRow = rowOrder[currentRowIndex + 1]
        const nextField = editableFieldOrder[0]
        startEditingCell(nextRow, nextField)
        return
      }
    } else {
      if (fieldIndex > 0) {
        const prevField = editableFieldOrder[fieldIndex - 1]
        const row = rowOrder[currentRowIndex]
        startEditingCell(row, prevField)
        return
      }

      if (currentRowIndex > 0) {
        const prevRow = rowOrder[currentRowIndex - 1]
        const prevField = editableFieldOrder[editableFieldOrder.length - 1]
        startEditingCell(prevRow, prevField)
        return
      }
    }

    setEditingCell(null)
  }

  const handleInputKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    rowId: string,
    field: EditableField
  ) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      const { success, resolvedRowId } = await handleCellCommit(
        rowId,
        field,
        event.currentTarget.value
      )
      if (success) {
        setTimeout(() => {
          moveToAdjacentCell(resolvedRowId, field, event.shiftKey ? 'prev' : 'next')
        }, 0)
      }
      return
    }

    if (event.key === 'Enter' && !(event.shiftKey && field === 'notes')) {
      if (field === 'notes' || field === 'references') {
        if (event.shiftKey) {
          return
        }
      }
      event.preventDefault()
      const { success } = await handleCellCommit(rowId, field, event.currentTarget.value)
      if (success) {
        setEditingCell(null)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelInlineEdit(rowId, field)
    }
  }

  const handleAddInlineRow = () => {
    resetMessages()
    if (subcontractors.some((row) => isTempRow(row.id))) {
      setError('Finish filling in the pending row before adding another.')
      return
    }

    const tempId = `${NEW_ROW_PREFIX}${
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    }`
    const newRow = createEmptyRow(tempId)
    setSubcontractors((prev) => [newRow, ...prev])
    setDraftValues((prev) => ({
      ...prev,
      [tempId]: convertRecordToDraft(newRow)
    }))
    setEditingCell({ id: tempId, field: 'name' })
  }

  useEffect(() => {
    if (!editingCell) return

    const key = getCellKey(editingCell.id, editingCell.field)
    const node = inputRefs.current[key]

    if (node) {
      requestAnimationFrame(() => {
        node.focus()
        if ('select' in node && typeof node.select === 'function') {
          try {
            node.select()
          } catch {
            // ignore
          }
        }
      })
    }
  }, [editingCell])

  if (authLoading || isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <FallingBlocksLoader text="" size="sm" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-background border-b">
        <div className="container mx-auto max-w-7xl px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Subcontractor CRM</h1>
              <p className="text-sm text-muted-foreground">Manage subcontractor network and keep records up to date</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link href="/admin/demo-settings">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              <Button variant="outline" size="icon" className="sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Subcontractors</p>
                  <p className="text-2xl font-bold text-foreground">{subcontractors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Briefcase className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Trade Categories</p>
                  <p className="text-2xl font-bold text-foreground">
                    {new Set(subcontractors.map((record) => record.trade_category)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <MapPin className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Unique Locations</p>
                  <p className="text-2xl font-bold text-foreground">
                    {new Set(subcontractors.map((record) => record.location)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Added Last 30 Days</p>
                  <p className="text-2xl font-bold text-foreground">
                    {
                      subcontractors.filter((record) => {
                        const createdDate = new Date(record.created_at)
                        const now = new Date()
                        const diffInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
                        return diffInDays <= 30
                      }).length
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {(error || success) && (
          <Card className={error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            <CardContent className="py-4">
              <p className={error ? 'text-red-800' : 'text-green-800'}>{error ?? success}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-1 sm:flex sm:items-center sm:justify-between sm:space-y-0">
            <div>
              <CardTitle className="text-xl">Subcontractor Directory</CardTitle>
              <CardDescription>Search, filter, and maintain your subcontractor network.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/subcontractors/enrich">
                <Button variant="default" size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Enrich with Firecrawl
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="sm"
                onClick={openEmailComposer}
                disabled={selectedSubcontractors.length === 0}
              >
                <Mail className="h-4 w-4 mr-2" />
                {`Compose Email${selectedSubcontractors.length > 0 ? ` (${selectedSubcontractors.length})` : ''}`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={selectedSubcontractors.length === 0}
              >
                Clear Selection
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchSubcontractors()} disabled={tableLoading}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={handleAddInlineRow} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Subcontractor
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1fr] gap-4">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name, email, or location"
                  className="pl-10"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <Select value={tradeFilter} onValueChange={setTradeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by trade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trades</SelectItem>
                  {knownTradeCategories.map((trade) => (
                    <SelectItem key={trade} value={trade}>
                      {trade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Filter by location"
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              />
              <div className="text-sm text-muted-foreground flex items-center">
                Showing {filteredSubcontractors.length} of {subcontractors.length}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-12 py-3 px-4">
                      <Checkbox
                        checked={bulkSelectionState}
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Select all filtered subcontractors"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      <button
                        type="button"
                        className="flex items-center space-x-2 text-left text-foreground"
                        onClick={() => handleSort('name')}
                      >
                        <span>Name</span>
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      <button
                        type="button"
                        className="flex items-center space-x-2 text-left text-foreground"
                        onClick={() => handleSort('trade_category')}
                      >
                        <span>Trade</span>
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      <button
                        type="button"
                        className="flex items-center space-x-2 text-left text-foreground"
                        onClick={() => handleSort('location')}
                      >
                        <span>Location</span>
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Website</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Google Reviews</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Time in Business</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Jobs Completed</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Licensed</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Bonded</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Notes</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">References</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      <button
                        type="button"
                        className="flex items-center space-x-2 text-left text-foreground"
                        onClick={() => handleSort('created_at')}
                      >
                        <span>Added</span>
                        <ArrowUpDown className="h-4 w-4" />
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    <tr>
                      <td colSpan={16} className="py-12">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <FallingBlocksLoader text="" size="sm" />
                          <p className="text-sm text-muted-foreground">Loading subcontractors...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredSubcontractors.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-12 text-center text-muted-foreground">
                        {searchTerm || tradeFilter !== 'all' || locationFilter
                          ? 'No subcontractors match your filters.'
                          : 'No subcontractors have been added yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSubcontractors.map((record) => {
                      const referencesSummary = Array.isArray(record.references)
                        ? `${record.references.length} entr${record.references.length === 1 ? 'y' : 'ies'}`
                        : record.references
                        ? 'View JSON'
                        : '—'

                      return (
                        <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <Checkbox
                              checked={selectedIdSet.has(record.id)}
                              onCheckedChange={(checked) => handleToggleSelect(record.id, checked)}
                              aria-label={`Select ${record.name}`}
                            />
                          </td>
                          <td
                            className="py-3 px-4"
                            onDoubleClick={() => startEditingCell(record, 'name')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'name' ? (
                              <Input
                                ref={(node) => setCellInputRef(record.id, 'name', node)}
                                value={getDraftValue(record, 'name')}
                                onChange={(event) => updateDraftValue(record.id, 'name', event.target.value)}
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'name')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'name') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'name',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-8"
                              />
                            ) : (
                              <div className="font-medium text-foreground">
                                {record.name || (
                                  <span className="text-muted-foreground">Double-click to edit</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td
                            className="py-3 px-4"
                            onDoubleClick={() => startEditingCell(record, 'email')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'email' ? (
                              <Input
                                ref={(node) => setCellInputRef(record.id, 'email', node)}
                                type="email"
                                value={getDraftValue(record, 'email')}
                                onChange={(event) => updateDraftValue(record.id, 'email', event.target.value)}
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'email')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'email') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'email',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-8"
                              />
                            ) : (
                              <div className="flex items-center text-muted-foreground">
                                <Mail className="h-4 w-4 mr-2" />
                                <span className="truncate">{record.email}</span>
                              </div>
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-muted-foreground"
                            onDoubleClick={() => startEditingCell(record, 'phone')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'phone' ? (
                              <Input
                                ref={(node) => setCellInputRef(record.id, 'phone', node)}
                                type="tel"
                                value={getDraftValue(record, 'phone')}
                                onChange={(event) => updateDraftValue(record.id, 'phone', event.target.value)}
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'phone')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'phone') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'phone',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-8"
                              />
                            ) : record.phone ? (
                              <div className="flex items-center">
                                <Phone className="h-4 w-4 mr-2" />
                                <span className="truncate">{record.phone}</span>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className="py-3 px-4"
                            onDoubleClick={() => startEditingCell(record, 'trade_category')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'trade_category' ? (
                              <Input
                                ref={(node) => setCellInputRef(record.id, 'trade_category', node)}
                                value={getDraftValue(record, 'trade_category')}
                                onChange={(event) =>
                                  updateDraftValue(record.id, 'trade_category', event.target.value)
                                }
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'trade_category')}
                                onBlur={async (event) => {
                                  if (
                                    editingCell?.id !== record.id ||
                                    editingCell.field !== 'trade_category'
                                  )
                                    return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'trade_category',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-8"
                                placeholder="Trade"
                              />
                            ) : record.trade_category ? (
                              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-medium">
                                {record.trade_category}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td
                            className="py-3 px-4"
                            onDoubleClick={() => startEditingCell(record, 'location')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'location' ? (
                              <Input
                                ref={(node) => setCellInputRef(record.id, 'location', node)}
                                value={getDraftValue(record, 'location')}
                                onChange={(event) => updateDraftValue(record.id, 'location', event.target.value)}
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'location')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'location') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'location',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-8"
                              />
                            ) : (
                              <div className="flex items-center text-muted-foreground">
                                <MapPin className="h-4 w-4 mr-2" />
                                <span className="truncate">{record.location}</span>
                              </div>
                            )}
                          </td>
                          <td
                            className="py-3 px-4"
                            onDoubleClick={() => startEditingCell(record, 'website_url')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'website_url' ? (
                              <Input
                                ref={(node) => setCellInputRef(record.id, 'website_url', node)}
                                type="url"
                                value={getDraftValue(record, 'website_url')}
                                onChange={(event) =>
                                  updateDraftValue(record.id, 'website_url', event.target.value)
                                }
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'website_url')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'website_url') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'website_url',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-8"
                                placeholder="https://"
                              />
                            ) : record.website_url ? (
                              <a
                                href={record.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate max-w-[160px] inline-block"
                                onDoubleClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  startEditingCell(record, 'website_url')
                                }}
                              >
                                {record.website_url}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-muted-foreground"
                            onDoubleClick={() => startEditingCell(record, 'google_review_score')}
                          >
                            {editingCell?.id === record.id &&
                            (editingCell.field === 'google_review_score' ||
                              editingCell.field === 'google_reviews_link') ? (
                              <div className="space-y-2">
                                <Input
                                  ref={(node) => setCellInputRef(record.id, 'google_review_score', node)}
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="5"
                                  value={getDraftValue(record, 'google_review_score')}
                                  onChange={(event) =>
                                    updateDraftValue(record.id, 'google_review_score', event.target.value)
                                  }
                                  onKeyDown={(event) =>
                                    handleInputKeyDown(event, record.id, 'google_review_score')
                                  }
                                  onBlur={async (event) => {
                                    if (
                                      editingCell?.id !== record.id ||
                                      editingCell.field !== 'google_review_score'
                                    ) {
                                      return
                                    }
                                    const { success } = await handleCellCommit(
                                      record.id,
                                      'google_review_score',
                                      event.currentTarget.value
                                    )
                                    if (success) {
                                      setEditingCell(null)
                                    }
                                  }}
                                  className="h-8"
                                  placeholder="Score (0-5)"
                                />
                                <Input
                                  ref={(node) => setCellInputRef(record.id, 'google_reviews_link', node)}
                                  type="url"
                                  value={getDraftValue(record, 'google_reviews_link')}
                                  onChange={(event) =>
                                    updateDraftValue(record.id, 'google_reviews_link', event.target.value)
                                  }
                                  onKeyDown={(event) =>
                                    handleInputKeyDown(event, record.id, 'google_reviews_link')
                                  }
                                  onBlur={async (event) => {
                                    if (
                                      editingCell?.id !== record.id ||
                                      editingCell.field !== 'google_reviews_link'
                                    ) {
                                      return
                                    }
                                    const { success } = await handleCellCommit(
                                      record.id,
                                      'google_reviews_link',
                                      event.currentTarget.value
                                    )
                                    if (success) {
                                      setEditingCell(null)
                                    }
                                  }}
                                  className="h-8"
                                  placeholder="Google reviews link"
                                />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div>
                                  {typeof record.google_review_score === 'number'
                                    ? `${record.google_review_score.toFixed(1)} ★`
                                    : '—'}
                                </div>
                                {record.google_reviews_link && (
                                  <a
                                    href={record.google_reviews_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline block truncate max-w-[160px]"
                                    onDoubleClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()
                                      startEditingCell(record, 'google_reviews_link')
                                    }}
                                  >
                                    View reviews
                                  </a>
                                )}
                              </div>
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-muted-foreground"
                            onDoubleClick={() => startEditingCell(record, 'time_in_business')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'time_in_business' ? (
                              <Input
                                ref={(node) => setCellInputRef(record.id, 'time_in_business', node)}
                                value={getDraftValue(record, 'time_in_business')}
                                onChange={(event) =>
                                  updateDraftValue(record.id, 'time_in_business', event.target.value)
                                }
                                onKeyDown={(event) =>
                                  handleInputKeyDown(event, record.id, 'time_in_business')
                                }
                                onBlur={async (event) => {
                                  if (
                                    editingCell?.id !== record.id ||
                                    editingCell.field !== 'time_in_business'
                                  )
                                    return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'time_in_business',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-8"
                                placeholder="e.g., 10 years"
                              />
                            ) : (
                              record.time_in_business || '—'
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-muted-foreground"
                            onDoubleClick={() => startEditingCell(record, 'jobs_completed')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'jobs_completed' ? (
                              <Input
                                ref={(node) => setCellInputRef(record.id, 'jobs_completed', node)}
                                type="number"
                                inputMode="numeric"
                                value={getDraftValue(record, 'jobs_completed')}
                                onChange={(event) =>
                                  updateDraftValue(record.id, 'jobs_completed', event.target.value)
                                }
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'jobs_completed')}
                                onBlur={async (event) => {
                                  if (
                                    editingCell?.id !== record.id ||
                                    editingCell.field !== 'jobs_completed'
                                  )
                                    return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'jobs_completed',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="h-8"
                                placeholder="0"
                              />
                            ) : typeof record.jobs_completed === 'number' ? (
                              record.jobs_completed
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className="py-3 px-4"
                            onDoubleClick={() => startEditingCell(record, 'licensed')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'licensed' ? (
                              <select
                                ref={(node) => setCellInputRef(record.id, 'licensed', node)}
                                value={getDraftValue(record, 'licensed')}
                                onChange={async (event) => {
                                  const value = event.currentTarget.value
                                  updateDraftValue(record.id, 'licensed', value)
                                  await handleCellCommit(record.id, 'licensed', value)
                                }}
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'licensed')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'licensed') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'licensed',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="unknown">Unknown</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            ) : record.licensed === null || record.licensed === undefined ? (
                              <span className="text-muted-foreground">—</span>
                            ) : record.licensed ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                No
                              </span>
                            )}
                          </td>
                          <td
                            className="py-3 px-4"
                            onDoubleClick={() => startEditingCell(record, 'bonded')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'bonded' ? (
                              <select
                                ref={(node) => setCellInputRef(record.id, 'bonded', node)}
                                value={getDraftValue(record, 'bonded')}
                                onChange={async (event) => {
                                  const value = event.currentTarget.value
                                  updateDraftValue(record.id, 'bonded', value)
                                  await handleCellCommit(record.id, 'bonded', value)
                                }}
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'bonded')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'bonded') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'bonded',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <option value="unknown">Unknown</option>
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            ) : record.bonded === null || record.bonded === undefined ? (
                              <span className="text-muted-foreground">—</span>
                            ) : record.bonded ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                No
                              </span>
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-muted-foreground max-w-[220px]"
                            onDoubleClick={() => startEditingCell(record, 'notes')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'notes' ? (
                              <Textarea
                                ref={(node) => setCellInputRef(record.id, 'notes', node)}
                                value={getDraftValue(record, 'notes')}
                                onChange={(event) => updateDraftValue(record.id, 'notes', event.target.value)}
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'notes')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'notes') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'notes',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                rows={3}
                                className="min-h-[72px]"
                                placeholder="Add notes"
                              />
                            ) : (
                              <span className="truncate block">{record.notes ?? '—'}</span>
                            )}
                          </td>
                          <td
                            className="py-3 px-4 text-muted-foreground"
                            onDoubleClick={() => startEditingCell(record, 'references')}
                          >
                            {editingCell?.id === record.id && editingCell.field === 'references' ? (
                              <Textarea
                                ref={(node) => setCellInputRef(record.id, 'references', node)}
                                value={getDraftValue(record, 'references')}
                                onChange={(event) =>
                                  updateDraftValue(record.id, 'references', event.target.value)
                                }
                                onKeyDown={(event) => handleInputKeyDown(event, record.id, 'references')}
                                onBlur={async (event) => {
                                  if (editingCell?.id !== record.id || editingCell.field !== 'references') return
                                  const { success } = await handleCellCommit(
                                    record.id,
                                    'references',
                                    event.currentTarget.value
                                  )
                                  if (success) {
                                    setEditingCell(null)
                                  }
                                }}
                                rows={3}
                                className="min-h-[72px]"
                                placeholder='[{"name":"Project","contact":"Jane Doe"}]'
                              />
                            ) : (
                              referencesSummary
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(record.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                              >
                                <Link href={`/subcontractors/${record.id}`} target="_blank">
                                  <Eye className="h-4 w-4 mr-1.5" />
                                  Profile
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPhotoManagerSubcontractorId(record.id)}
                              >
                                <ImageIcon className="h-4 w-4 mr-1.5" />
                                Photos
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(record)}
                              >
                                <Pencil className="h-4 w-4 mr-1.5" />
                              
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(record)}
                              >
                                <Trash2 className="h-4 w-4 mr-1.5" />
                    
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isEmailDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseEmailComposer()
          }
        }}
      >
        <DialogContent className="w-full max-w-3xl p-6">
          <DialogClose onClick={handleCloseEmailComposer} />
          <DialogHeader>
            <DialogTitle>Email Selected Subcontractors</DialogTitle>
            <DialogDescription>
              {selectedSubcontractors.length} recipient{selectedSubcontractors.length === 1 ? '' : 's'} selected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            <div className="space-y-2">
              <Label>Recipients</Label>
              {selectedSubcontractors.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
                  <ul className="space-y-2">
                    {selectedSubcontractors.map((sub) => (
                      <li key={sub.id} className="leading-tight">
                        <span className="font-medium text-foreground">{sub.name}</span>
                        <span className="block text-muted-foreground">{sub.email}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No subcontractors selected.</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyEmailsToClipboard}
                  disabled={!selectedEmailsList}
                >
                  Copy Emails
                </Button>
                {copyStatus === 'copied' && <span className="text-sm text-green-600">Copied!</span>}
                {copyStatus === 'error' && <span className="text-sm text-red-600">Copy failed. Try again.</span>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailSubject">Subject</Label>
              <Input
                id="emailSubject"
                value={emailSubject}
                onChange={(event) => setEmailSubject(event.target.value)}
                placeholder="Project opportunity from Bidi"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailBody">Email Body</Label>
              <Textarea
                id="emailBody"
                rows={8}
                value={emailBody}
                onChange={(event) => setEmailBody(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleCloseEmailComposer}>
              Cancel
            </Button>
            <Button type="button" onClick={handleLaunchEmailClient} disabled={!selectedEmailsList}>
              Open in Email Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog()
          }
        }}
      >
        <DialogContent className="w-full max-w-3xl p-0">
          <div className="max-h-[85vh] flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg">
            <div className="relative border-b bg-background px-6 py-4">
              <DialogClose className="absolute right-6 top-4 text-muted-foreground transition hover:text-foreground" />
              <DialogHeader className="pr-8">
                <DialogTitle>{dialogMode === 'create' ? 'Add Subcontractor' : 'Edit Subcontractor'}</DialogTitle>
                <DialogDescription>
                  {dialogMode === 'create'
                    ? 'Add a subcontractor to the Bidi network.'
                    : 'Update subcontractor contact information.'}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <form onSubmit={handleSubmit} className="space-y-6 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Company / Contact Name *</Label>
                    <Input
                      id="name"
                      value={formState.name}
                      onChange={(event) => handleFormChange('name', event.target.value)}
                      placeholder="ABC Electrical Services"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formState.email}
                      onChange={(event) => handleFormChange('email', event.target.value)}
                      placeholder="contact@abccontracting.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formState.phone}
                      onChange={(event) => handleFormChange('phone', event.target.value)}
                      placeholder="(555) 555-1234"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website_url">Website</Label>
                    <Input
                      id="website_url"
                      type="url"
                      value={formState.website_url}
                      onChange={(event) => handleFormChange('website_url', event.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div>
                  <Label>Profile Picture / Logo</Label>
                  <ProfilePictureUpload
                    value={formState.profile_picture_url}
                    onChange={(url) => {
                      console.log('Profile picture onChange called with URL:', url)
                      handleFormChange('profile_picture_url', url)
                    }}
                    disabled={isSaving}
                    subcontractorId={activeSubcontractorId || undefined}
                  />
                  {formState.profile_picture_url && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Current URL: {formState.profile_picture_url.substring(0, 50)}...
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trade">Trade *</Label>
                    <Input
                      id="trade"
                      value={formState.trade_category}
                      onChange={(event) => handleFormChange('trade_category', event.target.value)}
                      list="trade-category-options"
                      placeholder="e.g., Fireproofing"
                      required
                    />
                    <datalist id="trade-category-options">
                      {knownTradeCategories.map((trade) => (
                        <option key={trade} value={trade} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      Start typing to select an existing trade or create a new one.
                    </p>
                    {tradeSuggestions.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Quick suggestions</p>
                        <div className="flex flex-wrap gap-2">
                          {tradeSuggestions.map((trade) => (
                            <Button
                              key={trade}
                              type="button"
                              size="sm"
                              variant={formState.trade_category === trade ? 'default' : 'outline'}
                              className="h-7 px-3 text-xs"
                              onClick={() => handleFormChange('trade_category', trade)}
                            >
                              {trade}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="location">Service Area *</Label>
                    <Input
                      id="location"
                      value={formState.location}
                      onChange={(event) => handleFormChange('location', event.target.value)}
                      placeholder="City, State"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="google_review_score">Google Review Score</Label>
                    <Input
                      id="google_review_score"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formState.google_review_score}
                      onChange={(event) => handleFormChange('google_review_score', event.target.value)}
                      placeholder="4.7"
                    />
                  </div>
                  <div>
                    <Label htmlFor="google_reviews_link">Google Reviews Link</Label>
                    <Input
                      id="google_reviews_link"
                      type="url"
                      value={formState.google_reviews_link}
                      onChange={(event) => handleFormChange('google_reviews_link', event.target.value)}
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="time_in_business">Time in Business</Label>
                    <Input
                      id="time_in_business"
                      value={formState.time_in_business}
                      onChange={(event) => handleFormChange('time_in_business', event.target.value)}
                      placeholder="10 years"
                    />
                  </div>
                  <div>
                    <Label htmlFor="jobs_completed">Jobs Completed</Label>
                    <Input
                      id="jobs_completed"
                      type="number"
                      inputMode="numeric"
                      value={formState.jobs_completed}
                      onChange={(event) => handleFormChange('jobs_completed', event.target.value)}
                      placeholder="150"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Licensed</Label>
                    <Select
                      value={formState.licensed}
                      onValueChange={(value) => handleFormChange('licensed', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bonded</Label>
                    <Select
                      value={formState.bonded}
                      onValueChange={(value) => handleFormChange('bonded', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formState.notes}
                      onChange={(event) => handleFormChange('notes', event.target.value)}
                      placeholder="Internal notes about the subcontractor..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="references">References (JSON)</Label>
                    <Textarea
                      id="references"
                      value={formState.references}
                      onChange={(event) => handleFormChange('references', event.target.value)}
                      placeholder='[{"name":"Project A","contact":"Jane Doe"}]'
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Provide valid JSON (array or object). Leave blank if not available.
                    </p>
                  </div>
                </div>

                <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-background px-6 py-4">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : dialogMode === 'create' ? 'Add Subcontractor' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Manager Modal */}
      {photoManagerSubcontractorId && (
        <SubcontractorPhotoManager
          subcontractorId={photoManagerSubcontractorId}
          isOpen={!!photoManagerSubcontractorId}
          onClose={() => setPhotoManagerSubcontractorId(null)}
        />
      )}
    </div>
  )
}

