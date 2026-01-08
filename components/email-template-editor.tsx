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
import { cn } from '@/lib/utils'
import { Loader2, Plus, X, Code, Eye, Palette, Save, Trash2, Sparkles } from 'lucide-react'
import EmailTemplateAIAssistant from '@/components/email-template-ai-assistant'

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
  openAIAssistant?: boolean
}

export default function EmailTemplateEditor({
  template,
  isOpen,
  onClose,
  onSave,
  templateType = 'bid_package',
  openAIAssistant = false
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
  const [signature, setSignature] = useState('')
  
  // Preview
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewIframeRef = useRef<HTMLIFrameElement>(null)
  
  // AI Assistant
  const [aiAssistantOpen, setAiAssistantOpen] = useState(openAIAssistant)
  
  // Update AI assistant state when prop changes
  useEffect(() => {
    if (isOpen && openAIAssistant) {
      setAiAssistantOpen(true)
    }
  }, [isOpen, openAIAssistant])

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
          setSignature(vars.signature || '')
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
        setSignature('')
      }
      updatePreview()
    }
  }, [isOpen, template])

  useEffect(() => {
    if (activeTab === 'preview') {
      // Small delay to ensure iframe is mounted
      const timer = setTimeout(() => {
        updatePreview()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [activeTab])
  
  // Update preview when content changes, but only if on preview tab
  useEffect(() => {
    if (activeTab === 'preview') {
      // Debounce updates to avoid constant re-rendering while typing
      const timer = setTimeout(() => {
        updatePreview()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [htmlBody, subject, primaryColor, secondaryColor, backgroundColor, textColor, fontFamily, companyName, logoUrl, signature])

  const getDefaultHtmlBody = (): string => {
    // Branding is applied using placeholder variables that get replaced when emails are sent
    // Signature appears at the bottom with logo and company info
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: {fontFamily}; background-color: #f5f5f5; color: {textColor};">
  <div style="max-width: 600px; margin: 0 auto; background-color: {backgroundColor}; padding: 20px;">
    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">Hi there,</p>
    
    <!-- Primary color used here for job name highlight -->
    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
      I'm reaching out about a new project opportunity: <strong style="color: {primaryColor};">{jobName}</strong> located at {jobLocation}.
    </p>
    
    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
      We're looking for a <strong>{tradeCategory}</strong> contractor for this project.
    </p>
    
    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
      {description}
    </p>
    
    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
      <strong>Deadline:</strong> {deadline}
    </p>
    
    <div style="margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.5;"><strong>Required items:</strong></p>
      {lineItems}
    </div>
    
    <!-- Primary color used here for links -->
    <p style="margin: 16px 0; font-size: 16px; line-height: 1.5;">
      You can view and download the plans here: <a href="{planLink}" style="color: {primaryColor}; text-decoration: underline;">{planLink}</a>
    </p>
    
    <div style="margin: 16px 0;">
      <p style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.5;"><strong>Additional documents:</strong></p>
      {reports}
    </div>
    
    <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.5;">
      Let me know if you're interested and we can discuss further.
    </p>
    
    <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.5;">
      <strong>Important:</strong> Please send all bids to {bidEmail}. If you send a separate email in a new thread, make sure to use this email address so we can track your submission properly.
    </p>
    
    <!-- Signature section with logo and custom signature -->
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
      {signature}
    </div>
  </div>
</body>
</html>`
  }

  const updatePreview = () => {
    if (!previewIframeRef.current) {
      return
    }

    // Only update if we're on the preview tab to avoid unnecessary updates
    if (activeTab !== 'preview') {
      return
    }

    if (!htmlBody || htmlBody.trim() === '') {
      setPreviewHtml('')
      previewIframeRef.current.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="padding: 20px; font-family: Arial, sans-serif; color: #666;"><p>Enter HTML content to see preview</p></body></html>'
      return
    }

    setPreviewLoading(true)
    try {
      // Generate preview with current HTML body and branding
      const preview = generatePreviewHtml(htmlBody, undefined, {
        primaryColor,
        secondaryColor,
        backgroundColor,
        textColor,
        fontFamily,
        companyName,
        logoUrl,
        signature
      })
      setPreviewHtml(preview)
      
      // Ensure preview is valid HTML
      let finalPreview = preview
      if (!finalPreview.includes('<!DOCTYPE') && !finalPreview.includes('<html')) {
        finalPreview = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${finalPreview}</body></html>`
      }
      
      // Store current scroll position if iframe content exists
      let scrollTop = 0
      try {
        const iframeDoc = previewIframeRef.current.contentDocument || previewIframeRef.current.contentWindow?.document
        if (iframeDoc) {
          scrollTop = iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop || 0
        }
      } catch (e) {
        // Cross-origin or other error, ignore
      }
      
      // Update iframe directly
      if (previewIframeRef.current) {
        previewIframeRef.current.srcdoc = finalPreview
        
        // Restore scroll position after content loads
        setTimeout(() => {
          try {
            const iframeDoc = previewIframeRef.current?.contentDocument || previewIframeRef.current?.contentWindow?.document
            if (iframeDoc && scrollTop > 0) {
              iframeDoc.documentElement.scrollTop = scrollTop
              iframeDoc.body.scrollTop = scrollTop
            }
          } catch (e) {
            // Cross-origin or other error, ignore
          }
        }, 100)
      }
      setPreviewLoading(false)
    } catch (error) {
      console.error('Error generating preview:', error)
      if (previewIframeRef.current) {
        previewIframeRef.current.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="padding: 20px; font-family: Arial, sans-serif; color: #d32f2f;"><p>Error generating preview. Please check your HTML.</p></body></html>'
      }
      setPreviewLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploadingLogo(true)
    try {
      // Upload to Supabase Storage for email compatibility
      // Email clients require publicly accessible URLs, not base64
      const fileExt = file.name.split('.').pop() || 'png'
      const fileName = `email-templates/${user.id}/logo_${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('bid-documents')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bid-documents')
        .getPublicUrl(fileName)

      if (!publicUrl) {
        // Fallback to signed URL if public URL not available
        const { data: signedData } = await supabase.storage
          .from('bid-documents')
          .createSignedUrl(fileName, 31536000) // 1 year expiration
        
        if (signedData?.signedUrl) {
          setLogoUrl(signedData.signedUrl)
        } else {
          throw new Error('Failed to get logo URL')
        }
      } else {
        setLogoUrl(publicUrl)
      }
      
      setLogoFile(file)
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo. Please try again.')
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
        logo_url: logoUrl,
        signature: signature
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

  const handleApplyAIGenerated = (generatedHtmlBody: string, generatedSubject: string) => {
    setHtmlBody(generatedHtmlBody)
    setSubject(generatedSubject)
    // Optionally close AI assistant after applying
    // setAiAssistantOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("max-w-5xl max-h-[90vh] overflow-y-auto", aiAssistantOpen && "max-w-7xl")}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>
                {template ? 'Edit Email Template' : 'Create Email Template'}
              </DialogTitle>
              <DialogDescription>
                Create a custom email template for bid packages with your branding
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAiAssistantOpen(!aiAssistantOpen)}
              className="ml-4"
            >
              <Sparkles className={cn("h-4 w-4 mr-2", aiAssistantOpen && "text-orange-500")} />
              AI Assistant
            </Button>
          </div>
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
                    <Label htmlFor="logo">Logo (for signature)</Label>
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
                    <p className="text-xs text-gray-500 mt-1">
                      Logo will appear in your email signature
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Email Signature</CardTitle>
                  <CardDescription>Create a custom signature that appears at the bottom of emails</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="signature">Signature HTML</Label>
                    <Textarea
                      id="signature"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                      placeholder={`Example:\n<p style="margin: 0 0 4px 0;">Thanks,</p>\n${logoUrl ? '<img src="{logoUrl}" alt="{companyName}" style="max-height: 40px; margin: 8px 0;" />' : ''}\n<p style="margin: 0; font-size: 14px; color: {textColor};">{companyName}</p>\n<p style="margin: 0; font-size: 14px; color: {textColor};">Your Title</p>\n<p style="margin: 0; font-size: 14px; color: {textColor};">your.email@company.com</p>`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use HTML to create your signature. You can use {`{logoUrl}`}, {`{companyName}`}, {`{primaryColor}`}, {`{textColor}`} as variables.
                    </p>
                  </div>
                  {!signature && (
                    <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded border">
                      <p className="font-medium mb-2">Quick signature builder:</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const defaultSig = `<p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.5;">Thanks,</p>
${logoUrl ? `<div style="margin: 8px 0;"><img src="{logoUrl}" alt="{companyName}" style="max-height: 40px;" /></div>` : ''}
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: {textColor};">{companyName}</p>`
                          setSignature(defaultSig)
                        }}
                      >
                        Use Default Signature
                      </Button>
                    </div>
                  )}
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
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-[600px] border rounded-lg">
                      <div className="text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-500">Generating preview...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <iframe
                        ref={previewIframeRef}
                        className="w-full h-[600px] border-0"
                        title="Email Preview"
                        sandbox="allow-same-origin allow-scripts"
                        style={{ display: 'block' }}
                      />
                    </div>
                  )}
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

      {/* AI Assistant Sidebar */}
      <EmailTemplateAIAssistant
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        htmlBody={htmlBody}
        subject={subject}
        branding={{
          companyName,
          primaryColor,
          fontFamily
        }}
        onApply={handleApplyAIGenerated}
      />
    </Dialog>
  )
}

