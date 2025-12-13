import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'
// Prevent any redirects or caching for webhook endpoint
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // Log request details for debugging
    const url = request.nextUrl.toString()
    const method = request.method
    const headers = Object.fromEntries(request.headers.entries())
    console.log('📧 Resend webhook received:', { method, url, pathname: request.nextUrl.pathname, host: request.headers.get('host') })
    console.log('📧 Webhook headers:', JSON.stringify(headers, null, 2))
    
    const body = await request.json()
    console.log('📧 Resend webhook payload:', JSON.stringify(body, null, 2))
    console.log('Event type:', body.type)

    const eventType = body.type

    // Handle outbound status events
    if (['email.sent', 'email.delivered', 'email.opened', 'email.bounced', 'email.failed'].includes(eventType)) {
      const result = await handleOutboundEvent(body)
      console.log('✅ Outbound event processed:', eventType)
      return result
    }

    // Handle inbound email events
    if (eventType === 'email.received') {
      try {
        const result = await handleInboundEmail(body)
        console.log('✅ Inbound email processed successfully')
        return result
      } catch (error: any) {
        console.error('❌ Error in handleInboundEmail:', error)
        console.error('❌ Error stack:', error?.stack)
        return NextResponse.json(
          { error: 'Failed to process inbound email', details: error?.message },
          { status: 200 } // Return 200 to prevent retries
        )
      }
    }

    console.log('⚠️ Unhandled event type:', eventType)
    return NextResponse.json({ message: 'Event type not handled' }, { status: 200 })
  } catch (error: any) {
    console.error('❌ Error processing Resend webhook:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    // Return 200 to prevent Resend from retrying invalid requests
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error?.message },
      { status: 200 }
    )
  }
}

async function handleOutboundEvent(body: any) {
  // Use service role to bypass RLS for webhook operations
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured')
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  const eventType = body.type
  // Resend can send email_id in different places - check all possibilities
  const emailId = body.data?.email_id || 
                  body.data?.id || 
                  body.email_id || 
                  body.id ||
                  body.payload?.email_id ||
                  body.payload?.id

  console.log('📧 [webhook] Processing outbound event:', eventType)
  console.log('📧 [webhook] Full body structure:', JSON.stringify(body, null, 2))
  console.log('📧 [webhook] Extracted emailId:', emailId, 'from paths:', {
    'body.data?.email_id': body.data?.email_id,
    'body.data?.id': body.data?.id,
    'body.email_id': body.email_id,
    'body.id': body.id
  })

  if (!emailId) {
    console.log('📧 [webhook] No email ID in event, body:', JSON.stringify(body, null, 2))
    return NextResponse.json({ message: 'No email ID in event' })
  }

  // Find recipient by resend_email_id
  let { data: recipient, error: recipientError } = await supabase
    .from('bid_package_recipients')
    .select('*')
    .eq('resend_email_id', emailId)
    .single()

  if (recipientError || !recipient) {
    console.log('📧 [webhook] Recipient not found for email ID:', emailId, 'Error:', recipientError)
    
    // Retry after a short delay - the recipient record might not be committed yet
    console.log('📧 [webhook] Retrying after 1 second delay...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const { data: retryRecipient, error: retryError } = await supabase
      .from('bid_package_recipients')
      .select('*')
      .eq('resend_email_id', emailId)
      .single()
    
    if (retryError || !retryRecipient) {
      // Try to find by any resend_email_id that might match for debugging
      const { data: allRecipients } = await supabase
        .from('bid_package_recipients')
        .select('id, resend_email_id, subcontractor_email, status')
        .not('resend_email_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)
      console.log('📧 [webhook] Sample recipients with resend_email_id:', allRecipients)
      console.log('📧 [webhook] Looking for email_id:', emailId)
      return NextResponse.json({ message: 'Recipient not found' }, { status: 200 }) // Return 200 to prevent retries
    }
    
    // Use the retry recipient
    recipient = retryRecipient
    recipientError = null
    console.log('📧 [webhook] Found recipient on retry:', recipient.id)
  }

  console.log('📧 [webhook] Found recipient:', recipient.id, 'Current status:', recipient.status, 'Email:', recipient.subcontractor_email)

  const updateData: any = {}
  const timestamp = new Date().toISOString()

  switch (eventType) {
    case 'email.sent':
      updateData.status = 'sent'
      updateData.sent_at = timestamp
      break
    case 'email.delivered':
      updateData.status = 'delivered'
      updateData.delivered_at = timestamp
      break
    case 'email.opened':
      updateData.status = 'opened'
      if (!recipient.opened_at) {
        updateData.opened_at = timestamp
        // Create notification for first open
        await createNotification(supabase, recipient.bid_package_id, recipient.id, 'email_opened')
      }
      break
    case 'email.bounced':
      updateData.status = 'bounced'
      updateData.bounced_at = timestamp
      // Create notification for bounce
      await createNotification(supabase, recipient.bid_package_id, recipient.id, 'email_bounced')
      break
    case 'email.failed':
      updateData.status = 'failed'
      break
  }

  console.log('📧 [webhook] Updating recipient with data:', updateData)
  const { error: updateError } = await supabase
    .from('bid_package_recipients')
    .update(updateData)
    .eq('id', recipient.id)

  if (updateError) {
    console.error('📧 [webhook] ❌ Error updating recipient:', updateError)
    return NextResponse.json(
      { error: 'Failed to update recipient', details: updateError.message },
      { status: 200 } // Return 200 to prevent retries
    )
  }

  console.log('📧 [webhook] ✅ Recipient updated successfully for event:', eventType, 'New status:', updateData.status, 'Recipient ID:', recipient.id)
  
  // Verify the update
  const { data: updatedRecipient } = await supabase
    .from('bid_package_recipients')
    .select('id, status, opened_at, delivered_at, responded_at')
    .eq('id', recipient.id)
    .single()
  console.log('📧 [webhook] Verified update - recipient now has status:', updatedRecipient?.status)
  
  return NextResponse.json({ message: 'Event processed successfully' }, { status: 200 })
}

// Helper function to detect if an email is a reply
function detectReply(headers: any, subject: string, email: any): {
  isReply: boolean
  inReplyTo?: string
  references?: string
  messageId?: string
} {
  const inReplyTo = headers?.['in-reply-to'] || headers?.['In-Reply-To'] || headers?.['In-Reply-To'] || email?.['in-reply-to']
  const references = headers?.['references'] || headers?.['References'] || headers?.['References'] || email?.['references']
  const messageId = headers?.['message-id'] || headers?.['Message-ID'] || headers?.['Message-Id'] || email?.['message-id']
  
  // Check if subject starts with Re: or RE:
  const isReplySubject = subject && (subject.trim().toLowerCase().startsWith('re:') || subject.trim().toLowerCase().startsWith('re :'))
  
  const isReply = !!(inReplyTo || references || isReplySubject)
  
  return {
    isReply,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
    messageId: messageId || undefined
  }
}

// Helper function to find parent recipient record
async function findParentRecipient(
  supabase: any,
  replyInfo: { inReplyTo?: string; references?: string; messageId?: string },
  bidPackageId: string,
  fromEmail: string
): Promise<any | null> {
  // Try to find by resend_email_id from In-Reply-To header
  // Resend email IDs are typically in the format: <email-id@resend.dev>
  if (replyInfo.inReplyTo) {
    // Extract email ID from In-Reply-To header (format: <id@resend.dev> or just id)
    const emailIdMatch = replyInfo.inReplyTo.match(/<([^>]+)>/) || [null, replyInfo.inReplyTo]
    const emailId = emailIdMatch[1] || replyInfo.inReplyTo
    
    const { data: recipient } = await supabase
      .from('bid_package_recipients')
      .select('*')
      .eq('bid_package_id', bidPackageId)
      .eq('resend_email_id', emailId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (recipient) {
      console.log('✅ Found parent by resend_email_id:', recipient.id)
      return recipient
    }
  }
  
  // Try to find by Message-ID in References header
  if (replyInfo.references) {
    // References can contain multiple message IDs, try the last one (most recent)
    const messageIds = replyInfo.references.split(/\s+/).filter(Boolean)
    if (messageIds.length > 0) {
      const lastMessageId = messageIds[messageIds.length - 1]
      const emailIdMatch = lastMessageId.match(/<([^>]+)>/) || [null, lastMessageId]
      const emailId = emailIdMatch[1] || lastMessageId
      
      const { data: recipient } = await supabase
        .from('bid_package_recipients')
        .select('*')
        .eq('bid_package_id', bidPackageId)
        .eq('resend_email_id', emailId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (recipient) {
        console.log('✅ Found parent by References header:', recipient.id)
        return recipient
      }
    }
  }
  
  // Fallback: find most recent recipient from same email address in this bid package
  // This handles cases where headers don't match exactly
  const { data: recentRecipient } = await supabase
    .from('bid_package_recipients')
    .select('*')
    .eq('bid_package_id', bidPackageId)
    .eq('subcontractor_email', fromEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  if (recentRecipient) {
    console.log('✅ Found parent by most recent email from same address:', recentRecipient.id)
    return recentRecipient
  }
  
  return null
}

// Helper function to check if attachments are bid-related
function checkBidAttachments(attachments: any[]): {
  hasBidAttachments: boolean
  bidAttachmentTypes: string[]
} {
  if (!attachments || attachments.length === 0) {
    return { hasBidAttachments: false, bidAttachmentTypes: [] }
  }
  
  const bidFileExtensions = ['.pdf', '.xlsx', '.xls', '.csv', '.doc', '.docx']
  const bidMimeTypes = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
  
  const bidAttachmentTypes: string[] = []
  
  for (const attachment of attachments) {
    const fileName = attachment.filename || attachment.name || ''
    const contentType = attachment.content_type || attachment.type || ''
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    
    if (bidFileExtensions.includes(fileExtension) || 
        bidMimeTypes.some(mime => contentType.toLowerCase().includes(mime.toLowerCase()))) {
      bidAttachmentTypes.push(fileExtension || contentType)
    }
  }
  
  return {
    hasBidAttachments: bidAttachmentTypes.length > 0,
    bidAttachmentTypes
  }
}

async function handleInboundEmail(body: any) {
  console.log('📥 Processing inbound email...')
  console.log('📥 Full webhook body structure:', JSON.stringify(body, null, 2))
  
  // Use service role to bypass RLS for webhook operations
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured')
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  
  // Resend webhook structure: body.data contains the email data
  // But sometimes it might be nested differently, so check multiple locations
  const email = body.data || body.payload || body
  
  if (!email) {
    console.error('❌ No email data in webhook body')
    console.error('❌ Body structure:', JSON.stringify(body, null, 2))
    return NextResponse.json({ error: 'No email data' }, { status: 200 }) // Return 200 to prevent retries
  }
  
  // Extract email fields - handle different possible structures
  const from = email.from || (typeof email.from === 'string' ? { email: email.from } : null)
  const to = email.to || email.recipients || []
  const subject = email.subject || ''
  const html = email.html || email.body_html || ''
  const text = email.text || email.body_text || email.body || ''
  const headers = email.headers || {}
  const attachments = email.attachments || []
  
  console.log('📧 Extracted email fields:', {
    from: from?.email || from,
    to: Array.isArray(to) ? to : [to],
    subject,
    hasHtml: !!html,
    hasText: !!text,
    htmlLength: html.length,
    textLength: text.length,
    attachmentsCount: attachments.length,
    headersKeys: Object.keys(headers)
  })
  
  if (!from || (!from.email && typeof from !== 'string')) {
    console.error('❌ Invalid or missing from field:', from)
    return NextResponse.json({ error: 'Invalid email from field' }, { status: 200 })
  }
  
  const fromEmail = typeof from === 'string' ? from : from.email
  if (!fromEmail) {
    console.error('❌ No email address in from field')
    return NextResponse.json({ error: 'No email address in from field' }, { status: 200 })
  }
  console.log('📧 Email details:', { 
    from: from?.email || from, 
    subject, 
    hasHtml: !!html, 
    hasText: !!text,
    headers: headers ? Object.keys(headers) : 'no headers',
    to: Array.isArray(to) ? to : [to],
    emailKeys: Object.keys(email)
  })

  // Extract bid_package_id from reply-to address (bids+{bidPackageId}@bids.bidicontracting.com)
  let bidPackageId: string | null = null
  
  // Try multiple ways to get the reply-to address
  const replyTo = headers?.['reply-to'] || headers?.['Reply-To'] || headers?.['Reply-To'] || to?.[0] || email['reply-to']
  console.log('🔍 Reply-To header:', replyTo)
  console.log('🔍 All headers:', JSON.stringify(headers, null, 2))
  console.log('🔍 To field:', JSON.stringify(to, null, 2))
  
  if (replyTo) {
    const replyToMatch = replyTo.match(/bids\+([a-f0-9-]+)@bids\.bidicontracting\.com/)
    if (replyToMatch) {
      bidPackageId = replyToMatch[1]
      console.log('✅ Extracted bid package ID:', bidPackageId)
    } else {
      console.log('⚠️ Reply-To format mismatch:', replyTo)
    }
  }
  
  // Also check the 'to' field - sometimes replies go to the original 'to' address
  if (!bidPackageId && to && Array.isArray(to)) {
    for (const toAddr of to) {
      const toMatch = toAddr.match(/bids\+([a-f0-9-]+)@bids\.bidicontracting\.com/)
      if (toMatch) {
        bidPackageId = toMatch[1]
        console.log('✅ Extracted bid package ID from "to" field:', bidPackageId)
        break
      }
    }
  }

  if (!bidPackageId) {
    console.error('❌ Could not determine bid package ID from email:', { 
      subject, 
      headers: JSON.stringify(headers, null, 2), 
      replyTo,
      to: JSON.stringify(to, null, 2),
      emailKeys: Object.keys(email || {})
    })
    // Don't return error - log it but continue to see what data we have
    console.error('⚠️ Continuing without bid package ID to debug...')
    // Return success to prevent Resend from retrying, but log the issue
    return NextResponse.json({ 
      message: 'Could not determine bid package ID',
      debug: { replyTo, to, headers: Object.keys(headers || {}), emailKeys: Object.keys(email || {}) }
    }, { status: 200 })
  }

  // Get bid package and job details
  const { data: bidPackage, error: packageError } = await supabase
    .from('bid_packages')
    .select(`
      *,
      jobs (
        id,
        name,
        location,
        user_id
      )
    `)
    .eq('id', bidPackageId)
    .single()

  if (packageError || !bidPackage) {
    console.error('Could not find matching bid package:', packageError)
    return NextResponse.json({ message: 'Bid package not found' })
  }

  const jobId = bidPackage.job_id

  // Parse the email content with AI
  const emailContent = html || text || ''
  
  // Detect if this is a reply to a previous email
  const replyInfo = detectReply(headers, subject, email)
  console.log('🔍 Reply detection:', replyInfo)

  // Find parent recipient if this is a reply
  let parentRecipient: any = null
  let threadId: string | null = null
  
  if (replyInfo.isReply) {
    parentRecipient = await findParentRecipient(supabase, replyInfo, bidPackageId, fromEmail)
    if (parentRecipient) {
      threadId = parentRecipient.thread_id || `thread-${bidPackageId}-${fromEmail}`
      console.log('✅ Found parent recipient:', parentRecipient.id, 'Thread ID:', threadId)
    } else {
      console.log('⚠️ Reply detected but parent recipient not found, creating new thread')
      threadId = `thread-${bidPackageId}-${fromEmail}`
    }
  }

  // Check if this is a bid submission (has bid attachments or AI detects bid)
  const bidAttachments = checkBidAttachments(attachments)
  const aiSummary = await parseBidWithAI(emailContent, fromEmail, bidPackage.trade_category)
  const bidData = await extractBidData(emailContent, fromEmail)
  
  // Determine if this is a bid submission
  const isBidSubmission = bidAttachments.hasBidAttachments || bidData.bidAmount !== null || 
                         emailContent.toLowerCase().includes('bid') || 
                         emailContent.toLowerCase().includes('quote')
  
  // Extract categorized notes using AI (only if bid submission)
  const categorizedNotes = isBidSubmission ? await extractCategorizedNotes(emailContent, bidPackage.trade_category) : []
  
  // Detect clarifying questions
  const clarifyingQuestions = await detectClarifyingQuestions(emailContent)

  // Helper function to determine subcontractor name from multiple sources
  async function determineSubcontractorName(): Promise<string> {
    // 1. Check original recipient record (best source - name used when email was sent)
    const { data: originalRecipient } = await supabase
      .from('bid_package_recipients')
      .select('subcontractor_name')
      .eq('bid_package_id', bidPackageId)
      .eq('subcontractor_email', fromEmail)
      .is('parent_email_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (originalRecipient?.subcontractor_name && originalRecipient.subcontractor_name !== 'Unknown') {
      console.log('📧 Using name from original recipient:', originalRecipient.subcontractor_name)
      return originalRecipient.subcontractor_name
    }
    
    // 2. Check existing subcontractor record
    const { data: existingSub } = await supabase
      .from('subcontractors')
      .select('name')
      .eq('email', fromEmail)
      .maybeSingle()
    
    if (existingSub?.name && existingSub.name !== 'Unknown') {
      console.log('📧 Using name from subcontractor record:', existingSub.name)
      return existingSub.name
    }
    
    // 3. Check GC contacts (need job owner's user_id)
    if (bidPackage.jobs?.user_id) {
      const { data: gcContact } = await supabase
        .from('gc_contacts')
        .select('name')
        .eq('gc_id', bidPackage.jobs.user_id)
        .eq('email', fromEmail)
        .maybeSingle()
      
      if (gcContact?.name) {
        console.log('📧 Using name from GC contact:', gcContact.name)
        return gcContact.name
      }
    }
    
    // 4. Try email headers (from.name)
    if (typeof from === 'object' && (from as any).name) {
      console.log('📧 Using name from email header:', (from as any).name)
      return (from as any).name
    }
    
    // 5. Try AI extraction
    if (bidData.companyName) {
      console.log('📧 Using name from AI extraction:', bidData.companyName)
      return bidData.companyName
    }
    
    // 6. Fallback to 'Unknown'
    console.log('📧 No name found, using Unknown')
    return 'Unknown'
  }

  // Find or create subcontractor record
  let subcontractorId: string | null = null
  const subcontractorName = await determineSubcontractorName()
  
  // First, try to find existing subcontractor by email
  const { data: existingSub } = await supabase
    .from('subcontractors')
    .select('id, name')
    .eq('email', fromEmail)
    .single()
  
  if (existingSub) {
    subcontractorId = existingSub.id
    
    // Update subcontractor with any new data from the bid
    await supabase
      .from('subcontractors')
      .update({
        name: subcontractorName !== 'Unknown' ? subcontractorName : existingSub.name,
        phone: bidData.phone || null,
        website_url: bidData.website || null,
      })
      .eq('id', subcontractorId)
  } else {
    // Create new subcontractor record
    let website = bidData.website || null
    const { data: contractorData } = await supabase
      .from('crawler_discovered_contractors')
      .select('website')
      .eq('email', fromEmail)
      .single()
    
    if (contractorData?.website) {
      website = contractorData.website
    }
    
    const { data: newSub, error: subError } = await supabase
      .from('subcontractors')
      .insert({
        email: fromEmail,
        name: subcontractorName,
        trade_category: bidPackage.trade_category,
        location: bidPackage.jobs.location,
        phone: bidData.phone || null,
        website_url: website,
      })
      .select('id')
      .single()
    
    if (subError) {
      console.error('Error creating subcontractor:', subError)
      return NextResponse.json({ error: 'Failed to create subcontractor' }, { status: 500 })
    }
    
    subcontractorId = newSub.id
  }

  // Process attachments if any (only for bid submissions)
  const attachmentIds: string[] = []
  if (attachments && Array.isArray(attachments) && attachments.length > 0 && isBidSubmission) {
    for (const attachment of attachments) {
      try {
        let attachmentBuffer: Buffer | null = null
        
        // Resend attachments can be base64 encoded or have a URL
        if (attachment.content && attachment.encoding === 'base64') {
          // Base64 encoded content
          attachmentBuffer = Buffer.from(attachment.content, 'base64')
        } else if (attachment.url) {
          // URL to download
          const attachmentResponse = await fetch(attachment.url)
          attachmentBuffer = Buffer.from(await attachmentResponse.arrayBuffer())
        } else if (attachment.content) {
          // Plain content
          attachmentBuffer = Buffer.from(attachment.content)
        }
        
        if (attachmentBuffer) {
          // Upload to Supabase storage
          const fileName = `${Date.now()}-${attachment.filename || attachment.name || 'attachment'}`
          const filePath = `${bidPackageId}/${fileName}`
          
          const { error: uploadError } = await supabase.storage
            .from('bid-attachments')
            .upload(filePath, attachmentBuffer, {
              contentType: attachment.content_type || attachment.type || 'application/octet-stream'
            })
          
          if (!uploadError) {
            // Create attachment record (will link to bid after bid is created)
            const { data: attachmentRecord } = await supabase
              .from('bid_attachments')
              .insert({
                file_name: attachment.filename || attachment.name || fileName,
                file_path: filePath,
                file_size: attachment.size || attachment.length || attachmentBuffer.length,
                file_type: attachment.content_type || attachment.type || 'application/octet-stream'
              })
              .select()
              .single()
            
            if (attachmentRecord) {
              attachmentIds.push(attachmentRecord.id)
            }
          }
        }
      } catch (error) {
        console.error('Error processing attachment:', error)
      }
    }
  }

  // Store the bid in the database (only if bid submission)
  let bidId: string | null = null
  if (isBidSubmission) {
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .insert({
        job_id: jobId,
        bid_package_id: bidPackageId,
        subcontractor_id: subcontractorId,
        bid_amount: bidData.bidAmount || null,
        timeline: bidData.timeline || null,
        notes: bidData.notes || null,
        ai_summary: aiSummary,
        raw_email: emailContent,
      })
      .select()
      .single()

    if (bidError) {
      console.error('Error storing bid:', bidError)
    } else {
      bidId = bid.id
      console.log('Bid stored successfully:', bid.id)
      
      // Link attachments to bid
      if (attachmentIds.length > 0) {
        await supabase
          .from('bid_attachments')
          .update({ bid_id: bid.id })
          .in('id', attachmentIds)
      }
      
      // Create notification for bid received
      await createNotification(supabase, bidPackageId, null, 'bid_received', bid.id)
    }
  }

  // Store categorized notes if any were extracted and we have a bid
  if (bidId && categorizedNotes && categorizedNotes.length > 0) {
    try {
      const notesToInsert = categorizedNotes.map((note: { type: string; category?: string | null; location?: string | null; content: string; confidence: number }) => ({
        bid_id: bidId,
        note_type: note.type,
        category: note.category,
        location: note.location,
        content: note.content,
        confidence_score: note.confidence
      }))

      const { error: notesError } = await supabase
        .from('bid_notes')
        .insert(notesToInsert)

      if (notesError) {
        console.error('Error storing categorized notes:', notesError)
      } else {
        console.log(`Stored ${categorizedNotes.length} categorized notes for bid ${bidId}`)
      }
    } catch (error) {
      console.error('Error processing categorized notes:', error)
    }
  }

  // Prepare email content - use text if available, otherwise html, fallback to empty string
  const emailContentText = text || (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '') || ''
  
  // Handle bid submission vs question/reply differently
  if (isBidSubmission) {
    // For bid submissions, find and update the original recipient record
    let recipient = null
    
    // Normalize email for comparison (lowercase, trim)
    const normalizedFromEmail = fromEmail.toLowerCase().trim()
    
    console.log('🔍 Looking for recipient for bid submission:', {
      bidPackageId,
      fromEmail,
      normalizedFromEmail,
      subcontractorId
    })
    
    // First, try exact match (case-sensitive)
    const { data: recipientsByEmail, error: recipientError } = await supabase
      .from('bid_package_recipients')
      .select('*')
      .eq('bid_package_id', bidPackageId)
      .eq('subcontractor_email', fromEmail)
      .is('parent_email_id', null) // Only get original emails, not replies
      .order('created_at', { ascending: false })
      .limit(1)

    if (recipientsByEmail && recipientsByEmail.length > 0) {
      recipient = recipientsByEmail[0]
      console.log('✅ Found recipient by exact email match:', recipient.id)
    } else {
      // Try case-insensitive match using ilike
      const { data: recipientsByEmailCaseInsensitive } = await supabase
        .from('bid_package_recipients')
        .select('*')
        .eq('bid_package_id', bidPackageId)
        .ilike('subcontractor_email', normalizedFromEmail)
        .is('parent_email_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (recipientsByEmailCaseInsensitive && recipientsByEmailCaseInsensitive.length > 0) {
        recipient = recipientsByEmailCaseInsensitive[0]
        console.log('✅ Found recipient by case-insensitive email match:', recipient.id)
      } else {
        // Try finding by subcontractor_id if email doesn't match
        if (subcontractorId) {
          const { data: recipientsBySub } = await supabase
            .from('bid_package_recipients')
            .select('*')
            .eq('bid_package_id', bidPackageId)
            .eq('subcontractor_id', subcontractorId)
            .is('parent_email_id', null)
            .order('created_at', { ascending: false })
            .limit(1)
          
          if (recipientsBySub && recipientsBySub.length > 0) {
            recipient = recipientsBySub[0]
            console.log('✅ Found recipient by subcontractor_id:', recipient.id)
          }
        }
      }
    }

    if (recipient) {
      // Update existing recipient with bid information
      const recipientUpdateData: any = {
        status: 'responded',
        responded_at: new Date().toISOString(),
        response_text: emailContentText.substring(0, 5000),
        has_clarifying_questions: clarifyingQuestions.hasQuestions,
        clarifying_questions: clarifyingQuestions.questions.length > 0 ? clarifyingQuestions.questions : null,
        bid_id: bidId,
        updated_at: new Date().toISOString()
      }

      console.log('📝 Updating recipient record with bid:', recipient.id)
      const { data: updatedRecipient, error: updateError } = await supabase
        .from('bid_package_recipients')
        .update(recipientUpdateData)
        .eq('id', recipient.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('❌ Error updating recipient:', updateError)
        return NextResponse.json(
          { error: 'Failed to update recipient', details: updateError.message },
          { status: 200 }
        )
      } else {
        console.log('✅ Recipient updated successfully with bid')
      }
      
      // Create notification for clarifying questions if detected
      if (clarifyingQuestions.hasQuestions) {
        await createNotification(supabase, bidPackageId, recipient.id, 'clarifying_question')
      }
    } else {
      console.log('⚠️ No original recipient found for bid submission, creating new record')
      // Create new recipient record for bid submission
      const { data: newRecipient, error: insertError } = await supabase
        .from('bid_package_recipients')
        .insert({
          bid_package_id: bidPackageId,
          subcontractor_id: subcontractorId,
          subcontractor_email: fromEmail,
          subcontractor_name: subcontractorName,
          status: 'responded',
          responded_at: new Date().toISOString(),
          response_text: emailContentText.substring(0, 5000),
          has_clarifying_questions: clarifyingQuestions.hasQuestions,
          clarifying_questions: clarifyingQuestions.questions.length > 0 ? clarifyingQuestions.questions : null,
          bid_id: bidId,
          thread_id: threadId || `thread-${bidPackageId}-${fromEmail}`,
          parent_email_id: null
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('❌ Error creating recipient for bid:', insertError)
        return NextResponse.json(
          { error: 'Failed to create recipient', details: insertError.message },
          { status: 200 }
        )
      } else {
        console.log('✅ Created new recipient record for bid:', newRecipient?.id)
      }
    }
  } else {
    // For questions/replies (not bid submissions), create a new thread message
    console.log('📧 Creating thread message for question/reply')
    
    // Determine thread_id and parent_email_id
    const finalThreadId = threadId || (parentRecipient?.thread_id || `thread-${bidPackageId}-${fromEmail}`)
    const finalParentId = parentRecipient?.id || null
    
    // If no parent found but this is a reply, try to find the original email
    if (!finalParentId && replyInfo.isReply) {
      const { data: originalRecipient } = await supabase
        .from('bid_package_recipients')
        .select('*')
        .eq('bid_package_id', bidPackageId)
        .eq('subcontractor_email', fromEmail)
        .is('parent_email_id', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      
      if (originalRecipient) {
        console.log('✅ Found original recipient for thread:', originalRecipient.id)
        // Use original recipient's thread_id and set it as parent
        const { data: newThreadMessage, error: threadError } = await supabase
          .from('bid_package_recipients')
          .insert({
            bid_package_id: bidPackageId,
            subcontractor_id: subcontractorId,
            subcontractor_email: fromEmail,
            subcontractor_name: subcontractorName,
            status: 'responded',
            responded_at: new Date().toISOString(),
            response_text: emailContentText.substring(0, 5000),
            has_clarifying_questions: clarifyingQuestions.hasQuestions,
            clarifying_questions: clarifyingQuestions.questions.length > 0 ? clarifyingQuestions.questions : null,
            bid_id: null,
            thread_id: originalRecipient.thread_id || finalThreadId,
            parent_email_id: originalRecipient.id
          })
          .select()
          .single()
        
        if (threadError) {
          console.error('❌ Error creating thread message:', threadError)
          return NextResponse.json(
            { error: 'Failed to create thread message', details: threadError.message },
            { status: 200 }
          )
        } else {
          console.log('✅ Created thread message:', newThreadMessage?.id)
          
          // Create notification for clarifying questions
          if (clarifyingQuestions.hasQuestions) {
            await createNotification(supabase, bidPackageId, newThreadMessage.id, 'clarifying_question')
          }
        }
      } else {
        // No original recipient found, create new thread
        const { data: newThreadMessage, error: threadError } = await supabase
          .from('bid_package_recipients')
          .insert({
            bid_package_id: bidPackageId,
            subcontractor_id: subcontractorId,
            subcontractor_email: fromEmail,
            subcontractor_name: subcontractorName,
            status: 'responded',
            responded_at: new Date().toISOString(),
            response_text: emailContentText.substring(0, 5000),
            has_clarifying_questions: clarifyingQuestions.hasQuestions,
            clarifying_questions: clarifyingQuestions.questions.length > 0 ? clarifyingQuestions.questions : null,
            bid_id: null,
            thread_id: finalThreadId,
            parent_email_id: null
          })
          .select()
          .single()
        
        if (threadError) {
          console.error('❌ Error creating new thread:', threadError)
          return NextResponse.json(
            { error: 'Failed to create thread', details: threadError.message },
            { status: 200 }
          )
        } else {
          console.log('✅ Created new thread:', newThreadMessage?.id)
        }
      }
    } else {
      // Create thread message with parent
      const { data: newThreadMessage, error: threadError } = await supabase
        .from('bid_package_recipients')
        .insert({
          bid_package_id: bidPackageId,
          subcontractor_id: subcontractorId,
          subcontractor_email: fromEmail,
          subcontractor_name: subcontractorName,
          status: 'responded',
          responded_at: new Date().toISOString(),
          response_text: emailContentText.substring(0, 5000),
          has_clarifying_questions: clarifyingQuestions.hasQuestions,
          clarifying_questions: clarifyingQuestions.questions.length > 0 ? clarifyingQuestions.questions : null,
          bid_id: null,
          thread_id: finalThreadId,
          parent_email_id: finalParentId
        })
        .select()
        .single()
      
      if (threadError) {
        console.error('❌ Error creating thread message:', threadError)
        return NextResponse.json(
          { error: 'Failed to create thread message', details: threadError.message },
          { status: 200 }
        )
      } else {
        console.log('✅ Created thread message:', newThreadMessage?.id)
        
        // Create notification for clarifying questions
        if (clarifyingQuestions.hasQuestions) {
          await createNotification(supabase, bidPackageId, newThreadMessage.id, 'clarifying_question')
        }
      }
    }
  }

  // Update bid package status to 'receiving' if first bid
  if (bidId) {
    await supabase
      .from('bid_packages')
      .update({ status: 'receiving' })
      .eq('id', bidPackageId)
      .eq('status', 'sent')
  }

  return NextResponse.json({ 
    message: 'Email processed successfully',
    bidId: bidId,
    hasClarifyingQuestions: clarifyingQuestions.hasQuestions
  })
}

async function detectClarifyingQuestions(emailContent: string): Promise<{ hasQuestions: boolean; questions: string[] }> {
  try {
    const prompt = `
    Analyze this email from a subcontractor and detect if they are asking clarifying questions.
    Return ONLY a JSON object with this structure:
    {
      "hasQuestions": true or false,
      "questions": ["question 1", "question 2", ...] or []
    }

    Look for patterns like:
    - "Can you clarify..."
    - "What about..."
    - "I need more info on..."
    - "Could you explain..."
    - "Do you have..."
    - Question marks (?) indicating questions
    - Requests for additional information

    Email content:
    ${emailContent.substring(0, 2000)}

    If no questions are found, return hasQuestions: false and questions: []
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return { hasQuestions: false, questions: [] }
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return { hasQuestions: false, questions: [] }
  } catch (error) {
    console.error('Error detecting clarifying questions:', error)
    return { hasQuestions: false, questions: [] }
  }
}

async function createNotification(
  supabase: any,
  bidPackageId: string,
  recipientId: string | null,
  notificationType: 'bid_received' | 'email_opened' | 'clarifying_question' | 'email_bounced',
  bidId?: string | null
) {
  try {
    // Get job owner from bid package
    const { data: bidPackage } = await supabase
      .from('bid_packages')
      .select('jobs!inner(user_id)')
      .eq('id', bidPackageId)
      .single()

    if (!bidPackage || !bidPackage.jobs) {
      return
    }

    const userId = bidPackage.jobs.user_id

    // Check if notifications table exists
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        notification_type: notificationType,
        bid_package_id: bidPackageId,
        recipient_id: recipientId,
        bid_id: bidId,
        read: false,
        dismissed: false
      })

    if (insertError) {
      console.error('Error creating notification:', insertError)
    }
  } catch (error) {
    console.error('Error in createNotification:', error)
  }
}

async function parseBidWithAI(emailContent: string, senderEmail: string, tradeCategory: string): Promise<string> {
  try {
    const prompt = `
    Analyze this email from a subcontractor responding to a ${tradeCategory} job opportunity.
    Provide a concise summary of their bid response.

    Email content:
    ${emailContent}

    Please provide a 2-3 sentence summary focusing on:
    - Their interest level
    - Key details they mentioned
    - Any specific requirements or questions
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.3,
    })

    return response.choices[0]?.message?.content || 'Unable to parse bid content'
  } catch (error) {
    console.error('Error parsing bid with AI:', error)
    return 'Error parsing bid content'
  }
}

async function extractBidData(emailContent: string, senderEmail: string) {
  try {
    const prompt = `
    Extract structured bid information from this subcontractor email response.
    Return ONLY a JSON object with these fields (use null if not found):
    {
      "companyName": "string or null",
      "phone": "string or null", 
      "website": "string or null",
      "bidAmount": "number or null",
      "timeline": "string or null",
      "notes": "string or null"
    }

    Email content:
    ${emailContent}

    Instructions:
    - Extract company name from signature or email content
    - Look for phone numbers in any format
    - Look for website URLs (www.domain.com, domain.com, etc.)
    - Extract bid amount (look for dollar amounts, estimates, quotes)
    - Find timeline information (start date, duration, completion date)
    - Capture any additional notes or special requirements
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Try to parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    throw new Error('No valid JSON found in AI response')
  } catch (error) {
    console.error('Error extracting bid data:', error)
    return {
      companyName: null,
      phone: null,
      website: null,
      bidAmount: null,
      timeline: null,
      notes: null,
    }
  }
}

async function extractCategorizedNotes(emailContent: string, tradeCategory: string) {
  try {
    const prompt = `
    Analyze this subcontractor email and extract any specific notes, requirements, concerns, or suggestions mentioned.
    Focus on construction-related details that would be useful for project planning.
    
    Return ONLY a JSON array of note objects. Each note should have:
    {
      "type": "requirement|concern|suggestion|timeline|material|other",
      "category": "shower|electrical|plumbing|flooring|kitchen|bathroom|structural|safety|permit|other",
      "location": "master_bathroom|kitchen|basement|upstairs|downstairs|exterior|other",
      "content": "exact text of the note",
      "confidence": 0.95
    }

    Trade Category: ${tradeCategory}
    Email content:
    ${emailContent}

    Instructions:
    - Extract specific requirements (e.g., "shower needs complete renovation", "electrical panel upgrade required")
    - Identify concerns or warnings (e.g., "timeline might be tight", "permit issues expected")
    - Capture suggestions or recommendations (e.g., "recommend using tile instead of vinyl")
    - Note timeline-related information (e.g., "can start next week", "will take 3 weeks")
    - Extract material preferences or requirements (e.g., "must use copper pipes", "prefer ceramic tile")
    - Be specific about locations when mentioned (e.g., "master bathroom", "kitchen", "basement")
    - Only include notes that are construction/project relevant
    - Set confidence score based on how clear and specific the note is (0.0 to 1.0)
    - If no relevant notes found, return empty array []
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.1,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Try to parse the JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const notes = JSON.parse(jsonMatch[0])
      // Validate the structure
      return notes.filter((note: { type: string; content: string; confidence: number }) => 
        note.type && 
        note.content && 
        typeof note.confidence === 'number' &&
        note.confidence >= 0 &&
        note.confidence <= 1
      )
    }

    return []
  } catch (error) {
    console.error('Error extracting categorized notes:', error)
    return []
  }
}
