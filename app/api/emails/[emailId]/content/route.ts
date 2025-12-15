import { NextRequest, NextResponse } from 'next/server'
import { cleanEmailContent } from '@/lib/email-content-cleaner'

export const runtime = 'nodejs'

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
    // Use direct API call since SDK types may not include receiving API
    console.log('📧 [content API] Fetching email content for:', emailId)
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [content API] Failed to fetch email content from Resend Receiving API:', response.status, errorText)
      return NextResponse.json(
        { error: 'Email content not available', details: errorText },
        { status: response.status }
      )
    }

    const emailData = await response.json()

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
    let rawText = emailData.text || 
                  emailData.body?.text || 
                  emailData.content?.text ||
                  (typeof emailData.body === 'string' ? emailData.body : '') ||
                  ''
    
    // Clean the email content to remove quoted/replied messages
    const textContent = cleanEmailContent(rawText, emailData.html || '')
      .substring(0, 10000) // Limit to 10k chars

    console.log('📧 [content API] Extracted and cleaned content - hasText:', !!textContent, 'textLength:', textContent?.length)
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

