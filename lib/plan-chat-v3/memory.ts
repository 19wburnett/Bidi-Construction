/**
 * Conversation Memory Layer for Plan Chat V3
 * 
 * Provides persistent memory for conversations, including:
 * - Recording conversation turns
 * - Generating compressed summaries
 * - Retrieving conversation context
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

type GenericSupabase = SupabaseClient<any, any, any>

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export interface ConversationTurn {
  id: string
  user_message: string
  assistant_message: string
  summary?: string | null
  created_at: string
  metadata?: Record<string, any> | null
}

export interface ConversationContext {
  recent_turns: ConversationTurn[]
  compressed_summary?: string
}

/**
 * Records a conversation turn to the database
 */
export async function recordChatTurn(
  supabase: GenericSupabase,
  planId: string,
  userId: string,
  jobId: string | null,
  userMessage: string,
  assistantMessage: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { error } = await supabase.from('plan_chat_history').insert({
    plan_id: planId,
    user_id: userId,
    job_id: jobId,
    user_message: userMessage,
    assistant_message: assistantMessage,
    metadata: metadata || {},
  })

  if (error) {
    console.error('[PlanChatV3] Failed to record chat turn:', error)
    throw new Error(`Failed to record chat turn: ${error.message}`)
  }
}

/**
 * Generates a compressed summary of conversation turns
 * Used to compress older conversations to save context window space
 */
export async function generateConversationSummary(
  turns: ConversationTurn[]
): Promise<string> {
  if (turns.length === 0) {
    return ''
  }

  if (!openaiClient) {
    // Fallback: create a simple text summary
    return turns
      .map(
        (turn) =>
          `Q: ${turn.user_message.slice(0, 100)}... A: ${turn.assistant_message.slice(0, 150)}...`
      )
      .join('\n')
  }

  try {
    const conversationText = turns
      .map((turn) => `User: ${turn.user_message}\nAssistant: ${turn.assistant_message}`)
      .join('\n\n')

    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a conversation summarizer. Compress the following conversation into a concise summary (300-600 tokens) that preserves:
- Key topics discussed
- Important decisions or findings
- Questions asked and answers given
- Any specific items, pages, or quantities mentioned

Be concise but preserve essential context.`,
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${conversationText}`,
        },
      ],
      max_completion_tokens: 600,
      temperature: 0.3,
    })

    const summary = completion.choices[0]?.message?.content?.trim() || ''
    return summary
  } catch (error) {
    console.error('[PlanChatV3] Failed to generate conversation summary:', error)
    // Fallback to simple summary
    return turns
      .map(
        (turn) =>
          `Q: ${turn.user_message.slice(0, 100)}... A: ${turn.assistant_message.slice(0, 150)}...`
      )
      .join('\n')
  }
}

/**
 * Retrieves recent conversation context for a plan
 * Returns compressed summaries for older turns + raw messages for recent turns
 */
export async function getRecentConversationContext(
  supabase: GenericSupabase,
  planId: string,
  userId: string,
  limit = 8
): Promise<ConversationContext> {
  // Fetch recent turns (raw messages)
  const recentLimit = Math.min(limit, 4) // Last 4 turns are raw
  const { data: recentTurns, error } = await supabase
    .from('plan_chat_history')
    .select('id, user_message, assistant_message, summary, created_at, metadata')
    .eq('plan_id', planId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[PlanChatV3] Failed to fetch conversation context:', error)
    return { recent_turns: [] }
  }

  if (!recentTurns || recentTurns.length === 0) {
    return { recent_turns: [] }
  }

  // Reverse to get chronological order
  const turns = recentTurns.reverse().map((turn) => ({
    id: turn.id,
    user_message: turn.user_message,
    assistant_message: turn.assistant_message,
    summary: turn.summary,
    created_at: turn.created_at,
    metadata: turn.metadata,
  }))

  // If we have more turns than the recent limit, compress older ones
  let compressedSummary: string | undefined
  if (turns.length > recentLimit) {
    const olderTurns = turns.slice(0, turns.length - recentLimit)
    const recentTurnsOnly = turns.slice(turns.length - recentLimit)

    // Generate summary for older turns if not already summarized
    const needsSummarization = olderTurns.some((turn) => !turn.summary)
    if (needsSummarization) {
      compressedSummary = await generateConversationSummary(olderTurns)
    } else {
      // Use existing summaries
      compressedSummary = olderTurns
        .map((turn) => turn.summary || '')
        .filter(Boolean)
        .join('\n\n')
    }

    return {
      recent_turns: recentTurnsOnly,
      compressed_summary: compressedSummary,
    }
  }

  return {
    recent_turns: turns,
  }
}

/**
 * Updates a conversation turn with a summary (for compression)
 */
export async function updateTurnSummary(
  supabase: GenericSupabase,
  turnId: string,
  summary: string
): Promise<void> {
  const { error } = await supabase
    .from('plan_chat_history')
    .update({ summary })
    .eq('id', turnId)

  if (error) {
    console.error('[PlanChatV3] Failed to update turn summary:', error)
  }
}

