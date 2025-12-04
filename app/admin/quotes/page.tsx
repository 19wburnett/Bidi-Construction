'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { FileText, Search, Clock, CheckCircle, ArrowLeft, Filter, Upload, Download, X, AlertCircle, User, Mail } from 'lucide-react'
import Link from 'next/link'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface QuoteRequest {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  work_description: string | null
  known_pricing: any
  quote_pdf_path: string | null
  estimated_completion_date: string | null
  created_at: string
  completed_at: string | null
  user_id: string
  plan_id: string
  plans: {
    id: string
    title: string | null
    file_name: string
    project_name: string | null
    project_location: string | null
  } | null
  users: {
    email: string
  } | null
}

export default function AdminQuotesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [filteredQuotes, setFilteredQuotes] = useState<QuoteRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (user) {
      checkAdminStatus()
      loadQuoteRequests()
    }
  }, [user])

  useEffect(() => {
    filterQuotes()
  }, [searchQuery, statusFilter, quoteRequests])

  async function checkAdminStatus() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin, role')
        .eq('id', user?.id)
        .single()

      if (error || (!data?.is_admin && data?.role !== 'admin')) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (error) {
      console.error('Error checking admin status:', error)
      router.push('/dashboard')
    }
  }

  async function loadQuoteRequests() {
    try {
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
          ),
          users!inner(email)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      // Transform the data
      const transformedData = (data || []).map(quote => ({
        ...quote,
        users: Array.isArray(quote.users) ? quote.users[0] : quote.users
      }))

      setQuoteRequests(transformedData)
    } catch (error) {
      console.error('Error loading quote requests:', error)
    } finally {
      setLoading(false)
    }
  }

  function filterQuotes() {
    let filtered = [...quoteRequests]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(q => q.status === statusFilter)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(q =>
        (q.plans?.title?.toLowerCase().includes(query)) ||
        (q.plans?.file_name?.toLowerCase().includes(query)) ||
        (q.plans?.project_name?.toLowerCase().includes(query)) ||
        (q.users?.email?.toLowerCase().includes(query)) ||
        (q.work_description?.toLowerCase().includes(query))
      )
    }

    setFilteredQuotes(filtered)
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      case 'processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Processing
        </Badge>
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <X className="h-3 w-3 mr-1" />
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

  function handleUploadClick(quote: QuoteRequest) {
    setSelectedQuote(quote)
    setSelectedFile(null)
    setError(null)
    setUploadDialogOpen(true)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB')
      return
    }

    setSelectedFile(file)
    setError(null)
  }

  async function handleUploadQuote() {
    if (!selectedFile || !selectedQuote || !user) return

    try {
      setUploading(true)
      setError(null)

      // Upload PDF to storage
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${selectedQuote.id}-${Date.now()}.${fileExt}`
      const filePath = `${selectedQuote.user_id}/${fileName}`
      const fullPath = `quote-pdfs/${filePath}`

      const { error: uploadError } = await supabase.storage
        .from('quote-pdfs')
        .upload(filePath, selectedFile)

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Update quote request
      const { error: updateError } = await supabase
        .from('quote_requests')
        .update({
          quote_pdf_path: fullPath,
          status: 'completed',
          completed_at: new Date().toISOString(),
          user_notified_at: new Date().toISOString()
        })
        .eq('id', selectedQuote.id)

      if (updateError) {
        // Clean up uploaded file
        await supabase.storage.from('quote-pdfs').remove([filePath])
        throw new Error(`Failed to update quote request: ${updateError.message}`)
      }

      // Send email notification to user
      try {
        const response = await fetch('/api/quotes/notify-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteRequestId: selectedQuote.id,
            quotePdfPath: fullPath
          })
        })

        if (!response.ok) {
          console.error('Failed to send notification email')
        }
      } catch (emailError) {
        console.error('Error sending notification email:', emailError)
      }

      // Refresh quote requests
      await loadQuoteRequests()
      setUploadDialogOpen(false)
      setSelectedQuote(null)
      setSelectedFile(null)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload quote')
    } finally {
      setUploading(false)
    }
  }

  async function downloadQuote(quote: QuoteRequest) {
    if (!quote.quote_pdf_path) return

    try {
      const pathParts = quote.quote_pdf_path.split('/')
      const filePath = pathParts.slice(1).join('/') // Remove bucket name

      const { data, error } = await supabase.storage
        .from('quote-pdfs')
        .download(filePath)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `quote-${quote.id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading quote:', error)
      alert('Failed to download quote PDF')
    }
  }

  if (loading) {
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
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/demo-settings" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Quote Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Review and process subcontractor quote requests
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by plan name, project, user email, or work description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quote Requests List */}
      {filteredQuotes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery || statusFilter !== 'all' ? 'No quote requests found' : 'No quote requests'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Quote requests will appear here when subcontractors submit them'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredQuotes.map(quote => (
            <Card key={quote.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-lg">
                        {quote.plans?.title || quote.plans?.file_name || 'Untitled Plan'}
                      </CardTitle>
                      {getStatusBadge(quote.status)}
                    </div>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        {quote.users?.email || 'Unknown'}
                      </span>
                      {quote.plans?.project_name && (
                        <span>{quote.plans.project_name}</span>
                      )}
                      {quote.plans?.project_location && (
                        <span>📍 {quote.plans.project_location}</span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {quote.status === 'completed' && quote.quote_pdf_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadQuote(quote)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    )}
                    {quote.status !== 'completed' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleUploadClick(quote)}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Quote
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quote.work_description && (
                    <div>
                      <Label className="text-sm font-semibold mb-1">Work Description</Label>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded">
                        {quote.work_description}
                      </p>
                    </div>
                  )}

                  {quote.known_pricing && (
                    <div>
                      <Label className="text-sm font-semibold mb-1">Known Pricing</Label>
                      <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto">
                        {typeof quote.known_pricing === 'object' 
                          ? JSON.stringify(quote.known_pricing, null, 2)
                          : String(quote.known_pricing)}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <p className="font-medium">{formatDate(quote.created_at)}</p>
                    </div>
                    {quote.estimated_completion_date && (
                      <div>
                        <span className="text-gray-500">Est. Completion:</span>
                        <p className="font-medium">{formatDate(quote.estimated_completion_date)}</p>
                      </div>
                    )}
                    {quote.completed_at && (
                      <div>
                        <span className="text-gray-500">Completed:</span>
                        <p className="font-medium text-green-600">{formatDate(quote.completed_at)}</p>
                      </div>
                    )}
                    <div>
                      <Link href={`/dashboard/plans/${quote.plan_id}`}>
                        <Button variant="outline" size="sm">
                          View Plan
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Quote PDF</DialogTitle>
            <DialogDescription>
              Upload the completed quote PDF for this request. The subcontractor will be notified automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedQuote && (
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                <p className="text-sm font-medium mb-1">Plan: {selectedQuote.plans?.title || selectedQuote.plans?.file_name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">User: {selectedQuote.users?.email}</p>
              </div>
            )}

            <div>
              <Label htmlFor="quote-file">Quote PDF *</Label>
              <Input
                id="quote-file"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                disabled={uploading}
                className="mt-1"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadDialogOpen(false)
                  setSelectedFile(null)
                  setError(null)
                }}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadQuote}
                disabled={!selectedFile || uploading}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

