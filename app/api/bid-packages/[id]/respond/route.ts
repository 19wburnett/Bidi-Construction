import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { getResendClient } from '@/lib/resend-client'

export const runtime = 'nodejs'

if (!process.env.RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not set in environment variables')
}

interface RespondRequest {
  recipientId: string
  responseText: string
  quickReplyId?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidPackageId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }


    const body: RespondRequest = await request.json()
    const { recipientId, responseText, quickReplyId } = body

    if (!bidPackageId || !recipientId || !responseText) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientId, responseText' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const resend = getResendClient()

    // Verify user owns this bid package
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select(`
        *,
        jobs!inner (
          id,
          name,
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

    // Validate recipient has required fields
    if (!recipient.subcontractor_email) {
      return NextResponse.json(
        { error: 'Recipient email is missing' },
        { status: 400 }
      )
    }

    // Get plans for this job to include plan links
    const jobId = Array.isArray(bidPackage.jobs) ? bidPackage.jobs[0]?.id : (bidPackage.jobs as any).id
    let planLinks: string[] = []

    if (jobId) {
      try {
        const { data: plans, error: plansError } = await supabase
          .from('plans')
          .select('id, file_name, file_path')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })

        if (!plansError && plans && plans.length > 0) {
          for (const plan of plans) {
            if (plan.file_path) {
              try {
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                  .from('plans')
                  .createSignedUrl(plan.file_path, 30 * 24 * 60 * 60) // 30 days
                
                if (!signedUrlError && signedUrlData?.signedUrl) {
                  planLinks.push(signedUrlData.signedUrl)
                }
              } catch (error) {
                console.error('Error generating signed URL for plan:', error)
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading plans:', error)
      }
    }

    // Get quick reply template if provided
    const jobName = Array.isArray(bidPackage.jobs) ? bidPackage.jobs[0]?.name : (bidPackage.jobs as any)?.name
    const tradeCategory = bidPackage.trade_category || 'Bid Request'
    
    // Default subject - will be updated after thread lookup if needed
    let emailSubject = `Re: ${jobName || 'Bid Request'} - ${tradeCategory}`
    let emailBody = responseText

    if (quickReplyId) {
      const { data: quickReply } = await supabase
        .from('quick_reply_templates')
        .select('subject, body')
        .eq('id', quickReplyId)
        .eq('user_id', user.id)
        .single()

      if (quickReply) {
        // Ensure quick reply subject starts with "Re:" if it's a reply
        const templateSubject = quickReply.subject || 'Re: Response'
        emailSubject = templateSubject.startsWith('Re:') 
          ? templateSubject 
          : `Re: ${templateSubject}`
        emailBody = (quickReply.body || '').replace(/{response}/g, responseText)
      }
    }

    // Format email body with plan links if available
    let formattedEmailBody = emailBody.replace(/\n/g, '<br>')
    
    if (planLinks.length > 0) {
      // If there's only one plan, show a single button. If multiple, show them in a list.
      let planLinksHtml = ''
      if (planLinks.length === 1) {
        planLinksHtml = `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${planLinks[0]}" style="display: inline-block; background-color: #EB5023; color: #FFFFFF; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 6px; font-size: 14px;">
              📐 View Project Plans
            </a>
          </div>
        `
      } else {
        planLinksHtml = `
          <div style="margin: 24px 0; padding: 16px; background-color: #F9FAFB; border-radius: 8px;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #111827; font-size: 14px;">Project Plans:</p>
            ${planLinks.map((link, index) => 
              `<div style="margin: 8px 0;">
                <a href="${link}" style="display: inline-block; background-color: #EB5023; color: #FFFFFF; text-decoration: none; font-weight: 600; padding: 10px 20px; border-radius: 6px; font-size: 13px;">
                  📐 View Plan ${index + 1}
                </a>
              </div>`
            ).join('')}
          </div>
        `
      }
      
      formattedEmailBody = `${formattedEmailBody}<br><br>${planLinksHtml}`
    }

    // Find the most recent email in the thread to reply to
    // This ensures we continue the same thread instead of creating a new one
    let threadId = recipient.thread_id || `thread-${bidPackageId}-${recipient.subcontractor_email}`
    let mostRecentEmail: any = null
    let parentId: string | null = null
    let inReplyTo: string | undefined = undefined
    let references: string | undefined = undefined
    let messageIds: string[] = [] // Initialize outside the if block for logging
    
    // Get all emails in this thread - try multiple strategies to find related emails
    // First, try by thread_id (most reliable)
    // Include message_id so we can use actual Message-IDs for threading
    // Also get response_text to extract subject if stored in the email content
    let { data: threadEmails } = await supabase
      .from('bid_package_recipients')
      .select('id, resend_email_id, thread_id, message_id, created_at, response_text')
      .eq('thread_id', threadId)
      .eq('bid_package_id', bidPackageId)
      .order('created_at', { ascending: false })
    
    // If no emails found by thread_id, try finding by bid_package_id and email
    // This handles cases where thread_id might not be set consistently
    if (!threadEmails || threadEmails.length === 0) {
      const { data: allEmails } = await supabase
        .from('bid_package_recipients')
        .select('id, resend_email_id, thread_id, message_id, created_at, response_text')
        .eq('bid_package_id', bidPackageId)
        .eq('subcontractor_email', recipient.subcontractor_email)
        .order('created_at', { ascending: false })
      
      if (allEmails && allEmails.length > 0) {
        threadEmails = allEmails
        // Use the most common thread_id from found emails, or generate one
        const threadIds = allEmails.map((e: any) => e.thread_id).filter(Boolean) as string[]
        if (threadIds.length > 0) {
          // Find most common thread_id
          const threadIdCounts = threadIds.reduce((acc: Record<string, number>, id: string | null) => {
            if (id) {
              acc[id] = (acc[id] || 0) + 1
            }
            return acc
          }, {} as Record<string, number>)
          const mostCommonThreadId = Object.entries(threadIdCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0]
          threadId = mostCommonThreadId || threadId
        }
      }
    }
    
    if (threadEmails && threadEmails.length > 0) {
      // Use the most recent email in the thread as the parent
      mostRecentEmail = threadEmails[0]
      parentId = mostRecentEmail.id
      threadId = mostRecentEmail.thread_id || threadId
      
      // Fetch Message-IDs for proper threading headers
      // We need to reply to the most recent email, but include all previous Message-IDs in References
      messageIds = []
      
      // Helper function to get Message-ID for an email
      // Prefer using stored message_id from database, fall back to constructing from resend_email_id
      const getMessageId = (email: any): string => {
        // First, try to use the stored message_id from the database (most reliable)
        if (email.message_id) {
          // Ensure it's in the correct format
          const msgId = email.message_id.trim()
          return msgId.startsWith('<') ? msgId : `<${msgId}>`
        }
        
        // Fallback: construct Message-ID from resend_email_id
        if (!email.resend_email_id) {
          return ''
        }
        
        // Construct Message-ID in standard format for Resend
        // Resend email IDs are typically UUIDs, and Message-IDs should be <id@resend.dev>
        const constructMessageId = (emailId: string): string => {
          // If it already contains @, it might be a full Message-ID
          if (emailId.includes('@') && emailId.startsWith('<') && emailId.endsWith('>')) {
            return emailId
          }
          // Extract the ID part if it's in format <id@domain>
          const match = emailId.match(/<([^>]+)>/) || emailId.match(/([^@<>\s]+)/)
          const id = match ? match[1] : emailId
          // Construct standard Message-ID format
          return `<${id.includes('@') ? id : `${id}@resend.dev`}>`
        }
        
        return constructMessageId(email.resend_email_id)
      }
      
      // Build References header with all Message-IDs in the thread (for proper threading)
      // Include all emails in the thread chain (oldest to newest)
      // Note: threadEmails is ordered newest first, so we'll reverse it to get chronological order
      const emailsInOrder = [...threadEmails].reverse() // Oldest to newest
      
      // Get Message-IDs for all emails in the thread
      // Use stored message_id from database (no API calls needed, avoiding rate limits)
      for (const email of emailsInOrder) {
        const messageId = getMessageId(email)
        if (messageId) {
          messageIds.push(messageId)
        }
      }
      
      // Set In-Reply-To to the most recent email's Message-ID
      if (messageIds.length > 0) {
        inReplyTo = messageIds[messageIds.length - 1] // Most recent (last in chronological order)
      }
      
      // References header should include all Message-IDs in chronological order (oldest to newest)
      // This includes the most recent one (which is also in In-Reply-To)
      references = messageIds.join(' ')
      
      console.log('📧 [respond] Setting threading headers:', { 
        inReplyTo, 
        references, 
        mostRecentEmailId: mostRecentEmail.resend_email_id,
        mostRecentMessageId: mostRecentEmail.message_id,
        threadLength: threadEmails.length,
        emailSubject
      })
      
      // Use the original subject from the first email in the thread (before any "Re:")
      // This ensures we maintain the same subject pattern for proper threading
      // Email clients thread better when subjects match exactly (with consistent Re: prefix)
      const originalSubject = (() => {
        // Get the oldest email in the thread (first one sent)
        const oldestEmail = emailsInOrder[0]
        if (oldestEmail?.response_text) {
          // Try to extract subject from email content (if stored)
          // This is a fallback - ideally we'd store subject separately
        }
        // For now, use a consistent pattern based on job name and trade
        return `${jobName || 'Bid Request'} - ${tradeCategory}`
      })()
      
      // Ensure subject follows the pattern: "Re: [Re: ...] Original Subject"
      // Remove any existing "Re:" prefixes and add a single one
      let cleanSubject = emailSubject.replace(/^(re:\s*)+/i, '').trim()
      emailSubject = `Re: ${cleanSubject || originalSubject}`
      
      console.log('📧 [respond] Final subject:', emailSubject)
    } else {
      // Fallback: use the recipient passed in as parent if no thread found
      parentId = recipient.id
      
      // Use stored message_id if available, otherwise construct from resend_email_id
      if (recipient.message_id) {
        const msgId = recipient.message_id.trim()
        const messageId = msgId.startsWith('<') ? msgId : `<${msgId}>`
        inReplyTo = messageId
        references = messageId
      } else if (recipient.resend_email_id) {
        // Construct Message-ID in standard format for Resend
        // Resend uses the format: <email-id@resend.dev>
        const messageId = recipient.resend_email_id.includes('@') 
          ? `<${recipient.resend_email_id}>` 
          : `<${recipient.resend_email_id}@resend.dev>`
        inReplyTo = messageId
        references = messageId
      }
    }
    
    // Build email headers for proper threading
    const emailHeaders: Record<string, string> = {}
    if (inReplyTo) {
      emailHeaders['In-Reply-To'] = inReplyTo
    }
    if (references) {
      emailHeaders['References'] = references
    }
    
    console.log('📧 [respond] Email threading setup:', {
      hasInReplyTo: !!inReplyTo,
      inReplyTo,
      hasReferences: !!references,
      referencesLength: references?.split(/\s+/).length || 0,
      references: references,
      subject: emailSubject,
      threadId,
      messageIdsFound: messageIds.length,
      messageIds: messageIds
    })
    
    // Log details about the most recent email we're replying to
    if (mostRecentEmail) {
      console.log('📧 [respond] Most recent email details:', {
        id: mostRecentEmail.id,
        resendEmailId: mostRecentEmail.resend_email_id,
        storedMessageId: mostRecentEmail.message_id,
        threadId: mostRecentEmail.thread_id,
        createdAt: mostRecentEmail.created_at
      })
    }
    
    // Validate Resend API key before sending
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is missing - cannot send email')
      return NextResponse.json(
        { error: 'Email service is not configured' },
        { status: 500 }
      )
    }

    // Send response email with threading headers
    const emailData: any = {
      from: 'Bidi <noreply@bidicontracting.com>',
      to: [recipient.subcontractor_email],
      subject: emailSubject,
      html: formattedEmailBody,
      reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`,
      ...(Object.keys(emailHeaders).length > 0 && { headers: emailHeaders })
    }
    
    console.log('📧 [respond] Sending email via Resend:', {
      to: recipient.subcontractor_email,
      subject: emailSubject,
      hasHeaders: Object.keys(emailHeaders).length > 0,
      headers: emailHeaders
    })
    
    // Add retry logic with exponential backoff for rate limit errors
    let resendData: any = null
    let resendError: any = null
    const maxRetries = 3
    const baseDelay = 600 // Start with 600ms delay
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data, error } = await resend.emails.send(emailData)
      
      if (!error) {
        resendData = data
        resendError = null
        break
      }
      
      // If it's a rate limit error and we have retries left, wait and retry
      if (error.name === 'rate_limit_exceeded' || (error as any).statusCode === 429) {
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff: 600ms, 1200ms, 2400ms
          console.log(`⏳ [respond] Rate limited, waiting ${delay}ms before retry (attempt ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      // For other errors or if we've exhausted retries, fail
      resendError = error
      break
    }

    if (resendError) {
      console.error('❌ [respond] Resend error:', resendError)
      return NextResponse.json(
        { error: 'Failed to send email', details: resendError.message },
        { status: 500 }
      )
    }
    
    if (!resendData?.id) {
      console.error('❌ [respond] No email ID returned from Resend:', resendData)
      return NextResponse.json(
        { error: 'Failed to send email - no email ID returned' },
        { status: 500 }
      )
    }
    
    console.log('✅ [respond] Email sent successfully:', resendData.id)
    console.log('📧 [respond] Resend response:', JSON.stringify(resendData, null, 2))
    
    // Try to fetch the actual Message-ID from Resend after sending
    // Sometimes Resend doesn't include it in the immediate response
    let actualMessageId: string | null = null
    
    // First try the response
    if (resendData.message_id) {
      actualMessageId = resendData.message_id.startsWith('<') 
        ? resendData.message_id 
        : `<${resendData.message_id}>`
      console.log('📧 [respond] Got Message-ID from response:', actualMessageId)
    } else {
      // Construct fallback Message-ID
      actualMessageId = resendData.id ? `<${resendData.id}@resend.dev>` : null
      console.log('📧 [respond] Using constructed Message-ID:', actualMessageId)
      
      // Try to fetch from Resend API after a short delay (in case it's not immediately available)
      try {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        const emailResponse = await fetch(`https://api.resend.com/emails/${resendData.id}`, {
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (emailResponse.ok) {
          const emailDetails = await emailResponse.json()
          if (emailDetails.message_id || emailDetails.headers?.['message-id']) {
            const fetchedId = emailDetails.message_id || emailDetails.headers?.['message-id']
            actualMessageId = fetchedId.startsWith('<') ? fetchedId : `<${fetchedId}>`
            console.log('📧 [respond] Fetched Message-ID from API:', actualMessageId)
          }
        }
      } catch (error) {
        console.log('📧 [respond] Could not fetch Message-ID from API (using constructed):', error instanceof Error ? error.message : String(error))
      }
    }
    
    // Extract text content from formatted email body for storage
    const emailTextContent = formattedEmailBody
      .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove style tags
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .substring(0, 5000) // Limit to 5000 chars
    
    console.log('📧 [respond] Inserting recipient record:', {
      bidPackageId,
      subcontractorEmail: recipient.subcontractor_email,
      threadId,
      parentId,
      resendEmailId: resendData?.id,
      messageId: actualMessageId
    })
    
    const { data: newRecipient, error: insertError } = await supabase
      .from('bid_package_recipients')
      .insert({
        bid_package_id: bidPackageId,
        subcontractor_id: recipient.subcontractor_id,
        subcontractor_email: recipient.subcontractor_email,
        subcontractor_name: recipient.subcontractor_name,
        resend_email_id: resendData?.id,
        message_id: actualMessageId || null, // Store Message-ID for threading
        status: 'sent',
        sent_at: new Date().toISOString(),
        thread_id: threadId,
        parent_email_id: parentId,
        response_text: emailTextContent, // Store the full email content (includes plan links if any)
        is_from_gc: true // Explicitly mark as GC-sent email
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ [respond] Error creating reply recipient:', insertError)
      console.error('❌ [respond] Insert error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      })
      return NextResponse.json(
        { error: 'Failed to create reply record', details: insertError.message },
        { status: 500 }
      )
    }
    
    console.log('✅ [respond] Successfully created recipient record:', newRecipient?.id)
    
    // Try to ensure thread exists in email_threads table (if it exists)
    try {
      const { error: threadUpsertError } = await supabase
        .from('email_threads')
        .upsert({
          bid_package_id: bidPackageId,
          subcontractor_email: recipient.subcontractor_email,
          thread_id: threadId
        }, {
          onConflict: 'thread_id'
        })
      
      if (threadUpsertError) {
        // Table might not exist or there's a constraint issue - that's okay
        console.log('Note: Could not upsert to email_threads table (may not exist):', threadUpsertError.message)
      }
    } catch (error) {
      // Table might not exist, that's okay - we track threads via thread_id in bid_package_recipients
      console.log('Note: email_threads table may not exist, continuing without it:', error instanceof Error ? error.message : String(error))
    }

    return NextResponse.json({
      success: true,
      emailId: resendData?.id
    })

  } catch (error: any) {
    console.error('❌ [respond] Error sending response:', error)
    console.error('❌ [respond] Error stack:', error?.stack)
    console.error('❌ [respond] Error details:', {
      message: error?.message,
      name: error?.name,
      cause: error?.cause,
      code: error?.code,
      details: error?.details
    })
    
    // Return more detailed error in development
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? { 
          message: error?.message, 
          stack: error?.stack,
          name: error?.name 
        }
      : { message: error?.message || 'Unknown error' }
    
    return NextResponse.json(
      { error: 'Failed to send response', ...errorDetails },
      { status: 500 }
    )
  }
}

