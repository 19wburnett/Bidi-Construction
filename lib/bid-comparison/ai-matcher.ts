import OpenAI from 'openai'
import { callAnalysisLLM } from '@/lib/llm/providers'
import stringSimilarity from 'string-similarity'

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSION = 1536
const BATCH_SIZE = 100
const EMBEDDING_SIMILARITY_THRESHOLD = 0.75

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

export interface BidLineItem {
  id: string
  bid_id: string
  item_number: number
  description: string
  category: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
  cost_code?: string | null
}

export interface MatchedItem {
  bidId: string
  item: BidLineItem
  confidence: number
  matchType: 'exact' | 'similar' | 'grouped'
  notes?: string
}

export interface LineItemMatch {
  selectedBidItem: BidLineItem
  comparisonItems: MatchedItem[]
  normalizedWorkType?: string
  normalizedMaterials?: string[]
  quantityVariance?: number
  priceVariance?: number
}

export interface MatchingResult {
  matches: LineItemMatch[]
  unmatchedItems: {
    selectedBid: BidLineItem[]
    comparisonBids: Record<string, BidLineItem[]>
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Generate embeddings for text descriptions
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY to enable embeddings.')
  }

  const embeddings: number[][] = []
  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE)
    const response = await openaiClient.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      encoding_format: 'float',
    })

    response.data.forEach((entry) => {
      if (!entry.embedding || entry.embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error(`Embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, got ${entry.embedding?.length}`)
      }
      embeddings.push(entry.embedding)
    })
  }

  return embeddings
}

/**
 * Normalize units to standard format
 */
function normalizeUnit(unit: string | null): string {
  if (!unit) return 'ea'
  
  const normalized = unit.toLowerCase().trim()
  const unitMap: Record<string, string> = {
    'sq ft': 'sq ft',
    'sqft': 'sq ft',
    'square feet': 'sq ft',
    'sf': 'sq ft',
    'sq. ft.': 'sq ft',
    'sq.ft.': 'sq ft',
    'sq': 'sq ft',
    'lf': 'lf',
    'linear feet': 'lf',
    'linear ft': 'lf',
    'ln ft': 'lf',
    'ln. ft.': 'lf',
    'each': 'ea',
    'ea.': 'ea',
    'eaches': 'ea',
    'unit': 'ea',
    'units': 'ea',
    'cy': 'cy',
    'cubic yards': 'cy',
    'cu yd': 'cy',
    'cu. yd.': 'cy',
    'cf': 'cf',
    'cubic feet': 'cf',
    'cu ft': 'cf',
    'cu. ft.': 'cf',
  }
  
  return unitMap[normalized] || normalized
}

/**
 * Initial matching using embeddings
 */
async function matchWithEmbeddings(
  selectedItems: BidLineItem[],
  comparisonItems: Record<string, BidLineItem[]>
): Promise<Map<string, MatchedItem[]>> {
  const matches = new Map<string, MatchedItem[]>()
  
  // Generate embeddings for all items
  const allDescriptions: string[] = []
  const itemMap = new Map<number, { bidId: string; item: BidLineItem }>()
  
  let index = 0
  selectedItems.forEach(item => {
    allDescriptions.push(item.description)
    itemMap.set(index, { bidId: 'selected', item })
    index++
  })
  
  Object.entries(comparisonItems).forEach(([bidId, items]) => {
    items.forEach(item => {
      allDescriptions.push(item.description)
      itemMap.set(index, { bidId, item })
      index++
    })
  })
  
  const embeddings = await generateEmbeddings(allDescriptions)
  
  // Find matches for each selected item
  selectedItems.forEach((selectedItem, selectedIndex) => {
    const selectedEmbedding = embeddings[selectedIndex]
    const itemMatches: MatchedItem[] = []
    
    let comparisonIndex = selectedItems.length
    Object.entries(comparisonItems).forEach(([bidId, items]) => {
      items.forEach(comparisonItem => {
        const comparisonEmbedding = embeddings[comparisonIndex]
        const similarity = cosineSimilarity(selectedEmbedding, comparisonEmbedding)
        
        if (similarity >= EMBEDDING_SIMILARITY_THRESHOLD) {
          const matchType = similarity >= 0.9 ? 'exact' : 'similar'
          itemMatches.push({
            bidId,
            item: comparisonItem,
            confidence: Math.round(similarity * 100),
            matchType,
          })
        }
        
        comparisonIndex++
      })
    })
    
    if (itemMatches.length > 0) {
      matches.set(selectedItem.id, itemMatches)
    }
  })
  
  return matches
}

/**
 * Use LLM to match and normalize complex cases
 */
async function matchWithLLM(
  selectedItem: BidLineItem,
  unmatchedComparisonItems: BidLineItem[],
  bidId: string
): Promise<MatchedItem | null> {
  const systemPrompt = `You are an expert construction bid analyst. Your task is to determine if two line items from different bids represent the same work, even if they're described differently.

Analyze the following two line items and determine:
1. Do they represent the same work? (yes/no)
2. If yes, what is the normalized work type? (e.g., "Install electrical outlets")
3. What materials are involved? (extract material types)
4. What is the confidence level? (0-100)
5. Are quantities comparable? (normalize units if needed)
6. Any notes about the match?

Return your analysis as JSON with this structure:
{
  "isMatch": boolean,
  "confidence": number (0-100),
  "matchType": "exact" | "similar" | "grouped",
  "normalizedWorkType": string,
  "normalizedMaterials": string[],
  "quantityVariance": number (percentage difference),
  "priceVariance": number (percentage difference),
  "notes": string
}`

  const userPrompt = `Selected Bid Item:
- Description: ${selectedItem.description}
- Category: ${selectedItem.category}
- Quantity: ${selectedItem.quantity || 'N/A'} ${selectedItem.unit || ''}
- Unit Price: $${selectedItem.unit_price || 'N/A'}
- Amount: $${selectedItem.amount}
${selectedItem.notes ? `- Notes: ${selectedItem.notes}` : ''}

Comparison Bid Item (Bid ID: ${bidId}):
- Description: ${unmatchedComparisonItems.map(item => item.description).join(' OR ')}
- Category: ${unmatchedComparisonItems[0]?.category || 'N/A'}
- Quantity: ${unmatchedComparisonItems.map(item => `${item.quantity || 'N/A'} ${item.unit || ''}`).join(' OR ')}
- Unit Price: ${unmatchedComparisonItems.map(item => `$${item.unit_price || 'N/A'}`).join(' OR ')}
- Amount: ${unmatchedComparisonItems.map(item => `$${item.amount}`).join(' OR ')}

Analyze if these represent the same work.`

  try {
    const response = await callAnalysisLLM(
      {
        systemPrompt,
        userPrompt,
        images: []
      },
      {
        temperature: 0.2,
        maxTokens: 1000
      }
    )

    const content = response.content.trim()
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return null
    }

    const analysis = JSON.parse(jsonMatch[0])
    
    if (!analysis.isMatch || analysis.confidence < 60) {
      return null
    }

    // If multiple items were provided, combine them
    const combinedItem: BidLineItem = unmatchedComparisonItems.length === 1
      ? unmatchedComparisonItems[0]
      : {
          id: unmatchedComparisonItems.map(i => i.id).join('-'),
          bid_id: bidId,
          item_number: unmatchedComparisonItems[0].item_number,
          description: unmatchedComparisonItems.map(i => i.description).join(' + '),
          category: unmatchedComparisonItems[0].category,
          quantity: unmatchedComparisonItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
          unit: unmatchedComparisonItems[0].unit,
          unit_price: unmatchedComparisonItems.reduce((sum, i) => sum + i.amount, 0) / (unmatchedComparisonItems.reduce((sum, i) => sum + (i.quantity || 1), 0) || 1),
          amount: unmatchedComparisonItems.reduce((sum, i) => sum + i.amount, 0),
          notes: unmatchedComparisonItems.map(i => i.notes).filter(Boolean).join('; ') || null,
        }

    return {
      bidId,
      item: combinedItem,
      confidence: analysis.confidence,
      matchType: analysis.matchType || 'similar',
      notes: analysis.notes,
    }
  } catch (error) {
    console.error('Error in LLM matching:', error)
    return null
  }
}

/**
 * Main matching function - hybrid approach
 */
export async function matchBidLineItems(
  selectedBidItems: BidLineItem[],
  comparisonBidItems: Record<string, BidLineItem[]>
): Promise<MatchingResult> {
  const matches: LineItemMatch[] = []
  const matchedComparisonItemIds = new Set<string>()
  const matchedSelectedItemIds = new Set<string>()

  // Step 1: Initial matching with embeddings
  const embeddingMatches = await matchWithEmbeddings(selectedBidItems, comparisonBidItems)

  // Process embedding matches
  selectedBidItems.forEach(selectedItem => {
    const embeddingMatch = embeddingMatches.get(selectedItem.id)
    if (embeddingMatch && embeddingMatch.length > 0) {
      matchedSelectedItemIds.add(selectedItem.id)
      embeddingMatch.forEach(match => {
        matchedComparisonItemIds.add(match.item.id)
      })
      
      matches.push({
        selectedBidItem: selectedItem,
        comparisonItems: embeddingMatch,
      })
    }
  })

  // Step 2: Try LLM matching for unmatched items
  let unmatchedSelected = selectedBidItems.filter(item => !matchedSelectedItemIds.has(item.id))
  
  for (const selectedItem of unmatchedSelected) {
    const comparisonMatches: MatchedItem[] = []
    
    for (const [bidId, items] of Object.entries(comparisonBidItems)) {
      const unmatchedInBid = items.filter(item => !matchedComparisonItemIds.has(item.id))
      if (unmatchedInBid.length === 0) continue

      // Try matching with single items first
      for (const item of unmatchedInBid) {
        const llmMatch = await matchWithLLM(selectedItem, [item], bidId)
        if (llmMatch) {
          comparisonMatches.push(llmMatch)
          matchedComparisonItemIds.add(item.id)
          break
        }
      }

      // If no single match, try grouping multiple items
      if (comparisonMatches.length === 0 && unmatchedInBid.length > 1) {
        const llmMatch = await matchWithLLM(selectedItem, unmatchedInBid.slice(0, 3), bidId)
        if (llmMatch) {
          comparisonMatches.push(llmMatch)
          unmatchedInBid.slice(0, 3).forEach(item => matchedComparisonItemIds.add(item.id))
        }
      }
    }

    if (comparisonMatches.length > 0) {
      matchedSelectedItemIds.add(selectedItem.id)
      matches.push({
        selectedBidItem: selectedItem,
        comparisonItems: comparisonMatches,
      })
    }
  }

  // Step 3: Collect unmatched items (recalculate after LLM matching)
  const finalUnmatchedSelected = selectedBidItems.filter(item => !matchedSelectedItemIds.has(item.id))
  const unmatchedComparison: Record<string, BidLineItem[]> = {}
  
  Object.entries(comparisonBidItems).forEach(([bidId, items]) => {
    const unmatched = items.filter(item => !matchedComparisonItemIds.has(item.id))
    if (unmatched.length > 0) {
      unmatchedComparison[bidId] = unmatched
    }
  })

  return {
    matches,
    unmatchedItems: {
      selectedBid: finalUnmatchedSelected,
      comparisonBids: unmatchedComparison,
    },
  }
}

