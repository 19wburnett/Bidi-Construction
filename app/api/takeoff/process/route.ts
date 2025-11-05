import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { takeoffOrchestrator } from '@/lib/takeoff-orchestrator'

/**
 * POST /api/takeoff/process
 * 
 * Process pending batches for a job (continuation endpoint)
 * Used for continuing processing after initial start or resuming failed jobs
 */
export async function POST(request: NextRequest) {
  try {
    // Check if this is a service role call
    const authHeader = request.headers.get('authorization')
    const isServiceRole = authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    
    // Use service role client if this is a service role call
    let supabase
    if (isServiceRole) {
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    } else {
      supabase = await createServerSupabaseClient()
    }
    
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }

    const body = await request.json()
    const { job_id, max_batches = 3, timeout_ms = 10000 } = body

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      )
    }

    // Verify ownership (skip user check for service role)
    let job
    if (isServiceRole) {
      // Service role call (from Edge Function) - no user check
      const { data: jobData, error: jobError } = await supabase
        .from('takeoff_jobs')
        .select('*')
        .eq('id', job_id)
        .single()

      if (jobError || !jobData) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }
      job = jobData
    } else {
      // Regular user call - verify ownership
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      const { data: jobData, error: jobError } = await supabase
        .from('takeoff_jobs')
        .select('*')
        .eq('id', job_id)
        .eq('user_id', authUser.id)
        .single()

      if (jobError || !jobData) {
        return NextResponse.json(
          { error: 'Job not found or access denied' },
          { status: 404 }
        )
      }
      job = jobData
    }

    // Process batches
    const { processed, remaining } = await takeoffOrchestrator.processBatches(
      job_id,
      max_batches,
      timeout_ms
    )

    // If all batches are complete, merge results
    if (remaining === 0) {
      try {
        await takeoffOrchestrator.mergeJobResults(job_id)
      } catch (mergeError) {
        console.error('Merge error:', mergeError)
        // Continue anyway - merge can be retried
      }
    }

    // Get updated status
    const updatedJob = await takeoffOrchestrator.getJobStatus(job_id)

    return NextResponse.json({
      success: true,
      job_id,
      processed,
      remaining,
      status: updatedJob?.status,
      progress_percent: updatedJob?.progress_percent || 0,
      message: remaining > 0 
        ? `Processed ${processed} batches. ${remaining} remaining. Call this endpoint again to continue.`
        : 'All batches processed. Results are being merged.'
    })

  } catch (error: any) {
    console.error('Takeoff process error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process batches',
        details: error.message
      },
      { status: 500 }
    )
  }
}

