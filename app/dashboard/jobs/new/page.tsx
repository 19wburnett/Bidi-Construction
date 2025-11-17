'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/app/providers'
import { 
  Building2, 
  ArrowLeft, 
  Loader2,
  CheckCircle,
  MapPin,
  DollarSign,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { pageVariants, formField, successCheck } from '@/lib/animations'

const PROJECT_TYPES = [
  'Residential',
  'Commercial',
  'Industrial',
  'Renovation',
  'New Construction',
  'Other'
]

export default function NewJobPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    budget_range: '',
    project_type: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('') // Clear error on input change
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      // Use API route to create job (ensures proper server-side authentication)
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          location: formData.location,
          budget_range: formData.budget_range || null,
          project_type: formData.project_type || null,
          status: 'draft'
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create job')
      }

      const data = result.data

      // Show success animation
      setSuccess(true)
      
      // Redirect after animation
      setTimeout(() => {
        router.push(`/dashboard/jobs/${data.id}`)
      }, 1000)

    } catch (err: any) {
      setError(err.message || 'Failed to create job')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            variants={successCheck}
            initial="initial"
            animate="animate"
            className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="h-8 w-8 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Created!</h2>
          <p className="text-gray-600">Redirecting to your new job...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-gray-50"
    >
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Job</h1>
          <p className="text-gray-600">Start a new project and upload plans to begin bidding</p>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-orange-600" />
              Job Details
            </CardTitle>
            <CardDescription>
              Fill out the basic information for your project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Job Name */}
              <motion.div
                variants={formField}
                whileFocus="focus"
                className="space-y-2"
              >
                <Label htmlFor="name">Job Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Downtown Office Renovation"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  className="transition-all duration-200"
                />
              </motion.div>

              {/* Location */}
              <motion.div
                variants={formField}
                whileFocus="focus"
                className="space-y-2"
              >
                <Label htmlFor="location" className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  Location *
                </Label>
                <Input
                  id="location"
                  placeholder="e.g., San Francisco, CA or 94102"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  required
                />
              </motion.div>

              {/* Project Type */}
              <motion.div
                variants={formField}
                whileFocus="focus"
                className="space-y-2"
              >
                <Label htmlFor="project_type">Project Type</Label>
                <Select
                  value={formData.project_type}
                  onValueChange={(value) => handleInputChange('project_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>

              {/* Budget Range */}
              <motion.div
                variants={formField}
                whileFocus="focus"
                className="space-y-2"
              >
                <Label htmlFor="budget_range" className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Budget Range
                </Label>
                <Input
                  id="budget_range"
                  placeholder="e.g. $40,000 with 10% contingency"
                  value={formData.budget_range}
                  onChange={(e) => handleInputChange('budget_range', e.target.value)}
                />
              </motion.div>

              {/* Description */}
              <motion.div
                variants={formField}
                whileFocus="focus"
                className="space-y-2"
              >
                <Label htmlFor="description" className="flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project in detail. Include scope of work, timeline expectations, and any specific requirements..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                />
              </motion.div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <p className="text-red-600 text-sm">{error}</p>
                </motion.div>
              )}

              {/* Submit Button */}
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="pt-4"
              >
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !formData.name || !formData.location}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Job...
                    </>
                  ) : (
                    'Create Job'
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>

        {/* Help Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Upload your construction plans</li>
            <li>• Run AI analysis for takeoff and quality checks</li>
            <li>• Create bid packages for different trades</li>
            <li>• Send to subcontractors and collect bids</li>
          </ul>
        </motion.div>
      </div>
    </motion.div>
  )
}

