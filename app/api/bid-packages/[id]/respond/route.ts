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

    // Send response email
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: 'Bidi <noreply@bidicontracting.com>',
      to: [recipient.subcontractor_email],
      subject: emailSubject,
      html: formattedEmailBody,
      reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`
    })

    if (resendError) {
      return NextResponse.json(
        { error: 'Failed to send email', details: resendError.message },
        { status: 500 }
      )
    }

    // Create new recipient record for the response (to track thread)
    // Use the original recipient's thread_id, or find the original email in the thread
    let threadId = recipient.thread_id || `thread-${bidPackageId}-${recipient.subcontractor_email}`
    let parentId = recipient.id
    
    // If this recipient is a reply, find the original email to get the correct thread_id
    if (recipient.parent_email_id) {
      const { data: originalRecipient } = await supabase
        .from('bid_package_recipients')
        .select('thread_id, id')
        .eq('id', recipient.parent_email_id)
        .maybeSingle()
      
      if (originalRecipient) {
        threadId = originalRecipient.thread_id || threadId
        // Use the latest message in the thread as parent (the recipient passed in)
        parentId = recipient.id
      }
    }
    
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
        response_text: responseText.trim() // Store the reply text for GC messages
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

