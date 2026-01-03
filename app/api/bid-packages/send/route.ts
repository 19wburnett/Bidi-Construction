import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { generateBidRequestEmail, generateBidRequestSubject } from '@/lib/email-templates/bid-request'
import { generateBidPackageSMS, formatPhoneNumber, isValidPhoneNumber } from '@/lib/sms-helper'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendRequest {
  bidPackageId: string
  subcontractorIds: string[]
  planId: string
  reportIds?: string[]
  templateId?: string
  deliveryChannel?: 'email' | 'sms' | 'both' // New: delivery channel preference
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

  // Normalize the "from" phone number (must be in E.164 format)
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

  // Verify the phone number is configured for messaging and get messaging profile ID
  let messagingProfileId: string | undefined
  try {
    const verifyResponse = await fetch(`https://api.telnyx.com/v2/phone_numbers/${encodeURIComponent(normalizedFrom)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`
      }
    })
    
    if (verifyResponse.ok) {
      const numberData = await verifyResponse.json()
      messagingProfileId = numberData.data?.messaging_profile_id
      console.log('📱 [sendTelnyxSMS] Phone number details:', {
        number: normalizedFrom,
        status: numberData.data?.status,
        features: numberData.data?.features,
        messagingProfileId: messagingProfileId
      })
      
      // Check if messaging is enabled
      if (!messagingProfileId && !numberData.data?.features?.sms) {
        console.error('❌ [sendTelnyxSMS] Phone number is NOT assigned to a messaging profile!')
        console.error('❌ [sendTelnyxSMS] Go to Telnyx Dashboard → Numbers → My Numbers → Find your number → Assign Messaging Profile')
        throw new Error(
          `Phone number ${normalizedFrom} is not assigned to a messaging profile. ` +
          `Please go to Telnyx Dashboard → Numbers → My Numbers → Find ${normalizedFrom} → Assign Messaging Profile. ` +
          `The messaging profile you just viewed needs to be assigned to this phone number.`
        )
      } else if (!messagingProfileId) {
        console.warn('⚠️ [sendTelnyxSMS] Phone number has SMS features but no messaging profile assigned')
      } else {
        console.log('✅ [sendTelnyxSMS] Phone number is properly configured:', {
          messagingProfileId: messagingProfileId,
          status: numberData.data.status
        })
      }
    } else {
      console.warn('⚠️ [sendTelnyxSMS] Could not verify phone number status:', verifyResponse.status)
    }
  } catch (verifyError) {
    // Non-critical - continue with sending
    console.warn('⚠️ [sendTelnyxSMS] Could not verify phone number:', verifyError)
  }

  // Build request body according to Telnyx API spec
  // According to API docs: 'from' is required when sending with a phone number
  // 'messaging_profile_id' can be included but 'from' is still required for phone numbers
  const requestBody: any = {
    from: normalizedFrom,
    to: normalizedTo,
    text: message
  }
  
  // Include messaging_profile_id if available (may help with some account restrictions)
  if (messagingProfileId) {
    requestBody.messaging_profile_id = messagingProfileId
    console.log('📱 [sendTelnyxSMS] Including messaging_profile_id in request:', messagingProfileId)
  }

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${telnyxApiKey}`
    },
    body: JSON.stringify(requestBody)
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('❌ Telnyx API error:', JSON.stringify(data, null, 2))
    
    // Provide more helpful error messages
    const errorCode = data.errors?.[0]?.code
    const errorDetail = data.errors?.[0]?.detail || data.message || 'Failed to send SMS'
    
    if (errorCode === '40013') {
      throw new Error(
        `Invalid source phone number: ${normalizedFrom} (normalized from: ${telnyxPhoneNumber}). ` +
        `This error means Telnyx cannot use this number for messaging. ` +
        `Please check in Telnyx dashboard: ` +
        `1) Go to Numbers → My Numbers → Find ${normalizedFrom} ` +
        `2) Ensure "Messaging" is enabled for this number ` +
        `3) Verify the number status is "Active" ` +
        `4) Check that a Messaging Profile is assigned to the number ` +
        `If messaging is not enabled, click "Enable Messaging" in the number settings.`
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
        `which is required by the carrier for A2P (Application-to-Person) messaging. ` +
        `To fix this: ` +
        `1) Go to Telnyx Dashboard → Messaging → 10DLC → Register your brand and campaign, OR ` +
        `2) Use a toll-free number or short code that doesn't require 10DLC registration. ` +
        `See: https://developers.telnyx.com/docs/overview/errors/40010 or https://developers.telnyx.com/docs/messaging/10dlc/overview`
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

    const body: SendRequest = await request.json()
    const { bidPackageId, subcontractorIds, planId, reportIds, templateId, deliveryChannel = 'email' } = body

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

    // Get subcontractors (with phone numbers for SMS)
    const subcontractorIdMap = new Map<string, { id: string; email: string; name: string; trade_category: string; phone?: string }>()
    
    for (const subId of subcontractorIds) {
      const [source, id] = subId.includes(':') ? subId.split(':') : ['gc', subId]
      
      if (source === 'gc') {
        const { data: gcContact } = await supabase
          .from('gc_contacts')
          .select('id, name, email, trade_category, phone')
          .eq('id', id)
          .single()
        
        if (gcContact) {
          subcontractorIdMap.set(subId, {
            id: subId,
            email: gcContact.email,
            name: gcContact.name,
            trade_category: gcContact.trade_category,
            phone: gcContact.phone || undefined
          })
        }
      } else if (source === 'bidi') {
        const { data: bidiSub } = await supabase
          .from('subcontractors')
          .select('id, name, email, trade_category, phone')
          .eq('id', id)
          .single()
        
        if (bidiSub) {
          subcontractorIdMap.set(subId, {
            id: subId,
            email: bidiSub.email,
            name: bidiSub.name,
            trade_category: bidiSub.trade_category,
            phone: bidiSub.phone || undefined
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

    // Generate SMS message if needed
    const smsMessage = (deliveryChannel === 'sms' || deliveryChannel === 'both')
      ? generateBidPackageSMS({
          jobName: bidPackage.jobs.name,
          jobLocation: bidPackage.jobs.location,
          tradeCategory: bidPackage.trade_category,
          deadline: deadlineValue,
          description: bidPackage.description,
          planLink
        })
      : null

    // Send emails/SMS and create recipient records
    const results = []
    const errors = []

    for (const [subId, sub] of Array.from(subcontractorIdMap.entries())) {
      try {
        // Create recipient record
        const [source, id] = subId.includes(':') ? subId.split(':') : ['gc', subId]
        const subcontractorDbId = source === 'gc' ? null : id

        // Create thread_id for this recipient
        const threadId = `thread-${bidPackageId}-${sub.email || sub.phone || subId}`

        let resendData: any = null
        let telnyxMessageId: string | null = null
        let emailTextContent = ''
        let messageId: string | null = null

        // Send email if requested
        if (deliveryChannel === 'email' || deliveryChannel === 'both') {
          if (!sub.email) {
            errors.push({ subcontractor: sub.name || subId, error: 'No email address available' })
            continue
          }

          const emailData: any = {
            from: 'Bidi <noreply@bidicontracting.com>',
            to: [sub.email],
            subject: emailSubject,
            html: emailBody,
            reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`
          }

          const { data, error: resendError } = await resend.emails.send(emailData)

          if (resendError) {
            errors.push({ subcontractor: sub.email, error: resendError.message })
            // Continue to try SMS if both channels requested
            if (deliveryChannel === 'both' && sub.phone) {
              // Will try SMS below
            } else {
              continue
            }
          } else {
            resendData = data
            messageId = resendData?.message_id || (resendData?.id ? `<${resendData.id}@resend.dev>` : null)
            
            // Extract text content from HTML email body for storage
            if (emailBody) {
              emailTextContent = emailBody
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
                .substring(0, 5000)
            }
          }
        }

        // Send SMS if requested
        if (deliveryChannel === 'sms' || deliveryChannel === 'both') {
          if (!sub.phone) {
            if (deliveryChannel === 'sms') {
              errors.push({ subcontractor: sub.name || subId, error: 'No phone number available' })
              continue
            }
            // If both channels and email failed, skip
            if (deliveryChannel === 'both' && !resendData) {
              continue
            }
          } else if (isValidPhoneNumber(sub.phone)) {
            try {
              const smsResult = await sendTelnyxSMS(sub.phone, smsMessage || emailTextContent || 'New bid opportunity')
              telnyxMessageId = smsResult.id
              console.log('📱 [send] SMS sent successfully:', { phone: sub.phone, messageId: telnyxMessageId })
            } catch (smsError: any) {
              console.error('❌ Error sending SMS:', smsError)
              if (deliveryChannel === 'sms') {
                errors.push({ subcontractor: sub.phone, error: `SMS failed: ${smsError.message}` })
                continue
              }
              // If both channels, continue with email only
            }
          } else {
            console.warn(`⚠️ Invalid phone number for ${sub.name || subId}: ${sub.phone}`)
            if (deliveryChannel === 'sms') {
              errors.push({ subcontractor: sub.phone, error: 'Invalid phone number format' })
              continue
            }
          }
        }

        // Create recipient record
        const recipientData: any = {
          bid_package_id: bidPackageId,
          subcontractor_id: subcontractorDbId,
          subcontractor_email: sub.email || null,
          subcontractor_name: sub.name,
          subcontractor_phone: sub.phone || null,
          delivery_channel: deliveryChannel,
          thread_id: threadId,
          parent_email_id: null,
          is_from_gc: true
        }

        // Add email fields if email was sent
        if (resendData) {
          recipientData.resend_email_id = resendData.id
          recipientData.message_id = messageId
          recipientData.status = 'sent'
          recipientData.sent_at = new Date().toISOString()
          recipientData.response_text = emailTextContent || null
        }

        // Add SMS fields if SMS was sent
        if (telnyxMessageId) {
          recipientData.telnyx_message_id = telnyxMessageId
          recipientData.sms_status = 'sent'
          recipientData.sms_sent_at = new Date().toISOString()
          if (!recipientData.response_text && smsMessage) {
            recipientData.response_text = smsMessage
          }
        }

        // If neither email nor SMS was sent successfully, skip creating recipient
        if (!resendData && !telnyxMessageId) {
          continue
        }

        console.log(`📧 [send] Creating recipient record for ${sub.email || sub.phone} in package ${bidPackageId}`)
        
        const { data: recipient, error: recipientError } = await supabase
          .from('bid_package_recipients')
          .insert(recipientData)
          .select()
          .single()
        
        if (recipientError) {
          console.error(`📧 [send] Error creating recipient record:`, recipientError)
          errors.push({ 
            subcontractor: sub.email || sub.phone || subId, 
            error: `Failed to create recipient record: ${recipientError.message}` 
          })
          throw new Error(`Failed to create recipient record: ${recipientError.message}`)
        }

        if (!recipient) {
          console.error(`📧 [send] Recipient insert returned no data`)
          errors.push({ subcontractor: sub.email || sub.phone || subId, error: 'Recipient insert returned no data' })
          throw new Error('Recipient insert returned no data')
        }

        console.log('📧 [send] Recipient created successfully:', {
          id: recipient.id,
          email: recipient.subcontractor_email,
          phone: recipient.subcontractor_phone,
          deliveryChannel: recipient.delivery_channel
        })

        results.push({
          recipientId: recipient.id,
          email: sub.email,
          phone: sub.phone,
          resendEmailId: resendData?.id,
          telnyxMessageId
        })

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        errors.push({ subcontractor: sub.email || sub.phone || subId, error: error.message })
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
      </table>
      <!-- Important Disclaimer -->
      <div style="background-color: #FFF7ED; border-left: 4px solid #F59E0B; border-radius: 0 8px 8px 0; padding: 20px; margin: 24px 0;">
        <h3 style="font-size: 15px; font-weight: 600; color: #92400E; margin: 0 0 12px 0;">
          ⚠️ Important: Verify Measurements & Check for Missing Scope
        </h3>
        <p style="font-size: 15px; color: #78350F; margin: 0 0 12px 0; line-height: 1.7;">
          Please note that the line items provided above are <strong>minimum requirements</strong> based on initial takeoff measurements. We strongly recommend that you:
        </p>
        <ul style="margin: 16px 0; padding-left: 20px;">
          <li style="font-size: 15px; color: #78350F; margin: 8px 0; line-height: 1.6;">
            <strong>Perform your own measurements</strong> to verify quantities and ensure accuracy
          </li>
          <li style="font-size: 15px; color: #78350F; margin: 8px 0; line-height: 1.6;">
            <strong>Review the plans thoroughly</strong> to identify any additional scope or items that may be missing from the list above
          </li>
          <li style="font-size: 15px; color: #78350F; margin: 8px 0; line-height: 1.6;">
            <strong>Include any additional work</strong> you identify in your bid, as the provided line items may not represent the complete scope
          </li>
        </ul>
        <p style="font-size: 13px; color: #92400E; margin: 0;">
          Your bid should reflect your own measurements and assessment of the full scope of work required.
        </p>
      </div>`
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

