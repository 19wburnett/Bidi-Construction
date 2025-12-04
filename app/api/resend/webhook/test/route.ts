import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * Test endpoint to manually simulate an inbound email webhook
 * This helps test the webhook handler without needing Resend domain setup
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
    const { bidPackageId, fromEmail, subject, content } = body

    if (!bidPackageId || !fromEmail || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: bidPackageId, fromEmail, content' },
        { status: 400 }
      )
    }

    // Simulate Resend webhook payload
    const mockWebhookPayload = {
      type: 'email.received',
      data: {
        from: {
          email: fromEmail,
          name: 'Test Subcontractor'
        },
        to: [`bids+${bidPackageId}@bids.bidicontracting.com`],
        subject: subject || 'Re: Bid Request',
        html: `<p>${content}</p>`,
        text: content,
        headers: {
          'reply-to': `bids+${bidPackageId}@bids.bidicontracting.com`
        },
        attachments: []
      }
    }

    // Call the webhook endpoint directly (simpler approach)
    const baseUrl = request.nextUrl.origin
    const webhookUrl = `${baseUrl}/api/resend/webhook`
    
    console.log('Calling webhook at:', webhookUrl)
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockWebhookPayload)
    })
    
    const result = await webhookResponse.json()

    return NextResponse.json({
      success: true,
      message: 'Test email processed',
      result
    })

  } catch (error: any) {
    console.error('Error in test webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process test webhook', details: error.message },
      { status: 500 }
    )
  }
}

