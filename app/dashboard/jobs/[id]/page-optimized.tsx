'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, ArrowLeft, FileText, User, Phone, DollarSign, Calendar, MessageSquare, Download, Globe } from 'lucide-react'
import Link from 'next/link'
import NotificationBell from '@/components/notification-bell'
import SeenStatusIndicator from '@/components/seen-status-indicator'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

interface JobRequest {
  id: string
  trade_category: string
  location: string
  description: string
  budget_range: string
  files: string[] | null
  created_at: string
}

interface Bid {
  id: string
  subcontractor_email: string
  subcontractor_name: string | null
  phone: string | null
  website: string | null
  bid_amount: number | null
  timeline: string | null
  notes: string | null
  ai_summary: string | null
  raw_email: string
  created_at: string
  seen: boolean
}

export default function JobDetailsPage() {
  const [jobRequest, setJobRequest] = useState<JobRequest | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const fetchJobDetails = useCallback(async () => {
    if (!params.id || !user) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Fetch job data and bids in parallel for better performance
      const [jobResult, bidsResult] = await Promise.all([
        supabase
          .from('job_requests')
          .select('*')
          .eq('gc_id', user.id)
          .eq('id', params.id)
          .single(),
        supabase
          .from('bids')
          .select('*')
          .eq('job_request_id', params.id)
          .order('created_at', { ascending: false })
      ])

      if (jobResult.error) {
        throw new Error('Job not found')
      }

      if (!jobResult.data) {
        throw new Error('Job not found')
      }

      setJobRequest(jobResult.data)
      setBids(bidsResult.data || [])

      // Mark all bids as seen if there are any
      if (bidsResult.data && bidsResult.data.length > 0) {
        await markBidsAsSeen(bidsResult.data)
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load job details')
    } finally {
      setLoading(false)
    }
  }, [params.id, user, supabase])

  const markBidsAsSeen = useCallback(async (bidsToMark: Bid[]) => {
    try {
      const bidIds = bidsToMark.map(bid => bid.id)
      await supabase
        .from('bids')
        .update({ seen: true })
        .in('id', bidIds)
    } catch (err) {
      // Silent error handling
    }
  }, [supabase])

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    if (params.id) {
      fetchJobDetails()
    }
  }, [user, params.id, router, fetchJobDetails])

  // Memoize expensive calculations
  const stats = useMemo(() => {
    const totalBids = bids.length
    const unseenBids = bids.filter(bid => !bid.seen).length
    const avgBidAmount = bids.length > 0 
      ? bids.reduce((sum, bid) => sum + (bid.bid_amount || 0), 0) / bids.length 
      : 0

    return {
      totalBids,
      unseenBids,
      avgBidAmount: Math.round(avgBidAmount)
    }
  }, [bids])

  const formatCurrency = useCallback((amount: number | null) => {
    if (!amount) return 'Not specified'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FallingBlocksLoader text="Loading job details..." size="lg" />
          <p>Loading job details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Job</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{error}</p>
            <div className="flex space-x-2">
              <Button onClick={fetchJobDetails} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!jobRequest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Job Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">The job you're looking for doesn't exist or you don't have permission to view it.</p>
            <Button onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Building2 className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Job Details</h1>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Job Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{jobRequest.trade_category}</CardTitle>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {jobRequest.location}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {jobRequest.budget_range}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(jobRequest.created_at)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-gray-700 leading-relaxed">{jobRequest.description}</p>
                  </div>
                  
                  {jobRequest.files && jobRequest.files.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Attachments</h3>
                      <div className="space-y-2">
                        {jobRequest.files.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{file}</span>
                            <Button size="sm" variant="outline">
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats and Actions */}
          <div className="space-y-6">
            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Bids Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{stats.totalBids}</div>
                  <div className="text-sm text-gray-600">Total Bids</div>
                </div>
                
                {stats.unseenBids > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{stats.unseenBids}</div>
                    <div className="text-sm text-gray-600">New Bids</div>
                  </div>
                )}
                
                {stats.avgBidAmount > 0 && (
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{formatCurrency(stats.avgBidAmount)}</div>
                    <div className="text-sm text-gray-600">Avg Bid Amount</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" onClick={() => setRefreshTrigger(prev => prev + 1)}>
                  Refresh Bids
                </Button>
                <Link href={`/dashboard/jobs/${jobRequest.id}/edit`} className="block">
                  <Button variant="outline" className="w-full">
                    Edit Job
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bids Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Bids ({stats.totalBids})
            </h2>
            {stats.unseenBids > 0 && (
              <Badge variant="destructive">
                {stats.unseenBids} New
              </Badge>
            )}
          </div>

          {bids.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No bids yet</h3>
                <p className="text-gray-600">
                  Bids from subcontractors will appear here once they start responding to your job posting.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {bids.map((bid) => (
                <Card key={bid.id} className={`${!bid.seen ? 'border-blue-200 bg-blue-50' : ''}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {bid.subcontractor_name || 'Unknown Subcontractor'}
                          </CardTitle>
                          <CardDescription>{bid.subcontractor_email}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        {bid.bid_amount && (
                          <div className="text-xl font-bold text-green-600">
                            {formatCurrency(bid.bid_amount)}
                          </div>
                        )}
                        <div className="text-sm text-gray-500">
                          {formatDate(bid.created_at)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {bid.timeline && (
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1">Timeline</h4>
                          <p className="text-gray-600">{bid.timeline}</p>
                        </div>
                      )}
                      
                      {bid.notes && (
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1">Notes</h4>
                          <p className="text-gray-600">{bid.notes}</p>
                        </div>
                      )}
                      
                      {bid.ai_summary && (
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1">AI Summary</h4>
                          <p className="text-gray-600 bg-gray-50 p-3 rounded">{bid.ai_summary}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 pt-4 border-t">
                        {bid.phone && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4" />
                            <span>{bid.phone}</span>
                          </div>
                        )}
                        
                        {bid.website && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Globe className="h-4 w-4" />
                            <a 
                              href={bid.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Website
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
