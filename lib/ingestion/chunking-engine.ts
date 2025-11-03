/**
 * Chunking Engine
 * Generates quality-preserving chunks from page texts with overlap and safeguards
 */

import type { Chunk, SheetIndex, ProjectMeta, PageText } from '@/types/ingestion'
import { SheetDiscipline, SheetType } from '@/types/ingestion'

export interface ChunkingOptions {
  targetChunkSizeTokens?: number
  overlapPercentage?: number
  maxChunkSizeTokens?: number
  minChunkSizeTokens?: number
}

const TOKENS_PER_CHAR = 0.25 // Approximate: 4 chars per token
const DEFAULT_TARGET_TOKENS = 3000
const DEFAULT_OVERLAP_PERCENT = 17.5

/**
 * Generate chunks from page texts with smart boundaries and overlap
 */
export async function generateChunks(
  pageTexts: PageText[],
  sheetIndex: SheetIndex[],
  projectMeta: ProjectMeta,
  pageImages: Map<number, string>, // Map page number to Supabase Storage URL
  options: ChunkingOptions = {}
): Promise<Chunk[]> {
  const {
    targetChunkSizeTokens = DEFAULT_TARGET_TOKENS,
    overlapPercentage = DEFAULT_OVERLAP_PERCENT,
    maxChunkSizeTokens = 4000,
    minChunkSizeTokens = 2000
  } = options

  const chunks: Chunk[] = []
  const overlapTokens = Math.floor(targetChunkSizeTokens * (overlapPercentage / 100))

  let currentChunk: {
    text: string
    pages: number[]
    sheetIndices: SheetIndex[]
    tokenCount: number
  } = {
    text: '',
    pages: [],
    sheetIndices: [],
    tokenCount: 0
  }

  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i]
    const sheet = sheetIndex.find(s => s.page_no === pageText.pageNumber)
    if (!sheet) continue

    const pageTokenCount = Math.floor(pageText.text.length * TOKENS_PER_CHAR)

    // If adding this page would exceed max, finalize current chunk
    if (currentChunk.tokenCount > 0 && 
        currentChunk.tokenCount + pageTokenCount > maxChunkSizeTokens) {
      chunks.push(createChunk(
        chunks.length,
        currentChunk,
        projectMeta,
        pageImages,
        overlapTokens
      ))

      // Start new chunk with overlap
      const overlapText = extractOverlapText(
        currentChunk.text,
        overlapTokens
      )
      currentChunk = {
        text: overlapText,
        pages: currentChunk.pages.slice(-Math.ceil(overlapTokens / 1000)), // Approximate pages
        sheetIndices: currentChunk.sheetIndices.slice(-1),
        tokenCount: Math.floor(overlapText.length * TOKENS_PER_CHAR)
      }
    }

    // Add page to current chunk
    const sheetHeader = `\n\n=== PAGE ${pageText.pageNumber} (${sheet.sheet_id}: ${sheet.title}) ===\n\n`
    currentChunk.text += sheetHeader + pageText.text
    currentChunk.pages.push(pageText.pageNumber)
    currentChunk.sheetIndices.push(sheet)
    currentChunk.tokenCount += pageTokenCount + Math.floor(sheetHeader.length * TOKENS_PER_CHAR)

    // If we've reached target size, finalize chunk
    if (currentChunk.tokenCount >= targetChunkSizeTokens) {
      chunks.push(createChunk(
        chunks.length,
        currentChunk,
        projectMeta,
        pageImages,
        overlapTokens
      ))

      // Start new chunk with overlap
      const overlapText = extractOverlapText(
        currentChunk.text,
        overlapTokens
      )
      currentChunk = {
        text: overlapText,
        pages: [pageText.pageNumber], // Keep at least current page
        sheetIndices: [sheet],
        tokenCount: Math.floor(overlapText.length * TOKENS_PER_CHAR)
      }
    }
  }

  // Finalize last chunk if it has content
  if (currentChunk.tokenCount > 0 && currentChunk.pages.length > 0) {
    chunks.push(createChunk(
      chunks.length,
      currentChunk,
      projectMeta,
      pageImages,
      overlapTokens
    ))
  }

  // Link chunks (prev/next)
  chunks.forEach((chunk, idx) => {
    if (idx > 0) {
      chunk.metadata.overlap_info.prev_chunk_id = chunks[idx - 1].chunk_id
    }
    if (idx < chunks.length - 1) {
      chunk.metadata.overlap_info.next_chunk_id = chunks[idx + 1].chunk_id
    }
  })

  return chunks
}

/**
 * Create a chunk from chunk data
 */
function createChunk(
  chunkIndex: number,
  chunkData: {
    text: string
    pages: number[]
    sheetIndices: SheetIndex[]
    tokenCount: number
  },
  projectMeta: ProjectMeta,
  pageImages: Map<number, string>,
  overlapTokens: number
): Chunk {
  const chunkId = `chunk_${Date.now()}_${chunkIndex}_${Math.random().toString(36).substring(7)}`
  
  // Build image URLs
  const imageUrls = chunkData.pages
    .map(pageNum => pageImages.get(pageNum))
    .filter((url): url is string => url !== undefined)

  // Generate dedupe hash
  const dedupeHash = generateDedupeHash(chunkData.text, chunkData.pages)

  // Generate location keys
  const locationKeys = chunkData.sheetIndices.map(s => s.sheet_id)

  // Generate quantity signatures (simplified)
  const quantitySignatures = extractQuantitySignatures(chunkData.text)

  // Generate "no multiply" hints
  const noMultiplyHints = generateNoMultiplyHints(chunkData.sheetIndices)

  return {
    chunk_id: chunkId,
    plan_id: projectMeta.plan_id || '',
    chunk_index: chunkIndex,
    page_range: {
      start: Math.min(...chunkData.pages),
      end: Math.max(...chunkData.pages),
      pages: chunkData.pages
    },
    sheet_index_subset: chunkData.sheetIndices,
    content: {
      text: chunkData.text,
      text_token_count: chunkData.tokenCount,
      image_urls: imageUrls,
      image_count: imageUrls.length
    },
    metadata: {
      project_meta: projectMeta,
      sheet_scale_units: summarizeScales(chunkData.sheetIndices),
      discipline: chunkData.sheetIndices[0]?.discipline || SheetDiscipline.UNKNOWN,
      anchors: generateAnchors(chunkData.pages, chunkData.sheetIndices),
      overlap_info: {
        prev_chunk_id: null,
        next_chunk_id: null,
        overlap_tokens: overlapTokens
      }
    },
    safeguards: {
      dedupe_hash: dedupeHash,
      location_keys: locationKeys,
      no_multiply_hints: noMultiplyHints,
      quantity_signatures: quantitySignatures
    },
    created_at: new Date().toISOString()
  }
}

/**
 * Extract overlap text from end of previous chunk
 */
function extractOverlapText(text: string, targetTokens: number): string {
  const targetChars = Math.floor(targetTokens / TOKENS_PER_CHAR)
  // Extract last N characters, but try to end at sentence boundary
  const endSlice = text.slice(-targetChars)
  const lastPeriod = endSlice.lastIndexOf('.')
  const lastNewline = endSlice.lastIndexOf('\n')
  const cutoff = Math.max(lastPeriod, lastNewline)
  
  return cutoff > 0 ? text.slice(-targetChars + cutoff) : text.slice(-targetChars)
}

/**
 * Generate deduplication hash
 */
function generateDedupeHash(text: string, pages: number[]): string {
  const crypto = require('crypto')
  const signature = `${pages.join(',')}:${text.slice(0, 500)}`
  return crypto.createHash('sha256').update(signature).digest('hex').slice(0, 16)
}

/**
 * Extract quantity signatures from text
 */
function extractQuantitySignatures(text: string): string[] {
  const signatures: string[] = []
  const regex = /(?:QTY|QUANTITY|COUNT)[\s:]+(\d+)/gi
  let match
  while ((match = regex.exec(text)) !== null) {
    signatures.push(`qty_${match[1]}`)
  }
  return signatures
}

/**
 * Generate "no multiply" hints based on sheet types
 */
function generateNoMultiplyHints(sheets: SheetIndex[]): string[] {
  const hints: string[] = []
  
  // Check for schedules (often contain summary quantities)
  if (sheets.some(s => s.sheet_type === SheetType.SCHEDULE)) {
    hints.push('SCHEDULE_SHEET: Quantities here may be summaries - verify against detail sheets')
  }

  // Check for details (often reference parent sheets)
  if (sheets.some(s => s.sheet_type === SheetType.DETAIL)) {
    hints.push('DETAIL_SHEET: Quantities here may reference parent sheets - verify for double-counting')
  }

  return hints
}

/**
 * Summarize scales from sheets
 */
function summarizeScales(sheets: SheetIndex[]): string {
  const scales = sheets
    .map(s => s.scale)
    .filter((s): s is string => s !== null)
  const uniqueScales = Array.from(new Set(scales))
  return uniqueScales.length > 0 
    ? uniqueScales.join(', ') 
    : 'Scale not detected'
}

/**
 * Generate location anchors
 */
function generateAnchors(pages: number[], sheets: SheetIndex[]): any[] {
  return sheets.map((sheet, idx) => ({
    anchor_id: `anchor_${sheet.sheet_id}`,
    type: 'sheet_id' as const,
    value: sheet.sheet_id,
    description: `Sheet ${sheet.sheet_id}: ${sheet.title}`,
    page_number: sheet.page_no
  }))
}

