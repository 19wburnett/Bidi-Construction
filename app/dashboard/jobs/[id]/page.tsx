'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, ArrowLeft, FileText, User, Phone, DollarSign, Calendar, MessageSquare, Download, Globe, Target, AlertTriangle, CheckCircle, TrendingUp, Users, Clock, Lightbulb, Package, AlertCircle, Star } from 'lucide-react'
import Link from 'next/link'
import NotificationBell from '@/components/notification-bell'
import SeenStatusIndicator from '@/components/seen-status-indicator'
import BidNotesDisplay from '@/components/bid-notes-display'
import BidLineItemsDisplay from '@/components/bid-line-items-display'
import EmailDraftButton from '@/components/email-draft-button'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import dynamic from 'next/dynamic'

// Dynamically import PlansViewer with SSR disabled to avoid DOMMatrix errors
const PlansViewer = dynamic(() => import('@/components/plans-viewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8">Loading plans viewer...</div>
})

// Dynamically import PlanAnnotatorModal with SSR disabled
const PlanAnnotatorModal = dynamic(() => import('@/components/plan-annotator-modal'), {
  ssr: false,
  loading: () => <div>Loading...</div>
})

// Dynamically import AcceptBidModal
const AcceptBidModal = dynamic(() => import('@/components/accept-bid-modal'), {
  ssr: false,
  loading: () => <div>Loading...</div>
})

interface JobRequest {
  id: string
  trade_category: string
  location: string
  description: string
  budget_range: string
  files: string[] | null
  plan_files: string[] | null
  created_at: string
  status?: string
  accepted_bid_id?: string | null
  closed_at?: string | null
}

interface BidLineItem {
  id: string
  item_number: number
  description: string
  category: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
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
  bid_line_items?: BidLineItem[]
  profile_picture_url?: string | null
  google_rating?: number | null
  google_review_count?: number | null
  status?: string
  accepted_at?: string | null
  declined_at?: string | null
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
  const [annotatorOpen, setAnnotatorOpen] = useState(false)
  const [selectedBidForAnnotation, setSelectedBidForAnnotation] = useState<string | null>(null)
  const [acceptBidModalOpen, setAcceptBidModalOpen] = useState(false)
  const [selectedBidForAcceptance, setSelectedBidForAcceptance] = useState<Bid | null>(null)
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
          ),
          bid_line_items (
            id,
            item_number,
            description,
            category,
            quantity,
            unit,
            unit_price,
            amount,
            notes
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
            .select('id, trade_category, location, description, budget_range, created_at, files, plan_files')
            .eq('id', params.id)
            .single()
          
          if (!fallbackError && fallbackData) {
            console.log('Fallback query successful:', fallbackData)
            setJobRequest({
              ...fallbackData,
              files: fallbackData.files || null,
              plan_files: fallbackData.plan_files || null
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
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-4xl">
        {/* Combined Job Overview, Project Summary & Key Insights */}
        <Card className="mb-8 border-l-4">
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
            <div className="space-y-6">
              {/* Project Overview Section */}
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

              {/* Project Summary & Key Insights Section */}
              {bids.length > 0 && (
                <>
                  <div className="border-t pt-6">
                    <h3 className="font-semibold mb-4 flex items-center">
                      <Target className="h-5 w-5 mr-2" />
                      Project Summary & Key Insights
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Analysis of {bids.length} bids for {jobRequest.trade_category} work in {jobRequest.location}
                    </p>
                    

                    {/* Key Insights from JobSummaryPanel */}
                    {(() => {
                      const allNotes = bids.flatMap(bid => 
                        (bid.bid_notes || []).map(note => ({
                          ...note,
                          contractor: bid.subcontractor_name || 'Unknown'
                        }))
                      )
                      
                      const summaryItems = generateSummaryItems(allNotes, bids, jobRequest.budget_range)
                      
                      if (summaryItems.length === 0) {
                        return null
                      }

                      const priorityConfig = {
                        high: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
                        medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
                        low: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle }
                      }

                      const typeConfig = {
                        concern: { icon: AlertTriangle, color: 'text-red-600' },
                        requirement: { icon: CheckCircle, color: 'text-green-600' },
                        suggestion: { icon: Lightbulb, color: 'text-yellow-600' },
                        cost_savings: { icon: DollarSign, color: 'text-green-600' },
                        timeline_issue: { icon: Clock, color: 'text-orange-600' }
                      }

                      return (
                        <div className="space-y-4">
                          {summaryItems.map((item, index) => {
                            const priorityStyle = priorityConfig[item.priority]
                            const typeStyle = typeConfig[item.type]
                            const Icon = typeStyle.icon
                            const PriorityIcon = priorityStyle.icon
                            
                            return (
                              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <Icon className={`h-4 w-4 ${typeStyle.color}`} />
                                    <Badge className={priorityStyle.color}>
                                      <PriorityIcon className="h-3 w-3 mr-1" />
                                      {item.priority.toUpperCase()}
                                    </Badge>
                                    {item.category && (
                                      <Badge variant="outline">
                                        {item.category}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <Users className="h-4 w-4" />
                                    <span>{item.count} contractor{item.count > 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                                
                                <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                                <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                                
                                <div className="text-xs text-gray-500">
                                  Mentioned by: {item.contractors.join(', ')}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plans Viewer */}
        {jobRequest.plan_files && jobRequest.plan_files.length > 0 && (
          <PlansViewer 
            jobRequestId={jobRequest.id}
            planFiles={jobRequest.plan_files}
            bids={bids.map(bid => ({
              id: bid.id,
              company_name: bid.subcontractor_name || 'Unknown Company',
              contact_name: bid.subcontractor_name || 'Unknown Contact',
              email: bid.subcontractor_email,
              phone: bid.phone || '',
              subcontractor_name: bid.subcontractor_name,
              subcontractor_email: bid.subcontractor_email,
              bid_notes: bid.bid_notes || []
            }))}
          />
        )}

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
                <Card key={bid.id} className="border-l-4">
                  <CardHeader>
                    <div className="flex flex-col gap-4">
                      {/* Top Row: Profile + Name + Date/Amount */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          {/* Profile Picture */}
                          <div className="flex-shrink-0">
                            {bid.profile_picture_url ? (
                              <img 
                                src={bid.profile_picture_url} 
                                alt={bid.subcontractor_name || 'Contractor'} 
                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-gray-200"
                              />
                            ) : (
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold text-lg sm:text-xl border-2 border-gray-200">
                                {(bid.subcontractor_name || bid.subcontractor_email).charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          
                          {/* Name and Email */}
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base sm:text-lg break-words">
                              {bid.subcontractor_name || bid.subcontractor_email}
                            </CardTitle>
                            <CardDescription className="break-all text-xs sm:text-sm">
                              {bid.subcontractor_email}
                            </CardDescription>
                          </div>
                        </div>
                        
                        {/* Bid Amount and Date */}
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                            {new Date(bid.created_at).toLocaleDateString()}
                          </div>
                          {bid.bid_amount && (
                            <div className="text-base sm:text-lg font-bold text-green-600 whitespace-nowrap">
                              {formatCurrency(bid.bid_amount)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Google Rating - Full Width on Mobile */}
                      {bid.google_rating && (
                        <div className="flex items-center space-x-1">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 sm:h-4 sm:w-4 ${
                                  star <= Math.round(bid.google_rating!)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-gray-700">
                            {bid.google_rating.toFixed(1)}
                          </span>
                          {bid.google_review_count && (
                            <span className="text-xs text-gray-500">
                              ({bid.google_review_count} reviews)
                            </span>
                          )}
                        </div>
                      )}
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
                        <BidNotesDisplay 
                          notes={bid.bid_notes} 
                          bidId={bid.id}
                          hasPlans={!!(jobRequest?.plan_files && jobRequest.plan_files.length > 0)}
                          onAnnotatePlans={() => {
                            setSelectedBidForAnnotation(bid.id)
                            setAnnotatorOpen(true)
                          }}
                        />
                      </div>
                    )}

                    {/* Line Items Breakdown Section */}
                    {bid.bid_line_items && bid.bid_line_items.length > 0 && (
                      <div className="mt-4">
                        <BidLineItemsDisplay 
                          lineItems={bid.bid_line_items}
                          totalAmount={bid.bid_amount}
                        />
                      </div>
                    )}
                    
                    {/* Accept Bid Button */}
                    {jobRequest?.status === 'active' && bid.status !== 'accepted' && bid.status !== 'declined' && (
                      <div className="mt-4 pt-4 border-t">
                        <Button 
                          onClick={() => {
                            setSelectedBidForAcceptance(bid)
                            setAcceptBidModalOpen(true)
                          }}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Accept This Bid
                        </Button>
                      </div>
                    )}
                    
                    {/* Status Badges */}
                    {(bid.status === 'accepted' || bid.status === 'declined') && (
                      <div className="mt-4 pt-4 border-t">
                        <Badge 
                          variant={bid.status === 'accepted' ? 'default' : 'secondary'}
                          className={bid.status === 'accepted' ? 'bg-green-600' : 'bg-gray-600'}
                        >
                          {bid.status === 'accepted' ? 'Accepted' : 'Declined'}
                        </Badge>
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

      {/* Plan Annotator Modal - Opens from bid notes */}
      {annotatorOpen && jobRequest?.plan_files && jobRequest.plan_files.length > 0 && (
        <PlanAnnotatorModal
          open={annotatorOpen}
          onOpenChange={setAnnotatorOpen}
          planFile={jobRequest.plan_files[0]} // Default to first plan file
          planFileName={jobRequest.plan_files[0].split('/').pop() || 'Plan'}
          bids={bids.map(bid => ({
            id: bid.id,
            subcontractor_name: bid.subcontractor_name,
            subcontractor_email: bid.subcontractor_email,
            bid_notes: bid.bid_notes || []
          }))}
          jobRequestId={jobRequest.id}
        />
      )}

      {/* Accept Bid Modal */}
      {selectedBidForAcceptance && jobRequest && (
        <AcceptBidModal
          open={acceptBidModalOpen}
          onOpenChange={setAcceptBidModalOpen}
          bid={selectedBidForAcceptance}
          jobRequestId={jobRequest.id}
          onAcceptSuccess={() => {
            // Refresh the page data
            fetchJobDetails()
          }}
        />
      )}
    </div>
  )
}

// Helper function for generating summary items (from JobSummaryPanel)
interface SummaryItem {
  type: 'concern' | 'requirement' | 'suggestion' | 'cost_savings' | 'timeline_issue'
  title: string
  description: string
  count: number
  contractors: string[]
  priority: 'high' | 'medium' | 'low'
  category?: string
}

function generateSummaryItems(notes: (BidNote & { contractor: string })[], bids: Bid[], budgetRange: string): SummaryItem[] {
  const items: SummaryItem[] = []
  
  // Group notes by similar content
  const groupedNotes = new Map<string, (BidNote & { contractor: string })[]>()
  
  notes.forEach(note => {
    const normalizedContent = note.content.toLowerCase().trim()
    const key = `${note.category || 'other'}-${note.note_type}-${normalizedContent}`
    
    if (!groupedNotes.has(key)) {
      groupedNotes.set(key, [])
    }
    groupedNotes.get(key)!.push(note)
  })

  // Analyze patterns
  const requirements = notes.filter(n => n.note_type === 'requirement')
  const concerns = notes.filter(n => n.note_type === 'concern')
  const suggestions = notes.filter(n => n.note_type === 'suggestion')
  const timelineNotes = notes.filter(n => n.note_type === 'timeline')

  // Cost analysis
  const bidAmounts = bids.map(b => b.bid_amount).filter(Boolean) as number[]
  if (bidAmounts.length > 1) {
    const minBid = Math.min(...bidAmounts)
    const maxBid = Math.max(...bidAmounts)
    const avgBid = bidAmounts.reduce((sum, amount) => sum + amount, 0) / bidAmounts.length
    const savings = maxBid - minBid
    
    if (savings > 0) {
      items.push({
        type: 'cost_savings',
        title: 'Potential Cost Savings Identified',
        description: `Bid range: $${minBid.toLocaleString()} - $${maxBid.toLocaleString()}. Potential savings of $${savings.toLocaleString()} by choosing the lowest bid.`,
        count: bidAmounts.length,
        contractors: bids.filter(b => b.bid_amount === minBid).map(b => b.subcontractor_name || 'Unknown'),
        priority: savings > avgBid * 0.2 ? 'high' : 'medium',
        category: 'Pricing'
      })
    }
  }

  // Timeline analysis
  const timelineIssues = timelineNotes.filter(n => 
    n.content.toLowerCase().includes('tight') || 
    n.content.toLowerCase().includes('delay') ||
    n.content.toLowerCase().includes('extend')
  )
  
  if (timelineIssues.length > 0) {
    const contractors = Array.from(new Set(timelineIssues.map(n => n.contractor)))
    items.push({
      type: 'timeline_issue',
      title: 'Timeline Concerns Raised',
      description: 'Multiple contractors have raised concerns about project timeline or potential delays.',
      count: contractors.length,
      contractors,
      priority: 'high',
      category: 'Timeline'
    })
  }

  // Requirements analysis
  const requirementCategories = requirements.reduce((acc, note) => {
    const category = note.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(note)
    return acc
  }, {} as Record<string, (BidNote & { contractor: string })[]>)

  Object.entries(requirementCategories).forEach(([category, reqs]) => {
    if (reqs.length >= 2) {
      const contractors = Array.from(new Set(reqs.map(n => n.contractor)))
      items.push({
        type: 'requirement',
        title: `${category} Requirements Consensus`,
        description: `Multiple contractors agree on specific ${category.toLowerCase()} requirements for this project.`,
        count: contractors.length,
        contractors,
        priority: reqs.length >= 3 ? 'high' : 'medium',
        category
      })
    }
  })

  // Concerns analysis
  const concernCategories = concerns.reduce((acc, note) => {
    const category = note.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(note)
    return acc
  }, {} as Record<string, (BidNote & { contractor: string })[]>)

  Object.entries(concernCategories).forEach(([category, concerns]) => {
    if (concerns.length >= 2) {
      const contractors = Array.from(new Set(concerns.map(n => n.contractor)))
      items.push({
        type: 'concern',
        title: `${category} Concerns Identified`,
        description: `Multiple contractors have raised concerns about ${category.toLowerCase()} aspects of this project.`,
        count: contractors.length,
        contractors,
        priority: 'high',
        category
      })
    }
  })

  // Suggestions analysis
  const suggestionCategories = suggestions.reduce((acc, note) => {
    const category = note.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(note)
    return acc
  }, {} as Record<string, (BidNote & { contractor: string })[]>)

  Object.entries(suggestionCategories).forEach(([category, suggestions]) => {
    if (suggestions.length >= 2) {
      const contractors = Array.from(new Set(suggestions.map(n => n.contractor)))
      items.push({
        type: 'suggestion',
        title: `${category} Improvement Suggestions`,
        description: `Multiple contractors have suggested improvements for ${category.toLowerCase()} aspects of this project.`,
        count: contractors.length,
        contractors,
        priority: 'medium',
        category
      })
    }
  })

  // Sort by priority and count
  return items.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    }
    return b.count - a.count
  })
}
