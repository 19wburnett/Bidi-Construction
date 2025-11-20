import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanChatQuestionClassification } from './classifier'
import { matchesTargets, scoreMatch } from './fuzzy'
import {
  retrievePlanTextChunks,
  fetchPlanTextChunksByPage,
  type PlanTextChunkRecord,
} from '@/lib/plan-text-chunks'

type GenericSupabase = SupabaseClient<any, any, any>

export interface PlanChatDeterministicResult {
  question: string
  classification: PlanChatQuestionClassification
  scope_description: string
  totals?: {
    quantity?: { value: number; unit: string }
    cost?: { value: number; currency: string }
  }
  breakdowns?: {
    by_level?: Array<{
      level: string
      quantity: number
      unit: string
      cost?: number
    }>
    by_category?: Array<{
      category: string
      quantity: number
      unit: string
      cost?: number
    }>
  }
  related_items: Array<{
    id: string
    name: string
    category: string
    level?: string
    page_number?: number
    quantity?: number
    unit?: string
    cost_total?: number
  }>
  blueprint_snippets?: Array<{
    text: string
    page_number?: number
    sheet_name?: string
  }>
}

interface NormalizedTakeoffItem {
  id?: string
  category?: string | null
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

/**
 * Normalizes takeoff items from various formats
 */
function normalizeTakeoffItems(raw: any): NormalizedTakeoffItem[] {
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
    const parseQuantity = (value: any): number | null => {
      if (value === null || value === undefined) return null
      if (typeof value === 'number') return Number.isFinite(value) ? value : null
      const match = String(value).match(/-?\d[\d,]*(\.\d+)?/)
      if (!match) return null
      const numeric = parseFloat(match[0].replace(/,/g, ''))
      return Number.isFinite(numeric) ? numeric : null
    }

    const parseCurrency = (value: any): number | null => {
      if (value === null || value === undefined) return null
      if (typeof value === 'number') return Number.isFinite(value) ? value : null
      const match = String(value).match(/-?\d[\d,]*(\.\d+)?/)
      if (!match) return null
      const numeric = parseFloat(match[0].replace(/,/g, ''))
      return Number.isFinite(numeric) ? numeric : null
    }

    const coalesceString = (...values: any[]): string | null => {
      for (const value of values) {
        if (value === null || value === undefined) continue
        const stringified = typeof value === 'string' ? value : String(value)
        const trimmed = stringified.trim()
        if (trimmed.length > 0) return trimmed
      }
      return null
    }

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

    const pageNumber = parseQuantity(
      item.page_number ?? item.pageNumber ?? item.page ?? item.plan_page_number ?? item.sheet_page ?? item.sheetNumber ?? item.bounding_box?.page
    )

    const pageReference = coalesceString(
      item.page_reference,
      item.sheet_reference,
      item.sheet,
      item.sheet_title,
      item.sheetName,
      item.page_label
    )

    const rawQuantityValue = item.quantity ?? item.qty ?? item.amount
    const quantity = parseQuantity(rawQuantityValue)
    const unit = coalesceString(item.unit, item.units, item.measure_unit) || null
    const unitCost = parseCurrency(item.unit_cost ?? item.unitCost ?? item.unit_price)
    const totalCost = parseCurrency(item.total_cost ?? item.totalCost ?? item.extended_price)

    const notes = coalesceString(item.notes, item.assumptions, item.comments)

    return {
      id: coalesceString(item.id, item.uuid, item.item_id) ?? `item-${index + 1}`,
      category,
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

/**
 * Loads takeoff items from the database
 */
async function loadTakeoffItems(
  supabase: GenericSupabase,
  planId: string,
  userId: string
): Promise<NormalizedTakeoffItem[]> {
  const { data: takeoffRow, error } = await supabase
    .from('plan_takeoff_analysis')
    .select('id, items')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !takeoffRow) {
    return []
  }

  return normalizeTakeoffItems(takeoffRow.items)
}

/**
 * Filters and matches takeoff items based on classification
 */
function filterTakeoffItems(
  items: NormalizedTakeoffItem[],
  classification: PlanChatQuestionClassification
): NormalizedTakeoffItem[] {
  // If no targets specified and it's a general question, return all items
  if (classification.targets.length === 0 && !classification.strict_takeoff_only) {
    let filtered = items
    
    // Still apply page filter if specified
    if (classification.pages && classification.pages.length > 0) {
      filtered = filtered.filter((item) => {
        if (item.page_number && classification.pages!.includes(item.page_number)) {
          return true
        }
        if (item.page_reference) {
          return classification.pages!.some((page) =>
            item.page_reference?.toLowerCase().includes(`page ${page}`)
          )
        }
        return false
      })
    }
    
    return filtered
  }

  let filtered = items

  // Filter by page numbers if specified
  if (classification.pages && classification.pages.length > 0) {
    filtered = filtered.filter((item) => {
      if (item.page_number && classification.pages!.includes(item.page_number)) {
        return true
      }
      if (item.page_reference) {
        return classification.pages!.some((page) =>
          item.page_reference?.toLowerCase().includes(`page ${page}`)
        )
      }
      return false
    })
  }

  // Filter by targets (fuzzy matching) - only if targets are specified
  if (classification.targets.length > 0) {
    // Score all items and keep those above threshold
    const scored = filtered.map((item) => {
      const searchText = [
        item.category,
        item.subcategory,
        item.name,
        item.description,
        item.location,
      ]
        .filter(Boolean)
        .join(' ')

      const score = scoreMatch(searchText, classification.targets, 0.4) // Lowered threshold from 0.5 to 0.4
      return { item, score }
    })

    // Keep items with score > 0.4 (lowered from 0.5)
    filtered = scored
      .filter(({ score }) => score > 0.4)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
    
    // If we filtered out everything but had targets, maybe the matching is too strict
    // Try a more lenient match
    if (filtered.length === 0 && items.length > 0) {
      const lenientScored = items.map((item) => {
        const searchText = [
          item.category,
          item.subcategory,
          item.name,
          item.description,
          item.location,
        ]
          .filter(Boolean)
          .join(' ')

        const score = scoreMatch(searchText, classification.targets, 0.3) // Even more lenient
        return { item, score }
      })

      filtered = lenientScored
        .filter(({ score }) => score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20) // Limit to top 20 matches
        .map(({ item }) => item)
    }
  }

  // Filter by levels if specified
  if (classification.levels && classification.levels.length > 0) {
    filtered = filtered.filter((item) => {
      const location = (item.location || '').toLowerCase()
      return classification.levels!.some((level) => location.includes(level.toLowerCase()))
    })
  }

  return filtered
}

/**
 * Builds the deterministic result based on classification and data
 */
export async function buildDeterministicResult({
  supabase,
  jobId,
  planId,
  userId,
  question,
  classification,
}: {
  supabase: GenericSupabase
  jobId: string
  planId: string
  userId: string
  question: string
  classification: PlanChatQuestionClassification
}): Promise<PlanChatDeterministicResult> {
  const result: PlanChatDeterministicResult = {
    question,
    classification,
    scope_description: '',
    related_items: [],
  }

  // Load takeoff items
  const allItems = await loadTakeoffItems(supabase, planId, userId)
  const isTakeoffQuestion =
    classification.question_type === 'TAKEOFF_QUANTITY' ||
    classification.question_type === 'TAKEOFF_COST' ||
    classification.question_type === 'COMBINED' ||
    // Also process takeoff for OTHER questions if they seem general/project-related
    (classification.question_type === 'OTHER' && 
     (question.toLowerCase().includes('project') || 
      question.toLowerCase().includes('what kind') ||
      question.toLowerCase().includes('tell me about')))

  // Process takeoff data if needed
  if (isTakeoffQuestion && allItems.length > 0) {
    const matchedItems = filterTakeoffItems(allItems, classification)

    // Build related items
    result.related_items = matchedItems.slice(0, 50).map((item) => ({
      id: item.id || 'unknown',
      name: item.name || item.description || 'Item',
      category: item.category || 'Uncategorized',
      level: item.location || undefined,
      page_number: item.page_number || undefined,
      quantity: item.quantity || undefined,
      unit: item.unit || undefined,
      cost_total: item.total_cost || undefined,
    }))

    // Calculate totals
    const totalQuantity = matchedItems.reduce((sum, item) => {
      const qty = item.quantity ?? 0
      return sum + (Number.isFinite(qty) ? qty : 0)
    }, 0)

    const totalCost = matchedItems.reduce((sum, item) => {
      const cost = item.total_cost ?? 0
      return sum + (Number.isFinite(cost) ? cost : 0)
    }, 0)

    // Determine unit (most common unit)
    const unitCounts = new Map<string, number>()
    matchedItems.forEach((item) => {
      if (item.unit) {
        unitCounts.set(item.unit, (unitCounts.get(item.unit) || 0) + 1)
      }
    })
    const mostCommonUnit =
      Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'units'

    if (totalQuantity > 0 || totalCost > 0) {
      result.totals = {}
      if (totalQuantity > 0) {
        result.totals.quantity = { value: totalQuantity, unit: mostCommonUnit }
      }
      if (totalCost > 0) {
        result.totals.cost = { value: totalCost, currency: 'USD' }
      }
    }

    // Build breakdowns
    if (matchedItems.length > 0) {
      // By category
      const byCategory = new Map<
        string,
        { quantity: number; cost: number; unit: string | null }
      >()
      matchedItems.forEach((item) => {
        const cat = item.category || 'Uncategorized'
        const current = byCategory.get(cat) || { quantity: 0, cost: 0, unit: null }
        current.quantity += item.quantity ?? 0
        current.cost += item.total_cost ?? 0
        if (!current.unit && item.unit) {
          current.unit = item.unit
        }
        byCategory.set(cat, current)
      })

      if (byCategory.size > 0) {
        result.breakdowns = {
          by_category: Array.from(byCategory.entries())
            .map(([category, data]) => ({
              category,
              quantity: data.quantity,
              unit: data.unit || 'units',
              cost: data.cost > 0 ? data.cost : undefined,
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10),
        }
      }
    }

    // Build scope description
    if (matchedItems.length > 0) {
      const categories = Array.from(new Set(matchedItems.map((i) => i.category).filter(Boolean)))
      result.scope_description = `Found ${matchedItems.length} item${
        matchedItems.length === 1 ? '' : 's'
      }${categories.length > 0 ? ` across ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}` : ''}`
    } else {
      result.scope_description = 'No matching items found in takeoff'
    }
  }

  // Fetch blueprint snippets if needed
  const needsBlueprints =
    classification.question_type === 'PAGE_CONTENT' ||
    classification.question_type === 'BLUEPRINT_CONTEXT' ||
    (classification.question_type === 'COMBINED' && result.related_items.length === 0)

  if (needsBlueprints) {
    let chunks: PlanTextChunkRecord[] = []

    // If pages specified, fetch by page
    if (classification.pages && classification.pages.length > 0) {
      chunks = await fetchPlanTextChunksByPage(supabase, planId, classification.pages, 5)
    } else {
      // Otherwise use vector search
      chunks = await retrievePlanTextChunks(supabase, planId, question, 5)
    }

    result.blueprint_snippets = chunks.map((chunk) => ({
      text: chunk.snippet_text,
      page_number: chunk.page_number || undefined,
      sheet_name:
        (chunk.metadata?.sheet_title as string) ||
        (chunk.metadata?.sheet_id as string) ||
        undefined,
    }))

    if (result.scope_description === '' && chunks.length > 0) {
      result.scope_description = `Found ${chunks.length} relevant blueprint snippet${
        chunks.length === 1 ? '' : 's'
      }`
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[PlanChat] deterministic result:', JSON.stringify(result, null, 2))
  }

  return result
}

