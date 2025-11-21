/**
 * Debug logging and utilities for Plan Chat V3
 */

export interface DebugLog {
  timestamp: string
  stage: string
  data: any
}

const DEBUG_ENABLED = process.env.NODE_ENV === 'development' || process.env.PLAN_CHAT_V3_DEBUG === 'true'

/**
 * Logs debug information if debug mode is enabled
 */
export function debugLog(stage: string, data: any): void {
  if (!DEBUG_ENABLED) return

  const log: DebugLog = {
    timestamp: new Date().toISOString(),
    stage,
    data,
  }

  console.log(`[PlanChatV3:${stage}]`, JSON.stringify(log, null, 2))
}

/**
 * Logs retrieval statistics
 */
export function logRetrievalStats(stats: {
  semantic_chunks: number
  takeoff_items: number
  related_sheets: number
  project_metadata: boolean
}): void {
  if (!DEBUG_ENABLED) return

  debugLog('RETRIEVAL_STATS', {
    semantic_chunks: stats.semantic_chunks,
    takeoff_items: stats.takeoff_items,
    related_sheets: stats.related_sheets,
    has_project_metadata: stats.project_metadata,
  })
}

/**
 * Logs context building information
 */
export function logContextBuild(context: {
  conversation_turns: number
  takeoff_items: number
  blueprint_chunks: number
  related_sheets: number
  context_size_bytes: number
}): void {
  if (!DEBUG_ENABLED) return

  debugLog('CONTEXT_BUILD', {
    conversation_turns: context.conversation_turns,
    takeoff_items: context.takeoff_items,
    blueprint_chunks: context.blueprint_chunks,
    related_sheets: context.related_sheets,
    context_size_bytes: context.context_size_bytes,
  })
}

/**
 * Logs classification result
 */
export function logClassification(classification: {
  question_type: string
  targets: string[]
  pages?: number[]
  strict_takeoff_only: boolean
}): void {
  if (!DEBUG_ENABLED) return

  debugLog('CLASSIFICATION', classification)
}

/**
 * Logs mode selection
 */
export function logModeSelection(mode: 'TAKEOFF' | 'COPILOT', reason: string): void {
  if (!DEBUG_ENABLED) return

  debugLog('MODE_SELECTION', { mode, reason })
}

/**
 * Logs answer generation
 */
export function logAnswerGeneration(result: {
  mode: 'TAKEOFF' | 'COPILOT'
  answer_length: number
  tokens_used?: number
}): void {
  if (!DEBUG_ENABLED) return

  debugLog('ANSWER_GENERATION', result)
}

