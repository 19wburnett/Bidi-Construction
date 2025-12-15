import { NextRequest, NextResponse } from 'next/server'

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

    // Try to fetch email content from Resend API
    // Note: Inbound emails may not be accessible via this endpoint
    const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Failed to fetch email content from Resend:', response.status, errorText)
      return NextResponse.json(
        { error: 'Email content not available', details: errorText },
        { status: response.status }
      )
    }

    const emailData = await response.json()
    
    // Extract text content from HTML or use text field
    let textContent = emailData.text || ''
    
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

