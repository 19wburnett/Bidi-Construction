'use client'

import { useState, useEffect } from 'react'
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
import BidNotesDisplay from '@/components/bid-notes-display'
import PatternSummary from '@/components/pattern-summary'
import EmailDraftButton from '@/components/email-draft-button'
import JobSummaryPanel from '@/components/job-summary-panel'
import DashboardNavbar from '@/components/dashboard-navbar'
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
  bid_notes?: BidNote[]
}

interface BidNote {
  id: string
  note_type: 'requirement' | 'concern' | 'suggestion' | 'timeline' | 'material' | 'other'
  category: string | null
  location: string | null
  content: string
  confidence_score: number
  created_at: string
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

  // Removed unnecessary database health check


  const fetchJobDetails = async () => {
    if (!params.id || !user) {
      console.log('Missing params.id or user:', { paramsId: params.id, user: !!user })
      return
    }

    console.log('Starting fetchJobDetails with:', { jobId: params.id, userId: user.id })
    setLoading(true)
    setError('')

    try {
      console.log('Step 1: Testing database connection...')
      
      // First, test if we can connect to the database
      const { data: testData, error: testError } = await supabase
        .from('job_requests')
        .select('id')
        .limit(1)
      
      console.log('Database connection test:', { testData, testError })
      
      if (testError) {
        console.error('Database connection failed:', testError)
        throw new Error('Database connection failed: ' + testError.message)
      }
      
      console.log('Step 2: Database connection successful, fetching job request details...')
      
      // Try a simpler query first to see if the issue is with the complex query
      console.log('Step 2a: Trying simple job query...')
      const { data: simpleJobData, error: simpleJobError } = await supabase
        .from('job_requests')
        .select('id, gc_id')
        .eq('id', params.id)
        .single()
      
      console.log('Simple job query result:', { simpleJobData, simpleJobError })
      
      if (simpleJobError) {
        console.error('Simple job query failed:', simpleJobError)
        throw simpleJobError
      }
      
      if (!simpleJobData) {
        throw new Error('Job not found')
      }
      
      if (simpleJobData.gc_id !== user.id) {
        throw new Error('You do not have access to this job')
      }
      
      console.log('Step 2b: Simple query successful, fetching full job details...')
      
      // Now try the full query
      const { data: jobData, error: jobError } = await supabase
        .from('job_requests')
        .select('*')
        .eq('id', params.id)
        .single()

      console.log('Job query result:', { jobData, jobError })

      if (jobError) {
        console.error('Error fetching job:', jobError)
        throw jobError
      }

      if (!jobData) {
        console.error('No job data found for ID:', params.id)
        throw new Error('Job not found')
      }

      console.log('Step 2: Job data fetched successfully:', jobData)
      setJobRequest(jobData)

      // Fetch bids for this job
      console.log('Step 3: Fetching bids for job:', params.id)
      
      // Add timeout to bids query
      const bidsTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Bids query timed out after 15 seconds')), 15000)
      })
      
      const bidsQueryPromise = supabase
        .from('bids')
        .select(`
          *,
          bid_notes (
            id,
            note_type,
            category,
            location,
            content,
            confidence_score,
            created_at
          )
        `)
        .eq('job_request_id', params.id)
        .order('created_at', { ascending: false })

      console.log('Executing bids query...')
      const { data: bidsData, error: bidsError } = await Promise.race([bidsQueryPromise, bidsTimeoutPromise]) as any

      console.log('Bids query result:', { bidsData, bidsError })

      if (bidsError) {
        console.error('Error fetching bids:', bidsError)
        throw bidsError
      }

      console.log('Step 4: Bids fetched successfully:', bidsData)
      setBids(bidsData || [])

      // Mark all bids for this job as seen (only if there are bids)
      if (bidsData && bidsData.length > 0) {
        console.log('Step 5: Marking bids as seen for job:', params.id)
        await markBidsAsSeen(bidsData)
      } else {
        console.log('Step 5: No bids found for this job')
      }

      console.log('Step 6: fetchJobDetails completed successfully')

    } catch (err: any) {
      console.error('Error in fetchJobDetails:', err)
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        details: err.details,
        hint: err.hint
      })
      
      // If it's a timeout error, try a different approach
      if (err.message.includes('timed out')) {
        console.log('Attempting fallback query...')
        try {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('job_requests')
            .select('id, trade_category, location, description, budget_range, created_at')
            .eq('id', params.id)
            .single()
          
          if (!fallbackError && fallbackData) {
            console.log('Fallback query successful:', fallbackData)
            setJobRequest({
              ...fallbackData,
              files: null // Add missing files property
            })
            setBids([]) // Set empty bids for now
            return
          }
        } catch (fallbackErr) {
          console.error('Fallback query also failed:', fallbackErr)
        }
      }
      
      setError(err.message || 'Failed to fetch job details')
    } finally {
      console.log('Step 7: Setting loading to false')
      setLoading(false)
    }
  }

  const markBidsAsSeen = async (bidsData: Bid[]) => {
    console.log('Starting markBidsAsSeen with bids:', bidsData.length)
    
    try {
      const bidIds = bidsData.map(bid => bid.id)
      console.log('Updating bid IDs:', bidIds)
      
      console.log('Step 5a: Updating bids table...')
      const { data: updateData, error: markSeenError } = await supabase
        .from('bids')
        .update({ seen: true })
        .in('id', bidIds)
        .select('id, seen')

      console.log('Bid update result:', { updateData, markSeenError })

      if (markSeenError) {
        console.error('Error marking bids as seen:', markSeenError)
        // Don't throw error here - this is not critical for the main functionality
        return
      }

      console.log('Step 5b: Successfully marked bids as seen:', updateData)
      
      // Also mark corresponding notifications as read
      if (user) {
        console.log('Step 5c: Updating notifications table...')
        const { error: notificationError } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .in('bid_id', bidIds)
        
        console.log('Notification update result:', { notificationError })
        
        if (notificationError) {
          console.error('Error marking notifications as read:', notificationError)
          // Don't throw error here - this is not critical for the main functionality
        } else {
          console.log('Step 5d: Successfully marked notifications as read')
        }
      }
      
      // Trigger refresh of seen status indicator
      console.log('Step 5e: Setting refresh trigger')
      setTimeout(() => {
        setRefreshTrigger(prev => prev + 1)
      }, 500)
      
      console.log('markBidsAsSeen completed successfully')
      
    } catch (err) {
      console.error('Error in markBidsAsSeen:', err)
      // Don't throw error here - this is not critical for the main functionality
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
          <FallingBlocksLoader text="Loading job details..." size="lg" />
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
          <CardContent className="text-center space-y-4">
            <div className="flex flex-col space-y-2">
              <Button 
                onClick={() => {
                  setError('')
                  setLoading(true)
                  fetchJobDetails()
                }}
                className="w-full"
              >
                Try Again
              </Button>
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">Back to Dashboard</Button>
              </Link>
            </div>
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
      <DashboardNavbar 
        title="Bidi"
        showBackButton={true}
        backButtonHref="/dashboard"
        backButtonText="Back to Dashboard"
        showCredits={false}
        showNotifications={true}
        showProfile={false}
      />

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        {/* Job Summary Panel */}
        {bids.length > 0 && jobRequest && (
          <JobSummaryPanel jobRequest={jobRequest} bids={bids} />
        )}

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
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="self-start sm:self-auto">
                {bids.length} {bids.length === 1 ? 'Bid' : 'Bids'}
              </Badge>
              {bids.length > 0 && jobRequest && (
                <EmailDraftButton jobRequest={jobRequest} bids={bids} />
              )}
            </div>
          </div>

          {/* Pattern Summary */}
          <PatternSummary bids={bids} />

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
                <Card key={bid.id} className="border-l-4 border-l-orange-500">
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
                        {bid.website && (
                          <div className="flex items-center space-x-2">
                            <Globe className="h-4 w-4 text-gray-500" />
                            <a 
                              href={bid.website.startsWith('http') ? bid.website : `https://${bid.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all"
                            >
                              {bid.website}
                            </a>
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
                    
                    {/* Categorized Notes Section */}
                    {bid.bid_notes && bid.bid_notes.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <BidNotesDisplay notes={bid.bid_notes} bidId={bid.id} />
                      </div>
                    )}
                    
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
