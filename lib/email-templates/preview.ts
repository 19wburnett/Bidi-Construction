/**
 * Email Template Preview Utilities
 * 
 * Functions to generate preview HTML with sample data for template editing
 */

interface PreviewData {
  jobName?: string
  jobLocation?: string
  tradeCategory?: string
  deadline?: string | Date | null
  description?: string
  lineItems?: Array<{
    description: string
    quantity?: number | string
    unit?: string
    unit_cost?: number
  }>
  planLink?: string | null
  reportLinks?: Array<{ title: string; url: string }>
}

/**
 * Generate preview HTML by replacing template variables with sample data
 */
export function generatePreviewHtml(
  htmlBody: string,
  sampleData?: Partial<PreviewData>
): string {
  const data: PreviewData = {
    jobName: 'Sample Construction Project',
    jobLocation: '123 Main Street, City, State 12345',
    tradeCategory: 'Electrical',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    description: 'This is a sample project description. Replace this with your actual project details.',
    lineItems: [
      {
        description: 'Install electrical outlets',
        quantity: 20,
        unit: 'each',
        unit_cost: 45.00
      },
      {
        description: 'Run electrical conduit',
        quantity: 150,
        unit: 'linear feet',
        unit_cost: 12.50
      },
      {
        description: 'Install light fixtures',
        quantity: 8,
        unit: 'each',
        unit_cost: 125.00
      }
    ],
    planLink: 'https://example.com/plans/sample-project',
    reportLinks: [
      { title: 'Site Survey Report', url: 'https://example.com/reports/survey.pdf' },
      { title: 'Environmental Assessment', url: 'https://example.com/reports/env.pdf' }
    ],
    ...sampleData
  }

  let previewHtml = htmlBody

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
  
  // Replace template variables with sample data (escape to prevent XSS)
  previewHtml = previewHtml.replace(/{jobName}/g, escapeHtml(data.jobName || ''))
  previewHtml = previewHtml.replace(/{jobLocation}/g, escapeHtml(data.jobLocation || ''))
  previewHtml = previewHtml.replace(/{tradeCategory}/g, escapeHtml(data.tradeCategory || ''))
  previewHtml = previewHtml.replace(/{deadline}/g, formatDeadline(data.deadline ?? null))
  previewHtml = previewHtml.replace(/{description}/g, escapeHtml(data.description || ''))

  // Replace line items - build HTML table with proper structure
  const lineItemsHtml = data.lineItems && data.lineItems.length > 0
    ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr>
            <th style="padding: 12px 16px; text-align: left; background-color: #F3F4F6; border-bottom: 2px solid #EB5023; font-size: 13px; font-weight: 600; color: #404042; text-transform: uppercase;">Description</th>
            <th style="padding: 12px 16px; text-align: left; background-color: #F3F4F6; border-bottom: 2px solid #EB5023; font-size: 13px; font-weight: 600; color: #404042; text-transform: uppercase;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${data.lineItems.map(item => 
            `<tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #404042;">${escapeHtml(item.description || '')}</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #404042;">${escapeHtml(String(item.quantity || ''))} ${escapeHtml(item.unit || '')}</td>
            </tr>`
          ).join('')}
        </tbody>
      </table>`
    : '<p style="padding: 12px 16px; text-align: center; color: #777878;">No specific line items required</p>'
  
  previewHtml = previewHtml.replace(/{lineItems}/g, lineItemsHtml)

  // Replace plan link
  if (data.planLink) {
    previewHtml = previewHtml.replace(/{planLink}/g, `<a href="${escapeHtml(data.planLink)}" style="color: #EB5023; text-decoration: none; font-weight: 600;">📐 View & Download All Project Plans</a>`)
  } else {
    previewHtml = previewHtml.replace(/{planLink}/g, 'Plans will be provided separately')
  }

  // Replace reports
  if (data.reportLinks && data.reportLinks.length > 0) {
    const reportsHtml = data.reportLinks.map(r => 
      `<a href="${escapeHtml(r.url)}" style="color: #EB5023; text-decoration: none; margin-right: 12px; display: inline-block; margin-bottom: 8px; padding: 10px 16px; border: 2px solid #EB5023; border-radius: 6px; font-size: 13px;">📄 ${escapeHtml(r.title)}</a>`
    ).join('')
    previewHtml = previewHtml.replace(/{reports}/g, reportsHtml)
  } else {
    previewHtml = previewHtml.replace(/{reports}/g, '')
  }

  return previewHtml
}

/**
 * Generate preview subject by replacing template variables
 */
export function generatePreviewSubject(
  subject: string,
  sampleData?: Partial<PreviewData>
): string {
  const data: PreviewData = {
    jobName: 'Sample Construction Project',
    tradeCategory: 'Electrical',
    ...sampleData
  }

  let previewSubject = subject
  previewSubject = previewSubject.replace(/{jobName}/g, data.jobName || '')
  previewSubject = previewSubject.replace(/{jobLocation}/g, data.jobLocation || '')
  previewSubject = previewSubject.replace(/{tradeCategory}/g, data.tradeCategory || '')
  
  const formattedDeadline = data.deadline
    ? new Date(data.deadline).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'No deadline set'
  previewSubject = previewSubject.replace(/{deadline}/g, formattedDeadline)
  
  previewSubject = previewSubject.replace(/{description}/g, data.description || '')

  return previewSubject
}

/**
 * Escape HTML to prevent XSS in preview
 */
function escapeHtml(text: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null
  if (div) {
    div.textContent = text
    return div.innerHTML
  }
  // Server-side fallback
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Get list of available template variables
 */
export const TEMPLATE_VARIABLES = [
  { name: '{jobName}', description: 'Project name' },
  { name: '{jobLocation}', description: 'Project location' },
  { name: '{tradeCategory}', description: 'Trade category (e.g., "Electrical")' },
  { name: '{deadline}', description: 'Formatted deadline date' },
  { name: '{description}', description: 'Package description' },
  { name: '{lineItems}', description: 'HTML table of line items' },
  { name: '{planLink}', description: 'Link to view/download plans' },
  { name: '{reports}', description: 'HTML links to attached reports' }
] as const

