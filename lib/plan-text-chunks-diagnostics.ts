/**
 * Diagnostics tool for inspecting plan_text_chunks records
 * Helps identify issues with chunk quality and structure
 */

import type { SupabaseClient } from '@supabase/supabase-js'

type GenericSupabase = SupabaseClient<any, any, any>

export interface ChunkDiagnostic {
  planId: string
  totalChunks: number
  chunksWithEmbeddings: number
  chunksWithoutEmbeddings: number
  averageChunkLength: number
  chunksByPage: Record<number, number>
  sampleChunks: Array<{
    id: string
    page_number: number | null
    snippet_text_preview: string
    snippet_length: number
    has_metadata: boolean
    metadata_keys: string[]
    has_embedding: boolean
    metadata: any
  }>
  issues: string[]
}

/**
 * Analyze chunks for a plan and identify potential issues
 */
export async function diagnosePlanChunks(
  supabase: GenericSupabase,
  planId: string
): Promise<ChunkDiagnostic> {
  const { data: chunks, error } = await supabase
    .from('plan_text_chunks')
    .select('id, page_number, snippet_text, metadata, embedding')
    .eq('plan_id', planId)

  if (error) {
    throw new Error(`Failed to load chunks: ${error.message}`)
  }

  if (!chunks || chunks.length === 0) {
    return {
      planId,
      totalChunks: 0,
      chunksWithEmbeddings: 0,
      chunksWithoutEmbeddings: 0,
      averageChunkLength: 0,
      chunksByPage: {},
      sampleChunks: [],
      issues: ['No chunks found for this plan. Run ingestion first.'],
    }
  }

  const issues: string[] = []
  const chunksByPage: Record<number, number> = {}
  let totalLength = 0
  let chunksWithEmbeddings = 0
  let chunksWithoutEmbeddings = 0

  const sampleChunks = chunks.slice(0, 10).map((chunk: any) => {
    const textLength = chunk.snippet_text?.length || 0
    totalLength += textLength

    // Count by page
    const page = chunk.page_number || 0
    chunksByPage[page] = (chunksByPage[page] || 0) + 1

    // Check embedding
    const hasEmbedding = chunk.embedding !== null && chunk.embedding !== undefined
    if (hasEmbedding) {
      chunksWithEmbeddings++
    } else {
      chunksWithoutEmbeddings++
    }

    // Check metadata
    const metadata = chunk.metadata || {}
    const metadataKeys = Object.keys(metadata)
    const hasMetadata = metadataKeys.length > 0

    // Identify issues
    if (textLength < 50) {
      issues.push(`Chunk ${chunk.id} is very short (${textLength} chars) - may not be useful`)
    }
    if (textLength > 1000) {
      issues.push(`Chunk ${chunk.id} is very long (${textLength} chars) - may exceed embedding limits`)
    }
    if (!hasEmbedding) {
      issues.push(`Chunk ${chunk.id} has no embedding - will not be searchable`)
    }
    if (!hasMetadata) {
      issues.push(`Chunk ${chunk.id} has no metadata - missing context information`)
    }
    if (!chunk.page_number) {
      issues.push(`Chunk ${chunk.id} has no page_number - cannot reference location`)
    }

    return {
      id: chunk.id,
      page_number: chunk.page_number,
      snippet_text_preview: chunk.snippet_text?.substring(0, 100) || '',
      snippet_length: textLength,
      has_metadata: hasMetadata,
      metadata_keys: metadataKeys,
      has_embedding: hasEmbedding,
      metadata: metadata,
    }
  })

  const averageChunkLength = chunks.length > 0 ? totalLength / chunks.length : 0

  // Overall issues
  if (chunksWithoutEmbeddings > 0) {
    issues.push(
      `⚠️ ${chunksWithoutEmbeddings} chunks (${Math.round((chunksWithoutEmbeddings / chunks.length) * 100)}%) have no embeddings - these won't be searchable`
    )
  }

  if (averageChunkLength < 100) {
    issues.push(
      `⚠️ Average chunk length is very short (${Math.round(averageChunkLength)} chars) - chunks may not have enough context`
    )
  }

  if (averageChunkLength > 800) {
    issues.push(
      `⚠️ Average chunk length is very long (${Math.round(averageChunkLength)} chars) - may lose semantic meaning`
    )
  }

  const pagesWithChunks = Object.keys(chunksByPage).length
  if (pagesWithChunks === 0) {
    issues.push('⚠️ No page numbers found in chunks - cannot reference specific pages')
  }

  return {
    planId,
    totalChunks: chunks.length,
    chunksWithEmbeddings,
    chunksWithoutEmbeddings,
    averageChunkLength: Math.round(averageChunkLength),
    chunksByPage,
    sampleChunks,
    issues: [...new Set(issues)], // Remove duplicates
  }
}

/**
 * What a GOOD chunk record should look like:
 */
export const GOOD_CHUNK_EXAMPLE = {
  id: 'uuid-here',
  plan_id: 'plan-uuid',
  page_number: 3,
  snippet_text: `SHEET A-3.1 FLOOR PLAN LEVEL 1
Scale: 1/8" = 1'-0"
North arrow indicates orientation. All dimensions are to face of stud unless noted otherwise.
Wall types: Type A (exterior), Type B (interior bearing), Type C (interior non-bearing).
Room labels: BED-1 (Bedroom 1), BATH-1 (Bathroom 1), KIT (Kitchen).
Doors: 3068 (3'-0" x 6'-8"), 2868 (2'-8" x 6'-8").
Windows: W-1 (3'-0" x 4'-0"), W-2 (2'-0" x 4'-0").
Electrical: Outlets per room per code. Switch locations as shown.
Plumbing: Fixture locations per plan. Water lines 3/4" supply, 1/2" branch.`,
  metadata: {
    chunk_page_index: 2,
    total_pages: 25,
    sheet_id: 'A-3.1',
    sheet_title: 'FLOOR PLAN LEVEL 1',
    sheet_discipline: 'Architectural',
    sheet_type: 'Floor Plan',
    chunk_index: 0,
    character_count: 487,
  },
  embedding: [0.123, -0.456, ...], // 1536 numbers
  created_at: '2024-01-15T10:30:00Z',
}

/**
 * What a BAD chunk record might look like:
 */
export const BAD_CHUNK_EXAMPLES = {
  tooShort: {
    snippet_text: 'A-1', // Only 3 characters - not enough context
    metadata: {},
  },
  noMetadata: {
    snippet_text: 'Some text here',
    metadata: null, // Missing sheet info, page context
  },
  noEmbedding: {
    snippet_text: 'Good text content',
    embedding: null, // Won't be searchable
  },
  noPageNumber: {
    snippet_text: 'Good text content',
    page_number: null, // Can't reference location
  },
  tooLong: {
    snippet_text: '...', // > 1000 chars - may lose semantic meaning
  },
}


