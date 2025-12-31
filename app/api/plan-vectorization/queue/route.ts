import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { userHasJobAccess } from '@/lib/job-access'

/**
 * POST /api/plan-vectorization/queue
 * Queue a plan for background vectorization
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let payload: { planId?: string; jobId?: string; priority?: number } = {}
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { planId, jobId, priority = 0 } = payload

  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  // Verify plan exists and user has access
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, job_id, user_id, num_pages')
    .eq('id', planId)
    .maybeSingle()

  if (planError) {
    return NextResponse.json({ error: 'Failed to load plan' }, { status: 500 })
  }

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  // Check access
  const targetJobId = plan.job_id || jobId
  if (plan.user_id !== user.id && targetJobId) {
    const hasAccess = await userHasJobAccess(supabase, targetJobId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
  }

  // Check if there's already a pending or processing job for this plan
  const { data: existingJob } = await supabase
    .from('plan_vectorization_queue')
    .select('id, status')
    .eq('plan_id', planId)
    .in('status', ['pending', 'processing'])
    .maybeSingle()

  if (existingJob) {
    return NextResponse.json({
      success: true,
      jobId: existingJob.id,
      status: existingJob.status,
      message: 'Vectorization job already exists for this plan',
    })
  }

  // Create queue job
  try {
    const { data: job, error: jobError } = await supabase
      .from('plan_vectorization_queue')
      .insert({
        plan_id: planId,
        user_id: user.id,
        job_id: targetJobId,
        status: 'pending',
        priority,
        total_pages: plan.num_pages || null,
        progress: 0,
        current_step: 'Queued for processing',
      })
      .select('id, status, queued_at')
      .single()

    if (jobError) {
      throw jobError
    }

    // Trigger background processing (don't wait)
    triggerVectorizationProcessing(job.id).catch((error) => {
      console.error('[VectorizationQueue] Failed to trigger processing:', error)
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      queuedAt: job.queued_at,
      message: 'Vectorization job queued successfully',
    })
  } catch (error) {
    console.error('Failed to queue vectorization:', error)
    return NextResponse.json(
      {
        error: 'Failed to queue vectorization',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/plan-vectorization/queue?planId=...
 * Get vectorization job status
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const planId = request.nextUrl.searchParams.get('planId')
  const jobId = request.nextUrl.searchParams.get('jobId')

  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  // Get the most recent job for this plan
  const { data: job, error } = await supabase
    .from('plan_vectorization_queue')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to load job status' }, { status: 500 })
  }

  if (!job) {
    return NextResponse.json({ error: 'No vectorization job found' }, { status: 404 })
  }

  // Check access
  if (job.user_id !== user.id) {
    const targetJobId = job.job_id || jobId
    if (targetJobId) {
      const hasAccess = await userHasJobAccess(supabase, targetJobId, user.id)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
  }

  return NextResponse.json(job)
}

/**
 * Trigger vectorization processing in the background
 * This runs asynchronously and doesn't block the request
 */
async function triggerVectorizationProcessing(queueJobId: string) {
  // Use a webhook or background job processor
  // For now, we'll use a simple fetch to trigger processing
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  // Trigger async processing endpoint
  fetch(`${baseUrl}/api/plan-vectorization/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queueJobId }),
  }).catch((error) => {
    console.error('[VectorizationQueue] Failed to trigger processing:', error)
  })
}
