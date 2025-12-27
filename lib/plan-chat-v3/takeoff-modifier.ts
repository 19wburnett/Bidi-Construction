/**
 * Takeoff Modifier - Handles AI-driven takeoff modifications
 * Allows AI to add, remove, and update takeoff items based on user requests
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeTakeoffItems } from './retrieval-engine'
import type { NormalizedTakeoffItem } from './retrieval-engine'

type GenericSupabase = SupabaseClient<any, any, any>

export interface TakeoffModification {
  action: 'add' | 'remove' | 'update'
  item?: {
    id?: string
    category?: string
    description: string
    quantity?: number
    unit?: string
    unit_cost?: number
    location?: string
    page_number?: number
    notes?: string
  }
  itemId?: string // For remove/update actions
  reason?: string // Why this modification is being made
}

export interface TakeoffModificationResult {
  success: boolean
  modifications: TakeoffModification[]
  updatedItems: NormalizedTakeoffItem[]
  message: string
  warnings?: string[]
}

/**
 * Load current takeoff items for a plan
 */
export async function loadTakeoffItems(
  supabase: GenericSupabase,
  planId: string
): Promise<{ items: NormalizedTakeoffItem[]; takeoffId: string | null }> {
  const { data: takeoffRow, error } = await supabase
    .from('plan_takeoff_analysis')
    .select('id, items')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !takeoffRow) {
    return { items: [], takeoffId: null }
  }

  const items = normalizeTakeoffItems(takeoffRow.items)
  return { items, takeoffId: takeoffRow.id }
}

/**
 * Apply modifications to takeoff items
 */
export async function applyTakeoffModifications(
  supabase: GenericSupabase,
  planId: string,
  modifications: TakeoffModification[],
  userId: string
): Promise<TakeoffModificationResult> {
  const { items: currentItems, takeoffId } = await loadTakeoffItems(supabase, planId)

  if (!takeoffId) {
    return {
      success: false,
      modifications: [],
      updatedItems: [],
      message: 'No takeoff analysis found for this plan. Please run takeoff analysis first.',
    }
  }

  let updatedItems = [...currentItems]
  const warnings: string[] = []

  for (const mod of modifications) {
    try {
      if (mod.action === 'add' && mod.item) {
        const newItem: NormalizedTakeoffItem = {
          id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          category: mod.item.category || 'Uncategorized',
          description: mod.item.description,
          quantity: mod.item.quantity ?? null,
          unit: mod.item.unit ?? null,
          unit_cost: mod.item.unit_cost ?? null,
          total_cost: mod.item.quantity && mod.item.unit_cost 
            ? mod.item.quantity * mod.item.unit_cost 
            : null,
          location: mod.item.location ?? null,
          page_number: mod.item.page_number ?? null,
          notes: mod.item.notes ?? null,
        }
        updatedItems.push(newItem)
      } else if (mod.action === 'remove' && mod.itemId) {
        const index = updatedItems.findIndex((item) => item.id === mod.itemId)
        if (index >= 0) {
          updatedItems.splice(index, 1)
        } else {
          warnings.push(`Item ${mod.itemId} not found for removal`)
        }
      } else if (mod.action === 'update' && mod.itemId && mod.item) {
        const index = updatedItems.findIndex((item) => item.id === mod.itemId)
        if (index >= 0) {
          console.log('[TakeoffModifier] Updating item:', {
            itemId: mod.itemId,
            currentQuantity: updatedItems[index].quantity,
            currentUnitCost: updatedItems[index].unit_cost,
            newQuantity: mod.item.quantity,
            newUnitCost: mod.item.unit_cost,
          })
          
          // Calculate total_cost if quantity and unit_cost are both provided
          const quantity = mod.item.quantity !== undefined && mod.item.quantity !== null 
            ? mod.item.quantity 
            : updatedItems[index].quantity
          const unitCost = mod.item.unit_cost !== undefined && mod.item.unit_cost !== null
            ? mod.item.unit_cost 
            : updatedItems[index].unit_cost
          const totalCost = (quantity && unitCost) ? quantity * unitCost : updatedItems[index].total_cost
          
          updatedItems[index] = {
            ...updatedItems[index],
            ...mod.item,
            id: updatedItems[index].id, // Preserve ID
            quantity: quantity,
            unit_cost: unitCost,
            total_cost: totalCost, // Recalculate total cost
          }
          
          console.log('[TakeoffModifier] Item updated:', {
            itemId: mod.itemId,
            finalQuantity: updatedItems[index].quantity,
            finalUnitCost: updatedItems[index].unit_cost,
            finalTotalCost: updatedItems[index].total_cost,
          })
        } else {
          warnings.push(`Item ${mod.itemId} not found for update`)
          console.warn('[TakeoffModifier] Item not found for update:', mod.itemId)
        }
      }
    } catch (error) {
      warnings.push(`Failed to apply modification: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Save updated items to database
  const { error: updateError } = await supabase
    .from('plan_takeoff_analysis')
    .update({
      items: updatedItems,
      updated_at: new Date().toISOString(),
    })
    .eq('id', takeoffId)

  if (updateError) {
    return {
      success: false,
      modifications,
      updatedItems: currentItems,
      message: `Failed to save modifications: ${updateError.message}`,
      warnings,
    }
  }

  // Vectorize updated takeoff items for semantic search (async, don't wait)
  if (updatedItems.length > 0) {
    import('@/lib/takeoff-item-embeddings').then(({ ingestTakeoffItemEmbeddings }) => {
      ingestTakeoffItemEmbeddings(supabase, planId, updatedItems).catch((error) => {
        console.error('[TakeoffModifier] Failed to vectorize updated items:', error)
      })
    })
  }

  return {
    success: true,
    modifications,
    updatedItems,
    message: `Successfully applied ${modifications.length} modification(s)`,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Analyze what's missing from the takeoff
 * Compares blueprint text chunks with existing takeoff items
 */
export interface MissingScopeAnalysis {
  missingCategories: Array<{
    category: string
    evidence: string[]
    suggestedItems: Array<{
      description: string
      reason: string
    }>
  }>
  missingMeasurements: Array<{
    item: string
    neededMeasurements: string[]
    guidance: string
  }>
  recommendations: string[]
}

export async function analyzeMissingScope(
  supabase: GenericSupabase,
  planId: string,
  blueprintChunks: Array<{ text: string; page_number?: number | null }>
): Promise<MissingScopeAnalysis> {
  const { items } = await loadTakeoffItems(supabase, planId)

  // Extract categories from existing items
  const existingCategories = new Set(items.map((item) => item.category?.toLowerCase() || 'uncategorized'))

  // Common construction categories to check for
  const standardCategories = [
    'concrete',
    'steel',
    'framing',
    'drywall',
    'roofing',
    'electrical',
    'plumbing',
    'hvac',
    'insulation',
    'windows',
    'doors',
    'finishes',
    'exterior',
    'sitework',
  ]

  const missingCategories: MissingScopeAnalysis['missingCategories'] = []
  const missingMeasurements: MissingScopeAnalysis['missingMeasurements'] = []
  const recommendations: string[] = []

  // Check for missing categories
  for (const category of standardCategories) {
    if (!existingCategories.has(category)) {
      // Check if blueprint mentions this category
      const evidence = blueprintChunks
        .filter((chunk) => chunk.text.toLowerCase().includes(category))
        .map((chunk) => chunk.text.substring(0, 200))

      if (evidence.length > 0) {
        missingCategories.push({
          category,
          evidence: evidence.slice(0, 3), // Top 3 pieces of evidence
          suggestedItems: [],
        })
      }
    }
  }

  // Check for items missing measurements
  for (const item of items) {
    if (!item.quantity && item.description) {
      // Determine what measurements are needed based on unit type
      let neededMeasurements: string[] = []
      let guidance = ''
      
      const unit = (item.unit || '').toLowerCase()
      if (unit.includes('sq') || unit.includes('sf') || unit.includes('area')) {
        neededMeasurements = ['length', 'width', 'or area']
        guidance = `Measure the length and width (or find the area) from the plans to calculate square footage.`
      } else if (unit.includes('lf') || unit.includes('linear') || unit.includes('ln')) {
        neededMeasurements = ['length']
        guidance = `Measure the linear length from the plans.`
      } else if (unit.includes('cu') || unit.includes('cy') || unit.includes('volume')) {
        neededMeasurements = ['length', 'width', 'height']
        guidance = `Measure length, width, and height (or depth) from the plans to calculate volume.`
      } else if (unit.includes('ea') || unit.includes('each') || unit.includes('unit')) {
        neededMeasurements = ['count']
        guidance = `Count the number of items from the plans.`
      } else {
        neededMeasurements = ['quantity']
        guidance = `Find the quantity or dimensions needed for ${item.description} from the plans.`
      }
      
      // Add page reference if available
      if (item.page_number) {
        guidance += ` Check page ${item.page_number} for these measurements.`
      }
      
      missingMeasurements.push({
        item: item.description || item.name || 'Unnamed item',
        neededMeasurements,
        guidance,
      })
    }
  }

  if (missingCategories.length > 0) {
    recommendations.push(
      `Found ${missingCategories.length} category(ies) mentioned in the plans but not in the takeoff: ${missingCategories.map((c) => c.category).join(', ')}`
    )
  }

  if (missingMeasurements.length > 0) {
    recommendations.push(
      `${missingMeasurements.length} item(s) are missing quantity measurements. Review the plans to find the dimensions needed.`
    )
  }

  return {
    missingCategories,
    missingMeasurements,
    recommendations,
  }
}

