import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job || job.user_id !== user.id) {
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

    // Get all recipients for all bid packages in this job
    // First, get recipients without joins to test
    const { data: recipients, error: recipientsError } = await supabase
      .from('bid_package_recipients')
      .select('*')
      .in('bid_package_id', packageIds)
      .order('created_at', { ascending: false })

    if (recipientsError) {
      console.error('Error fetching recipients:', recipientsError)
      return NextResponse.json(
        { error: 'Failed to fetch email statuses', details: recipientsError.message },
        { status: 500 }
      )
    }

    // If no recipients, return empty array
    if (!recipients || recipients.length === 0) {
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

    // Combine the data
    const enrichedRecipients = recipients.map(recipient => ({
      ...recipient,
      bid_packages: packagesMap.get(recipient.bid_package_id) || null,
      subcontractors: recipient.subcontractor_id ? subcontractorsMap.get(recipient.subcontractor_id) || null : null,
      bids: recipient.bid_id ? [bidsMap.get(recipient.bid_id)].filter(Boolean) : []
    }))

    return NextResponse.json({ recipients: enrichedRecipients })

  } catch (error: any) {
    console.error('Error fetching email statuses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email statuses', details: error.message },
      { status: 500 }
    )
  }
}

