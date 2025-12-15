'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { generatePreviewHtml, generatePreviewSubject, TEMPLATE_VARIABLES } from '@/lib/email-templates/preview'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Loader2, Plus, X, Code, Eye, Palette, Save, Trash2 } from 'lucide-react'

interface EmailTemplate {
  id?: string
  template_name: string
  template_type: 'bid_package' | 'reminder' | 'response'
  subject: string
  html_body: string
  text_body?: string
  variables?: Record<string, any>
  is_default?: boolean
}

interface EmailTemplateEditorProps {
  template?: EmailTemplate | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  templateType?: 'bid_package' | 'reminder' | 'response'
}

export default function EmailTemplateEditor({
  template,
  isOpen,
  onClose,
  onSave,
  templateType = 'bid_package'
}: EmailTemplateEditorProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('visual')
  
  // Form state
  const [templateName, setTemplateName] = useState('')
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [textBody, setTextBody] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  
  // Visual editor state
  const [primaryColor, setPrimaryColor] = useState('#EB5023')
  const [secondaryColor, setSecondaryColor] = useState('#1E1D1E')
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')
  const [textColor, setTextColor] = useState('#1E1D1E')
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif')
  const [companyName, setCompanyName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  
  // Preview
  const [previewHtml, setPreviewHtml] = useState('')
  const previewIframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (isOpen) {
      if (template) {
        // Load existing template
        setTemplateName(template.template_name)
        setSubject(template.subject)
        setHtmlBody(template.html_body)
        setTextBody(template.text_body || '')
        setIsDefault(template.is_default || false)
        
        // Load branding from variables
        if (template.variables) {
          const vars = template.variables as any
          if (vars.brand_colors) {
            setPrimaryColor(vars.brand_colors.primary || '#EB5023')
            setSecondaryColor(vars.brand_colors.secondary || '#1E1D1E')
            setBackgroundColor(vars.brand_colors.background || '#FFFFFF')
            setTextColor(vars.brand_colors.text || '#1E1D1E')
          }
          setFontFamily(vars.font_family || 'Arial, sans-serif')
          setCompanyName(vars.company_name || '')
          setLogoUrl(vars.logo_url || '')
        }
      } else {
        // New template - use defaults
        setTemplateName('')
        setSubject('Bid Request: {jobName} - {tradeCategory}')
        setHtmlBody(getDefaultHtmlBody())
        setTextBody('')
        setIsDefault(false)
        setPrimaryColor('#EB5023')
        setSecondaryColor('#1E1D1E')
        setBackgroundColor('#FFFFFF')
        setTextColor('#1E1D1E')
        setFontFamily('Arial, sans-serif')
        setCompanyName('')
        setLogoUrl('')
      }
      updatePreview()
    }
  }, [isOpen, template])

  useEffect(() => {
    updatePreview()
  }, [htmlBody, subject, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, companyName, logoUrl])

  const getDefaultHtmlBody = (): string => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ${fontFamily}; background-color: ${backgroundColor};">
  <div style="max-width: 600px; margin: 0 auto; background-color: ${backgroundColor}; padding: 32px;">
    <h1 style="color: ${primaryColor}; font-size: 24px; margin-bottom: 16px;">{jobName}</h1>
    <p style="color: ${textColor}; font-size: 16px; margin-bottom: 8px;"><strong>Location:</strong> {jobLocation}</p>
    <p style="color: ${textColor}; font-size: 16px; margin-bottom: 8px;"><strong>Trade:</strong> {tradeCategory}</p>
    <p style="color: ${textColor}; font-size: 16px; margin-bottom: 8px;"><strong>Deadline:</strong> {deadline}</p>
    
    {description && (
      <div style="margin-top: 24px; padding: 16px; background-color: #F3F4F6; border-radius: 8px;">
        <p style="color: ${textColor}; margin: 0;">{description}</p>
      </div>
    )}
    
    {lineItems && (
      <div style="margin-top: 24px;">
        <h2 style="color: ${textColor}; font-size: 18px; margin-bottom: 12px;">Minimum Required Line Items</h2>
        {lineItems}
      </div>
    )}
    
    {planLink && (
      <div style="margin-top: 24px; text-align: center;">
        <a href="{planLink}" style="display: inline-block; padding: 12px 24px; background-color: ${primaryColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
          View & Download Plans
        </a>
      </div>
    )}
    
    {reports && (
      <div style="margin-top: 24px;">
        <p style="color: ${textColor}; margin-bottom: 8px;"><strong>Attached Reports:</strong></p>
        {reports}
      </div>
    )}
    
    <p style="color: ${textColor}; margin-top: 24px;">Thank you for your interest!</p>
  </div>
</body>
</html>`
  }

  const updatePreview = () => {
    // Generate preview with current HTML body
    const preview = generatePreviewHtml(htmlBody)
    setPreviewHtml(preview)
    
    // Update iframe
    if (previewIframeRef.current) {
      previewIframeRef.current.srcdoc = preview
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploadingLogo(true)
    try {
      // Convert to base64 for email compatibility
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setLogoUrl(base64)
        setLogoFile(file)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const insertVariable = (variable: string) => {
    if (activeTab === 'html') {
      // Insert into HTML editor
      const textarea = document.querySelector('textarea[data-html-editor]') as HTMLTextAreaElement
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = textarea.value
        const newText = text.substring(0, start) + variable + text.substring(end)
        setHtmlBody(newText)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(start + variable.length, start + variable.length)
        }, 0)
      }
    } else {
      // For visual editor, insert into HTML body
      setHtmlBody(prev => prev + variable)
    }
  }

  const handleSave = async () => {
    if (!templateName || !subject || !htmlBody) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      // Build variables object with branding
      const variables = {
        brand_colors: {
          primary: primaryColor,
          secondary: secondaryColor,
          background: backgroundColor,
          text: textColor
        },
        font_family: fontFamily,
        company_name: companyName,
        logo_url: logoUrl
      }

      const templateData: EmailTemplate = {
        template_name: templateName,
        template_type: templateType,
        subject,
        html_body: htmlBody,
        text_body: textBody || undefined,
        variables,
        is_default: isDefault
      }

      if (template?.id) {
        // Update existing template
        const response = await fetch('/api/email-templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...templateData, id: template.id })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update template')
        }
      } else {
        // Create new template
        const response = await fetch('/api/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData)
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create template')
        }
      }

      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error saving template:', error)
      alert(error.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!template?.id) return
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const response = await fetch(`/api/email-templates?id=${template.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete template')
      }

      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error deleting template:', error)
      alert(error.message || 'Failed to delete template')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Email Template' : 'Create Email Template'}
          </DialogTitle>
          <DialogDescription>
            Create a custom email template for bid packages with your branding
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="My Company Template"
              />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="is-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
              />
              <Label htmlFor="is-default" className="cursor-pointer">
                Set as default template
              </Label>
            </div>
          </div>

          <div>
            <Label htmlFor="subject">Email Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Bid Request: {jobName} - {tradeCategory}"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use variables like {'{jobName}'}, {'{tradeCategory}'}, etc.
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="visual">
                <Palette className="h-4 w-4 mr-2" />
                Visual Editor
              </TabsTrigger>
              <TabsTrigger value="html">
                <Code className="h-4 w-4 mr-2" />
                HTML Editor
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </TabsTrigger>
            </TabsList>

            {/* Visual Editor Tab */}
            <TabsContent value="visual" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                  <CardDescription>Customize colors, fonts, and logo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="primary-color">Primary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primary-color"
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-10 w-20"
                        />
                        <Input
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          placeholder="#EB5023"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="secondary-color">Secondary Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondary-color"
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="h-10 w-20"
                        />
                        <Input
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          placeholder="#1E1D1E"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="background-color">Background Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="background-color"
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="h-10 w-20"
                        />
                        <Input
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="text-color">Text Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="text-color"
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="h-10 w-20"
                        />
                        <Input
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          placeholder="#1E1D1E"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="font-family">Font Family</Label>
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                        <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
                        <SelectItem value="Georgia, serif">Georgia</SelectItem>
                        <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
                        <SelectItem value="Courier New, monospace">Courier New</SelectItem>
                        <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input
                      id="company-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your Company Name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="logo">Logo</Label>
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                    {logoUrl && (
                      <div className="mt-2">
                        <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogoUrl('')}
                          className="mt-2"
                        >
                          Remove Logo
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Template Variables</CardTitle>
                  <CardDescription>Click to insert variables into your template</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATE_VARIABLES.map((variable) => (
                      <Button
                        key={variable.name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(variable.name)}
                      >
                        {variable.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label htmlFor="html-body-visual">HTML Body *</Label>
                <Textarea
                  id="html-body-visual"
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                  placeholder="Enter HTML with template variables..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use variables like {'{jobName}'}, {'{lineItems}'}, etc. in your HTML
                </p>
              </div>
            </TabsContent>

            {/* HTML Editor Tab */}
            <TabsContent value="html" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Available Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {TEMPLATE_VARIABLES.map((variable) => (
                      <div key={variable.name} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <code className="text-sm font-mono">{variable.name}</code>
                          <p className="text-xs text-gray-500">{variable.description}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => insertVariable(variable.name)}
                        >
                          Insert
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label htmlFor="html-body">HTML Body *</Label>
                <Textarea
                  id="html-body"
                  data-html-editor
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Enter HTML with template variables..."
                />
              </div>

              <div>
                <Label htmlFor="text-body">Plain Text Body (Optional)</Label>
                <Textarea
                  id="text-body"
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  rows={10}
                  placeholder="Plain text version of the email..."
                />
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Preview</CardTitle>
                  <CardDescription>
                    Subject: {generatePreviewSubject(subject)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      ref={previewIframeRef}
                      className="w-full h-[600px] border-0"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          {template?.id && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !templateName || !subject || !htmlBody}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

