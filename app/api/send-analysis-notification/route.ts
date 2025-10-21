import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication (admin only)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId, type, userEmail } = await request.json()

    if (!planId || !type || !userEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('title, file_name, project_name')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const analysisType = type === 'takeoff' ? 'Takeoff Analysis' : 'Quality Check'
    const planTitle = plan.title || plan.file_name
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.bidicontracting.com'

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'Bidi Construction <notifications@bidicontracting.com>',
      to: userEmail,
      subject: `${analysisType} Complete: ${planTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f97316; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Your ${analysisType} is Ready!</h1>
            </div>
            
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Great news! We've completed the ${type === 'takeoff' ? 'AI-powered takeoff analysis' : 'AI quality check'} for your construction plan:
              </p>
              
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #f97316;">
                <h2 style="margin: 0 0 5px 0; font-size: 18px; color: #f97316;">${planTitle}</h2>
                ${plan.project_name ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">${plan.project_name}</p>` : ''}
              </div>

              <p style="font-size: 14px; margin-bottom: 20px;">
                ${type === 'takeoff' 
                  ? 'Our AI has analyzed your plans and extracted detailed quantity takeoffs, measurements, and material estimates.' 
                  : 'Our AI has reviewed your plans for completeness, compliance, and potential quality issues.'}
              </p>

              <a href="${appUrl}/dashboard/plans/${planId}" 
                 style="display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 20px;">
                View ${type === 'takeoff' ? 'Takeoff' : 'Quality'} Results
              </a>

              <p style="font-size: 12px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                Questions? Reply to this email or contact us at support@bidicontracting.com
              </p>
            </div>
          </body>
        </html>
      `
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: data?.id })

  } catch (error) {
    console.error('Error sending notification:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}


