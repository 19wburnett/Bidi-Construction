import { aiGateway } from './ai-gateway-provider'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extractTextWithPdfjs } from '@/lib/ingestion/pdf-text-extractor-pdfjs'
import { extractTextPerPage } from '@/lib/ingestion/pdf-text-extractor'
import { extractTextWithOCR } from '@/lib/ingestion/pdf-ocr-extractor'
import { generatePageDescriptions, isVisionDescriptionEnabled } from '@/lib/ingestion/vision-page-describer'
import type { OCRPageText } from '@/lib/ingestion/pdf-ocr-extractor'
import type { PageText } from '@/types/ingestion'

const DEFAULT_STORAGE_BUCKET = process.env.NEXT_PUBLIC_PLAN_STORAGE_BUCKET || 'job-plans'
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
const EMBEDDING_DIMENSION = 1536
const MAX_CHUNK_CHAR_LENGTH = 900
const MIN_CHUNK_CHAR_LENGTH = 250
const BATCH_SIZE = 20

const hasAIGatewayKey = !!process.env.AI_GATEWAY_API_KEY

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
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key not configured. Set AI_GATEWAY_API_KEY to enable embeddings.')
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

  console.log(`[Vectorization] Downloading PDF from: ${plan.file_path}`)
  const pdfBuffer = await downloadPlanPdf(supabase, plan.file_path)
  const pdfSizeMB = pdfBuffer.length / (1024 * 1024)
  console.log(`[Vectorization] PDF downloaded, size: ${pdfBuffer.length} bytes (${pdfSizeMB.toFixed(2)} MB)`)
  
  // Log PDF characteristics that might affect processing
  if (pdfSizeMB > 50) {
    console.warn(`[Vectorization] Large PDF detected (${pdfSizeMB.toFixed(2)} MB). Processing may take longer.`)
  }

  // =========================================================================
  // TEXT EXTRACTION: 3-Tier Approach
  // 1. pdfjs-dist (PRIMARY) - Most reliable, handles complex PDFs well
  // 2. pdf2json (FALLBACK) - Good for edge cases pdfjs might miss
  // 3. PDF.co OCR (LAST RESORT) - For scanned/image-only PDFs
  // =========================================================================
  
  console.log(`[Vectorization] Starting text extraction from PDF (${pdfBuffer.length} bytes)...`)
  const extractionStartTime = Date.now()
  
  let pageTexts: PageText[] = []
  let extractionMethod: 'pdfjs-dist' | 'pdf2json' | 'ocr' | 'none' = 'none'
  const warnings: string[] = []
  
  // ---------------------------------------------------------------------------
  // TIER 1: Try pdfjs-dist first (most reliable for complex PDFs)
  // ---------------------------------------------------------------------------
  console.log(`[Vectorization] [Tier 1] Trying pdfjs-dist extraction...`)
  try {
    const pdfjsResult = await extractTextWithPdfjs(pdfBuffer, {
      timeoutMs: 3 * 60 * 1000, // 3 minute timeout
      onProgress: (page, total) => {
        if (page % 20 === 0) {
          console.log(`[Vectorization] [pdfjs-dist] Progress: ${page}/${total} pages`)
        }
      }
    })
    
    pageTexts = pdfjsResult.pages
    const totalText = pageTexts.reduce((sum, p) => sum + (p.text?.length || 0), 0)
    const avgTextPerPage = pageTexts.length > 0 ? totalText / pageTexts.length : 0
    
    console.log(`[Vectorization] [pdfjs-dist] Extracted ${pageTexts.length} pages, ${totalText} total chars (avg ${avgTextPerPage.toFixed(0)}/page) in ${pdfjsResult.extractionTimeMs}ms`)
    
    // Check if we got meaningful text (at least 50 chars avg per page)
    if (pageTexts.length > 0 && avgTextPerPage >= 50) {
      extractionMethod = 'pdfjs-dist'
      if (pdfjsResult.warnings.length > 0) {
        warnings.push(...pdfjsResult.warnings.map(w => `[pdfjs-dist] ${w}`))
      }
      console.log(`[Vectorization] [pdfjs-dist] SUCCESS - Got meaningful text`)
    } else {
      console.log(`[Vectorization] [pdfjs-dist] Low text content (${avgTextPerPage.toFixed(0)} chars/page avg). Will try fallbacks.`)
      warnings.push(`pdfjs-dist extracted only ${avgTextPerPage.toFixed(0)} chars/page avg - trying fallback`)
    }
  } catch (pdfjsError) {
    const errorMsg = pdfjsError instanceof Error ? pdfjsError.message : String(pdfjsError)
    console.warn(`[Vectorization] [pdfjs-dist] Failed:`, errorMsg)
    warnings.push(`pdfjs-dist extraction failed: ${errorMsg}`)
  }
  
  // ---------------------------------------------------------------------------
  // TIER 2: Try pdf2json as fallback (if pdfjs didn't get enough text)
  // ---------------------------------------------------------------------------
  if (extractionMethod === 'none') {
    console.log(`[Vectorization] [Tier 2] Trying pdf2json extraction...`)
    try {
      const pdf2jsonStartTime = Date.now()
      
      // Use timeout to prevent hanging on complex PDFs
      const extractionPromise = extractTextPerPage(pdfBuffer)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('pdf2json timeout after 60s'))
        }, 60000) // 60 second timeout
      })
      
      const pdf2jsonPages = await Promise.race([extractionPromise, timeoutPromise])
      const pdf2jsonTime = Date.now() - pdf2jsonStartTime
      
      const totalText = pdf2jsonPages.reduce((sum, p) => sum + (p.text?.length || 0), 0)
      const avgTextPerPage = pdf2jsonPages.length > 0 ? totalText / pdf2jsonPages.length : 0
      
      console.log(`[Vectorization] [pdf2json] Extracted ${pdf2jsonPages.length} pages, ${totalText} total chars (avg ${avgTextPerPage.toFixed(0)}/page) in ${pdf2jsonTime}ms`)
      
      // Use pdf2json results if they're better than what we have
      const currentAvg = pageTexts.length > 0 
        ? pageTexts.reduce((sum, p) => sum + (p.text?.length || 0), 0) / pageTexts.length 
        : 0
      
      if (avgTextPerPage > currentAvg && avgTextPerPage >= 50) {
        pageTexts = pdf2jsonPages
        extractionMethod = 'pdf2json'
        console.log(`[Vectorization] [pdf2json] SUCCESS - Got better results than pdfjs-dist`)
      } else if (avgTextPerPage > currentAvg) {
        // Even if below threshold, use it if it's the best we have
        pageTexts = pdf2jsonPages
        console.log(`[Vectorization] [pdf2json] Using results (better than pdfjs but still low text)`)
      } else {
        console.log(`[Vectorization] [pdf2json] Results not better than existing, keeping pdfjs results`)
      }
    } catch (pdf2jsonError) {
      const errorMsg = pdf2jsonError instanceof Error ? pdf2jsonError.message : String(pdf2jsonError)
      console.warn(`[Vectorization] [pdf2json] Failed:`, errorMsg)
      warnings.push(`pdf2json extraction failed: ${errorMsg}`)
    }
  }
  
  // ---------------------------------------------------------------------------
  // TIER 3: Try OCR as last resort (for scanned/image-only PDFs)
  // ---------------------------------------------------------------------------
  const totalTextSoFar = pageTexts.reduce((sum, p) => sum + (p.text?.length || 0), 0)
  const avgTextSoFar = pageTexts.length > 0 ? totalTextSoFar / pageTexts.length : 0
  const needsOCR = avgTextSoFar < 50 && process.env.PDF_CO_API_KEY
  
  if (needsOCR) {
    console.log(`[Vectorization] [Tier 3] Low text content (${avgTextSoFar.toFixed(0)} chars/page). Trying OCR...`)
    warnings.push('Low text content detected - attempting OCR for scanned blueprint')
    
    try {
      const ocrPageTexts = await extractTextWithOCR(pdfBuffer, plan.file_name || 'plan.pdf')
      
      if (ocrPageTexts.length > 0) {
        // Merge OCR results with existing text
        const ocrByPage = new Map<number, OCRPageText>()
        ocrPageTexts.forEach((ocrPage) => {
          ocrByPage.set(ocrPage.pageNumber, ocrPage)
        })

        const combinedPages: PageText[] = []
        const maxPages = Math.max(pageTexts.length, ocrPageTexts.length)
        
        for (let i = 1; i <= maxPages; i++) {
          const ocrPage = ocrByPage.get(i)
          const originalPage = pageTexts.find((p) => p.pageNumber === i)
          
          if (ocrPage) {
            const combinedText = ocrPage.text + (originalPage?.text ? `\n${originalPage.text}` : '')
            combinedPages.push({
              pageNumber: i,
              text: combinedText,
              textItems: ocrPage.textItems || originalPage?.textItems || [],
            })
          } else if (originalPage) {
            combinedPages.push(originalPage)
          }
        }
        
        pageTexts = combinedPages
        extractionMethod = 'ocr'
        console.log(`[Vectorization] [OCR] SUCCESS - Extracted text from ${ocrPageTexts.length} pages`)
      } else {
        warnings.push('OCR extraction attempted but returned no text')
      }
    } catch (ocrError) {
      const errorMsg = ocrError instanceof Error ? ocrError.message : String(ocrError)
      console.error(`[Vectorization] [OCR] Failed:`, errorMsg)
      warnings.push(`OCR extraction failed: ${errorMsg}`)
    }
  }
  
  // ---------------------------------------------------------------------------
  // Final extraction summary
  // ---------------------------------------------------------------------------
  const extractionTime = Date.now() - extractionStartTime
  const finalPageCount = pageTexts.length
  const finalTotalText = pageTexts.reduce((sum, p) => sum + (p.text?.length || 0), 0)
  const finalAvgText = finalPageCount > 0 ? finalTotalText / finalPageCount : 0
  
  console.log(`[Vectorization] Text extraction complete:`)
  console.log(`  - Method: ${extractionMethod}`)
  console.log(`  - Pages: ${finalPageCount}`)
  console.log(`  - Total text: ${finalTotalText} chars`)
  console.log(`  - Avg per page: ${finalAvgText.toFixed(0)} chars`)
  console.log(`  - Time: ${extractionTime}ms`)
  
  if (finalPageCount === 0 || finalTotalText === 0) {
    console.error(`[Vectorization] No text extracted from PDF. Characteristics:`)
    console.error(`  - File size: ${pdfSizeMB.toFixed(2)} MB`)
    console.error(`  - File name: ${plan.file_name || 'unknown'}`)
    console.error(`  - OCR available: ${process.env.PDF_CO_API_KEY ? 'yes' : 'no'}`)
    warnings.push('No text extracted from the plan file')
  }
  
  // Store extraction method in warnings for debugging
  if (extractionMethod !== 'none') {
    warnings.push(`Text extraction method: ${extractionMethod}`)
  }

  // =========================================================================
  // VISION DESCRIPTIONS: Generate GPT-4V descriptions for visual context
  // These become searchable text chunks, enabling AI to answer visual questions
  // =========================================================================
  
  let visionChunks: RawChunkCandidate[] = []
  
  if (isVisionDescriptionEnabled()) {
    console.log(`[Vectorization] Vision descriptions enabled - generating page descriptions...`)
    
    try {
      const visionResult = await generatePageDescriptions(pdfBuffer, {
        maxPages: 100, // Limit to first 100 pages for cost control
        batchSize: 3,  // Process 3 pages in parallel
        onProgress: (page, total) => {
          if (page % 10 === 0) {
            console.log(`[Vectorization] Vision progress: ${page}/${total} pages`)
          }
        }
      })
      
      if (visionResult.descriptions.length > 0) {
        console.log(`[Vectorization] Generated ${visionResult.descriptions.length} vision descriptions (est. cost: $${visionResult.totalCost.toFixed(4)})`)
        
        // Convert vision descriptions to chunks
        visionChunks = visionResult.descriptions.map(desc => ({
          snippet_text: desc.description,
          page_number: desc.pageNumber,
          metadata: {
            content_type: 'vision_description',
            page_type: desc.pageType || null,
            source: 'gpt-4v',
          }
        }))
        
        warnings.push(`Vision descriptions: ${visionResult.descriptions.length} pages analyzed`)
      }
      
      if (visionResult.warnings.length > 0) {
        warnings.push(...visionResult.warnings.map(w => `[Vision] ${w}`))
      }
    } catch (visionError) {
      const errorMsg = visionError instanceof Error ? visionError.message : String(visionError)
      console.error(`[Vectorization] Vision description failed:`, errorMsg)
      warnings.push(`Vision descriptions failed: ${errorMsg}`)
      // Continue without vision descriptions - text extraction still works
    }
  } else {
    console.log(`[Vectorization] Vision descriptions disabled (set ENABLE_VISION_DESCRIPTIONS=true to enable)`)
  }

  const sheetIndexByPage = await loadSheetMetadataByPage(supabase, planId)

  // Step 3: Chunk the text (for large PDFs, this is done in batches)
  const textChunks: RawChunkCandidate[] = []
  const chunkBatchSize = 50 // Process 50 pages at a time for very large PDFs
  
  for (let i = 0; i < pageTexts.length; i += chunkBatchSize) {
    const batch = pageTexts.slice(i, i + chunkBatchSize)
    batch.forEach((page, batchIndex) => {
      const pageIndex = i + batchIndex
      const sheetMeta = sheetIndexByPage.get(page.pageNumber)
      const pageChunks = chunkPageText(page.text, {
        planId,
        pageNumber: page.pageNumber,
        pageIndex,
        sheetMeta,
        totalPages: pageTexts.length,
      })
      textChunks.push(...pageChunks)
    })
    
    // Log progress for large PDFs
    if (pageTexts.length > 100) {
      const progress = Math.round(((i + batch.length) / pageTexts.length) * 100)
      console.log(`[Vectorization] Chunking progress: ${progress}% (${i + batch.length}/${pageTexts.length} pages)`)
    }
  }
  
  console.log(`[Vectorization] Created ${textChunks.length} text chunks from ${pageTexts.length} pages`)
  
  // Merge text chunks and vision chunks
  const chunkCandidates: RawChunkCandidate[] = [...textChunks, ...visionChunks]
  
  if (visionChunks.length > 0) {
    console.log(`[Vectorization] Total chunks: ${chunkCandidates.length} (${textChunks.length} text + ${visionChunks.length} vision)`)
  }

  if (chunkCandidates.length === 0) {
    console.warn(`[Vectorization] WARNING: No chunks created for plan ${planId}. This may indicate:`)
    console.warn(`  - No text was extracted from the PDF (${finalPageCount} pages processed)`)
    console.warn(`  - Text extraction failed or PDF is image-only`)
    console.warn(`  - Chunking function returned empty results`)
    
    if (finalPageCount === 0) {
      warnings.push('No pages found in PDF file')
    } else if (pageTexts.length === 0) {
      warnings.push(`PDF has ${finalPageCount} pages but no text was extracted`)
    } else {
      const totalTextLength = pageTexts.reduce((sum, page) => sum + (page.text?.length || 0), 0)
      warnings.push(`PDF has ${pageTexts.length} pages with text, but chunking produced no chunks (total text length: ${totalTextLength} chars)`)
    }
    
    await supabase.from('plan_text_chunks').delete().eq('plan_id', planId)
    return {
      planId,
      chunkCount: 0,
      pageCount: finalPageCount,
      warnings: warnings.length ? warnings : undefined,
    }
  }

  // For large PDFs, process embeddings in batches to avoid memory issues
  const batchSize = 50 // Process 50 chunks at a time
  const embeddings: number[][] = []
  
  console.log(`[Vectorization] Generating embeddings for ${chunkCandidates.length} chunks in batches of ${batchSize}...`)
  
  for (let i = 0; i < chunkCandidates.length; i += batchSize) {
    const batch = chunkCandidates.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(chunkCandidates.length / batchSize)
    console.log(`[Vectorization] Processing embedding batch ${batchNum}/${totalBatches} (${batch.length} chunks)`)
    
    const embeddingStartTime = Date.now()
    const batchEmbeddings = await embedChunks(batch.map((chunk) => chunk.snippet_text))
    const embeddingTime = Date.now() - embeddingStartTime
    console.log(`[Vectorization] Batch ${batchNum} embeddings generated in ${embeddingTime}ms`)
    
    embeddings.push(...batchEmbeddings)
    
    // Log progress for large PDFs
    if (chunkCandidates.length > 100) {
      const progress = Math.round(((i + batch.length) / chunkCandidates.length) * 100)
      console.log(`[Vectorization] Embedding progress: ${progress}% (${i + batch.length}/${chunkCandidates.length} chunks)`)
    }
  }

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

  // Validate that embeddings were created successfully
  const { data: insertedChunks, error: verifyError } = await supabase
    .from('plan_text_chunks')
    .select('id, embedding')
    .eq('plan_id', planId)

  if (verifyError) {
    console.warn('[Ingestion] Failed to verify inserted chunks:', verifyError)
    warnings.push('Could not verify embeddings after insertion')
  } else if (insertedChunks) {
    const chunksWithoutEmbeddings = insertedChunks.filter(chunk => !chunk.embedding)
    if (chunksWithoutEmbeddings.length > 0) {
      const errorMsg = `${chunksWithoutEmbeddings.length} chunks were inserted without embeddings - they won't be searchable`
      console.error(`[Ingestion] WARNING: ${errorMsg}`)
      warnings.push(errorMsg)
    }
    
    const chunksWithEmbeddings = insertedChunks.filter(chunk => chunk.embedding)
    if (chunksWithEmbeddings.length === 0) {
      throw new Error('No chunks were created with embeddings. Check AI_GATEWAY_API_KEY and embedding model configuration.')
    }
    
    console.log(`[Ingestion] Successfully created ${chunksWithEmbeddings.length} chunks with embeddings for plan ${planId}`)
  }

  return {
    planId,
    chunkCount: recordsToInsert.length,
    pageCount: finalPageCount,
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
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key not configured. Set AI_GATEWAY_API_KEY to enable embeddings.')
  }

  const sanitizedQuery = query.trim()
  if (!sanitizedQuery) {
    return []
  }

  // First, check if plan has any chunks with embeddings
  const { count, error: countError } = await supabase
    .from('plan_text_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .not('embedding', 'is', null)

  if (countError) {
    console.error('[Retrieval] Error checking chunks:', countError)
  }

  if (count === 0 || count === null) {
    console.warn(`[Retrieval] Plan ${planId} has no chunks with embeddings. Run ingestion first.`)
    
    // Check if plan has chunks at all (without embeddings)
    const { count: totalCount } = await supabase
      .from('plan_text_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', planId)
    
    if (totalCount && totalCount > 0) {
      console.error(`[Retrieval] Plan ${planId} has ${totalCount} chunks but none have embeddings. Re-run ingestion.`)
    }
    
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
    console.error('[Retrieval] Vector search error:', error)
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
  console.log(`[Vectorization] Starting PDF download from: ${filePath}`)
  
  // Handle full URLs by downloading directly
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    console.log(`[Vectorization] Downloading from full URL`)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 minute timeout for download
    
    try {
      const response = await fetch(filePath, { signal: controller.signal })
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`Failed to download plan file (${response.status} ${response.statusText})`)
      }
      const arrayBuffer = await response.arrayBuffer()
      console.log(`[Vectorization] PDF downloaded from URL, size: ${arrayBuffer.byteLength} bytes`)
      return Buffer.from(arrayBuffer)
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('PDF download timeout after 5 minutes')
      }
      throw error
    }
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

  console.log(`[Vectorization] Trying to download from buckets: ${bucketCandidates.join(', ')}`)
  
  for (const bucket of bucketCandidates) {
    for (const candidatePath of [cleanPath, originalCleanPath]) {
      console.log(`[Vectorization] Trying bucket "${bucket}" with path "${candidatePath}"`)
      const signedUrl = await tryCreateSignedUrl(supabase, bucket, candidatePath)
      if (signedUrl) {
        console.log(`[Vectorization] Successfully created signed URL, downloading...`)
        const buffer = await fetchBuffer(signedUrl)
        console.log(`[Vectorization] PDF downloaded from storage, size: ${buffer.length} bytes`)
        return buffer
      }
    }
  }

  throw new Error(
    `Failed to create signed URL for plan file. Tried buckets: ${bucketCandidates.join(', ')}. Path: ${filePath}`
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
  console.log(`[Vectorization] Fetching buffer from signed URL...`)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 minute timeout
  
  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`Failed to download plan file (${response.status} ${response.statusText})`)
    }

    const arrayBuffer = await response.arrayBuffer()
    console.log(`[Vectorization] Buffer fetched, size: ${arrayBuffer.byteLength} bytes`)
    return Buffer.from(arrayBuffer)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('PDF download timeout after 5 minutes')
    }
    throw error
  }
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
    content_type: 'extracted_text', // Distinguish from 'vision_description' chunks
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
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key not configured. Set AI_GATEWAY_API_KEY to enable embeddings.')
  }

  const embeddings: number[][] = []
  for (let index = 0; index < texts.length; index += BATCH_SIZE) {
    const batch = texts.slice(index, index + BATCH_SIZE).map((text) => text.slice(0, MAX_CHUNK_CHAR_LENGTH))
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

