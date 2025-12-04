'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  FileText, 
  Plus, 
  Search,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

interface QuoteRequest {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  work_description: string | null
  known_pricing: any
  quote_pdf_path: string | null
  estimated_completion_date: string | null
  created_at: string
  completed_at: string | null
  plans: {
    id: string
    title: string | null
    file_name: string
    project_name: string | null
    project_location: string | null
  } | null
}

export default function QuotesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    if (user) {
      loadQuoteRequests()
    }
  }, [user])

  async function loadQuoteRequests() {
    try {
      if (!user) return

      const { data, error } = await supabase
        .from('quote_requests')
        .select(`
          *,
          plans (
            id,
            title,
            file_name,
            project_name,
            project_location
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setQuoteRequests(data || [])
    } catch (error) {
      console.error('Error loading quote requests:', error)
    } finally {
      setLoading(false)
    }
  }

  async function downloadQuote(quoteRequest: QuoteRequest) {
    if (!quoteRequest.quote_pdf_path) return

    try {
      // Extract path from quote_pdf_path (format: quote-pdfs/user_id/filename.pdf)
      const pathParts = quoteRequest.quote_pdf_path.split('/')
      const fileName = pathParts[pathParts.length - 1]
      const filePath = quoteRequest.quote_pdf_path.replace('quote-pdfs/', '')

      const { data, error } = await supabase.storage
        .from('quote-pdfs')
        .download(filePath)

      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'quote.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading quote:', error)
      alert('Failed to download quote PDF')
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      case 'processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
          <AlertCircle className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredQuotes = quoteRequests.filter(quote => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery || (
      (quote.plans?.title?.toLowerCase().includes(query)) ||
      (quote.plans?.file_name?.toLowerCase().includes(query)) ||
      (quote.plans?.project_name?.toLowerCase().includes(query)) ||
      (quote.plans?.project_location?.toLowerCase().includes(query)) ||
      (quote.work_description?.toLowerCase().includes(query))
    )
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FallingBlocksLoader />
      </div>
    )
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Quote Requests</h1>
            <p className="text-gray-600 dark:text-gray-300">Manage your quote requests and download completed quotes</p>
          </div>
          <Link href="/dashboard/quotes/new">
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              New Quote Request
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search quote requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
            >
              Pending
            </Button>
            <Button
              variant={statusFilter === 'processing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('processing')}
            >
              Processing
            </Button>
            <Button
              variant={statusFilter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('completed')}
            >
              Completed
            </Button>
          </div>
        </div>

        {/* Quote Requests Grid */}
        {filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {searchQuery || statusFilter !== 'all' ? 'No quote requests found' : 'No quote requests yet'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'Create your first quote request to get started'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Link href="/dashboard/quotes/new">
                    <Button className="bg-orange-500 hover:bg-orange-600">
                      <Plus className="h-4 w-4 mr-2" />
                      New Quote Request
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuotes.map(quote => (
              <Card key={quote.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 p-3 rounded-lg">
                      <FileText className="h-6 w-6" />
                    </div>
                    {getStatusBadge(quote.status)}
                  </div>

                  <h3 className="font-semibold text-lg mb-2 truncate dark:text-white">
                    {quote.plans?.title || quote.plans?.file_name || 'Untitled Plan'}
                  </h3>

                  {quote.plans?.project_name && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {quote.plans.project_name}
                    </p>
                  )}

                  {quote.plans?.project_location && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      📍 {quote.plans.project_location}
                    </p>
                  )}

                  {quote.work_description && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Work Description:</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {quote.work_description}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3 mr-1" />
                      Created: {formatDate(quote.created_at)}
                    </div>
                    {quote.estimated_completion_date && quote.status !== 'completed' && (
                      <div className="flex items-center text-xs text-orange-600 dark:text-orange-400">
                        <Clock className="h-3 w-3 mr-1" />
                        Est. Completion: {formatDate(quote.estimated_completion_date)}
                      </div>
                    )}
                    {quote.completed_at && (
                      <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed: {formatDate(quote.completed_at)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    {quote.status === 'completed' && quote.quote_pdf_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadQuote(quote)}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    )}
                    {quote.status !== 'completed' && (
                      <div className="flex-1 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {quote.status === 'pending' && 'Awaiting processing'}
                        {quote.status === 'processing' && 'Being processed'}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

