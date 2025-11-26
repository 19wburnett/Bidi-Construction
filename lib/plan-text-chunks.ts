import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extractTextPerPage } from '@/lib/ingestion/pdf-text-extractor'
import { extractTextWithOCR } from '@/lib/ingestion/pdf-ocr-extractor'
import type { OCRPageText } from '@/lib/ingestion/pdf-ocr-extractor'

const DEFAULT_STORAGE_BUCKET = process.env.NEXT_PUBLIC_PLAN_STORAGE_BUCKET || 'job-plans'
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSION = 1536
const MAX_CHUNK_CHAR_LENGTH = 900
const MIN_CHUNK_CHAR_LENGTH = 250
const BATCH_SIZE = 20

const openaiClient =
  typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

export interface PlanTextChunkRecord {
  id: string
  page_number: number | null
  snippet_text: string
  metadata: Record<string, any> | null
  similarity?: number
}

export interface PlanTextIngestionResult {
  planId: string
  chunkCount: number
  pageCount: number
  warnings?: string[]
}

type GenericSupabase = SupabaseClient<any, any, any>

interface SheetIndexRow {
  page_no: number
  sheet_id: string | null
  title: string | null
  discipline: string | null
  sheet_type: string | null
}

interface RawChunkCandidate {
  snippet_text: string
  page_number: number
  metadata: Record<string, any> | null
}

/**
 * Ingests plan text into plan_text_chunks with embeddings.
 * Clears existing records for the plan to keep results idempotent.
 */
export async function ingestPlanTextChunks(
  supabase: GenericSupabase,
  planId: string
): Promise<PlanTextIngestionResult> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY to enable embeddings.')
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, file_path, file_name, title')
    .eq('id', planId)
    .maybeSingle()

  if (planError) {
    throw new Error(planError.message || 'Failed to load plan')
  }

  if (!plan) {
    throw new Error('Plan not found')
  }

  if (!plan.file_path) {
    throw new Error('Plan file path is missing')
  }

  const pdfBuffer = await downloadPlanPdf(supabase, plan.file_path)

  // Step 1: Try regular text extraction first (for native PDFs)
  let pageTexts = await extractTextPerPage(pdfBuffer)
  const pageCount = pageTexts.length

  const warnings: string[] = []

  // Step 2: Check if we got meaningful text
  // If no text or very sparse text (< 50 chars per page average), try OCR
  const totalTextLength = pageTexts.reduce((sum, page) => sum + (page.text?.length || 0), 0)
  const avgTextPerPage = pageCount > 0 ? totalTextLength / pageCount : 0
  const isScannedPDF = pageCount === 0 || avgTextPerPage < 50

  if (isScannedPDF && process.env.PDF_CO_API_KEY) {
    console.log(`Low text content detected (avg ${avgTextPerPage.toFixed(0)} chars/page). Attempting OCR...`)
    warnings.push('Low text content detected - using OCR for scanned blueprint')
    
    // Try OCR extraction
    const ocrPageTexts = await extractTextWithOCR(pdfBuffer, plan.file_name || 'plan.pdf')
    
    if (ocrPageTexts.length > 0) {
      // Merge OCR results with existing text (OCR takes precedence for pages with OCR data)
      const ocrByPage = new Map<number, OCRPageText>()
      ocrPageTexts.forEach((ocrPage) => {
        ocrByPage.set(ocrPage.pageNumber, ocrPage)
      })

      // Combine: use OCR text if available, otherwise use original text
      const combinedPages: PageText[] = []
      const maxPages = Math.max(pageTexts.length, ocrPageTexts.length)
      
      for (let i = 1; i <= maxPages; i++) {
        const ocrPage = ocrByPage.get(i)
        const originalPage = pageTexts.find((p) => p.pageNumber === i)
        
        if (ocrPage) {
          // Use OCR text, but merge with original if it exists
          const combinedText = ocrPage.text + (originalPage?.text ? `\n${originalPage.text}` : '')
          combinedPages.push({
            pageNumber: i,
            text: combinedText,
            textItems: ocrPage.textItems || originalPage?.textItems || [],
          })
        } else if (originalPage) {
          // Use original text
          combinedPages.push(originalPage)
        }
      }
      
      pageTexts = combinedPages
      console.log(`OCR extracted text from ${ocrPageTexts.length} pages. Total pages with text: ${pageTexts.length}`)
    } else {
      warnings.push('OCR extraction attempted but returned no text. Plan may be image-only.')
    }
  }

  if (pageCount === 0 && pageTexts.length === 0) {
    warnings.push('No text extracted from the plan file (neither native text nor OCR).')
  }

  const sheetIndexByPage = await loadSheetMetadataByPage(supabase, planId)

  const chunkCandidates: RawChunkCandidate[] = []
  pageTexts.forEach((page, pageIndex) => {
    const sheetMeta = sheetIndexByPage.get(page.pageNumber)
    const pageChunks = chunkPageText(page.text, {
      planId,
      pageNumber: page.pageNumber,
      pageIndex,
      sheetMeta,
      totalPages: pageTexts.length,
    })
    chunkCandidates.push(...pageChunks)
  })

  if (chunkCandidates.length === 0) {
    await supabase.from('plan_text_chunks').delete().eq('plan_id', planId)
    return {
      planId,
      chunkCount: 0,
      pageCount,
      warnings: warnings.length ? warnings : undefined,
    }
  }

  const embeddings = await embedChunks(chunkCandidates.map((chunk) => chunk.snippet_text))

  // Delete existing chunks first to keep ingestion idempotent
  const { error: deleteError } = await supabase.from('plan_text_chunks').delete().eq('plan_id', planId)
  if (deleteError) {
    throw new Error(deleteError.message || 'Failed to clear existing plan text chunks')
  }

  const recordsToInsert = chunkCandidates.map((chunk, index) => ({
    plan_id: planId,
    page_number: chunk.page_number,
    snippet_text: chunk.snippet_text,
    metadata: chunk.metadata,
    embedding: embeddings[index],
  }))

  // Insert in batches to stay within Supabase limits
  for (let i = 0; i < recordsToInsert.length; i += 100) {
    const batch = recordsToInsert.slice(i, i + 100)
    const { error: insertError } = await supabase.from('plan_text_chunks').insert(batch)
    if (insertError) {
      throw new Error(insertError.message || 'Failed to insert plan text chunks')
    }
  }

  return {
    planId,
    chunkCount: recordsToInsert.length,
    pageCount,
    warnings: warnings.length ? warnings : undefined,
  }
}

/**
 * Retrieve relevant plan text chunks using cosine similarity search.
 */
export async function retrievePlanTextChunks(
  supabase: GenericSupabase,
  planId: string,
  query: string,
  limit = 6
): Promise<PlanTextChunkRecord[]> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY to enable embeddings.')
  }

  const sanitizedQuery = query.trim()
  if (!sanitizedQuery) {
    return []
  }

  const queryEmbedding = await embedChunks([sanitizedQuery])
  const embeddingVector = queryEmbedding[0]

  const { data, error } = await supabase.rpc('match_plan_text_chunks', {
    p_plan_id: planId,
    p_query_embedding: embeddingVector,
    p_match_limit: limit,
  })

  if (error) {
    throw new Error(error.message || 'Failed to retrieve plan text chunks')
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    page_number: row.page_number,
    snippet_text: row.snippet_text,
    metadata: row.metadata,
    similarity: typeof row.similarity === 'number' ? row.similarity : undefined,
  }))
}

export async function fetchPlanTextChunksByPage(
  supabase: GenericSupabase,
  planId: string,
  pageNumbers: number[],
  maxChunks?: number
): Promise<PlanTextChunkRecord[]> {
  if (pageNumbers.length === 0) {
    return []
  }

  const uniquePages = Array.from(new Set(pageNumbers.filter((page) => Number.isFinite(page))))
  if (uniquePages.length === 0) {
    return []
  }

  const limit = maxChunks ?? Math.max(uniquePages.length * 12, 12)

  const { data, error } = await supabase
    .from('plan_text_chunks')
    .select('id, page_number, snippet_text, metadata')
    .eq('plan_id', planId)
    .in('page_number', uniquePages)
    .order('page_number', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(error.message || 'Failed to load plan text chunks by page')
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    page_number: row.page_number,
    snippet_text: row.snippet_text,
    metadata: row.metadata,
  }))
}

export async function fetchPlanTextChunksSample(
  supabase: GenericSupabase,
  planId: string,
  limit = 12
): Promise<PlanTextChunkRecord[]> {
  const { data, error } = await supabase
    .from('plan_text_chunks')
    .select('id, page_number, snippet_text, metadata')
    .eq('plan_id', planId)
    .order('page_number', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(error.message || 'Failed to load sample plan text chunks')
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    page_number: row.page_number,
    snippet_text: row.snippet_text,
    metadata: row.metadata,
  }))
}

async function loadSheetMetadataByPage(
  supabase: GenericSupabase,
  planId: string
): Promise<Map<number, SheetIndexRow>> {
  const { data, error } = await supabase
    .from('plan_sheet_index')
    .select('page_no, sheet_id, title, discipline, sheet_type')
    .eq('plan_id', planId)

  if (error) {
    console.warn('Failed to load sheet metadata for plan:', planId, error)
    return new Map()
  }

  const map = new Map<number, SheetIndexRow>()
  ;(data || []).forEach((row: SheetIndexRow) => {
    map.set(row.page_no, row)
  })
  return map
}

async function downloadPlanPdf(supabase: GenericSupabase, filePath: string): Promise<Buffer> {
  // Handle full URLs by downloading directly
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Failed to download plan file (${response.status} ${response.statusText})`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  let storagePath = filePath
  let detectedBucket: string | null = null

  const originalPath =
    filePath.includes('/storage/v1/object/public/')
      ? filePath.split('/storage/v1/object/public/')[1] ?? filePath
      : filePath

  if (filePath.includes('/storage/v1/object/public/')) {
    const [, afterPublic] = filePath.split('/storage/v1/object/public/')
    if (afterPublic) {
      const [bucketCandidate, ...rest] = afterPublic.split('/')
      if (bucketCandidate && rest.length > 0) {
        detectedBucket = bucketCandidate
        storagePath = rest.join('/')
      } else {
        storagePath = afterPublic
      }
    }
  } else {
    const [bucketCandidate, ...rest] = storagePath.split('/')
    if (bucketCandidate && rest.length > 0) {
      detectedBucket = bucketCandidate
      storagePath = rest.join('/')
    }
  }

  const cleanPath = storagePath.split('?')[0]
  const originalCleanPath = originalPath.split('?')[0]
  const bucketCandidates = Array.from(
    new Set(
      [detectedBucket, DEFAULT_STORAGE_BUCKET, 'plan-files', 'plans'].filter(
        (bucket): bucket is string => typeof bucket === 'string' && bucket.trim().length > 0
      )
    )
  )

  for (const bucket of bucketCandidates) {
    for (const candidatePath of [cleanPath, originalCleanPath]) {
      const signedUrl = await tryCreateSignedUrl(supabase, bucket, candidatePath)
      if (signedUrl) {
        return fetchBuffer(signedUrl)
      }
    }
  }

  throw new Error(
    `Failed to create signed URL for plan file. Tried buckets: ${bucketCandidates.join(', ')}.`
  )
}

async function tryCreateSignedUrl(
  supabase: GenericSupabase,
  bucket: string,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 300)
  if (error) {
    if (error.message && error.message.toLowerCase().includes('object not found')) {
      return null
    }
    throw new Error(error.message || `Failed to create signed URL in bucket "${bucket}"`)
  }
  return data?.signedUrl ?? null
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download plan file (${response.status} ${response.statusText})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

function chunkPageText(
  rawText: string,
  context: {
    planId: string
    pageNumber: number
    pageIndex: number
    sheetMeta?: SheetIndexRow
    totalPages: number
  }
): RawChunkCandidate[] {
  const normalized = normalizeWhitespace(rawText)
  if (!normalized) {
    return []
  }

  const sentences = splitIntoSentences(normalized)
  const chunks: string[] = []
  let buffer = ''

  const flushBuffer = () => {
    const trimmed = buffer.trim()
    if (trimmed.length > 0) {
      chunks.push(trimmed)
    }
    buffer = ''
  }

  sentences.forEach((sentence, index) => {
    if (buffer.length + sentence.length + 1 > MAX_CHUNK_CHAR_LENGTH) {
      if (buffer.length < MIN_CHUNK_CHAR_LENGTH && chunks.length > 0) {
        // Append small residual to previous chunk
        const prev = chunks.pop()!
        chunks.push(`${prev} ${sentence}`.trim())
        buffer = ''
        return
      }
      flushBuffer()
    }

    buffer = buffer.length > 0 ? `${buffer} ${sentence}` : sentence

    // Flush if it's the last sentence
    if (index === sentences.length - 1) {
      flushBuffer()
    }
  })

  if (buffer.trim().length > 0) {
    flushBuffer()
  }

  const metadataBase: Record<string, any> = {
    chunk_page_index: context.pageIndex,
    total_pages: context.totalPages,
  }

  if (context.sheetMeta) {
    metadataBase.sheet_id = context.sheetMeta.sheet_id
    metadataBase.sheet_title = context.sheetMeta.title
    metadataBase.sheet_discipline = context.sheetMeta.discipline
    metadataBase.sheet_type = context.sheetMeta.sheet_type
  }

  return chunks.map((chunkText, chunkIndex) => ({
    snippet_text: chunkText.slice(0, MAX_CHUNK_CHAR_LENGTH).trim(),
    page_number: context.pageNumber,
    metadata: {
      ...metadataBase,
      chunk_index: chunkIndex,
      character_count: chunkText.length,
    },
  }))
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\u0000/g, '').trim()
}

function splitIntoSentences(text: string): string[] {
  const sentenceRegex = /(?<=\.|\?|\!)(?:\s+|$)/g
  const segments = text.split(sentenceRegex).map((segment) => segment.trim())
  const sentences: string[] = []

  segments.forEach((segment) => {
    if (!segment) return
    if (segment.length > MAX_CHUNK_CHAR_LENGTH) {
      // Split long segments into smaller parts
      const words = segment.split(/\s+/)
      let current = ''
      words.forEach((word) => {
        if ((current + ' ' + word).trim().length > MAX_CHUNK_CHAR_LENGTH) {
          if (current) {
            sentences.push(current.trim())
          }
          current = word
        } else {
          current = current ? `${current} ${word}` : word
        }
      })
      if (current) {
        sentences.push(current.trim())
      }
    } else {
      sentences.push(segment)
    }
  })

  return sentences
}

async function embedChunks(texts: string[]): Promise<number[][]> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured')
  }

  const embeddings: number[][] = []
  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE).map((text) => text.slice(0, MAX_CHUNK_CHAR_LENGTH))
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

