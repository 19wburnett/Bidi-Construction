/**
 * Utility functions to clean email content by removing quoted/replied messages
 */

/**
 * Cleans plain text email content by removing quoted/replied content
 * Removes common reply patterns like:
 * - "On [date] [person] wrote:"
 * - Lines starting with ">"
 * - "-----Original Message-----"
 * - Email headers
 */
export function cleanEmailText(text: string): string {
  if (!text) return ''
  
  let cleaned = text.trim()
  
  // Common reply patterns to detect where quoted content starts
  const replyPatterns = [
    // "On [date] [person] wrote:" pattern (Gmail, Outlook, etc.)
    // Pattern: "On Mon, Dec 15, 2025 at 10:39 AM Weston Burnett <email> wrote:"
    /\nOn\s+[A-Z][a-z]{2,},\s+[A-Z][a-z]{2,}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M\s+[^<]+<[^>]+>\s+wrote:/i,
    // Pattern: "On Mon Dec 15, 2025 at 10:39 AM ... wrote:"
    /\nOn\s+[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M\s+[^<]+<[^>]+>\s+wrote:/i,
    // Pattern: "On [day] [date] [person] wrote:" (without time)
    /\nOn\s+[A-Z][a-z]{2,}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M\s+[^<]+<[^>]+>\s+wrote:/i,
    // Pattern: "On [date] [person] wrote:" (various formats)
    /\nOn\s+[A-Z][a-z]{2,}\s+\d{1,2}\s+[A-Z][a-z]{2,}\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M\s+[^<]+<[^>]+>\s+wrote:/i,
    /\nOn\s+[A-Z][a-z]{2,}\s+\d{1,2}\s+[A-Z][a-z]{2,}\s+\d{4}\s+[^<]+<[^>]+>\s+wrote:/i,
    /\nOn\s+[A-Z][a-z]{2,}\s+\d{1,2}\s+[A-Z][a-z]{2,}\s+\d{4}\s+[^:]+\s+wrote:/i,
    // Pattern: "On [date] [person] <email> wrote:" (simpler format)
    /\nOn\s+[^<]+<[^>]+>\s+wrote:/i,
    // "-----Original Message-----" pattern
    /\n-{3,}\s*Original\s+Message\s*-{3,}/i,
    // "From:" header pattern
    /\nFrom:\s+[^\n]+\n/i,
    // "Sent:" header pattern
    /\nSent:\s+[^\n]+\n/i,
    // "Date:" header pattern
    /\nDate:\s+[^\n]+\n/i,
    // "Subject:" header pattern
    /\nSubject:\s+[^\n]+\n/i,
    // "To:" header pattern
    /\nTo:\s+[^\n]+\n/i,
  ]
  
  // Find the earliest reply marker
  let earliestIndex = cleaned.length
  for (const pattern of replyPatterns) {
    const match = cleaned.search(pattern)
    if (match !== -1 && match < earliestIndex) {
      earliestIndex = match
    }
  }
  
  // If we found a reply marker, extract only content before it
  if (earliestIndex < cleaned.length) {
    cleaned = cleaned.substring(0, earliestIndex).trim()
  }
  
  // Remove any remaining quoted lines (lines starting with ">")
  // But only if they appear after the main content (likely quoted content)
  const lines = cleaned.split('\n')
  const mainContentLines: string[] = []
  let foundQuoteStart = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // If we encounter a line starting with ">" and we already have content,
    // this is likely quoted content - stop here
    if (trimmedLine.startsWith('>') && mainContentLines.length > 0) {
      foundQuoteStart = true
      break
    }
    
    // Skip empty lines if we haven't started collecting content yet
    if (trimmedLine === '' && mainContentLines.length === 0) {
      continue
    }
    
    mainContentLines.push(line)
  }
  
  cleaned = mainContentLines.join('\n').trim()
  
  return cleaned
}

/**
 * Cleans HTML email content by removing quoted/replied content
 * Removes HTML quote blocks and extracts only the new message
 */
export function cleanEmailHtml(html: string): string {
  if (!html) return ''
  
  let cleaned = html.trim()
  
  // Remove common HTML quote blocks
  // Gmail quote blocks
  cleaned = cleaned.replace(/<div[^>]*class="gmail_quote"[^>]*>[\s\S]*?<\/div>/gi, '')
  cleaned = cleaned.replace(/<blockquote[^>]*class="gmail_quote"[^>]*>[\s\S]*?<\/blockquote>/gi, '')
  
  // Outlook quote blocks
  cleaned = cleaned.replace(/<div[^>]*id="divRplyFwdMsg"[^>]*>[\s\S]*?<\/div>/gi, '')
  
  // Generic blockquotes
  cleaned = cleaned.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
  
  // Remove "On [date] wrote:" patterns in HTML
  cleaned = cleaned.replace(/<div[^>]*>[\s]*On\s+[A-Z][a-z]{2,}\s+\d{1,2}[^<]*wrote:[\s\S]*?<\/div>/gi, '')
  
  // Remove any remaining quote markers
  cleaned = cleaned.replace(/<div[^>]*>[\s]*&gt;[\s\S]*?<\/div>/gi, '')
  
  // Clean up any empty divs or paragraphs left behind
  cleaned = cleaned.replace(/<div[^>]*>[\s]*<\/div>/gi, '')
  cleaned = cleaned.replace(/<p[^>]*>[\s]*<\/p>/gi, '')
  
  return cleaned.trim()
}

/**
 * Cleans email content (handles both text and HTML)
 * Returns cleaned text content
 */
export function cleanEmailContent(text: string, html?: string): string {
  // If we have HTML, clean it first and convert to text
  if (html) {
    const cleanedHtml = cleanEmailHtml(html)
    if (cleanedHtml) {
      // Convert cleaned HTML to text
      let textFromHtml = cleanedHtml
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Further clean the text
      textFromHtml = cleanEmailText(textFromHtml)
      
      // If cleaned HTML text is substantial, use it
      if (textFromHtml.length > 10) {
        return textFromHtml
      }
    }
  }
  
  // Otherwise, clean the plain text
  return cleanEmailText(text || '')
}

