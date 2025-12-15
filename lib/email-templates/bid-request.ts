/**
 * Bidi Email Templates - Bid Request
 * 
 * Professional bid request email template with full Bidi branding.
 */

import { 
  generateEmailWrapper, 
  EMAIL_STYLES, 
  BRAND_COLORS,
  formatEmailDate 
} from './base'

interface LineItem {
  description: string
  quantity?: number | string
  unit?: string
  unit_cost?: number
}

interface BidRequestEmailData {
  jobName: string
  jobLocation: string
  tradeCategory: string
  deadline: string | Date | null
  description?: string
  lineItems?: LineItem[]
  planLink?: string | null
  reportLinks?: { title: string; url: string }[]
  recipientName?: string
}

/**
 * Generates the bid request email HTML
 */
export function generateBidRequestEmail(data: BidRequestEmailData): string {
  const {
    jobName,
    jobLocation,
    tradeCategory,
    deadline,
    description,
    lineItems = [],
    planLink,
    reportLinks = [],
    recipientName,
  } = data

  const formattedDeadline = formatEmailDate(deadline)
  const hasLineItems = lineItems && lineItems.length > 0
  const hasReports = reportLinks && reportLinks.length > 0

  // Build line items table
  const lineItemsTable = hasLineItems ? `
    <table role="presentation" style="${EMAIL_STYLES.table}">
      <thead>
        <tr>
          <th style="${EMAIL_STYLES.tableHeader}">Description</th>
          <th style="${EMAIL_STYLES.tableHeader}">Quantity</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map(item => `
          <tr>
            <td style="${EMAIL_STYLES.tableCell}">${item.description || '—'}</td>
            <td style="${EMAIL_STYLES.tableCell}">${item.quantity || ''} ${item.unit || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''

  // Build reports list
  const reportsList = hasReports ? `
    <div style="margin-top: 16px;">
      <p style="${EMAIL_STYLES.infoLabel}">Attached Reports</p>
      ${reportLinks.map(r => `
        <a href="${r.url}" style="${EMAIL_STYLES.buttonSecondary}; margin-right: 8px; margin-bottom: 8px; display: inline-block; font-size: 13px; padding: 10px 16px;">
          📄 ${r.title}
        </a>
      `).join('')}
    </div>
  ` : ''

  const content = `
    <!-- Greeting -->
    ${recipientName ? `<p style="${EMAIL_STYLES.paragraph}">Hello ${recipientName},</p>` : ''}
    
    <p style="${EMAIL_STYLES.paragraph}">
      You've been invited to submit a bid for the following construction project. 
      We'd love to have you participate!
    </p>

    <!-- Project Title -->
    <h1 style="${EMAIL_STYLES.title}">${jobName}</h1>
    <p style="${EMAIL_STYLES.subtitle}">${tradeCategory} Services Required</p>

    <!-- Key Details Box -->
    <div style="${EMAIL_STYLES.infoBoxHighlight}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="vertical-align: top; padding-right: 16px;">
            <p style="${EMAIL_STYLES.infoLabel}">📍 Location</p>
            <p style="${EMAIL_STYLES.infoValue}">${jobLocation}</p>
          </td>
          <td width="50%" style="vertical-align: top;">
            <p style="${EMAIL_STYLES.infoLabel}">📅 Bid Deadline</p>
            <p style="${EMAIL_STYLES.infoValue}; color: ${BRAND_COLORS.orange};">${formattedDeadline}</p>
          </td>
        </tr>
      </table>
    </div>

    ${description ? `
      <!-- Description -->
      <div style="${EMAIL_STYLES.infoBox}">
        <p style="${EMAIL_STYLES.infoLabel}">Project Description</p>
        <p style="${EMAIL_STYLES.paragraph}; margin-bottom: 0;">${description}</p>
      </div>
    ` : ''}

    ${planLink ? `
      <!-- View Plans Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${planLink}" class="button" style="${EMAIL_STYLES.buttonPrimary}">
          📐 View & Download All Project Plans
        </a>
        <p style="font-size: 13px; color: #6B7280; margin-top: 8px;">
          Access all plans, drawings, and documents for this project
        </p>
      </div>
    ` : ''}

    ${reportsList}

    ${hasLineItems ? `
      <!-- Line Items -->
      <div style="margin-top: 32px;">
        <h3 style="font-size: 16px; font-weight: 600; color: ${BRAND_COLORS.black}; margin: 0 0 16px 0;">
          Minimum Required Line Items
        </h3>
        ${lineItemsTable}
      </div>
    ` : ''}

    <div style="${EMAIL_STYLES.divider}"></div>

    <!-- How to Submit -->
    <div style="${EMAIL_STYLES.infoBox}; background-color: #F0FDF4; border-left: 4px solid #16A34A; border-radius: 0 8px 8px 0;">
      <h3 style="font-size: 16px; font-weight: 600; color: #166534; margin: 0 0 12px 0;">
        📋 How to Submit Your Bid
      </h3>
      <p style="${EMAIL_STYLES.paragraph}; margin-bottom: 12px;">
        Simply <strong>reply to this email</strong> with the following information:
      </p>
      <ul style="${EMAIL_STYLES.list}">
        <li style="${EMAIL_STYLES.listItem}"><strong>Bid Amount:</strong> Your total price for the work</li>
        <li style="${EMAIL_STYLES.listItem}"><strong>Timeline:</strong> When you can start and estimated completion</li>
        <li style="${EMAIL_STYLES.listItem}"><strong>Questions:</strong> Any clarifications you need</li>
      </ul>
      <p style="${EMAIL_STYLES.paragraph}; font-size: 13px; color: #166534; margin: 0;">
        💡 <strong>Tip:</strong> You can attach files like detailed quotes or certifications to your reply.
      </p>
    </div>

    <!-- Closing -->
    <p style="${EMAIL_STYLES.paragraph}; margin-top: 24px;">
      Thank you for your interest in this project. We look forward to receiving your bid!
    </p>
  `

  const preheader = `Bid request for ${jobName} - ${tradeCategory} services. Deadline: ${formattedDeadline}`

  return generateEmailWrapper(content, preheader)
}

/**
 * Generates a plain subject line for bid request emails
 */
export function generateBidRequestSubject(jobName: string, tradeCategory: string): string {
  return `Bid Request: ${jobName} - ${tradeCategory}`
}












