'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PublicLayout from '@/components/public-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, MapPin, Star, Grid3x3, List, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import { TRADE_CATEGORIES } from '@/lib/trade-types'

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

export default function BrowseSubcontractorsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [tradeFilter, setTradeFilter] = useState(searchParams.get('trade') || 'all')
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '')
  
  // Pagination
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'))
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

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
        router.replace(`/subcontractors/browse?${newParams.toString()}`, { scroll: false })
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
    setPage(1) // Reset to first page on new search
  }

  const handleTradeFilter = (value: string) => {
    setTradeFilter(value)
    setPage(1)
  }

  const handleLocationFilter = (value: string) => {
    setLocationFilter(value)
    setPage(1)
  }

  if (loading && subcontractors.length === 0) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <FallingBlocksLoader text="Loading subcontractors..." size="md" />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
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
                  {subcontractors.map((sub) => (
                    <Link key={sub.id} href={`/subcontractors/${sub.id}`}>
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                        <div className="aspect-video relative bg-gray-100 rounded-t-lg overflow-hidden">
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
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-1 truncate">{sub.name}</h3>
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
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{sub.location}</span>
                          </div>
                          <div className="flex gap-1 mt-2">
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
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {subcontractors.map((sub) => (
                    <Link key={sub.id} href={`/subcontractors/${sub.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="w-24 h-24 relative bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
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
                              <h3 className="font-semibold text-lg mb-1">{sub.name}</h3>
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
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <MapPin className="h-3 w-3" />
                                <span>{sub.location}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
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
      </div>
    </PublicLayout>
  )
}

