import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Send email notification to admin users about a new quote request
 * Reuses the pattern from sendAdminQueueNotification
 */
async function sendAdminQuoteNotification(
  supabase: any,
  quoteRequestId: string,
  planId: string,
  userEmail: string,
  userName: string,
  planTitle: string,
  workDescription: string,
  knownPricing: any
) {
  // Get all admin email addresses - check both role = 'admin' OR is_admin = true
  const { data: admins, error: adminError } = await supabase
    .from('users')
    .select('email')
    .or('role.eq.admin,is_admin.eq.true')

  let adminEmails: string[] = []
  
  if (adminError) {
    console.error('Error querying admin users:', adminError)
    // Continue to fallback email
  } else if (admins && admins.length > 0) {
    adminEmails = admins.map((admin: any) => admin.email).filter(Boolean)
  }
  
  // Always include fallback email for safety
  const fallbackEmail = 'savewithbidi@gmail.com'
  if (!adminEmails.includes(fallbackEmail)) {
    adminEmails.push(fallbackEmail)
  }
  
  if (adminEmails.length === 0) {
    console.warn('No admin emails found, using fallback only')
    adminEmails = [fallbackEmail]
  }
  
  console.log(`Sending quote notification to ${adminEmails.length} email(s):`, adminEmails)

  // Format known pricing for display
  let pricingDisplay = 'None provided'
  if (knownPricing) {
    if (typeof knownPricing === 'object' && knownPricing.text) {
      pricingDisplay = knownPricing.text
    } else if (typeof knownPricing === 'object') {
      pricingDisplay = JSON.stringify(knownPricing, null, 2)
    } else {
      pricingDisplay = String(knownPricing)
    }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Bidi <noreply@savewithbidi.com>',
      to: adminEmails,
      subject: `🔔 New Subcontractor Quote Request`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f97316; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Bidi</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Construction Marketplace</p>
          </div>
          
          <div style="padding: 30px; background-color: #f8fafc;">
            <h2 style="color: #1e293b; margin-bottom: 20px;">🔔 New Subcontractor Quote Request</h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f97316;">
              <h3 style="color: #f97316; margin-top: 0;">Request Details</h3>
              <p><strong>Quote Request ID:</strong> ${quoteRequestId}</p>
              <p><strong>Plan ID:</strong> ${planId}</p>
              <p><strong>Plan Title:</strong> ${planTitle}</p>
              <p><strong>Requested by:</strong> ${userName} (${userEmail})</p>
              <p><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #3b82f6; margin-top: 0;">Work Description</h3>
              <p style="white-space: pre-wrap; line-height: 1.6;">${workDescription || 'No description provided'}</p>
            </div>

            ${knownPricing ? `
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #16a34a;">
              <h3 style="color: #16a34a; margin-top: 0;">Known Pricing</h3>
              <pre style="background-color: #f1f5f9; padding: 10px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; font-size: 12px;">${pricingDisplay}</pre>
            </div>
            ` : ''}

            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="color: #f59e0b; margin-top: 0;">⚠️ Action Required</h4>
              <p style="margin: 10px 0; line-height: 1.6;">
                A subcontractor has submitted a quote request. This requires manual processing.
                Please review the plan, generate a quote PDF, and upload it to complete the request.
              </p>
            </div>

            <div style="background-color: #dcfce7; border: 1px solid #16a34a; padding: 20px; border-radius: 8px;">
              <h4 style="color: #16a34a; margin-top: 0;">📋 Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                <li>Review the quote request in the admin dashboard</li>
                <li>View the uploaded plan</li>
                <li>Generate a professional PDF quote</li>
                <li>Upload the PDF and mark the request as completed</li>
                <li>The subcontractor will be automatically notified when complete</li>
                <li>Estimated processing time: 1 business day</li>
              </ul>
            </div>

            <div style="margin-top: 20px; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.bidicontracting.com'}/admin/quotes" 
                 style="display: inline-block; background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Quote Request in Admin Dashboard
              </a>
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
      console.error('Failed to send admin quote notification:', error)
      throw error
    }

    console.log(`Admin quote notification sent to ${adminEmails.length} admin(s)`)
    return data
  } catch (error) {
    console.error('Error sending admin quote notification:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quoteRequestId, planId } = body

    if (!quoteRequestId || !planId) {
      return NextResponse.json({ 
        error: 'Missing required fields: quoteRequestId, planId' 
      }, { status: 400 })
    }

    // Get quote request details
    const { data: quoteRequest, error: quoteError } = await supabase
      .from('quote_requests')
      .select('*, plans(title, file_name), users(email)')
      .eq('id', quoteRequestId)
      .eq('user_id', user.id)
      .single()

    if (quoteError || !quoteRequest) {
      return NextResponse.json({ error: 'Quote request not found' }, { status: 404 })
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update admin_notified_at timestamp
    await supabase
      .from('quote_requests')
      .update({ admin_notified_at: new Date().toISOString() })
      .eq('id', quoteRequestId)

    // Send admin notification email
    const planTitle = (quoteRequest.plans as any)?.title || (quoteRequest.plans as any)?.file_name || 'Untitled Plan'
    const workDescription = quoteRequest.work_description || ''
    const knownPricing = quoteRequest.known_pricing

    await sendAdminQuoteNotification(
      supabase,
      quoteRequestId,
      planId,
      userData.email,
      user.email || 'Unknown',
      planTitle,
      workDescription,
      knownPricing
    )

    return NextResponse.json({ 
      success: true,
      message: 'Quote request submitted and admins notified'
    })

  } catch (error) {
    console.error('Error submitting quote request:', error)
    return NextResponse.json(
      { error: 'Failed to submit quote request' },
      { status: 500 }
    )
  }
}

