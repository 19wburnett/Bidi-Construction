import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const { emailId } = await params
    
    if (!emailId) {
      return NextResponse.json({ error: 'Email ID required' }, { status: 400 })
    }

    // Fetch inbound email content using Resend Receiving API
    console.log('📧 [content API] Fetching email content for:', emailId)
    const { data: emailData, error: receivingError } = await resend.emails.receiving.get(emailId)

    if (receivingError) {
      console.error('❌ [content API] Failed to fetch email content from Resend Receiving API:', JSON.stringify(receivingError, null, 2))
      return NextResponse.json(
        { error: 'Email content not available', details: receivingError.message || 'Unknown error' },
        { status: 404 }
      )
    }

    if (!emailData) {
      console.log('⚠️ [content API] No emailData returned from Receiving API')
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }
    
    console.log('✅ [content API] Fetched email data, keys:', Object.keys(emailData))
    console.log('📧 [content API] Email data structure:', JSON.stringify({
      hasHtml: !!emailData.html,
      hasText: !!emailData.text,
      htmlLength: emailData.html?.length || 0,
      textLength: emailData.text?.length || 0,
      bodyType: typeof emailData.body,
      bodyKeys: emailData.body && typeof emailData.body === 'object' ? Object.keys(emailData.body) : null,
      contentKeys: emailData.content ? Object.keys(emailData.content) : null,
      allKeys: Object.keys(emailData)
    }, null, 2))
    
    // Extract text content from HTML or use text field
    // Try multiple possible locations for content
    let textContent = emailData.text || 
                     emailData.body?.text || 
                     emailData.content?.text ||
                     (typeof emailData.body === 'string' ? emailData.body : '') ||
                     ''
    
    if (!textContent && emailData.html) {
      // Strip HTML tags to get plain text
      textContent = emailData.html
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
        .substring(0, 10000) // Limit to 10k chars
    }

    console.log('📧 [content API] Extracted content - hasText:', !!textContent, 'textLength:', textContent?.length)
    if (textContent) {
      console.log('📧 [content API] Text preview (first 200 chars):', textContent.substring(0, 200))
    }

    return NextResponse.json({
      content: textContent,
      html: emailData.html || null,
      hasContent: !!textContent
    })
  } catch (error: any) {
    console.error('❌ Error fetching email content:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email content', details: error.message },
      { status: 500 }
    )
  }
}

