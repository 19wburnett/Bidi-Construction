/**
 * Multi-Industry Takeoff Orchestrator
 * 
 * Two-stage pipeline for automated plan takeoffs:
 * 1. SCOPING: Ask minimal questions, synthesize normalized segmentation plan
 * 2. EXECUTION: Process each segment in batches, merge/deduplicate
 * 
 * OUTPUT: Arrays-only mode - returns exactly 4 arrays:
 * [TAKEOFF[], ANALYSIS[], SEGMENTS[], RUN_LOG[]]
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { extractImageUrlsOnly } from '@/lib/ingestion/pdf-image-extractor'
import { extractTextPerPage } from '@/lib/ingestion/pdf-text-extractor'
import { extractAnalysisPayload } from '@/lib/json/repair'
import { enhancedAIProvider } from '@/lib/enhanced-ai-providers'
import type { EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'
import { buildTakeoffSystemPrompt, buildTakeoffUserPrompt } from '@/lib/takeoff-prompts'
import PDFParser from 'pdf2json'

// ============================================================================
// TYPES
// ============================================================================

export interface MultiIndustryTakeoffInput {
  pdf_urls: string[]
  job_context: {
    project_name: string
    location: string
    building_type: 'residential' | 'commercial' | 'industrial' | 'institutional' | string
    notes?: string
  }
  ask_scoping_questions: boolean
  page_batch_size?: number // default 5
  max_parallel_batches?: number // default 2
  currency?: string // default "USD"
  unit_cost_policy?: 'estimate' | 'lookup' | 'mixed'
  prior_segments?: Array<{
    industry: string
    categories: string[]
  }>
  plan_id?: string
  plan_metadata?: {
    file_path: string
    project_name?: string | null
    project_location?: string | null
    job_type?: string | null
    additional_urls?: string[]
  }
}

export interface SegmentPlan {
  industry: string
  categories: string[]
  priority: number
}

export interface TakeoffItem {
  name: string
  description: string
  quantity: number
  unit: 'LF' | 'SF' | 'CF' | 'CY' | 'EA' | 'SQ'
  unit_cost: number
  unit_cost_source: 'model_estimate' | 'lookup_pending' | 'provided'
  unit_cost_notes?: string
  location: string
  industry: string
  category: string
  subcategory: string
  cost_code: string
  cost_code_description: string
  dimensions: string
  bounding_box: {
    x: number
    y: number
    width: number
    height: number
    page: number
  }
  page_refs: Array<{
    pdf: string
    page: number
  }>
  confidence: number
  notes?: string
}

export interface AnalysisItem {
  type: 'code_issue' | 'conflict' | 'rfi'
  title?: string // for code_issue
  question?: string // for rfi
  description: string
  sheet?: string
  pages: number[]
  bounding_box: {
    x: number
    y: number
    width: number
    height: number
    page: number
  }
  severity?: 'low' | 'medium' | 'high' | 'critical' // for code_issue/conflict
  priority?: 'low' | 'medium' | 'high' // for rfi
  recommendation?: string
  confidence: number
}

export interface SegmentResult {
  industry: string
  categories: string[]
  summary: {
    totals_by_cost_code: Array<{
      cost_code: string
      description: string
      quantity: number
      unit: string
      est_cost: number
    }>
    top_risks: string[]
    pages_processed: number
    pages_failed: number
  }
  items_count: number
  analysis_count: number
}

export interface RunLogEntry {
  type: 'info' | 'warn' | 'error'
  message: string
  pdf?: string
  page_batch?: [number, number]
}

export type MultiIndustryTakeoffOutput = [
  TakeoffItem[], // TAKEOFF array
  AnalysisItem[], // ANALYSIS array
  SegmentResult[], // SEGMENTS array
  RunLogEntry[] // RUN LOG array
]

// ============================================================================
// MULTI-INDUSTRY TAKEOFF ORCHESTRATOR
// ============================================================================

export class MultiIndustryTakeoffOrchestrator {
  private supabase: any
  private runLog: RunLogEntry[] = []

  constructor(supabase?: any) {
    this.supabase = supabase
  }

  /**
   * Main entry point: Run the two-stage pipeline
   */
  async execute(input: MultiIndustryTakeoffInput): Promise<MultiIndustryTakeoffOutput> {
    // Initialize supabase if not set
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient()
    }

    this.runLog = []
    this.log('info', 'Starting multi-industry takeoff pipeline')

    try {
      // STAGE 1: SCOPING
      let segments: SegmentPlan[] = []
      
      if (input.ask_scoping_questions && (!input.prior_segments || input.prior_segments.length === 0)) {
        this.log('info', 'Running scoping stage: asking questions')
        segments = await this.runScopingStage(input)
      } else if (input.prior_segments && input.prior_segments.length > 0) {
        // Use provided segments
        segments = input.prior_segments.map((s, idx) => ({
          industry: s.industry,
          categories: s.categories,
          priority: idx + 1
        }))
        this.log('info', `Using ${segments.length} provided segments`)
      } else {
        // Default: all industries
        segments = this.getDefaultSegments()
        this.log('info', 'Using default segments (all industries)')
      }

      // STAGE 2: EXECUTION
      this.log('info', `Executing ${segments.length} segments`)
      const result = await this.runExecutionStage(input, segments)

      // Validate and return arrays-only output
      return this.formatArraysOnlyOutput(result)

    } catch (error) {
      this.log('error', `Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Return partial results if available
      return this.formatArraysOnlyOutput({
        takeoff: [],
        analysis: [],
        segments: [],
        runLog: this.runLog
      })
    }
  }

  /**
   * STAGE 1: SCOPING - Ask questions and generate segment plan
   * 
   * If ask_scoping_questions is true, this will analyze sample pages and either:
   * 1. Return suggested segments if the project scope is clear
   * 2. Return questions to ask the user if more information is needed
   * 
   * For now, we'll analyze and return segments directly. In a full implementation,
   * you'd return questions and wait for user response.
   */
  private async runScopingStage(input: MultiIndustryTakeoffInput): Promise<SegmentPlan[]> {
    // Sample a few pages from PDFs to understand the project
    const samplePages = await this.samplePagesFromPDFs(input.pdf_urls, 3)

    if (samplePages.length === 0) {
      this.log('warn', 'No sample pages available, using default segments')
      return this.getDefaultSegments()
    }

    const scopingPrompt = this.buildScopingPrompt(input, samplePages)
    
    const options: EnhancedAnalysisOptions = {
      maxTokens: 2048,
      temperature: 0.3,
      systemPrompt: scopingPrompt.system,
      userPrompt: scopingPrompt.user,
      taskType: 'takeoff'
    }

    // Call AI for scoping
    const imageUrls = samplePages.flatMap(p => p.imageUrl ? [p.imageUrl] : [])
    
    if (imageUrls.length === 0) {
      this.log('warn', 'No images available for scoping, using default segments')
      return this.getDefaultSegments()
    }

    const results = await enhancedAIProvider.analyzeWithSpecializedModels(imageUrls, options)
    
    if (results.length === 0) {
      this.log('warn', 'Scoping stage failed, using default segments')
      return this.getDefaultSegments()
    }

    // Parse scoping response
    const response = results[0].content
    const parsed = this.parseScopingResponse(response)
    
    if (parsed.length === 0) {
      this.log('warn', 'Could not parse scoping response, using default segments')
      return this.getDefaultSegments()
    }

    this.log('info', `Scoping identified ${parsed.length} segments`)
    return parsed
  }

  /**
   * STAGE 2: EXECUTION - Process each segment
   */
  private async runExecutionStage(
    input: MultiIndustryTakeoffInput,
    segments: SegmentPlan[]
  ): Promise<{
    takeoff: TakeoffItem[]
    analysis: AnalysisItem[]
    segments: SegmentResult[]
    runLog: RunLogEntry[]
  }> {
    // If we have plan metadata (plan-driven path), reuse enhanced consensus pipeline
    if (input.plan_metadata?.file_path) {
      return this.runConsensusExecutionStage(input, segments)
    }

    const allTakeoffItems: TakeoffItem[] = []
    const allAnalysisItems: AnalysisItem[] = []
    const segmentResults: SegmentResult[] = []

    const batchSize = input.page_batch_size || 5
    const maxParallel = input.max_parallel_batches || 2

    // Process segments in priority order
    for (const segment of segments.sort((a, b) => a.priority - b.priority)) {
      this.log('info', `Processing segment: ${segment.industry} (${segment.categories.join(', ')})`)

      try {
        const segmentResult = await this.processSegment(
          input,
          segment,
          batchSize,
          maxParallel
        )

        allTakeoffItems.push(...segmentResult.takeoff)
        allAnalysisItems.push(...segmentResult.analysis)
        segmentResults.push(segmentResult.summary)

      } catch (error) {
        this.log('error', `Segment ${segment.industry} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        segmentResults.push({
          industry: segment.industry,
          categories: segment.categories,
          summary: {
            totals_by_cost_code: [],
            top_risks: ['Segment processing failed'],
            pages_processed: 0,
            pages_failed: 0
          },
          items_count: 0,
          analysis_count: 0
        })
      }
    }

    // Deduplicate and merge items
    const deduplicatedTakeoff = this.deduplicateItems(allTakeoffItems)
    const deduplicatedAnalysis = this.deduplicateAnalysis(allAnalysisItems)

    return {
      takeoff: deduplicatedTakeoff,
      analysis: deduplicatedAnalysis,
      segments: segmentResults,
      runLog: this.runLog
    }
  }

  private async runConsensusExecutionStage(
    input: MultiIndustryTakeoffInput,
    segments: SegmentPlan[]
  ): Promise<{
    takeoff: TakeoffItem[]
    analysis: AnalysisItem[]
    segments: SegmentResult[]
    runLog: RunLogEntry[]
  }> {
    const images: string[] = []
    const additionalPdfUrls = input.plan_metadata?.additional_urls || []
    const allPdfUrls = [...input.pdf_urls, ...additionalPdfUrls]
    let extractedTextCombined = ''
    let totalPages = 0

    for (const url of allPdfUrls) {
      try {
        this.log('info', `Fetching PDF for consensus: ${url}`)
        const response = await fetch(url)

        if (!response.ok) {
          this.log('warn', `Failed to fetch PDF (${response.status}) for ${url}`)
          continue
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.toLowerCase().includes('pdf')) {
          this.log('warn', `Skipping non-PDF url during consensus ingestion: ${url} (${contentType || 'unknown content-type'})`)
          continue
        }

        const buffer = Buffer.from(await response.arrayBuffer())

        const text = await this.extractTextFromPDF(buffer)
        if (text) {
          extractedTextCombined += `${text}\n\n`
        }

        const imageUrls = await this.convertPDFToImages(buffer, 'plan.pdf')

        if (!imageUrls || imageUrls.length === 0) {
          this.log('warn', `PDF conversion returned no images for ${url}`)
          continue
        }

        images.push(...imageUrls)
        totalPages += imageUrls.length
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        this.log('warn', `Failed to prepare PDF ${url}: ${message}`)
      }
    }

    if (images.length === 0) {
      throw new Error('No valid PDF pages available after preprocessing. Ensure the plan PDF is accessible.')
    }

    const { systemPrompt, userPrompt } = this.buildConsensusPrompts(
      input,
      segments,
      images.length,
      extractedTextCombined
    )

    const analysisOptions: EnhancedAnalysisOptions = {
      maxTokens: 4096,
      temperature: 0.2,
      systemPrompt,
      userPrompt,
      taskType: 'takeoff',
      prioritizeAccuracy: true,
      includeConsensus: true,
      extractedText: extractedTextCombined || undefined
    }

    this.log('info', `Running consensus analysis across ${images.length} pages`)
    const consensusResult = await enhancedAIProvider.analyzeWithConsensus(images, analysisOptions)
    this.log('info', `Consensus returned ${consensusResult.items?.length || 0} takeoff items, ${consensusResult.issues?.length || 0} analysis items (confidence ${(consensusResult.confidence * 100).toFixed(1)}%)`)

    const takeoffItems = (consensusResult.items || []).map((item: any) => this.normalizeConsensusItem(item))
    const analysisItems = (consensusResult.issues || []).map((issue: any) => this.normalizeConsensusIssue(issue))

    // Assign takeoff items to segments based on category mapping
    const categoryMap = new Map<string, SegmentPlan>()
    segments.forEach(segment => {
      segment.categories.forEach(category => {
        categoryMap.set(category.toLowerCase(), segment)
      })
    })

    const itemsBySegment = new Map<string, TakeoffItem[]>()
    const analysisBySegment = new Map<string, AnalysisItem[]>()
    const unassignedItems: TakeoffItem[] = []

    takeoffItems.forEach(item => {
      const categoryKey = (item.category || '').toLowerCase()
      const segment = categoryMap.get(categoryKey)
      if (segment) {
        item.industry = segment.industry
        item.category = segment.categories.find(cat => cat.toLowerCase() === categoryKey) || item.category
        const key = segment.industry
        if (!itemsBySegment.has(key)) {
          itemsBySegment.set(key, [])
        }
        itemsBySegment.get(key)!.push(item)
      } else {
        unassignedItems.push(item)
      }
    })

    if (unassignedItems.length > 0) {
      this.log('warn', `There are ${unassignedItems.length} takeoff items without matching segment categories`)
    }

    analysisItems.forEach(issue => {
      const categoryKey = (issue.type || '').toLowerCase()
      const segment = categoryMap.get(categoryKey)
      if (segment) {
        const key = segment.industry
        if (!analysisBySegment.has(key)) {
          analysisBySegment.set(key, [])
        }
        analysisBySegment.get(key)!.push(issue)
      }
    })

    const segmentSummaries: SegmentResult[] = []
    const orderedSegments = [...segments].sort((a, b) => a.priority - b.priority)

    orderedSegments.forEach(segment => {
      const items = itemsBySegment.get(segment.industry) || []
      const issues = analysisBySegment.get(segment.industry) || []
      const summary = this.generateSegmentSummary(segment, items, issues, totalPages, 0)
      segmentSummaries.push(summary)
      this.log('info', `Segment ${segment.industry}: ${summary.items_count} items, ${summary.analysis_count} analysis entries`)
    })

    return {
      takeoff: takeoffItems,
      analysis: analysisItems,
      segments: segmentSummaries,
      runLog: this.runLog
    }
  }

  /**
   * Process a single segment across all PDFs
   */
  private async processSegment(
    input: MultiIndustryTakeoffInput,
    segment: SegmentPlan,
    batchSize: number,
    maxParallel: number
  ): Promise<{
    takeoff: TakeoffItem[]
    analysis: AnalysisItem[]
    summary: SegmentResult
  }> {
    const segmentTakeoff: TakeoffItem[] = []
    const segmentAnalysis: AnalysisItem[] = []
    let pagesProcessed = 0
    let pagesFailed = 0

    // Get total pages across all PDFs
    const pdfPageCounts: Array<{ pdf: string; pages: number }> = []
    for (const pdfUrl of input.pdf_urls) {
      const count = await this.getPDFPageCount(pdfUrl)
      pdfPageCounts.push({ pdf: pdfUrl, pages: count })
    }

    // Process each PDF in batches
    for (const { pdf, pages: totalPages } of pdfPageCounts) {
      if (totalPages === 0) {
        this.log('warn', `Skipping segment ${segment.industry} for ${pdf} - no pages available (PDF conversion failed?)`)
        continue
      }
      const batches = this.createBatches(totalPages, batchSize)

      // Process batches with parallelism control
      for (let i = 0; i < batches.length; i += maxParallel) {
        const batchGroup = batches.slice(i, i + maxParallel)
        const results = await Promise.allSettled(
          batchGroup.map(batch => this.processBatch(input, segment, pdf, batch))
        )

        for (const result of results) {
          if (result.status === 'fulfilled') {
            segmentTakeoff.push(...result.value.takeoff)
            segmentAnalysis.push(...result.value.analysis)
            pagesProcessed += result.value.pagesProcessed
            pagesFailed += result.value.pagesFailed
          } else {
            pagesFailed += batchSize
            this.log('error', `Batch failed: ${result.reason}`)
          }
        }
      }
    }

    // Generate segment summary
    const summary = this.generateSegmentSummary(segment, segmentTakeoff, segmentAnalysis, pagesProcessed, pagesFailed)

    return {
      takeoff: segmentTakeoff,
      analysis: segmentAnalysis,
      summary
    }
  }

  /**
   * Process a single batch of pages
   */
  private async processBatch(
    input: MultiIndustryTakeoffInput,
    segment: SegmentPlan,
    pdfUrl: string,
    batch: { start: number; end: number }
  ): Promise<{
    takeoff: TakeoffItem[]
    analysis: AnalysisItem[]
    pagesProcessed: number
    pagesFailed: number
  }> {
    try {
      // Load pages
      const pages = await this.loadPagesForBatch(pdfUrl, batch.start, batch.end)
      
      if (pages.length === 0) {
        return { takeoff: [], analysis: [], pagesProcessed: 0, pagesFailed: batch.end - batch.start + 1 }
      }

      // Build segment-specific prompt
      const prompt = this.buildSegmentExecutionPrompt(input, segment, pages, pdfUrl)

      const options: EnhancedAnalysisOptions = {
        maxTokens: 4096,
        temperature: 0.2,
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        taskType: 'takeoff'
      }

      // Call AI
      const imageUrls = pages.map(p => p.imageUrl).filter(Boolean) as string[]
      const results = await enhancedAIProvider.analyzeWithSpecializedModels(imageUrls, options)

      if (results.length === 0) {
        throw new Error('AI model call failed')
      }

      // Parse response
      const response = results[0].content
      const parsed = this.parseExecutionResponse(response, pdfUrl, pages, segment, input)

      return {
        takeoff: parsed.takeoff,
        analysis: parsed.analysis,
        pagesProcessed: pages.length,
        pagesFailed: 0
      }

    } catch (error) {
      this.log('error', `Batch ${batch.start}-${batch.end} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        takeoff: [],
        analysis: [],
        pagesProcessed: 0,
        pagesFailed: batch.end - batch.start + 1
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private log(type: 'info' | 'warn' | 'error', message: string, pdf?: string, pageBatch?: [number, number]) {
    this.runLog.push({ type, message, pdf, page_batch: pageBatch })
    console.log(`[${type.toUpperCase()}] ${message}`)
  }

  private getDefaultSegments(): SegmentPlan[] {
    return [
      { industry: 'structural', categories: ['foundation', 'slab on grade', 'framing'], priority: 1 },
      { industry: 'mep', categories: ['electrical', 'plumbing', 'hvac'], priority: 2 },
      { industry: 'finishes', categories: ['interior', 'exterior'], priority: 3 },
      { industry: 'sitework', categories: ['earthwork', 'utilities', 'paving'], priority: 4 }
    ]
  }

  private async samplePagesFromPDFs(pdfUrls: string[], count: number): Promise<Array<{ page: number; imageUrl?: string; text?: string; pdf: string }>> {
    const samples: Array<{ page: number; imageUrl?: string; text?: string; pdf: string }> = []
    
    for (const pdfUrl of pdfUrls) {
      try {
        const pageCount = await this.getPDFPageCount(pdfUrl)
        // Sample first, middle, last pages
        const sampleIndices = [
          1,
          Math.floor(pageCount / 2),
          pageCount
        ].filter(p => p > 0 && p <= pageCount).slice(0, count)

        for (const pageNum of sampleIndices) {
          const pages = await this.loadPagesForBatch(pdfUrl, pageNum, pageNum)
          if (pages.length > 0) {
            samples.push({ ...pages[0], pdf: pdfUrl })
          }
        }
      } catch (error) {
        this.log('warn', `Failed to sample pages from ${pdfUrl}`)
      }
    }

    return samples
  }

  private async getPDFPageCount(pdfUrl: string): Promise<number> {
    try {
      // Download PDF to get page count
      const response = await fetch(pdfUrl)
      if (!response.ok) throw new Error('Failed to fetch PDF')
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.toLowerCase().includes('pdf')) {
        throw new Error(`URL does not appear to be a PDF (content-type: ${contentType || 'unknown'})`)
      }
      
      const buffer = Buffer.from(await response.arrayBuffer())
      const imageUrls = await extractImageUrlsOnly(buffer, 'plan.pdf')
      if (!imageUrls || imageUrls.length === 0) {
        throw new Error('No pages extracted from PDF (conversion returned zero results).')
      }
      return imageUrls.length
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.log('error', `Failed to get page count for ${pdfUrl}: ${message}`)
      return 0
    }
  }

  private async loadPagesForBatch(
    pdfUrl: string,
    pageStart: number,
    pageEnd: number
  ): Promise<Array<{ page: number; imageUrl?: string; text?: string }>> {
    try {
      // Download PDF
      const response = await fetch(pdfUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`)
      }
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.toLowerCase().includes('pdf')) {
        throw new Error(`URL does not appear to be a PDF (content-type: ${contentType || 'unknown'})`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())

      // Extract images and text
      const imageUrls = await extractImageUrlsOnly(buffer, 'plan.pdf')
      if (!imageUrls || imageUrls.length === 0) {
        throw new Error('No images extracted from PDF (check PDF_CO_API_KEY or file format).')
      }
      const pageTexts = await extractTextPerPage(buffer)

      // Build pages array for the batch range
      const pages = []
      for (let i = pageStart; i <= pageEnd; i++) {
        const pageIndex = i - 1 // 0-indexed
        pages.push({
          page: i,
          imageUrl: imageUrls[pageIndex] || undefined,
          text: pageTexts[pageIndex]?.text || undefined
        })
      }

      return pages
    } catch (error) {
      console.error('Error loading pages for batch:', error)
      throw new Error(`Failed to load pages ${pageStart}-${pageEnd}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private createBatches(totalPages: number, batchSize: number): Array<{ start: number; end: number }> {
    const batches: Array<{ start: number; end: number }> = []
    for (let i = 1; i <= totalPages; i += batchSize) {
      batches.push({
        start: i,
        end: Math.min(i + batchSize - 1, totalPages)
      })
    }
    return batches
  }

  private deduplicateItems(items: TakeoffItem[]): TakeoffItem[] {
    const seen = new Map<string, TakeoffItem>()

    for (const item of items) {
      // Create deduplication key: name + location + cost_code + dimensions
      const dimKey = item.dimensions || ''
      const key = `${item.name}|${item.location}|${item.cost_code}|${dimKey}`

      const existing = seen.get(key)
      
      if (!existing) {
        seen.set(key, item)
      } else {
        // Check confidence delta and dimensions
        const confidenceDelta = Math.abs(existing.confidence - item.confidence)
        const dimensionsDiffer = this.dimensionsMateriallyDiffer(existing.dimensions, item.dimensions)

        // If confidence delta > 0.2 or dimensions differ, keep separate
        if (confidenceDelta > 0.2 || dimensionsDiffer) {
          // Keep both, but modify key slightly
          seen.set(`${key}|${item.confidence}`, item)
        } else {
          // Merge: keep higher confidence, sum quantities
          if (item.confidence > existing.confidence) {
            seen.set(key, {
              ...item,
              quantity: existing.quantity + item.quantity
            })
          } else {
            seen.set(key, {
              ...existing,
              quantity: existing.quantity + item.quantity
            })
          }
        }
      }
    }

    return Array.from(seen.values())
  }

  private deduplicateAnalysis(items: AnalysisItem[]): AnalysisItem[] {
    const seen = new Set<string>()

    return items.filter(item => {
      const key = `${item.type}|${item.description}|${item.pages.join(',')}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  private dimensionsMateriallyDiffer(dim1: string, dim2: string): boolean {
    if (!dim1 || !dim2) return dim1 !== dim2
    
    // Extract numeric values and compare
    const nums1 = dim1.match(/\d+\.?\d*/g) || []
    const nums2 = dim2.match(/\d+\.?\d*/g) || []
    
    if (nums1.length !== nums2.length) return true
    
    for (let i = 0; i < nums1.length; i++) {
      const diff = Math.abs(parseFloat(nums1[i]) - parseFloat(nums2[i]))
      const avg = (parseFloat(nums1[i]) + parseFloat(nums2[i])) / 2
      if (avg > 0 && diff / avg > 0.1) { // 10% difference threshold
        return true
      }
    }
    
    return false
  }

  private generateSegmentSummary(
    segment: SegmentPlan,
    takeoff: TakeoffItem[],
    analysis: AnalysisItem[],
    pagesProcessed: number,
    pagesFailed: number
  ): SegmentResult {
    // Group by cost code
    const costCodeMap = new Map<string, { cost_code: string; description: string; quantity: number; unit: string; est_cost: number }>()

    for (const item of takeoff) {
      const key = item.cost_code || 'UNKNOWN'
      const existing = costCodeMap.get(key) || {
        cost_code: item.cost_code,
        description: item.cost_code_description,
        quantity: 0,
        unit: item.unit,
        est_cost: 0
      }

      existing.quantity += item.quantity
      existing.est_cost += item.quantity * item.unit_cost
      costCodeMap.set(key, existing)
    }

    const totalsByCostCode = Array.from(costCodeMap.values())

    // Top risks from analysis
    const topRisks = analysis
      .filter(a => a.severity === 'high' || a.severity === 'critical' || a.priority === 'high')
      .slice(0, 5)
      .map(a => a.description)

    return {
      industry: segment.industry,
      categories: segment.categories,
      summary: {
        totals_by_cost_code: totalsByCostCode,
        top_risks: topRisks,
        pages_processed: pagesProcessed,
        pages_failed: pagesFailed
      },
      items_count: takeoff.length,
      analysis_count: analysis.length
    }
  }

  private formatArraysOnlyOutput(result: {
    takeoff: TakeoffItem[]
    analysis: AnalysisItem[]
    segments: SegmentResult[]
    runLog: RunLogEntry[]
  }): MultiIndustryTakeoffOutput {
    // Ensure we return exactly 4 arrays in the correct order
    return [
      result.takeoff || [],
      result.analysis || [],
      result.segments || [],
      result.runLog || []
    ]
  }

  private async convertPDFToImages(buffer: Buffer, fileName: string): Promise<string[]> {
    const PDF_CO_API_KEY = process.env.PDF_CO_API_KEY

    if (!PDF_CO_API_KEY) {
      this.log('warn', 'PDF_CO_API_KEY not configured - skipping image extraction')
      return []
    }

    try {
      const uploadFormData = new FormData()
      const uint8Array = new Uint8Array(buffer)
      const blob = new Blob([uint8Array], { type: 'application/pdf' })
      uploadFormData.append('file', blob, fileName)

      const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload', {
        method: 'POST',
        headers: {
          'x-api-key': PDF_CO_API_KEY,
        },
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        throw new Error(`PDF.co upload failed: ${uploadResponse.statusText}`)
      }

      const uploadData = await uploadResponse.json()
      const fileUrl = uploadData.url

      const convertResponse = await fetch('https://api.pdf.co/v1/pdf/convert/to/png', {
        method: 'POST',
        headers: {
          'x-api-key': PDF_CO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: fileUrl,
          async: false,
          pages: '',
          name: `${fileName}-page`,
        }),
      })

      if (!convertResponse.ok) {
        throw new Error(`PDF.co conversion failed: ${convertResponse.statusText}`)
      }

      const convertData = await convertResponse.json()

      if (convertData.error) {
        throw new Error(`PDF.co error: ${convertData.message}`)
      }

      return convertData.urls || []
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.log('warn', `Error converting PDF to images: ${message}`)
      return []
    }
  }

  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    return new Promise((resolve) => {
      const pdfParser = new PDFParser()

      pdfParser.on('pdfParser_dataError', () => {
        resolve('')
      })

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let text = ''
          pdfData?.formImage?.Pages?.forEach((page: any, index: number) => {
            const pageText = page.Texts?.map((textItem: any) => decodeURIComponent(textItem.R[0].T || '')).join(' ') || ''
            text += `=== PAGE ${index + 1} ===\n${pageText}\n\n`
          })
          resolve(text)
        } catch (error) {
          console.warn('Failed to extract text from PDF page:', error)
          resolve('')
        }
      })

      try {
        pdfParser.parseBuffer(buffer)
      } catch (error) {
        console.warn('PDF text extraction failed:', error)
        resolve('')
      }
    })
  }

  private buildConsensusPrompts(
    input: MultiIndustryTakeoffInput,
    segments: SegmentPlan[],
    pageCount: number,
    extractedText?: string
  ): { systemPrompt: string; userPrompt: string } {
    const currency = input.currency || 'USD'
    const baseSystem = buildTakeoffSystemPrompt('takeoff', input.job_context.building_type || 'residential')

    const segmentInstructions = segments
      .map(segment => `- ${segment.industry.toUpperCase()}: ${segment.categories.join(', ')}`)
      .join('\n')

    const scopingNotes = segments.length > 0
      ? `FOCUS SEGMENTS (in priority order):\n${segmentInstructions}\n\n`
      : ''

    const systemPrompt = `${baseSystem}

ADDITIONAL INSTRUCTIONS:
- Prioritize the scoped industries/categories listed below.
- Assign each takeoff item an industry/category/subcategory that aligns with these segments.
- Include Procore/CSI cost codes and realistic unit costs in ${currency}.

${scopingNotes}`

    let userPrompt = buildTakeoffUserPrompt(
      pageCount,
      1,
      pageCount,
      extractedText || undefined
    )

    if (segments.length > 0) {
      userPrompt += `\n\nSCOPED SEGMENTS (process thoroughly):\n${segmentInstructions}`
    }

    return { systemPrompt, userPrompt }
  }

  private normalizeConsensusItem(item: any): TakeoffItem {
    return {
      name: item.name || '',
      description: item.description || '',
      quantity: typeof item.quantity === 'number' ? item.quantity : 0,
      unit: item.unit || 'EA',
      unit_cost: typeof item.unit_cost === 'number' ? item.unit_cost : 0,
      unit_cost_source: item.unit_cost_source || 'model_estimate',
      unit_cost_notes: item.unit_cost_notes,
      location: item.location || '',
      industry: item.industry || 'other',
      category: item.category || '',
      subcategory: item.subcategory || '',
      cost_code: item.cost_code || '',
      cost_code_description: item.cost_code_description || '',
      dimensions: item.dimensions || '',
      bounding_box: item.bounding_box || { x: 0, y: 0, width: 0, height: 0, page: item.page_refs?.[0]?.page || 1 },
      page_refs: item.page_refs || [],
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
      notes: item.notes
    }
  }

  private normalizeConsensusIssue(issue: any): AnalysisItem {
    return {
      type: issue.type || 'conflict',
      title: issue.title,
      question: issue.question,
      description: issue.description || '',
      sheet: issue.sheet,
      pages: Array.isArray(issue.pages) && issue.pages.length > 0 ? issue.pages : [issue.bounding_box?.page || 1],
      bounding_box: issue.bounding_box || { x: 0, y: 0, width: 0, height: 0, page: issue.pages?.[0] || 1 },
      severity: issue.severity,
      priority: issue.priority,
      recommendation: issue.recommendation,
      confidence: typeof issue.confidence === 'number' ? issue.confidence : 0.5
    }
  }

  // ============================================================================
  // PROMPT BUILDERS
  // ============================================================================

  private buildScopingPrompt(
    input: MultiIndustryTakeoffInput,
    samplePages: Array<{ page: number; imageUrl?: string; text?: string; pdf: string }>
  ): { system: string; user: string } {
    const system = `You are a construction project scoping expert. Analyze sample pages from construction plans to determine which industries and categories should be analyzed.

Your goal: Create a normalized segmentation plan with industries and their key categories.

AVAILABLE INDUSTRIES:
- structural (foundation, slab on grade, framing, concrete, steel)
- mep (electrical, plumbing, hvac, fire protection)
- finishes (interior finishes, exterior finishes, paint, flooring)
- sitework (earthwork, utilities, paving, landscaping)
- roofing (roofing systems, waterproofing, insulation)
- glazing (windows, doors, curtain walls)
- other (specialty items, equipment, etc.)

Return ONLY a JSON object with this EXACT structure:
{
  "suggested_segments": [
    {"industry": "structural", "categories": ["foundation", "slab on grade", "framing"], "priority": 1},
    {"industry": "mep", "categories": ["electrical", "plumbing", "hvac"], "priority": 2}
  ]
}

RULES:
- Priority 1 = highest priority (process first)
- Include 2-5 segments typically
- Each segment should have 2-4 categories
- Base your analysis on what you see in the sample pages
- If the project type is clear, suggest segments directly`

    const extractedText = samplePages.map(p => p.text).filter(Boolean).join('\n\n').slice(0, 2000)
    
    const user = `Analyze these sample pages from a ${input.job_context.building_type} project:

Project: ${input.job_context.project_name}
Location: ${input.job_context.location}
${input.job_context.notes ? `Notes: ${input.job_context.notes}` : ''}

Sample pages: ${samplePages.length} pages from ${new Set(samplePages.map(p => p.pdf)).size} PDF(s)
${extractedText ? `\n=== EXTRACTED TEXT (sample) ===\n${extractedText}\n` : ''}

Based on what you see, suggest a segmentation plan with industries and categories that should be analyzed.`

    return { system, user }
  }

  private buildSegmentExecutionPrompt(
    input: MultiIndustryTakeoffInput,
    segment: SegmentPlan,
    pages: Array<{ page: number; imageUrl?: string; text?: string }>,
    pdfUrl: string
  ): { system: string; user: string } {
    const unitCostPolicy = input.unit_cost_policy || 'estimate'
    const currency = input.currency || 'USD'

    const system = `You are an expert construction takeoff analyst specializing in ${segment.industry} work.

CURRENT SEGMENT SCOPE:
- Industry: ${segment.industry}
- Categories: ${segment.categories.join(', ')}

You are analyzing pages ${pages[0]?.page || 1}-${pages[pages.length - 1]?.page || 1} from PDF: ${pdfUrl}

OUTPUT FORMAT - Return ONLY a valid JSON object:
{
  "items": [
    {
      "name": "Specific item name",
      "description": "Detailed description",
      "quantity": 150.5,
      "unit": "LF|SF|CF|CY|EA|SQ",
      "unit_cost": 2.50,
      "unit_cost_source": "${unitCostPolicy === 'estimate' ? 'model_estimate' : 'lookup_pending'}",
      "location": "e.g., North Wall, Sheet A1.2",
      "industry": "${segment.industry}",
      "category": "string",
      "subcategory": "string",
      "cost_code": "e.g., 03 30 00",
      "cost_code_description": "Cast-in-Place Concrete",
      "dimensions": "e.g., area/thickness/spec",
      "bounding_box": {"x": 0.25, "y": 0.30, "width": 0.15, "height": 0.10, "page": 1},
      "page_refs": [{"pdf": "${pdfUrl}", "page": 1}],
      "confidence": 0.95,
      "notes": "string"
    }
  ],
  "analysis": [
    {
      "type": "code_issue|conflict|rfi",
      "title": "string (for code_issue)",
      "question": "string (for rfi)",
      "description": "string",
      "sheet": "string",
      "pages": [1],
      "bounding_box": {"x": 0.25, "y": 0.30, "width": 0.15, "height": 0.10, "page": 1},
      "severity": "low|medium|high|critical",
      "priority": "low|medium|high",
      "recommendation": "string",
      "confidence": 0.90
    }
  ]
}

REQUIREMENTS:
- Extract ALL items in this segment's scope
- ALWAYS include bounding_box and page_refs for every item
- Use Procore/CSI cost codes (e.g., "03 30 00")
- Include realistic unit_cost based on ${currency} market rates
- Be conservative with confidence scores
- Include analysis items for issues, conflicts, and RFIs`

    const extractedText = pages.map(p => p.text).filter(Boolean).join('\n\n')
    const extractedBlock = extractedText
      ? `=== EXTRACTED TEXT ===\n${extractedText.slice(0, 4000)}\n`
      : ''
    const user = [
      `Analyze pages ${pages[0]?.page || 1}-${pages[pages.length - 1]?.page || 1} for ${segment.industry} work (${segment.categories.join(', ')}).`,
      extractedBlock,
      'Extract all items and analysis for this segment scope.'
    ]
      .filter(Boolean)
      .join('\n\n')

    return { system, user }
  }

  private parseScopingResponse(response: string): SegmentPlan[] {
    try {
      const json = JSON.parse(response)
      if (json.suggested_segments && Array.isArray(json.suggested_segments)) {
        return json.suggested_segments.map((s: any, idx: number) => ({
          industry: s.industry,
          categories: s.categories,
          priority: idx + 1
        }))
      }
      this.log('warn', 'Scoping response did not contain suggested_segments')
      return []
    } catch (e) {
      this.log('error', `Failed to parse scoping response: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return []
    }
  }

  private parseExecutionResponse(
    response: string,
    pdfUrl: string,
    pages: Array<{ page: number; imageUrl?: string; text?: string }>,
    segment: SegmentPlan,
    input: MultiIndustryTakeoffInput
  ): { takeoff: TakeoffItem[]; analysis: AnalysisItem[] } {
    try {
      const json = JSON.parse(response)
      if (json.items && Array.isArray(json.items)) {
        const takeoffItems: TakeoffItem[] = json.items.map((item: any) => ({
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_cost: item.unit_cost,
          unit_cost_source: item.unit_cost_source,
          unit_cost_notes: item.unit_cost_notes,
          location: item.location,
          industry: segment.industry,
          category: item.category,
          subcategory: item.subcategory,
          cost_code: item.cost_code,
          cost_code_description: item.cost_code_description,
          dimensions: item.dimensions,
          bounding_box: item.bounding_box,
          page_refs: item.page_refs,
          confidence: item.confidence,
          notes: item.notes
        }))

        if (json.analysis && Array.isArray(json.analysis)) {
          const analysisItems: AnalysisItem[] = json.analysis.map((item: any) => ({
            type: item.type,
            title: item.title,
            question: item.question,
            description: item.description,
            sheet: item.sheet,
            pages: item.pages,
            bounding_box: item.bounding_box,
            severity: item.severity,
            priority: item.priority,
            recommendation: item.recommendation,
            confidence: item.confidence
          }))
          return { takeoff: takeoffItems, analysis: analysisItems }
        }
      }
      this.log('warn', 'Execution response did not contain items or analysis')
      return { takeoff: [], analysis: [] }
    } catch (e) {
      this.log('error', `Failed to parse execution response: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return { takeoff: [], analysis: [] }
    }
  }
}

export const multiIndustryTakeoffOrchestrator = new MultiIndustryTakeoffOrchestrator()