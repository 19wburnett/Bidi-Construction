'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardNavbar from '@/components/dashboard-navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, MapPin, Star, Grid3x3, List, ChevronLeft, ChevronRight, UserPlus, Check, Loader2 } from 'lucide-react'
import Image from 'next/image'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import { TRADE_CATEGORIES } from '@/lib/trade-types'
import { useAuth } from '@/app/providers'
import { createClient } from '@/lib/supabase'
import SubcontractorProfileModal from '@/components/subcontractor-profile-modal'

interface Subcontractor {
  id: string
  name: string
  email: string
  trade_category: string
  location: string
  google_review_score?: number | null
  licensed?: boolean | null
  bonded?: boolean | null
  primary_photo_url?: string | null
  profile_picture_url?: string | null
}

function DashboardBrowseSubcontractorsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const supabase = createClient()
  
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [addingToContacts, setAddingToContacts] = useState<Set<string>>(new Set())
  const [contactIds, setContactIds] = useState<Set<string>>(new Set())
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string | null>(null)
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [tradeFilter, setTradeFilter] = useState(searchParams.get('trade') || 'all')
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '')

  // Pagination
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'))
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Load existing contacts to check which subcontractors are already in contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (!user) return
      
      const { data: contacts } = await supabase
        .from('gc_contacts')
        .select('email')
        .eq('gc_id', user.id)

      if (contacts) {
        const emailSet = new Set(contacts.map(c => c.email))
        setContactIds(emailSet)
      }
    }

    loadContacts()
  }, [user, supabase])

  useEffect(() => {
    const fetchSubcontractors = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        if (search) params.append('search', search)
        if (tradeFilter && tradeFilter !== 'all') params.append('trade', tradeFilter)
        if (locationFilter) params.append('location', locationFilter)
        params.append('page', page.toString())
        params.append('limit', '24')

        const response = await fetch(`/api/subcontractors/browse?${params.toString()}`)
        
        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to load subcontractors')
          return
        }

        const data = await response.json()
        setSubcontractors(data.subcontractors || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotal(data.pagination?.total || 0)

        // Update URL without reload
        const newParams = new URLSearchParams(params)
        router.replace(`/dashboard/subcontractors/browse?${newParams.toString()}`, { scroll: false })
      } catch (err) {
        console.error('Error fetching subcontractors:', err)
        setError('Failed to load subcontractors')
      } finally {
        setLoading(false)
      }
    }

    fetchSubcontractors()
  }, [search, tradeFilter, locationFilter, page, router])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleTradeFilter = (value: string) => {
    setTradeFilter(value)
    setPage(1)
  }

  const handleLocationFilter = (value: string) => {
    setLocationFilter(value)
    setPage(1)
  }

  const handleAddToContacts = async (subcontractor: Subcontractor) => {
    if (!user) {
      setNotification({ type: 'error', message: 'Please sign in to add subcontractors to your contacts' })
      setTimeout(() => setNotification(null), 5000)
      return
    }

    setAddingToContacts(prev => new Set(prev).add(subcontractor.id))

    try {
      const response = await fetch('/api/gc-contacts/add-subcontractor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subcontractorId: subcontractor.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setNotification({ type: 'info', message: 'This subcontractor is already in your contacts list' })
          // Update contactIds to include this email
          setContactIds(prev => new Set(prev).add(subcontractor.email))
        } else {
          throw new Error(data.error || 'Failed to add to contacts')
        }
        setTimeout(() => setNotification(null), 5000)
        return
      }

      setNotification({ type: 'success', message: `${subcontractor.name} has been added to your contacts` })
      setTimeout(() => setNotification(null), 5000)

      // Update contactIds to include this email
      setContactIds(prev => new Set(prev).add(subcontractor.email))
    } catch (err) {
      console.error('Error adding to contacts:', err)
      setNotification({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Failed to add subcontractor to contacts' 
      })
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setAddingToContacts(prev => {
        const next = new Set(prev)
        next.delete(subcontractor.id)
        return next
      })
    }
  }

  const isInContacts = (subcontractor: Subcontractor) => {
    return contactIds.has(subcontractor.email)
  }

  if (loading && subcontractors.length === 0) {
    return (
      <>
        <DashboardNavbar title="Browse Subcontractors" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <FallingBlocksLoader text="Loading subcontractors..." size="md" />
        </div>
      </>
    )
  }

  return (
    <>
      <DashboardNavbar title="Browse Subcontractors" />
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-2">Browse Subcontractors</h1>
            <p className="text-gray-600">Find qualified subcontractors for your projects</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, trade, or location..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Trade Filter */}
              <Select value={tradeFilter} onValueChange={handleTradeFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="All Trades" />
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

              {/* Location Filter */}
              <Input
                placeholder="Filter by location..."
                value={locationFilter}
                onChange={(e) => handleLocationFilter(e.target.value)}
                className="w-full md:w-[200px]"
              />

              {/* View Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className="max-w-7xl mx-auto px-4 pt-4">
            <div className={`p-4 rounded-lg ${
              notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
              notification.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <p>{notification.message}</p>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {error ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-red-600">{error}</p>
              </CardContent>
            </Card>
          ) : subcontractors.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-gray-600">No subcontractors found matching your criteria.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Showing {subcontractors.length} of {total} subcontractors
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {subcontractors.map((sub) => {
                    const inContacts = isInContacts(sub)
                    const isAdding = addingToContacts.has(sub.id)
                    
                    return (
                      <Card key={sub.id} className="hover:shadow-lg transition-shadow h-full flex flex-col">
                        <div 
                          className="aspect-video relative bg-gray-100 rounded-t-lg overflow-hidden cursor-pointer"
                          onClick={() => setSelectedSubcontractorId(sub.id)}
                        >
                          {sub.primary_photo_url || sub.profile_picture_url ? (
                            <Image
                              src={sub.primary_photo_url || sub.profile_picture_url || ''}
                              alt={sub.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white text-2xl font-bold">
                              {sub.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <CardContent className="p-4 flex-1 flex flex-col">
                          <h3 
                            className="font-semibold text-lg mb-1 truncate cursor-pointer hover:text-orange-600"
                            onClick={() => setSelectedSubcontractorId(sub.id)}
                          >
                            {sub.name}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {sub.trade_category}
                            </Badge>
                            {sub.google_review_score && sub.google_review_score > 0 && (
                              <div className="flex items-center gap-1 text-sm">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span>{sub.google_review_score.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{sub.location}</span>
                          </div>
                          <div className="flex gap-1 mb-3 flex-wrap">
                            {sub.licensed && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                Licensed
                              </Badge>
                            )}
                            {sub.bonded && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                                Bonded
                              </Badge>
                            )}
                          </div>
                          <div className="mt-auto flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => setSelectedSubcontractorId(sub.id)}
                            >
                              View Profile
                            </Button>
                            {user && (
                              <Button
                                variant={inContacts ? "secondary" : "default"}
                                size="sm"
                                className="flex-1"
                                onClick={() => handleAddToContacts(sub)}
                                disabled={isAdding || inContacts}
                              >
                                {isAdding ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    Adding...
                                  </>
                                ) : inContacts ? (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    In Contacts
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    Add to Contacts
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {subcontractors.map((sub) => {
                    const inContacts = isInContacts(sub)
                    const isAdding = addingToContacts.has(sub.id)
                    
                    return (
                      <Card key={sub.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div 
                              className="w-24 h-24 relative bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                              onClick={() => setSelectedSubcontractorId(sub.id)}
                            >
                              {sub.primary_photo_url || sub.profile_picture_url ? (
                                <Image
                                  src={sub.primary_photo_url || sub.profile_picture_url || ''}
                                  alt={sub.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xl font-bold">
                                  {sub.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 
                                className="font-semibold text-lg mb-1 cursor-pointer hover:text-orange-600"
                                onClick={() => setSelectedSubcontractorId(sub.id)}
                              >
                                {sub.name}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="outline">{sub.trade_category}</Badge>
                                {sub.google_review_score && sub.google_review_score > 0 && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    <span>{sub.google_review_score.toFixed(1)}</span>
                                  </div>
                                )}
                                {sub.licensed && (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                    Licensed
                                  </Badge>
                                )}
                                {sub.bonded && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                                    Bonded
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                                <MapPin className="h-3 w-3" />
                                <span>{sub.location}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedSubcontractorId(sub.id)}
                                >
                                  View Profile
                                </Button>
                                {user && (
                                  <Button
                                    variant={inContacts ? "secondary" : "default"}
                                    size="sm"
                                    onClick={() => handleAddToContacts(sub)}
                                    disabled={isAdding || inContacts}
                                  >
                                    {isAdding ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Adding...
                                      </>
                                    ) : inContacts ? (
                                      <>
                                        <Check className="h-3 w-3 mr-1" />
                                        In Contacts
                                      </>
                                    ) : (
                                      <>
                                        <UserPlus className="h-3 w-3 mr-1" />
                                        Add to Contacts
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Profile Modal */}
        {selectedSubcontractorId && (
          <SubcontractorProfileModal
            subcontractorId={selectedSubcontractorId}
            isOpen={!!selectedSubcontractorId}
            onClose={() => setSelectedSubcontractorId(null)}
          />
        )}
      </div>
    </>
  )
}

export default function DashboardBrowseSubcontractorsPage() {
  return (
    <Suspense fallback={
      <>
        <DashboardNavbar title="Browse Subcontractors" />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <FallingBlocksLoader text="Loading..." size="md" />
        </div>
      </>
    }>
      <DashboardBrowseSubcontractorsPageContent />
    </Suspense>
  )
}
