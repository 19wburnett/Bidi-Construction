'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Building2, Upload, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ProfileDropdown from '@/components/profile-dropdown'
import NotificationBell from '@/components/notification-bell'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...selectedFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      // Upload files to Supabase storage
      const fileUrls: string[] = []
      
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
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      // Send emails to subcontractors
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
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to create job request')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    router.push('/auth/login')
    return null
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
            <ProfileDropdown />
          </div>
        </div>
      </header>

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
                <Label htmlFor="files">Project Files (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Upload plans, specifications, or other project documents
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
    </div>
  )
}
