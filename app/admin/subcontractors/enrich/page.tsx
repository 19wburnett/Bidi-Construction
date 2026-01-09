'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  ArrowLeft,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Sparkles,
  Globe,
  Phone,
  Star,
  Shield,
  Clock,
  FileText,
  Mail,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MapPin,
  Link as LinkIcon,
  ImageIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  licensed: boolean | null
  bonded: boolean | null
  notes: string | null
  profile_picture_url: string | null
  profile_summary: string | null
  services: string[] | null
  enrichment_status: string | null
  enrichment_updated_at: string | null
}

interface EnrichmentResult {
  id: string
  name: string
  success: boolean
  error?: string
  message?: string
  fieldsFound?: string[]
  enrichmentId?: string
}

interface EnrichmentRecord {
  id: string
  subcontractor_id: string
  status: string
  results_json: {
    profile_summary?: string | null
    services?: string[] | null
    phone?: string | null
    service_area?: string | null
    website_url?: string | null
    logo_url?: string | null
    licensed_claimed?: boolean | null
    bonded_claimed?: boolean | null
    insured_claimed?: boolean | null
    google_reviews_link?: string | null
    yelp_link?: string | null
    bbb_link?: string | null
    portfolio_links?: string[] | null
  } | null
  sources_json: Record<string, {
    source_url: string
    confidence: number
    extracted_text?: string
  }> | null
  error_message: string | null
  created_at: string
  updated_at: string
  approved_at: string | null
  approved_by: string | null
}

export default function SubcontractorEnrichmentPage() {
  const supabase = createClient()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [isAdmin, setIsAdmin] = useState(false)
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [tradeFilter, setTradeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [enrichmentResults, setEnrichmentResults] = useState<EnrichmentResult[]>([])
  const [enrichmentProgress, setEnrichmentProgress] = useState<{
    current: number
    total: number
    currentName: string
  } | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [tradeCategories, setTradeCategories] = useState<string[]>([])

  // Detail view state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<Subcontractor | null>(null)
  const [selectedEnrichment, setSelectedEnrichment] = useState<EnrichmentRecord | null>(null)
  const [loadingEnrichment, setLoadingEnrichment] = useState(false)
  const [approvingOrRejecting, setApprovingOrRejecting] = useState(false)

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

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
      setLoading(true)
      setError(null)

      // Build query with server-side filtering
      let query = supabase
        .from('subcontractors')
        .select('*', { count: 'exact' })

      // Apply search filter
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`)
      }

      // Apply trade filter
      if (tradeFilter !== 'all') {
        query = query.eq('trade_category', tradeFilter)
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'none') {
          query = query.is('enrichment_status', null)
        } else {
          query = query.eq('enrichment_status', statusFilter)
        }
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1

      query = query
        .order('created_at', { ascending: false })
        .range(from, to)

      const { data, error: fetchError, count } = await query

      if (fetchError) {
        console.error('Failed to fetch subcontractors:', fetchError)
        setError('Failed to fetch subcontractors.')
        return
      }

      setSubcontractors(data ?? [])
      setTotalCount(count ?? 0)
    } catch (err) {
      console.error('Unexpected error fetching subcontractors', err)
      setError('Unexpected error fetching subcontractors.')
    } finally {
      setLoading(false)
    }
  }, [supabase, searchTerm, tradeFilter, statusFilter, currentPage, pageSize])

  // Fetch trade categories once for the filter dropdown
  const fetchTradeCategories = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('subcontractors')
        .select('trade_category')
      
      if (data) {
        const uniqueTrades = Array.from(new Set(data.map(d => d.trade_category))).filter(Boolean).sort()
        setTradeCategories(uniqueTrades as string[])
      }
    } catch (err) {
      console.error('Error fetching trade categories:', err)
    }
  }, [supabase])

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
      fetchTradeCategories()
    }
  }, [authLoading, fetchSubcontractors, fetchTradeCategories, isAdmin])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, tradeFilter, statusFilter, pageSize])

  // Debounce search input
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Use debounced search for actual filtering
  useEffect(() => {
    if (isAdmin) {
      fetchSubcontractors()
    }
  }, [debouncedSearch, tradeFilter, statusFilter, currentPage, pageSize])

  // For pagination, we use the fetched data directly (server-side filtered)
  const filteredSubcontractors = subcontractors

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / pageSize)
  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const showingTo = Math.min(currentPage * pageSize, totalCount)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredSubcontractors.map((sub) => sub.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id])
    } else {
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id))
    }
  }

  const enrichSingle = async (subcontractorId: string) => {
    setEnriching(true)
    setError(null)
    setSuccess(null)
    setEnrichmentResults([])

    try {
      const response = await fetch('/api/subcontractors/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subcontractorId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enrich subcontractor')
      }

      const message = data.message || `Successfully enriched`
      setSuccess(message)
      setEnrichmentResults([
        {
          id: subcontractorId,
          name: subcontractors.find((s) => s.id === subcontractorId)?.name || 'Unknown',
          success: true,
          message: data.message,
          fieldsFound: data.fieldsFound || [],
          enrichmentId: data.enrichmentId,
        },
      ])
      await fetchSubcontractors()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enrich subcontractor'
      setError(errorMessage)
      setEnrichmentResults([
        {
          id: subcontractorId,
          name: subcontractors.find((s) => s.id === subcontractorId)?.name || 'Unknown',
          success: false,
          error: errorMessage,
        },
      ])
    } finally {
      setEnriching(false)
    }
  }

  const enrichBatch = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one subcontractor to enrich')
      return
    }

    setEnriching(true)
    setError(null)
    setSuccess(null)
    setEnrichmentResults([])
    setEnrichmentProgress({
      current: 0,
      total: selectedIds.length,
      currentName: '',
    })

    try {
      const response = await fetch('/api/subcontractors/enrich', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subcontractorIds: selectedIds }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enrich subcontractors')
      }

      const successCount = data.successful || 0
      const totalCount = data.processed || 0
      const message =
        successCount > 0
          ? `Successfully enriched ${successCount} of ${totalCount} subcontractors`
          : `No updates needed for ${totalCount} subcontractor(s)`
      setSuccess(message)
      setEnrichmentResults(
        (data.results || [])
          .map((r: EnrichmentResult) => ({ ...r, success: true }))
          .concat((data.errors || []).map((e: EnrichmentResult) => ({ ...e, success: false })))
      )
      await fetchSubcontractors()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enrich subcontractors'
      setError(errorMessage)
    } finally {
      setEnriching(false)
      setEnrichmentProgress(null)
    }
  }

  const fetchEnrichmentDetails = async (subcontractor: Subcontractor) => {
    setSelectedSubcontractor(subcontractor)
    setLoadingEnrichment(true)
    setDetailDialogOpen(true)

    try {
      const response = await fetch(`/api/enrichment/by-subcontractor/${subcontractor.id}/latest`)
      const data = await response.json()

      if (response.ok && data.enrichment) {
        setSelectedEnrichment(data.enrichment)
      } else {
        setSelectedEnrichment(null)
      }
    } catch (err) {
      console.error('Error fetching enrichment details:', err)
      setSelectedEnrichment(null)
    } finally {
      setLoadingEnrichment(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedEnrichment) return

    setApprovingOrRejecting(true)
    try {
      const response = await fetch(`/api/enrichment/${selectedEnrichment.id}/approve`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve enrichment')
      }

      setSuccess('Enrichment approved and applied!')
      setDetailDialogOpen(false)
      await fetchSubcontractors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve enrichment')
    } finally {
      setApprovingOrRejecting(false)
    }
  }

  const handleReject = async () => {
    if (!selectedEnrichment) return

    setApprovingOrRejecting(true)
    try {
      const response = await fetch(`/api/enrichment/${selectedEnrichment.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by admin' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject enrichment')
      }

      setSuccess('Enrichment rejected.')
      setDetailDialogOpen(false)
      await fetchSubcontractors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject enrichment')
    } finally {
      setApprovingOrRejecting(false)
    }
  }

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Running
          </Badge>
        )
      case 'complete':
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        )
      case 'approved':
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-700">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Not Enriched
          </Badge>
        )
    }
  }

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace('Url', 'URL')
      .replace('Bbb', 'BBB')
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

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
            <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Subcontractor Enrichment</h1>
              <p className="text-sm text-muted-foreground">
                Automatically enrich subcontractor profiles using free web search
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link href="/admin/subcontractors">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Subcontractors
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

      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Info Alert */}
        <Alert className="bg-purple-50 border-purple-200">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <AlertTitle className="text-purple-800">Free Enrichment - No API Keys Required</AlertTitle>
          <AlertDescription className="text-purple-700">
            This tool uses DuckDuckGo search and web scraping to find company information. 
            Select subcontractors and click "Enrich" to search for websites, logos, phone numbers, 
            and review links. Results require your approval before being applied.
          </AlertDescription>
        </Alert>

        {/* Error/Success Messages */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Error</AlertTitle>
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {/* Progress Indicator */}
        {enrichmentProgress && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">
                      Enriching {enrichmentProgress.currentName || 'subcontractors'}...
                    </span>
                    <span>
                      {enrichmentProgress.current} / {enrichmentProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(enrichmentProgress.current / enrichmentProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enrichment Results */}
        {enrichmentResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Enrichment Results</CardTitle>
              <CardDescription>
                Review the results below. Click "View Details" to approve or reject.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {enrichmentResults.map((result) => (
                  <div
                    key={result.id}
                    className={`p-4 rounded-lg border ${
                      result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-foreground">{result.name}</span>
                          {result.success ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </div>
                        {result.message && (
                          <p
                            className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}
                          >
                            {result.message}
                          </p>
                        )}
                        {result.error && (
                          <p className="text-sm text-red-700 font-medium">{result.error}</p>
                        )}
                      </div>
                      {result.success && result.enrichmentId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            let sub = subcontractors.find((s) => s.id === result.id)
                            // If not found in current list, fetch it or create minimal object
                            if (!sub) {
                              try {
                                const { data } = await supabase
                                  .from('subcontractors')
                                  .select('*')
                                  .eq('id', result.id)
                                  .single()
                                if (data) {
                                  sub = data as Subcontractor
                                } else {
                                  // Create minimal object from result data
                                  sub = {
                                    id: result.id,
                                    name: result.name,
                                    email: '',
                                    trade_category: '',
                                    location: '',
                                    created_at: '',
                                    phone: null,
                                    website_url: null,
                                    google_review_score: null,
                                    google_reviews_link: null,
                                    time_in_business: null,
                                    jobs_completed: null,
                                    licensed: null,
                                    bonded: null,
                                    notes: null,
                                    profile_picture_url: null,
                                    profile_summary: null,
                                    services: null,
                                    enrichment_status: null,
                                    enrichment_updated_at: null,
                                  }
                                }
                              } catch (err) {
                                console.error('Error fetching subcontractor:', err)
                                // Create minimal object as fallback
                                sub = {
                                  id: result.id,
                                  name: result.name,
                                  email: '',
                                  trade_category: '',
                                  location: '',
                                  created_at: '',
                                  phone: null,
                                  website_url: null,
                                  google_review_score: null,
                                  google_reviews_link: null,
                                  time_in_business: null,
                                  jobs_completed: null,
                                  licensed: null,
                                  bonded: null,
                                  notes: null,
                                  profile_picture_url: null,
                                  profile_summary: null,
                                  services: null,
                                  enrichment_status: null,
                                  enrichment_updated_at: null,
                                }
                              }
                            }
                            if (sub) {
                              fetchEnrichmentDetails(sub)
                            }
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      )}
                    </div>

                    {/* Fields Found */}
                    {result.fieldsFound && result.fieldsFound.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Data Found:</p>
                        <div className="flex flex-wrap gap-1">
                          {result.fieldsFound.map((field) => (
                            <Badge
                              key={field}
                              variant="outline"
                              className="text-xs bg-purple-50 border-purple-200 text-purple-700"
                            >
                              {formatFieldName(field)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Subcontractors to Enrich</CardTitle>
                <CardDescription>
                  {selectedIds.length > 0
                    ? `${selectedIds.length} selected`
                    : 'Select subcontractors to automatically enrich their data'}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={enrichBatch}
                  disabled={enriching || selectedIds.length === 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {enriching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enriching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Enrich Selected ({selectedIds.length})
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={fetchSubcontractors} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Search by name, email, or location"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    leftIcon={<Search className="h-4 w-4" />}
                  />
                </div>
                <div>
                  <Label htmlFor="trade">Trade Category</Label>
                  <select
                    id="trade"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={tradeFilter}
                    onChange={(e) => setTradeFilter(e.target.value)}
                  >
                    <option value="all">All Trades</option>
                    {tradeCategories.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="status">Enrichment Status</Label>
                  <select
                    id="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="none">Not Enriched</option>
                    <option value="complete">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </div>

              {/* Pagination Controls - Top */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    Showing {showingFrom}-{showingTo} of {totalCount}
                  </span>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages || loading}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Subcontractors List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={
                          filteredSubcontractors.length > 0 &&
                          filteredSubcontractors.every((sub) => selectedIds.includes(sub.id))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                      <span className="text-sm font-medium">
                        Select All on Page ({filteredSubcontractors.length})
                      </span>
                    </div>
                    {selectedIds.length > 0 && (
                      <span className="text-sm text-purple-600 font-medium">
                        {selectedIds.length} total selected
                      </span>
                    )}
                  </div>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {loading ? (
                    <div className="p-8 text-center">
                      <FallingBlocksLoader text="" size="sm" />
                    </div>
                  ) : filteredSubcontractors.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No subcontractors found
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredSubcontractors.map((sub) => (
                        <div key={sub.id}>
                          <div className="p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start space-x-4">
                              <Checkbox
                                checked={selectedIds.includes(sub.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectOne(sub.id, checked as boolean)
                                }
                                className="mt-1"
                              />
                              
                              {/* Logo/Avatar */}
                              <div className="flex-shrink-0">
                                {sub.profile_picture_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={sub.profile_picture_url}
                                    alt={sub.name}
                                    width={48}
                                    height={48}
                                    className="rounded-lg object-cover w-12 h-12"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.style.display = 'none'
                                      const fallback = target.nextElementSibling as HTMLElement
                                      if (fallback) fallback.style.display = 'flex'
                                    }}
                                  />
                                ) : null}
                                {!sub.profile_picture_url && (
                                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <Building2 className="h-6 w-6 text-gray-400" />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h3 className="font-medium text-foreground">{sub.name}</h3>
                                    <p className="text-sm text-muted-foreground">{sub.email}</p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">{sub.trade_category}</Badge>
                                    {getStatusBadge(sub.enrichment_status)}
                                    
                                    {/* View details button for enriched subs */}
                                    {sub.enrichment_status === 'complete' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => fetchEnrichmentDetails(sub)}
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
                                        Review
                                      </Button>
                                    )}
                                    
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => enrichSingle(sub.id)}
                                      disabled={enriching}
                                    >
                                      {enriching ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-4 w-4" />
                                      )}
                                    </Button>
                                    
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleRowExpanded(sub.id)}
                                    >
                                      {expandedRows.has(sub.id) ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* Quick info row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  <div className="flex items-center space-x-1 text-sm">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-muted-foreground truncate">{sub.location}</span>
                                  </div>
                                  <div className="flex items-center space-x-1 text-sm">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    <span className={sub.phone ? 'text-foreground' : 'text-muted-foreground'}>
                                      {sub.phone || 'No phone'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1 text-sm">
                                    <Globe className="h-3 w-3 text-muted-foreground" />
                                    <span className={sub.website_url ? 'text-foreground' : 'text-muted-foreground'}>
                                      {sub.website_url ? 'Has website' : 'No website'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1 text-sm">
                                    <Star className="h-3 w-3 text-muted-foreground" />
                                    <span className={sub.google_reviews_link ? 'text-foreground' : 'text-muted-foreground'}>
                                      {sub.google_reviews_link ? 'Has reviews' : 'No reviews'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded details */}
                          {expandedRows.has(sub.id) && (
                            <div className="px-4 pb-4 pt-0 bg-muted/30">
                              <div className="ml-16 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                {sub.profile_summary && (
                                  <div className="col-span-2">
                                    <Label className="text-xs text-muted-foreground">Summary</Label>
                                    <p className="mt-1">{sub.profile_summary}</p>
                                  </div>
                                )}
                                {sub.services && sub.services.length > 0 && (
                                  <div className="col-span-2">
                                    <Label className="text-xs text-muted-foreground">Services</Label>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {sub.services.map((service, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {service}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {sub.website_url && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Website</Label>
                                    <a
                                      href={sub.website_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-1 flex items-center text-blue-600 hover:underline"
                                    >
                                      <LinkIcon className="h-3 w-3 mr-1" />
                                      {sub.website_url}
                                    </a>
                                  </div>
                                )}
                                {sub.google_reviews_link && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Google Reviews</Label>
                                    <a
                                      href={sub.google_reviews_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-1 flex items-center text-blue-600 hover:underline"
                                    >
                                      <Star className="h-3 w-3 mr-1" />
                                      View on Google
                                    </a>
                                  </div>
                                )}
                                <div className="flex items-center space-x-4">
                                  {sub.licensed !== null && (
                                    <div className="flex items-center space-x-1">
                                      <Shield className={`h-4 w-4 ${sub.licensed ? 'text-green-600' : 'text-gray-400'}`} />
                                      <span>{sub.licensed ? 'Licensed' : 'Not licensed'}</span>
                                    </div>
                                  )}
                                  {sub.bonded !== null && (
                                    <div className="flex items-center space-x-1">
                                      <Shield className={`h-4 w-4 ${sub.bonded ? 'text-green-600' : 'text-gray-400'}`} />
                                      <span>{sub.bonded ? 'Bonded' : 'Not bonded'}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pagination Controls - Bottom */}
              {totalCount > pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    Showing {showingFrom}-{showingTo} of {totalCount}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages || loading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage >= totalPages || loading}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrichment Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span>Enrichment Results</span>
            </DialogTitle>
            <DialogDescription>
              Review the extracted data before approving or rejecting.
            </DialogDescription>
          </DialogHeader>

          {loadingEnrichment ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : selectedEnrichment ? (
            <div className="space-y-6">
              {/* Subcontractor Info */}
              {selectedSubcontractor && (
                <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
                  {selectedSubcontractor.profile_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedSubcontractor.profile_picture_url}
                      alt={selectedSubcontractor.name}
                      width={64}
                      height={64}
                      className="rounded-lg object-cover w-16 h-16"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const fallback = target.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  {!selectedSubcontractor.profile_picture_url && (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{selectedSubcontractor.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSubcontractor.trade_category} • {selectedSubcontractor.location}
                    </p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                {getStatusBadge(selectedEnrichment.status)}
              </div>

              {/* Logo Preview */}
              {selectedEnrichment.results_json?.logo_url && (
                <div className="space-y-2">
                  <Label className="flex items-center space-x-2">
                    <ImageIcon className="h-4 w-4" />
                    <span>Extracted Logo</span>
                  </Label>
                  <div className="p-4 bg-muted/50 rounded-lg flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedEnrichment.results_json.logo_url}
                      alt="Extracted logo"
                      className="rounded-lg object-contain max-h-[120px] max-w-[200px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const fallback = target.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                    <div 
                      className="hidden flex-col items-center justify-center p-4 bg-muted rounded-lg text-muted-foreground"
                      style={{ display: 'none' }}
                    >
                      <ImageIcon className="h-8 w-8 mb-2" />
                      <span className="text-xs">Failed to load image</span>
                    </div>
                    <a
                      href={selectedEnrichment.results_json.logo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View original URL
                    </a>
                  </div>
                  {selectedEnrichment.sources_json?.logo_url && (
                    <p className={`text-xs ${getConfidenceColor(selectedEnrichment.sources_json.logo_url.confidence)}`}>
                      Confidence: {Math.round(selectedEnrichment.sources_json.logo_url.confidence * 100)}%
                    </p>
                  )}
                </div>
              )}

              {/* Extracted Fields */}
              <div className="space-y-4">
                <Label>Extracted Data</Label>
                <div className="grid gap-3">
                  {selectedEnrichment.results_json &&
                    Object.entries(selectedEnrichment.results_json)
                      .filter(([key, value]) => value !== null && value !== undefined && key !== 'logo_url')
                      .map(([key, value]) => {
                        const source = selectedEnrichment.sources_json?.[key]
                        return (
                          <div key={key} className="p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground">
                                  {formatFieldName(key)}
                                </Label>
                                <div className="mt-1">
                                  {typeof value === 'boolean' ? (
                                    <Badge variant={value ? 'default' : 'secondary'}>
                                      {value ? 'Yes' : 'No'}
                                    </Badge>
                                  ) : Array.isArray(value) ? (
                                    <div className="space-y-1">
                                      {value.map((item, i) => {
                                        // If it's an array of URLs (like portfolio_links), show as links
                                        if (typeof item === 'string' && item.startsWith('http')) {
                                          return (
                                            <a
                                              key={i}
                                              href={item}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 hover:underline flex items-center text-sm block"
                                            >
                                              <ExternalLink className="h-3 w-3 mr-1" />
                                              {item.length > 60 ? item.substring(0, 60) + '...' : item}
                                            </a>
                                          )
                                        }
                                        // Otherwise show as badge
                                        return (
                                          <Badge key={i} variant="outline" className="text-xs">
                                            {item}
                                          </Badge>
                                        )
                                      })}
                                    </div>
                                  ) : typeof value === 'string' && value.startsWith('http') ? (
                                    <a
                                      href={value}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline flex items-center text-sm"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      {value.length > 50 ? value.substring(0, 50) + '...' : value}
                                    </a>
                                  ) : (
                                    <p className="text-sm">{String(value)}</p>
                                  )}
                                </div>
                              </div>
                              {source && (
                                <div className="text-right">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getConfidenceColor(source.confidence)}`}
                                  >
                                    {Math.round(source.confidence * 100)}%
                                  </Badge>
                                  {source.source_url && source.source_url !== 'DuckDuckGo search' && (
                                    <a
                                      href={source.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-xs text-muted-foreground hover:underline mt-1"
                                    >
                                      View source
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                </div>
              </div>

              {/* Error message if any */}
              {selectedEnrichment.error_message && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    {selectedEnrichment.error_message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No enrichment data found for this subcontractor.
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedEnrichment && selectedEnrichment.status === 'complete' && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={approvingOrRejecting}
                >
                  {approvingOrRejecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ThumbsDown className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={approvingOrRejecting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approvingOrRejecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4 mr-2" />
                  )}
                  Approve & Apply
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

