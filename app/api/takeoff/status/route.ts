import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { takeoffOrchestrator } from '@/lib/takeoff-orchestrator'

/**
 * GET /api/takeoff/status?job_id=...
 * 
 * Get status and progress of a takeoff job
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

    // Get job status
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

    // Get batch statistics
    const { data: batches } = await supabase
      .from('takeoff_batches')
      .select('status, metrics')
      .eq('job_id', jobId)

    const batchStats = {
      pending: batches?.filter(b => b.status === 'pending').length || 0,
      processing: batches?.filter(b => b.status === 'processing').length || 0,
      completed: batches?.filter(b => b.status === 'completed').length || 0,
      failed: batches?.filter(b => b.status === 'failed').length || 0
    }

    // Calculate metrics
    const totalCost = batches
      ?.filter(b => b.status === 'completed' && b.metrics?.cost)
      .reduce((sum, b) => sum + (b.metrics.cost || 0), 0) || 0

    const totalTokens = batches
      ?.filter(b => b.status === 'completed' && b.metrics?.tokens)
      .reduce((sum, b) => sum + (b.metrics.tokens || 0), 0) || 0

    return NextResponse.json({
      success: true,
      job_id: job.id,
      status: job.status,
      progress_percent: job.progress_percent,
      total_batches: job.total_batches,
      completed_batches: job.completed_batches,
      batch_stats: batchStats,
      metrics: {
        total_cost: totalCost,
        total_tokens: totalTokens
      },
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at
    })

  } catch (error: any) {
    console.error('Takeoff status error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get job status',
        details: error.message
      },
      { status: 500 }
    )
  }
}


