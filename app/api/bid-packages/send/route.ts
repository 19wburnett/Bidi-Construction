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

    // Get email template if provided (including variables for branding)
    // Check both owned templates and shared templates
    let emailTemplate: { subject: string; html_body: string; text_body?: string; variables?: any } | null = null
    if (templateId) {
      // First check if user owns the template
      const { data: ownedTemplate } = await supabase
        .from('email_templates')
        .select('subject, html_body, text_body, variables')
        .eq('id', templateId)
        .eq('user_id', user.id)
        .single()
      
      if (ownedTemplate) {
        emailTemplate = ownedTemplate
      } else {
        // Check if template is shared with user
        const { data: sharedTemplate } = await supabase
          .from('email_template_shares')
          .select(`
            email_templates (
              subject,
              html_body,
              text_body,
              variables
            )
          `)
          .eq('template_id', templateId)
          .eq('shared_with_user_id', user.id)
          .single()
        
        if (sharedTemplate?.email_templates) {
          const templates = Array.isArray(sharedTemplate.email_templates) 
            ? sharedTemplate.email_templates 
            : [sharedTemplate.email_templates]
          if (templates.length > 0) {
            emailTemplate = templates[0]
          }
        }
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
          
          console.log('📧 [send] Email sent successfully:', {
            resend_email_id: resendData.id,
            message_id: messageId,
            to: sub.email,
            subject: emailSubject,
            bid_package_id: bidPackageId
          })
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
        console.log('📧 [send] Recipient data being inserted:', {
          bid_package_id: recipientData.bid_package_id,
          subcontractor_email: recipientData.subcontractor_email,
          subcontractor_name: recipientData.subcontractor_name,
          resend_email_id: recipientData.resend_email_id || 'N/A (SMS only)',
          telnyx_message_id: recipientData.telnyx_message_id || 'N/A (Email only)',
          delivery_channel: recipientData.delivery_channel,
          status: recipientData.status,
          thread_id: recipientData.thread_id
        })
        
        const { data: recipient, error: recipientError } = await supabase
          .from('bid_package_recipients')
          .insert(recipientData)
          .select()
          .single()
        
        if (recipientError) {
          console.error(`📧 [send] ❌ Error creating recipient record:`, {
            error: recipientError,
            errorMessage: recipientError.message,
            errorCode: recipientError.code,
            errorDetails: recipientError.details,
            recipientData: {
              bid_package_id: recipientData.bid_package_id,
              subcontractor_email: recipientData.subcontractor_email,
              resend_email_id: recipientData.resend_email_id
            }
          })
          errors.push({ 
            subcontractor: sub.email || sub.phone || subId, 
            error: `Failed to create recipient record: ${recipientError.message}` 
          })
          throw new Error(`Failed to create recipient record: ${recipientError.message}`)
        }

        if (!recipient) {
          console.error(`📧 [send] ❌ Recipient insert returned no data`, {
            recipientData: {
              bid_package_id: recipientData.bid_package_id,
              subcontractor_email: recipientData.subcontractor_email,
              resend_email_id: recipientData.resend_email_id
            }
          })
          errors.push({ subcontractor: sub.email || sub.phone || subId, error: 'Recipient insert returned no data' })
          throw new Error('Recipient insert returned no data')
        }

        console.log('📧 [send] ✅ Recipient created successfully:', {
          id: recipient.id,
          email: recipient.subcontractor_email,
          phone: recipient.subcontractor_phone,
          deliveryChannel: recipient.delivery_channel,
          resend_email_id: recipient.resend_email_id || 'N/A',
          telnyx_message_id: recipient.telnyx_message_id || 'N/A',
          status: recipient.status,
          created_at: recipient.created_at,
          bid_package_id: recipient.bid_package_id
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
  template: { subject: string; html_body: string; text_body?: string; variables?: any }
): string {
  let htmlBody = template.html_body
  
  // Apply branding from template variables if they exist
  const branding = template.variables || {}
  const brandColors = branding.brand_colors || {}
  const primaryColor = brandColors.primary || '#EB5023'
  const secondaryColor = brandColors.secondary || '#1E1D1E'
  const backgroundColor = brandColors.background || '#FFFFFF'
  const textColor = brandColors.text || '#1E1D1E'
  const fontFamily = branding.font_family || 'Arial, sans-serif'
  const companyName = branding.company_name || ''
  const logoUrl = branding.logo_url || ''
  const signature = branding.signature || ''
  
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
  const jobName = escapeHtml(bidPackage.jobs.name || '')
  const jobLocation = escapeHtml(bidPackage.jobs.location || '')
  const tradeCategory = escapeHtml(bidPackage.trade_category || '')
  const formattedDeadline = formatDeadline(bidPackage.deadline)
  const description = escapeHtml(bidPackage.description || '')
  
  // Handle JSX-style conditionals: {variable && ( ... )}
  // Process conditionals by finding matching pairs
  const processConditional = (variable: string, hasValue: boolean) => {
    const openPattern = new RegExp(`\\{[\\s]*${variable}[\\s]*&&[\\s]*\\(`, 'g')
    const matches: Array<{ openStart: number; openEnd: number; closeStart: number; closeEnd: number }> = []
    
    // Find all opening patterns
    let match
    while ((match = openPattern.exec(htmlBody)) !== null) {
      const openStart = match.index
      const openEnd = match.index + match[0].length
      
      // Find matching closing )} by counting parentheses, skipping strings
      let depth = 1
      let pos = openEnd
      let inString = false
      let stringChar = ''
      
      while (pos < htmlBody.length && depth > 0) {
        const char = htmlBody[pos]
        
        // Handle string literals
        if (!inString && (char === '"' || char === "'")) {
          inString = true
          stringChar = char
        } else if (inString) {
          if (char === stringChar && htmlBody[pos - 1] !== '\\') {
            inString = false
          }
        } else {
          // Count parentheses only when not in string
          if (char === '(') depth++
          else if (char === ')') {
            depth--
            if (depth === 0) {
              // Check if followed by }
              let nextPos = pos + 1
              while (nextPos < htmlBody.length && /\s/.test(htmlBody[nextPos])) {
                nextPos++
              }
              if (htmlBody[nextPos] === '}') {
                // Find end of }
                let closeEnd = nextPos + 1
                while (closeEnd < htmlBody.length && /\s/.test(htmlBody[closeEnd])) {
                  closeEnd++
                }
                matches.push({ openStart, openEnd, closeStart: pos, closeEnd })
                break
              }
            }
          }
        }
        pos++
      }
    }
    
    // Process matches in reverse order to maintain indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const { openStart, openEnd, closeStart, closeEnd } = matches[i]
      if (hasValue) {
        // Remove just the conditional syntax, keep content
        htmlBody = htmlBody.substring(0, openStart) + 
                   htmlBody.substring(openEnd, closeStart) + 
                   htmlBody.substring(closeEnd)
      } else {
        // Remove entire block
        htmlBody = htmlBody.substring(0, openStart) + htmlBody.substring(closeEnd)
      }
    }
  }
  
  // Process conditionals for each variable
  processConditional('description', !!description)
  processConditional('deadline', formattedDeadline !== 'No deadline set' && !!formattedDeadline)
  
  htmlBody = htmlBody.replace(/{jobName}/g, jobName)
  htmlBody = htmlBody.replace(/{jobLocation}/g, jobLocation)
  htmlBody = htmlBody.replace(/{tradeCategory}/g, tradeCategory)
  htmlBody = htmlBody.replace(/{deadline}/g, formattedDeadline)
  
  // Handle description - only show if it exists
  if (description) {
    htmlBody = htmlBody.replace(/{description}/g, description)
  } else {
    // Remove description paragraph if empty
    htmlBody = htmlBody.replace(/<p[^>]*>\s*\{description\}\s*<\/p>/gi, '')
    htmlBody = htmlBody.replace(/{description}/g, '')
  }
  
  // Replace line items - build simple text-based list (matching preview style)
  const lineItemsHtml = bidPackage.minimum_line_items && bidPackage.minimum_line_items.length > 0
    ? `<ul style="margin: 16px 0; padding-left: 20px; list-style-type: disc;">
        ${bidPackage.minimum_line_items.map((item: any) => {
          const parts = []
          if (item.name) parts.push(`<strong>${escapeHtml(item.name)}</strong>`)
          parts.push(escapeHtml(item.description || ''))
          if (item.cost_code) parts.push(`<span style="color: #6b7280; font-size: 14px;">(Cost Code: ${escapeHtml(item.cost_code)})</span>`)
          parts.push(`- ${escapeHtml(String(item.quantity || ''))} ${escapeHtml(item.unit || '')}`)
          return `<li style="margin: 8px 0; font-size: 16px; line-height: 1.5;">${parts.join(' ')}</li>`
        }).join('')}
      </ul>`
    : ''
  
  // Handle lineItems conditional block
  processConditional('lineItems', !!lineItemsHtml)
  
  // Only replace {lineItems} if there are items, otherwise remove the section
  if (lineItemsHtml) {
    htmlBody = htmlBody.replace(/{lineItems}/g, lineItemsHtml)
  } else {
    // Remove line items section if empty
    htmlBody = htmlBody.replace(/<div[^>]*>\s*<p[^>]*>[\s\S]*?Required items[\s\S]*?<\/p>\s*\{lineItems\}\s*<\/div>/gi, '')
    htmlBody = htmlBody.replace(/{lineItems}/g, '')
  }
  
  // Replace plan link - handle both href and text content
  const hasPlanLink = !!planLink && planLink !== '#'
  processConditional('planLink', hasPlanLink)
  
  if (hasPlanLink) {
    // First, replace {planLink} in href attributes
    htmlBody = htmlBody.replace(/href=["']\{planLink\}["']/gi, `href="${escapeHtml(planLink)}"`)
    // Then replace remaining {planLink} in text content (not in href)
    // Use a function to check context
    htmlBody = htmlBody.replace(/{planLink}/g, (match, offset) => {
      // Check if we're inside an href attribute by looking backwards
      const before = htmlBody.substring(Math.max(0, offset - 50), offset)
      if (before.match(/href\s*=\s*["'][^"']*$/)) {
        // We're inside an href, skip (already replaced above)
        return ''
      }
      // Replace with just the URL text (not wrapped in <a> since template may already have one)
      return escapeHtml(planLink)
    })
  } else {
    // Remove plan link section if no link
    htmlBody = htmlBody.replace(/<p[^>]*>[\s\S]*?You can view and download[\s\S]*?\{planLink\}[\s\S]*?<\/p>/gi, '')
    htmlBody = htmlBody.replace(/href=["']\{planLink\}["']/gi, 'href="#"')
    htmlBody = htmlBody.replace(/{planLink}/g, 'Plans will be provided separately')
  }
  
  // Replace reports - simple text list
  const hasReports = reportLinks.length > 0
  processConditional('reports', hasReports)
  
  if (hasReports) {
    const reportsHtml = reportLinks.map(r => 
      `<p style="margin: 8px 0; font-size: 16px; line-height: 1.5;"><a href="${escapeHtml(r.url)}" style="color: ${primaryColor}; text-decoration: underline;">${escapeHtml(r.title)}</a></p>`
    ).join('')
    htmlBody = htmlBody.replace(/{reports}/g, reportsHtml)
  } else {
    // Remove reports section if empty
    htmlBody = htmlBody.replace(/<div[^>]*>\s*<p[^>]*>[\s\S]*?Additional documents[\s\S]*?<\/p>\s*\{reports\}\s*<\/div>/gi, '')
    htmlBody = htmlBody.replace(/{reports}/g, '')
  }
  
  // Replace bid email - use the reply-to email address
  const bidEmail = `bids+${bidPackage.id}@bids.bidicontracting.com`
  htmlBody = htmlBody.replace(/{bidEmail}/g, escapeHtml(bidEmail))
  
  // Apply branding variables to the template
  // Replace branding placeholders that might be in the template
  htmlBody = htmlBody.replace(/\$\{primaryColor\}/g, primaryColor)
  htmlBody = htmlBody.replace(/\$\{secondaryColor\}/g, secondaryColor)
  htmlBody = htmlBody.replace(/\$\{backgroundColor\}/g, backgroundColor)
  htmlBody = htmlBody.replace(/\$\{textColor\}/g, textColor)
  htmlBody = htmlBody.replace(/\$\{fontFamily\}/g, fontFamily)
  htmlBody = htmlBody.replace(/\$\{companyName\}/g, escapeHtml(companyName))
  htmlBody = htmlBody.replace(/\$\{logoUrl\}/g, logoUrl)
  
  // Also handle template literal style replacements (without $)
  htmlBody = htmlBody.replace(/\{primaryColor\}/g, primaryColor)
  htmlBody = htmlBody.replace(/\{secondaryColor\}/g, secondaryColor)
  htmlBody = htmlBody.replace(/\{backgroundColor\}/g, backgroundColor)
  htmlBody = htmlBody.replace(/\{textColor\}/g, textColor)
  htmlBody = htmlBody.replace(/\{fontFamily\}/g, fontFamily)
  htmlBody = htmlBody.replace(/\{companyName\}/g, escapeHtml(companyName))
  htmlBody = htmlBody.replace(/\{logoUrl\}/g, logoUrl)
  
  // Apply signature - replace signature placeholder with actual signature
  if (signature) {
    // Replace signature variables in the signature HTML
    let signatureHtml = signature
    signatureHtml = signatureHtml.replace(/\{primaryColor\}/g, primaryColor)
    signatureHtml = signatureHtml.replace(/\{secondaryColor\}/g, secondaryColor)
    signatureHtml = signatureHtml.replace(/\{backgroundColor\}/g, backgroundColor)
    signatureHtml = signatureHtml.replace(/\{textColor\}/g, textColor)
    signatureHtml = signatureHtml.replace(/\{fontFamily\}/g, fontFamily)
    signatureHtml = signatureHtml.replace(/\{companyName\}/g, escapeHtml(companyName))
    // Don't escape logoUrl - it needs to be a valid URL for img src
    signatureHtml = signatureHtml.replace(/\{logoUrl\}/g, logoUrl || '')
    
    htmlBody = htmlBody.replace(/\{signature\}/g, signatureHtml)
  } else {
    // Default signature if none provided
    let defaultSignature = '<p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.5;">Thanks,</p>'
    if (logoUrl) {
      // Use the logo URL directly (it's already a URL, don't escape it for img src)
      defaultSignature += `<div style="margin: 8px 0;"><img src="${logoUrl}" alt="${escapeHtml(companyName || 'Company')}" style="max-height: 40px;" /></div>`
    }
    if (companyName) {
      defaultSignature += `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${textColor};">${escapeHtml(companyName)}</p>`
    } else {
      defaultSignature += `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${textColor};">The Team</p>`
    }
    htmlBody = htmlBody.replace(/\{signature\}/g, defaultSignature)
  }
  
  // Final cleanup - remove any remaining conditional syntax fragments
  // This handles cases where templates might have been edited with JSX-like syntax
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*&&\s*\(/g, '')
  htmlBody = htmlBody.replace(/\)\s*\}\s*/g, '')
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*\?/g, '')
  htmlBody = htmlBody.replace(/:\s*'[^']*'\s*\}/g, '')
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*&&\s*\(/g, '')
  htmlBody = htmlBody.replace(/\)\s*\}\s*\)/g, '')
  
  return htmlBody
  
  // Final cleanup - remove any remaining conditional syntax fragments
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*&&\s*\(/g, '')
  htmlBody = htmlBody.replace(/\)\s*\}\s*/g, '')
  htmlBody = htmlBody.replace(/\{[a-zA-Z]+\s*\?/g, '')
  htmlBody = htmlBody.replace(/:\s*'[^']*'\s*\}/g, '')
  
  return htmlBody
}

