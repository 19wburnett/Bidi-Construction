/**
 * Bidi Email Templates - Reminder
 * 
 * Follow-up reminder email template for bid requests.
 */

import { 
  generateEmailWrapper, 
  EMAIL_STYLES, 
  BRAND_COLORS,
  formatEmailDate 
} from './base'

interface ReminderEmailData {
  jobName: string
  jobLocation: string
  tradeCategory: string
  deadline: string | Date | null
  originalSentDate: string | Date
  reminderNumber: number // 1 = first reminder, 2 = second/final reminder
  planLink?: string | null
  recipientName?: string
}

/**
 * Generates the reminder email HTML
 */
export function generateReminderEmail(data: ReminderEmailData): string {
  const {
    jobName,
    jobLocation,
    tradeCategory,
    deadline,
    originalSentDate,
    reminderNumber,
    planLink,
    recipientName,
  } = data

  const formattedDeadline = formatEmailDate(deadline)
  const formattedOriginalDate = formatEmailDate(originalSentDate)
  const isFinalReminder = reminderNumber >= 2

  // Calculate days remaining if deadline exists
  let daysRemaining: number | null = null
  let urgencyColor = BRAND_COLORS.orange
  let urgencyText = 'Don\'t miss out!'
  
  if (deadline) {
    const deadlineDate = new Date(deadline)
    const now = new Date()
    daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysRemaining <= 1) {
      urgencyColor = '#DC2626' // Red
      urgencyText = 'Deadline is tomorrow!'
    } else if (daysRemaining <= 3) {
      urgencyColor = '#F59E0B' // Amber
      urgencyText = `Only ${daysRemaining} days left!`
    } else {
      urgencyText = `${daysRemaining} days remaining`
    }
  }

  const content = `
    <!-- Greeting -->
    ${recipientName ? `<p style="${EMAIL_STYLES.paragraph}">Hello ${recipientName},</p>` : `<p style="${EMAIL_STYLES.paragraph}">Hello,</p>`}
    
    <!-- Reminder Banner -->
    <div style="background-color: ${isFinalReminder ? '#FEF2F2' : BRAND_COLORS.orangeLight}; border-left: 4px solid ${isFinalReminder ? '#DC2626' : BRAND_COLORS.orange}; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 24px;">
      <p style="font-size: 14px; font-weight: 600; color: ${isFinalReminder ? '#DC2626' : BRAND_COLORS.orange}; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px;">
        ${isFinalReminder ? '⏰ Final Reminder' : '📬 Friendly Reminder'}
      </p>
      <p style="${EMAIL_STYLES.paragraph}; margin: 0; color: ${BRAND_COLORS.darkGray};">
        ${isFinalReminder 
          ? 'This is your final reminder to submit your bid for the project below.'
          : 'We noticed you haven\'t submitted your bid yet. We\'d love to hear from you!'
        }
      </p>
    </div>

    <p style="${EMAIL_STYLES.paragraph}">
      We sent you a bid request on <strong>${formattedOriginalDate}</strong> for the following project:
    </p>

    <!-- Project Title -->
    <h1 style="${EMAIL_STYLES.title}">${jobName}</h1>
    <p style="${EMAIL_STYLES.subtitle}">${tradeCategory} Services</p>

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
            <p style="${EMAIL_STYLES.infoValue}; color: ${urgencyColor};">${formattedDeadline}</p>
            ${daysRemaining !== null ? `
              <p style="font-size: 13px; font-weight: 600; color: ${urgencyColor}; margin: 4px 0 0 0;">
                ${urgencyText}
              </p>
            ` : ''}
          </td>
        </tr>
      </table>
    </div>

    ${planLink ? `
      <!-- View Plans Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${planLink}" class="button" style="${EMAIL_STYLES.buttonPrimary}">
          📐 View Project Plans
        </a>
      </div>
    ` : ''}

    <div style="${EMAIL_STYLES.divider}"></div>

    <!-- How to Submit -->
    <div style="${EMAIL_STYLES.infoBox}">
      <h3 style="font-size: 16px; font-weight: 600; color: ${BRAND_COLORS.black}; margin: 0 0 12px 0;">
        Ready to Submit?
      </h3>
      <p style="${EMAIL_STYLES.paragraph}; margin-bottom: 12px;">
        Simply <strong>reply to this email</strong> with:
      </p>
      <ul style="${EMAIL_STYLES.list}">
        <li style="${EMAIL_STYLES.listItem}"><strong>Bid Amount:</strong> Your total price</li>
        <li style="${EMAIL_STYLES.listItem}"><strong>Timeline:</strong> Start date and completion estimate</li>
        <li style="${EMAIL_STYLES.listItem}"><strong>Questions:</strong> Any clarifications needed</li>
      </ul>
    </div>

    ${isFinalReminder ? `
      <!-- Final Notice -->
      <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px 20px; margin-top: 24px;">
        <p style="${EMAIL_STYLES.paragraph}; margin: 0; color: #92400E; font-size: 14px;">
          <strong>⚠️ Important:</strong> This is the final reminder for this bid request. 
          If you're not interested in this project, no action is needed.
        </p>
      </div>
    ` : `
      <!-- Not Interested Note -->
      <p style="${EMAIL_STYLES.paragraph}; font-size: 13px; color: ${BRAND_COLORS.mediumGray}; margin-top: 24px;">
        Not interested in this project? No worries! Simply ignore this email and we won't bother you again about it.
      </p>
    `}

    <!-- Closing -->
    <p style="${EMAIL_STYLES.paragraph}; margin-top: 24px;">
      ${isFinalReminder 
        ? 'We hope to hear from you before the deadline!'
        : 'Looking forward to receiving your bid!'
      }
    </p>
  `

  const preheader = isFinalReminder
    ? `Final reminder: ${jobName} bid deadline approaching - ${urgencyText}`
    : `Reminder: We're still waiting for your bid on ${jobName}`

  return generateEmailWrapper(content, preheader)
}

/**
 * Generates a subject line for reminder emails
 */
export function generateReminderSubject(jobName: string, tradeCategory: string, reminderNumber: number): string {
  if (reminderNumber >= 2) {
    return `⏰ Final Reminder: ${jobName} - ${tradeCategory} Bid`
  }
  return `📬 Reminder: ${jobName} - ${tradeCategory} Bid Request`
}

