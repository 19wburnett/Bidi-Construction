/**
 * Enhanced Retrieval System (RAG++ Engine) for Plan Chat V3
 * 
 * Multi-layer retrieval system that combines:
 * - Semantic RAG (vector similarity search)
 * - Target-based retrieval (takeoff items)
 * - Dependency-based retrieval (related sheets)
 * - Project metadata retrieval
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  retrievePlanTextChunks,
  fetchPlanTextChunksByPage,
  type PlanTextChunkRecord,
} from '@/lib/plan-text-chunks'
import { matchesTargets, scoreMatch } from '@/lib/planChat/fuzzy'

type GenericSupabase = SupabaseClient<any, any, any>

export interface NormalizedTakeoffItem {
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

export interface RelatedSheet {
  page_number: number
  sheet_id: string | null
  title: string | null
  discipline: string | null
  sheet_type: string | null
}

export interface ProjectMetadata {
  job_name: string | null
  plan_title: string | null
  plan_file_name: string | null
  address: string | null
  disciplines: string[]
  major_quantity_categories: Array<{ category: string; total: number; unit: string | null }>
  major_cost_categories: Array<{ category: string; total: number }>
  sheet_index_summary: Array<{
    page_number: number
    sheet_id: string | null
    title: string | null
    discipline: string | null
    sheet_type: string | null
  }>
}

export interface RetrievalResult {
  semantic_chunks: PlanTextChunkRecord[]
  takeoff_items: NormalizedTakeoffItem[]
  related_sheets: RelatedSheet[]
  project_metadata: ProjectMetadata | null
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
      item.page_number ??
        item.pageNumber ??
        item.page ??
        item.plan_page_number ??
        item.sheet_page ??
        item.sheetNumber ??
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
 * A. Semantic RAG - Vector similarity search over blueprint chunks
 * Expanded to 10-12 chunks, grouped by page/sheet
 */
async function retrieveSemanticChunks(
  supabase: GenericSupabase,
  planId: string,
  query: string,
  limit = 12
): Promise<PlanTextChunkRecord[]> {
  try {
    return await retrievePlanTextChunks(supabase, planId, query, limit)
  } catch (error) {
    console.error('[RetrievalEngine] Semantic RAG failed:', error)
    return []
  }
}

/**
 * B. Target-Based Retrieval - Find takeoff items matching user targets
 */
export async function findTakeoffItemsByTarget(
  supabase: GenericSupabase,
  planId: string,
  userId: string,
  targets: string[]
): Promise<NormalizedTakeoffItem[]> {
  if (targets.length === 0) {
    return []
  }

  // Load takeoff items
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

  const allItems = normalizeTakeoffItems(takeoffRow.items)

  // Fuzzy match against targets
  const matchedItems = allItems
    .map((item) => {
      const searchText = [
        item.category,
        item.subcategory,
        item.name,
        item.description,
        item.location,
      ]
        .filter(Boolean)
        .join(' ')

      const score = scoreMatch(searchText, targets, 0.4)
      return { item, score }
    })
    .filter(({ score }) => score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50) // Limit to top 50 matches
    .map(({ item }) => item)

  return matchedItems
}

/**
 * C. Dependency-Based Retrieval - Find related sheets/pages
 * For blueprint questions, automatically fetch related pages
 */
export async function findRelatedSheets(
  supabase: GenericSupabase,
  planId: string,
  initialPagesOrTargets: number[] | string[]
): Promise<RelatedSheet[]> {
  const relatedSheets: RelatedSheet[] = []

  // If we have page numbers, fetch those sheets
  if (initialPagesOrTargets.length > 0 && typeof initialPagesOrTargets[0] === 'number') {
    const pageNumbers = initialPagesOrTargets as number[]
    const { data: sheets, error } = await supabase
      .from('plan_sheet_index')
      .select('page_no, sheet_id, title, discipline, sheet_type')
      .eq('plan_id', planId)
      .in('page_no', pageNumbers)

    if (!error && sheets) {
      relatedSheets.push(
        ...sheets.map((sheet) => ({
          page_number: sheet.page_no,
          sheet_id: sheet.sheet_id,
          title: sheet.title,
          discipline: sheet.discipline,
          sheet_type: sheet.sheet_type,
        }))
      )
    }
  }

  // If we have targets (like "roof"), find sheets that might be related
  if (initialPagesOrTargets.length > 0 && typeof initialPagesOrTargets[0] === 'string') {
    const targets = initialPagesOrTargets as string[]
    const targetLower = targets.join(' ').toLowerCase()

    // Search in sheet titles and disciplines
    const { data: allSheets, error } = await supabase
      .from('plan_sheet_index')
      .select('page_no, sheet_id, title, discipline, sheet_type')
      .eq('plan_id', planId)

    if (!error && allSheets) {
      const matchingSheets = allSheets.filter((sheet) => {
        const title = (sheet.title || '').toLowerCase()
        const discipline = (sheet.discipline || '').toLowerCase()
        const sheetType = (sheet.sheet_type || '').toLowerCase()
        const combined = `${title} ${discipline} ${sheetType}`

        return targets.some((target) => combined.includes(target.toLowerCase()))
      })

      relatedSheets.push(
        ...matchingSheets.map((sheet) => ({
          page_number: sheet.page_no,
          sheet_id: sheet.sheet_id,
          title: sheet.title,
          discipline: sheet.discipline,
          sheet_type: sheet.sheet_type,
        }))
      )
    }
  }

  // Deduplicate by page number
  const seen = new Set<number>()
  return relatedSheets.filter((sheet) => {
    if (seen.has(sheet.page_number)) {
      return false
    }
    seen.add(sheet.page_number)
    return true
  })
}

/**
 * D. Project Metadata Retrieval - Pull global metadata
 */
export async function getProjectMetadata(
  supabase: GenericSupabase,
  planId: string,
  jobId: string | null
): Promise<ProjectMetadata | null> {
  try {
    // Load plan and job info
    const planQuery = supabase.from('plans').select('id, title, file_name, job_id').eq('id', planId).single()

    let jobQuery = null
    if (jobId) {
      jobQuery = supabase.from('jobs').select('id, name, location').eq('id', jobId).single()
    }

    const [planResult, jobResult] = await Promise.all([planQuery, jobQuery])

    if (planResult.error || !planResult.data) {
      return null
    }

    const plan = planResult.data
    const job = jobResult?.data || null

    // Load takeoff items for category summaries
    const { data: takeoffRow } = await supabase
      .from('plan_takeoff_analysis')
      .select('items')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const items = takeoffRow ? normalizeTakeoffItems(takeoffRow.items) : []

    // Build category summaries
    const quantityByCategory = new Map<string, { total: number; unit: string | null }>()
    const costByCategory = new Map<string, number>()

    items.forEach((item) => {
      const category = item.category || 'Uncategorized'
      if (item.quantity !== null && item.quantity !== undefined) {
        const current = quantityByCategory.get(category) || { total: 0, unit: null }
        current.total += item.quantity
        current.unit = current.unit || item.unit || null
        quantityByCategory.set(category, current)
      }
      if (item.total_cost !== null && item.total_cost !== undefined) {
        const current = costByCategory.get(category) || 0
        costByCategory.set(category, current + item.total_cost)
      }
    })

    const majorQuantityCategories = Array.from(quantityByCategory.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        unit: data.unit,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const majorCostCategories = Array.from(costByCategory.entries())
      .map(([category, total]) => ({
        category,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Load sheet index
    const { data: sheets } = await supabase
      .from('plan_sheet_index')
      .select('page_no, sheet_id, title, discipline, sheet_type')
      .eq('plan_id', planId)
      .order('page_no', { ascending: true })

    const sheetIndexSummary =
      sheets?.map((sheet) => ({
        page_number: sheet.page_no,
        sheet_id: sheet.sheet_id,
        title: sheet.title,
        discipline: sheet.discipline,
        sheet_type: sheet.sheet_type,
      })) || []

    // Extract disciplines
    const disciplines = Array.from(new Set(sheets?.map((s) => s.discipline).filter(Boolean) || []))

    return {
      job_name: job?.name || null,
      plan_title: plan.title || null,
      plan_file_name: plan.file_name || null,
      address: job?.location || null,
      disciplines,
      major_quantity_categories: majorQuantityCategories,
      major_cost_categories: majorCostCategories,
      sheet_index_summary: sheetIndexSummary,
    }
  } catch (error) {
    console.error('[RetrievalEngine] Failed to get project metadata:', error)
    return null
  }
}

/**
 * Main retrieval function - combines all retrieval layers
 */
export async function retrieveContext(
  supabase: GenericSupabase,
  planId: string,
  userId: string,
  jobId: string | null,
  query: string,
  targets: string[],
  pages?: number[]
): Promise<RetrievalResult> {
  // A. Semantic RAG
  const semanticChunks = await retrieveSemanticChunks(supabase, planId, query, 12)

  // B. Target-based retrieval
  const takeoffItems = await findTakeoffItemsByTarget(supabase, planId, userId, targets)

  // C. Dependency-based retrieval
  const relatedSheetsInput = pages && pages.length > 0 ? pages : targets
  const relatedSheets = await findRelatedSheets(supabase, planId, relatedSheetsInput)

  // D. Project metadata
  const projectMetadata = await getProjectMetadata(supabase, planId, jobId)

  return {
    semantic_chunks: semanticChunks,
    takeoff_items: takeoffItems,
    related_sheets: relatedSheets,
    project_metadata: projectMetadata,
  }
}

