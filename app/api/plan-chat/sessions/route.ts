import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/plan-chat/sessions
 * List all chat sessions for a job/plan
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const jobId = request.nextUrl.searchParams.get('jobId')
  const planId = request.nextUrl.searchParams.get('planId')

  if (!jobId || !planId) {
    return NextResponse.json(
      { error: 'jobId and planId are required' },
      { status: 400 }
    )
  }

  try {
    const { data: sessions, error } = await supabase
      .from('plan_chat_sessions')
      .select('id, title, description, created_at, updated_at, last_message_at')
      .eq('job_id', jobId)
      .eq('plan_id', planId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ sessions: sessions || [] })
  } catch (error) {
    console.error('[ChatSessions] Failed to list sessions:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to list chat sessions',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/plan-chat/sessions
 * Create a new chat session
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let payload: {
    jobId?: string
    planId?: string
    title?: string
    description?: string
  } = {}

  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { jobId, planId, title, description } = payload

  if (!jobId || !planId) {
    return NextResponse.json(
      { error: 'jobId and planId are required' },
      { status: 400 }
    )
  }

  // Verify plan exists and user has access
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, job_id')
    .eq('id', planId)
    .eq('job_id', jobId)
    .single()

  if (planError || !plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  try {
    const { data: session, error } = await supabase
      .from('plan_chat_sessions')
      .insert({
        job_id: jobId,
        plan_id: planId,
        user_id: user.id,
        title: title || `Chat ${new Date().toLocaleDateString()}`,
        description: description || null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('[ChatSessions] Failed to create session:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create chat session',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/plan-chat/sessions?chatId=...
 * Delete a chat session and all its messages
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const chatId = request.nextUrl.searchParams.get('chatId')

  if (!chatId) {
    return NextResponse.json({ error: 'chatId is required' }, { status: 400 })
  }

  try {
    // Verify ownership
    const { data: session, error: checkError } = await supabase
      .from('plan_chat_sessions')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .single()

    if (checkError || !session) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    // Delete session (cascade will delete messages)
    const { error } = await supabase.from('plan_chat_sessions').delete().eq('id', chatId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ChatSessions] Failed to delete session:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete chat session',
      },
      { status: 500 }
    )
  }
}

