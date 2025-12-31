'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Upload, FileText, X, CheckCircle, AlertCircle, DollarSign } from 'lucide-react'
import FallingBlocksLoader from '@/components/ui/falling-blocks-loader'

export default function NewQuoteRequestPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [systemJobId, setSystemJobId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectName: '',
    projectLocation: '',
    workDescription: '',
    knownPricing: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  // Get system job ID for quote requests
  useEffect(() => {
    const fetchSystemJob = async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id')
        .eq('name', 'Subcontractor Quote Requests')
        .single()
      
      if (!error && data) {
        setSystemJobId(data.id)
      } else {
        console.error('Error fetching system job:', error)
        setError('Unable to initialize quote request. Please try again later.')
      }
    }
    
    if (user) {
      fetchSystemJob()
    }
  }, [user, supabase])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF, PNG, or JPEG file')
      return
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB')
      return
    }

    setSelectedFile(file)
    setError(null)

    // Auto-fill title from filename if not already filled
    if (!formData.title) {
      const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
      setFormData(prev => ({ ...prev, title: fileName }))
    }
  }

  const handleSubmit = async () => {
    if (!selectedFile || !user || !systemJobId) return

    if (!formData.workDescription.trim()) {
      setError('Please describe the work you need an estimate for')
      return
    }

    try {
      setUploading(true)
      setError(null)

      // Upload file to storage (reuse plans bucket)
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('plans')
        .upload(filePath, selectedFile)

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // Get number of pages for PDFs
      let numPages = 1
      if (selectedFile.type === 'application/pdf') {
        numPages = 1 // Will be updated after PDF processing
      }

      // Create plan record in database (using system job_id)
      const { data: plan, error: dbError } = await supabase
        .from('plans')
        .insert({
          job_id: systemJobId,
          created_by: user.id,
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          num_pages: numPages,
          title: formData.title || selectedFile.name,
          description: formData.description || null,
          project_name: formData.projectName || null,
          project_location: formData.projectLocation || null,
          status: 'ready'
        })
        .select()
        .single()

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('plans').remove([filePath])
        throw new Error(`Database error: ${dbError.message}`)
      }

      if (!plan?.id) {
        throw new Error('Failed to create plan record')
      }

      // Queue plan text chunk vectorization for RAG context (background job)
      // This runs automatically when plans are uploaded, so they're ready for chat
      if (plan.id) {
        import('@/lib/queue-plan-vectorization').then(({ queuePlanVectorization }) => {
          queuePlanVectorization(plan.id, systemJobId, 5).catch((err) => {
            console.error('Background vectorization queue trigger failed:', err)
          })
        })
      }

      // Parse known pricing (try to parse as JSON, otherwise store as text)
      let knownPricingJson: any = null
      if (formData.knownPricing.trim()) {
        try {
          knownPricingJson = JSON.parse(formData.knownPricing)
        } catch {
          // If not valid JSON, store as text in a structured format
          knownPricingJson = { text: formData.knownPricing }
        }
      }

      // Calculate estimated completion date (1 business day from now)
      const estimatedDate = new Date()
      estimatedDate.setDate(estimatedDate.getDate() + 1)
      // If it's a weekend, move to Monday
      if (estimatedDate.getDay() === 0) {
        estimatedDate.setDate(estimatedDate.getDate() + 1)
      } else if (estimatedDate.getDay() === 6) {
        estimatedDate.setDate(estimatedDate.getDate() + 2)
      }

      // Create quote request record
      const { data: quoteRequest, error: quoteError } = await supabase
        .from('quote_requests')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          work_description: formData.workDescription,
          known_pricing: knownPricingJson,
          status: 'pending',
          estimated_completion_date: estimatedDate.toISOString(),
          queued_at: new Date().toISOString()
        })
        .select()
        .single()

      if (quoteError) {
        throw new Error(`Failed to create quote request: ${quoteError.message}`)
      }

      // Submit quote request (this will send admin email)
      const submitResponse = await fetch('/api/quotes/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteRequestId: quoteRequest.id,
          planId: plan.id,
        }),
      })

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json()
        console.error('Error submitting quote request:', errorData)
        // Don't throw - the quote request was created, just email failed
      }

      setSuccess(true)
      
      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/dashboard/quotes')
      }, 3000)

    } catch (err) {
      console.error('Quote request error:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit quote request')
      setUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <FallingBlocksLoader />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Card className="border-2 border-green-500">
            <CardContent className="pt-12 pb-12 px-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Quote Request Submitted!</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Your quote request has been submitted successfully. You'll receive your PDF quote within 1 business day.
              </p>
              <Button
                onClick={() => router.push('/dashboard/quotes')}
                variant="orange"
                size="lg"
              >
                View My Quote Requests
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">New Quote Request</h1>
          <p className="text-gray-600 dark:text-gray-300">Upload plans and get a professional PDF quote ready to send to your clients</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quote Request Details</CardTitle>
            <CardDescription>
              Upload your plans and provide details about the work you need an estimate for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload Area */}
            {!selectedFile ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-orange-500 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    PDF, PNG, or JPEG (max 50MB)
                  </p>
                </label>
              </div>
            ) : (
              <div className="border-2 border-green-500 bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-green-500 text-white p-3 rounded-lg">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  {!uploading && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-200">Error</p>
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Plan Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Main Floor Plan, Site Layout"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  disabled={uploading}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="workDescription">Work Description *</Label>
                <Textarea
                  id="workDescription"
                  placeholder="Describe the work you need an estimate for. Be as detailed as possible..."
                  value={formData.workDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, workDescription: e.target.value }))}
                  disabled={uploading}
                  className="mt-1"
                  rows={5}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Explain what work needs to be done, any specific requirements, materials, etc.
                </p>
              </div>

              <div>
                <Label htmlFor="knownPricing">Known Pricing (Optional)</Label>
                <Textarea
                  id="knownPricing"
                  placeholder='Enter any pricing you already know. You can use JSON format like {"materials": 5000, "labor": 3000} or just plain text.'
                  value={formData.knownPricing}
                  onChange={(e) => setFormData(prev => ({ ...prev, knownPricing: e.target.value }))}
                  disabled={uploading}
                  className="mt-1 font-mono text-sm"
                  rows={4}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Optional: Add any pricing information you already have. Can be JSON or plain text.
                </p>
              </div>

              <div>
                <Label htmlFor="description">Additional Notes</Label>
                <Textarea
                  id="description"
                  placeholder="Add any additional notes about this plan..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={uploading}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    placeholder="e.g., Downtown Office Building"
                    value={formData.projectName}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                    disabled={uploading}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="projectLocation">Project Location</Label>
                  <Input
                    id="projectLocation"
                    placeholder="e.g., Seattle, WA"
                    value={formData.projectLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectLocation: e.target.value }))}
                    disabled={uploading}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Processing Time:</strong> Your quote will be processed within 1 business day. 
                You'll receive an email notification when your PDF quote is ready.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/quotes')}
                disabled={uploading}
              >
                Cancel
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={!selectedFile || !formData.title || !formData.workDescription || uploading || !systemJobId}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Quote Request
                  </>
                )}
              </Button>
            </div>

            {uploading && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-200">Submitting your quote request...</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      This may take a moment
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

