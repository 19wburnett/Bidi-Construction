'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import EmailTemplateEditor from '@/components/email-template-editor'
import { Mail, Plus, Edit, Trash2, Star, Loader2 } from 'lucide-react'
import { generatePreviewHtml } from '@/lib/email-templates/preview'

interface EmailTemplate {
  id: string
  template_name: string
  template_type: 'bid_package' | 'reminder' | 'response'
  subject: string
  html_body: string
  text_body?: string
  variables?: Record<string, any>
  is_default?: boolean
  created_at?: string
  updated_at?: string
}

export default function EmailTemplatesManager() {
  const { user } = useAuth()
  const supabase = createClient()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    if (user) {
      fetchTemplates()
    }
  }, [user])

  const fetchTemplates = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/email-templates?template_type=bid_package')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching email templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    setEditingTemplate(null)
    setEditorOpen(true)
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setEditorOpen(true)
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const response = await fetch(`/api/email-templates?id=${templateId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchTemplates()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    }
  }

  const handleSetDefault = async (templateId: string) => {
    try {
      const template = templates.find(t => t.id === templateId)
      if (!template) return

      const response = await fetch('/api/email-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: templateId,
          is_default: true
        })
      })

      if (response.ok) {
        await fetchTemplates()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to set default template')
      }
    } catch (error) {
      console.error('Error setting default template:', error)
      alert('Failed to set default template')
    }
  }

  const getPreviewThumbnail = (htmlBody: string): string => {
    try {
      const preview = generatePreviewHtml(htmlBody)
      // Create a data URL from the preview HTML
      return `data:text/html;charset=utf-8,${encodeURIComponent(preview)}`
    } catch (error) {
      return ''
    }
  }

  if (loading) {
    return (
      <Card className="border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="h-5 w-5 mr-2" />
            Email Templates
          </CardTitle>
          <CardDescription className="font-medium text-gray-600">
            Create and manage custom email templates for bid packages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Email Templates
              </CardTitle>
              <CardDescription className="font-medium text-gray-600">
                Create and manage custom email templates for bid packages with your branding
              </CardDescription>
            </div>
            <Button onClick={handleCreateNew} variant="orange" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-4">No email templates yet</p>
              <Button onClick={handleCreateNew} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="border-2 border-gray-200 hover:border-orange-300 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {template.template_name}
                          {template.is_default && (
                            <Badge variant="outline" className="text-xs">
                              <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                              Default
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Subject: {template.subject.substring(0, 50)}
                          {template.subject.length > 50 ? '...' : ''}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Preview thumbnail */}
                    <div className="border rounded bg-gray-50 h-32 overflow-hidden">
                      <iframe
                        srcDoc={getPreviewThumbnail(template.html_body)}
                        className="w-full h-full border-0 transform scale-50 origin-top-left"
                        style={{ width: '200%', height: '200%' }}
                        title="Preview"
                        sandbox="allow-same-origin"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(template)}
                        className="flex-1"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      {!template.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(template.id)}
                          title="Set as default"
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <EmailTemplateEditor
        template={editingTemplate}
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingTemplate(null)
        }}
        onSave={fetchTemplates}
        templateType="bid_package"
      />
    </>
  )
}

