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
    // Some OpenAI models don't support custom temperature - only default (1) is allowed
    // Models that require default temperature: gpt-5, gpt-5-mini, gpt-5-nano, o3, o4-mini
    const modelsWithoutCustomTemperature = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini']
    const supportsCustomTemperature = !modelsWithoutCustomTemperature.includes(OPENAI_MODEL)

    const requestConfig: any = {
      model: OPENAI_MODEL,
      messages: messages as any,
      max_completion_tokens: mode === 'TAKEOFF' ? 400 : 1200, // Increased for copilot mode to allow longer answers
    }

    // Only add temperature for models that support custom values
    if (supportsCustomTemperature) {
      requestConfig.temperature = mode === 'TAKEOFF' ? 0.1 : 0.7 // Lower temperature for deterministic mode
    }
    // Models without custom temperature support will use default (1.0)

    const completion = await openaiClient.chat.completions.create(requestConfig)

    let answer = completion.choices[0]?.message?.content?.trim()

    // Log what we got from LLM for debugging
    if (process.env.NODE_ENV === 'development' || process.env.PLAN_CHAT_V3_DEBUG === 'true') {
      console.log('[PlanChatV3] LLM response:', {
        answerLength: answer?.length || 0,
        answerPreview: answer?.substring(0, 100) || 'empty',
        hasBlueprint: context.blueprint_context.chunks.length > 0,
        hasTakeoff: context.takeoff_context.items.length > 0,
      })
    }

    // Fallback if answer is empty or too short (but be less aggressive)
    // Only trigger fallback if answer is truly empty or just whitespace/punctuation
    const isEmptyAnswer = !answer || answer.trim().length < 10 || answer.trim().match(/^[.,!?\s]+$/)

    if (isEmptyAnswer) {
      // Check if we have any context to work with
      const hasTakeoffData = context.takeoff_context.items.length > 0
      const hasBlueprintData = context.blueprint_context.chunks.length > 0
      const hasProjectMetadata = context.project_metadata !== null

      if (mode === 'TAKEOFF') {
        if (hasTakeoffData) {
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
          answer = "I don't see any matching items in the takeoff data for that question. Make sure takeoff analysis has been run for this plan."
        }
      } else {
        // COPILOT mode - provide more helpful fallback
        if (hasTakeoffData || hasBlueprintData || hasProjectMetadata) {
          // We have context but LLM didn't generate answer - try to provide something useful
          const contextParts: string[] = []
          
          if (hasTakeoffData) {
            contextParts.push(`${context.takeoff_context.items.length} takeoff item${context.takeoff_context.items.length === 1 ? '' : 's'}`)
          }
          if (hasBlueprintData) {
            contextParts.push(`${context.blueprint_context.chunks.length} blueprint snippet${context.blueprint_context.chunks.length === 1 ? '' : 's'}`)
          }
          if (hasProjectMetadata && context.project_metadata?.plan_title) {
            contextParts.push(`project "${context.project_metadata.plan_title}"`)
          }

          answer = `I found ${contextParts.join(' and ')}, but I'm having trouble generating a specific answer. Could you rephrase your question or ask about something more specific?`
        } else {
          answer = "I don't have takeoff or blueprint data for this plan yet. Please run the takeoff analysis or plan ingestion first, then try again."
        }
      }
    }

    // Ensure answer is always a string
    if (!answer) {
      answer = "I'm sorry, I couldn't generate a response. Please try again."
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

