/**
 * Ingestion & Chunking System Type Definitions
 * 
 * This file contains all TypeScript interfaces and enums for the PDF ingestion
 * and chunking pipeline.
 */

// ============================================================================
// ENUMS
// ============================================================================

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
 * Project Metadata - High-level project information
 */
export interface ProjectMeta {
  plan_id?: string                    // Reference to plan UUID
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

/**
 * Chunking Options
 */
export interface ChunkingOptions {
  targetChunkSizeTokens?: number
  overlapPercentage?: number
  maxChunkSizeTokens?: number
  minChunkSizeTokens?: number
}

/**
 * Page Text Data
 */
export interface PageText {
  pageNumber: number
  text: string
  textItems?: Array<{
    text: string
    x: number
    y: number
    fontSize: number
    fontName?: string
  }>
}

/**
 * Page Image Data
 */
export interface PageImage {
  pageNumber: number
  imageBuffer: Buffer
  width: number
  height: number
  dpi: number
  storageUrl?: string              // Set after upload to Supabase
}

