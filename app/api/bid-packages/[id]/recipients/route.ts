import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(
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


    if (!bidPackageId) {
      return NextResponse.json(
        { error: 'Bid package ID required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this bid package
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select('jobs!inner(user_id)')
      .eq('id', bidPackageId)
      .single()

    const jobUserId = bidPackage?.jobs && (Array.isArray(bidPackage.jobs) ? bidPackage.jobs[0]?.user_id : (bidPackage.jobs as any).user_id)

    if (packageError || !bidPackage || jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Bid package not found or unauthorized' },
        { status: 404 }
      )
    }

    // Get recipients with subcontractor info
    const { data: recipients, error: recipientsError } = await supabase
      .from('bid_package_recipients')
      .select(`
        *,
        subcontractors (
          id,
          name,
          email,
          phone,
          website_url,
          google_review_score
        ),
        bids (
          id,
          bid_amount,
          timeline,
          status
        )
      `)
      .eq('bid_package_id', bidPackageId)
      .order('created_at', { ascending: false })

    if (recipientsError) {
      return NextResponse.json(
        { error: 'Failed to fetch recipients' },
        { status: 500 }
      )
    }

    return NextResponse.json({ recipients: recipients || [] })

  } catch (error: any) {
    console.error('Error fetching recipients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipients', details: error.message },
      { status: 500 }
    )
  }
}

