import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { takeoffOrchestrator } from '@/lib/takeoff-orchestrator'

/**
 * GET /api/takeoff/result?job_id=...
 * 
 * Get final merged result of a completed takeoff job
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return NextResponse.json(
        { error: 'job_id parameter is required' },
        { status: 400 }
      )
    }

    // Get job status first
    const job = await takeoffOrchestrator.getJobStatus(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (job.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // If job is complete, return final result
    if (job.status === 'complete' && job.final_result) {
      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: job.status,
        result: job.final_result,
        metrics: job.metrics
      })
    }

    // If job is partial or running, try to merge what we have
    if (job.status === 'partial' || job.status === 'running') {
      // Check if we should merge (all batches complete)
      const { data: batches } = await supabase
        .from('takeoff_batches')
        .select('status')
        .eq('job_id', jobId)

      const allComplete = batches?.every(b => 
        b.status === 'completed' || b.status === 'failed'
      )

      if (allComplete) {
        // Merge and return
        const result = await takeoffOrchestrator.mergeJobResults(jobId)
        return NextResponse.json({
          success: true,
          job_id: job.id,
          status: 'complete',
          result,
          metrics: job.metrics
        })
      }
    }

    // Job not complete yet
    return NextResponse.json({
      success: false,
      job_id: job.id,
      status: job.status,
      progress_percent: job.progress_percent,
      message: 'Job is still processing. Use /api/takeoff/status to check progress.'
    })

  } catch (error: any) {
    console.error('Takeoff result error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get job result',
        details: error.message
      },
      { status: 500 }
    )
  }
}



