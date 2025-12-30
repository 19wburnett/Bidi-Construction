import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ingestTakeoffItemEmbeddings } from '@/lib/takeoff-item-embeddings'
import { normalizeTakeoffItems } from '@/lib/plan-chat-v3/retrieval-engine'

/**
 * POST /api/takeoff/vectorize
 * Vectorize takeoff items for a plan (creates embeddings for semantic search)
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let payload: { planId?: string } = {}

  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { planId } = payload

  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  try {
    // Load takeoff items for this plan
    const { data: takeoffRow, error: takeoffError } = await supabase
      .from('plan_takeoff_analysis')
      .select('id, items')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (takeoffError) {
      throw takeoffError
    }

    if (!takeoffRow || !takeoffRow.items) {
      return NextResponse.json(
        { error: 'No takeoff items found for this plan' },
        { status: 404 }
      )
    }

    // Normalize items
    const normalizedItems = normalizeTakeoffItems(takeoffRow.items)

    // Generate embeddings
    const result = await ingestTakeoffItemEmbeddings(supabase, planId, normalizedItems)

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Failed to vectorize takeoff items',
          details: result.errors,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      planId,
      itemsVectorized: result.count,
    })
  } catch (error) {
    console.error('[TakeoffVectorize] Failed to vectorize:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to vectorize takeoff items',
      },
      { status: 500 }
    )
  }
}





