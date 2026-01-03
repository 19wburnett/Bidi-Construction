import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Prevent any redirects or caching for webhook endpoint
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

// Use service role to bypass RLS for webhook operations
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured')
}

const supabase = serviceRoleKey
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null

/**
 * Verify Telnyx webhook signature
 * See: https://developers.telnyx.com/docs/api/v2/messaging/verify-webhook-signatures
 */
function verifyTelnyxSignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  const telnyxPublicKey = process.env.TELNYX_PUBLIC_KEY
  if (!telnyxPublicKey) {
    console.warn('⚠️ TELNYX_PUBLIC_KEY not set, skipping signature verification')
    return true // Allow in development, but log warning
  }

  try {
    // Telnyx uses ECDSA with SHA-256
    const verifier = crypto.createVerify('sha256')
    verifier.update(timestamp + '.' + payload)
    verifier.end()

    const isValid = verifier.verify(
      telnyxPublicKey,
      signature,
      'base64'
    )

    return isValid
  } catch (error) {
    console.error('❌ Error verifying Telnyx signature:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-telnyx-signature-ed25519')
    const timestamp = request.headers.get('x-telnyx-timestamp')

    if (!signature || !timestamp) {
      console.warn('⚠️ Missing Telnyx signature headers')
      // In development, we might not have signatures
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Missing signature headers' },
          { status: 401 }
        )
      }
    }

    const body = await request.text()
    const payload = JSON.parse(body)

    const eventType = payload.event_type || payload.type || payload.data?.event_type
    console.log('📱 [telnyx-webhook] Received event:', eventType, {
      messageId: payload.data?.id || payload.id,
      direction: payload.data?.direction || payload.direction,
      status: payload.data?.to?.[0]?.status || payload.data?.status
    })

    // Verify signature if provided
    if (signature && timestamp) {
      const isValid = verifyTelnyxSignature(body, signature, timestamp)
      if (!isValid) {
        console.error('❌ Invalid Telnyx signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    // Log full payload for debugging delivery issues
    if (eventType?.includes('delivery') || eventType?.includes('delivered')) {
      console.log('📱 [telnyx-webhook] Delivery event payload:', JSON.stringify(payload, null, 2))
    }

    // Handle different Telnyx event types
    switch (eventType) {
      case 'message.sent':
      case 'message.finalized':
        return await handleMessageSent(payload)
      
      case 'message.delivery.failed':
      case 'message.failed':
        return await handleMessageFailed(payload)
      
      case 'message.delivery.receipt':
      case 'message.delivered':
        return await handleMessageDelivered(payload)
      
      case 'message.received':
      case 'message.inbound.received':
        return await handleInboundMessage(payload)
      
      case '10dlc.brand.update':
      case 'TCR_BRAND_UPDATE':
        // Handle 10DLC brand status updates
        console.log('📱 [telnyx-webhook] 10DLC Brand Update:', {
          brandId: payload.brandId || payload.data?.brandId,
          brandName: payload.brandName || payload.data?.brandName,
          status: payload.brandIdentityStatus || payload.data?.brandIdentityStatus,
          tcrBrandId: payload.tcrBrandId || payload.data?.tcrBrandId
        })
        return NextResponse.json({ success: true, message: 'Brand update received' })
      
      default:
        console.log('⚠️ Unhandled Telnyx event type:', eventType)
        return NextResponse.json(
          { message: 'Event type not handled', event_type: eventType },
          { status: 200 }
        )
    }
  } catch (error: any) {
    console.error('❌ Error processing Telnyx webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle message sent event
 */
async function handleMessageSent(payload: any) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  const messageId = payload.data?.id || payload.id
  const phoneNumber = payload.data?.to?.[0] || payload.data?.phone_number || payload.to

  if (!messageId) {
    console.log('📱 [telnyx-webhook] No message ID in sent event')
    return NextResponse.json({ message: 'No message ID' }, { status: 200 })
  }

  console.log('📱 [telnyx-webhook] Message sent:', { messageId, phoneNumber })

  // Update recipient with SMS status
  const { error } = await supabase
    .from('bid_package_recipients')
    .update({
      sms_status: 'sent',
      sms_sent_at: new Date().toISOString(),
      telnyx_message_id: messageId
    })
    .eq('telnyx_message_id', messageId)
    .or(`subcontractor_phone.eq.${phoneNumber},subcontractor_phone.is.null`)

  if (error) {
    console.error('❌ Error updating SMS sent status:', error)
  } else {
    console.log('✅ Updated SMS sent status for message:', messageId)
  }

  return NextResponse.json({ success: true })
}

/**
 * Handle message delivery failure
 */
async function handleMessageFailed(payload: any) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  const messageId = payload.data?.id || payload.id
  const phoneNumber = payload.data?.to?.[0]?.phone_number || 
                      payload.data?.to?.[0] || 
                      payload.data?.phone_number || 
                      payload.to
  const errorCode = payload.data?.errors?.[0]?.code || payload.errors?.[0]?.code
  const errorDetail = payload.data?.errors?.[0]?.detail || 
                     payload.data?.errors?.[0]?.title ||
                     payload.errors?.[0]?.detail ||
                     payload.errors?.[0]?.title ||
                     payload.data?.to?.[0]?.status ||
                     'Unknown error'
  const carrier = payload.data?.to?.[0]?.carrier || payload.data?.carrier
  const lineType = payload.data?.to?.[0]?.line_type || payload.data?.line_type
  
  // Log 10DLC registration errors specifically
  if (errorCode === '40010') {
    console.error('❌ [telnyx-webhook] 10DLC Registration Required:', {
      messageId,
      phoneNumber,
      errorDetail,
      carrier,
      lineType,
      helpUrl: 'https://developers.telnyx.com/docs/overview/errors/40010'
    })
  }

  if (!messageId) {
    return NextResponse.json({ message: 'No message ID' }, { status: 200 })
  }

  console.error('❌ [telnyx-webhook] Message delivery failed:', {
    messageId,
    phoneNumber,
    errorCode,
    errorDetail,
    carrier,
    lineType,
    fullPayload: JSON.stringify(payload, null, 2)
  })

  // Store error details in a way that can be retrieved
  const { error } = await supabase
    .from('bid_package_recipients')
    .update({
      sms_status: 'failed',
      // Store error details in response_text or a note field if available
      response_text: errorDetail ? `Delivery failed: ${errorDetail}` : undefined
    })
    .eq('telnyx_message_id', messageId)

  if (error) {
    console.error('❌ Error updating SMS failed status:', error)
  } else {
    console.log('✅ Updated SMS failed status for message:', messageId)
  }

  return NextResponse.json({ success: true })
}

/**
 * Handle message delivered event
 */
async function handleMessageDelivered(payload: any) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  const messageId = payload.data?.id || payload.id
  const phoneNumber = payload.data?.to?.[0] || payload.data?.phone_number || payload.to

  if (!messageId) {
    return NextResponse.json({ message: 'No message ID' }, { status: 200 })
  }

  console.log('📱 [telnyx-webhook] Message delivered:', { messageId, phoneNumber })

  const { error } = await supabase
    .from('bid_package_recipients')
    .update({
      sms_status: 'delivered',
      sms_delivered_at: new Date().toISOString()
    })
    .eq('telnyx_message_id', messageId)

  if (error) {
    console.error('❌ Error updating SMS delivered status:', error)
  } else {
    console.log('✅ Updated SMS delivered status for message:', messageId)
  }

  return NextResponse.json({ success: true })
}

/**
 * Handle inbound SMS message
 */
async function handleInboundMessage(payload: any) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    )
  }

  const fromNumber = payload.data?.from?.phone_number || 
                     payload.data?.from || 
                     payload.from
  const messageText = payload.data?.text || 
                      payload.data?.body || 
                      payload.text || 
                      payload.body
  const messageId = payload.data?.id || payload.id

  if (!fromNumber || !messageText) {
    console.log('📱 [telnyx-webhook] Missing from or text in inbound message')
    return NextResponse.json({ message: 'Missing required fields' }, { status: 200 })
  }

  console.log('📱 [telnyx-webhook] Inbound SMS received:', {
    from: fromNumber,
    text: messageText.substring(0, 100),
    messageId
  })

  // Normalize phone number (remove +, spaces, dashes, etc.)
  const normalizedPhone = fromNumber.replace(/[^\d]/g, '')

  // Find recipient by phone number
  const { data: recipient, error: findError } = await supabase
    .from('bid_package_recipients')
    .select('*, bid_packages!inner(id, jobs!inner(id))')
    .or(`subcontractor_phone.ilike.%${normalizedPhone}%,subcontractor_phone.ilike.%${fromNumber}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError || !recipient) {
    console.log('📱 [telnyx-webhook] No recipient found for phone:', fromNumber)
    // Still return 200 so Telnyx doesn't retry
    return NextResponse.json({ message: 'No recipient found' }, { status: 200 })
  }

  // Update recipient with SMS response
  const { error: updateError } = await supabase
    .from('bid_package_recipients')
    .update({
      sms_status: 'received',
      sms_response_text: messageText,
      sms_received_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
      status: 'responded'
    })
    .eq('id', recipient.id)

  if (updateError) {
    console.error('❌ Error updating SMS response:', updateError)
    return NextResponse.json(
      { error: 'Failed to update recipient' },
      { status: 500 }
    )
  }

  console.log('✅ Processed inbound SMS for recipient:', recipient.id)

  // TODO: Optionally parse the SMS response and create a bid if it contains bid information
  // Similar to how email responses are processed

  return NextResponse.json({ success: true })
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'telnyx-webhook',
    timestamp: new Date().toISOString()
  })
}
