'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, ArrowLeft, Upload, X } from 'lucide-react'
import Link from 'next/link'

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

interface JobRequest {
  id: string
  trade_category: string
  location: string
  description: string
  budget_range: string
  files: string[] | null
  created_at: string
}

export default function EditJobPage() {
  const [jobRequest, setJobRequest] = useState<JobRequest | null>(null)
  const [formData, setFormData] = useState({
    trade_category: '',
    location: '',
    description: '',
    budget_range: '',
  })
  const [files, setFiles] = useState<File[]>([])
  const [existingFiles, setExistingFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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
      const { data, error } = await supabase
        .from('job_requests')
        .select('*')
        .eq('id', params.id)
        .eq('gc_id', user.id)
        .single()

      if (error) {
        throw error
      }

      setJobRequest(data)
      setFormData({
        trade_category: data.trade_category,
        location: data.location,
        description: data.description,
        budget_range: data.budget_range,
      })
      setExistingFiles(data.files || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch job details')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selectedFiles])
  }

  const removeNewFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingFile = (index: number) => {
    setExistingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !jobRequest) return

    setSaving(true)
    setError('')

    try {
      // Upload new files to Supabase storage
      const newFileUrls: string[] = []
      
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

        newFileUrls.push(publicUrl)
      }

      // Combine existing files with new files
      const allFiles = [...existingFiles, ...newFileUrls]

      // Update job request
      const { error: updateError } = await supabase
        .from('job_requests')
        .update({
          trade_category: formData.trade_category,
          location: formData.location,
          description: formData.description,
          budget_range: formData.budget_range,
          files: allFiles.length > 0 ? allFiles : null,
        })
        .eq('id', jobRequest.id)
        .eq('gc_id', user.id)

      if (updateError) {
        throw updateError
      }

      // Redirect to job details page
      router.push(`/dashboard/jobs/${jobRequest.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to update job request')
    } finally {
      setSaving(false)
    }
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

  if (error && !jobRequest) {
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
              This job request could not be found or you don't have permission to edit it.
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
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Bidi</h1>
          </div>
          <Link href={`/dashboard/jobs/${jobRequest.id}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Job Details
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Edit Job Request</CardTitle>
            <CardDescription>
              Update the details of your job request. Changes will be reflected immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Existing Files */}
              {existingFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Current Project Files</Label>
                  <div className="space-y-2">
                    {existingFiles.map((fileUrl, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm">File {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeExistingFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Files */}
              <div className="space-y-2">
                <Label htmlFor="files">Add More Project Files (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Upload additional plans, specifications, or other project documents
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
                    <p className="text-sm font-medium">New Files to Add:</p>
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeNewFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center">{error}</div>
              )}

              <div className="flex space-x-4">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? 'Saving Changes...' : 'Save Changes'}
                </Button>
                <Link href={`/dashboard/jobs/${jobRequest.id}`} className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
