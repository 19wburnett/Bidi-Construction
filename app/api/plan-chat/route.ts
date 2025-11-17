import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PLAN_CHAT_SYSTEM_PROMPT, PLAN_CHAT_FEW_SHOTS } from '@/lib/ai/plan-chat-prompt'
import {
  retrievePlanTextChunks,
  fetchPlanTextChunksByPage,
  fetchPlanTextChunksSample,
} from '@/lib/plan-text-chunks'
import type { PlanTextChunkRecord } from '@/lib/plan-text-chunks'

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

interface SanitizedTakeoffItem {
  id: string
  category: string
  subcategory: string | null
  description: string
  name: string | null
  quantity: number | null
  unit: string | null
  unit_cost: number | null
  total_cost: number | null
  location: string | null
  page_number: number | null
  page_reference: string | null
  notes: string | null
}

interface TakeoffContextPayload {
  plan: {
    id: string | undefined
    title: string
    jobId: string | undefined
  }
  takeoff: {
    summary: {
      totalItems: number
      lastUpdated?: string | null
    }
    topCategories: TakeoffSummaryCategory[]
    representativeItems: Array<{
      id: string
      key: string
      label: string
      description: string
      quantity: number | null
      unit: string | null
      location: string | null
      page_number: number | null
      page_reference: string | null
    }>
  }
}

interface PlanTextSnippetPayload {
  snippetId: string
  snippetIndex: number
  pageNumber: number | null
  sheetName: string | null
  sheetId: string | null
  sheetDiscipline?: string | null
  roomLabel?: string | null
  snippetText: string
}

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

const REPRESENTATIVE_ITEM_LIMIT = 12
const TOP_CATEGORY_LIMIT = 8
const MAX_BLUEPRINT_SNIPPETS = 8
const BLUEPRINT_SNIPPET_CHAR_LIMIT = 420

const sanitizeString = (value: any): string | null => {
  if (value === null || value === undefined) return null
  const stringified = typeof value === 'string' ? value : String(value)
  const trimmed = stringified.trim()
  return trimmed.length > 0 ? trimmed : null
}

const coalesceString = (...values: any[]): string | null => {
  for (const value of values) {
    const sanitized = sanitizeString(value)
    if (sanitized) return sanitized
  }
  return null
}

const normalizeKey = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const parseQuantityAndUnit = (
  value: any
): { quantity: number | null; detectedUnit: string | null } => {
  if (value === null || value === undefined) {
    return { quantity: null, detectedUnit: null }
  }

  if (typeof value === 'number') {
    return { quantity: Number.isFinite(value) ? value : null, detectedUnit: null }
  }

  const raw = String(value).trim()
  if (raw.length === 0) {
    return { quantity: null, detectedUnit: null }
  }

  const match = raw.match(/-?\d[\d,]*(\.\d+)?/)
  if (!match) {
    return { quantity: null, detectedUnit: null }
  }

  const numeric = parseFloat(match[0].replace(/,/g, ''))
  const before = raw.slice(0, match.index ?? 0).trim()
  const after = raw.slice((match.index ?? 0) + match[0].length).trim()

  let detectedUnit: string | null = null
  const unitCandidate = after || before
  if (unitCandidate) {
    const cleaned = unitCandidate.replace(/^[\-\d,.\s]+/, '').trim()
    if (cleaned.length > 0 && cleaned.length <= 25) {
      detectedUnit = cleaned
    }
  }

  return {
    quantity: Number.isFinite(numeric) ? numeric : null,
    detectedUnit,
  }
}

const parseCurrency = (value: any): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(/-?\d[\d,]*(\.\d+)?/)
  if (!match) return null
  const numeric = parseFloat(match[0].replace(/,/g, ''))
  return Number.isFinite(numeric) ? numeric : null
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
    const rawQuantityValue = item.quantity ?? item.qty ?? item.amount
    const parsedQuantity = parseQuantityAndUnit(rawQuantityValue)

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

    const pageNumber = parseQuantityAndUnit(
      item.page_number ?? item.pageNumber ?? item.page ?? item.plan_page_number ?? item.sheet_page ?? item.sheetNumber ?? item.bounding_box?.page
    ).quantity

    const pageReference = coalesceString(
      item.page_reference,
      item.sheet_reference,
      item.sheet,
      item.sheet_title,
      item.sheetName,
      item.page_label
    )

    const unit =
      coalesceString(item.unit, item.units, item.measure_unit) || parsedQuantity.detectedUnit
    const unitCost = parseCurrency(item.unit_cost ?? item.unitCost ?? item.unit_price)
    const totalCost = parseCurrency(item.total_cost ?? item.totalCost ?? item.extended_price)

    const notes = coalesceString(item.notes, item.assumptions, item.comments)

    const categoryKey = normalizeKey(category) ?? 'uncategorized'

    return {
      id: coalesceString(item.id, item.uuid, item.item_id) ?? `item-${index + 1}`,
      category,
      category_key: categoryKey,
      subcategory,
      name,
      description,
      quantity: parsedQuantity.quantity,
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
    const quantityValue = item.quantity ?? null

    if (quantityValue !== null && Number.isFinite(quantityValue)) {
      const current = totals.get(category) || { total: 0, unit: item.unit || undefined }
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
    const key = normalizeKey(item.category_key ?? label) ?? 'uncategorized'

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
  const isWhole = Math.abs(quantity - Math.round(quantity)) < 1e-6
  const formatted = quantity.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: isWhole ? 0 : 2,
  })
  return unit ? `${formatted} ${unit}` : formatted
}

function buildTakeoffContext(
  plan: any,
  items: NormalizedTakeoffItem[],
  lastUpdated: string | null
): TakeoffContextPayload {
  const sanitizedItems: SanitizedTakeoffItem[] = items.map((item, index) => ({
    id: item.id ?? `item-${index + 1}`,
    category: item.category || 'Uncategorized',
    subcategory: item.subcategory || null,
    description: item.description || item.name || 'No description provided',
    name: item.name || null,
    quantity: item.quantity ?? null,
    unit: item.unit || null,
    unit_cost: item.unit_cost ?? null,
    total_cost: item.total_cost ?? null,
    location: item.location || null,
    page_number: item.page_number ?? null,
    page_reference: item.page_reference || null,
    notes: item.notes || null,
  }))

  const categorySummary = summarizeCategories(items).slice(0, TOP_CATEGORY_LIMIT)
  const representativeItems = sanitizedItems.slice(0, REPRESENTATIVE_ITEM_LIMIT)

  const derivedSummary = {
    totalItems: sanitizedItems.length,
    lastUpdated,
  }

  return {
    plan: {
      id: plan?.id,
      title: plan?.title || plan?.file_name || 'Untitled Plan',
      jobId: plan?.job_id,
    },
    takeoff: {
      summary: derivedSummary,
      topCategories: categorySummary,
      representativeItems: representativeItems.map((item) => ({
        id: item.id,
        key: normalizeKey(item.category) ?? 'uncategorized',
        label: item.category,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        page_number: item.page_number,
        page_reference: item.page_reference,
      })),
    },
  }
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
  const messageKey = normalizeKey(message) ?? ''
  if (!messageKey) return null

  for (const bucket of categories) {
    const bucketKey = bucket.key
    const bucketLabel = normalizeKey(bucket.label) ?? bucketKey

    if (messageKey.includes(bucketKey) || messageKey.includes(bucketLabel)) {
      return bucket
    }

    // Handle pluralization like "doors and windows" vs "door & window"
    if (bucketLabel.replace(/s\b/g, '').length > 0) {
      const singularKey = bucketLabel.replace(/s\b/g, '')
      if (messageKey.includes(singularKey)) {
        return bucket
      }
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

function buildPlanTextSnippetPayloads(chunks: PlanTextChunkRecord[]): PlanTextSnippetPayload[] {
  if (!chunks.length) {
    return []
  }

  return chunks.map((chunk, index) => {
    const metadata = chunk.metadata ?? {}
    const sheetTitle =
      typeof metadata.sheet_title === 'string' && metadata.sheet_title.trim().length > 0
        ? metadata.sheet_title.trim()
        : null
    const sheetId =
      typeof metadata.sheet_id === 'string' && metadata.sheet_id.trim().length > 0
        ? metadata.sheet_id.trim()
        : null
    const sheetDiscipline =
      typeof metadata.sheet_discipline === 'string' && metadata.sheet_discipline.trim().length > 0
        ? metadata.sheet_discipline.trim()
        : null
    const roomLabel =
      typeof metadata.room_label === 'string' && metadata.room_label.trim().length > 0
        ? metadata.room_label.trim()
        : null
    const pageNumber =
      typeof chunk.page_number === 'number' && Number.isFinite(chunk.page_number)
        ? chunk.page_number
        : null

    const snippetNormalized = normalizeWhitespace(chunk.snippet_text || '')
    const snippetText =
      snippetNormalized.length > BLUEPRINT_SNIPPET_CHAR_LIMIT
        ? `${snippetNormalized.slice(0, BLUEPRINT_SNIPPET_CHAR_LIMIT - 1).trimEnd()}…`
        : snippetNormalized

    return {
      snippetId: chunk.id,
      snippetIndex: index + 1,
      pageNumber,
      sheetName: sheetTitle || sheetId,
      sheetId,
      sheetDiscipline: sheetDiscipline || undefined,
      roomLabel: roomLabel || undefined,
      snippetText,
    }
  })
}

const normalizeWhitespace = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''

function extractPageNumbers(text: string): number[] {
  if (!text) return []

  const results = new Set<number>()
  const patterns = [
    /page\s*(\d{1,4})/gi,
    /\bpg\.?\s*(\d{1,4})/gi,
    /\bp\.?\s*(\d{1,4})/gi,
  ]

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const value = parseInt(match[1], 10)
      if (Number.isFinite(value)) {
        results.add(value)
      }
    }
  }

  return Array.from(results)
}

function buildSnippetSummary(
  question: string,
  chunks: PlanTextChunkRecord[],
  requestedPages: number[],
  maxPages = 4
): string {
  if (!chunks.length) {
    return "I couldn't locate any blueprint snippets for this plan yet."
  }

  const buckets = new Map<number, PlanTextChunkRecord[]>()
  for (const chunk of chunks) {
    const page =
      typeof chunk.page_number === 'number' && Number.isFinite(chunk.page_number) ? chunk.page_number : 0
    if (!buckets.has(page)) {
      buckets.set(page, [])
    }
    buckets.get(page)!.push(chunk)
  }

  const prioritizedPages =
    requestedPages.length > 0
      ? requestedPages
      : Array.from(buckets.keys())
          .filter((page) => page > 0)
          .sort((a, b) => a - b)
          .slice(0, maxPages)

  const selectedPages =
    prioritizedPages.length > 0
      ? prioritizedPages
      : Array.from(buckets.keys())
          .sort((a, b) => a - b)
          .slice(0, maxPages)

  const heading =
    requestedPages.length > 0
      ? `Highlights from page${requestedPages.length > 1 ? 's' : ''} ${requestedPages.join(', ')}:`
      : inferSummaryHeading(question)

  const lines: string[] = [heading]

  selectedPages.forEach((page) => {
    const pageChunks = buckets.get(page) || []
    const preview = formatChunkPreview(pageChunks)
    const sheetLabel = inferSheetLabel(pageChunks)
    const labelParts = [
      page > 0 ? `Page ${page}` : 'Cover / unspecified page',
      sheetLabel ? `(${sheetLabel})` : null,
    ].filter(Boolean)
    lines.push(`• ${labelParts.join(' ')}: ${preview}`)
  })

  const unseenPages = Math.max(buckets.size - selectedPages.length, 0)
  if (unseenPages > 0) {
    lines.push(
      `…plus ${unseenPages} more page${unseenPages === 1 ? '' : 's'} of notes. Ask about a specific sheet to drill down.`
    )
  }

  return lines.join('\n')
}

function inferSummaryHeading(question: string): string {
  const normalized = question.toLowerCase()
  if (
    normalized.includes('summary') ||
    normalized.includes('about this plan') ||
    normalized.includes('overview') ||
    normalized.includes('project')
  ) {
    return 'High-level blueprint highlights:'
  }
  if (normalized.includes('fire') || normalized.includes('note')) {
    return 'Relevant notes found in the blueprint:'
  }
  if (normalized.includes('page')) {
    return 'Blueprint notes pulled from the requested pages:'
  }
  return 'Here’s what the blueprint text highlights:'
}

function formatChunkPreview(chunks: PlanTextChunkRecord[], maxLength = 220): string {
  if (!chunks.length) {
    return 'No readable text captured.'
  }

  const combined = chunks
    .map((chunk) => normalizeWhitespace(chunk.snippet_text))
    .filter(Boolean)
    .join(' ')

  if (!combined) {
    return 'No readable text captured.'
  }

  const sentences = combined.split(/(?<=[.?!])\s+/).filter(Boolean)
  const builder: string[] = []
  let total = 0
  for (const sentence of sentences) {
    if (total + sentence.length > maxLength && builder.length > 0) {
      break
    }
    builder.push(sentence)
    total += sentence.length
    if (total >= maxLength) {
      break
    }
  }

  const preview = builder.join(' ').trim()
  if (!preview) {
    return combined.slice(0, maxLength > 10 ? maxLength - 1 : combined.length)
  }
  return preview.length > maxLength ? `${preview.slice(0, maxLength - 1)}…` : preview
}

function inferSheetLabel(chunks: PlanTextChunkRecord[]): string | null {
  for (const chunk of chunks) {
    const metadata = chunk.metadata ?? {}
    const label =
      (typeof metadata.sheet_title === 'string' && metadata.sheet_title.trim()) ||
      (typeof metadata.sheet_id === 'string' && metadata.sheet_id.trim()) ||
      null
    if (label) {
      return label
    }
  }

  const combined = chunks
    .map((chunk) => normalizeWhitespace(chunk.snippet_text))
    .join(' ')
    .toLowerCase()

  if (combined.includes('cover sheet')) return 'Cover Sheet'
  if (combined.includes('general note')) return 'General Notes'
  if (combined.includes('site plan')) return 'Site Plan'

  return null
}

const KEYWORD_SYNONYMS: Record<string, string[]> = {
  roof: ['roof', 'roofing', 'roof area', 'shingle'],
  concrete: ['concrete', 'footing', 'found', 'foundation', 'slab'],
  door: ['door', 'doors'],
  window: ['window', 'windows', 'glazing'],
  fire: ['fire', 'sprinkler', 'smoke', 'alarm'],
  floor: ['floor', 'flooring'],
  area: ['square feet', 'sqft', 'sf', 'area'],
  siding: ['siding', 'exterior finish'],
  stair: ['stair', 'stairs'],
}

function extractQuestionKeywords(question?: string | null): string[] {
  if (!question) return []
  const normalized = question.toLowerCase()
  const matches = new Set<string>()
  Object.entries(KEYWORD_SYNONYMS).forEach(([keyword, synonyms]) => {
    if (synonyms.some((term) => normalized.includes(term))) {
      matches.add(keyword)
    }
  })
  return Array.from(matches)
}

function textMatchesKeywords(text: string | null | undefined, keywords: string[]): boolean {
  if (!text || keywords.length === 0) return false
  const lower = text.toLowerCase()
  return keywords.some((keyword) => {
    const synonyms = KEYWORD_SYNONYMS[keyword] || [keyword]
    return synonyms.some((term) => lower.includes(term))
  })
}

function filterTakeoffItemsByKeywords(
  items: NormalizedTakeoffItem[],
  keywords: string[]
): NormalizedTakeoffItem[] {
  if (!keywords.length) return []
  return items.filter((item) => {
    return (
      textMatchesKeywords(item.category, keywords) ||
      textMatchesKeywords(item.description, keywords) ||
      textMatchesKeywords(item.name, keywords) ||
      textMatchesKeywords(item.notes, keywords)
    )
  })
}

function summarizeTakeoffItems(
  items: NormalizedTakeoffItem[],
  limit = 6,
  includeCosts = false
): string {
  if (!items.length) return ''
  const lines = items.slice(0, limit).map((item) => {
    const category = item.category ? `${item.category}: ` : ''
    const quantity =
      typeof item.quantity === 'number' ? formatQuantity(item.quantity, item.unit) : item.unit || 'N/A'
    const location = item.location ? ` @ ${item.location}` : ''
    let line = `• ${category}${item.description || item.name || 'Item'} — ${quantity}${location}`
    
    if (includeCosts) {
      if (typeof item.total_cost === 'number' && item.total_cost > 0) {
        line += ` — Total: $${item.total_cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      }
      if (typeof item.unit_cost === 'number' && item.unit_cost > 0) {
        line += ` ($${item.unit_cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}/${item.unit || 'unit'})`
      }
    }
    
    return line
  })
  if (items.length > limit) {
    lines.push(`…plus ${items.length - limit} more related takeoff entries.`)
  }
  return lines.join('\n')
}

function buildStructuredStats(
  items: NormalizedTakeoffItem[],
  keywords: string[],
  isCostQuestion = false
): string | null {
  const summaries: string[] = []

  const totalByCategory = (
    predicate: (item: NormalizedTakeoffItem) => boolean,
    includeCost = false
  ) => {
    return items.reduce<{ total: number; unit: string | null; totalCost: number }>(
      (acc, item) => {
        if (!predicate(item)) return acc
        const qty = typeof item.quantity === 'number' ? item.quantity : 0
        const unit = item.unit || acc.unit
        const cost = typeof item.total_cost === 'number' ? item.total_cost : 0
        return {
          total: acc.total + qty,
          unit,
          totalCost: acc.totalCost + cost,
        }
      },
      { total: 0, unit: null as string | null, totalCost: 0 }
    )
  }

  if (keywords.includes('roof')) {
    const { total, unit, totalCost } = totalByCategory((item) =>
      textMatchesKeywords(item.description, ['roof']),
      isCostQuestion
    )
    if (total > 0) {
      let summary = `Roofing quantity: ${formatQuantity(total, unit)}.`
      if (isCostQuestion && totalCost > 0) {
        summary += ` Total cost: $${totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`
        if (total > 0) {
          const unitCost = totalCost / total
          summary += ` Unit cost: $${unitCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}/${unit || 'unit'}.`
        }
      }
      summaries.push(summary)
    }
  }

  if (keywords.includes('concrete')) {
    const { total, unit, totalCost } = totalByCategory(
      (item) => textMatchesKeywords(item.description, ['concrete', 'footing', 'foundation']),
      isCostQuestion
    )
    if (total > 0) {
      let summary = `Concrete quantity: ${formatQuantity(total, unit)}.`
      if (isCostQuestion && totalCost > 0) {
        summary += ` Total cost: $${totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`
      }
      summaries.push(summary)
    }
  }

  if (keywords.includes('door')) {
    const { total, unit, totalCost } = totalByCategory(
      (item) => textMatchesKeywords(item.description, ['door']),
      isCostQuestion
    )
    if (total > 0) {
      let summary = `Door count: ${formatQuantity(total, unit)}.`
      if (isCostQuestion && totalCost > 0) {
        summary += ` Total cost: $${totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`
      }
      summaries.push(summary)
    }
  }

  if (keywords.includes('window')) {
    const { total, unit, totalCost } = totalByCategory(
      (item) => textMatchesKeywords(item.description, ['window', 'glazing']),
      isCostQuestion
    )
    if (total > 0) {
      let summary = `Window count: ${formatQuantity(total, unit)}.`
      if (isCostQuestion && totalCost > 0) {
        summary += ` Total cost: $${totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`
      }
      summaries.push(summary)
    }
  }

  return summaries.length > 0 ? summaries.join('\n') : null
}

function filterChunksByKeywords(chunks: PlanTextChunkRecord[], keywords: string[]): PlanTextChunkRecord[] {
  if (!keywords.length) return []
  return chunks.filter((chunk) => textMatchesKeywords(chunk.snippet_text, keywords))
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
  const normalizedMessage = normalizeKey(userText) ?? ''

  // Extract page number if present
  const pageMatch = lower.match(/page\s*(\d+)/)
  const requestedPage = pageMatch ? Number(pageMatch[1]) : null
  const hasPageFilter = requestedPage !== null && Number.isFinite(requestedPage)

  // Check for cost-related questions - these need LLM to synthesize takeoff + blueprint
  const costKeywords = ['expensive', 'cost', 'price', 'pricing', 'budget', 'why is', 'how much does']
  const isCostQuestion = costKeywords.some((keyword) => lower.includes(keyword))
  if (isCostQuestion) {
    // Let LLM handle cost questions - it needs to combine takeoff cost data with blueprint context
    return null
  }

  // If query has both page filter AND category/keyword, let LLM handle it for better synthesis
  const hasCategoryKeyword = normalizedMessage.includes('categor') || normalizedMessage.includes('item')
  if (hasPageFilter && hasCategoryKeyword) {
    // Complex query - let LLM combine page-filtered takeoff + blueprint snippets
    return null
  }

  // Simple page-only query
  if (hasPageFilter && !hasCategoryKeyword) {
    const pageItems = takeoff.items.filter(
      (item) =>
        item.page_number === requestedPage ||
        (item.page_reference && item.page_reference.toLowerCase().includes(`page ${requestedPage}`))
    )

    if (pageItems.length > 0) {
      const lines = pageItems.map(formatItemLine)
      return [
        `Items tagged to page ${requestedPage}:`,
        ...lines,
        '',
        'Let me know if you want more detail about any of these.',
      ].join('\n')
    }
    // If no items found for page, let LLM handle it (might need blueprint snippets)
    return null
  }

  // Simple category match (no page filter)
  const matchedCategory = findMatchingCategoryBucket(userText, takeoff.categories)
  if (matchedCategory && matchedCategory.items.length > 0 && !hasPageFilter) {
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

  // Simple "categories" query (no page filter, no specific category)
  if (normalizedMessage.includes('categor') && !hasPageFilter) {
    const sorted = [...takeoff.categories].sort((a, b) => b.totalQuantity - a.totalQuantity)
    const meaningful = sorted.filter(
      (bucket) => bucket.items.length > 0 || (bucket.totalQuantity ?? 0) > 0 || bucket.totalCost > 0
    )

    if (normalizedMessage.includes('top') && meaningful.length > 0) {
      const topThree = meaningful.slice(0, 3)
      const lines = topThree.map((bucket, index) => {
        const quantityText = formatQuantity(bucket.totalQuantity, bucket.representativeUnit || undefined)
        return `${index + 1}) ${bucket.label}: ${quantityText} (${bucket.items.length} items)`
      })
      return [
        'Based on the available takeoff data, here are the leading categories by total quantity:',
        ...lines,
      ].join('\n')
    }

    if (meaningful.length > 0) {
      const lines = meaningful.slice(0, 8).map((bucket, index) => {
        const quantityText =
          bucket.totalQuantity > 0
            ? formatQuantity(bucket.totalQuantity, bucket.representativeUnit || undefined)
            : 'No quantity recorded'
        const costText =
          bucket.totalCost && bucket.totalCost > 0
            ? ` · Cost: $${bucket.totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            : ''
        return `${index + 1}) ${bucket.label}: ${quantityText} (${bucket.items.length} items)${costText}`
      })

      return [
        'Here is what I can tell you about the categories in this takeoff:',
        ...lines,
        meaningful.length > 8
          ? `…and ${meaningful.length - 8} more categories. Ask about any specific one for details.`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
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

  const contextResult = await loadPlanContext(supabase, user.id, jobId, planId)

  let planInfo: any = null
  let jobInfo: { id: string; name: string } | null = null
  let takeoffData:
    | {
        id: string
        items: NormalizedTakeoffItem[]
        summary: any
        lastUpdated: string | null
        categories: TakeoffCategoryBucket[]
      }
    | null = null

  if ('error' in contextResult) {
    if (contextResult.error === 'JOB_NOT_FOUND') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (contextResult.error === 'PLAN_NOT_FOUND') {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    if (contextResult.error === 'TAKEOFF_NOT_FOUND') {
      planInfo = contextResult.plan
      takeoffData = null
      jobInfo = contextResult.job ?? null
    } else {
      return NextResponse.json({ error: 'Failed to load takeoff analysis' }, { status: 500 })
    }
  } else {
    planInfo = contextResult.plan
    takeoffData = contextResult.takeoff
    jobInfo = contextResult.job
  }

  if (!planInfo) {
    planInfo = {}
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

  const latestUserMessage = [...sanitizedHistory].reverse().find((message) => message.role === 'user')

  const hasTakeoffData = Boolean(takeoffData && takeoffData.items.length > 0)

  const requestedPages = extractPageNumbers(latestUserMessage?.content ?? '')
  const collectedChunks = new Map<string, PlanTextChunkRecord>()

  if (requestedPages.length > 0) {
    try {
      const pageChunks = await fetchPlanTextChunksByPage(
        supabase,
        planId,
        requestedPages,
        Math.max(requestedPages.length * 12, 24)
      )
      for (const chunk of pageChunks) {
        if (!collectedChunks.has(chunk.id)) {
          collectedChunks.set(chunk.id, chunk)
        }
      }
    } catch (error) {
      console.error('Failed to load plan text chunks by page:', error)
    }
  }

  if (latestUserMessage?.content) {
    try {
      const remainingSlots = Math.max(0, 12 - collectedChunks.size)
      if (remainingSlots > 0) {
        const vectorChunks = await retrievePlanTextChunks(
          supabase,
          planId,
          latestUserMessage.content,
          remainingSlots
        )
        for (const chunk of vectorChunks) {
          if (!collectedChunks.has(chunk.id)) {
            collectedChunks.set(chunk.id, chunk)
          }
        }
      }
    } catch (error) {
      console.error('Failed to retrieve plan text chunks:', error)
    }
  }

  if (collectedChunks.size === 0) {
    try {
      const sampleChunks = await fetchPlanTextChunksSample(supabase, planId, 12)
      for (const chunk of sampleChunks) {
        collectedChunks.set(chunk.id, chunk)
      }
    } catch (error) {
      console.error('Failed to load sample plan text chunks:', error)
    }
  }

  const basePlanTextChunks = Array.from(collectedChunks.values())
  const questionKeywords = extractQuestionKeywords(latestUserMessage?.content)
  
  // Detect cost questions early to reduce blueprint snippets
  const userTextLower = latestUserMessage?.content.toLowerCase() ?? ''
  const costKeywords = [
    'expensive',
    'cost',
    'price',
    'pricing',
    'budget',
    'why is',
    'how much does',
    'how did you get',
    'how did you calculate',
    'how was this calculated',
    'cost estimate',
    'current price',
    'current cost',
  ]
  const isCostQuestionEarly = costKeywords.some((keyword) => userTextLower.includes(keyword))
  
  const keywordFilteredChunks =
    questionKeywords.length > 0 ? filterChunksByKeywords(basePlanTextChunks, questionKeywords) : []
  const planTextChunksForContext =
    keywordFilteredChunks.length > 0 ? keywordFilteredChunks : basePlanTextChunks
  // For cost questions, use fewer blueprint snippets to prioritize takeoff data
  const maxSnippets = isCostQuestionEarly ? 3 : MAX_BLUEPRINT_SNIPPETS
  const snippetChunksForMessages = planTextChunksForContext.slice(0, maxSnippets)
  const planTextSnippetPayloads = buildPlanTextSnippetPayloads(snippetChunksForMessages)
  const hasBlueprintText = planTextSnippetPayloads.length > 0

  // Filter takeoff items: first by page (if requested), then by keywords
  let relevantTakeoffItems: NormalizedTakeoffItem[] = []
  if (takeoffData) {
    relevantTakeoffItems = takeoffData.items

    // Apply page filter first if requested
    if (requestedPages.length > 0) {
      relevantTakeoffItems = relevantTakeoffItems.filter((item) => {
        const pageNum = item.page_number
        const hasMatchingPageNumber =
          typeof pageNum === 'number' &&
          Number.isFinite(pageNum) &&
          requestedPages.includes(pageNum)
        const hasMatchingPageReference =
          item.page_reference &&
          requestedPages.some((page) =>
            item.page_reference?.toLowerCase().includes(`page ${page}`)
          )
        return hasMatchingPageNumber || hasMatchingPageReference
      })
    }

    // Then apply keyword filtering
    if (questionKeywords.length > 0) {
      relevantTakeoffItems = filterTakeoffItemsByKeywords(relevantTakeoffItems, questionKeywords)
    }
  }

  // Use the early cost question detection
  const isCostQuestion = isCostQuestionEarly

  // For cost questions, if we didn't find items via keywords, try to find items mentioned in the question
  if (isCostQuestion && relevantTakeoffItems.length === 0 && takeoffData) {
    // Handle category paths like "exterior > roofing > asphalt shingles"
    const categoryPathMatch = userTextLower.match(/(?:for|about|estimate for)\s+([^?]+)/)
    if (categoryPathMatch) {
      const pathText = categoryPathMatch[1].trim()
      const pathParts = pathText.split(/>|and/).map((p) => p.trim().toLowerCase())
      
      const potentialMatches = takeoffData.items.filter((item) => {
        const itemText = `${item.description || ''} ${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase()
        // Match if all path parts are found in the item text
        return pathParts.every((part) => part.length > 2 && itemText.includes(part))
      })
      
      if (potentialMatches.length > 0) {
        relevantTakeoffItems = potentialMatches
      }
    }
    
    // Fallback: Extract potential item names from the question
    if (relevantTakeoffItems.length === 0) {
      const questionWords = userTextLower.split(/\s+/).filter((word) => word.length > 3)
      const potentialMatches = takeoffData.items.filter((item) => {
        const itemText = `${item.description || ''} ${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase()
        return questionWords.some((word) => itemText.includes(word))
      })
      if (potentialMatches.length > 0) {
        relevantTakeoffItems = potentialMatches
      }
    }
  }

  // For cost questions, build a detailed cost breakdown
  // ALWAYS show takeoff items for cost questions, even if they don't have costs
  let costBreakdown: string | null = null
  if (isCostQuestion && relevantTakeoffItems.length > 0) {
    const itemsWithCosts = relevantTakeoffItems.filter(
      (item) => typeof item.total_cost === 'number' && item.total_cost > 0
    )
    
    if (itemsWithCosts.length > 0) {
      // Items with costs - show full breakdown
      const totalCost = itemsWithCosts.reduce((sum, item) => sum + (item.total_cost || 0), 0)
      const lines = itemsWithCosts.slice(0, 12).map((item) => {
        const quantity = formatQuantity(item.quantity, item.unit)
        const cost = item.total_cost || 0
        const unitCost =
          typeof item.quantity === 'number' && item.quantity > 0
            ? ` ($${(cost / item.quantity).toLocaleString('en-US', { maximumFractionDigits: 2 })}/${item.unit || 'unit'})`
            : ''
        return `• ${item.description || item.name || 'Item'}: ${quantity} — $${cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}${unitCost}`
      })
      costBreakdown = [
        `Cost breakdown (${itemsWithCosts.length} item${itemsWithCosts.length === 1 ? '' : 's'}):`,
        ...lines,
        itemsWithCosts.length > 12 ? `…and ${itemsWithCosts.length - 12} more items with costs.` : '',
        `Total: $${totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      ]
        .filter(Boolean)
        .join('\n')
    } else {
      // No costs, but show quantities so the model can still answer
      const lines = relevantTakeoffItems.slice(0, 15).map((item) => {
        const quantity = formatQuantity(item.quantity, item.unit)
        const category = item.category ? `${item.category}: ` : ''
        return `• ${category}${item.description || item.name || 'Item'}: ${quantity}`
      })
      costBreakdown = [
        `Takeoff items found (${relevantTakeoffItems.length} item${relevantTakeoffItems.length === 1 ? '' : 's'}, no cost data available):`,
        ...lines,
        relevantTakeoffItems.length > 15 ? `…and ${relevantTakeoffItems.length - 15} more items.` : '',
        'Note: Cost data is not available in the takeoff. Use these quantities and explain that costs would need to be calculated based on current material/labor rates.',
      ]
        .filter(Boolean)
        .join('\n')
    }
  }

  const takeoffHighlights =
    relevantTakeoffItems.length > 0
      ? summarizeTakeoffItems(relevantTakeoffItems, 8, isCostQuestion)
      : null

  const structuredStats =
    relevantTakeoffItems.length > 0
      ? buildStructuredStats(relevantTakeoffItems, questionKeywords, isCostQuestion)
      : null

  if (!hasTakeoffData && !hasBlueprintText) {
    return NextResponse.json({
      reply:
        "I don't have takeoff results or processed blueprint text for this plan yet. Once the plan ingestion or takeoff analysis finishes, try again and I'll take another look.",
    })
  }

  let takeoffContext: TakeoffContextPayload | null = null
  let deterministicAnswer: string | null = null
  const latestMessageNormalized = normalizeKey(latestUserMessage?.content ?? '') ?? ''

  if (takeoffData) {
    takeoffContext = buildTakeoffContext(planInfo, takeoffData.items, takeoffData.lastUpdated ?? null)

    deterministicAnswer = buildDeterministicAnswer(latestUserMessage, {
      items: takeoffData.items,
      categories: takeoffData.categories,
    })

    if (
      deterministicAnswer &&
      (latestMessageNormalized.includes('page') ||
        latestMessageNormalized.includes('categor') ||
        latestMessageNormalized.includes('door') ||
        latestMessageNormalized.includes('window') ||
        latestMessageNormalized.includes('item') ||
        latestMessageNormalized.includes('summar'))
    ) {
      return NextResponse.json({ reply: deterministicAnswer })
    }
  }

  const systemPromptSections = [PLAN_CHAT_SYSTEM_PROMPT.trim()]

  if (isCostQuestion) {
    systemPromptSections.push(
      '🚨 CRITICAL INSTRUCTIONS FOR COST QUESTIONS:\n' +
      '1. You will receive takeoff data in a separate system message marked "CRITICAL" or "TAKEOFF DATA".\n' +
      '2. You MUST start your answer with that takeoff data - show line items, quantities, and costs.\n' +
      '3. DO NOT start with blueprint snippets. Blueprint snippets are ONLY for additional context at the end.\n' +
      '4. If takeoff data shows costs: explain HOW the cost was calculated (quantity × unit price = total).\n' +
      '5. If takeoff data shows quantities but no costs: explain what quantities exist and note that costs need to be calculated.\n' +
      '6. Blueprint snippets should ONLY be used to explain WHY something might be expensive (special materials, complexity, etc.).\n' +
      '7. Your answer structure: [Takeoff data first] → [Explanation of costs/quantities] → [Blueprint context if relevant].\n' +
      '8. DO NOT just dump blueprint text. Synthesize everything into a coherent, human explanation.'
    )
  }

  if (!hasTakeoffData) {
    systemPromptSections.push(
      'Structured takeoff data is not available for this plan. Make it clear to the user that takeoff data is missing when relevant.'
    )
  }

  if (!hasBlueprintText) {
    systemPromptSections.push(
      'Blueprint text snippets are not available, so rely entirely on the takeoff data. If the takeoff does not include the requested information, explain the gap.'
    )
  }

  const systemPrompt = systemPromptSections.join('\n\n')
  const planTitle = planInfo?.title || planInfo?.file_name || 'this plan'
  const takeoffHighlightsList = takeoffHighlights
    ? takeoffHighlights
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 8)
    : null
  const structuredStatsList = structuredStats
    ? structuredStats
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 6)
    : null

  const planContextPayload = {
    job: jobInfo ? { id: jobInfo.id, name: jobInfo.name } : null,
    plan: {
      id: planInfo?.id ?? null,
      title: planTitle,
      fileName: planInfo?.file_name ?? null,
      jobId: planInfo?.job_id ?? null,
    },
    takeoffSummary: takeoffContext?.takeoff.summary ?? null,
    topTakeoffCategories: takeoffContext?.takeoff.topCategories ?? null,
    sampleTakeoffItems: takeoffContext?.takeoff.representativeItems ?? null,
    takeoffHighlights: takeoffHighlightsList,
    computedStats: structuredStatsList,
    costBreakdown: costBreakdown, // Prominent cost data for cost questions
    blueprintSnippets: planTextSnippetPayloads,
    requestedPages,
    keywordHints: questionKeywords,
    hasTakeoffData,
    hasBlueprintText,
  }

  // Build context messages - prioritize cost data when present
  const contextMessages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
  ]

  // For cost questions, put cost breakdown FIRST and prominently
  if (isCostQuestion && costBreakdown) {
    contextMessages.push({
      role: 'system',
      content: `⚠️ CRITICAL: The user is asking about cost/price. You MUST use the takeoff data below to answer. DO NOT just list blueprint snippets.\n\nTAKEOFF DATA (USE THIS):\n${costBreakdown}\n\nYour answer MUST start with this takeoff data. Blueprint snippets are ONLY for additional context to explain why something might be expensive.`,
    })
  } else if (isCostQuestion && !costBreakdown && takeoffHighlights) {
    // Fallback: if no cost breakdown but we have highlights, use those
    contextMessages.push({
      role: 'system',
      content: `⚠️ CRITICAL: The user is asking about cost/price. Use the takeoff items below. DO NOT just list blueprint snippets.\n\nTAKEOFF ITEMS:\n${takeoffHighlights}\n\nYour answer MUST start with this takeoff data.`,
    })
  }

  // Then add the full plan context
  const planContextMessage = {
    role: 'system' as const,
    content: `Plan context (JSON):\n${JSON.stringify(planContextPayload, null, 2)}`,
  }
  contextMessages.push(planContextMessage)

  // Add few-shot examples
  contextMessages.push(...PLAN_CHAT_FEW_SHOTS)

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      max_completion_tokens: 600,
      messages: [...contextMessages, ...sanitizedHistory],
    })

    const reply = completion.choices[0]?.message?.content?.trim()

    if (!reply) {
      if (deterministicAnswer) {
        return NextResponse.json({ reply: deterministicAnswer })
      }
      if (planTextChunksForContext.length > 0) {
        return NextResponse.json({
          reply: buildSnippetSummary(
            latestUserMessage?.content ?? '',
            planTextChunksForContext,
            requestedPages
          ),
        })
      }
      return NextResponse.json({
        reply: hasBlueprintText
          ? "I reviewed the available blueprint snippets, but they don't contain enough detail to answer that. Try referencing a specific page, sheet title, or note, and I'll take another look."
          : "I reviewed the takeoff for this plan, but I couldn't find enough detail to answer that. Try asking about specific categories, quantities, or sheet locations from the takeoff, and I'll take another look.",
      })
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Plan Chat completion failed', error)
    if (deterministicAnswer) {
      return NextResponse.json({ reply: deterministicAnswer })
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
