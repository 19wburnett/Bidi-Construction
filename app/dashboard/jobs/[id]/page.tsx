'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, ArrowLeft, FileText, User, Phone, DollarSign, Calendar, MessageSquare, Download } from 'lucide-react'
import Link from 'next/link'
import NotificationBell from '@/components/notification-bell'
import SeenStatusIndicator from '@/components/seen-status-indicator'

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

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    if (params.id) {
      fetchJobDetails()
    }
  }, [user, params.id, router])

  const fetchJobDetails = async () => {
    if (!params.id || !user) return

    try {
      // Fetch job request details
      const { data: jobData, error: jobError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('id', params.id)
        .eq('gc_id', user.id)
        .single()

      if (jobError) {
        throw jobError
      }

      setJobRequest(jobData)

      // Fetch bids for this job
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('*')
        .eq('job_request_id', params.id)
        .order('created_at', { ascending: false })

      if (bidsError) {
        throw bidsError
      }

      setBids(bidsData || [])

      // Mark all bids for this job as seen
      if (bidsData && bidsData.length > 0) {
        console.log('Bids data:', bidsData)
        console.log('Bid seen status:', bidsData.map(bid => ({ id: bid.id, seen: bid.seen })))
        
        // Mark all bids for this job as seen (regardless of current seen status)
        console.log('Marking all bids as seen for job:', params.id)
        console.log('Bids to update:', bidsData.map(bid => ({ id: bid.id, job_request_id: bid.job_request_id })))
        
        // Try updating by specific bid IDs first
        const bidIds = bidsData.map(bid => bid.id)
        console.log('Updating specific bid IDs:', bidIds)
        
        const { data: updateData, error: markSeenError } = await supabase
          .from('bids')
          .update({ seen: true })
          .in('id', bidIds)
          .select('id, seen')

        console.log('Update result data:', updateData)
        console.log('Update result error:', markSeenError)

        if (markSeenError) {
          console.error('Error marking bids as seen:', markSeenError)
        } else {
          console.log('Successfully marked all bids as seen for job:', params.id)
          console.log('Updated bids:', updateData)
          
          // Also mark corresponding notifications as read
          const { error: notificationError } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .in('bid_id', bidIds)
          
          if (notificationError) {
            console.error('Error marking notifications as read:', notificationError)
          } else {
            console.log('Successfully marked notifications as read')
          }
          
          // Trigger refresh of seen status indicator after a short delay
          setTimeout(() => {
            setRefreshTrigger(prev => prev + 1)
          }, 500)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch job details')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not specified'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading job details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!jobRequest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Job Not Found</CardTitle>
            <CardDescription>
              This job request could not be found or you don't have permission to view it.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
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
          <div className="flex items-center space-x-2">
            <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bidi</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <NotificationBell />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        {/* Job Details */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
              <div className="flex-1">
                <CardTitle className="text-xl sm:text-2xl">{jobRequest.trade_category}</CardTitle>
                <CardDescription className="text-base sm:text-lg">
                  {jobRequest.location} • {jobRequest.budget_range}
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Badge variant="outline" className="self-start sm:self-auto">
                  {bids.length} {bids.length === 1 ? 'Bid' : 'Bids'} Received
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Project Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{jobRequest.description}</p>
              </div>
              
              {jobRequest.files && jobRequest.files.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Project Files</h3>
                  <div className="space-y-2">
                    {jobRequest.files.map((fileUrl, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <a 
                          href={fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center space-x-1"
                        >
                          <span>File {index + 1}</span>
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-sm text-gray-500">
                Posted on {formatDate(jobRequest.created_at)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bids Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Received Bids</h2>
            <Badge variant="secondary" className="self-start sm:self-auto">
              {bids.length} {bids.length === 1 ? 'Bid' : 'Bids'}
            </Badge>
          </div>

          {bids.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No bids yet</h3>
                <p className="text-gray-600">
                  Bids from subcontractors will appear here once they respond to your job request.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {bids.map((bid) => (
                <Card key={bid.id} className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {bid.subcontractor_name || bid.subcontractor_email}
                        </CardTitle>
                        <CardDescription className="break-all">
                          {bid.subcontractor_email}
                        </CardDescription>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-sm text-gray-500">
                          {formatDate(bid.created_at)}
                        </div>
                        {bid.bid_amount && (
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(bid.bid_amount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        {bid.phone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{bid.phone}</span>
                          </div>
                        )}
                        {bid.timeline && (
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{bid.timeline}</span>
                          </div>
                        )}
                        {bid.bid_amount && (
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium">{formatCurrency(bid.bid_amount)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        {bid.notes && (
                          <div>
                            <h4 className="font-medium text-sm mb-1">Notes:</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{bid.notes}</p>
                          </div>
                        )}
                        {bid.ai_summary && (
                          <div>
                            <h4 className="font-medium text-sm mb-1">AI Summary:</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                              {bid.ai_summary}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t">
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                          View Raw Email
                        </summary>
                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-700 whitespace-pre-wrap font-mono">
                          {bid.raw_email}
                        </div>
                      </details>
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
