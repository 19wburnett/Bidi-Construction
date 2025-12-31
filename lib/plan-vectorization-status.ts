/**
 * Plan Vectorization Status Checker
 * 
 * Checks if a plan has been vectorized (has plan_text_chunks with embeddings)
 * which is required for plan chat to work properly.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

type GenericSupabase = SupabaseClient<any, any, any>

export interface PlanVectorizationStatus {
  isVectorized: boolean
  hasChunks: boolean
  hasEmbeddings: boolean
  chunkCount: number
  embeddingCount: number
  message?: string
}

/**
 * Checks if a plan is vectorized and ready for chat
 */
export async function checkPlanVectorizationStatus(
  supabase: GenericSupabase,
  planId: string
): Promise<PlanVectorizationStatus> {
  // Check total chunks
  const { count: totalChunks, error: chunksError } = await supabase
    .from('plan_text_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)

  if (chunksError) {
    console.error('[VectorizationStatus] Error checking chunks:', chunksError)
    return {
      isVectorized: false,
      hasChunks: false,
      hasEmbeddings: false,
      chunkCount: 0,
      embeddingCount: 0,
      message: 'Error checking vectorization status',
    }
  }

  const hasChunks = (totalChunks ?? 0) > 0

  // Check chunks with embeddings
  const { count: embeddingCount, error: embeddingError } = await supabase
    .from('plan_text_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .not('embedding', 'is', null)

  if (embeddingError) {
    console.error('[VectorizationStatus] Error checking embeddings:', embeddingError)
    return {
      isVectorized: false,
      hasChunks,
      hasEmbeddings: false,
      chunkCount: totalChunks ?? 0,
      embeddingCount: 0,
      message: 'Error checking embeddings',
    }
  }

  const hasEmbeddings = (embeddingCount ?? 0) > 0
  const isVectorized = hasChunks && hasEmbeddings

  let message: string | undefined
  if (!isVectorized) {
    if (!hasChunks) {
      message = 'This plan has not been vectorized yet. Please run the vectorization process first.'
    } else if (!hasEmbeddings) {
      message = `This plan has ${totalChunks} chunks but none have embeddings. Please re-run vectorization.`
    }
  }

  return {
    isVectorized,
    hasChunks,
    hasEmbeddings,
    chunkCount: totalChunks ?? 0,
    embeddingCount: embeddingCount ?? 0,
    message,
  }
}

/**
 * Quick check - returns true if plan is vectorized, false otherwise
 */
export async function isPlanVectorized(
  supabase: GenericSupabase,
  planId: string
): Promise<boolean> {
  const status = await checkPlanVectorizationStatus(supabase, planId)
  return status.isVectorized
}
