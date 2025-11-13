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
  unit?: string | null
}

interface NormalizedTakeoffItem {
  id?: string
  category?: string | null
  category_key?: string | null
  subcategory?: string | null
  description?: string | null
  name?: string | null
  quantity?: number | null
  unit?: string | null
  unit_cost?: number | null
  total_cost?: number | null
  location?: string | null
  page_number?: number | null
  page_reference?: string | null
  notes?: string | null
}

interface TakeoffCategoryBucket {
  key: string
  label: string
  totalQuantity: number
  totalCost: number
  representativeUnit?: string | null
  items: NormalizedTakeoffItem[]
}

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

const coalesceString = (...values: any[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

const coalesceNumber = (...values: any[]): number | null => {
  for (const value of values) {
    const num = typeof value === 'string' ? Number(value) : value
    if (typeof num === 'number' && Number.isFinite(num)) {
      return num
    }
  }
  return null
}

const normalizeTakeoffItems = (raw: any): NormalizedTakeoffItem[] => {
  if (!raw) return []

  let sourceItems: any[] = []

  if (Array.isArray(raw)) {
    sourceItems = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return normalizeTakeoffItems(parsed)
    } catch (error) {
      console.error('Failed to parse takeoff items string', error)
      return []
    }
  } else if (Array.isArray(raw?.takeoffs)) {
    sourceItems = raw.takeoffs
  } else if (Array.isArray(raw?.items)) {
    sourceItems = raw.items
  } else {
    return []
  }

  return sourceItems.map((item, index) => {
    const category = coalesceString(
      item.category,
      item.Category,
      item.trade_category,
      item.discipline,
      item.scope,
      item.segment,
      item.group,
      'Uncategorized'
    )

    const subcategory = coalesceString(
      item.subcategory,
      item.sub_category,
      item.Subcategory,
      item.scope_detail
    )

    const name = coalesceString(item.name, item.item_name, item.title, item.label, item.description)
    const description = coalesceString(
      item.description,
      item.details,
      item.notes,
      item.item_description,
      item.summary,
      name
    )

    const location = coalesceString(
      item.location,
      item.location_reference,
      item.location_ref,
      item.area,
      item.room,
      item.zone,
      item.sheet_reference,
      item.sheet,
      item.sheetTitle
    )

    const pageNumber = coalesceNumber(
      item.page_number,
      item.pageNumber,
      item.page,
      item.plan_page_number,
      item.sheet_page,
      item.sheetNumber,
      item.bounding_box?.page
    )

    const pageReference = coalesceString(
      item.page_reference,
      item.sheet_reference,
      item.sheet,
      item.sheet_title,
      item.sheetName,
      item.page_label
    )

    const quantity = coalesceNumber(item.quantity, item.qty, item.amount)
    const unit = coalesceString(item.unit, item.units, item.measure_unit)
    const unitCost = coalesceNumber(item.unit_cost, item.unitCost, item.unit_price)
    const totalCost = coalesceNumber(item.total_cost, item.totalCost, item.extended_price)

    const notes = coalesceString(item.notes, item.assumptions, item.comments)

    const categoryKey = category ? category.toLowerCase() : 'uncategorized'

    return {
      id: coalesceString(item.id, item.uuid, item.item_id) ?? `item-${index + 1}`,
      category,
      category_key: categoryKey,
      subcategory,
      name,
      description,
      quantity,
      unit,
      unit_cost: unitCost,
      total_cost: totalCost,
      location,
      page_number: pageNumber,
      page_reference: pageReference,
      notes,
    }
  })
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
        unit: current.unit || (item.unit ?? undefined),
      })
    }
  }

  return Array.from(totals.entries())
    .map(([category, value]) => ({
      category,
      totalQuantity: Number.isFinite(value.total) ? value.total : 0,
      unit: value.unit ?? null,
    }))
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
}

function buildCategoryBuckets(items: NormalizedTakeoffItem[]): TakeoffCategoryBucket[] {
  const map = new Map<string, TakeoffCategoryBucket>()

  for (const item of items) {
    const label = item.category ?? 'Uncategorized'
    const key = (item.category_key ?? label.toLowerCase()) || 'uncategorized'

    if (!map.has(key)) {
      map.set(key, {
        key,
        label,
        totalQuantity: 0,
        totalCost: 0,
        representativeUnit: item.unit ?? null,
        items: [],
      })
    }

    const bucket = map.get(key)!
    bucket.items.push(item)

    if (typeof item.quantity === 'number') {
      bucket.totalQuantity += item.quantity
    }

    if (typeof item.total_cost === 'number') {
      bucket.totalCost += item.total_cost
    }

    if (!bucket.representativeUnit && item.unit) {
      bucket.representativeUnit = item.unit
    }
  }

  return Array.from(map.values())
}

const formatQuantity = (quantity: number | null | undefined, unit?: string | null) => {
  if (quantity === null || quantity === undefined || Number.isNaN(quantity)) {
    return unit ? `Unknown ${unit}` : 'Unknown quantity'
  }
  const formatted = quantity.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(quantity) ? 0 : 2,
  })
  return unit ? `${formatted} ${unit}` : formatted
}

function buildTakeoffContext(
  plan: any,
  items: NormalizedTakeoffItem[],
  summary: any,
  categories: TakeoffCategoryBucket[]
) {
  const sanitizedItems = items.map((item, index) => ({
    id: item.id ?? `item-${index + 1}`,
    category: item.category || 'Uncategorized',
    subcategory: item.subcategory || null,
    description: item.description || item.name || 'No description provided',
    name: item.name || null,
    quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null,
    unit: item.unit || null,
    unit_cost: Number.isFinite(Number(item.unit_cost)) ? Number(item.unit_cost) : null,
    total_cost: Number.isFinite(Number(item.total_cost)) ? Number(item.total_cost) : null,
    location: item.location || null,
    page_number: Number.isFinite(Number(item.page_number)) ? Number(item.page_number) : null,
    page_reference: item.page_reference || null,
    notes: item.notes || null,
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
        categories: categories.map((bucket) => ({
          key: bucket.key,
          label: bucket.label,
          totalQuantity: bucket.totalQuantity,
          totalCost: bucket.totalCost,
          representativeUnit: bucket.representativeUnit,
          items: bucket.items.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            location: item.location,
            page_number: item.page_number,
            page_reference: item.page_reference,
          })),
        })),
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
  const categories = buildCategoryBuckets(items)

  return {
    job,
    plan,
    takeoff: {
      id: takeoffRow.id,
      items,
      summary: takeoffRow.summary,
      lastUpdated: takeoffRow.updated_at || takeoffRow.created_at,
      categories,
    },
  }
}

function findMatchingCategoryBucket(
  message: string,
  categories: TakeoffCategoryBucket[]
): TakeoffCategoryBucket | null {
  const lowerMessage = message.toLowerCase()
  for (const bucket of categories) {
    if (lowerMessage.includes(bucket.key) || lowerMessage.includes(bucket.label.toLowerCase())) {
      return bucket
    }
  }
  return null
}

const formatItemLine = (item: NormalizedTakeoffItem): string => {
  const title = item.name || item.description || 'Item'
  const quantityText =
    item.quantity !== null && item.quantity !== undefined
      ? formatQuantity(item.quantity, item.unit)
      : item.unit
      ? `Quantity not listed (${item.unit})`
      : 'Quantity not listed'
  const locationText = item.location ? ` @ ${item.location}` : ''
  const pageText = item.page_number
    ? ` (page ${item.page_number})`
    : item.page_reference
    ? ` (${item.page_reference})`
    : ''
  return `• ${title} — ${quantityText}${locationText}${pageText}`
}

function buildDeterministicAnswer(
  latestUserMessage: ChatHistoryMessage | undefined,
  takeoff: { items: NormalizedTakeoffItem[]; categories: TakeoffCategoryBucket[] }
): string | null {
  if (!latestUserMessage || latestUserMessage.role !== 'user') {
    return null
  }

  const userText = latestUserMessage.content.trim()
  if (!userText) {
    return null
  }

  const lower = userText.toLowerCase()

  const pageMatch = lower.match(/page\s*(\d+)/)
  if (pageMatch) {
    const pageNum = Number(pageMatch[1])
    if (Number.isFinite(pageNum)) {
      const pageItems = takeoff.items.filter(
        (item) =>
          item.page_number === pageNum ||
          (item.page_reference && item.page_reference.toLowerCase().includes(`page ${pageNum}`))
      )

      if (pageItems.length > 0) {
        const lines = pageItems.map(formatItemLine)
        return [
          `Items tagged to page ${pageNum}:`,
          ...lines,
          '',
          'Let me know if you want more detail about any of these.',
        ].join('\n')
      }
    }
  }

  const matchedCategory = findMatchingCategoryBucket(userText, takeoff.categories)
  if (matchedCategory && matchedCategory.items.length > 0) {
    const lines = matchedCategory.items.map(formatItemLine)
    const quantityText =
      matchedCategory.totalQuantity > 0
        ? formatQuantity(matchedCategory.totalQuantity, matchedCategory.representativeUnit)
        : null

    return [
      `I found ${matchedCategory.items.length} item${
        matchedCategory.items.length === 1 ? '' : 's'
      } in the ${matchedCategory.label} category${
        quantityText ? ` (total quantity: ${quantityText})` : ''
      }:`,
      ...lines.slice(0, 30),
      lines.length > 30 ? `…and ${lines.length - 30} more items.` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (lower.includes('top') && lower.includes('categor')) {
    const sorted = [...takeoff.categories].sort((a, b) => b.totalQuantity - a.totalQuantity)
    const topThree = sorted.filter((bucket) => bucket.totalQuantity > 0).slice(0, 3)
    if (topThree.length > 0) {
      const lines = topThree.map((bucket, index) => {
        const quantityText = formatQuantity(bucket.totalQuantity, bucket.representativeUnit || undefined)
        return `${index + 1}) ${bucket.label}: ${quantityText} (${bucket.items.length} items)`
      })
      return [
        'Based on the available takeoff data, here are the leading categories by total quantity:',
        ...lines,
      ].join('\n')
    }
  }

  return null
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
    context.takeoff.summary,
    context.takeoff.categories
  )

  const latestUserMessage = [...sanitizedHistory]
    .reverse()
    .find((message) => message.role === 'user')

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
      const deterministic = buildDeterministicAnswer(latestUserMessage, {
        items: context.takeoff.items,
        categories: context.takeoff.categories,
      })
      if (deterministic) {
        return NextResponse.json({ reply: deterministic })
      }
      return NextResponse.json({
        reply:
          "I reviewed the takeoff for this plan, but I couldn't find enough detail to answer that. Try asking about specific categories, quantities, or sheet locations from the takeoff, and I'll take another look.",
      })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Plan Chat completion failed', error)
    const deterministic = buildDeterministicAnswer(latestUserMessage, {
      items: context.takeoff.items,
      categories: context.takeoff.categories,
    })
    if (deterministic) {
      return NextResponse.json({ reply: deterministic })
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Plan Chat failed to generate a response. Try again later.',
      },
      { status: 500 }
    )
  }
}


