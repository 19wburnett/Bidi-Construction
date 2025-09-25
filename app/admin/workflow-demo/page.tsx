'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { 
  Building2, 
  ArrowLeft, 
  Mail, 
  Send, 
  CheckCircle, 
  Clock, 
  Users, 
  DollarSign, 
  FileText,
  Download,
  Phone,
  Globe,
  Star,
  TrendingUp,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'

interface MockBid {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string
  website: string
  bidAmount: number
  timeline: string
  notes: string
  rating: number
  specialties: string[]
  responseTime: number
}

interface JobDetails {
  id: string
  tradeCategory: string
  location: string
  description: string
  budgetRange: string
  timeline: string
  squareFootage: string
}

const MOCK_BIDS: MockBid[] = [
  {
    id: '1',
    companyName: 'Elite Framing Solutions',
    contactName: 'Mike Rodriguez',
    email: 'mike@eliteframing.com',
    phone: '(801) 555-0123',
    website: 'www.eliteframing.com',
    bidAmount: 18500,
    timeline: '2-3 weeks',
    notes: 'We specialize in residential framing with 15+ years experience. Can start immediately.',
    rating: 4.8,
    specialties: ['Framing', 'Structural Work', 'Residential'],
    responseTime: 2
  },
  {
    id: '2',
    companyName: 'Utah Electric Pro',
    contactName: 'Sarah Chen',
    email: 'sarah@utahelectric.com',
    phone: '(801) 555-0456',
    website: 'www.utahelectric.com',
    bidAmount: 12500,
    timeline: '1-2 weeks',
    notes: 'Licensed electrician with 20+ years experience. All work guaranteed.',
    rating: 4.9,
    specialties: ['Electrical', 'Residential', 'Commercial'],
    responseTime: 5
  },
  {
    id: '3',
    companyName: 'Premier Drywall & Paint',
    contactName: 'David Thompson',
    email: 'david@premierdrywall.com',
    phone: '(801) 555-0789',
    website: 'www.premierdrywall.com',
    bidAmount: 8500,
    timeline: '1 week',
    notes: 'Family-owned business with 25+ years in drywall and finishing work.',
    rating: 4.7,
    specialties: ['Drywall', 'Painting', 'Finishing'],
    responseTime: 8
  },
  {
    id: '4',
    companyName: 'Mountain View Construction',
    contactName: 'James Wilson',
    email: 'james@mountainview.com',
    phone: '(801) 555-0321',
    website: 'www.mountainview.com',
    bidAmount: 22000,
    timeline: '3-4 weeks',
    notes: 'Full-service contractor. Can handle all trades for this project.',
    rating: 4.6,
    specialties: ['Framing', 'Electrical', 'Drywall', 'General Contracting'],
    responseTime: 12
  }
]

export default function WorkflowDemoPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [emailSent, setEmailSent] = useState(false)
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null)
  const [notifyingSubcontractors, setNotifyingSubcontractors] = useState(false)
  const [bids, setBids] = useState<MockBid[]>([])
  const [bidsReceived, setBidsReceived] = useState(0)
  const [showBidReport, setShowBidReport] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const steps = [
    'Email Interface',
    'Bidi Processing',
    'Subcontractor Notifications',
    'Bid Collection',
    'Bid Analysis',
    'Report Generation'
  ]

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }

    checkAdminStatus()
  }, [user, authLoading, router])

  const checkAdminStatus = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error checking admin status:', error)
        return
      }

      if (!data?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
    } catch (err) {
      console.error('Error checking admin status:', err)
    }
  }

  const handleSendEmail = () => {
    setEmailSent(true)
    setCurrentStep(1)
    
    // Simulate email processing
    setTimeout(() => {
      setJobDetails({
        id: 'demo-job-001',
        tradeCategory: 'Framing, Electrical, Drywall',
        location: 'Lehi, Utah',
        description: 'We need framing, electrical, and drywall for a 2,500 sq ft house in Lehi, Utah. Timeline: 3 weeks.',
        budgetRange: '$25,000 - $50,000',
        timeline: '3 weeks',
        squareFootage: '2,500 sq ft'
      })
      setCurrentStep(2)
    }, 2000)
  }

  const handleNotifySubcontractors = () => {
    setNotifyingSubcontractors(true)
    setCurrentStep(3)
    
    // Simulate subcontractor notifications
    setTimeout(() => {
      setNotifyingSubcontractors(false)
      setCurrentStep(4)
      startBidCollection()
    }, 3000)
  }

  const startBidCollection = () => {
    let bidIndex = 0
    const addBid = () => {
      if (bidIndex < MOCK_BIDS.length) {
        setBids(prev => [...prev, MOCK_BIDS[bidIndex]])
        setBidsReceived(prev => prev + 1)
        bidIndex++
        
        if (bidIndex < MOCK_BIDS.length) {
          setTimeout(addBid, 2000 + Math.random() * 3000) // 2-5 seconds between bids
        } else {
          setTimeout(() => {
            setCurrentStep(5)
          }, 2000)
        }
      }
    }
    
    addBid()
  }

  const handleGenerateReport = () => {
    setShowBidReport(true)
    setCurrentStep(6)
  }

  const resetDemo = () => {
    setCurrentStep(0)
    setEmailSent(false)
    setJobDetails(null)
    setNotifyingSubcontractors(false)
    setBids([])
    setBidsReceived(0)
    setShowBidReport(false)
  }

  if (authLoading) {
    return null
  }

  if (!user) {
    return null
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">You need admin privileges to access this page.</p>
              <Link href="/dashboard">
                <Button>Return to Dashboard</Button>
              </Link>
            </div>
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bidi Workflow Demo</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/admin/demo-settings">
              <Button variant="outline" className="hidden sm:flex">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              <Button variant="outline" size="sm" className="sm:hidden">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <NotificationBell />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Interactive Workflow Demo</h2>
            <Button onClick={resetDemo} variant="outline">
              Reset Demo
            </Button>
          </div>
          <div className="flex items-center space-x-4 overflow-x-auto">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index <= currentStep 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-4 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Email Interface */}
        {currentStep === 0 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <span>General Contractor Email</span>
              </CardTitle>
              <CardDescription>
                Simulate a general contractor sending a job request to Bidi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">From:</Label>
                      <Input value="gc@example.com" disabled className="bg-white" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">To:</Label>
                      <Input value="jobs@bidi.com" disabled className="bg-white" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Subject:</Label>
                      <Input value="New Job Request" disabled className="bg-white" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Message:</Label>
                      <Textarea 
                        value="We need framing, electrical, and drywall for a 2,500 sq ft house in Lehi, Utah. Timeline: 3 weeks."
                        disabled 
                        rows={4}
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
                <Button onClick={handleSendEmail} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Bidi Processing */}
        {currentStep === 1 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Bidi Received Your Request</span>
              </CardTitle>
              <CardDescription>
                Processing your job request and extracting details...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600">Analyzing job requirements and preparing to notify subcontractors...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Job Details Display */}
        {currentStep === 2 && jobDetails && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span>Job Details Processed</span>
              </CardTitle>
              <CardDescription>
                Bidi has successfully parsed and stored the job information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Trade Categories:</Label>
                    <p className="text-lg font-semibold text-gray-900">{jobDetails.tradeCategory}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Location:</Label>
                    <p className="text-lg font-semibold text-gray-900">{jobDetails.location}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Timeline:</Label>
                    <p className="text-lg font-semibold text-gray-900">{jobDetails.timeline}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Square Footage:</Label>
                    <p className="text-lg font-semibold text-gray-900">{jobDetails.squareFootage}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Budget Range:</Label>
                    <p className="text-lg font-semibold text-gray-900">{jobDetails.budgetRange}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Description:</Label>
                    <p className="text-sm text-gray-600">{jobDetails.description}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <Button onClick={handleNotifySubcontractors} className="w-full">
                  <Users className="h-4 w-4 mr-2" />
                  Notify Subcontractors
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Subcontractor Notifications */}
        {currentStep === 3 && notifyingSubcontractors && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Notifying Subcontractors</span>
              </CardTitle>
              <CardDescription>
                Sending job notifications to qualified subcontractors in the area
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">Sending notifications to subcontractors...</p>
                </div>
                <div className="space-y-2">
                  {['Elite Framing Solutions', 'Utah Electric Pro', 'Premier Drywall & Paint', 'Mountain View Construction'].map((company, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">{company}</span>
                      <span className="text-xs text-gray-500 ml-auto">Notified</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Bid Collection */}
        {currentStep === 4 && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <span>Collecting Bids</span>
              </CardTitle>
              <CardDescription>
                Subcontractors are responding with their bids ({bidsReceived}/4 received)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bids.filter(bid => bid).map((bid, index) => (
                  <div key={bid.id} className="border rounded-lg p-4 bg-white animate-fadeIn">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-lg">{bid.companyName}</h3>
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-sm text-gray-600">{bid.rating}</span>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>Contact:</strong> {bid.contactName}</p>
                            <p><strong>Phone:</strong> {bid.phone}</p>
                            <p><strong>Email:</strong> {bid.email}</p>
                          </div>
                          <div>
                            <p><strong>Bid Amount:</strong> <span className="text-green-600 font-semibold">${bid.bidAmount.toLocaleString()}</span></p>
                            <p><strong>Timeline:</strong> {bid.timeline}</p>
                            <p><strong>Response Time:</strong> {bid.responseTime} minutes</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{bid.notes}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {bidsReceived < 4 && (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-gray-600">Waiting for more bids...</p>
                  </div>
                )}
                {bidsReceived === 4 && (
                  <div className="text-center">
                    <Button onClick={handleGenerateReport} className="mt-4">
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Bid Report
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Bid Analysis */}
        {currentStep === 5 && (
          <Card className="max-w-6xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <span>Bid Analysis & Comparison</span>
              </CardTitle>
              <CardDescription>
                Bidi has analyzed all bids and prepared a comprehensive comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{bids.length}</div>
                    <div className="text-sm text-blue-800">Total Bids</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">${bids.length > 0 ? Math.min(...bids.filter(b => b).map(b => b.bidAmount)).toLocaleString() : '0'}</div>
                    <div className="text-sm text-green-800">Lowest Bid</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">${bids.length > 0 ? Math.max(...bids.filter(b => b).map(b => b.bidAmount)).toLocaleString() : '0'}</div>
                    <div className="text-sm text-orange-800">Highest Bid</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">${bids.length > 0 ? Math.round(bids.filter(b => b).reduce((sum, b) => sum + b.bidAmount, 0) / bids.filter(b => b).length).toLocaleString() : '0'}</div>
                    <div className="text-sm text-purple-800">Average Bid</div>
                  </div>
                </div>

                {/* Bid Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border p-3 text-left">Company</th>
                        <th className="border p-3 text-left">Bid Amount</th>
                        <th className="border p-3 text-left">Timeline</th>
                        <th className="border p-3 text-left">Rating</th>
                        <th className="border p-3 text-left">Response Time</th>
                        <th className="border p-3 text-left">Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bids.filter(bid => bid).map((bid) => (
                        <tr key={bid.id} className="hover:bg-gray-50">
                          <td className="border p-3">
                            <div>
                              <div className="font-semibold">{bid.companyName}</div>
                              <div className="text-sm text-gray-600">{bid.contactName}</div>
                            </div>
                          </td>
                          <td className="border p-3">
                            <div className="font-semibold text-green-600">${bid.bidAmount.toLocaleString()}</div>
                          </td>
                          <td className="border p-3">{bid.timeline}</td>
                          <td className="border p-3">
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              <span>{bid.rating}</span>
                            </div>
                          </td>
                          <td className="border p-3">{bid.responseTime} min</td>
                          <td className="border p-3">
                            <div className="text-sm">
                              <div>{bid.phone}</div>
                              <div className="text-blue-600">{bid.email}</div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-center">
                  <Button onClick={handleGenerateReport} size="lg">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Final Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 7: Report Generation */}
        {currentStep === 6 && showBidReport && (
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-600" />
                <span>Bid Report Generated</span>
              </CardTitle>
              <CardDescription>
                Final report has been generated and sent to the general contractor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Report Preview */}
                <div className="bg-gray-50 p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold mb-4">Bid Analysis Report</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Project Summary</h4>
                      <p className="text-sm text-gray-600">
                        {jobDetails?.tradeCategory} project in {jobDetails?.location} - {jobDetails?.squareFootage}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Bid Summary</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• {bids.length} qualified contractors responded</li>
                        <li>• Bid range: ${bids.length > 0 ? Math.min(...bids.filter(b => b).map(b => b.bidAmount)).toLocaleString() : '0'} - ${bids.length > 0 ? Math.max(...bids.filter(b => b).map(b => b.bidAmount)).toLocaleString() : '0'}</li>
                        <li>• Average bid: ${bids.length > 0 ? Math.round(bids.filter(b => b).reduce((sum, b) => sum + b.bidAmount, 0) / bids.filter(b => b).length).toLocaleString() : '0'}</li>
                        <li>• Fastest response: {bids.length > 0 ? Math.min(...bids.filter(b => b).map(b => b.responseTime)) : 0} minutes</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Recommended Contractor</h4>
                      <p className="text-sm text-gray-600">
                        Based on bid amount, timeline, and rating, we recommend <strong>{bids.length > 0 ? bids[0]?.companyName || 'Elite Framing Solutions' : 'Elite Framing Solutions'}</strong> 
                        with a bid of <strong>${bids.length > 0 ? bids[0]?.bidAmount?.toLocaleString() || '18,500' : '18,500'}</strong> and a {bids.length > 0 ? bids[0]?.timeline || '2-3 weeks' : '2-3 weeks'} timeline.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Email Simulation */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Email Sent to General Contractor</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    <p><strong>To:</strong> gc@example.com</p>
                    <p><strong>Subject:</strong> Bid Analysis Report - Lehi, Utah Project</p>
                    <p><strong>Status:</strong> Delivered ✓</p>
                  </div>
                </div>

                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center space-x-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Workflow Complete!</span>
                  </div>
                  <p className="text-gray-600">
                    The general contractor has received their comprehensive bid analysis report 
                    and can now make an informed decision on their project.
                  </p>
                  <div className="flex justify-center space-x-4">
                    <Button onClick={resetDemo} variant="outline">
                      Run Demo Again
                    </Button>
                    <Button onClick={() => window.print()}>
                      <Download className="h-4 w-4 mr-2" />
                      Print Report
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}
