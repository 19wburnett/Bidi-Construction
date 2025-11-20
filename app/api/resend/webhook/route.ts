import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📧 Resend webhook received:', JSON.stringify(body, null, 2))
    console.log('Event type:', body.type)

    const eventType = body.type

    // Handle outbound status events
    if (['email.sent', 'email.delivered', 'email.opened', 'email.bounced', 'email.failed'].includes(eventType)) {
      return await handleOutboundEvent(body)
    }

    // Handle inbound email events
    if (eventType === 'email.received') {
      return await handleInboundEmail(body)
    }

    return NextResponse.json({ message: 'Event type not handled' })
  } catch (error) {
    console.error('Error processing Resend webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

async function handleOutboundEvent(body: any) {
  const supabase = await createServerSupabaseClient()
  const eventType = body.type
  const emailId = body.data?.email_id || body.data?.id

  if (!emailId) {
    return NextResponse.json({ message: 'No email ID in event' })
  }

  // Find recipient by resend_email_id
  const { data: recipient, error: recipientError } = await supabase
    .from('bid_package_recipients')
    .select('*')
    .eq('resend_email_id', emailId)
    .single()

  if (recipientError || !recipient) {
    console.log('Recipient not found for email ID:', emailId)
    return NextResponse.json({ message: 'Recipient not found' })
  }

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

  await supabase
    .from('bid_package_recipients')
    .update(updateData)
    .eq('id', recipient.id)

  return NextResponse.json({ message: 'Event processed successfully' })
}

async function handleInboundEmail(body: any) {
  console.log('📥 Processing inbound email...')
  const supabase = await createServerSupabaseClient()
  const email = body.data
  
  if (!email) {
    console.error('❌ No email data in webhook body')
    return NextResponse.json({ error: 'No email data' }, { status: 400 })
  }
  
  const { from, to, subject, html, text, headers, attachments } = email
  console.log('📧 Email details:', { 
    from: from?.email, 
    subject, 
    hasHtml: !!html, 
    hasText: !!text,
    headers: Object.keys(headers || {})
  })

  // Extract bid_package_id from reply-to address (bids+{bidPackageId}@bidicontracting.com)
  let bidPackageId: string | null = null
  
  // Try multiple ways to get the reply-to address
  const replyTo = headers?.['reply-to'] || headers?.['Reply-To'] || headers?.['Reply-To'] || to?.[0] || email['reply-to']
  console.log('🔍 Reply-To header:', replyTo)
  
  if (replyTo) {
    const replyToMatch = replyTo.match(/bids\+([a-f0-9-]+)@bidicontracting\.com/)
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
      const toMatch = toAddr.match(/bids\+([a-f0-9-]+)@bidicontracting\.com/)
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
      to: JSON.stringify(to, null, 2)
    })
    return NextResponse.json({ 
      message: 'Could not determine bid package ID',
      debug: { replyTo, to, headers: Object.keys(headers || {}) }
    })
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
  const aiSummary = await parseBidWithAI(emailContent, from.email, bidPackage.trade_category)

  // Extract bid information using AI
  const bidData = await extractBidData(emailContent, from.email)
  
  // Extract categorized notes using AI
  const categorizedNotes = await extractCategorizedNotes(emailContent, bidPackage.trade_category)

  // Detect clarifying questions
  const clarifyingQuestions = await detectClarifyingQuestions(emailContent)

  // Find or create subcontractor record
  let subcontractorId: string | null = null
  
  // First, try to find existing subcontractor by email
  const { data: existingSub } = await supabase
    .from('subcontractors')
    .select('id, name')
    .eq('email', from.email)
    .single()
  
  if (existingSub) {
    subcontractorId = existingSub.id
    
    // Update subcontractor with any new data from the bid
    await supabase
      .from('subcontractors')
      .update({
        name: bidData.companyName || existingSub.name || (from as any).name || 'Unknown',
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
      .eq('email', from.email)
      .single()
    
    if (contractorData?.website) {
      website = contractorData.website
    }
    
    const { data: newSub, error: subError } = await supabase
      .from('subcontractors')
      .insert({
        email: from.email,
        name: bidData.companyName || (from as any).name || 'Unknown',
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

  // Process attachments if any
  const attachmentIds: string[] = []
  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
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

  // Determine if this is a bid submission or just a question
  const isBidSubmission = bidData.bidAmount !== null || emailContent.toLowerCase().includes('bid') || emailContent.toLowerCase().includes('quote')

  // Store the bid in the database (even if just questions, we still create a record)
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

  // Find or update recipient record
  // Try to find by email first (most reliable)
  let recipient = null
  const { data: recipientsByEmail, error: recipientError } = await supabase
    .from('bid_package_recipients')
    .select('*')
    .eq('bid_package_id', bidPackageId)
    .eq('subcontractor_email', from.email)
    .order('created_at', { ascending: false })
    .limit(1)

  if (recipientsByEmail && recipientsByEmail.length > 0) {
    recipient = recipientsByEmail[0]
    console.log('✅ Found recipient by email:', recipient.id)
  } else {
    // Try finding by subcontractor_id if email doesn't match
    if (subcontractorId) {
      const { data: recipientsBySub } = await supabase
        .from('bid_package_recipients')
        .select('*')
        .eq('bid_package_id', bidPackageId)
        .eq('subcontractor_id', subcontractorId)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (recipientsBySub && recipientsBySub.length > 0) {
        recipient = recipientsBySub[0]
        console.log('✅ Found recipient by subcontractor_id:', recipient.id)
      }
    }
  }

  if (!recipient && recipientError) {
    console.error('❌ Error finding recipient:', recipientError)
  }

  const recipientUpdateData: any = {
    status: 'responded',
    responded_at: new Date().toISOString(),
    response_text: emailContent.substring(0, 5000), // Truncate to 5000 chars
    has_clarifying_questions: clarifyingQuestions.hasQuestions,
    clarifying_questions: clarifyingQuestions.questions.length > 0 ? clarifyingQuestions.questions : null,
    bid_id: bidId
  }

  if (recipient) {
    // Update existing recipient
    console.log('📝 Updating recipient record:', recipient.id)
    const { error: updateError } = await supabase
      .from('bid_package_recipients')
      .update(recipientUpdateData)
      .eq('id', recipient.id)
    
    if (updateError) {
      console.error('❌ Error updating recipient:', updateError)
    } else {
      console.log('✅ Recipient updated successfully')
    }
    
    // Create notification for clarifying questions if detected
    if (clarifyingQuestions.hasQuestions) {
      await createNotification(supabase, bidPackageId, recipient.id, 'clarifying_question')
    }
  } else {
    console.log('⚠️ Recipient not found, creating new record')
    // Create new recipient record (shouldn't happen, but handle it)
    const { data: newRecipient, error: insertError } = await supabase
      .from('bid_package_recipients')
      .insert({
        bid_package_id: bidPackageId,
        subcontractor_id: subcontractorId,
        subcontractor_email: from.email,
        subcontractor_name: bidData.companyName || (from as any).name || 'Unknown',
        ...recipientUpdateData
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ Error creating recipient:', insertError)
    } else {
      console.log('✅ Created new recipient record:', newRecipient?.id)
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
