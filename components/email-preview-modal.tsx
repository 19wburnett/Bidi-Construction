'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send, X } from 'lucide-react'
import { generateBidRequestEmail, generateBidRequestSubject } from '@/lib/email-templates/bid-request'
import { generateEmailWrapper } from '@/lib/email-templates/base'
import { Job, JobReport } from '@/types/takeoff'

interface TakeoffItem {
  id: string
  name?: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number
  subcontractor?: string
  cost_code?: string
}

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: () => void
  job: Job | null
  selectedTrades: string[]
  selectedSubcontractorsByTrade: Record<string, Array<{ name: string; email: string }>>
  selectedTradeLineItems: Record<string, string[]>
  takeoffItemById: Record<string, TakeoffItem>
  description: string
  deadline: string
  planId: string
  selectedReportIds: string[]
  reports: JobReport[]
  selectedTemplateId: string | null
  canCreatePackage: boolean
  loading: boolean
  includeQuantities?: boolean
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  onSend,
  job,
  selectedTrades,
  selectedSubcontractorsByTrade,
  selectedTradeLineItems,
  takeoffItemById,
  description,
  deadline,
  planId,
  selectedReportIds,
  reports,
  selectedTemplateId,
  canCreatePackage,
  loading,
  includeQuantities = true
}: EmailPreviewModalProps) {
  const [template, setTemplate] = useState<any>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const iframeRefs = useRef<Record<string, HTMLIFrameElement>>({})

  useEffect(() => {
    const loadTemplate = async () => {
      if (!selectedTemplateId) {
        setTemplate(null)
        setLoadingTemplate(false)
        return
      }
      
      setLoadingTemplate(true)
      try {
        const response = await fetch('/api/email-templates')
        if (response.ok) {
          const data = await response.json()
          // API returns { templates: [...] }
          const templates = data.templates || (Array.isArray(data) ? data : [])
          const found = templates.find((t: any) => t.id === selectedTemplateId)
          if (found) {
            console.log('Template loaded:', found.id, found.template_name)
            setTemplate(found)
          } else {
            console.warn('Template not found:', selectedTemplateId, 'Available templates:', templates.map((t: any) => t.id))
            setTemplate(null)
          }
        } else {
          console.error('Failed to load templates:', response.statusText)
          setTemplate(null)
        }
      } catch (error) {
        console.error('Error loading template:', error)
        setTemplate(null)
      } finally {
        setLoadingTemplate(false)
      }
    }

    if (isOpen) {
      loadTemplate()
    } else {
      // Reset when modal closes
      setTemplate(null)
      setLoadingTemplate(false)
    }
  }, [isOpen, selectedTemplateId])

  const generateEmailHtml = (trade: string): string => {
    const recipients = selectedSubcontractorsByTrade[trade] ?? []
    const assignedIds = selectedTradeLineItems[trade] ?? []
    const lineItems = assignedIds
      .map(id => takeoffItemById[id])
      .filter((item): item is TakeoffItem => Boolean(item))

    const reportLinks = reports
      .filter(r => selectedReportIds.includes(r.id))
      .map(r => ({
        title: r.title || r.file_name,
        url: '#' // Preview doesn't need real URLs
      }))

    // Use custom template if available, otherwise use default
    if (template) {
      const mockBidPackage = {
        jobs: {
          name: job?.name || '',
          location: job?.location || ''
        },
        trade_category: trade,
        deadline: deadline || null,
        description: description || '',
        minimum_line_items: lineItems
      }
      
      const customBody = generateCustomTemplateBody(
        mockBidPackage,
        '#', // Preview link
        reportLinks,
        template,
        includeQuantities
      )
      
      // Wrap custom template body in email wrapper
      const subject = generateEmailSubject(trade)
      return generateEmailWrapper(customBody, subject)
    } else {
      // Use default Bidi template (already wrapped)
      return generateBidRequestEmail({
        jobName: job?.name || 'Project',
        jobLocation: job?.location || '',
        tradeCategory: trade,
        deadline: deadline || null,
        description: description || '',
        lineItems: lineItems,
        planLink: '#',
        reportLinks: reportLinks,
        includeQuantities: includeQuantities
      })
    }
  }

  const generateEmailSubject = (trade: string): string => {
    if (template) {
      let subject = template.subject
      subject = subject.replace(/{jobName}/g, job?.name || '')
      subject = subject.replace(/{tradeCategory}/g, trade)
      subject = subject.replace(/{jobLocation}/g, job?.location || '')
      const formattedDeadline = deadline 
        ? new Date(deadline).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'No deadline set'
      subject = subject.replace(/{deadline}/g, formattedDeadline)
      subject = subject.replace(/{description}/g, description || '')
      return subject
    } else {
      return generateBidRequestSubject(job?.name || 'Project', trade)
    }
  }

  useEffect(() => {
    // Update iframes when data changes (only if not loading template)
    if (!loadingTemplate && isOpen) {
      selectedTrades.forEach(trade => {
        const iframe = iframeRefs.current[trade]
        if (iframe) {
          const html = generateEmailHtml(trade)
          iframe.srcdoc = html
        }
      })
    }
  }, [template, loadingTemplate, isOpen, job, selectedTrades, selectedSubcontractorsByTrade, selectedTradeLineItems, description, deadline, selectedReportIds, takeoffItemById, reports])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white sticky top-0 z-10">
          <h3 className="text-lg font-semibold">Preview Bid Package Emails</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingTemplate ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading template...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {selectedTrades.map((trade) => {
                const recipients = selectedSubcontractorsByTrade[trade] ?? []
                const emailHtml = generateEmailHtml(trade)
                const emailSubject = generateEmailSubject(trade)

                return (
                  <div key={trade} className="p-6 border-2 border-gray-200 rounded-lg space-y-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-lg">{trade}</h4>
                      <Badge variant="outline">{recipients.length} recipient{recipients.length === 1 ? '' : 's'}</Badge>
                    </div>

                    <div className="text-sm space-y-2 bg-white p-4 rounded border">
                      <div>
                        <span className="font-medium">To:</span>{' '}
                        <span className="text-gray-600">
                          {recipients.length > 0 
                            ? recipients.map(r => r.email).join(', ')
                            : 'No recipients selected'
                          }
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Subject:</span>{' '}
                        <span className="text-gray-600">{emailSubject}</span>
                      </div>
                    </div>

                    {/* HTML Email Preview */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100 shadow-sm">
                      <div className="bg-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 border-b">
                        Email Preview
                      </div>
                      <div className="bg-white">
                        <iframe
                          ref={(el) => {
                            if (el) {
                              iframeRefs.current[trade] = el
                              // Set initial content
                              if (el.contentDocument?.body) {
                                if (!el.contentDocument.body.innerHTML) {
                                  el.srcdoc = emailHtml
                                }
                              } else {
                                // Iframe not ready yet, set srcdoc directly
                                el.srcdoc = emailHtml
                              }
                            }
                          }}
                          srcDoc={emailHtml}
                          className="w-full h-[600px] border-0"
                          title={`Email preview for ${trade}`}
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white sticky bottom-0 z-10">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>
            <Button 
              className="flex-1" 
              disabled={!canCreatePackage || loading} 
              onClick={onSend}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to generate custom template body (same as in send route)
function generateCustomTemplateBody(
  bidPackage: any,
  planLink: string | null,
  reportLinks: { title: string; url: string }[],
  template: { subject: string; html_body: string; text_body?: string; variables?: any },
  includeQuantities: boolean = true
): string {
  let htmlBody = template.html_body
  
  // Apply branding from template variables if they exist
  const branding = template.variables || {}
  const brandColors = branding.brand_colors || {}
  const primaryColor = brandColors.primary || '#EB5023'
  const secondaryColor = brandColors.secondary || '#1E1D1E'
  const backgroundColor = brandColors.background || '#FFFFFF'
  const textColor = brandColors.text || '#1E1D1E'
  const fontFamily = branding.font_family || 'Arial, sans-serif'
  const companyName = branding.company_name || ''
  const logoUrl = branding.logo_url || ''
  const signature = branding.signature || ''
  
  // Helper function to escape HTML
  const escapeHtml = (text: string): string => {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
  
  // Format deadline
  const formatDeadline = (deadline: string | Date | null): string => {
    if (!deadline) return 'No deadline set'
    try {
      return new Date(deadline).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'No deadline set'
    }
  }
  
  // First, clean up any JavaScript conditional syntax that might be in the template
  // Remove patterns like {description && ( ... )} or {deadline && ( ... )}
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*&&\s*\(/g, '')
  htmlBody = htmlBody.replace(/\)\s*\}\s*/g, '')
  
  // Replace template variables (escape user content to prevent XSS)
  const jobName = escapeHtml(bidPackage.jobs.name || '')
  const jobLocation = escapeHtml(bidPackage.jobs.location || '')
  const tradeCategory = escapeHtml(bidPackage.trade_category || '')
  const formattedDeadline = formatDeadline(bidPackage.deadline)
  const description = escapeHtml(bidPackage.description || '')
  
  htmlBody = htmlBody.replace(/{jobName}/g, jobName)
  htmlBody = htmlBody.replace(/{jobLocation}/g, jobLocation)
  htmlBody = htmlBody.replace(/{tradeCategory}/g, tradeCategory)
  htmlBody = htmlBody.replace(/{deadline}/g, formattedDeadline)
  
  // Handle description - only show if it exists
  if (description) {
    htmlBody = htmlBody.replace(/{description}/g, description)
  } else {
    // Remove description paragraph if empty
    htmlBody = htmlBody.replace(/<p[^>]*>\s*\{description\}\s*<\/p>/gi, '')
    htmlBody = htmlBody.replace(/{description}/g, '')
  }
  
  // Replace line items - build simple text-based list (matching preview style)
  const lineItemsHtml = bidPackage.minimum_line_items && bidPackage.minimum_line_items.length > 0
    ? `<ul style="margin: 16px 0; padding-left: 20px; list-style-type: disc;">
        ${bidPackage.minimum_line_items.map((item: any) => {
          const parts = []
          if (item.name) parts.push(`<strong>${escapeHtml(item.name)}</strong>`)
          parts.push(escapeHtml(item.description || ''))
          if (item.cost_code) parts.push(`<span style="color: #6b7280; font-size: 14px;">(Cost Code: ${escapeHtml(item.cost_code)})</span>`)
          if (includeQuantities) {
            parts.push(`- ${escapeHtml(String(item.quantity || ''))} ${escapeHtml(item.unit || '')}`)
          }
          return `<li style="margin: 8px 0; font-size: 16px; line-height: 1.5;">${parts.join(' ')}</li>`
        }).join('')}
      </ul>`
    : ''
  
  // Only replace {lineItems} if there are items, otherwise remove the section
  if (lineItemsHtml) {
    htmlBody = htmlBody.replace(/{lineItems}/g, lineItemsHtml)
    // Remove any conditional syntax around lineItems
    htmlBody = htmlBody.replace(/\{lineItems\s*&&\s*\(/g, '')
  } else {
    // Remove line items section if empty
    htmlBody = htmlBody.replace(/<div[^>]*>\s*<p[^>]*>[\s\S]*?Required items[\s\S]*?<\/p>\s*\{lineItems\}\s*<\/div>/gi, '')
    htmlBody = htmlBody.replace(/\{lineItems\s*&&\s*\(/g, '')
    htmlBody = htmlBody.replace(/{lineItems}/g, '')
  }
  
  // Replace plan link - simple text link
  if (planLink) {
    htmlBody = htmlBody.replace(/{planLink}/g, `<a href="${escapeHtml(planLink)}" style="color: ${primaryColor}; text-decoration: underline;">${escapeHtml(planLink)}</a>`)
    // Remove conditional syntax
    htmlBody = htmlBody.replace(/\{planLink\s*&&\s*\(/g, '')
  } else {
    // Remove plan link section if no link
    htmlBody = htmlBody.replace(/<p[^>]*>[\s\S]*?You can view and download[\s\S]*?\{planLink\}[\s\S]*?<\/p>/gi, '')
    htmlBody = htmlBody.replace(/\{planLink\s*&&\s*\(/g, '')
    htmlBody = htmlBody.replace(/{planLink}/g, 'Plans will be provided separately')
  }
  
  // Replace reports - simple text list
  if (reportLinks.length > 0) {
    const reportsHtml = reportLinks.map(r => 
      `<p style="margin: 8px 0; font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(r.url)}" style="color: ${primaryColor}; text-decoration: underline;">${escapeHtml(r.title)}</a></p>`
    ).join('')
    htmlBody = htmlBody.replace(/{reports}/g, reportsHtml)
    htmlBody = htmlBody.replace(/\{reports\s*&&\s*\(/g, '')
  } else {
    // Remove reports section if empty
    htmlBody = htmlBody.replace(/<div[^>]*>\s*<p[^>]*>[\s\S]*?Additional documents[\s\S]*?<\/p>\s*\{reports\}\s*<\/div>/gi, '')
    htmlBody = htmlBody.replace(/\{reports\s*&&\s*\(/g, '')
    htmlBody = htmlBody.replace(/{reports}/g, '')
  }
  
  // Handle deadline - only show if it exists
  if (formattedDeadline && formattedDeadline !== 'No deadline set') {
    htmlBody = htmlBody.replace(/\{deadline\s*&&\s*\(/g, '')
  } else {
    // Remove deadline paragraph if no deadline
    htmlBody = htmlBody.replace(/<p[^>]*>\s*<strong>Deadline:<\/strong>\s*\{deadline\}\s*<\/p>/gi, '')
    htmlBody = htmlBody.replace(/\{deadline\s*&&\s*\(/g, '')
    htmlBody = htmlBody.replace(/{deadline}/g, '')
  }
  
  // Replace bid email - use a sample email for preview
  const bidEmail = 'bids+sample@bids.bidicontracting.com'
  htmlBody = htmlBody.replace(/{bidEmail}/g, escapeHtml(bidEmail))
  
  // Apply branding variables to the template (do this before signature so signature can use them)
  htmlBody = htmlBody.replace(/\$\{primaryColor\}/g, primaryColor)
  htmlBody = htmlBody.replace(/\$\{secondaryColor\}/g, secondaryColor)
  htmlBody = htmlBody.replace(/\$\{backgroundColor\}/g, backgroundColor)
  htmlBody = htmlBody.replace(/\$\{textColor\}/g, textColor)
  htmlBody = htmlBody.replace(/\$\{fontFamily\}/g, fontFamily)
  htmlBody = htmlBody.replace(/\$\{companyName\}/g, escapeHtml(companyName))
  htmlBody = htmlBody.replace(/\$\{logoUrl\}/g, logoUrl)
  
  // Also handle template literal style replacements (without $)
  htmlBody = htmlBody.replace(/\{primaryColor\}/g, primaryColor)
  htmlBody = htmlBody.replace(/\{secondaryColor\}/g, secondaryColor)
  htmlBody = htmlBody.replace(/\{backgroundColor\}/g, backgroundColor)
  htmlBody = htmlBody.replace(/\{textColor\}/g, textColor)
  htmlBody = htmlBody.replace(/\{fontFamily\}/g, fontFamily)
  htmlBody = htmlBody.replace(/\{companyName\}/g, escapeHtml(companyName))
  htmlBody = htmlBody.replace(/\{logoUrl\}/g, logoUrl)
  
  // Apply signature - replace signature placeholder with actual signature
  if (signature) {
    // Replace signature variables in the signature HTML
    let signatureHtml = signature
    signatureHtml = signatureHtml.replace(/\{primaryColor\}/g, primaryColor)
    signatureHtml = signatureHtml.replace(/\{secondaryColor\}/g, secondaryColor)
    signatureHtml = signatureHtml.replace(/\{backgroundColor\}/g, backgroundColor)
    signatureHtml = signatureHtml.replace(/\{textColor\}/g, textColor)
    signatureHtml = signatureHtml.replace(/\{fontFamily\}/g, fontFamily)
    signatureHtml = signatureHtml.replace(/\{companyName\}/g, escapeHtml(companyName))
    // Ensure logoUrl is properly used (it's already a URL, don't escape it for img src)
    signatureHtml = signatureHtml.replace(/\{logoUrl\}/g, logoUrl ? logoUrl : '')
    
    htmlBody = htmlBody.replace(/\{signature\}/g, signatureHtml)
  } else {
    // Default signature if none provided
    let defaultSignature = '<p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.5;">Thanks,</p>'
    if (logoUrl) {
      // Use the logo URL directly (it's already a URL, don't escape it for img src)
      defaultSignature += `<div style="margin: 8px 0;"><img src="${logoUrl}" alt="${escapeHtml(companyName || 'Company')}" style="max-height: 40px;" /></div>`
    }
    if (companyName) {
      defaultSignature += `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${textColor};">${escapeHtml(companyName)}</p>`
    } else {
      defaultSignature += `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${textColor};">The Team</p>`
    }
    htmlBody = htmlBody.replace(/\{signature\}/g, defaultSignature)
  }
  
  // Final cleanup - remove any remaining conditional syntax fragments
  // This handles cases where templates might have been edited with JSX-like syntax
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*&&\s*\(/g, '')
  htmlBody = htmlBody.replace(/\)\s*\}\s*/g, '')
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*\?/g, '')
  htmlBody = htmlBody.replace(/:\s*'[^']*'\s*\}/g, '')
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*&&\s*\(/g, '')
  htmlBody = htmlBody.replace(/\)\s*\}\s*\)/g, '')
  
  return htmlBody
}


