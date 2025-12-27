import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user (admin)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin, role')
      .eq('id', user.id)
      .single()

    if (userError || (!userData?.is_admin && userData?.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { quoteRequestId, quotePdfPath } = body

    if (!quoteRequestId || !quotePdfPath) {
      return NextResponse.json({ 
        error: 'Missing required fields: quoteRequestId, quotePdfPath' 
      }, { status: 400 })
    }

    // Get quote request details
    const { data: quoteRequest, error: quoteError } = await supabase
      .from('quote_requests')
      .select(`
        *,
        plans(title, file_name),
        users!inner(email)
      `)
      .eq('id', quoteRequestId)
      .single()

    if (quoteError || !quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found' }, { status: 404 })
    }

    // Get user email
    const userEmail = Array.isArray(quoteRequest.users) 
      ? quoteRequest.users[0]?.email 
      : (quoteRequest.users as any)?.email

    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 })
    }

    // Create signed URL for PDF download (valid for 7 days)
    const pathParts = quotePdfPath.split('/')
    const filePath = pathParts.slice(1).join('/') // Remove bucket name

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('quote-pdfs')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7) // 7 days

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Error creating signed URL:', signedUrlError)
      // Continue anyway, we'll provide a link to the dashboard
    }

    const planTitle = (quoteRequest.plans as any)?.title || (quoteRequest.plans as any)?.file_name || 'Your Plan'
    const downloadUrl = signedUrlData?.signedUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.bidicontracting.com'}/dashboard/quotes`

    // Send email notification
    try {
      const { data, error } = await resend.emails.send({
        from: 'BIDI <noreply@savewithbidi.com>',
        to: userEmail,
        subject: `✅ Your Quote is Ready - ${planTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f97316; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Bidi</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Construction Marketplace</p>
            </div>
            
            <div style="padding: 30px; background-color: #f8fafc;">
              <h2 style="color: #1e293b; margin-bottom: 20px;">✅ Your Quote is Ready!</h2>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #16a34a;">
                <h3 style="color: #16a34a; margin-top: 0;">Quote Completed</h3>
                <p><strong>Plan:</strong> ${planTitle}</p>
                <p><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <div style="background-color: #dcfce7; border: 1px solid #16a34a; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="color: #16a34a; margin-top: 0;">📄 Your Quote PDF</h4>
                <p style="margin: 10px 0; line-height: 1.6;">
                  Your professional quote PDF is ready to download and send to your clients.
                </p>
              </div>

              <div style="margin-top: 20px; text-align: center;">
                <a href="${downloadUrl}" 
                   style="display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 10px;">
                  Download Quote PDF
                </a>
                <br />
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.bidicontracting.com'}/dashboard/quotes" 
                   style="display: inline-block; color: #3b82f6; padding: 8px 16px; text-decoration: none;">
                  View All Quote Requests
                </a>
              </div>

              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
                  <strong>Note:</strong> The download link is valid for 7 days. You can also access your quotes anytime from your dashboard.
                </p>
              </div>
            </div>
            
            <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
              <p style="margin: 0; font-size: 14px;">
                © 2024 BIDI. All rights reserved.
              </p>
              <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
                This is an automated notification from the BIDI platform.
              </p>
            </div>
          </div>
        `,
      })

      if (error) {
        console.error('Failed to send quote completion notification:', error)
        throw error
      }

      console.log(`Quote completion notification sent to ${userEmail}`)
      return NextResponse.json({ 
        success: true,
        message: 'Notification sent successfully'
      })

    } catch (error) {
      console.error('Error sending quote completion notification:', error)
      return NextResponse.json(
        { error: 'Failed to send notification' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error in notify-complete:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

