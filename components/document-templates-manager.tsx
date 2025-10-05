'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FileText, Upload, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'

interface Template {
  id: string
  template_type: string
  file_name: string
  file_url: string
  created_at: string
  updated_at: string
}

export default function DocumentTemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTemplates(data)
    }
  }

  const handleFileUpload = async (
    type: 'master_sub_agreement' | 'coi',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    setUploadingType(type)
    setIsLoading(true)

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `templates/${user.id}/${type}_${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bid-documents')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bid-documents')
        .getPublicUrl(fileName)

      // Check if template already exists
      const { data: existingTemplate } = await supabase
        .from('document_templates')
        .select('id')
        .eq('user_id', user.id)
        .eq('template_type', type)
        .single()

      if (existingTemplate) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('document_templates')
          .update({
            file_name: file.name,
            file_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTemplate.id)

        if (updateError) throw updateError
      } else {
        // Insert new template
        const { error: insertError } = await supabase
          .from('document_templates')
          .insert({
            user_id: user.id,
            template_type: type,
            file_name: file.name,
            file_url: publicUrl
          })

        if (insertError) throw insertError
      }

      await fetchTemplates()
      alert('Template uploaded successfully!')

    } catch (error) {
      console.error('Error uploading template:', error)
      alert('Failed to upload template. Please try again.')
    } finally {
      setIsLoading(false)
      setUploadingType(null)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleDeleteTemplate = async (template: Template) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('document_templates')
        .delete()
        .eq('id', template.id)

      if (error) throw error

      await fetchTemplates()
      alert('Template deleted successfully!')

    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getTemplateByType = (type: string) => {
    return templates.find(t => t.template_type === type)
  }

  const templateTypes = [
    {
      type: 'master_sub_agreement',
      label: 'Master Subcontractor Agreement',
      description: 'Default agreement template used when accepting bids'
    },
    {
      type: 'coi',
      label: 'Certificate of Insurance (COI)',
      description: 'Default COI template used when accepting bids'
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Templates</CardTitle>
        <CardDescription>
          Upload default templates for faster bid acceptance. These will be automatically used when accepting bids.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {templateTypes.map(({ type, label, description }) => {
          const template = getTemplateByType(type)
          const isUploading = uploadingType === type

          return (
            <div key={type} className="space-y-3 pb-6 border-b last:border-b-0 last:pb-0">
              <div>
                <Label className="text-base font-medium">{label}</Label>
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              </div>

              {template ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-900">Template Uploaded</p>
                        <p className="text-sm text-green-700">{template.file_name}</p>
                        <p className="text-xs text-green-600 mt-1">
                          Updated: {new Date(template.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(template.file_url, '_blank')}
                        className="h-8"
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template)}
                        disabled={isLoading}
                        className="h-8 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-3">No template uploaded yet</p>
                      <div className="flex items-center space-x-2">
                        <Input
                          id={`upload-${type}`}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileUpload(type as any, e)}
                          disabled={isLoading}
                          className="hidden"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`upload-${type}`)?.click()}
                          disabled={isLoading}
                        >
                          <Upload className="h-3 w-3 mr-2" />
                          {isUploading ? 'Uploading...' : 'Upload Template'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Replace Template Option */}
              {template && (
                <div className="flex items-center space-x-2">
                  <Input
                    id={`replace-${type}`}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileUpload(type as any, e)}
                    disabled={isLoading}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.getElementById(`replace-${type}`)?.click()}
                    disabled={isLoading}
                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  >
                    <Upload className="h-3 w-3 mr-2" />
                    {isUploading ? 'Uploading...' : 'Replace Template'}
                  </Button>
                </div>
              )}
            </div>
          )
        })}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Templates Work</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Upload your standard documents once</li>
                <li>They'll be automatically used when accepting bids</li>
                <li>You can still upload custom documents per bid if needed</li>
                <li>Replace templates anytime to update the defaults</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
