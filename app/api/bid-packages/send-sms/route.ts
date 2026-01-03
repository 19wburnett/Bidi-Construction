import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

interface SendSMSRequest {
  bidPackageId: string
  recipientId: string
  message: string
}

/**
 * Send SMS via Telnyx API
 */
async function sendTelnyxSMS(to: string, message: string): Promise<{ id: string; error?: any }> {
  const telnyxApiKey = process.env.TELNYX_API_KEY
  if (!telnyxApiKey) {
    throw new Error('TELNYX_API_KEY is not configured')
  }

  const telnyxPhoneNumber = process.env.TELNYX_PHONE_NUMBER
  if (!telnyxPhoneNumber) {
    throw new Error('TELNYX_PHONE_NUMBER is not configured. Please set it in your .env file.')
  }

  // Normalize both phone numbers (must be in E.164 format)
  const { formatPhoneNumber } = await import('@/lib/sms-helper')
  console.log('📱 [sendTelnyxSMS] Raw phone number from env:', telnyxPhoneNumber)
  const normalizedFrom = formatPhoneNumber(telnyxPhoneNumber)
  const normalizedTo = formatPhoneNumber(to)

  console.log('📱 [sendTelnyxSMS] Sending SMS:', {
    originalFrom: telnyxPhoneNumber,
    normalizedFrom: normalizedFrom,
    originalTo: to,
    normalizedTo: normalizedTo,
    messageLength: message.length
  })

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${telnyxApiKey}`
    },
    body: JSON.stringify({
      from: normalizedFrom,
      to: normalizedTo,
      text: message
    })
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('❌ Telnyx API error:', JSON.stringify(data, null, 2))
    
    // Provide more helpful error messages
    const errorCode = data.errors?.[0]?.code
    const errorDetail = data.errors?.[0]?.detail || data.message || 'Failed to send SMS'
    
    if (errorCode === '40013') {
      throw new Error(
        `Invalid source phone number: ${normalizedFrom}. ` +
        `Please verify: 1) The number is in E.164 format (e.g., +1234567890), ` +
        `2) The number is enabled for messaging in your Telnyx dashboard, ` +
        `3) The number is verified and active. ` +
        `Check your TELNYX_PHONE_NUMBER environment variable.`
      )
    }
    
    if (errorCode === '10039') {
      throw new Error(
        `Telnyx account restriction: Only pre-verified destination numbers are allowed at your account level. ` +
        `The destination number ${normalizedTo} needs to be verified before sending. ` +
        `Options: ` +
        `1) Verify the destination number in Telnyx Dashboard → Numbers → Verify Numbers, OR ` +
        `2) Upgrade your Telnyx account to allow sending to unverified numbers. ` +
        `See: https://telnyx.com/upgrade or https://developers.telnyx.com/docs/overview/errors/10039`
      )
    }
    
    if (errorCode === '40010') {
      throw new Error(
        `10DLC Registration Required: Your phone number ${normalizedFrom} is not registered for 10DLC (10-Digit Long Code) messaging, ` +
        `which is required by the carrier for A2P messaging. ` +
        `To fix: Go to Telnyx Dashboard → Messaging → 10DLC → Register your brand and campaign. ` +
        `See: https://developers.telnyx.com/docs/overview/errors/40010`
      )
    }
    
    throw new Error(errorDetail)
  }

  return { id: data.data.id }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body: SendSMSRequest = await request.json()
    const { bidPackageId, recipientId, message } = body

    if (!bidPackageId || !recipientId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: bidPackageId, recipientId, message' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this bid package
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select(`
        *,
        jobs!inner (
          id,
          user_id
        )
      `)
      .eq('id', bidPackageId)
      .single()

    const jobUserId = bidPackage?.jobs && (Array.isArray(bidPackage.jobs) ? bidPackage.jobs[0]?.user_id : (bidPackage.jobs as any).user_id)

    if (packageError || !bidPackage || jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Bid package not found or unauthorized' },
        { status: 404 }
      )
    }

    // Get recipient details
    const { data: recipient, error: recipientError } = await supabase
      .from('bid_package_recipients')
      .select('*')
      .eq('id', recipientId)
      .eq('bid_package_id', bidPackageId)
      .single()

    if (recipientError || !recipient) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      )
    }

    // Check if recipient has a phone number
    if (!recipient.subcontractor_phone) {
      return NextResponse.json(
        { error: 'Recipient does not have a phone number' },
        { status: 400 }
      )
    }

    // Send SMS via Telnyx
    let telnyxMessageId: string
    try {
      const result = await sendTelnyxSMS(recipient.subcontractor_phone, message)
      telnyxMessageId = result.id
    } catch (error: any) {
      console.error('❌ Error sending SMS:', error)
      return NextResponse.json(
        { error: 'Failed to send SMS', details: error.message },
        { status: 500 }
      )
    }

    // Update recipient with SMS details
    const { error: updateError } = await supabase
      .from('bid_package_recipients')
      .update({
        telnyx_message_id: telnyxMessageId,
        sms_status: 'sent',
        sms_sent_at: new Date().toISOString(),
        response_text: message, // Store the message sent
        is_from_gc: true
      })
      .eq('id', recipientId)

    if (updateError) {
      console.error('❌ Error updating recipient with SMS details:', updateError)
      return NextResponse.json(
        { error: 'Failed to update recipient', details: updateError.message },
        { status: 500 }
      )
    }

    console.log('✅ SMS sent successfully:', { recipientId, telnyxMessageId })

    return NextResponse.json({
      success: true,
      messageId: telnyxMessageId,
      recipientId
    })

  } catch (error: any) {
    console.error('Error sending SMS:', error)
    return NextResponse.json(
      { error: 'Failed to send SMS', details: error.message },
      { status: 500 }
    )
  }
}
