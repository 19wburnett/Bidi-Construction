'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FileText, Upload, Trash2, CheckCircle, AlertCircle, Loader2, Star, StarOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { CostCode } from '@/lib/cost-code-helpers'

interface CustomCostCodeSet {
  id: string
  name: string
  file_name: string
  file_path: string
  file_type: 'pdf' | 'excel'
  is_default: boolean
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed'
  extraction_error: string | null
  cost_codes: CostCode[]
  created_at: string
  updated_at: string
}

export default function CustomCostCodesManager() {
  const [costCodeSets, setCostCodeSets] = useState<CustomCostCodeSet[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    fetchCostCodeSets()
    // Poll for status updates if any are processing
    const interval = setInterval(() => {
      const hasProcessing = costCodeSets.some(set => set.extraction_status === 'processing' || set.extraction_status === 'pending')
      if (hasProcessing) {
        fetchCostCodeSets()
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(interval)
  }, [])

  const fetchCostCodeSets = async () => {
    if (!user) return

    try {
      const response = await fetch('/api/cost-codes')
      const data = await response.json()
      
      if (data.success) {
        setCostCodeSets(data.costCodeSets || [])
      }
    } catch (error) {
      console.error('Error fetching cost code sets:', error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (uploadName.trim()) {
        formData.append('name', uploadName.trim())
      }

      const response = await fetch('/api/cost-codes/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        await fetchCostCodeSets()
        setUploadName('')
        alert('Cost code document uploaded successfully! Extraction is in progress.')
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (error: any) {
      console.error('Error uploading file:', error)
      alert(`Failed to upload file: ${error.message || 'Unknown error'}`)
    } finally {
      setIsUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleSetDefault = async (id: string) => {
    if (!confirm('Set this cost code set as your default? It will be used for all future takeoffs.')) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/cost-codes/${id}/set-default`, {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to set default`)
      }

      if (data.success) {
        await fetchCostCodeSets()
        alert('Default cost code set updated!')
      } else {
        throw new Error(data.error || 'Failed to set default')
      }
    } catch (error: any) {
      console.error('Error setting default:', error)
      alert(`Failed to set default: ${error.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cost code set? This action cannot be undone.')) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/cost-codes/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await fetchCostCodeSets()
        alert('Cost code set deleted successfully!')
      } else {
        throw new Error(data.error || 'Failed to delete')
      }
    } catch (error: any) {
      console.error('Error deleting cost code set:', error)
      alert(`Failed to delete: ${error.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string, error: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Upload Custom Cost Codes</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Upload a PDF or Excel document containing your custom cost codes. The AI will automatically extract and organize them for use in takeoffs.
        </p>
      </div>

      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>Supported formats: PDF, Excel (.xlsx, .xls), CSV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cost-code-name">Name (Optional)</Label>
            <Input
              id="cost-code-name"
              placeholder="e.g., Company Cost Codes 2024"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500">If not provided, the filename will be used</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-code-file">Select File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="cost-code-file"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="cursor-pointer"
              />
              {isUploading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            <p className="text-xs text-gray-500">Maximum file size: 10MB</p>
          </div>
        </CardContent>
      </Card>

      {/* Cost Code Sets List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Cost Code Sets</h3>
        
        {costCodeSets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No cost code sets uploaded yet.</p>
              <p className="text-sm mt-2">Upload a document above to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {costCodeSets.map((set) => (
              <Card key={set.id} className={set.is_default ? 'border-2 border-blue-500' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{set.name}</CardTitle>
                        {set.is_default && (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            <Star className="w-3 h-3 mr-1" />Default
                          </Badge>
                        )}
                        {getStatusBadge(set.extraction_status, set.extraction_error)}
                      </div>
                      <CardDescription>
                        {set.file_name} • {set.file_type.toUpperCase()} • {set.cost_codes?.length || 0} cost codes
                      </CardDescription>
                      {set.extraction_error && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                          Error: {set.extraction_error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!set.is_default && set.extraction_status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(set.id)}
                          disabled={isLoading}
                        >
                          <StarOff className="w-4 h-4 mr-1" />
                          Set as Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(set.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {set.extraction_status === 'completed' && set.cost_codes && set.cost_codes.length > 0 && (
                  <CardContent>
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Extracted Cost Codes ({set.cost_codes.length})</h4>
                      <div className="max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {set.cost_codes.slice(0, 20).map((code, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400 min-w-[80px]">
                                {code.fullCode || `${code.division}-${code.code}`}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300">{code.description}</span>
                            </div>
                          ))}
                          {set.cost_codes.length > 20 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 col-span-2">
                              ... and {set.cost_codes.length - 20} more
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
