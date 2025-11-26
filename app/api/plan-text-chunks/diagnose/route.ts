import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { diagnosePlanChunks } from '@/lib/plan-text-chunks-diagnostics'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const planId = request.nextUrl.searchParams.get('planId')

  if (!planId) {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  // Verify plan access
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, title, file_name')
    .eq('id', planId)
    .maybeSingle()

  if (planError) {
    return NextResponse.json({ error: 'Failed to load plan' }, { status: 500 })
  }

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  try {
    const diagnostic = await diagnosePlanChunks(supabase, planId)
    return NextResponse.json(diagnostic, { status: 200 })
  } catch (error) {
    console.error('Chunk diagnosis failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to diagnose chunks',
      },
      { status: 500 }
    )
  }
}


