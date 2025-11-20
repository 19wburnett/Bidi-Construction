import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

interface RespondRequest {
  recipientId: string
  responseText: string
  quickReplyId?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidPackageId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }


    const body: RespondRequest = await request.json()
    const { recipientId, responseText, quickReplyId } = body

    if (!bidPackageId || !recipientId || !responseText) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientId, responseText' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this bid package
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select(`
        *,
        jobs!inner (
          id,
          name,
          user_id
        )
      `)
      .eq('id', bidPackageId)
      .single()

    const jobUserId = bidPackage?.jobs && (Array.isArray(bidPackage.jobs) ? bidPackage.jobs[0]?.user_id : (bidPackage.jobs as any).user_id)

    if (packageError || !bidPackage || jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Bid package not found or unauthorized' },
        { status: 404 }
      )
    }

    // Get recipient details
    const { data: recipient, error: recipientError } = await supabase
      .from('bid_package_recipients')
      .select('*')
      .eq('id', recipientId)
      .eq('bid_package_id', bidPackageId)
      .single()

    if (recipientError || !recipient) {
      return NextResponse.json(
        { error: 'Recipient not found' },
        { status: 404 }
      )
    }

    // Get quick reply template if provided
    let emailSubject = `Re: ${bidPackage.jobs.name} - Bid Request: ${bidPackage.trade_category}`
    let emailBody = responseText

    if (quickReplyId) {
      const { data: quickReply } = await supabase
        .from('quick_reply_templates')
        .select('subject, body')
        .eq('id', quickReplyId)
        .eq('user_id', user.id)
        .single()

      if (quickReply) {
        emailSubject = quickReply.subject
        emailBody = quickReply.body.replace(/{response}/g, responseText)
      }
    }

    // Send response email
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: 'Bidi <noreply@bidicontracting.com>',
      to: [recipient.subcontractor_email],
      subject: emailSubject,
      html: emailBody.replace(/\n/g, '<br>'),
      reply_to: `bids+${bidPackageId}@bidicontracting.com`
    })

    if (resendError) {
      return NextResponse.json(
        { error: 'Failed to send email', details: resendError.message },
        { status: 500 }
      )
    }

    // Create new recipient record for the response (to track thread)
    const threadId = recipient.thread_id || `thread-${bidPackageId}-${recipient.subcontractor_email}`
    
    await supabase
      .from('bid_package_recipients')
      .insert({
        bid_package_id: bidPackageId,
        subcontractor_id: recipient.subcontractor_id,
        subcontractor_email: recipient.subcontractor_email,
        subcontractor_name: recipient.subcontractor_name,
        resend_email_id: resendData?.id,
        status: 'sent',
        sent_at: new Date().toISOString(),
        thread_id: threadId,
        parent_email_id: recipient.id
      })

    // Ensure thread exists
    await supabase
      .from('email_threads')
      .upsert({
        bid_package_id: bidPackageId,
        subcontractor_email: recipient.subcontractor_email,
        thread_id: threadId
      }, {
        onConflict: 'thread_id'
      })

    return NextResponse.json({
      success: true,
      emailId: resendData?.id
    })

  } catch (error: any) {
    console.error('Error sending response:', error)
    return NextResponse.json(
      { error: 'Failed to send response', details: error.message },
      { status: 500 }
    )
  }
}

