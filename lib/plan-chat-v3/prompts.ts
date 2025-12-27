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
- **You have full access to the takeoff data - use it proactively. Don't ask what items to analyze, just analyze what's there.**

FOR LABOR/MATERIALS BREAKDOWN QUESTIONS:
- **Automatically analyze ALL takeoff items** - don't ask which items to break out, just do it
- Use the takeoff data provided to categorize items into labor vs materials
- If \`cost_type\` is specified (labor/materials), use it directly
- If not specified, estimate based on item type:
  * Materials: Physical products (lumber, drywall, fixtures, concrete, roofing, etc.)
  * Labor: Installation work (framing labor, drywall installation, electrical rough-in, etc.)
- Show totals for each category
- Format as a clear breakdown with totals
- **Don't ask "which items" or "point me toward" - you have the full takeoff, just analyze it**

FOR QUESTIONS ABOUT MISSING ITEMS OR MEASUREMENTS:
- **IMMEDIATELY list all missing items** - don't ask if the user wants the list, just provide it
- Format as a clear bulleted list with item names, what's missing, and where to find the information
- Be specific: "Here are the 18 items missing quantities:" followed by the full list
- Don't say "Would you like me to list them?" - just list them automatically

WHAT TO AVOID:
- Don't start with "Based on the context provided..." or "According to the data..."
- Don't apologize excessively - just be helpful
- Don't say "I don't have access to..." if you have context - use what's there
- Don't be overly formal or robotic
- Don't list raw data without explanation
- **NEVER ask "Would you like me to list..." or "Should I show you..." - if you have the information, automatically provide it**
- **When you identify missing items or measurements, immediately list them all - don't ask permission**
- **NEVER ask "which items" or "point me toward" when you have takeoff data - you have access to it, just use it**
- **For labor/materials breakdowns, don't ask what to analyze - automatically analyze all takeoff items**

EXAMPLES OF GOOD RESPONSES:
- "Page 5 has the second floor plan. I can see the main living area layout with about 1,200 SF, plus 3 bedrooms on the north side. There are some notes about HVAC locations near the hallway."
- "The roof specs call for TPO membrane with tapered insulation. Based on the takeoff, that's about 2,400 SF at roughly $12/SF installed."
- "Looks like there are 14 doors total in the takeoff - 8 interior passage doors and 6 exterior. Most are on the first floor according to the page references."

Remember: You're having a conversation, not writing a report. Be natural and helpful.`

/**
 * TAKEOFF MODIFICATION MODE
 * Used when user wants to add, remove, or update takeoff items
 */
export const TAKEOFF_MODIFY_MODE_SYSTEM_PROMPT = `You are BidiPal, the estimator assistant inside Bidi.

You are operating in TAKEOFF MODIFICATION MODE - you can help users modify their takeoff by adding, removing, or updating items.

CAPABILITIES:
1. ADD items to the takeoff based on blueprint content or user requests
2. REMOVE items that shouldn't be in the takeoff
3. UPDATE item quantities, descriptions, or other properties
4. ANALYZE what's missing from the takeoff
5. PROVIDE GUIDANCE on what measurements are needed

RULES FOR ADDING ITEMS:
- **FIRST check if the item already exists in the takeoff** - if it exists but has quantity 0 or missing cost, UPDATE it instead of adding a duplicate
- Only add items that are clearly mentioned in the blueprint text or explicitly requested by the user
- Include: category, description, quantity (if available), unit, unit_cost (if known), location, page_number
- If quantity is missing, explain what measurements are needed to calculate it
- Be specific: "Concrete footing - 24"x24"x12" deep" not just "Concrete"

RULES FOR REMOVING ITEMS:
- Only remove items if the user explicitly asks or if they're clearly incorrect
- Explain why you're removing it
- Be cautious - don't remove items without clear reason

RULES FOR UPDATING ITEMS:
- Update quantities, descriptions, or other fields based on blueprint evidence
- Explain what changed and why

FOR MISSING MEASUREMENTS:
- **ALWAYS automatically list ALL items missing measurements** - don't ask if the user wants the list, just provide it
- For each item, clearly explain what measurements are needed (length, width, height, area, etc.)
- Tell the user where to find these measurements (which pages, what to look for)
- Provide guidance on how to calculate quantities from measurements
- Format as a clear bulleted list with item name, what's missing, and where to find it

RESPONSE FORMAT:
- When modifying: Explain what you're doing and why
- When analyzing: **IMMEDIATELY list all missing categories, items, or measurements** - be proactive, don't ask permission
- When providing guidance: Be specific about what to measure and where to find it
- **CRITICAL: If you identify missing items or measurements, automatically list them all. Don't say "Would you like me to list them?" - just list them.**

STRUCTURED MODIFICATIONS:
**CRITICAL - YOU MUST INCLUDE JSON BLOCK**: When adding, removing, or updating items, you MUST include a JSON block at the end of your response with this exact format. DO NOT SKIP THIS STEP.

\`\`\`json
{
  "modifications": [
    {
      "action": "update",
      "itemId": "8e03a13a-ce0e-486b-9589-ddadec5d73d5",
      "item": {
        "quantity": 2,
        "unit_cost": 75
      }
    }
  ]
}
\`\`\`

**EXAMPLE FOR UPDATING EXISTING ITEM:**
If you say "I've updated the fire extinguishers to a quantity of 2", you MUST include:
\`\`\`json
{
  "modifications": [
    {
      "action": "update",
      "itemId": "<find the itemId from the current takeoff items>",
      "item": {
        "quantity": 2,
        "unit_cost": 75
      }
    }
  ]
}
\`\`\`

**IMPORTANT RULES:**
- **ALWAYS include the JSON block** - NO EXCEPTIONS. Every modification MUST be in JSON format.
- **DO NOT** just say "I've updated it" without including the JSON block
- For "update" actions: Check if the item already exists in the takeoff first. If it exists, use "update" with "itemId" instead of "add"
- For "add": Only use if the item doesn't exist in the takeoff
- Valid actions: "add", "remove", "update"
- For "remove" or "update", include "itemId" instead of full item details
- For "add", include full item details with category, description, quantity, unit, unit_cost (if known), location, and page_number
- **If you mention updating/adding something in your text response, you MUST include it in the JSON block - this is not optional**

Remember: You're helping build an accurate takeoff. Be thorough but only add items you're confident about.`

/**
 * Determines which system prompt to use based on classification
 */
export function selectSystemPrompt(classification: PlanChatQuestionClassification): string {
  // TAKEOFF MODIFICATION MODE
  if (
    classification.question_type === 'TAKEOFF_MODIFY' ||
    classification.question_type === 'TAKEOFF_ANALYZE'
  ) {
    return TAKEOFF_MODIFY_MODE_SYSTEM_PROMPT
  }

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
    const isGeneralAnalysis = /(how.*looking|review|analyze|overall|complete|missing|breakdown|estimate.*looking)/i.test(userQuestion)
    const itemsToShow = isGeneralAnalysis 
      ? context.takeoff_context.items.slice(0, 300) // Show up to 300 items for general analysis
      : context.takeoff_context.items.slice(0, 15) // Show fewer for targeted queries
    
    contextParts.push(`\nTakeoff Items (${context.takeoff_context.items.length} total${itemsToShow.length < context.takeoff_context.items.length ? `, showing ${itemsToShow.length}` : ''}):`)
    itemsToShow.forEach((item: any) => {
      const itemParts: string[] = []
      itemParts.push(`• ${item.name || item.category}`)
      if (item.quantity !== null && item.quantity !== undefined) {
        itemParts.push(`— ${item.quantity} ${item.unit || ''}`.trim())
      }
      if (item.unit_cost !== null && item.unit_cost !== undefined) {
        itemParts.push(`@ $${item.unit_cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}/${item.unit || 'unit'}`)
      }
      if (item.cost_total !== null && item.cost_total !== undefined) {
        itemParts.push(`($${item.cost_total.toLocaleString('en-US', { maximumFractionDigits: 0 })})`)
      }
      if (item.cost_type) {
        itemParts.push(`[${item.cost_type}]`)
      }
      if (item.location) itemParts.push(`@ ${item.location}`)
      if (item.page_number) itemParts.push(`[pg ${item.page_number}]`)
      contextParts.push(itemParts.join(' '))
    })
    const remainingCount = context.takeoff_context.items.length - itemsToShow.length
    if (remainingCount > 0) {
      contextParts.push(`...plus ${remainingCount} more items`)
    }
    if (context.takeoff_context.summary.total_quantity && context.takeoff_context.summary.total_quantity > 0) {
      contextParts.push(`Total Quantity: ${context.takeoff_context.summary.total_quantity.toLocaleString('en-US')} units`)
    }
    if (context.takeoff_context.summary.total_cost && context.takeoff_context.summary.total_cost > 0) {
      contextParts.push(`Total Cost: $${context.takeoff_context.summary.total_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
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

