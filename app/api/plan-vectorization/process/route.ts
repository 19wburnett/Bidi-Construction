import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ingestPlanTextChunks } from '@/lib/plan-text-chunks'

/**
 * POST /api/plan-vectorization/process
 * Process a vectorization job from the queue
 * This endpoint is called by the queue system or can be triggered manually
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  
  let payload: { queueJobId?: string } = {}
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { queueJobId } = payload

  if (!queueJobId) {
    return NextResponse.json({ error: 'queueJobId is required' }, { status: 400 })
  }

  try {
    // Get the queue job
    const { data: job, error: jobError } = await supabase
      .from('plan_vectorization_queue')
      .select('*')
      .eq('id', queueJobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if already processing or completed
    if (job.status === 'processing') {
      return NextResponse.json({ message: 'Job is already being processed' }, { status: 200 })
    }

    if (job.status === 'completed') {
      return NextResponse.json({ message: 'Job already completed' }, { status: 200 })
    }

    // Update status to processing
    await supabase
      .from('plan_vectorization_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        progress: 5,
        current_step: 'Starting vectorization...',
      })
      .eq('id', queueJobId)

    // Run vectorization with progress updates
    const result = await ingestPlanTextChunksWithProgress(supabase, job.plan_id, queueJobId)

    // Update job with results
    await supabase
      .from('plan_vectorization_queue')
      .update({
        status: result.success ? 'completed' : 'failed',
        progress: result.success ? 100 : job.progress,
        current_step: result.success ? 'Vectorization complete' : 'Vectorization failed',
        completed_at: new Date().toISOString(),
        chunks_created: result.chunkCount || 0,
        pages_processed: result.pageCount || 0,
        total_pages: result.pageCount || job.total_pages,
        error_message: result.success ? null : result.error,
        warnings: result.warnings ? JSON.stringify(result.warnings) : null,
      })
      .eq('id', queueJobId)

    return NextResponse.json({
      success: result.success,
      chunkCount: result.chunkCount,
      pageCount: result.pageCount,
      warnings: result.warnings,
    })
  } catch (error) {
    console.error('[VectorizationProcess] Processing failed:', error)
    
    // Update job status to failed
    try {
      await supabase
        .from('plan_vectorization_queue')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', queueJobId)
    } catch (updateError) {
      console.error('[VectorizationProcess] Failed to update job status:', updateError)
    }

    return NextResponse.json(
      {
        error: 'Vectorization processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Run vectorization with progress updates
 */
async function ingestPlanTextChunksWithProgress(
  supabase: any,
  planId: string,
  queueJobId: string
): Promise<{
  success: boolean
  chunkCount?: number
  pageCount?: number
  warnings?: string[]
  error?: string
}> {
  try {
    // Update progress: Starting
    await updateProgress(supabase, queueJobId, 10, 'Downloading PDF...')

    // Get plan details
    const { data: plan } = await supabase
      .from('plans')
      .select('id, file_path, file_name, title')
      .eq('id', planId)
      .single()

    if (!plan) {
      throw new Error('Plan not found')
    }

    await updateProgress(supabase, queueJobId, 20, 'Extracting text from PDF...')

    // Run vectorization (this will handle the actual work)
    // For large PDFs, this may take several minutes
    const result = await ingestPlanTextChunks(supabase, planId)

    await updateProgress(supabase, queueJobId, 90, 'Finalizing vectorization...')

    return {
      success: true,
      chunkCount: result.chunkCount,
      pageCount: result.pageCount,
      warnings: result.warnings,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Update progress in the queue
 */
async function updateProgress(
  supabase: any,
  queueJobId: string,
  progress: number,
  currentStep: string
) {
  await supabase
    .from('plan_vectorization_queue')
    .update({
      progress,
      current_step: currentStep,
      updated_at: new Date().toISOString(),
    })
    .eq('id', queueJobId)
}
