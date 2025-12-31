import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { applyTakeoffModifications, type TakeoffModification } from '@/lib/plan-chat-v3/takeoff-modifier'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let payload: {
    planId?: string
    modifications?: TakeoffModification[]
  } = {}

  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { planId, modifications } = payload

  if (!planId || !modifications || !Array.isArray(modifications)) {
    return NextResponse.json(
      { error: 'planId and modifications array are required' },
      { status: 400 }
    )
  }

  // Verify plan exists and user has access
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, job_id')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  try {
    const result = await applyTakeoffModifications(supabase, planId, modifications, user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[TakeoffModify] Failed to apply modifications:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to apply takeoff modifications',
      },
      { status: 500 }
    )
  }
}






