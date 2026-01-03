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
import { parseModificationRequest, formatModificationInstructions } from './modification-parser'
import { loadTakeoffItems, applyTakeoffModifications, analyzeMissingScope, type TakeoffModification } from './takeoff-modifier'
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
  mode: 'TAKEOFF' | 'COPILOT' | 'TAKEOFF_MODIFY'
  metadata?: {
    retrieval_stats?: {
      semantic_chunks: number
      takeoff_items: number
      related_sheets: number
    }
    context_size?: number
    modifications_applied?: boolean
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
  userQuestion: string,
  model?: string,
  chatId?: string | null
): Promise<AnswerResult> {
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key is not configured. Please add AI_GATEWAY_API_KEY to your environment variables.')
  }

  const selectedModel = model || OPENAI_MODEL

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
    userQuestion,
    chatId
  )

  // Check if plan is vectorized (has chunks with embeddings)
  // This is a fallback check - the route should catch this first
  // If we get here with no chunks, try to vectorize automatically
  if (context.blueprint_context.chunks.length === 0) {
    const { checkPlanVectorizationStatus } = await import('@/lib/plan-vectorization-status')
    const { ingestPlanTextChunks } = await import('@/lib/plan-text-chunks')
    
    const vectorizationStatus = await checkPlanVectorizationStatus(supabase, planId)
    
    if (!vectorizationStatus.isVectorized) {
      // Try to vectorize automatically
      console.log(`[AnswerEngine] Plan ${planId} not vectorized, attempting auto-vectorization...`)
      try {
        await ingestPlanTextChunks(supabase, planId)
        // Re-check after vectorization
        const newStatus = await checkPlanVectorizationStatus(supabase, planId)
        if (!newStatus.isVectorized) {
          throw new Error('Vectorization completed but plan is still not ready. Please try again.')
        }
        // Rebuild context after vectorization
        const newContext = await buildPlanContext(
          supabase,
          planId,
          userId,
          jobId,
          classification,
          userQuestion,
          chatId
        )
        // Use the new context
        Object.assign(context, newContext)
      } catch (vectorizationError) {
        throw new Error(
          vectorizationError instanceof Error 
            ? `Failed to vectorize plan: ${vectorizationError.message}`
            : 'Failed to prepare the plan for chat. Please try again in a moment.'
        )
      }
    }
  }

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

  // Step 3: Choose system prompt (takeoff vs copilot vs modify)
  const systemPrompt = selectSystemPrompt(classification)
  const mode: 'TAKEOFF' | 'COPILOT' | 'TAKEOFF_MODIFY' =
    classification.question_type === 'TAKEOFF_MODIFY' || classification.question_type === 'TAKEOFF_ANALYZE'
      ? 'TAKEOFF_MODIFY'
      : classification.question_type === 'TAKEOFF_COST' ||
        classification.question_type === 'TAKEOFF_QUANTITY' ||
        classification.strict_takeoff_only
      ? 'TAKEOFF'
      : 'COPILOT'

  logModeSelection(
    mode === 'TAKEOFF_MODIFY' ? 'TAKEOFF' : mode,
    classification.strict_takeoff_only
      ? 'strict_takeoff_only flag'
      : `question_type: ${classification.question_type}`
  )

  // Step 4: Construct final prompt
  let userPrompt = buildUserPrompt(userQuestion, {
    recent_conversation: context.recent_conversation,
    project_metadata: context.project_metadata,
    takeoff_context: context.takeoff_context,
    blueprint_context: context.blueprint_context,
    related_sheets: context.related_sheets,
    global_scope_summary: context.global_scope_summary,
    notes: context.notes,
  })

  // Add modification instructions if this is a modification request
  if (mode === 'TAKEOFF_MODIFY') {
    const { items: currentItems } = await loadTakeoffItems(supabase, planId)
    // Map items to match expected type (convert null to undefined)
    const mappedItems = currentItems.map(item => ({
      id: item.id,
      name: item.name ?? undefined,
      description: item.description ?? undefined,
      category: item.category ?? undefined,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    }))
    const modificationInstructions = formatModificationInstructions(classification, mappedItems)
    userPrompt += modificationInstructions
  }

  // Add missing scope analysis if requested
  if (classification.question_type === 'TAKEOFF_ANALYZE') {
    const missingScope = await analyzeMissingScope(
      supabase,
      planId,
      context.blueprint_context.chunks.map((c: any) => ({
        text: c.text,
        page_number: c.page_number,
      }))
    )
    
    if (missingScope.recommendations.length > 0) {
      userPrompt += `\n\n---\nMISSING SCOPE ANALYSIS:\n`
      
      if (missingScope.missingCategories.length > 0) {
        userPrompt += `\nMissing Categories (${missingScope.missingCategories.length}):\n`
        missingScope.missingCategories.forEach((cat, idx) => {
          userPrompt += `${idx + 1}. ${cat.category}\n`
          if (cat.evidence && cat.evidence.length > 0) {
            userPrompt += `   Evidence: ${cat.evidence[0].substring(0, 150)}...\n`
          }
        })
      }
      
      if (missingScope.missingMeasurements.length > 0) {
        userPrompt += `\nItems Missing Measurements (${missingScope.missingMeasurements.length}):\n`
        missingScope.missingMeasurements.forEach((item, idx) => {
          userPrompt += `${idx + 1}. ${item.item}\n`
          userPrompt += `   Needed: ${item.neededMeasurements.join(', ')}\n`
          if (item.guidance) {
            userPrompt += `   ${item.guidance}\n`
          }
        })
      }
      
      userPrompt += `\n\nCRITICAL INSTRUCTIONS:\n`
      userPrompt += `- Automatically list ALL missing items and measurements in your response\n`
      userPrompt += `- Don't ask "Would you like me to list them?" - just list them immediately\n`
      userPrompt += `- Format as a clear bulleted list with item names, what's missing, and guidance\n`
      userPrompt += `- Be proactive and helpful - provide the full information upfront`
    }
  }

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

    let response
    try {
      response = await aiGateway.generate({
        model: selectedModel,
        messages: messages as any,
        maxTokens: mode === 'TAKEOFF' ? 500 : mode === 'TAKEOFF_MODIFY' ? 3000 : 1500, // More tokens for modifications (increased to prevent cutoff)
        temperature: supportsCustomTemperature ? (mode === 'TAKEOFF' ? 0.3 : mode === 'TAKEOFF_MODIFY' ? 0.4 : 0.6) : undefined
      })
    } catch (gatewayError) {
      console.error('[PlanChatV3] AI Gateway error:', {
        error: gatewayError instanceof Error ? gatewayError.message : String(gatewayError),
        model: selectedModel,
        mode,
        userQuestion: userQuestion.substring(0, 100),
      })
      throw new Error(`AI Gateway failed to generate response: ${gatewayError instanceof Error ? gatewayError.message : String(gatewayError)}`)
    }

    // Validate response structure
    if (!response) {
      console.error('[PlanChatV3] AI Gateway returned null/undefined response')
      throw new Error('AI Gateway returned an invalid response (null/undefined)')
    }

    // Safely extract answer content, handling undefined/null cases
    let answer: string = ''
    if (response && response.content && typeof response.content === 'string') {
      answer = response.content.trim()
    } else {
      console.warn('[PlanChatV3] AI Gateway response missing or invalid content:', {
        hasResponse: !!response,
        hasContent: !!response?.content,
        contentType: typeof response?.content,
        finishReason: response?.finishReason,
      })
      // answer remains empty string, will be handled by fallback logic below
    }

    // Log what we got from LLM for debugging
    if (process.env.NODE_ENV === 'development' || process.env.PLAN_CHAT_V3_DEBUG === 'true') {
      console.log('[PlanChatV3] LLM response:', {
        hasResponse: !!response,
        hasContent: !!response?.content,
        contentType: typeof response?.content,
        answerLength: answer?.length || 0,
        answerPreview: answer?.substring(0, 200) || 'empty',
        hasBlueprint: context.blueprint_context.chunks.length > 0,
        hasTakeoff: context.takeoff_context.items.length > 0,
        mode,
        finishReason: response?.finishReason,
      })
    }

    // Only use fallback if answer is truly empty - trust the LLM otherwise
    const isEmptyAnswer = !answer || answer.length < 5

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
        // More helpful error message when no data is available
        const hasNoChunks = context.blueprint_context.chunks.length === 0
        if (hasNoChunks) {
          answer = "I couldn't find any plan text data for this question. The plan may need to be processed to extract text and create embeddings. Try asking about specific takeoff items or pages."
        } else {
          answer = "I don't see any extracted text or takeoff data for this plan yet. The plan may need to be processed first. You can trigger text extraction from the plan settings."
        }
      }
    }

    // Ensure answer is always a string
    if (!answer) {
      answer = "I'm sorry, I couldn't generate a response. Please try again."
    }

    // Step 6: Parse and handle modifications if this is a modification request OR if AI response indicates modifications
    let modificationsApplied = false
    const isModificationRequest = mode === 'TAKEOFF_MODIFY' && classification.modification_intent && classification.modification_intent !== 'analyze_missing'
    // Also check if AI said it updated something (even if classifier didn't catch it)
    const aiSaidItUpdated = /(?:updated|update|updating|added|add|adding|set|setting)\s+[^,\.]+?\s+(?:to|with|at)\s+(?:a\s+)?(?:quantity\s+of\s+)?\d+/i.test(answer) ||
                            /(?:I've|I'll|I will)\s+(?:updated|update|add|added|set|setting)\s+[^,\.]+/i.test(answer)
    
    if (isModificationRequest || aiSaidItUpdated) {
      try {
        console.log('[PlanChatV3] Attempting to parse modifications:', {
          mode,
          modification_intent: classification.modification_intent,
          isModificationRequest,
          aiSaidItUpdated,
          userQuestion,
          answerPreview: answer.substring(0, 200),
        })
        
        const { items: currentItems } = await loadTakeoffItems(supabase, planId)
        // Map items to match expected type (convert null to undefined)
        const mappedItems = currentItems.map(item => ({
          id: item.id,
          name: item.name ?? undefined,
          description: item.description ?? undefined,
          category: item.category ?? undefined,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
        }))
        
        // If AI said it updated but classification wasn't TAKEOFF_MODIFY, create effective classification
        const effectiveClassification = aiSaidItUpdated && !isModificationRequest ? {
          ...classification,
          question_type: 'TAKEOFF_MODIFY' as const,
          modification_intent: 'add' as const,
        } : classification
        
        // Try parsing from AI response first
        let parsed = await parseModificationRequest(answer, effectiveClassification, mappedItems)
        
        // If nothing was parsed, try parsing from user's original question as fallback
        if (parsed.modifications.length === 0) {
          console.log('[PlanChatV3] No modifications from AI response, trying user question...')
          parsed = await parseModificationRequest(userQuestion, effectiveClassification, mappedItems)
        }
        
        console.log('[PlanChatV3] Parsed modifications:', {
          count: parsed.modifications.length,
          modifications: parsed.modifications,
        })
        
        // Deduplicate modifications - keep only the most complete update for each itemId
        const deduplicatedModifications: typeof parsed.modifications = []
        const seenItemIds = new Set<string>()
        const seenAddDescriptions = new Set<string>()
        
        // Process updates first (they should override adds)
        for (const mod of parsed.modifications) {
          if (mod.action === 'update' && mod.itemId) {
            if (!seenItemIds.has(mod.itemId)) {
              // Check if this update has actual data to update
              const hasUpdateData = mod.item && Object.keys(mod.item).length > 0
              if (hasUpdateData) {
                deduplicatedModifications.push(mod)
                seenItemIds.add(mod.itemId)
              }
              } else {
                // Merge with existing update - keep the most complete one
                const existingIndex = deduplicatedModifications.findIndex(m => m.action === 'update' && m.itemId === mod.itemId)
                if (existingIndex >= 0) {
                  const existing = deduplicatedModifications[existingIndex]
                  // Merge update data, preferring non-null values from the new modification
                  const mergedItem: any = { ...existing.item }
                  if (mod.item) {
                    Object.keys(mod.item).forEach(key => {
                      const value = (mod.item as any)[key]
                      if (value !== undefined && value !== null) {
                        mergedItem[key] = value
                      }
                    })
                  }
                  // Remove undefined/null values
                  Object.keys(mergedItem).forEach(key => {
                    if (mergedItem[key] === undefined || mergedItem[key] === null) {
                      delete mergedItem[key]
                    }
                  })
                  if (Object.keys(mergedItem).length > 0) {
                    deduplicatedModifications[existingIndex] = {
                      ...existing,
                      item: mergedItem,
                    }
                  }
                }
              }
          }
        }
        
        // Then process adds (skip if item already exists)
        for (const mod of parsed.modifications) {
          if (mod.action === 'add' && mod.item) {
            const itemDesc = (mod.item.description || '').toLowerCase().trim()
            // Skip if we already have an update for this item or if it's a false positive
            if (!seenItemIds.has(mod.item.id || '') && 
                itemDesc.length > 3 &&
                !['quantities', 'costs', 'get them', 'priced out', 'and costs'].some(phrase => itemDesc.includes(phrase))) {
              if (!seenAddDescriptions.has(itemDesc)) {
                deduplicatedModifications.push(mod)
                seenAddDescriptions.add(itemDesc)
              }
            }
          } else if (mod.action === 'remove' && mod.itemId) {
            // Remove actions are always unique
            deduplicatedModifications.push(mod)
          }
        }
        
        console.log('[PlanChatV3] Deduplicated modifications:', {
          originalCount: parsed.modifications.length,
          deduplicatedCount: deduplicatedModifications.length,
          modifications: deduplicatedModifications,
        })
        
        // If modifications were parsed and user intent is clear, apply them
        if (deduplicatedModifications.length > 0) {
          // Apply modifications automatically (user has explicitly requested them)
          const result = await applyTakeoffModifications(
            supabase,
            planId,
            deduplicatedModifications,
            userId
          )
          
          console.log('[PlanChatV3] Modification result:', {
            success: result.success,
            message: result.message,
            warnings: result.warnings,
          })
          
          if (result.success) {
            modificationsApplied = true
            // Update answer to reflect successful modifications
            const modificationCount = deduplicatedModifications.length
            answer = `${answer}\n\n✅ Successfully applied ${modificationCount} modification(s) to the takeoff.`
            if (result.warnings && result.warnings.length > 0) {
              answer += `\n⚠️ Warnings: ${result.warnings.join('; ')}`
            }
          } else {
            answer = `${answer}\n\n❌ Failed to apply modifications: ${result.message}`
          }
        } else {
          console.warn('[PlanChatV3] No modifications parsed from AI response. Response:', answer.substring(0, 500))
        }
      } catch (error) {
        console.error('[PlanChatV3] Failed to parse/apply modifications:', error)
        // Don't fail the request - just log the error
      }
    }

    // Step 7: Persist to memory (async, don't wait)
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
      },
      chatId
    ).catch((error) => {
      console.error('[PlanChatV3] Failed to persist conversation turn:', error)
      // Don't fail the request if memory persistence fails
    })

    // Final validation: ensure answer is always a valid non-empty string
    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      console.error('[PlanChatV3] Final validation failed - answer is invalid:', {
        answerType: typeof answer,
        answerValue: answer,
        answerLength: answer?.length || 0,
      })
      answer = "I'm sorry, I encountered an error generating a response. Please try again or rephrase your question."
    }

    // Step 7: Return final answer with metadata
    logAnswerGeneration({
      mode: mode === 'TAKEOFF_MODIFY' ? 'TAKEOFF' : mode,
      answer_length: answer.length,
    })

    return {
      answer: answer.trim(),
      classification,
      mode,
      metadata: {
        retrieval_stats: {
          semantic_chunks: context.blueprint_context.chunks.length,
          takeoff_items: context.takeoff_context.items.length,
          related_sheets: context.related_sheets.length,
        },
        context_size: JSON.stringify(context).length,
        modifications_applied: modificationsApplied,
      },
    }
  } catch (error) {
    console.error('[PlanChatV3] Answer generation failed:', error)
    throw error
  }
}

