import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'
import { classifyPlanChatQuestion } from '@/lib/planChat/classifier'
import { buildDeterministicResult } from '@/lib/planChat/deterministicEngine'
import { generatePlanChatAnswer } from '@/lib/planChat/answerModel'
import type { PlanTextChunkRecord } from '@/lib/plan-text-chunks'
import { generateAnswer } from '@/lib/plan-chat-v3'
import { updateChatTitleIfNeeded } from '@/lib/plan-chat-v3/chat-title-generator'

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

const REPRESENTATIVE_ITEM_LIMIT = 12
const TOP_CATEGORY_LIMIT = 8
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
  // Group by category AND unit to avoid mixing incompatible units (e.g., SF + LF)
  const totals = new Map<string, { total: number; unit: string; itemCount: number }>()

  for (const item of items) {
    const category = item.category || 'Uncategorized'
    const quantityValue = item.quantity ?? null
    const unit = (item.unit || '').trim().toLowerCase()

    // Only process items with valid quantities
    if (quantityValue !== null && Number.isFinite(quantityValue) && quantityValue > 0) {
      // Normalize unit: treat empty/null as 'units', normalize common variations
      const normalizedUnit = unit || 'units'
      
      // Use composite key: "category|unit" to separate different units within same category
      const key = `${category}|${normalizedUnit}`
      const current = totals.get(key) || { total: 0, unit: normalizedUnit, itemCount: 0 }
      
      totals.set(key, {
        total: current.total + quantityValue,
        unit: current.unit,
        itemCount: current.itemCount + 1,
      })
    }
  }

  // For each category, show the unit type with the most items (most representative)
  // If tied, prefer the one with the largest total
  const categoryGroups = new Map<string, { totalQuantity: number; unit: string; itemCount: number }>()
  
  for (const [key, value] of totals.entries()) {
    const [category] = key.split('|')
    const existing = categoryGroups.get(category)
    
    // Prefer the entry with more items, or if equal, the larger total
    if (!existing || 
        value.itemCount > existing.itemCount ||
        (value.itemCount === existing.itemCount && value.total > existing.totalQuantity)) {
      categoryGroups.set(category, {
        totalQuantity: value.total,
        unit: value.unit,
        itemCount: value.itemCount,
      })
    }
  }

  return Array.from(categoryGroups.entries())
    .map(([category, value]) => ({
      category,
      totalQuantity: Number.isFinite(value.totalQuantity) ? value.totalQuantity : 0,
      unit: value.unit !== 'units' ? value.unit : null,
    }))
    .filter(item => item.totalQuantity > 0) // Only show categories with valid totals
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
  // Check job access through job_members table (supports owners and collaborators)
  const membership = await getJobForUser(supabase, jobId, userId, 'id, name')

  if (!membership || !membership.job) {
    return { error: 'JOB_NOT_FOUND' as const }
  }

  const job = membership.job

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
  exterior: ['exterior', 'exteriors', 'exterior wall', 'exterior finish'],
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

  // Get chatId from query params if provided
  const chatId = request.nextUrl.searchParams.get('chatId')

  // Load chat history from database
  let query = supabase
    .from('plan_chat_messages')
    .select('id, role, content, created_at')
    .eq('plan_id', planId)
    .eq('user_id', user.id)
  
  if (chatId) {
    query = query.eq('chat_id', chatId)
  } else {
    // If no chatId, get messages without chat_id (legacy) or most recent chat
    query = query.is('chat_id', null)
  }
  
  const { data: chatMessages, error: chatError } = await query
    .order('created_at', { ascending: true })

  if (chatError) {
    console.error('Failed to load chat history:', chatError)
    // Continue without chat history - don't fail the request
  }

  return NextResponse.json({
    hasTakeoff: context.takeoff.items.length > 0,
    lastUpdated: context.takeoff.lastUpdated,
    itemCount: context.takeoff.items.length,
    summaryCategories: categories,
    chatHistory: chatMessages || [],
  })
}

export async function POST(request: NextRequest) {
  let payload: { jobId?: string; planId?: string; messages?: ChatHistoryMessage[]; model?: string; chatId?: string } = {}

  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { jobId, planId, messages, model, chatId } = payload

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

  // Check if plan is vectorized (required for chat to work)
  // If not, queue it for background vectorization
  const { checkPlanVectorizationStatus } = await import('@/lib/plan-vectorization-status')
  
  let vectorizationStatus = await checkPlanVectorizationStatus(supabase, planId)
  let wasVectorizing = false
  
  if (!vectorizationStatus.isVectorized) {
    // Check if there's already a job in the queue
    const { data: existingJob } = await supabase
      .from('plan_vectorization_queue')
      .select('id, status, progress')
      .eq('plan_id', planId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingJob) {
      // Job already queued or processing
      return NextResponse.json(
        {
          error: 'VECTORIZATION_IN_PROGRESS',
          message: 'This plan is being vectorized in the background. Please wait a moment and try again.',
          queueJobId: existingJob.id,
          status: existingJob.status,
          progress: existingJob.progress,
        },
        { status: 202 } // 202 Accepted - processing in background
      )
    }

    // Queue vectorization job
    console.log(`[PlanChat] Plan ${planId} is not vectorized. Queueing vectorization...`)
    wasVectorizing = true
    
    try {
      // Create queue job
      const { data: queueJob, error: queueError } = await supabase
        .from('plan_vectorization_queue')
        .insert({
          plan_id: planId,
          user_id: user.id,
          job_id: jobId,
          status: 'pending',
          priority: 10, // Higher priority for user-initiated requests
          progress: 0,
          current_step: 'Queued for processing',
        })
        .select('id')
        .single()

      if (queueError || !queueJob) {
        throw new Error('Failed to queue vectorization job')
      }

      // Trigger background processing (don't wait)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000'
      
      fetch(`${baseUrl}/api/plan-vectorization/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueJobId: queueJob.id }),
      }).catch((error) => {
        console.error('[PlanChat] Failed to trigger vectorization processing:', error)
      })

      return NextResponse.json(
        {
          error: 'VECTORIZATION_QUEUED',
          message: 'This plan is being vectorized in the background. This may take a few minutes for large plans. Please try again in a moment.',
          queueJobId: queueJob.id,
          status: 'pending',
        },
        { status: 202 } // 202 Accepted - processing in background
      )
    } catch (vectorizationError) {
      console.error('[PlanChat] Failed to queue vectorization:', vectorizationError)
      return NextResponse.json(
        {
          error: 'VECTORIZATION_FAILED',
          message: vectorizationError instanceof Error 
            ? `Failed to queue vectorization: ${vectorizationError.message}` 
            : 'Failed to queue vectorization. Please try again in a moment.',
          vectorizationStatus: {
            hasChunks: vectorizationStatus.hasChunks,
            hasEmbeddings: vectorizationStatus.hasEmbeddings,
            chunkCount: vectorizationStatus.chunkCount,
            embeddingCount: vectorizationStatus.embeddingCount,
          },
        },
        { status: 500 }
      )
    }
  }

  // Sanitize messages
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

  if (!latestUserMessage) {
    return NextResponse.json({ error: 'No user message found' }, { status: 400 })
  }

  // Get or create chat session
  let activeChatId = chatId || null
  if (!activeChatId) {
    // Create a new chat session if none provided
    const { data: newSession, error: sessionError } = await supabase
      .from('plan_chat_sessions')
      .insert({
        job_id: jobId,
        plan_id: planId,
        user_id: user.id,
        title: latestUserMessage.content.substring(0, 50) || `Chat ${new Date().toLocaleDateString()}`,
      })
      .select()
      .single()

    if (!sessionError && newSession) {
      activeChatId = newSession.id
    }
  }

  try {
    // Use V3 system (can be toggled with environment variable)
    const useV3 = process.env.PLAN_CHAT_V3_ENABLED !== 'false' // Default to true

    if (useV3) {
      // V3: Cursor-Style Copilot System
      const result = await generateAnswer(
        supabase,
        planId,
        user.id,
        jobId,
        latestUserMessage.content,
        model,
        activeChatId
      )

      // Validate that we have a valid answer
      if (!result || !result.answer || typeof result.answer !== 'string' || result.answer.trim().length === 0) {
        console.error('[PlanChatV3] Invalid answer from generateAnswer:', {
          hasResult: !!result,
          answerType: result?.answer ? typeof result.answer : 'undefined',
          answerLength: result?.answer?.length || 0,
          answerPreview: result?.answer?.substring(0, 100) || 'N/A',
        })
        throw new Error('Failed to generate a valid response. The AI returned an empty or invalid answer.')
      }

      // Also save to legacy plan_chat_messages table for backward compatibility
      try {
        await supabase.from('plan_chat_messages').insert({
          plan_id: planId,
          user_id: user.id,
          job_id: jobId,
          chat_id: activeChatId,
          role: 'user',
          content: latestUserMessage.content,
        })

        await supabase.from('plan_chat_messages').insert({
          plan_id: planId,
          user_id: user.id,
          job_id: jobId,
          chat_id: activeChatId,
          role: 'assistant',
          content: result.answer,
        })
      } catch (dbError) {
        console.error('[PlanChatV3] Failed to save to legacy messages table:', dbError)
        // Don't fail the request if DB save fails
      }

      // Generate/update chat title if needed (async, don't wait)
      if (activeChatId) {
        updateChatTitleIfNeeded(supabase, activeChatId, user.id).catch((error) => {
          console.error('[PlanChatV3] Failed to update chat title:', error)
        })
      }

      return NextResponse.json({
        reply: result.answer.trim(),
        mode: result.mode,
        metadata: {
          ...result.metadata,
          wasVectorizing,
        },
        chatId: activeChatId,
      })
    } else {
      // V2: Legacy system (kept for backward compatibility)
      // Stage 1: Classify the question
      const classification = await classifyPlanChatQuestion(latestUserMessage.content)

      // Stage 2: Build deterministic result
      const deterministicResult = await buildDeterministicResult({
        supabase,
        jobId,
        planId,
        userId: user.id,
        question: latestUserMessage.content,
        classification,
      })

      // Stage 3: Generate answer
      // Get last 3 messages for context
      const recentMessages = sanitizedHistory.slice(-3)
      const answer = await generatePlanChatAnswer(deterministicResult, recentMessages, model)

      // Save messages to database
      try {
        // Save user message
        await supabase.from('plan_chat_messages').insert({
          plan_id: planId,
          user_id: user.id,
          job_id: jobId,
          chat_id: activeChatId,
          role: 'user',
          content: latestUserMessage.content,
        })

        // Save assistant reply
        await supabase.from('plan_chat_messages').insert({
          plan_id: planId,
          user_id: user.id,
          job_id: jobId,
          chat_id: activeChatId,
          role: 'assistant',
          content: answer,
        })
      } catch (dbError) {
        console.error('[PlanChat] Failed to save chat messages to database:', dbError)
        // Don't fail the request if DB save fails
      }

      // Generate/update chat title if needed (async, don't wait)
      if (activeChatId) {
        updateChatTitleIfNeeded(supabase, activeChatId, user.id).catch((error) => {
          console.error('[PlanChat] Failed to update chat title:', error)
        })
      }

      return NextResponse.json({ reply: answer, chatId: activeChatId })
    }
  } catch (error) {
    console.error('[PlanChat] Plan Chat completion failed:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Plan Chat failed to generate a response. Try again later.',
      },
      { status: 500 }
    )
  }
}
