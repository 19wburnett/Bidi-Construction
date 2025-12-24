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
}

interface EnrichmentResult {
  id: string
  name: string
  success: boolean
  error?: string
  message?: string
  fieldsFound?: string[]
  fieldsUpdated?: string[]
}

export default function SubcontractorEnrichmentPage() {
  const supabase = createClient()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [isAdmin, setIsAdmin] = useState(false)
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [tradeFilter, setTradeFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [enrichmentResults, setEnrichmentResults] = useState<EnrichmentResult[]>([])
  const [enrichmentProgress, setEnrichmentProgress] = useState<{
    current: number
    total: number
    currentName: string
  } | null>(null)

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
      setLoading(false)
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
    }
  }, [authLoading, fetchSubcontractors, isAdmin])

  const filteredSubcontractors = subcontractors.filter((sub) => {
    const matchesSearch =
      !searchTerm ||
      sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.location.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTrade = tradeFilter === 'all' || sub.trade_category === tradeFilter

    return matchesSearch && matchesTrade
  })

  const selectedSubcontractors = filteredSubcontractors.filter((sub) =>
    selectedIds.includes(sub.id)
  )

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

      const message = data.message || `Successfully enriched ${data.subcontractor.name}`
      setSuccess(message)
      setEnrichmentResults([
        { 
          id: data.subcontractor.id, 
          name: data.subcontractor.name, 
          success: true,
          message: data.message,
          fieldsFound: data.fieldsFound || [],
          fieldsUpdated: data.fieldsUpdated || [],
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
      const message = successCount > 0
        ? `Successfully enriched ${successCount} of ${totalCount} subcontractors`
        : `No updates needed for ${totalCount} subcontractor(s)`
      setSuccess(message)
      setEnrichmentResults(
        (data.results || []).map((r: EnrichmentResult) => ({ ...r, success: true })).concat(
          (data.errors || []).map((e: EnrichmentResult) => ({ ...e, success: false }))
        )
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

  const isValidEmail = (email: string | null): boolean => {
    if (!email) return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  const getDataCompleteness = (sub: Subcontractor) => {
    let filled = 0
    let total = 9 // Now includes email

    if (isValidEmail(sub.email)) filled++
    if (sub.phone) filled++
    if (sub.website_url) filled++
    if (sub.google_review_score !== null) filled++
    if (sub.google_reviews_link) filled++
    if (sub.time_in_business) filled++
    if (sub.licensed !== null) filled++
    if (sub.bonded !== null) filled++
    if (sub.notes) filled++

    return { filled, total, percentage: Math.round((filled / total) * 100) }
  }

  const tradeCategories = Array.from(new Set(subcontractors.map((s) => s.trade_category))).sort()

  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace('Url', 'URL')
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
                Use Firecrawl to automatically find and populate subcontractor information
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
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>How it works</AlertTitle>
          <AlertDescription>
            This tool uses Firecrawl to search the web and extract information about your
            subcontractors. It will populate fields like phone numbers, websites, Google reviews,
            licensing status, and more. Select one or more subcontractors and click "Enrich
            Selected" to start.
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
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
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
                      className="bg-blue-600 h-2 rounded-full transition-all"
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
                Details about what information was found and updated
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
                    <div className="flex items-start justify-between mb-2">
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
                          <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                            {result.message}
                          </p>
                        )}
                        {result.error && (
                          <p className="text-sm text-red-700 font-medium">{result.error}</p>
                        )}
                      </div>
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
                              className="text-xs bg-blue-50 border-blue-200 text-blue-700"
                            >
                              {formatFieldName(field)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fields Updated */}
                    {result.fieldsUpdated && result.fieldsUpdated.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Fields Updated:</p>
                        <div className="flex flex-wrap gap-1">
                          {result.fieldsUpdated.map((field) => (
                            <Badge
                              key={field}
                              variant="default"
                              className="text-xs bg-green-600"
                            >
                              {formatFieldName(field)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No data found message */}
                    {result.success && 
                     (!result.fieldsFound || result.fieldsFound.length === 0) && 
                     (!result.fieldsUpdated || result.fieldsUpdated.length === 0) && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        No new information was found for this subcontractor.
                      </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Search by name, email, or location"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
              </div>

              {/* Subcontractors List */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 p-4 border-b">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={
                        filteredSubcontractors.length > 0 &&
                        filteredSubcontractors.every((sub) => selectedIds.includes(sub.id))
                      }
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium">
                      Select All ({filteredSubcontractors.length} shown)
                    </span>
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
                      {filteredSubcontractors.map((sub) => {
                        const completeness = getDataCompleteness(sub)
                        return (
                          <div
                            key={sub.id}
                            className="p-4 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start space-x-4">
                              <Checkbox
                                checked={selectedIds.includes(sub.id)}
                                onCheckedChange={(checked) =>
                                  handleSelectOne(sub.id, checked as boolean)
                                }
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <h3 className="font-medium text-foreground">{sub.name}</h3>
                                    <p className="text-sm text-muted-foreground">{sub.email}</p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline">{sub.trade_category}</Badge>
                                    <Badge
                                      variant={
                                        completeness.percentage >= 75
                                          ? 'default'
                                          : completeness.percentage >= 50
                                          ? 'secondary'
                                          : 'outline'
                                      }
                                    >
                                      {completeness.percentage}% Complete
                                    </Badge>
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
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                                  <div className="flex items-center space-x-1 text-sm">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span className={isValidEmail(sub.email) ? 'text-foreground' : 'text-red-600 font-medium'}>
                                      {isValidEmail(sub.email) ? sub.email : 'Missing email'}
                                    </span>
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
                                    <span className={sub.google_review_score ? 'text-foreground' : 'text-muted-foreground'}>
                                      {sub.google_review_score ? `${sub.google_review_score}★` : 'No reviews'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}



