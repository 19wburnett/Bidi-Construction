import OpenAI from 'openai'
import type { PlanChatDeterministicResult } from './deterministicEngine'

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const TAKEOFF_MODE_SYSTEM_PROMPT = `You are BidiPal, the estimator assistant inside Bidi.

You are given:
- The user's question.
- A precomputed summary of the relevant takeoff quantities and/or costs.

You MUST:
- ONLY use the totals, breakdowns, and related_items given to you.
- NEVER invent new quantities or costs.
- NEVER refer to blueprint snippets.
- Be concise, friendly, and practical. Sound like a helpful estimator teammate: "Yep, looks like…", "Here's the breakdown:".
- Answer clearly using ONLY the provided structured data.

If the data shows no matching items, say so clearly. Do not make up numbers.`

const BLUEPRINT_MODE_SYSTEM_PROMPT = `You are BidiPal, the estimator assistant inside Bidi.

You are given:
- The user's question
- A small set of blueprint text snippets (with page/sheet info)
- Optional takeoff summary

Your job is to summarize or explain what the snippets indicate.
Do NOT dump raw snippet text.
Do NOT exaggerate or invent details.
Be concise, friendly, and grounded in the data.`

/**
 * Builds the user content for the answer LLM
 */
function buildAnswerUserContent(result: PlanChatDeterministicResult): string {
  const parts: string[] = []

  parts.push(`User question:\n${result.question}\n`)

  parts.push('Data you must use:')

  // Build a compact summary object (not the full result)
  const summary: any = {
    scope: result.scope_description,
  }

  if (result.totals) {
    summary.totals = result.totals
  }

  if (result.breakdowns) {
    summary.breakdowns = {}
    if (result.breakdowns.by_category) {
      summary.breakdowns.by_category = result.breakdowns.by_category.slice(0, 5)
    }
    if (result.breakdowns.by_level) {
      summary.breakdowns.by_level = result.breakdowns.by_level.slice(0, 5)
    }
  }

  // Include related items but limit to top 10
  if (result.related_items.length > 0) {
    summary.items = result.related_items.slice(0, 10).map((item) => ({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      cost: item.cost_total,
    }))
    if (result.related_items.length > 10) {
      summary.items_note = `...and ${result.related_items.length - 10} more items`
    }
  }

  // Include blueprint snippets but limit text length
  if (result.blueprint_snippets && result.blueprint_snippets.length > 0) {
    summary.blueprint_snippets = result.blueprint_snippets.slice(0, 5).map((snippet) => ({
      text: snippet.text.length > 300 ? snippet.text.slice(0, 300) + '...' : snippet.text,
      page: snippet.page_number,
      sheet: snippet.sheet_name,
    }))
  }

  parts.push(JSON.stringify(summary, null, 2))

  return parts.join('\n\n')
}

/**
 * Generates a human-friendly answer based on the deterministic result
 */
export async function generatePlanChatAnswer(
  result: PlanChatDeterministicResult,
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI client is not configured. Please add an API key.')
  }

  const isTakeoffQuestion =
    result.classification.question_type === 'TAKEOFF_QUANTITY' ||
    result.classification.question_type === 'TAKEOFF_COST'

  const systemPrompt = isTakeoffQuestion ? TAKEOFF_MODE_SYSTEM_PROMPT : BLUEPRINT_MODE_SYSTEM_PROMPT

  const userContent = buildAnswerUserContent(result)

  // Build messages - only include last 3 messages for context
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  // Add recent conversation context (last 3 messages)
  if (recentMessages && recentMessages.length > 0) {
    const lastThree = recentMessages.slice(-3)
    for (const msg of lastThree) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // Add the current question and data
  messages.push({ role: 'user', content: userContent })

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: messages as any,
      max_completion_tokens: 600,
    })

    const answer = completion.choices[0]?.message?.content?.trim()

    if (!answer) {
      // Fallback answer
      if (result.related_items.length > 0) {
        return `I found ${result.related_items.length} matching item${
          result.related_items.length === 1 ? '' : 's'
        } in the takeoff. ${result.scope_description}`
      } else if (result.blueprint_snippets && result.blueprint_snippets.length > 0) {
        return `I found ${result.blueprint_snippets.length} relevant blueprint snippet${
          result.blueprint_snippets.length === 1 ? '' : 's'
        }. ${result.scope_description}`
      } else {
        return "I couldn't find relevant information to answer that question. Try rephrasing or asking about specific items or pages."
      }
    }

    return answer
  } catch (error) {
    console.error('[PlanChat] Answer generation failed:', error)
    throw error
  }
}

