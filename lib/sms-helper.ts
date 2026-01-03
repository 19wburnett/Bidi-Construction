/**
 * SMS Helper Functions
 * Converts email content to SMS-friendly text and handles SMS formatting
 */

/**
 * Convert HTML email content to SMS-friendly text
 * Strips HTML, shortens URLs, and formats for SMS (1600 char limit recommended)
 */
export function htmlToSMS(html: string, maxLength: number = 1600): string {
  if (!html) return ''

  // Remove style and script tags
  let text = html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()

  // If text is too long, truncate intelligently
  if (text.length > maxLength) {
    // Try to truncate at a sentence boundary
    const truncated = text.substring(0, maxLength - 3)
    const lastPeriod = truncated.lastIndexOf('.')
    const lastExclamation = truncated.lastIndexOf('!')
    const lastQuestion = truncated.lastIndexOf('?')
    const lastNewline = truncated.lastIndexOf('\n')
    
    const lastBreak = Math.max(lastPeriod, lastExclamation, lastQuestion, lastNewline)
    
    if (lastBreak > maxLength * 0.7) {
      // If we found a good break point, use it
      text = truncated.substring(0, lastBreak + 1) + '...'
    } else {
      // Otherwise just truncate
      text = truncated + '...'
    }
  }

  return text
}

/**
 * Generate SMS text from bid package data
 */
export function generateBidPackageSMS(data: {
  jobName: string
  jobLocation: string
  tradeCategory: string
  deadline: string | null
  description?: string
  planLink?: string | null
}): string {
  let sms = `New ${data.tradeCategory} opportunity: ${data.jobName}\n`
  sms += `Location: ${data.jobLocation}\n`
  
  if (data.deadline) {
    const deadlineDate = new Date(data.deadline)
    sms += `Deadline: ${deadlineDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}\n`
  }
  
  if (data.description) {
    // Truncate description if too long
    const desc = data.description.length > 200 
      ? data.description.substring(0, 197) + '...'
      : data.description
    sms += `\n${desc}\n`
  }
  
  if (data.planLink) {
    sms += `\nView plans: ${data.planLink}`
  }
  
  sms += `\n\nReply to this message to submit your bid.`
  
  return sms
}

/**
 * Format phone number for Telnyx (ensures + prefix and E.164 format)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number is required and must be a string')
  }
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '').trim()
  
  if (!cleaned) {
    throw new Error('Phone number cannot be empty')
  }
  
  // If it doesn't start with +, add it (assuming US number if no country code)
  if (!cleaned.startsWith('+')) {
    // If it's 10 digits, assume US and add +1
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      // Already has country code but no +
      cleaned = '+' + cleaned
    } else {
      // Otherwise just add +
      cleaned = '+' + cleaned
    }
  }
  
  // Validate E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/
  if (!e164Regex.test(cleaned)) {
    throw new Error(`Invalid phone number format: ${phone}. Must be in E.164 format (e.g., +1234567890)`)
  }
  
  return cleaned
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^\d+]/g, '')
  // Basic validation: should have at least 10 digits and start with +
  return cleaned.startsWith('+') && cleaned.replace(/[^\d]/g, '').length >= 10
}
