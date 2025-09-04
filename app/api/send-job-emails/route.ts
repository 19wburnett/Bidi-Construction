import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { jobRequestId, tradeCategory, location } = await request.json()

    if (!jobRequestId || !tradeCategory || !location) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get job request details
    const { data: jobRequest, error: jobError } = await supabase
      .from('job_requests')
      .select('*')
      .eq('id', jobRequestId)
      .single()

    if (jobError || !jobRequest) {
      return NextResponse.json(
        { error: 'Job request not found' },
        { status: 404 }
      )
    }

    // Get subcontractors in the same trade and location
    const { data: subcontractors, error: subError } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('trade_category', tradeCategory)
      .ilike('location', `%${location}%`)

    if (subError) {
      console.error('Error fetching subcontractors:', subError)
      return NextResponse.json(
        { error: 'Failed to fetch subcontractors' },
        { status: 500 }
      )
    }

    if (!subcontractors || subcontractors.length === 0) {
      return NextResponse.json(
        { message: 'No subcontractors found for this trade and location' },
        { status: 200 }
      )
    }

    // Send emails to all matching subcontractors
    const emailPromises = subcontractors.map(async (sub) => {
      try {
        const { data, error } = await resend.emails.send({
          from: 'SubBidi <noreply@subbidi.com>',
          to: [sub.email],
          subject: `New ${tradeCategory} Job Opportunity in ${location}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">SubBidi</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Construction Marketplace</p>
              </div>
              
              <div style="padding: 30px; background-color: #f8fafc;">
                <h2 style="color: #1e293b; margin-bottom: 20px;">New Job Opportunity</h2>
                
                <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                  <h3 style="color: #3b82f6; margin-top: 0;">Project Details</h3>
                  <p><strong>Trade:</strong> ${tradeCategory}</p>
                  <p><strong>Location:</strong> ${location}</p>
                  <p><strong>Budget Range:</strong> ${jobRequest.budget_range}</p>
                  <p><strong>Description:</strong></p>
                  <div style="background-color: #f1f5f9; padding: 15px; border-radius: 4px; margin-top: 10px;">
                    ${jobRequest.description.replace(/\n/g, '<br>')}
                  </div>
                </div>

                <div style="background-color: #dcfce7; border: 1px solid #16a34a; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                  <h4 style="color: #16a34a; margin-top: 0;">How to Submit Your Bid</h4>
                  <p style="margin-bottom: 10px;">Reply to this email with:</p>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li>Your company name and contact information</li>
                    <li>Proposed bid amount</li>
                    <li>Project timeline</li>
                    <li>Any additional notes or questions</li>
                    <li>Attach any relevant files (quotes, certifications, etc.)</li>
                  </ul>
                </div>

                <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px;">
                  <h4 style="color: #f59e0b; margin-top: 0;">Important Notes</h4>
                  <ul style="margin: 0; padding-left: 20px;">
                    <li>This is an automated message from SubBidi</li>
                    <li>Reply directly to this email to submit your bid</li>
                    <li>Include all relevant project details in your response</li>
                    <li>The general contractor will review all bids and contact you directly</li>
                  </ul>
                </div>
              </div>
              
              <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 14px;">
                  © 2024 SubBidi. All rights reserved.
                </p>
                <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
                  This email was sent to ${sub.email} because you're registered as a ${tradeCategory} subcontractor in ${location}.
                </p>
              </div>
            </div>
          `,
        })

        if (error) {
          console.error(`Failed to send email to ${sub.email}:`, error)
          return { success: false, email: sub.email, error }
        }

        return { success: true, email: sub.email, data }
      } catch (error) {
        console.error(`Error sending email to ${sub.email}:`, error)
        return { success: false, email: sub.email, error }
      }
    })

    const results = await Promise.all(emailPromises)
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      message: `Emails sent to ${successful} subcontractors`,
      successful,
      failed,
      total: subcontractors.length,
    })
  } catch (error) {
    console.error('Error in send-job-emails:', error)
    return NextResponse.json(
      { error: 'Failed to send job emails' },
      { status: 500 }
    )
  }
}
