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
  sampleData?: Partial<PreviewData>,
  branding?: {
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    textColor?: string
    fontFamily?: string
    companyName?: string
    logoUrl?: string
    signature?: string
  }
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

  // Replace line items - build simple text-based list
  const lineItemsHtml = data.lineItems && data.lineItems.length > 0
    ? `<ul style="margin: 16px 0; padding-left: 20px; list-style-type: disc;">
        ${data.lineItems.map(item => 
          `<li style="margin: 8px 0; font-size: 16px; line-height: 1.5;">${escapeHtml(item.description || '')} - ${escapeHtml(String(item.quantity || ''))} ${escapeHtml(item.unit || '')}</li>`
        ).join('')}
      </ul>`
    : '<p style="margin: 16px 0; font-size: 16px; line-height: 1.5;">No specific line items required</p>'
  
  previewHtml = previewHtml.replace(/{lineItems}/g, lineItemsHtml)

  // Replace plan link - simple text link
  if (data.planLink) {
    previewHtml = previewHtml.replace(/{planLink}/g, `<a href="${escapeHtml(data.planLink)}" style="color: #EB5023; text-decoration: underline;">${escapeHtml(data.planLink)}</a>`)
  } else {
    previewHtml = previewHtml.replace(/{planLink}/g, 'Plans will be provided separately')
  }

  // Replace reports - simple text list
  if (data.reportLinks && data.reportLinks.length > 0) {
    const reportsHtml = data.reportLinks.map(r => 
      `<p style="margin: 8px 0; font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(r.url)}" style="color: #EB5023; text-decoration: underline;">${escapeHtml(r.title)}</a></p>`
    ).join('')
    previewHtml = previewHtml.replace(/{reports}/g, reportsHtml)
  } else {
    previewHtml = previewHtml.replace(/{reports}/g, '')
  }

  // Replace bid email
  const bidEmail = 'bids+sample@bids.bidicontracting.com'
  previewHtml = previewHtml.replace(/{bidEmail}/g, escapeHtml(bidEmail))

  // Apply branding if provided
  if (branding) {
    previewHtml = previewHtml.replace(/\$\{primaryColor\}/g, branding.primaryColor || '#EB5023')
    previewHtml = previewHtml.replace(/\$\{secondaryColor\}/g, branding.secondaryColor || '#1E1D1E')
    previewHtml = previewHtml.replace(/\$\{backgroundColor\}/g, branding.backgroundColor || '#FFFFFF')
    previewHtml = previewHtml.replace(/\$\{textColor\}/g, branding.textColor || '#1E1D1E')
    previewHtml = previewHtml.replace(/\$\{fontFamily\}/g, branding.fontFamily || 'Arial, sans-serif')
    previewHtml = previewHtml.replace(/\$\{companyName\}/g, escapeHtml(branding.companyName || ''))
    previewHtml = previewHtml.replace(/\$\{logoUrl\}/g, branding.logoUrl || '')
    
    // Also handle without $ prefix
    previewHtml = previewHtml.replace(/\{primaryColor\}/g, branding.primaryColor || '#EB5023')
    previewHtml = previewHtml.replace(/\{secondaryColor\}/g, branding.secondaryColor || '#1E1D1E')
    previewHtml = previewHtml.replace(/\{backgroundColor\}/g, branding.backgroundColor || '#FFFFFF')
    previewHtml = previewHtml.replace(/\{textColor\}/g, branding.textColor || '#1E1D1E')
    previewHtml = previewHtml.replace(/\{fontFamily\}/g, branding.fontFamily || 'Arial, sans-serif')
    previewHtml = previewHtml.replace(/\{companyName\}/g, escapeHtml(branding.companyName || ''))
    previewHtml = previewHtml.replace(/\{logoUrl\}/g, branding.logoUrl || '')
    
    // Apply signature
    if (branding.signature) {
      let signatureHtml = branding.signature
      signatureHtml = signatureHtml.replace(/\{primaryColor\}/g, branding.primaryColor || '#EB5023')
      signatureHtml = signatureHtml.replace(/\{secondaryColor\}/g, branding.secondaryColor || '#1E1D1E')
      signatureHtml = signatureHtml.replace(/\{backgroundColor\}/g, branding.backgroundColor || '#FFFFFF')
      signatureHtml = signatureHtml.replace(/\{textColor\}/g, branding.textColor || '#1E1D1E')
      signatureHtml = signatureHtml.replace(/\{fontFamily\}/g, branding.fontFamily || 'Arial, sans-serif')
      signatureHtml = signatureHtml.replace(/\{companyName\}/g, escapeHtml(branding.companyName || ''))
      signatureHtml = signatureHtml.replace(/\{logoUrl\}/g, branding.logoUrl || '')
      previewHtml = previewHtml.replace(/\{signature\}/g, signatureHtml)
    } else {
      // Default signature
      let defaultSignature = '<p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.5;">Thanks,</p>'
      if (branding.logoUrl) {
        defaultSignature += `<div style="margin: 8px 0;"><img src="${branding.logoUrl}" alt="${escapeHtml(branding.companyName || '')}" style="max-height: 40px;" /></div>`
      }
      if (branding.companyName) {
        defaultSignature += `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${branding.textColor || '#1E1D1E'};">${escapeHtml(branding.companyName)}</p>`
      } else {
        defaultSignature += `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${branding.textColor || '#1E1D1E'};">The Team</p>`
      }
      previewHtml = previewHtml.replace(/\{signature\}/g, defaultSignature)
    }
  } else {
    // Default branding if not provided
    previewHtml = previewHtml.replace(/\$\{primaryColor\}/g, '#EB5023')
    previewHtml = previewHtml.replace(/\$\{secondaryColor\}/g, '#1E1D1E')
    previewHtml = previewHtml.replace(/\$\{backgroundColor\}/g, '#FFFFFF')
    previewHtml = previewHtml.replace(/\$\{textColor\}/g, '#1E1D1E')
    previewHtml = previewHtml.replace(/\$\{fontFamily\}/g, 'Arial, sans-serif')
    previewHtml = previewHtml.replace(/\$\{companyName\}/g, '')
    previewHtml = previewHtml.replace(/\$\{logoUrl\}/g, '')
    
    previewHtml = previewHtml.replace(/\{primaryColor\}/g, '#EB5023')
    previewHtml = previewHtml.replace(/\{secondaryColor\}/g, '#1E1D1E')
    previewHtml = previewHtml.replace(/\{backgroundColor\}/g, '#FFFFFF')
    previewHtml = previewHtml.replace(/\{textColor\}/g, '#1E1D1E')
    previewHtml = previewHtml.replace(/\{fontFamily\}/g, 'Arial, sans-serif')
    previewHtml = previewHtml.replace(/\{companyName\}/g, 'The Team')
    previewHtml = previewHtml.replace(/\{logoUrl\}/g, '')
    
    // Default signature
    const defaultSignature = '<p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.5;">Thanks,</p><p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1E1D1E;">The Team</p>'
    previewHtml = previewHtml.replace(/\{signature\}/g, defaultSignature)
  }

  // Ensure we return a complete HTML document
  // If the template doesn't include DOCTYPE/html tags, wrap it
  if (!previewHtml.includes('<!DOCTYPE') && !previewHtml.includes('<html')) {
    previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${previewHtml}
</body>
</html>`
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
  { name: '{reports}', description: 'HTML links to attached reports' },
  { name: '{bidEmail}', description: 'Email address for submitting bids' }
] as const

