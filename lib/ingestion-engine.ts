/**
 * Main Ingestion Engine
 * 
 * Orchestrates the complete PDF ingestion pipeline:
 * 1. Download PDF from Supabase Storage
 * 2. Extract text and images per page
 * 3. Build sheet index
 * 4. Generate chunks
 * 5. Persist to database
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { extractTextPerPage } from './ingestion/pdf-text-extractor'
import { extractImagesPerPage, extractImageUrlsOnly } from './ingestion/pdf-image-extractor'
import { buildSheetIndex } from './ingestion/sheet-index-builder'
import { generateChunks } from './ingestion/chunking-engine'
import type {
  IngestionRequest,
  IngestionResponse,
  ProcessingStatus,
  ProjectMeta,
  Chunk,
  SheetIndex,
  PageText,
  PageImage
} from '@/types/ingestion'

const STORAGE_BUCKET = 'job-plans'
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000] // ms

/**
 * Main ingestion function
 */
export async function ingestPlan(
  plan: any, // Plan record from database
  userId: string,
  jobId?: string,
  options?: IngestionRequest['options']
): Promise<IngestionResponse> {
  const startTime = Date.now()
  const supabase = await createServerSupabaseClient()
  const planId = plan.id

  let status: ProcessingStatus = {
    stage: 'queued',
    progress: 0,
    current_step: 'Initializing',
    started_at: new Date().toISOString(),
    stats: {
      pages_processed: 0,
      sheets_indexed: 0,
      chunks_created: 0,
      errors_count: 0
    }
  }

  const errors: string[] = []
  const warnings: string[] = []

  try {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`📦 INGESTION STARTED - Plan ${planId}`)
    console.log(`${'='.repeat(80)}`)
    console.log(`   File: ${plan.file_name || 'unknown'}`)
    console.log(`   Path: ${plan.file_path || 'unknown'}`)
    
    // Update status: downloading
    status.stage = 'downloading'
    status.current_step = 'Fetching PDF from storage'
    await updateProcessingStatus(supabase, planId, status)
    console.log(`   ✅ Stage: Downloading PDF`)

    // Step 1: Get signed URL and download PDF
    const pdfBuffer = await downloadPDF(supabase, plan.file_path, errors)

    if (!pdfBuffer) {
      throw new Error('Failed to download PDF')
    }

    status.progress = 10
    status.current_step = 'PDF downloaded, extracting text and images'
    await updateProcessingStatus(supabase, planId, status)

    // Step 2: Extract text and images in parallel
    status.stage = 'extracting'
    console.log(`   ✅ Stage: Extracting text and images from PDF`)
    
    // Default to text-only for simplicity (images are optional enhancement)
    const enableImages = options?.enable_image_extraction === true && !!process.env.PDF_CO_API_KEY
    
    const [pageTexts, pageImages] = await Promise.all([
      extractTextPerPage(pdfBuffer).catch(err => {
        errors.push(`Text extraction error: ${err.message}`)
        return []
      }),
      enableImages
        ? extractImagesPerPage(pdfBuffer, plan.file_name || 'plan.pdf', options?.image_dpi || 300)
            .then(async images => {
              // Upload images to Supabase Storage
              return await uploadPageImages(supabase, planId, images, errors)
            })
            .catch(err => {
              errors.push(`Image extraction error: ${err.message}`)
              warnings.push('Image extraction failed - continuing with text only')
              return new Map<number, string>()
            })
        : Promise.resolve(new Map<number, string>())
    ])

    if (pageTexts.length === 0) {
      warnings.push('No text extracted from PDF - may be scanned/image-only')
    }

    status.progress = 40
    status.stats!.pages_processed = pageTexts.length
    await updateProcessingStatus(supabase, planId, status)
    console.log(`   ✅ Extracted: ${pageTexts.length} pages, ${pageImages.size} images`)

    // Step 3: Build sheet index
    status.stage = 'indexing'
    status.current_step = 'Building sheet index'
    await updateProcessingStatus(supabase, planId, status)

    const sheetIndex = await buildSheetIndex(pageTexts, pdfBuffer)
    
    // Persist sheet index to database
    await persistSheetIndex(supabase, planId, sheetIndex, errors)
    status.stats!.sheets_indexed = sheetIndex.length
    console.log(`   ✅ Stage: Sheet indexing complete (${sheetIndex.length} sheets)`)

    status.progress = 60
    await updateProcessingStatus(supabase, planId, status)

    // Step 4: Generate chunks
    status.stage = 'chunking'
    status.current_step = 'Generating chunks'
    await updateProcessingStatus(supabase, planId, status)

    const projectMeta: ProjectMeta = {
      plan_id: planId,
      project_name: plan.project_name,
      project_location: plan.project_location,
      plan_title: plan.title,
      job_id: jobId || plan.job_id || null,
      plan_file_name: plan.file_name,
      total_pages: pageTexts.length,
      plan_upload_date: plan.created_at,
      detected_projects: extractProjectNames(pageTexts),
      detected_addresses: extractAddresses(pageTexts)
    }

    const chunks = await generateChunks(
      pageTexts,
      sheetIndex,
      projectMeta,
      pageImages,
      {
        targetChunkSizeTokens: options?.target_chunk_size_tokens || 3000,
        overlapPercentage: options?.overlap_percentage || 17.5,
        maxChunkSizeTokens: options?.max_chunk_size_tokens || 4000,
        minChunkSizeTokens: options?.min_chunk_size_tokens || 2000
      }
    )

    // Persist chunks to database
    await persistChunks(supabase, planId, chunks, errors)
    status.stats!.chunks_created = chunks.length
    console.log(`   ✅ Stage: Chunking complete (${chunks.length} chunks created)`)
    console.log(`   ✅ Average chunk size: ${Math.round(chunks.reduce((sum, c) => sum + c.content.text_token_count, 0) / chunks.length)} tokens`)

    status.progress = 90
    await updateProcessingStatus(supabase, planId, status)

    // Step 5: Group plan sets
    const planSetGroups = groupPlanSets(sheetIndex)

    // Step 6: Finalize
    status.stage = 'completed'
    status.progress = 100
    status.current_step = 'Ingestion complete'
    status.completed_at = new Date().toISOString()
    await updateProcessingStatus(supabase, planId, status)

    // Update plan status
    await supabase
      .from('plans')
      .update({
        status: 'ready',
        num_pages: pageTexts.length
      })
      .eq('id', planId)

    const processingTimeMs = Date.now() - startTime
    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ INGESTION COMPLETE - Plan ${planId}`)
    console.log(`${'='.repeat(80)}`)
    console.log(`   📊 Stats:`)
    console.log(`      - Pages: ${pageTexts.length}`)
    console.log(`      - Sheets: ${sheetIndex.length}`)
    console.log(`      - Chunks: ${chunks.length}`)
    console.log(`      - Time: ${(processingTimeMs / 1000).toFixed(1)}s`)
    console.log(`   ✅ Plan is now ready for orchestrator analysis!`)
    console.log(`${'='.repeat(80)}\n`)
    const averageChunkSizeTokens = chunks.length > 0
      ? Math.round(chunks.reduce((sum, c) => sum + c.content.text_token_count, 0) / chunks.length)
      : 0

    return {
      success: true,
      planId,
      stats: {
        totalPages: pageTexts.length,
        totalChunks: chunks.length,
        sheetIndexCount: sheetIndex.length,
        processingTimeMs,
        averageChunkSizeTokens,
        imagesExtracted: pageImages.size,
        textExtracted: pageTexts.length > 0
      },
      sheetIndex,
      planSetGroups,
      chunkPreview: chunks.slice(0, 10).map(chunk => ({
        chunk_id: chunk.chunk_id,
        chunk_index: chunk.chunk_index,
        page_range: {
          start: chunk.page_range.start,
          end: chunk.page_range.end
        },
        token_count: chunk.content.text_token_count,
        sheet_count: chunk.sheet_index_subset.length
      })),
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    }

  } catch (error) {
    console.error('Ingestion error:', error)
    
    status.stage = 'failed'
    status.error = error instanceof Error ? error.message : 'Unknown error'
    status.completed_at = new Date().toISOString()
    await updateProcessingStatus(supabase, planId, status)

    // Update plan status
    await supabase
      .from('plans')
      .update({ status: 'draft' })
      .eq('id', planId)

    throw error
  }
}

/**
 * Download PDF from Supabase Storage with retry logic
 */
async function downloadPDF(
  supabase: any,
  filePath: string,
  errors: string[]
): Promise<Buffer | null> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Extract storage path from full URL if needed
      let storagePath = filePath
      if (filePath.includes('/storage/v1/object/public/')) {
        // Extract path after bucket name
        const parts = filePath.split('/storage/v1/object/public/')
        storagePath = parts[1]?.split('/').slice(1).join('/') || filePath
      } else if (filePath.startsWith('http')) {
        // Full URL, extract just the path
        const url = new URL(filePath)
        storagePath = url.pathname.split('/').slice(2).join('/') // Remove bucket name from path
      }

      // Get signed URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 300) // 5 minute expiration

      if (urlError) {
        throw new Error(`Failed to create signed URL: ${urlError.message}`)
      }

      if (!urlData?.signedUrl) {
        throw new Error('No signed URL returned')
      }

      // Download PDF
      const response = await fetch(urlData.signedUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Check file size
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${parseInt(contentLength)} bytes (max: ${MAX_FILE_SIZE})`)
      }

      // Stream to buffer
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      errors.push(`Download attempt ${attempt + 1} failed: ${lastError.message}`)

      if (attempt < MAX_RETRIES - 1) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
      }
    }
  }

  return null
}

/**
 * Upload page images to Supabase Storage
 */
async function uploadPageImages(
  supabase: any,
  planId: string,
  images: PageImage[],
  errors: string[]
): Promise<Map<number, string>> {
  const imageUrls = new Map<number, string>()

  for (const image of images) {
    try {
      // If image already has a storageUrl from PDF.co, use it (no need to re-upload)
      if (image.storageUrl && image.storageUrl.startsWith('http')) {
        imageUrls.set(image.pageNumber, image.storageUrl)
        continue
      }

      // Otherwise, upload to Supabase Storage
      if (!image.imageBuffer || image.imageBuffer.length === 0) {
        errors.push(`No image buffer for page ${image.pageNumber}`)
        continue
      }

      const imagePath = `chunks/${planId}/page-${image.pageNumber}.png`
      
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(imagePath, image.imageBuffer, {
          contentType: 'image/png',
          upsert: true
        })

      if (error) {
        errors.push(`Failed to upload image for page ${image.pageNumber}: ${error.message}`)
        continue
      }

      // Get public/signed URL
      const { data: urlData } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(imagePath, 31536000) // 1 year expiration

      if (urlData?.signedUrl) {
        imageUrls.set(image.pageNumber, urlData.signedUrl)
      }

    } catch (error) {
      errors.push(`Error uploading image for page ${image.pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return imageUrls
}

/**
 * Persist sheet index to database
 */
async function persistSheetIndex(
  supabase: any,
  planId: string,
  sheetIndex: SheetIndex[],
  errors: string[]
): Promise<void> {
  try {
    // Delete existing entries
    await supabase
      .from('plan_sheet_index')
      .delete()
      .eq('plan_id', planId)

    // Insert new entries
    const { error } = await supabase
      .from('plan_sheet_index')
      .insert(
        sheetIndex.map(sheet => ({
          plan_id: planId,
          sheet_id: sheet.sheet_id,
          title: sheet.title,
          discipline: sheet.discipline,
          scale: sheet.scale,
          scale_ratio: sheet.scale_ratio,
          units: sheet.units,
          page_no: sheet.page_no,
          sheet_type: sheet.sheet_type,
          rotation: sheet.rotation,
          has_text_layer: sheet.has_text_layer,
          has_image: sheet.has_image,
          text_length: sheet.text_length,
          detected_keywords: sheet.detected_keywords
        }))
      )

    if (error) {
      throw error
    }

  } catch (error) {
    errors.push(`Failed to persist sheet index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

/**
 * Persist chunks to database
 */
async function persistChunks(
  supabase: any,
  planId: string,
  chunks: Chunk[],
  errors: string[]
): Promise<void> {
  try {
    // Delete existing chunks
    await supabase
      .from('plan_chunks')
      .delete()
      .eq('plan_id', planId)

    // Insert new chunks
    const { error } = await supabase
      .from('plan_chunks')
      .insert(
        chunks.map(chunk => ({
          plan_id: planId,
          chunk_index: chunk.chunk_index,
          page_range: chunk.page_range,
          sheet_index_subset: chunk.sheet_index_subset,
          content: chunk.content,
          metadata: chunk.metadata,
          safeguards: chunk.safeguards
        }))
      )

    if (error) {
      throw error
    }

  } catch (error) {
    errors.push(`Failed to persist chunks: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

/**
 * Update processing status in database
 */
async function updateProcessingStatus(
  supabase: any,
  planId: string,
  status: ProcessingStatus
): Promise<void> {
  try {
    await supabase
      .from('plans')
      .update({ processing_status: status })
      .eq('id', planId)
  } catch (error) {
    console.error('Failed to update processing status:', error)
    // Don't throw - status updates are best effort
  }
}

/**
 * Extract project names from title sheets
 */
function extractProjectNames(pageTexts: PageText[]): string[] {
  const projects: string[] = []
  
  // Look in first few pages (title sheets)
  const titlePages = pageTexts.slice(0, 3)
  
  for (const page of titlePages) {
    const projectMatch = page.text.match(/PROJECT[\s:]+([A-Z][^\n]+)/i)
    if (projectMatch) {
      projects.push(projectMatch[1].trim())
    }
  }

  return Array.from(new Set(projects))
}

/**
 * Extract addresses from title sheets
 */
function extractAddresses(pageTexts: PageText[]): string[] {
  const addresses: string[] = []
  
  // Look in first few pages (title sheets)
  const titlePages = pageTexts.slice(0, 3)
  
  // Simple address pattern matching
  const addressPattern = /\d+\s+[A-Z][A-Za-z\s]+(?:ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD|DR|DRIVE|LN|LANE)[\s,]*[A-Z]{2}\s+\d{5}/i
  
  for (const page of titlePages) {
    const matches = page.text.match(addressPattern)
    if (matches) {
      addresses.push(...matches.map(m => m.trim()))
    }
  }

  return Array.from(new Set(addresses))
}

/**
 * Group sheets into plan sets
 */
function groupPlanSets(sheetIndex: SheetIndex[]): any[] {
  // TODO: Implement plan set grouping logic
  // Group by sheet_type and discipline
  const groups = new Map<string, any>()

  for (const sheet of sheetIndex) {
    const key = `${sheet.sheet_type}_${sheet.discipline}`
    
    if (!groups.has(key)) {
      groups.set(key, {
        group_id: key,
        name: `${sheet.sheet_type} - ${sheet.discipline}`,
        sheet_type: sheet.sheet_type,
        discipline: sheet.discipline,
        page_numbers: [],
        sheet_ids: [],
        scale: sheet.scale,
        description: `Collection of ${sheet.sheet_type} sheets for ${sheet.discipline} discipline`
      })
    }

    const group = groups.get(key)!
    group.page_numbers.push(sheet.page_no)
    group.sheet_ids.push(sheet.sheet_id)
  }

  return Array.from(groups.values())
}

