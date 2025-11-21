/**
 * Project Context Builder for Plan Chat V3
 * 
 * Assembles structured JSON context from:
 * - Recent conversation memory
 * - Project metadata
 * - Semantic chunks
 * - Takeoff matches
 * - Related sheets
 * - Classification output
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanChatQuestionClassification } from '@/lib/planChat/classifier'
import type { ConversationContext } from './memory'
import type { RetrievalResult } from './retrieval-engine'
import { getRecentConversationContext } from './memory'
import { retrieveContext } from './retrieval-engine'

type GenericSupabase = SupabaseClient<any, any, any>

export interface PlanContext {
  query: string
  classification: PlanChatQuestionClassification
  recent_conversation: Array<{
    user: string
    assistant: string
  }>
  project_metadata: {
    job_name: string | null
    plan_title: string | null
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
  } | null
  takeoff_context: {
    items: Array<{
      id: string
      name: string
      category: string
      quantity?: number | null
      unit?: string | null
      cost_total?: number | null
      location?: string | null
      page_number?: number | null
    }>
    summary: {
      total_items: number
      total_quantity?: number
      total_cost?: number
    }
  }
  blueprint_context: {
    chunks: Array<{
      text: string
      page_number?: number | null
      sheet_name?: string | null
      similarity?: number
    }>
    summary: string
  }
  related_sheets: Array<{
    page_number: number
    sheet_id: string | null
    title: string | null
    discipline: string | null
    sheet_type: string | null
  }>
  global_scope_summary: string
  notes: string[]
}

/**
 * Builds comprehensive plan context for the LLM
 */
export async function buildPlanContext(
  supabase: GenericSupabase,
  planId: string,
  userId: string,
  jobId: string | null,
  classification: PlanChatQuestionClassification,
  userQuestion: string
): Promise<PlanContext> {
  // 1. Get recent conversation memory
  const conversationContext = await getRecentConversationContext(supabase, planId, userId, 8)

  // 2. Perform multi-layer retrieval
  const retrievalResult = await retrieveContext(
    supabase,
    planId,
    userId,
    jobId,
    userQuestion,
    classification.targets || [],
    classification.pages
  )

  // 3. Build conversation history
  const recentConversation = conversationContext.recent_turns.map((turn) => ({
    user: turn.user_message,
    assistant: turn.assistant_message,
  }))

  // Add compressed summary if available
  if (conversationContext.compressed_summary) {
    recentConversation.unshift({
      user: '[Previous conversation summary]',
      assistant: conversationContext.compressed_summary,
    })
  }

  // 4. Build takeoff context
  const takeoffItems = retrievalResult.takeoff_items.slice(0, 50) // Limit to top 50
  const totalQuantity = takeoffItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const totalCost = takeoffItems.reduce((sum, item) => sum + (item.total_cost || 0), 0)

  const takeoffContext = {
    items: takeoffItems.map((item) => ({
      id: item.id || 'unknown',
      name: item.name || item.description || 'Item',
      category: item.category || 'Uncategorized',
      quantity: item.quantity || null,
      unit: item.unit || null,
      cost_total: item.total_cost || null,
      location: item.location || null,
      page_number: item.page_number || null,
    })),
    summary: {
      total_items: takeoffItems.length,
      total_quantity: totalQuantity > 0 ? totalQuantity : undefined,
      total_cost: totalCost > 0 ? totalCost : undefined,
    },
  }

  // 5. Build blueprint context
  const semanticChunks = retrievalResult.semantic_chunks.slice(0, 12) // Limit to 12 chunks
  const blueprintContext = {
    chunks: semanticChunks.map((chunk) => ({
      text: chunk.snippet_text,
      page_number: chunk.page_number || null,
      sheet_name:
        (chunk.metadata?.sheet_title as string) ||
        (chunk.metadata?.sheet_id as string) ||
        null,
      similarity: chunk.similarity,
    })),
    summary: semanticChunks.length > 0
      ? `Found ${semanticChunks.length} relevant blueprint snippet${
          semanticChunks.length === 1 ? '' : 's'
        } from ${new Set(semanticChunks.map((c) => c.page_number).filter(Boolean)).size} page${
          new Set(semanticChunks.map((c) => c.page_number).filter(Boolean)).size === 1 ? '' : 's'
        }`
      : 'No relevant blueprint snippets found',
  }

  // 6. Build related sheets
  const relatedSheets = retrievalResult.related_sheets.slice(0, 10) // Limit to 10 sheets

  // 7. Build global scope summary
  const scopeParts: string[] = []
  if (takeoffItems.length > 0) {
    scopeParts.push(`${takeoffItems.length} matching takeoff item${takeoffItems.length === 1 ? '' : 's'}`)
  }
  if (semanticChunks.length > 0) {
    scopeParts.push(`${semanticChunks.length} blueprint snippet${semanticChunks.length === 1 ? '' : 's'}`)
  }
  if (relatedSheets.length > 0) {
    scopeParts.push(`${relatedSheets.length} related sheet${relatedSheets.length === 1 ? '' : 's'}`)
  }

  const globalScopeSummary =
    scopeParts.length > 0
      ? `Context includes: ${scopeParts.join(', ')}.`
      : 'Limited context available for this query.'

  // 8. Build notes
  const notes: string[] = []
  if (classification.pages && classification.pages.length > 0) {
    notes.push(`User specifically asked about page${classification.pages.length === 1 ? '' : 's'} ${classification.pages.join(', ')}`)
  }
  if (classification.targets && classification.targets.length > 0) {
    notes.push(`Query targets: ${classification.targets.join(', ')}`)
  }
  if (classification.strict_takeoff_only) {
    notes.push('This is a strict takeoff-only question - no blueprint speculation allowed')
  }
  if (conversationContext.compressed_summary) {
    notes.push('Previous conversation has been compressed to save context window')
  }

  // 9. Build project metadata (or use null if not available)
  const projectMetadata = retrievalResult.project_metadata
    ? {
        job_name: retrievalResult.project_metadata.job_name,
        plan_title: retrievalResult.project_metadata.plan_title,
        address: retrievalResult.project_metadata.address,
        disciplines: retrievalResult.project_metadata.disciplines,
        major_quantity_categories: retrievalResult.project_metadata.major_quantity_categories,
        major_cost_categories: retrievalResult.project_metadata.major_cost_categories,
        sheet_index_summary: retrievalResult.project_metadata.sheet_index_summary,
      }
    : null

  return {
    query: userQuestion,
    classification,
    recent_conversation: recentConversation,
    project_metadata: projectMetadata,
    takeoff_context: takeoffContext,
    blueprint_context: blueprintContext,
    related_sheets: relatedSheets,
    global_scope_summary: globalScopeSummary,
    notes,
  }
}

