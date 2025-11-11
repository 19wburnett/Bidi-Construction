'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Calendar
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

import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'

type SortKey = 'created_at' | 'name' | 'trade_category' | 'location'
type SortDirection = 'asc' | 'desc'

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

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'created_at',
    direction: 'desc'
  })

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [activeSubcontractorId, setActiveSubcontractorId] = useState<string | null>(null)
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
    notes: ''
  })

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
    notes: ''
  }

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

  const openCreateDialog = () => {
    resetMessages()
    setDialogMode('create')
    setActiveSubcontractorId(null)
    setFormState(initialFormState)
    setIsDialogOpen(true)
  }

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
      notes: record.notes ?? ''
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
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

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

    const payload = {
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
      notes: formState.notes.trim() || null
    }

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
        const { error: updateError } = await supabase
          .from('subcontractors')
          .update(payload)
          .eq('id', activeSubcontractorId)

        if (updateError) {
          console.error('Failed to update subcontractor:', updateError)
          setError('Failed to update subcontractor.')
          return
        }

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

  const filteredSubcontractors = useMemo(() => {
    let data = [...subcontractors]

    if (searchTerm) {
      const lowered = searchTerm.toLowerCase()
      data = data.filter((record) => {
        return (
          record.name.toLowerCase().includes(lowered) ||
          record.email.toLowerCase().includes(lowered) ||
          record.location.toLowerCase().includes(lowered)
        )
      })
    }

    if (tradeFilter !== 'all') {
      data = data.filter((record) => record.trade_category === tradeFilter)
    }

    if (locationFilter) {
      const locationLower = locationFilter.toLowerCase()
      data = data.filter((record) => record.location.toLowerCase().includes(locationLower))
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
              <Button variant="outline" size="sm" onClick={() => fetchSubcontractors()} disabled={tableLoading}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={openCreateDialog} size="sm">
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
                  {TRADE_CATEGORIES.map((trade) => (
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
                      <td colSpan={15} className="py-12">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <FallingBlocksLoader text="" size="sm" />
                          <p className="text-sm text-muted-foreground">Loading subcontractors...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredSubcontractors.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="py-12 text-center text-muted-foreground">
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
                            <div className="font-medium text-foreground">{record.name}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center text-muted-foreground">
                              <Mail className="h-4 w-4 mr-2" />
                              <span className="truncate">{record.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {record.phone ? (
                              <div className="flex items-center">
                                <Phone className="h-4 w-4 mr-2" />
                                <span className="truncate">{record.phone}</span>
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-medium">
                              {record.trade_category}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center text-muted-foreground">
                              <MapPin className="h-4 w-4 mr-2" />
                              <span className="truncate">{record.location}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {record.website_url ? (
                              <a
                                href={record.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate max-w-[160px] inline-block"
                              >
                                {record.website_url}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
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
                                >
                                  View reviews
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {record.time_in_business || '—'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {typeof record.jobs_completed === 'number' ? record.jobs_completed : '—'}
                          </td>
                          <td className="py-3 px-4">
                            {record.licensed === null || record.licensed === undefined ? (
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
                          <td className="py-3 px-4">
                            {record.bonded === null || record.bonded === undefined ? (
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
                          <td className="py-3 px-4 text-muted-foreground max-w-[220px]">
                            <span className="truncate block">{record.notes ?? '—'}</span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {referencesSummary}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(record.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(record)}
                              >
                                <Pencil className="h-4 w-4 mr-1.5" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(record)}
                              >
                                <Trash2 className="h-4 w-4 mr-1.5" />
                                Delete
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
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog()
          }
        }}
      >
        <DialogContent className="w-full max-w-3xl p-6">
          <DialogClose onClick={closeDialog} />
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Add Subcontractor' : 'Edit Subcontractor'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Add a subcontractor to the Bidi network.'
                : 'Update subcontractor contact information.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="trade">Trade *</Label>
                <Select
                  value={formState.trade_category}
                  onValueChange={(value) => handleFormChange('trade_category', value)}
                >
                  <SelectTrigger id="trade">
                    <SelectValue placeholder="Select trade category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_CATEGORIES.map((trade) => (
                      <SelectItem key={trade} value={trade}>
                        {trade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : dialogMode === 'create' ? 'Add Subcontractor' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

