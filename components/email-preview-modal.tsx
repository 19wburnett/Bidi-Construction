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
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number
  subcontractor?: string
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
  loading
}: EmailPreviewModalProps) {
  const [template, setTemplate] = useState<any>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const iframeRefs = useRef<Record<string, HTMLIFrameElement>>({})

  useEffect(() => {
    if (isOpen) {
      if (selectedTemplateId) {
        loadTemplate()
      } else {
        // No custom template selected, use default
        setTemplate(null)
        setLoadingTemplate(false)
      }
    }
  }, [isOpen, selectedTemplateId])

  const loadTemplate = async () => {
    if (!selectedTemplateId) return
    
    setLoadingTemplate(true)
    try {
      const response = await fetch('/api/email-templates')
      if (response.ok) {
        const templates = await response.json()
        // API returns array directly, not wrapped in object
        const found = Array.isArray(templates) 
          ? templates.find((t: any) => t.id === selectedTemplateId)
          : null
        setTemplate(found || null)
      }
    } catch (error) {
      console.error('Error loading template:', error)
    } finally {
      setLoadingTemplate(false)
    }
  }

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
        template
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
        reportLinks: reportLinks
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
                              if (el.contentDocument && !el.contentDocument.body.innerHTML) {
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
  template: { subject: string; html_body: string; text_body?: string }
): string {
  let htmlBody = template.html_body
  
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
  
  // Replace template variables (escape user content to prevent XSS)
  htmlBody = htmlBody.replace(/{jobName}/g, escapeHtml(bidPackage.jobs.name || ''))
  htmlBody = htmlBody.replace(/{jobLocation}/g, escapeHtml(bidPackage.jobs.location || ''))
  htmlBody = htmlBody.replace(/{tradeCategory}/g, escapeHtml(bidPackage.trade_category || ''))
  htmlBody = htmlBody.replace(/{deadline}/g, formatDeadline(bidPackage.deadline))
  htmlBody = htmlBody.replace(/{description}/g, escapeHtml(bidPackage.description || ''))
  
  // Replace line items - build HTML table with proper structure
  const lineItemsHtml = bidPackage.minimum_line_items && bidPackage.minimum_line_items.length > 0
    ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr>
            <th style="padding: 12px 16px; text-align: left; background-color: #F3F4F6; border-bottom: 2px solid #EB5023; font-size: 13px; font-weight: 600; color: #404042; text-transform: uppercase;">Description</th>
            <th style="padding: 12px 16px; text-align: left; background-color: #F3F4F6; border-bottom: 2px solid #EB5023; font-size: 13px; font-weight: 600; color: #404042; text-transform: uppercase;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${bidPackage.minimum_line_items.map((item: any) => 
            `<tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #404042;">${escapeHtml(item.description || '')}</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #404042;">${escapeHtml(String(item.quantity || ''))} ${escapeHtml(item.unit || '')}</td>
            </tr>`
          ).join('')}
        </tbody>
      </table>`
    : '<p style="padding: 12px 16px; text-align: center; color: #777878;">No specific line items required</p>'
  
  htmlBody = htmlBody.replace(/{lineItems}/g, lineItemsHtml)
  
  // Replace plan link
  if (planLink) {
    htmlBody = htmlBody.replace(/{planLink}/g, `<a href="${escapeHtml(planLink)}" style="color: #EB5023; text-decoration: none; font-weight: 600;">📐 View & Download All Project Plans</a>`)
  } else {
    htmlBody = htmlBody.replace(/{planLink}/g, 'Plans will be provided separately')
  }
  
  // Replace reports
  if (reportLinks.length > 0) {
    const reportsHtml = reportLinks.map(r => 
      `<a href="${escapeHtml(r.url)}" style="color: #EB5023; text-decoration: none; margin-right: 12px; display: inline-block; margin-bottom: 8px; padding: 10px 16px; border: 2px solid #EB5023; border-radius: 6px; font-size: 13px;">📄 ${escapeHtml(r.title)}</a>`
    ).join('')
    htmlBody = htmlBody.replace(/{reports}/g, reportsHtml)
  } else {
    htmlBody = htmlBody.replace(/{reports}/g, '')
  }
  
  return htmlBody
}


