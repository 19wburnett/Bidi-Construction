import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { ingestPlanTextChunks } from '@/lib/plan-text-chunks'
import { userHasJobAccess } from '@/lib/job-access'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let payload: { planId?: string; jobId?: string } = {}
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { planId, jobId } = payload
  if (!planId || typeof planId !== 'string') {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, created_by, job_id')
    .eq('id', planId)
    .maybeSingle()

  if (planError) {
    console.error('Failed to load plan for ingestion:', planError)
    return NextResponse.json({ error: 'Failed to load plan' }, { status: 500 })
  }

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  // Check if user is admin - admins have access to all plans
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin, role')
    .eq('id', user.id)
    .single()

  const isAdmin = userData && (userData.role === 'admin' || userData.is_admin === true)

  // If not admin, check plan ownership or job access
  // Note: plans table uses created_by, not user_id
  if (!isAdmin && plan.created_by !== user.id) {
    const targetJobId = plan.job_id || jobId
    if (!targetJobId) {
      return NextResponse.json({ error: 'You do not have access to this plan.' }, { status: 403 })
    }

    const hasAccess = await userHasJobAccess(supabase, targetJobId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this plan.' }, { status: 403 })
    }
  }

  // Use admin client for ingestion to bypass RLS policies
  // This ensures we can read plan files and insert chunks regardless of RLS
  let supabaseAdmin
  try {
    supabaseAdmin = createAdminSupabaseClient()
  } catch (adminClientError) {
    console.error('[Ingestion] Failed to create admin client:', adminClientError)
    return NextResponse.json(
      {
        error: 'Failed to initialize admin client. Service role key may not be configured.',
        details: adminClientError instanceof Error ? adminClientError.message : 'Unknown error',
      },
      { status: 500 }
    )
  }

  try {
    console.log(`[Ingestion] Starting ingestion for plan ${planId} using admin client (bypasses RLS)`)
    
    // Wrap ingestion in a timeout to prevent hanging (20 minutes max for very large PDFs)
    const ingestionPromise = ingestPlanTextChunks(supabaseAdmin, planId)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Ingestion timeout after 20 minutes. The PDF may be too large or complex. Try splitting the PDF or contact support.'))
      }, 20 * 60 * 1000) // 20 minute timeout
    })
    
    const result = await Promise.race([ingestionPromise, timeoutPromise])
    console.log(`[Ingestion] Successfully ingested plan ${planId}: ${result.chunkCount} chunks, ${result.pageCount} pages`)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : 'Error'
    
    console.error(`[Ingestion] Plan text ingestion failed for plan ${planId}:`)
    console.error(`[Ingestion] Error name: ${errorName}`)
    console.error(`[Ingestion] Error message: ${errorMessage}`)
    if (errorStack) {
      console.error(`[Ingestion] Error stack:\n${errorStack}`)
    }
    
    // Include more context in the error response
    return NextResponse.json(
      {
        error: errorMessage,
        errorType: errorName,
        planId: planId,
        details: errorStack ? 'Check server logs for full stack trace' : undefined,
      },
      { status: 500 }
    )
  }
}

