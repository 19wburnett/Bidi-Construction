import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * Mark an email recipient record as read by the GC
 * This is called when the user views an incoming email message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recipientId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!recipientId) {
      return NextResponse.json(
        { error: 'Recipient ID required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get the recipient to verify access
    // First try without join to see if recipient exists at all
    const { data: recipientExists, error: checkError } = await supabase
      .from('bid_package_recipients')
      .select('id, bid_package_id, is_from_gc')
      .eq('id', recipientId)
      .single()

    if (checkError || !recipientExists) {
      console.error('Recipient not found:', { recipientId, error: checkError })
      return NextResponse.json(
        { error: 'Recipient not found', recipientId },
        { status: 404 }
      )
    }

    // Verify access by manually joining bid_packages and jobs
    // (Don't rely on foreign key relationship syntax which may not exist)
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select('id, job_id')
      .eq('id', recipientExists.bid_package_id)
      .single()

    if (packageError || !bidPackage) {
      console.error('Bid package not found:', { 
        recipientId, 
        bidPackageId: recipientExists.bid_package_id,
        error: packageError 
      })
      return NextResponse.json(
        { error: 'Bid package not found', recipientId },
        { status: 404 }
      )
    }

    // Verify user has access to this job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, user_id')
      .eq('id', bidPackage.job_id)
      .single()

    if (jobError || !job) {
      console.error('Job not found:', { 
        recipientId, 
        jobId: bidPackage.job_id,
        error: jobError 
      })
      return NextResponse.json(
        { error: 'Job not found', recipientId },
        { status: 404 }
      )
    }

    if (job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Only mark incoming emails as read (not GC-sent emails)
    // If it's already read, no need to update
    if (recipientExists.is_from_gc) {
      return NextResponse.json({ 
        success: true, 
        message: 'GC-sent emails do not need read tracking' 
      })
    }

    // Mark as read (only if not already read)
    const { error: updateError } = await supabase
      .from('bid_package_recipients')
      .update({ 
        read_by_gc_at: new Date().toISOString() 
      })
      .eq('id', recipientId)
      .is('read_by_gc_at', null) // Only update if not already read

    if (updateError) {
      console.error('Error marking recipient as read:', updateError)
      return NextResponse.json(
        { error: 'Failed to mark as read', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      read_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error marking recipient as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark as read', details: error.message },
      { status: 500 }
    )
  }
}

