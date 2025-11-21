/**
 * Answer Engine (LLM Orchestrator) for Plan Chat V3
 * 
 * Orchestrates the complete flow:
 * 1. Run classification
 * 2. Build context (buildPlanContext())
 * 3. Choose system prompt (takeoff vs copilot)
 * 4. Construct final prompt
 * 5. Call LLM
 * 6. Persist to memory
 * 7. Return final answer with metadata
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { classifyPlanChatQuestion } from '@/lib/planChat/classifier'
import { buildPlanContext } from './context-builder'
import { selectSystemPrompt, buildUserPrompt } from './prompts'
import { recordChatTurn } from './memory'
import {
  logClassification,
  logModeSelection,
  logRetrievalStats,
  logContextBuild,
  logAnswerGeneration,
} from './debug'

type GenericSupabase = SupabaseClient<any, any, any>

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export interface AnswerResult {
  answer: string
  classification: any
  mode: 'TAKEOFF' | 'COPILOT'
  metadata?: {
    retrieval_stats?: {
      semantic_chunks: number
      takeoff_items: number
      related_sheets: number
    }
    context_size?: number
  }
}

/**
 * Main orchestrator function - generates answer using V3 system
 */
export async function generateAnswer(
  supabase: GenericSupabase,
  planId: string,
  userId: string,
  jobId: string | null,
  userQuestion: string
): Promise<AnswerResult> {
  if (!openaiClient) {
    throw new Error('OpenAI client is not configured. Please add an API key.')
  }

  // Step 1: Classify the question
  const classification = await classifyPlanChatQuestion(userQuestion)
  logClassification(classification)

  // Step 2: Build comprehensive context
  const context = await buildPlanContext(
    supabase,
    planId,
    userId,
    jobId,
    classification,
    userQuestion
  )

  logRetrievalStats({
    semantic_chunks: context.blueprint_context.chunks.length,
    takeoff_items: context.takeoff_context.items.length,
    related_sheets: context.related_sheets.length,
    project_metadata: context.project_metadata !== null,
  })

  logContextBuild({
    conversation_turns: context.recent_conversation.length,
    takeoff_items: context.takeoff_context.items.length,
    blueprint_chunks: context.blueprint_context.chunks.length,
    related_sheets: context.related_sheets.length,
    context_size_bytes: JSON.stringify(context).length,
  })

  // Step 3: Choose system prompt (takeoff vs copilot)
  const systemPrompt = selectSystemPrompt(classification)
  const mode: 'TAKEOFF' | 'COPILOT' =
    classification.question_type === 'TAKEOFF_COST' ||
    classification.question_type === 'TAKEOFF_QUANTITY' ||
    classification.strict_takeoff_only
      ? 'TAKEOFF'
      : 'COPILOT'

  logModeSelection(
    mode,
    classification.strict_takeoff_only
      ? 'strict_takeoff_only flag'
      : `question_type: ${classification.question_type}`
  )

  // Step 4: Construct final prompt
  const userPrompt = buildUserPrompt(userQuestion, {
    recent_conversation: context.recent_conversation,
    project_metadata: context.project_metadata,
    takeoff_context: context.takeoff_context,
    blueprint_context: context.blueprint_context,
    related_sheets: context.related_sheets,
    global_scope_summary: context.global_scope_summary,
    notes: context.notes,
  })

  // Step 5: Call LLM
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  // Add recent conversation turns as message history
  if (context.recent_conversation && context.recent_conversation.length > 0) {
    // Skip the first one if it's a summary
    const conversationTurns = context.recent_conversation
    for (const turn of conversationTurns) {
      if (turn.user !== '[Previous conversation summary]') {
        messages.push({ role: 'user', content: turn.user })
        messages.push({ role: 'assistant', content: turn.assistant })
      }
    }
  }

  // Add the current question and context
  messages.push({ role: 'user', content: userPrompt })

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages as any,
      max_completion_tokens: mode === 'TAKEOFF' ? 400 : 800, // Shorter for takeoff mode
      temperature: mode === 'TAKEOFF' ? 0.1 : 0.7, // Lower temperature for deterministic mode
    })

    let answer = completion.choices[0]?.message?.content?.trim()

    // Fallback if answer is empty
    if (!answer || answer.length < 10) {
      if (mode === 'TAKEOFF') {
        if (context.takeoff_context.items.length > 0) {
          const totalQty = context.takeoff_context.summary.total_quantity
          const totalCost = context.takeoff_context.summary.total_cost
          if (totalQty) {
            answer = `Found ${totalQty.toLocaleString('en-US')} units in the takeoff.`
          } else if (totalCost) {
            answer = `Total cost: $${totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`
          } else {
            answer = `Found ${context.takeoff_context.items.length} matching item${
              context.takeoff_context.items.length === 1 ? '' : 's'
            } in the takeoff.`
          }
        } else {
          answer = "I don't see any matching items in the takeoff data for that question."
        }
      } else {
        answer =
          "I couldn't find enough information to answer that question. Could you rephrase or provide more context?"
      }
    }

    // Step 6: Persist to memory (async, don't wait)
    recordChatTurn(
      supabase,
      planId,
      userId,
      jobId,
      userQuestion,
      answer,
      {
        classification,
        mode,
        retrieval_stats: {
          semantic_chunks: context.blueprint_context.chunks.length,
          takeoff_items: context.takeoff_context.items.length,
          related_sheets: context.related_sheets.length,
        },
      }
    ).catch((error) => {
      console.error('[PlanChatV3] Failed to persist conversation turn:', error)
      // Don't fail the request if memory persistence fails
    })

    // Step 7: Return final answer with metadata
    logAnswerGeneration({
      mode,
      answer_length: answer.length,
    })

    return {
      answer,
      classification,
      mode,
      metadata: {
        retrieval_stats: {
          semantic_chunks: context.blueprint_context.chunks.length,
          takeoff_items: context.takeoff_context.items.length,
          related_sheets: context.related_sheets.length,
        },
        context_size: JSON.stringify(context).length,
      },
    }
  } catch (error) {
    console.error('[PlanChatV3] Answer generation failed:', error)
    throw error
  }
}

