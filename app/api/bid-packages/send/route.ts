import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { generateBidRequestEmail, generateBidRequestSubject } from '@/lib/email-templates/bid-request'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendRequest {
  bidPackageId: string
  subcontractorIds: string[]
  planId: string
  reportIds?: string[]
  templateId?: string
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

    const body: SendRequest = await request.json()
    const { bidPackageId, subcontractorIds, planId, reportIds, templateId } = body

    if (!bidPackageId || !subcontractorIds || subcontractorIds.length === 0 || !planId) {
      return NextResponse.json(
        { error: 'Missing required fields: bidPackageId, subcontractorIds, planId' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get bid package details (including deadline field)
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select(`
        *,
        jobs (
          id,
          name,
          location,
          budget_range,
          user_id
        )
      `)
      .eq('id', bidPackageId)
      .single()

    if (packageError || !bidPackage) {
      return NextResponse.json(
        { error: 'Bid package not found' },
        { status: 404 }
      )
    }

    // Verify user owns this job
    if (bidPackage.jobs.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, file_name, file_path, file_size, file_type')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Get subcontractors
    const subcontractorIdMap = new Map<string, { id: string; email: string; name: string; trade_category: string }>()
    
    for (const subId of subcontractorIds) {
      const [source, id] = subId.includes(':') ? subId.split(':') : ['gc', subId]
      
      if (source === 'gc') {
        const { data: gcContact } = await supabase
          .from('gc_contacts')
          .select('id, name, email, trade_category')
          .eq('id', id)
          .single()
        
        if (gcContact) {
          subcontractorIdMap.set(subId, {
            id: subId,
            email: gcContact.email,
            name: gcContact.name,
            trade_category: gcContact.trade_category
          })
        }
      } else if (source === 'bidi') {
        const { data: bidiSub } = await supabase
          .from('subcontractors')
          .select('id, name, email, trade_category')
          .eq('id', id)
          .single()
        
        if (bidiSub) {
          subcontractorIdMap.set(subId, {
            id: subId,
            email: bidiSub.email,
            name: bidiSub.name,
            trade_category: bidiSub.trade_category
          })
        }
      }
    }

    if (subcontractorIdMap.size === 0) {
      return NextResponse.json(
        { error: 'No valid subcontractors found' },
        { status: 400 }
      )
    }

    // Get email template if provided
    let emailTemplate: { subject: string; html_body: string; text_body?: string } | null = null
    if (templateId) {
      const { data: template } = await supabase
        .from('email_templates')
        .select('subject, html_body, text_body')
        .eq('id', templateId)
        .eq('user_id', user.id)
        .single()
      
      if (template) {
        emailTemplate = template
      }
    }

    // Generate job share link (allows viewing all plans for the job)
    let planLink: string | null = null

    try {
      // Check if a job share already exists
      const { data: existingShare } = await supabase
        .from('job_shares')
        .select('*')
        .eq('job_id', bidPackage.jobs.id)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let shareToken: string
      let isNewShare = false

      if (existingShare && (!existingShare.expires_at || new Date(existingShare.expires_at) > new Date())) {
        // Use existing non-expired share
        shareToken = existingShare.share_token
      } else {
        // Create new job share
        shareToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 30) // 30 days

        const { error: shareError } = await supabase
          .from('job_shares')
          .insert({
            job_id: bidPackage.jobs.id,
            share_token: shareToken,
            created_by: user.id,
            expires_at: expiresAt.toISOString()
          })

        if (shareError) {
          console.error('❌ Error creating job share:', shareError)
        } else {
          isNewShare = true
        }
      }

      // Construct share URL
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
      planLink = `${baseUrl}/share/jobs/${shareToken}`
      
      console.log(`🔗 Generated job share link: ${planLink} (${isNewShare ? 'new' : 'existing'})`)
    } catch (error) {
      console.error('❌ Error generating job share link:', error)
    }

    // Generate signed URLs for reports
    const reportLinks: { title: string; url: string }[] = []
    if (reportIds && reportIds.length > 0) {
      try {
        const { data: reports, error: reportsError } = await supabase
          .from('job_reports')
          .select('id, title, file_name, file_path')
          .in('id', reportIds)

        if (reportsError) throw reportsError

        if (reports) {
          for (const report of reports) {
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('job-plans')
              .createSignedUrl(report.file_path, 30 * 24 * 60 * 60) // 30 days

            if (signedUrlData?.signedUrl) {
              reportLinks.push({
                title: report.title || report.file_name,
                url: signedUrlData.signedUrl
              })
            }
          }
        }
      } catch (error) {
        console.error('❌ Error generating report links:', error)
      }
    }

    // Generate email subject - replace variables if using custom template
    let emailSubject = emailTemplate?.subject || generateBidRequestSubject(
      bidPackage.jobs.name,
      bidPackage.trade_category
    )
    
    // Replace variables in custom template subject
    if (emailTemplate?.subject) {
      emailSubject = emailSubject.replace(/{jobName}/g, bidPackage.jobs.name || '')
      emailSubject = emailSubject.replace(/{jobLocation}/g, bidPackage.jobs.location || '')
      emailSubject = emailSubject.replace(/{tradeCategory}/g, bidPackage.trade_category || '')
      emailSubject = emailSubject.replace(/{deadline}/g, bidPackage.deadline ? new Date(bidPackage.deadline).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'No deadline set')
      emailSubject = emailSubject.replace(/{description}/g, bidPackage.description || '')
    }
    
    // Use custom template if provided, otherwise use branded template
    // Ensure deadline is properly formatted (Supabase may return it as Date or string)
    const deadlineValue = bidPackage.deadline 
      ? (bidPackage.deadline instanceof Date 
          ? bidPackage.deadline.toISOString() 
          : String(bidPackage.deadline))
      : null
    
    // Create a copy of bidPackage with formatted deadline for custom templates
    const bidPackageWithFormattedDeadline = {
      ...bidPackage,
      deadline: deadlineValue
    }
    
    const emailBody = emailTemplate 
      ? generateCustomTemplateBody(bidPackageWithFormattedDeadline, planLink, reportLinks, emailTemplate)
      : generateBidRequestEmail({
          jobName: bidPackage.jobs.name,
          jobLocation: bidPackage.jobs.location,
          tradeCategory: bidPackage.trade_category,
          deadline: deadlineValue,
          description: bidPackage.description,
          lineItems: bidPackage.minimum_line_items,
          planLink,
          reportLinks,
        })

    // Send emails and create recipient records
    const results = []
    const errors = []

    for (const [subId, sub] of Array.from(subcontractorIdMap.entries())) {
      try {
        const emailData: any = {
          from: 'Bidi <noreply@bidicontracting.com>',
          to: [sub.email],
          subject: emailSubject,
          html: emailBody,
          reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`
        }

        const { data: resendData, error: resendError } = await resend.emails.send(emailData)

        if (resendError) {
          errors.push({ subcontractor: sub.email, error: resendError.message })
          continue
        }

        // Create recipient record
        const [source, id] = subId.includes(':') ? subId.split(':') : ['gc', subId]
        const subcontractorDbId = source === 'gc' ? null : id

        // Create thread_id for this recipient
        const threadId = `thread-${bidPackageId}-${sub.email}`
        
        // Extract text content from HTML email body for storage
        let emailTextContent = ''
        if (emailBody) {
          emailTextContent = emailBody
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
        }
        
        console.log('📧 [send] Storing email content:', {
          emailBodyLength: emailBody?.length || 0,
          emailTextContentLength: emailTextContent.length,
          emailTextContentPreview: emailTextContent.substring(0, 200),
          subcontractorEmail: sub.email
        })
        
        const { data: recipient, error: recipientError } = await supabase
          .from('bid_package_recipients')
          .insert({
            bid_package_id: bidPackageId,
            subcontractor_id: subcontractorDbId,
            subcontractor_email: sub.email,
            subcontractor_name: sub.name,
            resend_email_id: resendData?.id,
            status: 'sent',
            sent_at: new Date().toISOString(),
            thread_id: threadId,
            parent_email_id: null,
            response_text: emailTextContent || null, // Store email content so it can be displayed in thread (null if empty)
            is_from_gc: true // Mark as sent from GC
          })
          .select()
          .single()
        
        // Verify the content was saved
        if (recipient) {
          console.log('📧 [send] Recipient created:', {
            id: recipient.id,
            hasResponseText: !!recipient.response_text,
            responseTextLength: recipient.response_text?.length || 0
          })
        }

        if (recipientError) {
          console.error('Error creating recipient record:', recipientError)
          errors.push({ subcontractor: sub.email, error: 'Failed to create recipient record' })
          continue
        }

        results.push({
          recipientId: recipient.id,
          email: sub.email,
          resendEmailId: resendData?.id
        })

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        errors.push({ subcontractor: sub.email, error: error.message })
      }
    }

    // Update bid package status to 'sent'
    await supabase
      .from('bid_packages')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', bidPackageId)

    return NextResponse.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('Error sending bid package emails:', error)
    return NextResponse.json(
      { error: 'Failed to send emails', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Generate email body from a custom user-defined template
 * Replaces template variables with actual values
 */
function generateCustomTemplateBody(
  bidPackage: any,
  planLink: string | null,
  reportLinks: { title: string; url: string }[],
  template: { subject: string; html_body: string; text_body?: string }
): string {
  let htmlBody = template.html_body
  
  // Helper function to escape HTML
  const escapeHtml = (text: string): string => {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
  
  // Format deadline
  const formatDeadline = (deadline: string | Date | null): string => {
    if (!deadline) return 'No deadline set'
    try {
      return new Date(deadline).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'No deadline set'
    }
  }
  
  // Replace template variables (escape user content to prevent XSS)
  htmlBody = htmlBody.replace(/{jobName}/g, escapeHtml(bidPackage.jobs.name || ''))
  htmlBody = htmlBody.replace(/{jobLocation}/g, escapeHtml(bidPackage.jobs.location || ''))
  htmlBody = htmlBody.replace(/{tradeCategory}/g, escapeHtml(bidPackage.trade_category || ''))
  htmlBody = htmlBody.replace(/{deadline}/g, formatDeadline(bidPackage.deadline))
  htmlBody = htmlBody.replace(/{description}/g, escapeHtml(bidPackage.description || ''))
  
  // Replace line items - build HTML table
  const lineItemsHtml = bidPackage.minimum_line_items && bidPackage.minimum_line_items.length > 0
    ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr>
            <th style="padding: 12px 16px; text-align: left; background-color: #F3F4F6; border-bottom: 2px solid #EB5023; font-size: 13px; font-weight: 600; color: #404042; text-transform: uppercase;">Description</th>
            <th style="padding: 12px 16px; text-align: left; background-color: #F3F4F6; border-bottom: 2px solid #EB5023; font-size: 13px; font-weight: 600; color: #404042; text-transform: uppercase;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${bidPackage.minimum_line_items.map((item: any) => 
            `<tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #404042;">${escapeHtml(item.description || '')}</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #404042;">${escapeHtml(String(item.quantity || ''))} ${escapeHtml(item.unit || '')}</td>
            </tr>`
          ).join('')}
        </tbody>
      </table>`
    : '<p style="padding: 12px 16px; text-align: center; color: #777878;">No specific line items required</p>'
  
  htmlBody = htmlBody.replace(/{lineItems}/g, lineItemsHtml)
  
  // Replace plan link
  if (planLink) {
    htmlBody = htmlBody.replace(/{planLink}/g, `<a href="${escapeHtml(planLink)}" style="color: #EB5023; text-decoration: none; font-weight: 600;">📐 View & Download All Project Plans</a>`)
  } else {
    htmlBody = htmlBody.replace(/{planLink}/g, 'Plans will be provided separately')
  }
  
  // Replace reports
  if (reportLinks.length > 0) {
    const reportsHtml = reportLinks.map(r => 
      `<a href="${escapeHtml(r.url)}" style="color: #EB5023; text-decoration: none; margin-right: 12px; display: inline-block; margin-bottom: 8px; padding: 10px 16px; border: 2px solid #EB5023; border-radius: 6px; font-size: 13px;">📄 ${escapeHtml(r.title)}</a>`
    ).join('')
    htmlBody = htmlBody.replace(/{reports}/g, reportsHtml)
  } else {
    htmlBody = htmlBody.replace(/{reports}/g, '')
  }
  
  return htmlBody
}

