# Ingestion & Chunking Architecture Tech Spec

**Version:** 1.0  
**Date:** 2025-01-27  
**Author:** Ingestion & Chunking Architect  
**Status:** Ready for Implementation

---

## SECTION: Design

### Architecture Overview

A server-side pipeline that ingests large architectural plan PDFs from Supabase Storage, normalizes them into text and image derivatives, builds a comprehensive sheet index, and generates quality-preserving chunks optimized for multi-LLM analysis.

### File Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CLIENT REQUEST                                               │
│    POST /api/ingest                                             │
│    { planId, jobId, options }                                  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. AUTHENTICATION & VALIDATION                                  │
│    - Verify user session                                        │
│    - Load plan metadata from DB                                 │
│    - Verify plan ownership (user_id match)                      │
│    - Check if already processed (dedupe)                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. STORAGE ACCESS                                               │
│    - Generate signed URL from Supabase Storage                  │
│    - Bucket: 'job-plans'                                        │
│    - File path: plan.file_path                                  │
│    - Expiration: 300 seconds (5 min)                            │
│    - Retry with exponential backoff (max 3 attempts)            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PDF DOWNLOAD & STREAMING                                     │
│    - Fetch PDF via signed URL                                   │
│    - Stream to memory buffer (chunked reads)                     │
│    - Size validation (max 500MB)                                 │
│    - Content-Type validation                                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. PARALLEL EXTRACTION                                          │
│                                                                  │
│    ┌──────────────────┐      ┌──────────────────┐              │
│    │ TEXT EXTRACTION  │      │ IMAGE EXTRACTION │              │
│    │                  │      │                  │              │
│    │ - pdfjs-dist     │      │ - pdfjs-dist     │              │
│    │ - Per-page text  │      │ - Canvas render  │              │
│    │ - Position data  │      │ - PNG export     │              │
│    │ - Font metadata  │      │ - 300 DPI        │              │
│    └────────┬─────────┘      └────────┬─────────┘              │
│             │                         │                         │
│             └─────────┬───────────────┘                         │
│                       │                                          │
└───────────────────────┼──────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. SHEET INDEX BUILDING                                         │
│    - Parse title blocks                                         │
│    - Extract: sheet_id, title, discipline, scale, page_no       │
│    - Detect sheet types: Title, Floor Plans, Elevations, etc.  │
│    - Handle rotated sheets                                      │
│    - Store index in DB: plan_sheet_index                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. PLAN SET GROUPING                                            │
│    - Group pages by logical sets:                               │
│      • Title Sheets                                             │
│      • Floor Plans (A-1, A-2, etc.)                            │
│      • Elevations (A-4, A-5, etc.)                             │
│      • Sections (A-6, A-7, etc.)                               │
│      • Details (A-8+)                                          │
│      • Schedules (S-1, S-2, etc.)                              │
│    - Maintain page order within groups                          │
│    - Assign group metadata (discipline, scale)                  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. CHUNKING ENGINE                                              │
│    - Target size: 2-4k tokens (configurable)                   │
│    - Overlap: 15-20% (300-800 tokens)                          │
│    - Smart boundaries:                                          │
│      • Don't split mid-sheet                                   │
│      • Preserve context windows                                 │
│      • Group related details                                    │
│    - Generate chunk metadata                                    │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. DE-DUPLICATION SAFEGUARDS                                    │
│    - Location-based hashing                                     │
│    - Quantity signature matching                                │
│    - Cross-chunk duplicate detection                            │
│    - Add "do not multiply" hints                                │
│    - Store dedupe metadata                                      │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. PERSISTENCE                                                 │
│     - Save chunks to DB: plan_chunks                            │
│     - Update plan.status = 'processed'                          │
│     - Store processing metadata                                 │
│     - Create indexes for fast retrieval                         │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 11. RESPONSE                                                    │
│     {                                                            │
│       success: true,                                            │
│       planId,                                                    │
│       stats: {                                                   │
│         totalPages,                                              │
│         totalChunks,                                            │
│         sheetIndexCount,                                        │
│         processingTimeMs                                        │
│       },                                                         │
│       sheetIndex: [...],                                        │
│       chunkPreview: [...]                                       │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Security & Reliability

1. **Secure Key Usage**
   - All API keys read from `process.env` (never hardcoded)
   - Supabase service role key used only server-side
   - Signed URLs with short expiration (300s)

2. **Streaming & Memory**
   - Chunked PDF downloads (avoid loading entire file)
   - Streaming parsers where possible
   - Memory limits: max 500MB per PDF

3. **Retry & Backoff**
   - Exponential backoff: 1s, 2s, 4s
   - Max 3 attempts for network operations
   - Graceful degradation (text-only if images fail)

4. **Error Handling**
   - Comprehensive try-catch blocks
   - Detailed error logging
   - User-friendly error messages
   - Partial success handling (save what we can)

---

## SECTION: Data Structures

### TypeScript Interfaces

```typescript
// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Sheet Index Entry - Metadata for each page/sheet in the plan
 */
export interface SheetIndex {
  sheet_id: string                    // Unique identifier (e.g., "A-1", "S-2")
  title: string                       // Sheet title from title block
  discipline: SheetDiscipline          // Architecture, Structural, MEP, etc.
  scale: string | null                // Detected scale (e.g., "1/8\" = 1'-0\"")
  scale_ratio: number | null          // Numeric scale ratio (e.g., 96 for 1/8" = 1'-0")
  units: 'imperial' | 'metric' | null
  page_no: number                     // 1-indexed page number
  sheet_type: SheetType               // Title, Floor Plan, Elevation, etc.
  dimensions?: {                      // Physical sheet dimensions
    width_inches: number
    height_inches: number
  }
  rotation: number                     // Rotation angle (0, 90, 180, 270)
  has_text_layer: boolean             // Whether text extraction succeeded
  has_image: boolean                  // Whether image extraction succeeded
  text_length: number                  // Character count of extracted text
  detected_keywords: string[]         // Keywords found (e.g., ["FOUNDATION", "WALLS"])
}

/**
 * Sheet Discipline Enumeration
 */
export enum SheetDiscipline {
  ARCHITECTURAL = 'architectural',
  STRUCTURAL = 'structural',
  MEP = 'mep',
  ELECTRICAL = 'electrical',
  PLUMBING = 'plumbing',
  HVAC = 'hvac',
  CIVIL = 'civil',
  LANDSCAPE = 'landscape',
  UNKNOWN = 'unknown'
}

/**
 * Sheet Type Enumeration
 */
export enum SheetType {
  TITLE = 'title',
  FLOOR_PLAN = 'floor_plan',
  ELEVATION = 'elevation',
  SECTION = 'section',
  DETAIL = 'detail',
  SCHEDULE = 'schedule',
  LEGEND = 'legend',
  SITE_PLAN = 'site_plan',
  ROOF_PLAN = 'roof_plan',
  OTHER = 'other'
}

/**
 * Plan Set Group - Logical grouping of related sheets
 */
export interface PlanSetGroup {
  group_id: string                    // Unique group identifier
  name: string                        // Human-readable name
  sheet_type: SheetType
  discipline: SheetDiscipline
  page_numbers: number[]               // Array of page numbers in this group
  sheet_ids: string[]                // Array of sheet_id values
  scale: string | null                // Common scale for this group
  description: string                 // Description of what this group contains
}

/**
 * Chunk - A model-ready payload for LLM analysis
 */
export interface Chunk {
  chunk_id: string                    // UUID for this chunk
  plan_id: string                     // Reference to parent plan
  chunk_index: number                 // 0-indexed position in chunk sequence
  page_range: {                       // Pages included in this chunk
    start: number
    end: number
    pages: number[]                  // Array of all page numbers
  }
  sheet_index_subset: SheetIndex[]   // Sheet metadata for pages in chunk
  content: {
    text: string                      // Extracted text content
    text_token_count: number          // Approximate token count
    image_urls: string[]             // Array of Supabase Storage URLs for page images
    image_count: number
  }
  metadata: {
    project_meta: ProjectMeta         // Project-level metadata
    sheet_scale_units: string         // Scale and units summary
    discipline: SheetDiscipline
    anchors: Anchor[]                 // Location anchors for reference
    overlap_info: {                  // Overlap with adjacent chunks
      prev_chunk_id: string | null
      next_chunk_id: string | null
      overlap_tokens: number
    }
  }
  safeguards: {
    dedupe_hash: string              // Hash for duplicate detection
    location_keys: string[]          // Location identifiers
    no_multiply_hints: string[]     // Hints to prevent double-counting
    quantity_signatures: string[]    // Signatures for quantity detection
  }
  created_at: string                 // ISO timestamp
}

/**
 * Project Metadata - High-level project information
 */
export interface ProjectMeta {
  project_name: string | null
  project_location: string | null
  plan_title: string | null
  job_id: string | null
  plan_file_name: string
  total_pages: number
  plan_upload_date: string
  detected_projects: string[]        // Project names found in title sheets
  detected_addresses: string[]       // Addresses found in title sheets
}

/**
 * Anchor - Reference point for locations within a chunk
 */
export interface Anchor {
  anchor_id: string                  // Unique identifier
  type: 'page' | 'sheet_id' | 'grid' | 'reference'
  value: string | number             // The anchor value
  description: string                 // Human-readable description
  page_number: number
  bounding_box?: {                   // Optional visual location
    x: number                        // 0.0 - 1.0 normalized
    y: number
    width: number
    height: number
  }
}

/**
 * Figure Reference - Reference to figures, details, or callouts
 */
export interface FigureRef {
  figure_id: string                  // e.g., "DET-1", "3/A-5"
  sheet_id: string                   // Parent sheet
  page_number: number
  title: string | null
  reference_type: 'detail' | 'section' | 'elevation' | 'schedule'
  referenced_sheets: string[]        // Sheet IDs this figure references
  bounding_box?: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Quantity Row - Extracted quantity information (for dedupe)
 */
export interface QuantityRow {
  quantity_id: string                // Unique identifier
  item_name: string
  quantity: number
  unit: string
  location_key: string              // For dedupe matching
  sheet_ids: string[]               // Which sheets contain this
  page_numbers: number[]
  bounding_boxes: Array<{
    page: number
    x: number
    y: number
    width: number
    height: number
  }>
  signature_hash: string            // Hash for matching duplicates
}

/**
 * Processing Status - Tracks ingestion progress
 */
export interface ProcessingStatus {
  stage: 'queued' | 'downloading' | 'extracting' | 'indexing' | 'chunking' | 'completed' | 'failed'
  progress: number                   // 0-100
  current_step: string              // Human-readable step
  error?: string                    // Error message if failed
  started_at: string
  completed_at?: string
  stats?: {
    pages_processed: number
    sheets_indexed: number
    chunks_created: number
    errors_count: number
  }
}

/**
 * Ingestion Request Payload
 */
export interface IngestionRequest {
  planId: string
  jobId?: string
  options?: {
    target_chunk_size_tokens?: number    // Default: 3000
    overlap_percentage?: number          // Default: 17.5
    max_chunk_size_tokens?: number       // Default: 4000
    min_chunk_size_tokens?: number       // Default: 2000
    enable_dedupe?: boolean              // Default: true
    enable_image_extraction?: boolean    // Default: true
    image_dpi?: number                    // Default: 300
  }
}

/**
 * Ingestion Response
 */
export interface IngestionResponse {
  success: boolean
  planId: string
  stats: {
    totalPages: number
    totalChunks: number
    sheetIndexCount: number
    processingTimeMs: number
    averageChunkSizeTokens: number
    imagesExtracted: number
    textExtracted: boolean
  }
  sheetIndex: SheetIndex[]
  planSetGroups: PlanSetGroup[]
  chunkPreview: Array<{
    chunk_id: string
    chunk_index: number
    page_range: { start: number; end: number }
    token_count: number
    sheet_count: number
  }>
  errors?: string[]
  warnings?: string[]
}
```

---

## SECTION: Endpoints

### POST /api/ingest

**Purpose:** Ingest a plan PDF, extract text/images, build sheet index, and generate chunks.

**Request:**
```typescript
POST /api/ingest
Content-Type: application/json

{
  "planId": "uuid",
  "jobId": "uuid" (optional),
  "options": {
    "target_chunk_size_tokens": 3000,
    "overlap_percentage": 17.5,
    "max_chunk_size_tokens": 4000,
    "min_chunk_size_tokens": 2000,
    "enable_dedupe": true,
    "enable_image_extraction": true,
    "image_dpi": 300
  }
}
```

**Response:**
```typescript
{
  "success": true,
  "planId": "uuid",
  "stats": {
    "totalPages": 45,
    "totalChunks": 18,
    "sheetIndexCount": 45,
    "processingTimeMs": 12450,
    "averageChunkSizeTokens": 3120,
    "imagesExtracted": 45,
    "textExtracted": true
  },
  "sheetIndex": [...],
  "planSetGroups": [...],
  "chunkPreview": [...],
  "errors": [],
  "warnings": []
}
```

**Implementation Sketch:**
```typescript
// app/api/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ingestPlan } from '@/lib/ingestion-engine'

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { planId, jobId, options } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }

    // Verify plan ownership
    const supabase = await createServerSupabaseClient()
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Check if already processed
    const { data: existingChunks } = await supabase
      .from('plan_chunks')
      .select('chunk_id')
      .eq('plan_id', planId)
      .limit(1)

    if (existingChunks && existingChunks.length > 0) {
      return NextResponse.json(
        { error: 'Plan already processed. Use /api/chunks/[jobId] to retrieve.' },
        { status: 409 }
      )
    }

    // Update status to processing
    await supabase
      .from('plans')
      .update({ 
        status: 'processing',
        processing_status: {
          stage: 'queued',
          progress: 0,
          current_step: 'Initializing ingestion',
          started_at: new Date().toISOString()
        }
      })
      .eq('id', planId)

    // Run ingestion
    const result = await ingestPlan(plan, user.id, jobId, options)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Ingestion error:', error)
    return NextResponse.json(
      { 
        error: 'Ingestion failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
```

### GET /api/chunks/[jobId]

**Purpose:** Retrieve chunks for a specific job, with optional filtering.

**Request:**
```
GET /api/chunks/[jobId]?planId=uuid&page=1&limit=10&discipline=architectural
```

**Query Parameters:**
- `planId` (optional): Filter by specific plan
- `page` (optional): Pagination page number (default: 1)
- `limit` (optional): Chunks per page (default: 50, max: 100)
- `discipline` (optional): Filter by discipline
- `sheet_type` (optional): Filter by sheet type
- `include_images` (optional): Include image URLs (default: true)

**Response:**
```typescript
{
  "success": true,
  "chunks": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 18,
    "totalPages": 1
  },
  "stats": {
    "totalChunks": 18,
    "totalPages": 45,
    "disciplineBreakdown": {
      "architectural": 12,
      "structural": 4,
      "mep": 2
    }
  }
}
```

**Implementation Sketch:**
```typescript
// app/api/chunks/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { jobId } = await params
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const discipline = searchParams.get('discipline')
    const sheetType = searchParams.get('sheet_type')
    const includeImages = searchParams.get('include_images') !== 'false'

    const supabase = await createServerSupabaseClient()

    // Build query
    let query = supabase
      .from('plan_chunks')
      .select('*, plans!inner(job_id, user_id)')
      .eq('plans.job_id', jobId)
      .eq('plans.user_id', user.id)

    if (planId) {
      query = query.eq('plan_id', planId)
    }

    if (discipline) {
      query = query.eq('metadata->>discipline', discipline)
    }

    if (sheetType) {
      query = query.contains('sheet_index_subset', [{ sheet_type: sheetType }])
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order('chunk_index', { ascending: true })

    const { data: chunks, error, count } = await query

    if (error) throw error

    // Remove image URLs if not requested
    const processedChunks = includeImages 
      ? chunks 
      : chunks?.map(chunk => ({
          ...chunk,
          content: {
            ...chunk.content,
            image_urls: [],
            image_count: chunk.content.image_count
          }
        }))

    return NextResponse.json({
      success: true,
      chunks: processedChunks,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      stats: {
        totalChunks: count || 0,
        // ... additional stats
      }
    })

  } catch (error) {
    console.error('Chunk retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve chunks' },
      { status: 500 }
    )
  }
}
```

---

## SECTION: Libraries & Snippets

### Required Dependencies

Add to `package.json`:
```json
{
  "dependencies": {
    "pdfjs-dist": "^5.3.93",
    "pdf2json": "^3.2.2",
    "canvas": "^2.11.2",
    "sharp": "^0.33.0"
  },
  "devDependencies": {
    "@types/pdf2json": "^1.1.4"
  }
}
```

### PDF Text Extraction (Per-Page)

```typescript
// lib/ingestion/pdf-text-extractor.ts
import PDFParser from 'pdf2json'
import * as pdfjsLib from 'pdfjs-dist'

export interface PageText {
  pageNumber: number
  text: string
  textItems: Array<{
    text: string
    x: number
    y: number
    fontSize: number
    fontName?: string
  }>
}

export async function extractTextPerPage(buffer: Buffer): Promise<PageText[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1)

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`PDF parse error: ${errData.parserError}`))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        const pages: PageText[] = []

        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            const pageText: PageText = {
              pageNumber: pageIndex + 1,
              text: '',
              textItems: []
            }

            if (page.Texts) {
              // Sort by Y (top to bottom), then X (left to right)
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                const yDiff = b.y - a.y  // Higher Y = top of page
                if (Math.abs(yDiff) > 0.5) return yDiff
                return a.x - b.x
              })

              sortedTexts.forEach((textItem: any) => {
                if (textItem.R) {
                  textItem.R.forEach((r: any) => {
                    if (r.T) {
                      const decodedText = decodeURIComponent(r.T)
                      pageText.text += decodedText + ' '
                      pageText.textItems.push({
                        text: decodedText,
                        x: textItem.x || 0,
                        y: textItem.y || 0,
                        fontSize: r.TS?.[1] || 12,
                        fontName: r.TS?.[0]
                      })
                    }
                  })
                }
              })
            }

            pages.push(pageText)
          })
        }

        resolve(pages)
      } catch (error) {
        reject(error)
      }
    })

    pdfParser.parseBuffer(buffer)
  })
}
```

### PDF Image Extraction (Raster per Page)

```typescript
// lib/ingestion/pdf-image-extractor.ts
import * as pdfjsLib from 'pdfjs-dist'
import { createCanvas } from 'canvas'
import sharp from 'sharp'

// Configure pdfjs worker (server-side)
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.js')

export interface PageImage {
  pageNumber: number
  imageBuffer: Buffer
  width: number
  height: number
  dpi: number
}

export async function extractImagesPerPage(
  buffer: Buffer,
  dpi: number = 300
): Promise<PageImage[]> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const numPages = pdf.numPages
  const pages: PageImage[] = []

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: dpi / 72 }) // 72 DPI is default PDF DPI

    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')

    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }

    await page.render(renderContext).promise

    // Convert canvas to PNG buffer
    const imageBuffer = canvas.toBuffer('image/png')

    // Optimize with sharp (optional compression)
    const optimizedBuffer = await sharp(imageBuffer)
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer()

    pages.push({
      pageNumber: pageNum,
      imageBuffer: optimizedBuffer,
      width: viewport.width,
      height: viewport.height,
      dpi
    })
  }

  return pages
}
```

### Sheet Index Builder

```typescript
// lib/ingestion/sheet-index-builder.ts
import { SheetIndex, SheetDiscipline, SheetType } from '@/types/ingestion'

export async function buildSheetIndex(
  pageTexts: Array<{ pageNumber: number; text: string }>,
  totalPages: number
): Promise<SheetIndex[]> {
  const sheetIndex: SheetIndex[] = []

  for (const pageText of pageTexts) {
    const sheet = await analyzeSheet(pageText, totalPages)
    sheetIndex.push(sheet)
  }

  return sheetIndex
}

async function analyzeSheet(
  pageText: { pageNumber: number; text: string },
  totalPages: number
): Promise<SheetIndex> {
  const text = pageText.text.toUpperCase()
  
  // Extract sheet ID (common patterns: A-1, S-2, E-3, etc.)
  const sheetIdMatch = text.match(/([A-Z]+)\s*[-\.]?\s*(\d+)/)
  const sheetId = sheetIdMatch 
    ? `${sheetIdMatch[1]}-${sheetIdMatch[2]}`
    : `PAGE-${pageText.pageNumber}`

  // Detect sheet type
  const sheetType = detectSheetType(text, pageText.pageNumber, totalPages)

  // Detect discipline
  const discipline = detectDiscipline(text, sheetId)

  // Extract scale (common patterns: 1/8" = 1'-0", 1:100, etc.)
  const scaleMatch = text.match(/(\d+\/\d+"?\s*=\s*\d+'?\s*-?\s*\d+")|(1:\d+)|(SCALE[\s:]+[\d/"]+)/i)
  const scale = scaleMatch ? scaleMatch[0] : null
  const scaleRatio = scale ? parseScaleRatio(scale) : null

  // Detect units (imperial vs metric)
  const units = detectUnits(text, scale)

  // Extract title (typically in title block)
  const titleMatch = text.match(/(FLOOR PLAN|ELEVATION|SECTION|DETAIL|SCHEDULE|TITLE)[\s\w]*/i)
  const title = titleMatch ? titleMatch[0] : `Sheet ${pageText.pageNumber}`

  // Extract keywords
  const keywords = extractKeywords(text)

  return {
    sheet_id: sheetId,
    title,
    discipline,
    scale,
    scale_ratio: scaleRatio,
    units,
    page_no: pageText.pageNumber,
    sheet_type: sheetType,
    rotation: 0, // TODO: Detect rotation from PDF metadata
    has_text_layer: pageText.text.length > 0,
    has_image: true, // Assumed if we're processing
    text_length: pageText.text.length,
    detected_keywords: keywords
  }
}

function detectSheetType(text: string, pageNum: number, totalPages: number): SheetType {
  const upper = text.toUpperCase()

  if (pageNum === 1 || upper.includes('TITLE') || upper.includes('COVER')) {
    return SheetType.TITLE
  }
  if (upper.includes('FLOOR PLAN') || upper.includes('FLOORPLAN')) {
    return SheetType.FLOOR_PLAN
  }
  if (upper.includes('ELEVATION') || upper.includes('ELEV')) {
    return SheetType.ELEVATION
  }
  if (upper.includes('SECTION')) {
    return SheetType.SECTION
  }
  if (upper.includes('DETAIL') || upper.includes('DET')) {
    return SheetType.DETAIL
  }
  if (upper.includes('SCHEDULE') || upper.includes('SCH')) {
    return SheetType.SCHEDULE
  }
  if (upper.includes('LEGEND')) {
    return SheetType.LEGEND
  }
  if (upper.includes('SITE PLAN') || upper.includes('SITE')) {
    return SheetType.SITE_PLAN
  }
  if (upper.includes('ROOF PLAN') || upper.includes('ROOF')) {
    return SheetType.ROOF_PLAN
  }

  return SheetType.OTHER
}

function detectDiscipline(text: string, sheetId: string): SheetDiscipline {
  const upper = text.toUpperCase()
  const idUpper = sheetId.toUpperCase()

  if (idUpper.startsWith('A-') || upper.includes('ARCHITECTURAL')) {
    return SheetDiscipline.ARCHITECTURAL
  }
  if (idUpper.startsWith('S-') || upper.includes('STRUCTURAL')) {
    return SheetDiscipline.STRUCTURAL
  }
  if (idUpper.startsWith('E-') || upper.includes('ELECTRICAL')) {
    return SheetDiscipline.ELECTRICAL
  }
  if (idUpper.startsWith('P-') || upper.includes('PLUMBING')) {
    return SheetDiscipline.PLUMBING
  }
  if (idUpper.startsWith('M-') || upper.includes('MECHANICAL') || upper.includes('HVAC')) {
    return SheetDiscipline.HVAC
  }
  if (idUpper.startsWith('C-') || upper.includes('CIVIL')) {
    return SheetDiscipline.CIVIL
  }
  if (upper.includes('LANDSCAPE') || upper.includes('L-')) {
    return SheetDiscipline.LANDSCAPE
  }

  return SheetDiscipline.UNKNOWN
}

function parseScaleRatio(scaleStr: string): number | null {
  // Parse "1/8" = 1'-0"" to 96 (1 inch = 8 feet = 96 inches)
  // Parse "1:100" to 100
  const imperialMatch = scaleStr.match(/(\d+)\/(\d+)"?\s*=\s*(\d+)'/)
  if (imperialMatch) {
    const num = parseInt(imperialMatch[1])
    const den = parseInt(imperialMatch[2])
    const feet = parseInt(imperialMatch[3])
    return (feet * 12) / (num / den)
  }

  const metricMatch = scaleStr.match(/1:(\d+)/)
  if (metricMatch) {
    return parseInt(metricMatch[1])
  }

  return null
}

function detectUnits(text: string, scale: string | null): 'imperial' | 'metric' | null {
  const upper = text.toUpperCase()
  
  if (upper.includes("'") || upper.includes('"') || scale?.includes('=')) {
    return 'imperial'
  }
  if (upper.includes('MM') || upper.includes('CM') || upper.includes('M') || scale?.includes(':')) {
    return 'metric'
  }

  return null
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = []
  const upper = text.toUpperCase()

  const keywordPatterns = [
    'FOUNDATION', 'WALLS', 'ROOF', 'FLOOR', 'CEILING',
    'DOOR', 'WINDOW', 'DOORS', 'WINDOWS',
    'ELECTRICAL', 'PLUMBING', 'HVAC', 'MEP',
    'SCHEDULE', 'LEGEND', 'NOTES', 'SPECIFICATIONS'
  ]

  keywordPatterns.forEach(pattern => {
    if (upper.includes(pattern)) {
      keywords.push(pattern)
    }
  })

  return keywords
}
```

### Chunking Engine

```typescript
// lib/ingestion/chunking-engine.ts
import { Chunk, SheetIndex, ProjectMeta } from '@/types/ingestion'

const DEFAULT_TARGET_TOKENS = 3000
const DEFAULT_OVERLAP_PERCENT = 17.5
const TOKENS_PER_CHAR = 0.25 // Approximate: 4 chars per token

export interface ChunkingOptions {
  targetChunkSizeTokens?: number
  overlapPercentage?: number
  maxChunkSizeTokens?: number
  minChunkSizeTokens?: number
}

export async function generateChunks(
  pageTexts: Array<{ pageNumber: number; text: string }>,
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
    currentChunk.text += `\n\n=== PAGE ${pageText.pageNumber} (${sheet.sheet_id}) ===\n\n${pageText.text}`
    currentChunk.pages.push(pageText.pageNumber)
    currentChunk.sheetIndices.push(sheet)
    currentChunk.tokenCount += pageTokenCount

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
  if (currentChunk.tokenCount > 0) {
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
  const chunkId = `chunk_${Date.now()}_${chunkIndex}`
  
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

function extractOverlapText(text: string, targetTokens: number): string {
  const targetChars = Math.floor(targetTokens / TOKENS_PER_CHAR)
  // Extract last N characters, but try to end at sentence boundary
  const endSlice = text.slice(-targetChars)
  const lastPeriod = endSlice.lastIndexOf('.')
  const lastNewline = endSlice.lastIndexOf('\n')
  const cutoff = Math.max(lastPeriod, lastNewline)
  
  return cutoff > 0 ? text.slice(-targetChars + cutoff) : text.slice(-targetChars)
}

function generateDedupeHash(text: string, pages: number[]): string {
  // Simple hash combining text signature and page numbers
  const crypto = require('crypto')
  const signature = `${pages.join(',')}:${text.slice(0, 500)}`
  return crypto.createHash('sha256').update(signature).digest('hex').slice(0, 16)
}

function extractQuantitySignatures(text: string): string[] {
  // Extract patterns like "QTY: 5" or "COUNT: 10"
  const signatures: string[] = []
  const qtyMatches = text.matchAll(/(?:QTY|QUANTITY|COUNT)[\s:]+(\d+)/gi)
  for (const match of qtyMatches) {
    signatures.push(`qty_${match[1]}`)
  }
  return signatures
}

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

function summarizeScales(sheets: SheetIndex[]): string {
  const scales = sheets
    .map(s => s.scale)
    .filter((s): s is string => s !== null)
  const uniqueScales = [...new Set(scales)]
  return uniqueScales.length > 0 
    ? uniqueScales.join(', ') 
    : 'Scale not detected'
}

function generateAnchors(pages: number[], sheets: SheetIndex[]): Anchor[] {
  return sheets.map((sheet, idx) => ({
    anchor_id: `anchor_${sheet.sheet_id}`,
    type: 'sheet_id',
    value: sheet.sheet_id,
    description: `Sheet ${sheet.sheet_id}: ${sheet.title}`,
    page_number: sheet.page_no
  }))
}
```

---

## SECTION: Test Plan

### Synthetic 5-Page Sample PDF

**Test Document Structure:**

1. **Page 1: Title Sheet**
   - Title block: "Project ABC - Site Development"
   - Sheet ID: "A-0"
   - Scale: "1" = 40'-0""
   - Project name, address, general notes

2. **Page 2: Floor Plan - First Floor**
   - Sheet ID: "A-1"
   - Scale: "1/8" = 1'-0""
   - Dimensions: 40' x 30' building
   - Notes: "See Schedule A-1 for door types"

3. **Page 3: Door & Window Schedule**
   - Sheet ID: "S-1"
   - Scale: N/A (schedule)
   - Door schedule with quantities (e.g., "TYPE A: 12 EA")

4. **Page 4: Wall Section Detail**
   - Sheet ID: "A-8"
   - Scale: "1" = 1'-0""
   - Detail callout: "DET-1"
   - References: "See A-1 for location"

5. **Page 5: Foundation Plan**
   - Sheet ID: "S-2"
   - Scale: "1/4" = 1'-0""
   - Foundation dimensions and notes

**Expected Results:**

- Sheet Index: 5 entries with correct sheet IDs, types, disciplines, scales
- Chunks: 2-3 chunks (depending on text length) with proper overlap
- Dedupe: Door quantities from schedule should not double-count with floor plan
- Anchors: References to other sheets properly captured

### Edge Cases

#### 1. Rotated Sheets
- **Test:** PDF with page rotated 90° in metadata
- **Expected:** Sheet index detects rotation, chunking preserves context
- **Handling:** Use PDF page rotation metadata, adjust text/image extraction

#### 2. Missing Scales
- **Test:** Page with no scale annotation
- **Expected:** `scale: null`, `scale_ratio: null`, warning logged
- **Handling:** Fallback to common scales based on sheet type, or mark as unknown

#### 3. Scanned PDFs (Image-Only)
- **Test:** PDF with no text layer (pure scanned images)
- **Expected:** `has_text_layer: false`, image extraction succeeds, OCR fallback if available
- **Handling:** Use image extraction, consider OCR integration for text

#### 4. Very Large PDFs (200+ pages)
- **Test:** 250-page plan set
- **Expected:** Processing completes, chunks generated, memory stays within limits
- **Handling:** Stream processing, batch operations, progress tracking

#### 5. Duplicate Sheet IDs
- **Test:** Multiple pages with same sheet ID (e.g., "A-1" appears twice)
- **Expected:** Both indexed, dedupe logic handles gracefully
- **Handling:** Append page number to sheet_id if duplicate detected

#### 6. Mixed Units (Imperial + Metric)
- **Test:** Some sheets imperial, some metric
- **Expected:** Units detected per-sheet, chunks preserve unit info
- **Handling:** Detect per-sheet, warn if inconsistent within plan set

#### 7. No Title Block
- **Test:** Page with no standard title block format
- **Expected:** Default title generated, sheet_id derived from page number
- **Handling:** Fallback to "PAGE-N" format, attempt extraction from text

#### 8. Empty Pages
- **Test:** PDF with blank pages
- **Expected:** Page indexed but marked as empty, skipped in chunking if no content
- **Handling:** Detect empty pages, exclude from chunks, log warning

---

## SECTION: Checklist

### Phase 1: Setup & Infrastructure

- [ ] Install dependencies: `canvas`, `sharp` (add to package.json)
- [ ] Create database tables:
  - [ ] `plan_sheet_index` (columns: plan_id, sheet_id, title, discipline, scale, etc.)
  - [ ] `plan_chunks` (columns: chunk_id, plan_id, chunk_index, content JSONB, metadata JSONB, etc.)
- [ ] Create TypeScript type definitions in `types/ingestion.ts`
- [ ] Set up environment variables verification in ingestion route

### Phase 2: Core Extraction

- [ ] Implement PDF text extraction (`lib/ingestion/pdf-text-extractor.ts`)
  - [ ] Test with 5-page sample PDF
  - [ ] Verify per-page text extraction
  - [ ] Handle encoding issues
- [ ] Implement PDF image extraction (`lib/ingestion/pdf-image-extractor.ts`)
  - [ ] Test canvas rendering (300 DPI)
  - [ ] Test image upload to Supabase Storage
  - [ ] Verify image URLs are accessible
- [ ] Implement retry/backoff logic for Supabase Storage operations
- [ ] Test with edge cases: rotated sheets, scanned PDFs, missing scales

### Phase 3: Sheet Index Building

- [ ] Implement sheet index builder (`lib/ingestion/sheet-index-builder.ts`)
  - [ ] Sheet ID extraction (A-1, S-2, etc.)
  - [ ] Sheet type detection
  - [ ] Discipline detection
  - [ ] Scale parsing (imperial & metric)
  - [ ] Units detection
- [ ] Test with synthetic 5-page PDF
- [ ] Handle edge cases: duplicate sheet IDs, missing title blocks
- [ ] Persist sheet index to database

### Phase 4: Chunking Engine

- [ ] Implement chunking engine (`lib/ingestion/chunking-engine.ts`)
  - [ ] Token counting (approximate)
  - [ ] Target size logic (2-4k tokens)
  - [ ] Overlap generation (15-20%)
  - [ ] Plan set grouping
  - [ ] Smart boundary detection (don't split mid-sheet)
- [ ] Implement deduplication safeguards
  - [ ] Location-based hashing
  - [ ] Quantity signature matching
  - [ ] "No multiply" hints
- [ ] Test chunking with 5-page sample (verify 2-3 chunks created)
- [ ] Test with larger PDF (45+ pages, verify ~18 chunks)

### Phase 5: API Endpoints

- [ ] Implement `POST /api/ingest` route
  - [ ] Authentication check
  - [ ] Plan ownership verification
  - [ ] Status updates (queued → processing → completed)
  - [ ] Error handling & logging
  - [ ] Response formatting
- [ ] Implement `GET /api/chunks/[jobId]` route
  - [ ] Authentication check
  - [ ] Filtering (planId, discipline, sheet_type)
  - [ ] Pagination
  - [ ] Optional image URL inclusion
- [ ] Test endpoints with Postman/curl
- [ ] Add request validation & error responses

### Phase 6: Database Schema & Persistence

- [ ] Create migration SQL for new tables
  - [ ] `plan_sheet_index` with indexes
  - [ ] `plan_chunks` with indexes
  - [ ] Foreign key constraints
- [ ] Implement chunk persistence logic
- [ ] Implement sheet index persistence logic
- [ ] Test database operations (insert, query, update)

### Phase 7: Integration & Testing

- [ ] End-to-end test: Upload PDF → Ingest → Retrieve chunks
- [ ] Test with real architectural plan (20-50 pages)
- [ ] Verify chunk quality:
  - [ ] Token counts within target range
  - [ ] Overlap working correctly
  - [ ] Sheet metadata preserved
  - [ ] Images accessible
- [ ] Performance testing:
  - [ ] 50-page PDF ingestion time < 2 minutes
  - [ ] Memory usage < 500MB
  - [ ] Concurrent ingestion (2-3 plans)
- [ ] Error recovery testing:
  - [ ] Network failures (retry logic)
  - [ ] Invalid PDFs (graceful error)
  - [ ] Storage quota exceeded

### Phase 8: Documentation & Deployment

- [ ] Update API documentation
- [ ] Add code comments to complex functions
- [ ] Create README for ingestion system
- [ ] Document environment variables needed
- [ ] Prepare deployment checklist
- [ ] Test in staging environment
- [ ] Monitor first production ingestion

### Phase 9: Optimization & Monitoring

- [ ] Add processing time logging
- [ ] Add error tracking (Sentry or similar)
- [ ] Optimize image compression (reduce storage costs)
- [ ] Cache sheet index for repeated queries
- [ ] Monitor database query performance
- [ ] Set up alerts for failed ingestions

### Phase 10: Advanced Features (Future)

- [ ] OCR integration for scanned PDFs
- [ ] Automatic figure reference extraction
- [ ] Cross-chunk quantity deduplication
- [ ] Chunk versioning (for re-processing)
- [ ] Batch ingestion API
- [ ] Webhook notifications on completion

---

## Implementation Notes

### Database Schema (SQL)

```sql
-- Plan Sheet Index Table
CREATE TABLE IF NOT EXISTS plan_sheet_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  sheet_id TEXT NOT NULL,
  title TEXT,
  discipline TEXT NOT NULL,
  scale TEXT,
  scale_ratio NUMERIC,
  units TEXT CHECK (units IN ('imperial', 'metric')),
  page_no INTEGER NOT NULL,
  sheet_type TEXT NOT NULL,
  rotation INTEGER DEFAULT 0,
  has_text_layer BOOLEAN DEFAULT FALSE,
  has_image BOOLEAN DEFAULT FALSE,
  text_length INTEGER DEFAULT 0,
  detected_keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, sheet_id)
);

CREATE INDEX idx_sheet_index_plan_id ON plan_sheet_index(plan_id);
CREATE INDEX idx_sheet_index_sheet_id ON plan_sheet_index(sheet_id);
CREATE INDEX idx_sheet_index_discipline ON plan_sheet_index(discipline);

-- Plan Chunks Table
CREATE TABLE IF NOT EXISTS plan_chunks (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_range JSONB NOT NULL,
  sheet_index_subset JSONB NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB NOT NULL,
  safeguards JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, chunk_index)
);

CREATE INDEX idx_chunks_plan_id ON plan_chunks(plan_id);
CREATE INDEX idx_chunks_chunk_index ON plan_chunks(plan_id, chunk_index);
CREATE INDEX idx_chunks_metadata ON plan_chunks USING GIN(metadata);
```

### Environment Variables Required

```bash
# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Optional: For service role operations (if needed)
SUPABASE_SERVICE_ROLE_KEY=...

# Storage bucket name (default: job-plans)
SUPABASE_STORAGE_BUCKET=job-plans
```

---

## Success Metrics

- **Accuracy:** Sheet index correctly identifies 95%+ of sheet IDs and types
- **Performance:** 50-page PDF ingested in < 2 minutes
- **Quality:** Chunks average 3000 tokens with 17.5% overlap
- **Reliability:** 99%+ successful ingestion rate (retries included)
- **Storage:** Images compressed to < 2MB per page (300 DPI PNG)

---

**END OF SPEC**

