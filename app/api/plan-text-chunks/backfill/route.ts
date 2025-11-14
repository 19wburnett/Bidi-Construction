import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { ingestPlanTextChunks } from '@/lib/plan-text-chunks'

interface BackfillRequestPayload {
  limit?: number
}

interface MissingPlanRecord {
  plan_id: string
  plan_title: string | null
  file_path: string | null
}

interface ProcessedPlanResult {
  planId: string
  planTitle: string | null
  status: 'success' | 'error'
  chunkCount?: number
  pageCount?: number
  warnings?: string[]
  errorMessage?: string
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const {
    data: adminRecord,
    error: adminError,
  } = await supabase.from('users').select('is_admin').eq('id', user.id).single()

  if (adminError) {
    console.error('Failed to verify admin privileges for backfill:', adminError)
    return NextResponse.json({ error: 'Unable to verify admin access' }, { status: 500 })
  }

  if (!adminRecord?.is_admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  let payload: BackfillRequestPayload = {}
  try {
    payload = await request.json()
  } catch {
    // Ignore empty bodies; we support defaults.
  }

  const requestedLimit =
    typeof payload.limit === 'number' && Number.isFinite(payload.limit) ? Math.floor(payload.limit) : 3
  const limit = Math.min(Math.max(requestedLimit, 1), 10)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase environment is not fully configured' }, { status: 500 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: candidates, error: candidateError } = await supabaseAdmin.rpc('find_plans_missing_text_chunks', {
    p_limit: limit + 1,
  })

  if (candidateError) {
    console.error('Failed to locate plans to backfill:', candidateError)
    return NextResponse.json({ error: 'Failed to find plans to backfill' }, { status: 500 })
  }

  const planCandidates: MissingPlanRecord[] = Array.isArray(candidates) ? candidates : []
  if (planCandidates.length === 0) {
    return NextResponse.json({
      processed: [],
      hasMore: false,
    })
  }

  const hasMore = planCandidates.length > limit
  const plansToProcess = planCandidates.slice(0, limit)

  const processed: ProcessedPlanResult[] = []

  for (const plan of plansToProcess) {
    const planId = plan.plan_id
    if (!planId) {
      continue
    }

    try {
      const result = await ingestPlanTextChunks(supabaseAdmin, planId)
      processed.push({
        planId,
        planTitle: plan.plan_title,
        status: 'success',
        chunkCount: result.chunkCount,
        pageCount: result.pageCount,
        warnings: result.warnings,
      })
    } catch (error) {
      console.error(`Failed to backfill plan ${planId}:`, error)
      processed.push({
        planId,
        planTitle: plan.plan_title,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown ingestion error',
      })
    }
  }

  return NextResponse.json({
    processed,
    hasMore,
  })
}

