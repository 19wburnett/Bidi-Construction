import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Find jobs that should timeout from active status to expired
    const { data: timeoutJobs, error: timeoutError } = await supabase
      .from('job_requests')
      .select('id, bid_collection_ends_at')
      .eq('status', 'active')
      .lt('bid_collection_ends_at', new Date().toISOString())

    if (timeoutError) {
      console.error('Error finding timeout jobs:', timeoutError)
      return NextResponse.json(
        { error: 'Failed to check timeouts' },
        { status: 500 }
      )
    }

    if (!timeoutJobs || timeoutJobs.length === 0) {
      return NextResponse.json({
        message: 'No jobs to timeout',
        updated: 0
      })
    }

    // Update jobs to expired status
    const { error: updateError } = await supabase
      .from('job_requests')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('bid_collection_ends_at', new Date().toISOString())

    if (updateError) {
      console.error('Error updating timeout jobs:', updateError)
      return NextResponse.json(
        { error: 'Failed to update timeout jobs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Updated ${timeoutJobs.length} jobs from active to expired`,
      updated: timeoutJobs.length
    })
  } catch (error) {
    console.error('Error checking bid timeouts:', error)
    return NextResponse.json(
      { error: 'Failed to check bid timeouts' },
      { status: 500 }
    )
  }
}


