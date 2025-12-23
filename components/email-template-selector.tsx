'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface EmailTemplate {
  id: string
  template_name: string
  template_type: string
  subject: string
  html_body: string
  text_body?: string
  variables?: Record<string, any>
  is_default?: boolean
  created_at?: string
  updated_at?: string
}

interface EmailTemplateSelectorProps {
  value?: string | null
  onValueChange: (templateId: string | null) => void
  templateType?: 'bid_package' | 'reminder' | 'response'
  disabled?: boolean
}

export default function EmailTemplateSelector({
  value,
  onValueChange,
  templateType = 'bid_package',
  disabled = false
}: EmailTemplateSelectorProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [templateType])

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ template_type: templateType })
      const response = await fetch(`/api/email-templates?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to load templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err: any) {
      console.error('Error loading email templates:', err)
      setError(err.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleValueChange = (newValue: string) => {
    if (newValue === 'default') {
      onValueChange(null)
    } else {
      onValueChange(newValue)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading templates...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Error: {error}
      </div>
    )
  }

  const selectedValue = value || 'default'
  const selectedTemplate = templates.find(t => t.id === value)

  return (
    <Select
      value={selectedValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          {selectedTemplate 
            ? `${selectedTemplate.template_name}${selectedTemplate.is_default ? ' (Default)' : ''}`
            : 'Default Template (Bidi)'
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">
          Default Template (Bidi)
        </SelectItem>
        {templates.map((template) => (
          <SelectItem key={template.id} value={template.id}>
            {template.template_name}
            {template.is_default && ' (Default)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}










