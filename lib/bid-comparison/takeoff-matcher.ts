import OpenAI from 'openai'
import { callAnalysisLLM } from '@/lib/llm/providers'

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSION = 1536
const BATCH_SIZE = 100
const EMBEDDING_SIMILARITY_THRESHOLD = 0.75

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

export interface TakeoffItem {
  id: string
  category: string
  description: string
  quantity: number
  unit: string
  unit_cost?: number | null
}

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

export interface MatchedTakeoffItem {
  takeoffItem: TakeoffItem
  bidItem: BidLineItem | null
  confidence: number
  matchType: 'exact' | 'similar' | 'grouped' | 'none'
  notes?: string
  quantityVariance?: number
  priceVariance?: number
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
 * Initial matching using embeddings
 */
async function matchWithEmbeddings(
  takeoffItems: TakeoffItem[],
  bidLineItems: BidLineItem[]
): Promise<Map<string, BidLineItem>> {
  const matches = new Map<string, BidLineItem>()
  
  // Generate embeddings for all items
  const allDescriptions: string[] = []
  const takeoffMap = new Map<number, TakeoffItem>()
  const bidMap = new Map<number, BidLineItem>()
  
  let index = 0
  takeoffItems.forEach(item => {
    allDescriptions.push(item.description)
    takeoffMap.set(index, item)
    index++
  })
  
  bidLineItems.forEach(item => {
    allDescriptions.push(item.description)
    bidMap.set(index, item)
    index++
  })
  
  const embeddings = await generateEmbeddings(allDescriptions)
  
  // Find matches for each takeoff item
  takeoffItems.forEach((takeoffItem, takeoffIndex) => {
    const takeoffEmbedding = embeddings[takeoffIndex]
    let bestMatch: { item: BidLineItem; similarity: number } | null = null
    
    let bidIndex = takeoffItems.length
    bidLineItems.forEach(bidItem => {
      const bidEmbedding = embeddings[bidIndex]
      const similarity = cosineSimilarity(takeoffEmbedding, bidEmbedding)
      
      if (similarity >= EMBEDDING_SIMILARITY_THRESHOLD) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { item: bidItem, similarity }
        }
      }
      
      bidIndex++
    })
    
    if (bestMatch) {
      matches.set(takeoffItem.id, (bestMatch as { item: BidLineItem; similarity: number }).item)
    }
  })
  
  return matches
}

/**
 * Use LLM to match and normalize complex cases
 */
async function matchWithLLM(
  takeoffItem: TakeoffItem,
  unmatchedBidItems: BidLineItem[]
): Promise<{ item: BidLineItem; confidence: number; matchType: string; notes?: string } | null> {
  const systemPrompt = `You are an expert construction bid analyst. Your task is to determine if a takeoff item matches a bid line item, even if they're described differently.

Analyze the following items and determine:
1. Do they represent the same work? (yes/no)
2. If yes, which bid item number matches? (return the index: 1, 2, 3, etc. from the list provided)
3. What is the confidence level? (0-100)
4. What is the match type? ("exact", "similar", or "grouped")
5. Are quantities comparable? (calculate percentage difference)
6. Are prices comparable? (calculate percentage difference)
7. Any notes about the match?

Return your analysis as JSON with this structure:
{
  "isMatch": boolean,
  "matchedItemIndex": number (1-based index from the candidate list, or 1 if single item),
  "confidence": number (0-100),
  "matchType": "exact" | "similar" | "grouped",
  "quantityVariance": number (percentage difference),
  "priceVariance": number (percentage difference),
  "notes": string
}`

  const userPrompt = `Takeoff Item:
- Description: ${takeoffItem.description}
- Category: ${takeoffItem.category}
- Quantity: ${takeoffItem.quantity} ${takeoffItem.unit}
- Unit Cost: $${takeoffItem.unit_cost || 'N/A'}

Bid Line Items (candidates):
${unmatchedBidItems.slice(0, 5).map((item, idx) => `
${idx + 1}. ${item.description}
   - Category: ${item.category}
   - Quantity: ${item.quantity || 'N/A'} ${item.unit || ''}
   - Unit Price: $${item.unit_price || 'N/A'}
   - Amount: $${item.amount}
`).join('\n')}

Find the best match for the takeoff item from the bid line items. If multiple bid items together represent the takeoff item, indicate that.`

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

    // Find the matched bid item using the index from LLM (1-based)
    const matchedIndex = (analysis.matchedItemIndex || 1) - 1 // Convert to 0-based
    const bestBidItem = unmatchedBidItems[matchedIndex] || unmatchedBidItems[0]
    
    if (!bestBidItem) {
      return null
    }
    
    return {
      item: bestBidItem,
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
 * Main matching function - hybrid approach for takeoff to bid matching
 */
export async function matchTakeoffToBid(
  takeoffItems: TakeoffItem[],
  bidLineItems: BidLineItem[]
): Promise<MatchedTakeoffItem[]> {
  const matches: MatchedTakeoffItem[] = []
  const matchedBidItemIds = new Set<string>()

  // Step 1: Initial matching with embeddings
  const embeddingMatches = await matchWithEmbeddings(takeoffItems, bidLineItems)

  // Process embedding matches
  takeoffItems.forEach(takeoffItem => {
    const embeddingMatch = embeddingMatches.get(takeoffItem.id)
    if (embeddingMatch) {
      matchedBidItemIds.add(embeddingMatch.id)
      
      const similarity = 0.85 // Approximate from embedding threshold
      const quantityVariance = takeoffItem.quantity && embeddingMatch.quantity
        ? Math.abs((takeoffItem.quantity - embeddingMatch.quantity) / takeoffItem.quantity * 100)
        : undefined
      const priceVariance = takeoffItem.unit_cost && embeddingMatch.unit_price
        ? Math.abs((takeoffItem.unit_cost - embeddingMatch.unit_price) / takeoffItem.unit_cost * 100)
        : undefined

      matches.push({
        takeoffItem,
        bidItem: embeddingMatch,
        confidence: Math.round(similarity * 100),
        matchType: similarity >= 0.9 ? 'exact' : 'similar',
        quantityVariance,
        priceVariance,
      })
    }
  })

  // Step 2: Try LLM matching for unmatched items
  const unmatchedTakeoff = takeoffItems.filter(item => !matches.some(m => m.takeoffItem.id === item.id))
  
  for (const takeoffItem of unmatchedTakeoff) {
    const unmatchedBidItems = bidLineItems.filter(item => !matchedBidItemIds.has(item.id))
    if (unmatchedBidItems.length === 0) continue

    const llmMatch = await matchWithLLM(takeoffItem, unmatchedBidItems)
    if (llmMatch) {
      matchedBidItemIds.add(llmMatch.item.id)
      matches.push({
        takeoffItem,
        bidItem: llmMatch.item,
        confidence: llmMatch.confidence,
        matchType: llmMatch.matchType as 'exact' | 'similar' | 'grouped',
        notes: llmMatch.notes,
        quantityVariance: takeoffItem.quantity && llmMatch.item.quantity
          ? Math.abs((takeoffItem.quantity - llmMatch.item.quantity) / takeoffItem.quantity * 100)
          : undefined,
        priceVariance: takeoffItem.unit_cost && llmMatch.item.unit_price
          ? Math.abs((takeoffItem.unit_cost - llmMatch.item.unit_price) / takeoffItem.unit_cost * 100)
          : undefined,
      })
    } else {
      // No match found
      matches.push({
        takeoffItem,
        bidItem: null,
        confidence: 0,
        matchType: 'none',
      })
    }
  }

  return matches
}

