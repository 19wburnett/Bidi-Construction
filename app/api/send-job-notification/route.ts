import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { jobRequestId, tradeCategory, location, description, budgetRange, gcEmail } = await request.json()

    if (!jobRequestId || !tradeCategory || !location || !description || !budgetRange || !gcEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get authenticated user with automatic session refresh
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', details: authError instanceof Error ? authError.message : 'Unknown auth error' },
        { status: 401 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get job request details to verify it exists
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

    // Send notification email to admin
    const { data, error } = await resend.emails.send({
      from: 'Bidi <noreply@savewithbidi.com>',
      to: ['savewithbidi@gmail.com'],
      subject: `New Job Posted: ${tradeCategory} in ${location}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Bidi</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Construction Marketplace</p>
          </div>
          
          <div style="padding: 30px; background-color: #f8fafc;">
            <h2 style="color: #1e293b; margin-bottom: 20px;">🔔 New Job Posted</h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #3b82f6; margin-top: 0;">Job Details</h3>
              <p><strong>Job ID:</strong> ${jobRequestId}</p>
              <p><strong>Trade Category:</strong> ${tradeCategory}</p>
              <p><strong>Location:</strong> ${location}</p>
              <p><strong>Budget Range:</strong> ${budgetRange}</p>
              <p><strong>Posted by:</strong> ${gcEmail}</p>
              <p><strong>Posted at:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="color: #1e293b; margin-top: 0;">Project Description</h4>
              <div style="background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
                ${description.replace(/\n/g, '<br>')}
              </div>
            </div>

            <div style="background-color: #dcfce7; border: 1px solid #16a34a; padding: 20px; border-radius: 8px;">
              <h4 style="color: #16a34a; margin-top: 0;">📋 Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                <li>Job has been posted and is collecting bids</li>
                <li>Subcontractors will be notified via email</li>
                <li>Monitor the job dashboard for incoming bids</li>
                <li>Review bids and select the best contractor</li>
              </ul>
            </div>
          </div>
          
          <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">
              © 2024 Bidi. All rights reserved.
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
              This is an automated notification from the Bidi platform.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send notification email:', error)
      return NextResponse.json(
        { error: 'Failed to send notification email' },
        { status: 500 }
      )
    }

    console.log('Notification email sent successfully to savewithbidi@gmail.com')

    return NextResponse.json({
      message: 'Notification email sent successfully',
      emailId: data?.id
    })

  } catch (error) {
    console.error('Error sending notification email:', error)
    return NextResponse.json(
      { error: 'Failed to send notification email' },
      { status: 500 }
    )
  }
}
