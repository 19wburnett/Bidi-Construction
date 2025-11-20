import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { bidId, documents } = body

    console.log('Accept bid request:', { bidId, documentsCount: documents?.length })

    if (!bidId) {
      return NextResponse.json(
        { error: 'Bid ID is required' },
        { status: 400 }
      )
    }

    // Fetch the bid to verify ownership and get job_id
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select('id, job_id, bid_package_id, status, subcontractors (name, email)')
      .eq('id', bidId)
      .single()
    
    console.log('Bid query result:', { bid, bidError, bidErrorCode: bidError?.code, bidErrorDetails: bidError?.details })

    if (bidError) {
      console.error('Error fetching bid:', bidError)
      return NextResponse.json(
        { error: `Database error: ${bidError.message}` },
        { status: 500 }
      )
    }

    if (!bid) {
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      )
    }

    // Get job_id from bid or from bid_package
    let jobId = bid.job_id
    if (!jobId && bid.bid_package_id) {
      const { data: bidPackage } = await supabase
        .from('bid_packages')
        .select('job_id')
        .eq('id', bid.bid_package_id)
        .single()
      jobId = bidPackage?.job_id
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Bid is not associated with a job' },
        { status: 400 }
      )
    }

    // Verify the user has access to this job (owner or member)
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('role')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('Error fetching job:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify the user owns this job or is a member
    if (!jobMember && job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - You do not have access to this job' },
        { status: 403 }
      )
    }

    // Check if bid is already accepted or declined (only if status column exists)
    if (bid.status && bid.status !== 'pending') {
      return NextResponse.json(
        { error: `This bid has already been ${bid.status}` },
        { status: 400 }
      )
    }

    // Update bid status to accepted
    const { error: updateError } = await supabase
      .from('bids')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', bidId)

    if (updateError) {
      console.error('Error accepting bid:', updateError)
      return NextResponse.json(
        { error: 'Failed to accept bid' },
        { status: 500 }
      )
    }

    // Upload documents if provided
    if (documents && documents.length > 0) {
      const documentRecords = documents.map((doc: any) => ({
        bid_id: bidId,
        job_id: jobId,
        document_type: doc.type,
        file_name: doc.fileName,
        file_url: doc.fileUrl,
        uploaded_by: user.id
      }))

      const { error: docsError } = await supabase
        .from('accepted_bid_documents')
        .insert(documentRecords)

      if (docsError) {
        console.error('Error uploading documents:', docsError)
        // Don't fail the whole operation, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bid accepted successfully',
      bidId
    })

  } catch (error: any) {
    console.error('Error in accept bid API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
