import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateReminderEmail, generateReminderSubject } from '@/lib/email-templates/reminder'

export const runtime = 'nodejs'
// Allow up to 5 minutes for the cron job to complete
export const maxDuration = 300

const resend = new Resend(process.env.RESEND_API_KEY)

// Default reminder schedule: 3 days, then 7 days
const DEFAULT_REMINDER_DAYS = [3, 7]

/**
 * Cron endpoint for automatic bid package follow-up reminders
 * 
 * This endpoint is designed to run daily via Vercel Cron.
 * It finds recipients who haven't responded and sends reminder emails
 * based on the configured schedule.
 * 
 * Security: Validates CRON_SECRET header to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (Vercel sets this automatically for cron jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require CRON_SECRET
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('🚫 Unauthorized cron request')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    console.log('🔔 Starting reminder cron job...')
    const supabase = await createServerSupabaseClient()
    const now = new Date()
    
    // Find recipients who need reminders
    // Criteria:
    // - Status is 'sent', 'delivered', or 'opened' (not responded/bounced/failed)
    // - reminder_count < 2 (max 2 reminders)
    // - bid_package.auto_reminder_enabled is true
    // - Enough time has passed since sent_at based on reminder schedule
    
    const { data: recipients, error: recipientsError } = await supabase
      .from('bid_package_recipients')
      .select(`
        *,
        bid_packages (
          id,
          trade_category,
          deadline,
          description,
          auto_reminder_enabled,
          reminder_schedule,
          jobs (
            id,
            name,
            location,
            user_id
          )
        )
      `)
      .in('status', ['sent', 'delivered', 'opened'])
      .lt('reminder_count', 2)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: true })

    if (recipientsError) {
      console.error('❌ Error fetching recipients:', recipientsError)
      return NextResponse.json(
        { error: 'Failed to fetch recipients', details: recipientsError.message },
        { status: 500 }
      )
    }

    if (!recipients || recipients.length === 0) {
      console.log('✅ No recipients need reminders')
      return NextResponse.json({
        success: true,
        message: 'No reminders needed',
        sent: 0
      })
    }

    console.log(`📋 Found ${recipients.length} potential recipients to check`)

    const results: { email: string; status: string; reminderNumber: number }[] = []
    const errors: { email: string; error: string }[] = []

    for (const recipient of recipients) {
      try {
        // Skip if bid package doesn't have auto_reminder_enabled
        if (!recipient.bid_packages?.auto_reminder_enabled) {
          console.log(`⏭️ Skipping ${recipient.subcontractor_email} - auto reminders disabled`)
          continue
        }

        // Get reminder schedule (use default if not set)
        const reminderSchedule: number[] = recipient.bid_packages?.reminder_schedule || DEFAULT_REMINDER_DAYS
        const currentReminderCount = recipient.reminder_count || 0
        
        // Check if there's a next reminder day configured
        if (currentReminderCount >= reminderSchedule.length) {
          console.log(`⏭️ Skipping ${recipient.subcontractor_email} - all reminders sent`)
          continue
        }

        // Calculate if it's time for the next reminder
        const sentDate = new Date(recipient.sent_at)
        const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
        const nextReminderDay = reminderSchedule[currentReminderCount]

        // Check if we should wait based on last reminder
        if (recipient.last_reminder_sent_at) {
          const lastReminderDate = new Date(recipient.last_reminder_sent_at)
          const daysSinceLastReminder = Math.floor((now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60 * 24))
          
          // Don't send reminders more than once per day
          if (daysSinceLastReminder < 1) {
            console.log(`⏭️ Skipping ${recipient.subcontractor_email} - reminder sent today`)
            continue
          }
        }

        // Check if enough days have passed for the next reminder
        if (daysSinceSent < nextReminderDay) {
          console.log(`⏭️ Skipping ${recipient.subcontractor_email} - only ${daysSinceSent} days since sent, need ${nextReminderDay}`)
          continue
        }

        console.log(`📧 Sending reminder #${currentReminderCount + 1} to ${recipient.subcontractor_email}`)

        // Generate job share link (allows viewing all plans for the job)
        let planLink: string | null = null
        const bidPackageId = recipient.bid_package_id
        const jobId = recipient.bid_packages.jobs.id
        
        try {
          // Check if a job share already exists
          const { data: existingShare } = await supabase
            .from('job_shares')
            .select('*')
            .eq('job_id', jobId)
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

            // Get job owner
            const { data: jobData } = await supabase
              .from('jobs')
              .select('user_id')
              .eq('id', jobId)
              .single()

            const { error: shareError } = await supabase
              .from('job_shares')
              .insert({
                job_id: jobId,
                share_token: shareToken,
                created_by: jobData?.user_id,
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

        // Generate reminder email
        const reminderNumber = currentReminderCount + 1
        const emailHtml = generateReminderEmail({
          jobName: recipient.bid_packages.jobs.name,
          jobLocation: recipient.bid_packages.jobs.location,
          tradeCategory: recipient.bid_packages.trade_category,
          deadline: recipient.bid_packages.deadline,
          originalSentDate: recipient.sent_at,
          reminderNumber,
          planLink,
          recipientName: recipient.subcontractor_name,
        })

        const emailSubject = generateReminderSubject(
          recipient.bid_packages.jobs.name,
          recipient.bid_packages.trade_category,
          reminderNumber
        )

        // Send the reminder email
        const { error: sendError } = await resend.emails.send({
          from: 'Bidi <noreply@bidicontracting.com>',
          to: [recipient.subcontractor_email],
          subject: emailSubject,
          html: emailHtml,
          reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`
        })

        if (sendError) {
          console.error(`❌ Failed to send reminder to ${recipient.subcontractor_email}:`, sendError)
          errors.push({ email: recipient.subcontractor_email, error: sendError.message })
          continue
        }

        // Update recipient record
        const { error: updateError } = await supabase
          .from('bid_package_recipients')
          .update({
            reminder_count: reminderNumber,
            last_reminder_sent_at: now.toISOString()
          })
          .eq('id', recipient.id)

        if (updateError) {
          console.error(`❌ Failed to update recipient ${recipient.id}:`, updateError)
          errors.push({ email: recipient.subcontractor_email, error: 'Failed to update reminder count' })
        } else {
          console.log(`✅ Sent reminder #${reminderNumber} to ${recipient.subcontractor_email}`)
          results.push({
            email: recipient.subcontractor_email,
            status: 'sent',
            reminderNumber
          })
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error: any) {
        console.error(`❌ Error processing recipient ${recipient.id}:`, error)
        errors.push({ email: recipient.subcontractor_email, error: error.message })
      }
    }

    console.log(`🏁 Reminder cron job complete. Sent: ${results.length}, Errors: ${errors.length}`)

    return NextResponse.json({
      success: true,
      sent: results.length,
      errors: errors.length,
      results,
      errorDetails: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString()
    })

  } catch (error: any) {
    console.error('❌ Reminder cron job failed:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST handler for manual trigger (useful for testing)
 */
export async function POST(request: NextRequest) {
  // Reuse GET logic for manual triggers
  return GET(request)
}








