import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { generateTextWithGateway } from '@/lib/ai-gateway-provider'

export const runtime = 'nodejs'

const GENERATE_SYSTEM_PROMPT = `You are an expert email template writer for construction companies. Your task is to create email templates that look like authentic emails from an employee at the company - text-focused, minimal HTML styling, professional but casual tone.

Guidelines:
- Use minimal HTML structure (simple divs, paragraphs, basic formatting)
- Focus on text content, not heavy styling
- Natural email formatting (line breaks, simple lists)
- Professional but casual tone - like a real employee email
- Include company branding subtly (colors for headers/links, logo if provided)
- Use template variables: {jobName}, {jobLocation}, {tradeCategory}, {deadline}, {description}, {lineItems}, {planLink}, {reports}, {bidEmail}
- Keep HTML simple - mostly text with basic formatting, not heavily styled
- Structure should be: greeting, body text, simple formatting, signature area
- Make it feel personal and authentic, not like a marketing email
- Include a message about sending bids to {bidEmail} - explain that all bids should be sent to this email address, even if they send a separate email in a new thread

Return ONLY valid HTML that can be used directly in an email template. Do not include explanations or markdown formatting.`

const IMPROVE_SYSTEM_PROMPT = `You are an expert email template writer for construction companies. Your task is to improve email templates to be more text-based and employee-like - reduce styling, focus on text content, but keep company branding.

Guidelines:
- Make templates look more like natural emails from employees
- Reduce heavy HTML styling (remove complex layouts, cards, heavy borders)
- Focus on text content with simple formatting
- Keep company branding subtle (colors for links/headers, logo if provided)
- Maintain professional but casual tone
- Use template variables: {jobName}, {jobLocation}, {tradeCategory}, {deadline}, {description}, {lineItems}, {planLink}, {reports}, {bidEmail}
- Structure should be: greeting, body text, simple formatting, signature area
- Make it feel personal and authentic
- Include a message about sending bids to {bidEmail} - explain that all bids should be sent to this email address, even if they send a separate email in a new thread

Return ONLY valid HTML that can be used directly in an email template. Do not include explanations or markdown formatting.`

/**
 * POST /api/email-templates/generate
 * Generate or improve email templates using AI
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { mode, prompt, currentTemplate, subject, branding } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const isImproveMode = mode === 'improve'
    const systemPrompt = isImproveMode ? IMPROVE_SYSTEM_PROMPT : GENERATE_SYSTEM_PROMPT

    // Build user prompt
    let userPrompt = ''
    
    if (isImproveMode && currentTemplate) {
      userPrompt = `Improve this email template to be more text-based and employee-like:\n\n${currentTemplate}\n\nUser feedback: ${prompt}\n\n`
      
      if (subject) {
        userPrompt += `Current subject: ${subject}\n\n`
      }
      
      if (branding) {
        userPrompt += `Company branding:\n`
        if (branding.companyName) userPrompt += `- Company Name: ${branding.companyName}\n`
        if (branding.primaryColor) userPrompt += `- Primary Color: ${branding.primaryColor}\n`
        if (branding.fontFamily) userPrompt += `- Font Family: ${branding.fontFamily}\n`
        userPrompt += `\n`
      }
      
      userPrompt += `Generate an improved HTML email template that looks like a natural email from an employee.`
    } else {
      userPrompt = `Create an email template for construction bid packages that looks like an email from an employee at the company.\n\n`
      userPrompt += `Requirements: ${prompt}\n\n`
      
      if (branding) {
        userPrompt += `Company branding:\n`
        if (branding.companyName) userPrompt += `- Company Name: ${branding.companyName}\n`
        if (branding.primaryColor) userPrompt += `- Primary Color: ${branding.primaryColor}\n`
        if (branding.fontFamily) userPrompt += `- Font Family: ${branding.fontFamily}\n`
        userPrompt += `\n`
      }
      
      userPrompt += `Generate an HTML email template with subject line. Use template variables: {jobName}, {jobLocation}, {tradeCategory}, {deadline}, {description}, {lineItems}, {planLink}, {reports}, {bidEmail}. Include a message explaining that all bids should be sent to {bidEmail}, even if they send a separate email in a new thread.`
    }

    // Call AI Gateway
    const response = await generateTextWithGateway({
      model: 'openai/gpt-4o-mini',
      system: systemPrompt,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      maxTokens: 2000,
      temperature: 0.7
    })

    // Parse response - try to extract HTML and subject if both are provided
    let htmlBody = response.content.trim()
    let generatedSubject = subject || 'Bid Request: {jobName} - {tradeCategory}'

    // Check if response contains both subject and HTML (common pattern)
    const subjectMatch = htmlBody.match(/Subject:\s*(.+?)(?:\n|$)/i)
    if (subjectMatch) {
      generatedSubject = subjectMatch[1].trim()
      htmlBody = htmlBody.replace(/Subject:.*?\n/i, '').trim()
    }

    // Remove markdown code blocks if present
    htmlBody = htmlBody.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()

    // If response doesn't look like HTML, try to extract it
    if (!htmlBody.includes('<html') && !htmlBody.includes('<!DOCTYPE')) {
      // Try to find HTML in the response
      const htmlMatch = htmlBody.match(/<html[\s\S]*?<\/html>/i) || htmlBody.match(/<!DOCTYPE[\s\S]*?<\/html>/i)
      if (htmlMatch) {
        htmlBody = htmlMatch[0]
      } else {
        // If no HTML found, wrap the content in a simple HTML structure
        htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    ${htmlBody.split('\n').map(line => `<p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">${line}</p>`).join('\n')}
  </div>
</body>
</html>`
      }
    }

    return NextResponse.json({
      success: true,
      html_body: htmlBody,
      subject: generatedSubject,
      suggestions: isImproveMode ? ['Template improved to be more text-based and employee-like'] : []
    })

  } catch (error: any) {
    console.error('Error generating email template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate email template' },
      { status: 500 }
    )
  }
}
