'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, Upload, ArrowLeft, X, CheckCircle, Users, Network, UserCheck } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'
import DashboardNavbar from '@/components/dashboard-navbar'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'
import SubcontractorSelectionModal from '@/components/subcontractor-selection-modal'

const TRADE_CATEGORIES = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'Roofing',
  'Flooring',
  'Painting',
  'Drywall',
  'Carpentry',
  'Concrete',
  'Landscaping',
  'Excavation',
  'Insulation',
  'Windows & Doors',
  'Siding',
  'Other'
]

const BUDGET_RANGES = [
  'Under $5,000',
  '$5,000 - $10,000',
  '$10,000 - $25,000',
  '$25,000 - $50,000',
  '$50,000 - $100,000',
  'Over $100,000'
]

export default function NewJobPage() {
  const [formData, setFormData] = useState({
    trade_category: '',
    location: '',
    description: '',
    budget_range: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [planFiles, setPlanFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [paymentType, setPaymentType] = useState<'subscription' | 'credits'>('subscription')
  const [userSubscriptionStatus, setUserSubscriptionStatus] = useState<string>('inactive')
  const [userCredits, setUserCredits] = useState<number>(0)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [creditsToPurchase, setCreditsToPurchase] = useState(1)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [recipientType, setRecipientType] = useState<'contacts_only' | 'network_only' | 'both' | 'selected'>('both')
  const [selectedContactSubs, setSelectedContactSubs] = useState<string[]>([])
  const [selectedNetworkSubs, setSelectedNetworkSubs] = useState<string[]>([])
  const [showSubSelectionModal, setShowSubSelectionModal] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
    } else {
      setIsCheckingAuth(false)
      // Check user's subscription status
      checkUserSubscription()
    }
  }, [user, router])


  const checkUserSubscription = async () => {
    if (!user) return
    
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('subscription_status, payment_type, credits')
        .eq('id', user.id)
        .single()
      
      if (userData) {
        setUserSubscriptionStatus(userData.subscription_status || 'inactive')
        setPaymentType(userData.payment_type || 'subscription')
        setUserCredits(userData.credits || 0)
      }
    } catch (error) {
      console.error('Error checking user subscription:', error)
    }
  }

  const handleSubcontractorSelection = (contacts: string[], network: string[]) => {
    setSelectedContactSubs(contacts)
    setSelectedNetworkSubs(network)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selectedFiles])
  }

  const handlePlanFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setPlanFiles(prev => [...prev, ...selectedFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removePlanFile = (index: number) => {
    setPlanFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      // Check if user has credits (for credit users) or active subscription
      if (paymentType === 'credits' && userCredits < 1) {
        setError('You need at least 1 credit to post a job. Please purchase credits first.')
        setLoading(false)
        return
      }

      if (paymentType === 'subscription' && userSubscriptionStatus !== 'active') {
        setError('You need an active subscription to post jobs. Please subscribe or switch to credits.')
        setLoading(false)
        return
      }

      // Upload files to Supabase storage
      const fileUrls: string[] = []
      const planFileUrls: string[] = []
      
      // Upload regular files
      for (const file of files) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `job-files/${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('job-files')
          .upload(filePath, file)

        if (uploadError) {
          throw uploadError
        }

        const { data: { publicUrl } } = supabase.storage
          .from('job-files')
          .getPublicUrl(filePath)

        fileUrls.push(publicUrl)
      }

      // Upload plan files
      for (const file of planFiles) {
        const fileExt = file.name.split('.').pop()
        const fileName = `plans-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `job-plans/${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('job-plans')
          .upload(filePath, file)

        if (uploadError) {
          throw uploadError
        }

        const { data: { publicUrl } } = supabase.storage
          .from('job-plans')
          .getPublicUrl(filePath)

        planFileUrls.push(publicUrl)
      }

      // If using credits, deduct one credit and create job
      if (paymentType === 'credits') {
        // Deduct credit from user account
        const { error: creditError } = await supabase
          .from('users')
          .update({ credits: userCredits - 1 })
          .eq('id', user.id)

        if (creditError) {
          throw new Error('Failed to deduct credit')
        }
      }

      // Create job request
      const { data, error: insertError } = await supabase
        .from('job_requests')
        .insert({
          gc_id: user.id,
          trade_category: formData.trade_category,
          location: formData.location,
          description: formData.description,
          budget_range: formData.budget_range,
          files: fileUrls.length > 0 ? fileUrls : null,
          plan_files: planFileUrls.length > 0 ? planFileUrls : null,
          status: 'collecting_bids',
          bid_collection_started_at: new Date().toISOString(),
          bid_collection_ends_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now
          payment_type: paymentType,
          payment_status: 'paid',
          credits_used: paymentType === 'credits' ? 1 : 0,
          recipient_type: recipientType,
          selected_network_subcontractors: recipientType === 'selected' && selectedNetworkSubs.length > 0 
            ? selectedNetworkSubs 
            : null,
          selected_contact_subcontractors: recipientType === 'selected' && selectedContactSubs.length > 0
            ? selectedContactSubs
            : null
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      // Send notification email to admin about new job posting
      try {
        const notificationResponse = await fetch('/api/send-job-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobRequestId: data.id,
            tradeCategory: formData.trade_category,
            location: formData.location,
            description: formData.description,
            budgetRange: formData.budget_range,
            gcEmail: user.email,
          }),
        })

        if (!notificationResponse.ok) {
          console.error('Failed to send notification email')
        }
      } catch (notificationError) {
        console.error('Error sending notification email:', notificationError)
      }

      // Check if user is admin with demo mode enabled
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin, demo_mode')
        .eq('id', user.id)
        .single()

      if (userData?.is_admin && userData?.demo_mode) {
        // Generate demo bids for admin users (async, don't wait)
        fetch('/api/generate-demo-bids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobRequestId: data.id,
            tradeCategory: formData.trade_category,
          }),
        }).then(response => {
          if (response.ok) {
            console.log('Demo bid generation started')
          } else {
            console.error('Failed to start demo bid generation')
          }
        }).catch(error => {
          console.error('Error starting demo bid generation:', error)
        })
      } else {
        // Send emails to subcontractors for regular users
        const emailResponse = await fetch('/api/send-job-emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobRequestId: data.id,
            tradeCategory: formData.trade_category,
            location: formData.location,
          }),
        })

        if (!emailResponse.ok) {
          console.error('Failed to send emails to subcontractors')
        } else {
          // Move job to active status after emails are sent
          await supabase
            .from('job_requests')
            .update({ status: 'active' })
            .eq('id', data.id)
        }
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to create job request')
    } finally {
      setLoading(false)
    }
  }

  const handlePurchaseCredits = async () => {
    if (!user) return

    setPurchaseLoading(true)
    setError('')

    try {
      const response = await fetch('/api/stripe/purchase-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          creditsToPurchase: creditsToPurchase,
        }),
      })

      const { url, error: stripeError } = await response.json()

      if (stripeError) {
        setError(stripeError)
      } else if (url) {
        // Redirect to Stripe checkout
        window.location.href = url
      }
    } catch (err) {
      setError('Failed to create checkout session')
    } finally {
      setPurchaseLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FallingBlocksLoader text="Checking authentication..." size="lg" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null
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
        showProfile={true}
      />

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Post a New Job Request</CardTitle>
            <CardDescription>
              Fill out the details below to connect with qualified subcontractors in your area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Payment Type Selection */}
              {userSubscriptionStatus !== 'active' && (
                <div className="space-y-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <Label className="text-base font-semibold">Choose Payment Method</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="subscription"
                        name="paymentType"
                        value="subscription"
                        checked={paymentType === 'subscription'}
                        onChange={(e) => setPaymentType(e.target.value as 'subscription' | 'credits')}
                        className="text-orange-600"
                      />
                      <Label htmlFor="subscription" className="font-medium">
                        Monthly Subscription ($100/month) - Unlimited jobs
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="credits"
                        name="paymentType"
                        value="credits"
                        checked={paymentType === 'credits'}
                        onChange={(e) => setPaymentType(e.target.value as 'subscription' | 'credits')}
                        className="text-orange-600"
                      />
                      <Label htmlFor="credits" className="font-medium">
                        Credits ($20 per credit) - Beta pricing
                      </Label>
                    </div>
                  </div>
                  {paymentType === 'subscription' && (
                    <p className="text-sm text-orange-700">
                      You'll be redirected to subscribe before posting this job.
                    </p>
                  )}
                  {paymentType === 'credits' && (
                    <div className="text-sm text-orange-700">
                      <p>You have {userCredits} credit{userCredits !== 1 ? 's' : ''} available.</p>
                      {userCredits < 1 && (
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-orange-600 font-medium">You need to purchase credits first.</p>
                          <Button 
                            size="sm" 
                            onClick={() => setShowCreditsModal(true)}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            Purchase Credits
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {userSubscriptionStatus === 'active' && (
                <div className="p-3 bg-black-50 rounded-lg border border-black-200">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-black-600" />
                    <span className="text-black-800 font-medium">Active Subscription</span>
                  </div>
                  <p className="text-sm text-black-700 mt-1">
                    You have unlimited job posting with your active subscription.
                  </p>
                </div>
              )}

              

              <div className="space-y-2">
                <Label htmlFor="trade_category">Trade Category *</Label>
                <Select
                  value={formData.trade_category}
                  onValueChange={(value) => handleInputChange('trade_category', value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a trade category" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  placeholder="e.g., San Francisco, CA or 94102"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Project Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project in detail. Include scope of work, timeline expectations, and any specific requirements..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_range">Budget Range *</Label>
                <Select
                  value={formData.budget_range}
                  onValueChange={(value) => handleInputChange('budget_range', value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your budget range" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_RANGES.map((range) => (
                      <SelectItem key={range} value={range}>
                        {range}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              <div className="space-y-2">
                <Label htmlFor="planFiles">Project Plans (Optional)</Label>
                <div className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center bg-orange-50">
                  <Building2 className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm text-orange-700 mb-2 font-medium">
                    Upload architectural plans, blueprints, or drawings
                  </p>
                  <p className="text-xs text-orange-600 mb-3">
                    These will be used for subcontractor annotations and bid notes
                  </p>
                  <input
                    type="file"
                    id="planFiles"
                    multiple
                    accept=".pdf,.dwg,.jpg,.jpeg,.png,.tiff"
                    onChange={handlePlanFileUpload}
                    className="hidden"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                    onClick={() => document.getElementById('planFiles')?.click()}
                  >
                    Choose Plan Files
                  </Button>
                </div>
                
                {planFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected Plan Files:</p>
                    {planFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-orange-50 p-2 rounded border border-orange-200">
                        <span className="text-sm text-orange-800">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-orange-600 hover:bg-orange-100"
                          onClick={() => removePlanFile(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="files">Project Files (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Upload specifications, contracts, or other project documents
                  </p>
                  <input
                    type="file"
                    id="files"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => document.getElementById('files')?.click()}
                  >
                    Choose Files
                  </Button>
                </div>
                
                {files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected Files:</p>
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                            {/* Recipient Selection */}
                            <div className="space-y-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <Label className="text-base font-semibold">Send Bid Request To *</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="recipient-both"
                      name="recipientType"
                      value="both"
                      checked={recipientType === 'both'}
                      onChange={(e) => setRecipientType(e.target.value as 'contacts_only' | 'network_only' | 'both' | 'selected')}
                      className="text-black"
                    />
                    <Label htmlFor="recipient-both" className="font-medium flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      All My Contacts & Bidi Network (Recommended)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="recipient-contacts"
                      name="recipientType"
                      value="contacts_only"
                      checked={recipientType === 'contacts_only'}
                      onChange={(e) => setRecipientType(e.target.value as 'contacts_only' | 'network_only' | 'both' | 'selected')}
                      className="text-black"
                    />
                    <Label htmlFor="recipient-contacts" className="font-medium flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      All My Contacts Only
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="recipient-network"
                      name="recipientType"
                      value="network_only"
                      checked={recipientType === 'network_only'}
                      onChange={(e) => setRecipientType(e.target.value as 'contacts_only' | 'network_only' | 'both' | 'selected')}
                      className="text-black"
                    />
                    <Label htmlFor="recipient-network" className="font-medium flex items-center">
                      <Network className="h-4 w-4 mr-1" />
                      All Bidi Network Only
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="recipient-selected"
                      name="recipientType"
                      value="selected"
                      checked={recipientType === 'selected'}
                      onChange={(e) => setRecipientType(e.target.value as 'contacts_only' | 'network_only' | 'both' | 'selected')}
                      className="text-black"
                    />
                    <Label htmlFor="recipient-selected" className="font-medium flex items-center">
                      <UserCheck className="h-4 w-4 mr-1" />
                      Select Specific Subcontractors
                    </Label>
                  </div>
                </div>
                <p className="text-sm text-orange-700">
                  {recipientType === 'both' && 'Job request will be sent to all matching contacts in both your network and Bidi network.'}
                  {recipientType === 'contacts_only' && 'Job request will only be sent to all matching contacts in your personal network.'}
                  {recipientType === 'network_only' && 'Job request will only be sent to all matching subcontractors in the Bidi network.'}
                  {recipientType === 'selected' && 'Choose exactly which subcontractors receive this bid request from both networks.'}
                </p>
              </div>

              {/* Select Specific Subcontractors */}
              {recipientType === 'selected' && (
                <div className="space-y-3 p-4 bg-black-50 rounded-lg border border-black-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Subcontractor Selection</Label>
                    {(selectedContactSubs.length > 0 || selectedNetworkSubs.length > 0) && (
                      <CheckCircle className="h-5 w-5 text-black-600" />
                    )}
                  </div>
                  
                  {!formData.trade_category ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600">
                        Please select a trade category first to choose subcontractors.
                      </p>
                    </div>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowSubSelectionModal(true)}
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        {selectedContactSubs.length + selectedNetworkSubs.length === 0
                          ? 'Select Subcontractors'
                          : `${selectedContactSubs.length + selectedNetworkSubs.length} Subcontractors Selected`
                        }
                      </Button>
                      
                      {(selectedContactSubs.length > 0 || selectedNetworkSubs.length > 0) && (
                        <div className="text-sm text-black-700 space-y-1">
                          {selectedContactSubs.length > 0 && (
                            <div className="flex items-center">
                              <Users className="h-3.5 w-3.5 mr-1.5" />
                              <span>{selectedContactSubs.length} from my contacts</span>
                            </div>
                          )}
                          {selectedNetworkSubs.length > 0 && (
                            <div className="flex items-center">
                              <Network className="h-3.5 w-3.5 mr-1.5" />
                              <span>{selectedNetworkSubs.length} from Bidi network</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}




              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Posting Job...' : 'Post Job Request'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">Purchase Credits</CardTitle>
                <CardDescription>
                  Buy credits to post job requests
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreditsModal(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-orange-600 mb-2">
                  Current Credits: {userCredits}
                </div>
                <p className="text-sm text-gray-600">
                  Each credit allows you to post one job request
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Credits to Purchase:
                </label>
                <select
                  value={creditsToPurchase}
                  onChange={(e) => setCreditsToPurchase(parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value={1}>1 Credit - $20</option>
                  <option value={5}>5 Credits - $100</option>
                  <option value={10}>10 Credits - $200</option>
                  <option value={25}>25 Credits - $500</option>
                  <option value={50}>50 Credits - $1,000</option>
                </select>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                    Beta Pricing
                  </span>
                </div>
                <p className="text-sm text-orange-700">
                  Credits never expire and can be used anytime
                </p>
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}

              <Button 
                onClick={handlePurchaseCredits}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                disabled={purchaseLoading}
              >
                {purchaseLoading ? 'Processing...' : `Purchase ${creditsToPurchase} Credit${creditsToPurchase > 1 ? 's' : ''} - $${creditsToPurchase * 20}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subcontractor Selection Modal */}
      <SubcontractorSelectionModal
        isOpen={showSubSelectionModal}
        onClose={() => setShowSubSelectionModal(false)}
        tradeCategory={formData.trade_category}
        location={formData.location}
        onConfirm={handleSubcontractorSelection}
        initialSelectedContacts={selectedContactSubs}
        initialSelectedNetwork={selectedNetworkSubs}
      />
    </div>
  )
}
