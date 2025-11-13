import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

type ChatHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

interface TakeoffSummaryCategory {
  category: string
  totalQuantity: number
  unit?: string
}

interface NormalizedTakeoffItem {
  id?: string
  category?: string
  description?: string
  name?: string
  quantity?: number
  unit?: string
  unit_cost?: number
  total_cost?: number
  location?: string
  location_reference?: string
  page_number?: number
}

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

function normalizeTakeoffItems(raw: any): NormalizedTakeoffItem[] {
  if (!raw) return []

  if (Array.isArray(raw)) {
    return raw as NormalizedTakeoffItem[]
  }

  if (typeof raw === 'string') {
    try {
      return normalizeTakeoffItems(JSON.parse(raw))
    } catch (error) {
      console.error('Failed to parse takeoff items string', error)
      return []
    }
  }

  if (Array.isArray(raw?.takeoffs)) {
    return raw.takeoffs as NormalizedTakeoffItem[]
  }

  if (Array.isArray(raw?.items)) {
    return raw.items as NormalizedTakeoffItem[]
  }

  return []
}

function summarizeCategories(items: NormalizedTakeoffItem[]): TakeoffSummaryCategory[] {
  const totals = new Map<string, { total: number; unit?: string }>()

  for (const item of items) {
    const category = item.category || 'Uncategorized'
    const quantityValue = Number(item.quantity)

    if (Number.isFinite(quantityValue)) {
      const current = totals.get(category) || { total: 0, unit: item.unit }
      totals.set(category, {
        total: current.total + quantityValue,
        unit: current.unit || item.unit,
      })
    }
  }

  return Array.from(totals.entries())
    .map(([category, value]) => ({
      category,
      totalQuantity: Number.isFinite(value.total) ? value.total : 0,
      unit: value.unit,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
}

function buildTakeoffContext(plan: any, items: NormalizedTakeoffItem[], summary: any) {
  const sanitizedItems = items.map((item, index) => ({
    id: item.id ?? `item-${index + 1}`,
    category: item.category || 'Uncategorized',
    description: item.description || item.name || 'No description provided',
    quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null,
    unit: item.unit || null,
    unit_cost: Number.isFinite(Number(item.unit_cost)) ? Number(item.unit_cost) : null,
    total_cost: Number.isFinite(Number(item.total_cost)) ? Number(item.total_cost) : null,
    location: item.location || item.location_reference || null,
    page_number: Number.isFinite(Number(item.page_number)) ? Number(item.page_number) : null,
  }))

  const derivedSummary = {
    totalItems: sanitizedItems.length,
    categories: summarizeCategories(items),
    providedSummary: summary ?? null,
  }

  return JSON.stringify(
    {
      plan: {
        id: plan?.id,
        title: plan?.title || plan?.file_name || 'Untitled Plan',
        jobId: plan?.job_id,
      },
      takeoff: {
        summary: derivedSummary,
        items: sanitizedItems,
      },
    },
    null,
    2
  )
}

async function loadPlanContext(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  jobId: string,
  planId: string
) {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, name')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (jobError || !job) {
    return { error: 'JOB_NOT_FOUND' as const }
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, job_id, title, file_name')
    .eq('id', planId)
    .eq('job_id', jobId)
    .single()

  if (planError || !plan) {
    return { error: 'PLAN_NOT_FOUND' as const }
  }

  const { data: takeoffRow, error: takeoffError } = await supabase
    .from('plan_takeoff_analysis')
    .select('id, items, summary, updated_at, created_at')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (takeoffError) {
    console.error('Error fetching takeoff analysis', takeoffError)
    return { error: 'TAKEOFF_QUERY_FAILED' as const }
  }

  if (!takeoffRow) {
    return { error: 'TAKEOFF_NOT_FOUND' as const, plan, job }
  }

  const items = normalizeTakeoffItems(takeoffRow.items)

  return {
    job,
    plan,
    takeoff: {
      id: takeoffRow.id,
      items,
      summary: takeoffRow.summary,
      lastUpdated: takeoffRow.updated_at || takeoffRow.created_at,
    },
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const jobId = request.nextUrl.searchParams.get('jobId') || ''
  const planId = request.nextUrl.searchParams.get('planId') || ''

  if (!jobId || !planId) {
    return NextResponse.json({ error: 'Missing jobId or planId' }, { status: 400 })
  }

  const context = await loadPlanContext(supabase, user.id, jobId, planId)

  if ('error' in context) {
    if (context.error === 'JOB_NOT_FOUND') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (context.error === 'PLAN_NOT_FOUND') {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    if (context.error === 'TAKEOFF_NOT_FOUND') {
      return NextResponse.json(
        {
          hasTakeoff: false,
          lastUpdated: null,
          itemCount: 0,
          summaryCategories: [],
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ error: 'Failed to load takeoff analysis' }, { status: 500 })
  }

  const categories = summarizeCategories(context.takeoff.items).slice(0, 5)

  return NextResponse.json({
    hasTakeoff: context.takeoff.items.length > 0,
    lastUpdated: context.takeoff.lastUpdated,
    itemCount: context.takeoff.items.length,
    summaryCategories: categories,
  })
}

export async function POST(request: NextRequest) {
  if (!openaiClient) {
    return NextResponse.json(
      { error: 'OpenAI client is not configured. Please add an API key.' },
      { status: 500 }
    )
  }

  let payload: { jobId?: string; planId?: string; messages?: ChatHistoryMessage[] } = {}

  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { jobId, planId, messages } = payload

  if (!jobId || !planId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: 'jobId, planId, and at least one message are required' },
      { status: 400 }
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const context = await loadPlanContext(supabase, user.id, jobId, planId)

  if ('error' in context) {
    if (context.error === 'JOB_NOT_FOUND') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (context.error === 'PLAN_NOT_FOUND') {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    if (context.error === 'TAKEOFF_NOT_FOUND') {
      return NextResponse.json({ error: 'TAKEOFF_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to load takeoff analysis' }, { status: 500 })
  }

  const sanitizedHistory = messages
    .filter((message): message is ChatHistoryMessage => {
      return (
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0
      )
    })
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))

  if (sanitizedHistory.length === 0) {
    return NextResponse.json({ error: 'No valid messages to process' }, { status: 400 })
  }

  const systemPrompt = `
You are Bidi's Plan Chat assistant, an experienced construction estimator.
You are helping a user understand the takeoff results for a specific plan.
Important rules:
- Use only the provided takeoff data to answer questions.
- Provide clear, concise responses with relevant quantities, units, categories, and locations when available.
- If the question cannot be answered from the takeoff data, say so explicitly and suggest what information would be needed.
- Emphasize data integrity: do not guess or fabricate any numbers.
- When referencing takeoff items, mention their category or description so the user can identify them.
- Be friendly, professional, and to the point.
`.trim()

  const takeoffContext = buildTakeoffContext(
    context.plan,
    context.takeoff.items,
    context.takeoff.summary
  )

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_completion_tokens: 600,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'system',
          content: `Takeoff data for plan "${context.plan.title || context.plan.file_name}":\n${takeoffContext}`,
        },
        ...sanitizedHistory,
      ],
    })

    const reply = completion.choices[0]?.message?.content?.trim()

    if (!reply) {
      return NextResponse.json({
        reply:
          "I reviewed the takeoff for this plan, but I couldn't find enough detail to answer that. Try asking about specific categories, quantities, or sheet locations from the takeoff, and I'll take another look.",
      })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Plan Chat completion failed', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Plan Chat failed to generate a response. Try again later.',
      },
      { status: 500 }
    )
  }
}


