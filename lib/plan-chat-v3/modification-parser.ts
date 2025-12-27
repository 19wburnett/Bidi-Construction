/**
 * Parses AI responses to extract takeoff modification instructions
 * The AI will describe modifications in natural language, and we parse them
 * to create structured modification requests
 */

import type { PlanChatQuestionClassification } from '@/lib/planChat/classifier'
import type { TakeoffModification } from './takeoff-modifier'

export interface ParsedModification {
  modifications: TakeoffModification[]
  explanation: string
  needsConfirmation: boolean
}

/**
 * Parse AI response to extract modification instructions
 * First tries to parse structured JSON, then falls back to pattern matching
 */
export async function parseModificationRequest(
  aiResponse: string,
  classification: PlanChatQuestionClassification,
  currentTakeoffItems: Array<{ id?: string; name?: string; description?: string; category?: string; quantity?: number | null; unit?: string | null; unit_cost?: number | null }>
): Promise<ParsedModification> {
  const modifications: TakeoffModification[] = []
  let explanation = aiResponse
  let needsConfirmation = false

  // If classification indicates modification intent, try to parse it
  if (classification.question_type === 'TAKEOFF_MODIFY' && classification.modification_intent && classification.modification_intent !== 'analyze_missing') {
    // First, try to extract structured JSON from the response
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/```\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        if (parsed.modifications && Array.isArray(parsed.modifications)) {
          for (const mod of parsed.modifications) {
            if (mod.action === 'add' && mod.item) {
              // Check if item already exists (by name/description match)
              const itemName = (mod.item.description || mod.item.name || '').toLowerCase()
              const existingItem = currentTakeoffItems.find((item) => {
                const existingName = (item.name || item.description || '').toLowerCase()
                return existingName.includes(itemName) || itemName.includes(existingName) ||
                  (itemName.length > 5 && existingName.length > 5 && 
                   (existingName.includes(itemName.substring(0, Math.min(10, itemName.length))) ||
                    itemName.includes(existingName.substring(0, Math.min(10, existingName.length)))))
              })
              
              if (existingItem && existingItem.id) {
                // Item exists - UPDATE it instead of adding
                const updateData: any = {}
                if (mod.item.quantity !== undefined && mod.item.quantity !== null) updateData.quantity = mod.item.quantity
                if (mod.item.unit_cost !== undefined && mod.item.unit_cost !== null) updateData.unit_cost = mod.item.unit_cost
                if (mod.item.unit) updateData.unit = mod.item.unit
                if (mod.item.location) updateData.location = mod.item.location
                if (mod.item.page_number) updateData.page_number = mod.item.page_number
                if (mod.item.description) updateData.description = mod.item.description
                
                modifications.push({
                  action: 'update',
                  itemId: existingItem.id,
                  item: updateData,
                  reason: mod.reason || 'AI updated existing item with quantities/costs',
                })
              } else {
                // New item - ADD it
                modifications.push({
                  action: 'add',
                  item: {
                    category: mod.item.category || 'Uncategorized',
                    description: mod.item.description || mod.item.name,
                    quantity: mod.item.quantity ?? null,
                    unit: mod.item.unit || null,
                    unit_cost: mod.item.unit_cost ?? null,
                    location: mod.item.location || null,
                    page_number: mod.item.page_number ?? null,
                    notes: mod.item.notes || null,
                  },
                  reason: mod.reason || 'AI suggested addition',
                })
              }
            } else if (mod.action === 'remove' && mod.itemId) {
              modifications.push({
                action: 'remove',
                itemId: mod.itemId,
                reason: mod.reason || 'AI suggested removal',
              })
            } else if (mod.action === 'update' && mod.itemId && mod.item) {
              modifications.push({
                action: 'update',
                itemId: mod.itemId,
                item: mod.item,
                reason: mod.reason || 'AI suggested update',
              })
            }
          }
        }
      } catch (error) {
        console.warn('[ModificationParser] Failed to parse JSON block:', error)
        // Fall through to pattern matching
      }
    }

    // If no structured JSON found, fall back to pattern matching
    if (modifications.length === 0) {
      const intent = classification.modification_intent
      const lowerResponse = aiResponse.toLowerCase()
      
      console.log('[ModificationParser] No JSON found, trying pattern matching:', {
        intent,
        responseLength: aiResponse.length,
        currentItemsCount: currentTakeoffItems.length,
      })

      if (intent === 'add') {
        // Look for patterns like "add X", "include Y", "need Z", "adding 2 fire extinguishers", "updated with 2 fire extinguishers", "get those two fire extinguishers", "updated X to a quantity of Y"
        const addPatterns = [
          // Pattern for "updated X to a quantity of Y" or "updated X to Y"
          /(?:updated|update|updating)\s+([^,\.]+?)\s+(?:on|at)\s+[^,\.]+?\s+(?:to|with|at)\s+(?:a\s+)?(?:quantity\s+of\s+)?(\d+)/gi,
          /(?:updated|update|updating)\s+([^,\.]+?)\s+(?:to|with|at)\s+(?:a\s+)?(?:quantity\s+of\s+)?(\d+)/gi,
          /(?:adding|added|add|include|need|should have|missing|update|updating|updated|set|setting|get|getting|will|I'll)\s+(?:those|these|the\s+)?(?:two|2|three|3|four|4|five|5|(\d+))?\s*([^,\.]+?)(?:\s+at|\s+@|\s+for|\s+to|,|\.|$)/gi,
          /(?:add|include|update|set|get)\s+(?:those|these|the\s+)?(\d+)\s+([^,\.]+?)(?:,|\.|$)/gi,
          /(\d+)\s+([^,\.]+?)(?:\s+(?:to|for|in)\s+(?:the\s+)?takeoff)/gi,
          /(?:two|2|three|3|four|4|five|5|(\d+))\s+([^,\.]+?)(?:\s+(?:to|for|in)\s+(?:the\s+)?takeoff)/gi,
        ]

        for (const pattern of addPatterns) {
          let match
          while ((match = pattern.exec(aiResponse)) !== null) {
            // Handle patterns where quantity might be in match[1] or match[2]
            let quantity: number | null = null
            let itemDescription: string | null = null
            
            // Special handling for "updated X to quantity Y" patterns (item in match[1], quantity in match[2])
            if (pattern.source.includes('updated') && match[1] && match[2] && /^\d+$/.test(match[2])) {
              itemDescription = match[1]?.trim() || null
              quantity = parseInt(match[2], 10)
              console.log('[ModificationParser] Found "updated X to Y" pattern:', itemDescription, 'quantity:', quantity)
            }
            // Check if first match group is a number (quantity)
            else if (match[1] && /^\d+$/.test(match[1])) {
              quantity = parseInt(match[1], 10)
              itemDescription = match[2]?.trim() || null
            } else if (match[2]) {
              // Check if match[2] is a number
              if (/^\d+$/.test(match[2])) {
                quantity = parseInt(match[2], 10)
                itemDescription = match[3]?.trim() || match[1]?.trim() || null
              } else {
                // match[2] is the description, check match[1] for quantity
                quantity = match[1] ? parseInt(match[1], 10) : null
                itemDescription = match[2]?.trim()
              }
            } else {
              itemDescription = match[1]?.trim() || null
            }
            
            // Handle word-based quantities like "two", "three"
            if (!quantity && itemDescription) {
              const quantityWords: Record<string, number> = {
                'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
              }
              const lowerDesc = itemDescription.toLowerCase()
              for (const [word, num] of Object.entries(quantityWords)) {
                if (lowerDesc.startsWith(word + ' ')) {
                  quantity = num
                  itemDescription = itemDescription.substring(word.length).trim()
                  break
                }
              }
            }
            
            // Skip if it's just "takeoff" or other non-item words
            if (!itemDescription || itemDescription.length < 3) {
              continue
            }
            
            const lowerDesc = itemDescription.toLowerCase()
            const skipWords = ['takeoff', 'estimate', 'items', 'item', 'quantities', 'costs', 'get them', 'priced out', 'and costs', 'missing', 'still']
            if (skipWords.some(word => lowerDesc.includes(word)) ||
                lowerDesc.match(/^\*\s*\*\*/)) { // Skip markdown formatting like "**driveway paving**"
              continue
            }
            
            // Extract cost if mentioned (e.g., "$150 each", "at $150", "$150", "slotted them in at $75")
            // Look near the item mention for cost
            const itemContextStart = Math.max(0, (match.index || 0) - 100)
            const itemContextEnd = Math.min(aiResponse.length, (match.index || 0) + match[0].length + 200)
            const itemContext = aiResponse.substring(itemContextStart, itemContextEnd)
            
            const costPatterns = [
              /(?:at|@|\$)\s*(\d+(?:\.\d+)?)\s*(?:each|per|ea)/i,
              /\$\s*(\d+(?:\.\d+)?)\s*(?:each|per|ea)/i,
              /cost.*?\$\s*(\d+(?:\.\d+)?)/i,
              /slotted.*?\$\s*(\d+(?:\.\d+)?)/i, // "slotted them in at $75"
            ]
            let unitCost: number | null = null
            for (const costPattern of costPatterns) {
              const costMatch = itemContext.match(costPattern)
              if (costMatch) {
                unitCost = parseFloat(costMatch[1])
                console.log('[ModificationParser] Found cost:', unitCost, 'from context:', itemContext.substring(0, 100))
                break
              }
            }
            
            if (itemDescription && itemDescription.length > 3) {
              // Check if item already exists - use fuzzy matching with typo tolerance
              const itemNameLower = itemDescription.toLowerCase().trim()
              console.log('[ModificationParser] Looking for item:', itemNameLower, 'in', currentTakeoffItems.length, 'items')
              
              // Normalize for typos - fix common misspellings
              const normalizeForMatching = (str: string) => {
                return str
                  .toLowerCase()
                  .replace(/extingusher/g, 'extinguisher') // Fix "extingusher" typo
                  .replace(/extingushers/g, 'extinguishers')
                  .replace(/s\s*$/g, '') // Remove trailing 's' for plural matching
                  .trim()
              }
              
              const normalizedItemName = normalizeForMatching(itemNameLower)
              
              const existingItem = currentTakeoffItems.find((item) => {
                const existingName = (item.name || item.description || '').toLowerCase().trim()
                if (!existingName) return false
                
                const normalizedExisting = normalizeForMatching(existingName)
                
                // Exact match (after normalization)
                if (normalizedExisting === normalizedItemName) {
                  console.log('[ModificationParser] Exact normalized match:', existingName, '===', itemNameLower)
                  return true
                }
                
                // Contains match (either direction)
                if (normalizedExisting.includes(normalizedItemName) || 
                    normalizedItemName.includes(normalizedExisting)) {
                  console.log('[ModificationParser] Contains match:', existingName, 'contains', itemNameLower)
                  return true
                }
                
                // Word-based matching for multi-word items
                const itemWords = normalizedItemName.split(/\s+/).filter(w => w.length > 2)
                const existingWords = normalizedExisting.split(/\s+/).filter(w => w.length > 2)
                
                if (itemWords.length > 0 && existingWords.length > 0) {
                  const matchingWords = itemWords.filter(w => existingWords.includes(w))
                  // If at least 50% of words match, consider it a match
                  const matchRatio = matchingWords.length / Math.max(itemWords.length, existingWords.length)
                  if (matchRatio >= 0.5) {
                    console.log('[ModificationParser] Word-based match:', existingName, 'matches', itemNameLower, `(${matchingWords.length}/${itemWords.length} words, ${(matchRatio * 100).toFixed(0)}% match)`)
                    return true
                  }
                }
                
                return false
              })
              
              if (existingItem && existingItem.id) {
                // Update existing item
                const updateData: any = {}
                if (quantity !== null && quantity !== undefined) updateData.quantity = quantity
                if (unitCost !== null && unitCost !== undefined) updateData.unit_cost = unitCost
                if (quantity !== null && !existingItem.unit) updateData.unit = 'EA'
                
                console.log('[ModificationParser] Found existing item to update:', {
                  itemId: existingItem.id,
                  existingName: existingItem.name || existingItem.description,
                  updateData,
                })
                
                modifications.push({
                  action: 'update',
                  itemId: existingItem.id,
                  item: updateData,
                  reason: 'User requested to update this item',
                })
              } else {
                // Add new item
                console.log('[ModificationParser] Adding new item:', {
                  description: itemDescription,
                  quantity,
                  unitCost,
                })
                
                modifications.push({
                  action: 'add',
                  item: {
                    description: itemDescription,
                    category: classification.targets[0] || 'Uncategorized',
                    quantity: quantity ?? undefined,
                    unit: quantity ? 'EA' : undefined,
                    unit_cost: unitCost ?? undefined,
                  },
                  reason: 'User requested to add this item',
                })
              }
            }
          }
        }
      } else if (intent === 'remove') {
        // Look for patterns like "remove X", "delete Y", "shouldn't include Z"
        const removePatterns = [
          /(?:remove|delete|exclude|shouldn't include|should not include)\s+([^,\.]+?)(?:,|\.|$)/gi,
        ]

        for (const pattern of removePatterns) {
          let match
          while ((match = pattern.exec(aiResponse)) !== null) {
            const itemDescription = match[1]?.trim()
            // Try to find matching item in current takeoff
            const matchingItem = currentTakeoffItems.find(
              (item) =>
                item.description?.toLowerCase().includes(itemDescription.toLowerCase()) ||
                itemDescription.toLowerCase().includes(item.description?.toLowerCase() || '')
            )

            if (matchingItem && matchingItem.id) {
              modifications.push({
                action: 'remove',
                itemId: matchingItem.id,
                reason: 'User requested to remove this item',
              })
            }
          }
        }
      }
    }
  }

  return {
    modifications,
    explanation: aiResponse,
    needsConfirmation: modifications.length > 0 && needsConfirmation,
  }
}

/**
 * Format modification instructions for the AI
 * This helps the AI understand what modifications are being requested
 */
export function formatModificationInstructions(
  classification: PlanChatQuestionClassification,
  currentTakeoffItems: Array<{ id?: string; name?: string; description?: string; category?: string; quantity?: number | null; unit_cost?: number | null }>
): string {
  const instructions: string[] = []

  if (classification.question_type === 'TAKEOFF_MODIFY') {
    instructions.push('\n---\nTAKEOFF MODIFICATION REQUESTED')
    
    if (classification.modification_intent === 'add') {
      instructions.push('The user wants to ADD or UPDATE items in the takeoff.')
      instructions.push('**CRITICAL: Before adding, check if the item already exists in the current takeoff.**')
      instructions.push('If an item exists but has quantity 0 or missing cost, UPDATE it instead of adding a duplicate.')
      instructions.push('For each item to add/update, provide: category, description, quantity (if available), unit, unit_cost (if known), location, page_number.')
      instructions.push('If quantity is not available, explain what measurements are needed.')
      
      // Show items that might match what user is asking about
      if (classification.targets && classification.targets.length > 0) {
        const targetLower = classification.targets[0].toLowerCase()
        const matchingItems = currentTakeoffItems.filter((item) => {
          const name = (item.name || item.description || '').toLowerCase()
          return name.includes(targetLower) || targetLower.includes(name) ||
            name.split(/\s+/).some(w => w.length > 2 && targetLower.includes(w))
        })
        
        if (matchingItems.length > 0) {
          instructions.push(`\n**EXISTING ITEMS THAT MIGHT MATCH "${classification.targets[0]}":**`)
          matchingItems.slice(0, 5).forEach((item) => {
            const parts = [`- ${item.name || item.description || 'Unnamed item'}`]
            if (item.quantity !== null && item.quantity !== undefined) parts.push(`(qty: ${item.quantity})`)
            if (item.unit_cost !== null && item.unit_cost !== undefined) parts.push(`(cost: $${item.unit_cost})`)
            if (item.id) parts.push(`[ID: ${item.id}]`)
            instructions.push(parts.join(' '))
          })
          instructions.push('**If one of these matches, use "update" action with the itemId instead of "add".**')
        }
      }
    } else if (classification.modification_intent === 'remove') {
      instructions.push('The user wants to REMOVE items from the takeoff.')
      instructions.push('Identify which items from the current takeoff should be removed.')
      instructions.push('Explain why each item should be removed.')
    } else if (classification.modification_intent === 'update') {
      instructions.push('The user wants to UPDATE items in the takeoff.')
      instructions.push('Identify which items need updates and what should change.')
    }
  } else if (classification.question_type === 'TAKEOFF_ANALYZE') {
    instructions.push('\n---\nTAKEOFF ANALYSIS REQUESTED')
    instructions.push('Analyze the current takeoff and identify:')
    instructions.push('1. Missing categories or items mentioned in the plans but not in the takeoff')
    instructions.push('2. Items missing quantity measurements')
    instructions.push('3. What measurements are needed to complete the takeoff')
    instructions.push('4. Recommendations for improving the takeoff')
  }

  if (currentTakeoffItems.length > 0) {
    instructions.push(`\nCurrent takeoff has ${currentTakeoffItems.length} items.`)
    instructions.push('Use this as reference when suggesting additions or identifying what\'s missing.')
  }

  return instructions.join('\n')
}

