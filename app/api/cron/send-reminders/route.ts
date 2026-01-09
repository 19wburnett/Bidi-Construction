import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { 
  generateReminderEmail, 
  generateReminderSubject,
  generateDeadlineReminderEmail,
  generateDeadlineReminderSubject
} from '@/lib/email-templates/reminder'

export const runtime = 'nodejs'
// Allow up to 5 minutes for the cron job to complete
export const maxDuration = 300

const resend = new Resend(process.env.RESEND_API_KEY)

// Default reminder schedules
const DEFAULT_NO_RESPONSE_DAYS = [3, 7, 14]
const DEFAULT_DEADLINE_REMINDER_DAYS = [7, 3, 1]

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
    
    // Find recipients who need no-response reminders
    // Criteria:
    // - Status is 'sent', 'delivered', or 'opened' (not responded/bounced/failed)
    // - Has been sent (sent_at is not null)
    // - Has not responded (status is not 'responded')
    
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
          job_id,
          jobs (
            id,
            name,
            location,
            user_id
          )
        )
      `)
      .in('status', ['sent', 'delivered', 'opened'])
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

    const results: { email: string; status: string; reminderNumber?: number; reminderType: 'no_response' | 'deadline'; daysUntilDeadline?: number }[] = []
    const errors: { email: string; error: string }[] = []

    // Helper function to get automation settings for a bid package
    const getAutomationSettings = async (bidPackageId: string, userId: string) => {
      // Get package-specific automation settings
      const { data: packageAutomation } = await supabase
        .from('bid_package_automations')
        .select('*')
        .eq('bid_package_id', bidPackageId)
        .maybeSingle()

      // Get global user defaults
      const { data: userData } = await supabase
        .from('users')
        .select('email_automation_settings')
        .eq('id', userId)
        .single()

      const globalDefaults = userData?.email_automation_settings || {
        no_response_enabled: true,
        no_response_days: DEFAULT_NO_RESPONSE_DAYS,
        deadline_reminder_enabled: true,
        deadline_reminder_days: DEFAULT_DEADLINE_REMINDER_DAYS
      }

      return {
        no_response_enabled: packageAutomation?.no_response_enabled ?? globalDefaults.no_response_enabled,
        no_response_days: packageAutomation?.no_response_days ?? globalDefaults.no_response_days,
        deadline_reminder_enabled: packageAutomation?.deadline_reminder_enabled ?? globalDefaults.deadline_reminder_enabled,
        deadline_reminder_days: packageAutomation?.deadline_reminder_days ?? globalDefaults.deadline_reminder_days
      }
    }

    // Helper function to generate plan link
    const generatePlanLink = async (jobId: string) => {
      try {
        const { data: existingShare } = await supabase
          .from('job_shares')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let shareToken: string

        if (existingShare && (!existingShare.expires_at || new Date(existingShare.expires_at) > new Date())) {
          shareToken = existingShare.share_token
        } else {
          shareToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 30)

          const { data: jobData } = await supabase
            .from('jobs')
            .select('user_id')
            .eq('id', jobId)
            .single()

          await supabase
            .from('job_shares')
            .insert({
              job_id: jobId,
              share_token: shareToken,
              created_by: jobData?.user_id,
              expires_at: expiresAt.toISOString()
            })
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
        return `${baseUrl}/share/jobs/${shareToken}`
      } catch (error) {
        console.error('❌ Error generating job share link:', error)
        return null
      }
    }

    for (const recipient of recipients) {
      try {
        const bidPackageId = recipient.bid_package_id
        const jobId = recipient.bid_packages?.job_id || recipient.bid_packages?.jobs?.id
        const userId = recipient.bid_packages?.jobs?.user_id

        if (!jobId || !userId) {
          console.log(`⏭️ Skipping ${recipient.subcontractor_email} - missing job or user info`)
          continue
        }

        // Get automation settings
        const automationSettings = await getAutomationSettings(bidPackageId, userId)

        // Process NO-RESPONSE reminders
        if (automationSettings.no_response_enabled) {
          const noResponseDays = automationSettings.no_response_days || DEFAULT_NO_RESPONSE_DAYS
          const currentReminderCount = recipient.reminder_count || 0
          
          // Check if there's a next reminder day configured
          if (currentReminderCount < noResponseDays.length) {
            const sentDate = new Date(recipient.sent_at)
            const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
            const nextReminderDay = noResponseDays[currentReminderCount]

            // Check if we should wait based on last reminder
            if (recipient.last_reminder_sent_at) {
              const lastReminderDate = new Date(recipient.last_reminder_sent_at)
              const daysSinceLastReminder = Math.floor((now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60 * 24))
              
              // Don't send reminders more than once per day
              if (daysSinceLastReminder < 1) {
                // Skip no-response reminder, but continue to check deadline reminders
              } else if (daysSinceSent >= nextReminderDay) {
                // Send no-response reminder
                console.log(`📧 Sending no-response reminder #${currentReminderCount + 1} to ${recipient.subcontractor_email}`)
                
                const planLink = await generatePlanLink(jobId)
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

                const { error: sendError } = await resend.emails.send({
                  from: 'Bidi <noreply@bidicontracting.com>',
                  to: [recipient.subcontractor_email],
                  subject: emailSubject,
                  html: emailHtml,
                  reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`
                })

                if (sendError) {
                  console.error(`❌ Failed to send no-response reminder to ${recipient.subcontractor_email}:`, sendError)
                  errors.push({ email: recipient.subcontractor_email, error: sendError.message })
                } else {
                  await supabase
                    .from('bid_package_recipients')
                    .update({
                      reminder_count: reminderNumber,
                      last_reminder_sent_at: now.toISOString()
                    })
                    .eq('id', recipient.id)

                  results.push({
                    email: recipient.subcontractor_email,
                    status: 'sent',
                    reminderNumber,
                    reminderType: 'no_response'
                  })
                  console.log(`✅ Sent no-response reminder #${reminderNumber} to ${recipient.subcontractor_email}`)
                }

                await new Promise(resolve => setTimeout(resolve, 300))
              }
            } else if (daysSinceSent >= nextReminderDay) {
              // Send first reminder (no last_reminder_sent_at)
              console.log(`📧 Sending no-response reminder #${currentReminderCount + 1} to ${recipient.subcontractor_email}`)
              
              const planLink = await generatePlanLink(jobId)
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

              const { error: sendError } = await resend.emails.send({
                from: 'Bidi <noreply@bidicontracting.com>',
                to: [recipient.subcontractor_email],
                subject: emailSubject,
                html: emailHtml,
                reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`
              })

              if (sendError) {
                console.error(`❌ Failed to send no-response reminder to ${recipient.subcontractor_email}:`, sendError)
                errors.push({ email: recipient.subcontractor_email, error: sendError.message })
              } else {
                await supabase
                  .from('bid_package_recipients')
                  .update({
                    reminder_count: reminderNumber,
                    last_reminder_sent_at: now.toISOString()
                  })
                  .eq('id', recipient.id)

                results.push({
                  email: recipient.subcontractor_email,
                  status: 'sent',
                  reminderNumber,
                  reminderType: 'no_response'
                })
                console.log(`✅ Sent no-response reminder #${reminderNumber} to ${recipient.subcontractor_email}`)
              }

              await new Promise(resolve => setTimeout(resolve, 300))
            }
          }
        }

        // Process DEADLINE reminders
        if (automationSettings.deadline_reminder_enabled && recipient.bid_packages?.deadline) {
          const deadlineDate = new Date(recipient.bid_packages.deadline)
          const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          
          // Only send reminders if deadline is in the future
          if (daysUntilDeadline > 0) {
            const deadlineReminderDays = automationSettings.deadline_reminder_days || DEFAULT_DEADLINE_REMINDER_DAYS
            const remindersSent = recipient.deadline_reminders_sent || []
            
            // Check if we should send a reminder for this day
            const shouldRemind = deadlineReminderDays.includes(daysUntilDeadline) && !remindersSent.includes(daysUntilDeadline)
            
            if (shouldRemind) {
              console.log(`📧 Sending deadline reminder (${daysUntilDeadline} days before) to ${recipient.subcontractor_email}`)
              
              const planLink = await generatePlanLink(jobId)
              const emailHtml = generateDeadlineReminderEmail({
                jobName: recipient.bid_packages.jobs.name,
                jobLocation: recipient.bid_packages.jobs.location,
                tradeCategory: recipient.bid_packages.trade_category,
                deadline: recipient.bid_packages.deadline,
                daysUntilDeadline,
                planLink,
                recipientName: recipient.subcontractor_name,
              })

              const emailSubject = generateDeadlineReminderSubject(
                recipient.bid_packages.jobs.name,
                recipient.bid_packages.trade_category,
                daysUntilDeadline
              )

              const { error: sendError } = await resend.emails.send({
                from: 'Bidi <noreply@bidicontracting.com>',
                to: [recipient.subcontractor_email],
                subject: emailSubject,
                html: emailHtml,
                reply_to: `bids+${bidPackageId}@bids.bidicontracting.com`
              })

              if (sendError) {
                console.error(`❌ Failed to send deadline reminder to ${recipient.subcontractor_email}:`, sendError)
                errors.push({ email: recipient.subcontractor_email, error: sendError.message })
              } else {
                // Update deadline reminder tracking
                const updatedRemindersSent = [...remindersSent, daysUntilDeadline]
                await supabase
                  .from('bid_package_recipients')
                  .update({
                    deadline_reminder_count: (recipient.deadline_reminder_count || 0) + 1,
                    last_deadline_reminder_sent_at: now.toISOString(),
                    deadline_reminders_sent: updatedRemindersSent
                  })
                  .eq('id', recipient.id)

                results.push({
                  email: recipient.subcontractor_email,
                  status: 'sent',
                  reminderType: 'deadline',
                  daysUntilDeadline
                })
                console.log(`✅ Sent deadline reminder (${daysUntilDeadline} days before) to ${recipient.subcontractor_email}`)
              }

              await new Promise(resolve => setTimeout(resolve, 300))
            }
          }
        }

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








