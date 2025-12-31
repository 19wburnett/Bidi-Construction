import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { getResendClient } from '@/lib/resend-client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { bidId, declineReason, declineNotes, sendEmail } = body

    console.log('Decline bid request:', { bidId, declineReason, declineNotes, sendEmail })

    if (!bidId) {
      return NextResponse.json(
        { error: 'Bid ID is required' },
        { status: 400 }
      )
    }

    if (!declineReason || !declineReason.trim()) {
      return NextResponse.json(
        { error: 'Decline reason is required' },
        { status: 400 }
      )
    }

    // Fetch the bid to verify ownership and get job_id
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select('id, job_id, bid_package_id, status, subcontractor_email, subcontractors (name, email), gc_contacts (name, email)')
      .eq('id', bidId)
      .single()
    
    console.log('Bid query result:', { bid, bidError, bidErrorCode: bidError?.code, bidErrorDetails: bidError?.details })

    if (bidError) {
      console.error('Error fetching bid:', bidError)
      return NextResponse.json(
        { error: `Database error: ${bidError.message}` },
        { status: 500 }
      )
    }

    if (!bid) {
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      )
    }

    // Get job_id from bid or from bid_package
    let jobId = bid.job_id
    if (!jobId && bid.bid_package_id) {
      const { data: bidPackage } = await supabase
        .from('bid_packages')
        .select('job_id')
        .eq('id', bid.bid_package_id)
        .single()
      jobId = bidPackage?.job_id
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Bid is not associated with a job' },
        { status: 400 }
      )
    }

    // Verify the user has access to this job (owner or member)
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('role')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('user_id, name, location')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('Error fetching job:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify the user owns this job or is a member
    if (!jobMember && job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - You do not have access to this job' },
        { status: 403 }
      )
    }

    // Allow changing status even if already accepted/declined
    // Update bid status to declined
    // Combine decline reason and notes for storage
    const declineReasonText = declineReason.trim()
    const declineNotesText = declineNotes?.trim() || ''
    const combinedDeclineReason = declineNotesText 
      ? `${declineReasonText}\n\nAdditional Notes:\n${declineNotesText}`
      : declineReasonText
    
    const updateData: any = {
      status: 'declined',
      declined_at: new Date().toISOString(),
      decline_reason: combinedDeclineReason
    }
    
    // Also store notes separately in the notes field if they exist
    if (declineNotesText) {
      updateData.notes = declineNotesText
    }
    
    // Clear accepted fields if switching from accepted
    if (bid.status === 'accepted') {
      updateData.accepted_at = null
    }

    const { error: updateError } = await supabase
      .from('bids')
      .update(updateData)
      .eq('id', bidId)

    if (updateError) {
      console.error('Error declining bid:', updateError)
      return NextResponse.json(
        { error: 'Failed to decline bid' },
        { status: 500 }
      )
    }

    // Send email notification if requested
    let emailSent = false
    let emailError = null
    if (sendEmail) {
      try {
        const resend = getResendClient()
        // Handle subcontractors - can be object or array depending on query
        const subcontractor = Array.isArray(bid.subcontractors)
          ? bid.subcontractors[0]
          : bid.subcontractors
        const gcContact = Array.isArray(bid.gc_contacts) 
          ? bid.gc_contacts[0] 
          : bid.gc_contacts
        
        const subcontractorName = subcontractor?.name || gcContact?.name || 'Subcontractor'
        const subcontractorEmail = subcontractor?.email || gcContact?.email || bid.subcontractor_email
        
        if (!subcontractorEmail) {
          console.warn('No email address found for subcontractor')
          emailError = 'No email address found for subcontractor'
        } else {
          // Helper function to escape HTML
          const escapeHtml = (text: string): string => {
            return String(text || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
          }

          // Build email content
          const declineReasonText = escapeHtml(declineReason.trim())
          const declineNotesText = escapeHtml(declineNotes?.trim() || '')
          const combinedFeedback = declineNotesText 
            ? `${declineReasonText}\n\nAdditional Notes:\n${declineNotesText}`
            : declineReasonText
          const subcontractorNameEscaped = escapeHtml(subcontractorName)
          const jobNameEscaped = escapeHtml(job.name || 'Construction Project')
          const jobLocationEscaped = job.location ? escapeHtml(job.location) : ''

          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #f97316; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">BIDI</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Construction Marketplace</p>
              </div>
              
              <div style="background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
                <p style="margin-top: 0;">Hello ${subcontractorNameEscaped},</p>
                
                <p>Thank you for submitting your bid for the following project:</p>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
                  <h2 style="margin-top: 0; color: #1e293b;">${jobNameEscaped}</h2>
                  ${jobLocationEscaped ? `<p style="color: #64748b; margin-bottom: 0;">📍 ${jobLocationEscaped}</p>` : ''}
                </div>
                
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #dc2626;">Bid Status Update</h3>
                  <p style="margin-bottom: 0;">Unfortunately, we have decided to decline your bid for this project.</p>
                </div>
                
                ${combinedFeedback ? `
                  <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1e293b;">Feedback</h3>
                    <div style="white-space: pre-wrap; color: #475569; line-height: 1.8;">${combinedFeedback.replace(/\n/g, '<br>')}</div>
                  </div>
                ` : ''}
                
                <p style="margin-top: 30px;">We appreciate your interest and time spent preparing your bid. We hope to work with you on future projects.</p>
                
                <p style="margin-top: 30px;">Best regards,<br>The BIDI Team</p>
              </div>
              
              <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; margin-top: 20px;">
                <p style="margin: 0; font-size: 14px;">
                  © ${new Date().getFullYear()} BIDI. All rights reserved.
                </p>
              </div>
            </body>
            </html>
          `

          const { data: emailData, error: emailSendError } = await resend.emails.send({
            from: 'Bidi <noreply@bidicontracting.com>',
            to: [subcontractorEmail],
            subject: `Bid Status Update: ${jobNameEscaped}`,
            html: emailHtml
          })

          if (emailSendError) {
            console.error('Error sending decline email:', emailSendError)
            emailError = emailSendError.message
          } else {
            emailSent = true
            console.log('Decline email sent successfully:', emailData)
          }
        }
      } catch (err: any) {
        console.error('Error sending decline email:', err)
        emailError = err.message || 'Failed to send email'
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bid declined successfully',
      bidId,
      emailSent,
      emailError: emailError || undefined
    })

  } catch (error: any) {
    console.error('Error in decline bid API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

