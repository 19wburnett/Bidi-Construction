/**
 * Dual System Prompting for Plan Chat V3
 * 
 * Two distinct system prompts:
 * - TAKEOFF MODE: Strict, deterministic, numeric-only
 * - COPILOT MODE: Cursor-style reasoning, collaborative, explanatory
 */

import type { PlanChatQuestionClassification } from '@/lib/planChat/classifier'

/**
 * TAKEOFF MODE (STRICT)
 * Used when:
 * - question_type = TAKEOFF_COST
 * - question_type = TAKEOFF_QUANTITY
 * - strict_takeoff_only = true
 * 
 * Rules:
 * - No speculation
 * - No blueprint paraphrasing
 * - Return only grounded numeric results
 * - Crisp, literal, deterministic
 */
export const TAKEOFF_MODE_SYSTEM_PROMPT = `You are BidiPal, the estimator assistant inside Bidi.

You are operating in TAKEOFF MODE - a strict, deterministic mode for answering questions about quantities and costs.

RULES:
1. ONLY use the takeoff data provided to you. Do not reference blueprint snippets or make assumptions.
2. Return ONLY grounded numeric results. No speculation, no "might be" or "could be" language.
3. Be crisp and literal. State quantities and costs exactly as they appear in the data.
4. If the data doesn't contain the answer, say so clearly: "I don't see that in the takeoff data."
5. Do not paraphrase blueprint text or reference architectural details not in the takeoff.
6. Format numbers clearly: use commas for thousands, include units, show currency symbols for costs.

TONE:
- Professional and direct
- Like a calculator that explains its results
- No conversational fluff - just the facts

EXAMPLES:
- "The total quantity is 1,240 LF."
- "I found 3 items totaling $42,500."
- "I don't see any roofing items in the takeoff for that category."

Remember: You are a deterministic data retrieval system, not a reasoning engine. Stick to the numbers.`

/**
 * COPILOT MODE (Cursor-style reasoning)
 * Used when:
 * - question_type = OTHER
 * - question_type = COMBINED
 * - question_type = PAGE_CONTENT
 * - question_type = BLUEPRINT_CONTEXT
 * - Classification contains vague, strategic, comparative, or missing-item language
 * 
 * Capabilities:
 * - Describe what's on specific pages
 * - Reason about scope
 * - Identify missing items
 * - Suggest quality checks
 * - Compare pages
 * - Flag inconsistencies
 * - Interpret design intent
 * - Suggest next steps
 * 
 * Tone: Expert estimator copilot. Helpful, collaborative, natural conversation.
 */
export const COPILOT_MODE_SYSTEM_PROMPT = `You are BidiPal, a friendly estimator assistant inside Bidi.

You help users understand their construction blueprints and takeoff data through natural conversation.

YOUR COMMUNICATION STYLE:
- Talk like a helpful colleague, not a robot. Use natural language.
- Be direct and lead with the answer. Don't say "Based on the provided context..." - just answer.
- Use contractions: "I can see", "Here's what", "That's on", "It looks like"
- Keep responses concise - 2-4 short paragraphs or bullet points max
- Reference specific pages/sheets: "On page 5, I see..." or "Sheet A2.1 shows..."
- If the data is limited, acknowledge it naturally: "I can see some notes about electrical here, though the full details would be on the E sheets."

FOR PAGE-CONTENT QUESTIONS (like "what's on page 5"):
- Summarize what you see on that page in plain English
- Mention the sheet name/type if available (e.g., "This looks like a floor plan sheet")
- Highlight key items: dimensions, materials, notes, room labels, etc.
- Example: "Page 5 has the 3rd floor electrical plan. I can see outlet placements, circuit routing, and some notes about panel locations. The main features are..."

FOR BLUEPRINT QUESTIONS:
- Synthesize the snippet text into a coherent answer
- Don't just dump raw text - explain what it means
- Connect it to other relevant info if available

FOR TAKEOFF QUESTIONS:
- Lead with the numbers: "About 1,240 SF of flooring" not "The takeoff indicates approximately..."
- Group related items logically
- Mention locations and page references when available

WHAT TO AVOID:
- Don't start with "Based on the context provided..." or "According to the data..."
- Don't apologize excessively - just be helpful
- Don't say "I don't have access to..." if you have context - use what's there
- Don't be overly formal or robotic
- Don't list raw data without explanation

EXAMPLES OF GOOD RESPONSES:
- "Page 5 has the second floor plan. I can see the main living area layout with about 1,200 SF, plus 3 bedrooms on the north side. There are some notes about HVAC locations near the hallway."
- "The roof specs call for TPO membrane with tapered insulation. Based on the takeoff, that's about 2,400 SF at roughly $12/SF installed."
- "Looks like there are 14 doors total in the takeoff - 8 interior passage doors and 6 exterior. Most are on the first floor according to the page references."

Remember: You're having a conversation, not writing a report. Be natural and helpful.`

/**
 * Determines which system prompt to use based on classification
 */
export function selectSystemPrompt(classification: PlanChatQuestionClassification): string {
  // TAKEOFF MODE conditions
  if (
    classification.question_type === 'TAKEOFF_COST' ||
    classification.question_type === 'TAKEOFF_QUANTITY' ||
    classification.strict_takeoff_only
  ) {
    return TAKEOFF_MODE_SYSTEM_PROMPT
  }

  // COPILOT MODE for everything else
  return COPILOT_MODE_SYSTEM_PROMPT
}

/**
 * Builds the user prompt with context
 */
export function buildUserPrompt(
  userQuestion: string,
  context: {
    recent_conversation?: Array<{ user: string; assistant: string }>
    project_metadata?: any
    takeoff_context?: any
    blueprint_context?: any
    related_sheets?: any[]
    global_scope_summary?: string
    notes?: string[]
  }
): string {
  const parts: string[] = []

  // Check if this is a page-specific question
  const isPageQuestion = context.notes?.some(note => note.includes('specifically asked about page'))

  // Format context more naturally
  const contextParts: string[] = []

  // Project metadata (brief)
  if (context.project_metadata) {
    const meta = context.project_metadata
    const projectInfo: string[] = []
    if (meta.plan_title) projectInfo.push(meta.plan_title)
    if (meta.job_name && meta.job_name !== meta.plan_title) projectInfo.push(`(${meta.job_name})`)
    if (projectInfo.length > 0) {
      contextParts.push(`Project: ${projectInfo.join(' ')}`)
    }
  }

  // Related sheets - show first for page questions
  if (context.related_sheets && context.related_sheets.length > 0 && isPageQuestion) {
    contextParts.push(`\nSheet Info:`)
    context.related_sheets.forEach((sheet: any) => {
      const sheetParts = [`Page ${sheet.page_number}`]
      if (sheet.title) sheetParts.push(`- "${sheet.title}"`)
      if (sheet.discipline) sheetParts.push(`(${sheet.discipline})`)
      if (sheet.sheet_type) sheetParts.push(`[${sheet.sheet_type}]`)
      contextParts.push(sheetParts.join(' '))
    })
  }

  // Blueprint snippets - format as readable text grouped by page
  if (context.blueprint_context && context.blueprint_context.chunks.length > 0) {
    // Group chunks by page for cleaner presentation
    const chunksByPage = new Map<number | string, any[]>()
    context.blueprint_context.chunks.forEach((chunk: any) => {
      const pageKey = chunk.page_number || 'unknown'
      if (!chunksByPage.has(pageKey)) {
        chunksByPage.set(pageKey, [])
      }
      chunksByPage.get(pageKey)!.push(chunk)
    })

    contextParts.push(`\nBlueprint Content:`)
    chunksByPage.forEach((chunks, pageKey) => {
      const pageHeader = pageKey !== 'unknown' ? `Page ${pageKey}` : 'General'
      const sheetName = chunks[0]?.sheet_name
      const headerParts = [pageHeader]
      if (sheetName) headerParts.push(`(${sheetName})`)
      
      contextParts.push(`\n[${headerParts.join(' ')}]`)
      chunks.forEach((chunk: any) => {
        // Clean up the text - remove excessive whitespace
        const cleanedText = chunk.text.replace(/\s+/g, ' ').trim()
        if (cleanedText.length > 0) {
          contextParts.push(cleanedText)
        }
      })
    })
  }

  // Takeoff items (if relevant)
  if (context.takeoff_context && context.takeoff_context.items.length > 0) {
    contextParts.push(`\nTakeoff Items:`)
    context.takeoff_context.items.slice(0, 15).forEach((item: any) => {
      const itemParts: string[] = []
      itemParts.push(`• ${item.name || item.category}`)
      if (item.quantity !== null && item.quantity !== undefined) {
        itemParts.push(`— ${item.quantity} ${item.unit || ''}`.trim())
      }
      if (item.cost_total !== null && item.cost_total !== undefined) {
        itemParts.push(`($${item.cost_total.toLocaleString('en-US', { maximumFractionDigits: 0 })})`)
      }
      if (item.location) itemParts.push(`@ ${item.location}`)
      if (item.page_number) itemParts.push(`[pg ${item.page_number}]`)
      contextParts.push(itemParts.join(' '))
    })
    if (context.takeoff_context.items.length > 15) {
      contextParts.push(`...plus ${context.takeoff_context.items.length - 15} more items`)
    }
    if (context.takeoff_context.summary.total_quantity && context.takeoff_context.summary.total_quantity > 0) {
      contextParts.push(`Total: ${context.takeoff_context.summary.total_quantity.toLocaleString('en-US')} units`)
    }
    if (context.takeoff_context.summary.total_cost && context.takeoff_context.summary.total_cost > 0) {
      contextParts.push(`Cost: $${context.takeoff_context.summary.total_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
    }
  }

  // Related sheets (for non-page questions)
  if (context.related_sheets && context.related_sheets.length > 0 && !isPageQuestion) {
    contextParts.push(`\nRelated Sheets:`)
    context.related_sheets.slice(0, 5).forEach((sheet: any) => {
      const sheetParts = [`Page ${sheet.page_number}`]
      if (sheet.title) sheetParts.push(`"${sheet.title}"`)
      if (sheet.discipline) sheetParts.push(`(${sheet.discipline})`)
      contextParts.push(sheetParts.join(' - '))
    })
  }

  // Build the final prompt
  parts.push(`User question: ${userQuestion}`)
  
  if (contextParts.length > 0) {
    parts.push(`\n---\nContext from the plans:\n${contextParts.join('\n')}`)
  }

  // Add brief instruction
  parts.push(`\n---\nAnswer naturally in 2-4 sentences or short bullet points. Lead with the key information.`)

  return parts.join('\n')
}

