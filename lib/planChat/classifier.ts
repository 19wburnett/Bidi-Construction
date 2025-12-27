import { aiGateway } from '@/lib/ai-gateway-provider'

const hasAIGatewayKey = !!process.env.AI_GATEWAY_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export type PlanChatQuestionClassification = {
  question_type:
    | 'TAKEOFF_QUANTITY'
    | 'TAKEOFF_COST'
    | 'PAGE_CONTENT'
    | 'BLUEPRINT_CONTEXT'
    | 'COMBINED'
    | 'TAKEOFF_MODIFY'
    | 'TAKEOFF_ANALYZE'
    | 'OTHER'
  targets: string[]
  levels?: string[]
  pages?: number[]
  strict_takeoff_only: boolean
  modification_intent?: 'add' | 'remove' | 'update' | 'analyze_missing'
}

const CLASSIFIER_SYSTEM_PROMPT = `You are a classifier for an estimator assistant.

Your ONLY job is to classify the user's question about a construction plan.
Return a JSON object with:
- question_type: one of "TAKEOFF_QUANTITY", "TAKEOFF_COST", "PAGE_CONTENT", "BLUEPRINT_CONTEXT", "COMBINED", "TAKEOFF_MODIFY", "TAKEOFF_ANALYZE", "OTHER"
- targets: array of relevant item/material/trade words (e.g., ["door", "window", "concrete"])
- levels: array of levels/floors mentioned (optional, e.g., ["first floor", "basement"])
- pages: array of page numbers mentioned (optional, e.g., [1, 3, 5])
- strict_takeoff_only: boolean (true if question must ONLY be answered with takeoff, such as total cost questions)
- modification_intent: one of "add", "remove", "update", "analyze_missing" (only if question_type is TAKEOFF_MODIFY or TAKEOFF_ANALYZE)

Question types:
- TAKEOFF_QUANTITY: Questions about quantities, amounts, "how much", "how many"
- TAKEOFF_COST: Questions about costs, prices, "how much does it cost", "what's the price"
- PAGE_CONTENT: Questions asking about specific pages ("what's on page 5", "show me page 3")
- BLUEPRINT_CONTEXT: Questions about blueprint notes, specifications, requirements
- COMBINED: Questions that need both takeoff data and blueprint context
- TAKEOFF_MODIFY: User wants to add, remove, or update items in the takeoff ("add concrete", "remove door", "update window quantity")
- TAKEOFF_ANALYZE: User wants to analyze the takeoff ("what's missing", "what scope is missing", "what measurements do I need")
- OTHER: General questions that don't fit the above categories

Do not answer the question. Do not explain. Return JSON only.`

/**
 * Classifies a user's question to determine what type of data retrieval is needed.
 */
export async function classifyPlanChatQuestion(
  question: string
): Promise<PlanChatQuestionClassification> {
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key is not configured. Please add AI_GATEWAY_API_KEY to your environment variables.')
  }

  try {
    const completion = await aiGateway.generate({
      model: OPENAI_MODEL,
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: question,
      responseFormat: { type: 'json_object' },
      maxTokens: 200,
    })

    const content = completion.content
    if (!content) {
      throw new Error('Classifier returned empty response')
    }

    const parsed = JSON.parse(content) as PlanChatQuestionClassification

    // Validate and normalize the classification
    const validTypes = [
      'TAKEOFF_QUANTITY',
      'TAKEOFF_COST',
      'PAGE_CONTENT',
      'BLUEPRINT_CONTEXT',
      'COMBINED',
      'TAKEOFF_MODIFY',
      'TAKEOFF_ANALYZE',
      'OTHER',
    ]
    if (!validTypes.includes(parsed.question_type)) {
      parsed.question_type = 'OTHER'
    }

    // Ensure arrays exist
    parsed.targets = Array.isArray(parsed.targets) ? parsed.targets : []
    parsed.levels = Array.isArray(parsed.levels) ? parsed.levels : undefined
    parsed.pages = Array.isArray(parsed.pages) ? parsed.pages : undefined
    parsed.strict_takeoff_only = Boolean(parsed.strict_takeoff_only)

    if (process.env.NODE_ENV === 'development') {
      console.log('[PlanChat] classification:', JSON.stringify(parsed, null, 2))
    }

    return parsed
  } catch (error) {
    console.error('[PlanChat] Classification failed:', error)
    // Return a safe default classification
    return {
      question_type: 'OTHER',
      targets: [],
      strict_takeoff_only: false,
    }
  }
}

