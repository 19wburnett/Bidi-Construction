/**
 * Takeoff Item Embeddings
 * 
 * Provides vector embeddings for takeoff items to enable semantic search.
 * Uses hybrid approach: vector search for semantic queries, keyword matching for exact matches.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { aiGateway } from '@/lib/ai-gateway-provider'

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSION = 1536
const BATCH_SIZE = 50 // Larger batch size since takeoff items are shorter
const MIN_SIMILARITY_THRESHOLD = 0.7 // Minimum similarity for vector search results

const hasAIGatewayKey = !!process.env.AI_GATEWAY_API_KEY

type GenericSupabase = SupabaseClient<any, any, any>

export interface NormalizedTakeoffItem {
  id?: string
  category?: string | null
  subcategory?: string | null
  name?: string | null
  description?: string | null
  quantity?: number | null
  unit?: string | null
  unit_cost?: number | null
  total_cost?: number | null
  cost_type?: 'labor' | 'materials' | 'allowance' | 'other' | null
  location?: string | null
  page_number?: number | null
}

export interface TakeoffItemEmbedding {
  takeoff_item_id: string
  item_text: string
  category: string | null
  subcategory: string | null
  similarity: number
}

/**
 * Builds a text representation of a takeoff item for embedding
 */
function buildItemText(item: NormalizedTakeoffItem): string {
  const parts: string[] = []
  
  if (item.category) parts.push(item.category)
  if (item.subcategory) parts.push(item.subcategory)
  if (item.name) parts.push(item.name)
  if (item.description) parts.push(item.description)
  if (item.location) parts.push(`location: ${item.location}`)
  
  return parts.join(' ').trim()
}

/**
 * Generates embeddings for takeoff items
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key not configured. Set AI_GATEWAY_API_KEY to enable embeddings.')
  }

  const embeddings: number[][] = []
  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE)
    const response = await aiGateway.embeddings(EMBEDDING_MODEL, batch)

    response.forEach((entry) => {
      if (!entry.embedding || entry.embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error(`Embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, got ${entry.embedding?.length}`)
      }
      embeddings.push(entry.embedding)
    })
  }

  return embeddings
}

/**
 * Ingests takeoff items and creates embeddings
 * Clears existing embeddings for the plan to keep results idempotent
 */
export async function ingestTakeoffItemEmbeddings(
  supabase: GenericSupabase,
  planId: string,
  items: NormalizedTakeoffItem[]
): Promise<{ success: boolean; count: number; errors?: string[] }> {
  if (!hasAIGatewayKey) {
    return {
      success: false,
      count: 0,
      errors: ['AI Gateway API key not configured'],
    }
  }

  if (!items || items.length === 0) {
    // Clear existing embeddings if no items
    await supabase
      .from('takeoff_item_embeddings')
      .delete()
      .eq('plan_id', planId)
    
    return { success: true, count: 0 }
  }

  try {
    // Delete existing embeddings for this plan
    await supabase
      .from('takeoff_item_embeddings')
      .delete()
      .eq('plan_id', planId)

    // Build text representations
    const itemTexts = items.map((item) => ({
      id: item.id || `item-${Math.random()}`,
      text: buildItemText(item),
      category: item.category || null,
      subcategory: item.subcategory || null,
    }))

    // Filter out items with no meaningful text
    const validItems = itemTexts.filter((item) => item.text.trim().length > 0)

    if (validItems.length === 0) {
      return { success: true, count: 0 }
    }

    // Generate embeddings
    const texts = validItems.map((item) => item.text)
    const embeddings = await generateEmbeddings(texts)

    // Insert embeddings into database
    const embeddingRecords = validItems.map((item, index) => ({
      plan_id: planId,
      takeoff_item_id: item.id,
      item_text: item.text,
      category: item.category,
      subcategory: item.subcategory,
      embedding: embeddings[index],
    }))

    const { error } = await supabase
      .from('takeoff_item_embeddings')
      .insert(embeddingRecords)

    if (error) {
      throw error
    }

    return {
      success: true,
      count: embeddingRecords.length,
    }
  } catch (error) {
    console.error('[TakeoffEmbeddings] Failed to ingest embeddings:', error)
    return {
      success: false,
      count: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

/**
 * Retrieves takeoff items using vector similarity search
 */
export async function retrieveTakeoffItemsByVector(
  supabase: GenericSupabase,
  planId: string,
  query: string,
  limit = 20,
  minSimilarity = MIN_SIMILARITY_THRESHOLD
): Promise<TakeoffItemEmbedding[]> {
  if (!hasAIGatewayKey) {
    return []
  }

  const sanitizedQuery = query.trim()
  if (!sanitizedQuery) {
    return []
  }

  // Check if plan has any embeddings
  const { count } = await supabase
    .from('takeoff_item_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .not('embedding', 'is', null)

  if (count === 0 || count === null) {
    return []
  }

  try {
    // Generate query embedding
    const queryEmbeddings = await generateEmbeddings([sanitizedQuery])
    const queryEmbedding = queryEmbeddings[0]

    // Perform vector search
    const { data, error } = await supabase.rpc('match_takeoff_items', {
      p_plan_id: planId,
      p_query_embedding: queryEmbedding,
      p_match_limit: limit,
      p_min_similarity: minSimilarity,
    })

    if (error) {
      console.error('[TakeoffEmbeddings] Vector search error:', error)
      return []
    }

    return (data || []).map((row: any) => ({
      takeoff_item_id: row.takeoff_item_id,
      item_text: row.item_text,
      category: row.category,
      subcategory: row.subcategory,
      similarity: typeof row.similarity === 'number' ? row.similarity : 0,
    }))
  } catch (error) {
    console.error('[TakeoffEmbeddings] Failed to retrieve items:', error)
    return []
  }
}

/**
 * Checks if a plan has takeoff item embeddings
 */
export async function hasTakeoffItemEmbeddings(
  supabase: GenericSupabase,
  planId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('takeoff_item_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .not('embedding', 'is', null)

  return (count || 0) > 0
}






