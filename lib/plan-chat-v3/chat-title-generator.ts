/**
 * Chat Title Generator
 * Automatically generates descriptive titles for chat sessions based on conversation content
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { aiGateway } from '@/lib/ai-gateway-provider'

type GenericSupabase = SupabaseClient<any, any, any>

const hasAIGatewayKey = !!process.env.AI_GATEWAY_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

/**
 * Generates a concise, descriptive title for a chat session based on conversation content
 */
export async function generateChatTitle(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!hasAIGatewayKey) {
    // Fallback: use first user message
    const firstUserMessage = messages.find(m => m.role === 'user')?.content || ''
    return firstUserMessage.substring(0, 50).trim() || 'Chat'
  }

  try {
    // Build conversation summary (first few messages)
    const conversationText = messages
      .slice(0, 6) // Use first 6 messages (3 turns) for context
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')

    const completion = await aiGateway.generate({
      model: OPENAI_MODEL,
      system: `You are a helpful assistant that generates concise, descriptive titles for construction plan chat conversations.

Rules:
- Generate a title that captures the main topic or question being discussed
- Keep it short: 3-8 words maximum
- Be specific: "Missing Measurements Review" not "Chat about plans"
- Focus on the primary subject: takeoff items, measurements, scope, specific trades, etc.
- Use title case (capitalize important words)
- Don't include words like "Chat", "Discussion", or "Conversation" unless necessary
- Examples: "Roofing Quantity Analysis", "Missing Door Measurements", "Electrical Scope Review", "Concrete Footing Dimensions"

Return ONLY the title, nothing else.`,
      prompt: `Generate a concise title for this conversation:\n\n${conversationText}`,
      maxTokens: 30,
      temperature: 0.7,
    })

    const title = completion.content?.trim() || ''
    
    // Fallback if title is too long or empty
    if (!title || title.length > 60) {
      const firstUserMessage = messages.find(m => m.role === 'user')?.content || ''
      return firstUserMessage.substring(0, 50).trim() || 'Chat'
    }

    return title
  } catch (error) {
    console.error('[ChatTitleGenerator] Failed to generate title:', error)
    // Fallback: use first user message
    const firstUserMessage = messages.find(m => m.role === 'user')?.content || ''
    return firstUserMessage.substring(0, 50).trim() || 'Chat'
  }
}

/**
 * Checks if a chat session needs a title update and generates one if needed
 * Only updates if:
 * - Chat has 2-4 messages (enough context but not too many)
 * - Title is still the default/generic one
 */
export async function updateChatTitleIfNeeded(
  supabase: GenericSupabase,
  chatId: string,
  userId: string
): Promise<void> {
  try {
    // Get current chat session
    const { data: session, error: sessionError } = await supabase
      .from('plan_chat_sessions')
      .select('id, title')
      .eq('id', chatId)
      .eq('user_id', userId)
      .single()

    if (sessionError || !session) {
      return
    }

    // Check if title is generic/default (needs updating)
    const isGenericTitle = 
      !session.title ||
      session.title.startsWith('Chat ') ||
      session.title.length < 10 ||
      session.title === 'New Chat' ||
      session.title === 'Untitled Chat'

    if (!isGenericTitle) {
      // Title already customized, don't update
      return
    }

    // Get recent messages for this chat
    const { data: messages, error: messagesError } = await supabase
      .from('plan_chat_messages')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(6) // Get first 6 messages (3 turns)

    if (messagesError || !messages || messages.length < 2) {
      // Not enough messages yet
      return
    }

    // Only generate title if we have 2-4 messages (sweet spot)
    // Too early (1 message) = not enough context
    // Too late (many messages) = title might not reflect the conversation well
    if (messages.length >= 2 && messages.length <= 4) {
      const formattedMessages = messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))

      const newTitle = await generateChatTitle(formattedMessages)

      // Update the chat session title
      await supabase
        .from('plan_chat_sessions')
        .update({ title: newTitle })
        .eq('id', chatId)
        .eq('user_id', userId)

      console.log(`[ChatTitleGenerator] Updated chat ${chatId} title to: "${newTitle}"`)
    }
  } catch (error) {
    console.error('[ChatTitleGenerator] Failed to update chat title:', error)
    // Don't throw - this is a nice-to-have feature
  }
}



