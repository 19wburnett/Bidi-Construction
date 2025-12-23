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
import { aiGateway } from '@/lib/ai-gateway-provider'
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

const hasAIGatewayKey = !!process.env.AI_GATEWAY_API_KEY
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
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key is not configured. Please add AI_GATEWAY_API_KEY to your environment variables.')
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

  // Step 5: Call LLM via AI Gateway
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

    const response = await aiGateway.generate({
      model: OPENAI_MODEL,
      messages: messages as any,
      maxTokens: mode === 'TAKEOFF' ? 500 : 1500, // Generous limits for natural responses
      temperature: supportsCustomTemperature ? (mode === 'TAKEOFF' ? 0.3 : 0.6) : undefined
    })

    let answer = response.content?.trim()

    // Log what we got from LLM for debugging
    if (process.env.NODE_ENV === 'development' || process.env.PLAN_CHAT_V3_DEBUG === 'true') {
      console.log('[PlanChatV3] LLM response:', {
        answerLength: answer?.length || 0,
        answerPreview: answer?.substring(0, 200) || 'empty',
        hasBlueprint: context.blueprint_context.chunks.length > 0,
        hasTakeoff: context.takeoff_context.items.length > 0,
        mode,
      })
    }

    // Only use fallback if answer is truly empty - trust the LLM otherwise
    const isEmptyAnswer = !answer || answer.trim().length < 5

    if (isEmptyAnswer) {
      // Check what context we have
      const hasTakeoffData = context.takeoff_context.items.length > 0
      const hasBlueprintData = context.blueprint_context.chunks.length > 0

      if (hasBlueprintData) {
        // We have blueprint data - construct a helpful fallback
        const chunks = context.blueprint_context.chunks
        const pages = Array.from(new Set(chunks.map((c: any) => c.page_number).filter(Boolean)))
        if (pages.length > 0) {
          answer = `I found content on page${pages.length > 1 ? 's' : ''} ${pages.join(', ')}. The text includes notes about ${chunks[0]?.text?.substring(0, 100)}... Would you like me to summarize a specific aspect?`
        } else {
          answer = `I found ${chunks.length} text snippet${chunks.length === 1 ? '' : 's'} from the plans. What specific information are you looking for?`
        }
      } else if (hasTakeoffData) {
        const items = context.takeoff_context.items
        answer = `I found ${items.length} item${items.length === 1 ? '' : 's'} in the takeoff. What would you like to know about them?`
      } else {
        answer = "I don't see any extracted text or takeoff data for this plan yet. The plan may need to be processed first."
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

