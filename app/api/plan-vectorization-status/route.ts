import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkPlanVectorizationStatus } from '@/lib/plan-vectorization-status'
import { userHasJobAccess } from '@/lib/job-access'

/**
 * GET /api/plan-vectorization-status?planId=...&jobId=...
 * Check if a plan is vectorized and ready for chat
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

  // Verify plan exists and user has access
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, job_id, user_id')
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

  try {
    const status = await checkPlanVectorizationStatus(supabase, planId)
    return NextResponse.json(status, { status: 200 })
  } catch (error) {
    console.error('Failed to check vectorization status:', error)
    return NextResponse.json(
      {
        error: 'Failed to check vectorization status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
