import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { userHasJobAccess } from '@/lib/job-access'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    console.log('📧 [email-statuses] GET request for job:', jobId)
    
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      console.log('📧 [email-statuses] Authentication failed')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('📧 [email-statuses] User authenticated:', user.id)

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this job or has access
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      )
    }

    const isCreator = job.user_id === user.id
    const hasAccess = isCreator || await userHasJobAccess(supabase, jobId, user.id)

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      )
    }

    // Get all bid packages for this job first
    const { data: bidPackages, error: packagesError } = await supabase
      .from('bid_packages')
      .select('id')
      .eq('job_id', jobId)

    if (packagesError) {
      return NextResponse.json(
        { error: 'Failed to fetch bid packages' },
        { status: 500 }
      )
    }

    const packageIds = (bidPackages || []).map(p => p.id)

    if (packageIds.length === 0) {
      return NextResponse.json({ recipients: [] })
    }

    // Get all recipients for all bid packages in this job (including thread messages)
    // Order by created_at to get chronological order
    console.log('📧 [email-statuses] Fetching recipients for package IDs:', packageIds)
    const { data: recipients, error: recipientsError } = await supabase
      .from('bid_package_recipients')
      .select('*')
      .in('bid_package_id', packageIds)
      .order('created_at', { ascending: true }) // Chronological order for threads

    if (recipientsError) {
      console.error('📧 [email-statuses] Error fetching recipients:', recipientsError)
      return NextResponse.json(
        { error: 'Failed to fetch email statuses', details: recipientsError.message },
        { status: 500 }
      )
    }

    console.log('📧 [email-statuses] Found recipients:', recipients?.length || 0)

    // If no recipients, return empty array
    if (!recipients || recipients.length === 0) {
      console.log('📧 [email-statuses] No recipients found, returning empty array')
      return NextResponse.json({ recipients: [] })
    }

    // Get bid packages info separately
    const { data: packagesData } = await supabase
      .from('bid_packages')
      .select('id, trade_category, job_id')
      .in('id', packageIds)

    const packagesMap = new Map((packagesData || []).map(p => [p.id, p]))

    // Get bids for these recipients
    const bidIds = recipients.map(r => r.bid_id).filter(Boolean)
    
    let bidsMap = new Map()
    if (bidIds.length > 0) {
      const { data: bidsData } = await supabase
        .from('bids')
        .select('id, bid_amount, timeline, status, bid_package_id')
        .in('id', bidIds)
      
      if (bidsData) {
        bidsMap = new Map(bidsData.map(b => [b.id, b]))
      }
    }

    // Get subcontractors info
    const subcontractorIds = recipients
      .map(r => r.subcontractor_id)
      .filter(Boolean) as string[]
    
    let subcontractorsMap = new Map()
    if (subcontractorIds.length > 0) {
      const { data: subsData } = await supabase
        .from('subcontractors')
        .select('id, name, email')
        .in('id', subcontractorIds)
      
      if (subsData) {
        subcontractorsMap = new Map(subsData.map(s => [s.id, s]))
      }
    }

    // Build thread structure - group by thread_id
    const threadsMap = new Map<string, any[]>()
    
    // Helper function to fetch email content from Resend API
    async function fetchEmailContentFromResend(resendEmailId: string): Promise<string | null> {
      if (!resendEmailId) return null
      
      try {
        console.log('📧 [email-statuses] Fetching email content from Resend for:', resendEmailId)
        const response = await fetch(`https://api.resend.com/emails/${resendEmailId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const emailData = await response.json()
          // Extract text content from HTML or use text field
          let textContent = emailData.text || ''
          
          if (!textContent && emailData.html) {
            // Strip HTML tags to get plain text
            textContent = emailData.html
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
          
          console.log('📧 [email-statuses] Fetched content length:', textContent?.length || 0)
          return textContent || null
        } else {
          const errorText = await response.text()
          console.error('❌ [email-statuses] Failed to fetch from Resend:', response.status, errorText)
          return null
        }
      } catch (error: any) {
        console.error('❌ [email-statuses] Error fetching from Resend:', error.message)
        return null
      }
    }
    
    // First, enrich all recipients with related data
    // For GC messages missing response_text, fetch from Resend API
    const enrichedRecipients = await Promise.all(recipients.map(async (recipient) => {
      const isFromGC = recipient.is_from_gc !== undefined ? recipient.is_from_gc : !!(recipient.resend_email_id && recipient.status === 'sent')
      
      // If this is a GC message without response_text, try to fetch from Resend
      let responseText = recipient.response_text
      if (isFromGC && !responseText && recipient.resend_email_id) {
        console.log('📧 [email-statuses] GC message missing response_text, fetching from Resend:', recipient.resend_email_id)
        const fetchedContent = await fetchEmailContentFromResend(recipient.resend_email_id)
        if (fetchedContent) {
          responseText = fetchedContent
          // Update the database with the fetched content (async, don't wait)
          supabase
            .from('bid_package_recipients')
            .update({ response_text: fetchedContent })
            .eq('id', recipient.id)
            .then(({ error }) => {
              if (error) {
                console.error('❌ [email-statuses] Failed to update response_text:', error)
              } else {
                console.log('✅ [email-statuses] Updated response_text for recipient:', recipient.id)
              }
            })
        }
      }
      
      const enriched = {
        ...recipient,
        response_text: responseText, // Use fetched content if available
        bid_packages: packagesMap.get(recipient.bid_package_id) || null,
        subcontractors: recipient.subcontractor_id ? subcontractorsMap.get(recipient.subcontractor_id) || null : null,
        bids: recipient.bid_id ? [bidsMap.get(recipient.bid_id)].filter(Boolean) : [],
        // Mark sender type: use is_from_gc field if available, otherwise infer from resend_email_id and status
        isFromGC,
        // Use sent_at for GC messages, responded_at for subcontractor messages
        messageTimestamp: recipient.responded_at || recipient.sent_at || recipient.created_at
      }
      
      // Log response_text for debugging
      if (enriched.isFromGC) {
        console.log('📧 [email-statuses] GC message:', {
          id: recipient.id,
          status: recipient.status,
          hasResponseText: !!enriched.response_text,
          responseTextLength: enriched.response_text?.length || 0,
          responseTextPreview: enriched.response_text?.substring(0, 100) || 'null',
          isFromGC: enriched.isFromGC,
          resendEmailId: recipient.resend_email_id,
          wasFetched: !recipient.response_text && !!enriched.response_text
        })
      }
      
      // Group by thread_id (use original recipient ID as thread key if no thread_id)
      const threadKey = recipient.thread_id || `thread-${recipient.bid_package_id}-${recipient.subcontractor_email}`
      
      if (!threadsMap.has(threadKey)) {
        threadsMap.set(threadKey, [])
      }
      threadsMap.get(threadKey)!.push(enriched)
      
      return enriched
    }))

    // Build thread structure - for each thread, get all messages
    const threadStructures: any[] = []
    
    threadsMap.forEach((messages, threadId) => {
      // Sort messages by timestamp
      messages.sort((a, b) => {
        const timeA = new Date(a.messageTimestamp || a.created_at).getTime()
        const timeB = new Date(b.messageTimestamp || b.created_at).getTime()
        return timeA - timeB
      })
      
      // Find the original email (parent_email_id is null)
      const originalEmail = messages.find(m => m.parent_email_id === null)
      
      if (originalEmail) {
        // Add thread with all messages
        threadStructures.push({
          thread_id: threadId,
          original_email: originalEmail,
          messages: messages,
          latest_message: messages[messages.length - 1],
          message_count: messages.length
        })
      } else {
        // No original found, use first message as original
        threadStructures.push({
          thread_id: threadId,
          original_email: messages[0],
          messages: messages,
          latest_message: messages[messages.length - 1],
          message_count: messages.length
        })
      }
    })

    // Return both flat list (for backward compatibility) and thread structure
    // The UI can use the flat list and build threads client-side, or use the thread structure
    console.log('📧 [email-statuses] Returning data:', {
      recipientsCount: enrichedRecipients.length,
      threadsCount: threadStructures.length
    })
    
    // Log status breakdown for debugging
    const statusBreakdown: Record<string, number> = {}
    enrichedRecipients.forEach((r: any) => {
      statusBreakdown[r.status] = (statusBreakdown[r.status] || 0) + 1
    })
    console.log('📧 [email-statuses] Status breakdown:', statusBreakdown)
    
    // Log thread latest message statuses
    threadStructures.forEach((thread: any) => {
      console.log(`📧 [email-statuses] Thread ${thread.thread_id}: ${thread.message_count} messages, latest status: ${thread.latest_message?.status}, latest opened_at: ${thread.latest_message?.opened_at}`)
    })
    
    return NextResponse.json({ 
      recipients: enrichedRecipients,
      threads: threadStructures
    })

  } catch (error: any) {
    console.error('Error fetching email statuses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email statuses', details: error.message },
      { status: 500 }
    )
  }
}

