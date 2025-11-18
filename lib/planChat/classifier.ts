import OpenAI from 'openai'

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export type PlanChatQuestionClassification = {
  question_type:
    | 'TAKEOFF_QUANTITY'
    | 'TAKEOFF_COST'
    | 'PAGE_CONTENT'
    | 'BLUEPRINT_CONTEXT'
    | 'COMBINED'
    | 'OTHER'
  targets: string[]
  levels?: string[]
  pages?: number[]
  strict_takeoff_only: boolean
}

const CLASSIFIER_SYSTEM_PROMPT = `You are a classifier for an estimator assistant.

Your ONLY job is to classify the user's question about a construction plan.
Return a JSON object with:
- question_type: one of "TAKEOFF_QUANTITY", "TAKEOFF_COST", "PAGE_CONTENT", "BLUEPRINT_CONTEXT", "COMBINED", "OTHER"
- targets: array of relevant item/material/trade words (e.g., ["door", "window", "concrete"])
- levels: array of levels/floors mentioned (optional, e.g., ["first floor", "basement"])
- pages: array of page numbers mentioned (optional, e.g., [1, 3, 5])
- strict_takeoff_only: boolean (true if question must ONLY be answered with takeoff, such as total cost questions)

Question types:
- TAKEOFF_QUANTITY: Questions about quantities, amounts, "how much", "how many"
- TAKEOFF_COST: Questions about costs, prices, "how much does it cost", "what's the price"
- PAGE_CONTENT: Questions asking about specific pages ("what's on page 5", "show me page 3")
- BLUEPRINT_CONTEXT: Questions about blueprint notes, specifications, requirements
- COMBINED: Questions that need both takeoff data and blueprint context
- OTHER: General questions that don't fit the above categories

Do not answer the question. Do not explain. Return JSON only.`

/**
 * Classifies a user's question to determine what type of data retrieval is needed.
 */
export async function classifyPlanChatQuestion(
  question: string
): Promise<PlanChatQuestionClassification> {
  if (!openaiClient) {
    throw new Error('OpenAI client is not configured. Please add an API key.')
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: CLASSIFIER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Low temperature for consistent classification
      max_completion_tokens: 200,
    })

    const content = completion.choices[0]?.message?.content
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

