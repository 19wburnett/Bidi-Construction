import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

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
    let emailSubject = `Re: ${bidPackage.jobs.name} - Bid Request: ${bidPackage.trade_category}`
    let emailBody = responseText

    if (quickReplyId) {
      const { data: quickReply } = await supabase
        .from('quick_reply_templates')
        .select('subject, body')
        .eq('id', quickReplyId)
        .eq('user_id', user.id)
        .single()

      if (quickReply) {
        emailSubject = quickReply.subject
        emailBody = quickReply.body.replace(/{response}/g, responseText)
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
    
    // Get all emails in this thread, ordered by most recent first
    const { data: threadEmails } = await supabase
      .from('bid_package_recipients')
      .select('id, resend_email_id, thread_id, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
    
    if (threadEmails && threadEmails.length > 0) {
      // Use the most recent email in the thread as the parent
      mostRecentEmail = threadEmails[0]
      parentId = mostRecentEmail.id
      threadId = mostRecentEmail.thread_id || threadId
      
      // Fetch Message-IDs for proper threading headers
      // We need to reply to the most recent email, but include all previous Message-IDs in References
      const messageIds: string[] = []
      
      // Helper function to get Message-ID for an email
      const getMessageId = async (email: any): Promise<string> => {
        if (!email.resend_email_id) {
          return ''
        }
        
        try {
          // Try to fetch from Resend API (for sent emails) or Receiving API (for received emails)
          let emailResponse = await fetch(`https://api.resend.com/emails/${email.resend_email_id}`, {
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            }
          })
          
          // If that fails, try the Receiving API (for inbound emails)
          if (!emailResponse.ok) {
            emailResponse = await fetch(`https://api.resend.com/emails/receiving/${email.resend_email_id}`, {
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              }
            })
          }
          
          if (emailResponse.ok) {
            const emailData = await emailResponse.json()
            // Try to get Message-ID from headers or construct it
            return emailData.message_id || 
                   emailData.headers?.['message-id'] || 
                   emailData.headers?.['Message-ID'] ||
                   `<${email.resend_email_id}@resend.dev>`
          } else {
            // Construct Message-ID from resend_email_id as fallback
            return `<${email.resend_email_id}@resend.dev>`
          }
        } catch (error) {
          // Construct Message-ID from resend_email_id as fallback
          return `<${email.resend_email_id}@resend.dev>`
        }
      }
      
      // Build References header with all Message-IDs in the thread (for proper threading)
      // Include all emails in the thread chain (oldest to newest)
      // Note: threadEmails is ordered newest first, so we'll reverse it to get chronological order
      const emailsInOrder = [...threadEmails].reverse() // Oldest to newest
      
      // Fetch Message-IDs for all emails in the thread
      for (const email of emailsInOrder) {
        const messageId = await getMessageId(email)
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
        threadLength: threadEmails.length
      })
    } else {
      // Fallback: use the recipient passed in as parent if no thread found
      parentId = recipient.id
      if (recipient.resend_email_id) {
        const messageId = `<${recipient.resend_email_id}@resend.dev>`
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
    
    // Send response email with threading headers
    const emailData: any = {
      from: 'Bidi <noreply@bidicontracting.com>',
      to: [recipient.subcontractor_email],
      subject: emailSubject,
      html: formattedEmailBody,
      reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`,
      ...(Object.keys(emailHeaders).length > 0 && { headers: emailHeaders })
    }
    
    const { data: resendData, error: resendError } = await resend.emails.send(emailData)

    if (resendError) {
      return NextResponse.json(
        { error: 'Failed to send email', details: resendError.message },
        { status: 500 }
      )
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
    
    const { data: newRecipient, error: insertError } = await supabase
      .from('bid_package_recipients')
      .insert({
        bid_package_id: bidPackageId,
        subcontractor_id: recipient.subcontractor_id,
        subcontractor_email: recipient.subcontractor_email,
        subcontractor_name: recipient.subcontractor_name,
        resend_email_id: resendData?.id,
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
      console.error('Error creating reply recipient:', insertError)
      return NextResponse.json(
        { error: 'Failed to create reply record', details: insertError.message },
        { status: 500 }
      )
    }
    
    // Try to ensure thread exists in email_threads table (if it exists)
    try {
    await supabase
      .from('email_threads')
      .upsert({
        bid_package_id: bidPackageId,
        subcontractor_email: recipient.subcontractor_email,
        thread_id: threadId
      }, {
        onConflict: 'thread_id'
      })
    } catch (error) {
      // Table might not exist, that's okay - we track threads via thread_id in bid_package_recipients
      console.log('Note: email_threads table may not exist, continuing without it')
    }

    return NextResponse.json({
      success: true,
      emailId: resendData?.id
    })

  } catch (error: any) {
    console.error('Error sending response:', error)
    return NextResponse.json(
      { error: 'Failed to send response', details: error.message },
      { status: 500 }
    )
  }
}

