/**
 * Takeoff & QA Orchestrator
 * 
 * Resilient, resumable, low-memory pipeline for large PDFs (100-500+ pages)
 * - Chunks & schedules page batches (configurable batch_size, default 5-10 pages)
 * - Streams/merges partial JSON into a single final payload with stable ordering
 * - Survives provider hiccups via retries, backoff, checkpointing, and idempotent writes
 * - Supports multiple models (OpenAI, Claude, Grok adapter) behind a single interface
 * - Produces EXACT output shape used by our app
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { extractImageUrlsOnly } from '@/lib/ingestion/pdf-image-extractor'
import { extractTextPerPage } from '@/lib/ingestion/pdf-text-extractor'
import { extractAnalysisPayload } from '@/lib/json/repair'
import { enhancedAIProvider } from '@/lib/enhanced-ai-providers'
import type { EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'
import { buildTakeoffSystemPrompt, buildTakeoffUserPrompt } from '@/lib/takeoff-prompts'

export interface TakeoffJobConfig {
  job_id: string
  plan_id: string
  user_id: string
  pdf_ref: string
  model_policy?: {
    primary: string
    fallbacks: string[]
    max_tokens?: number
    temperature?: number
  }
  batch_config?: {
    batch_size?: number
    concurrency?: number
    max_retries?: number
    timeout_s?: number
  }
  pages?: {
    start?: number
    end?: number
  }
  mode?: 'takeoff' | 'quality_analysis' | 'both'
}

export interface TakeoffJob {
  id: string
  job_id: string
  plan_id: string
  user_id: string
  pdf_ref: string
  model_policy: any
  batch_config: any
  mode: string
  status: 'queued' | 'running' | 'partial' | 'complete' | 'failed'
  progress_percent: number
  total_pages: number
  total_batches: number
  completed_batches: number
  final_result?: any
  errors: any[]
  metrics?: any
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface TakeoffBatch {
  id: string
  job_id: string
  batch_index: number
  page_start: number
  page_end: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retry_count: number
  result_jsonb?: any
  metrics?: any
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface ProviderRateLimitState {
  provider: string
  last_429_at?: string
  backoff_until?: string
  consecutive_429s: number
}

/**
 * Main Orchestrator Class
 */
export class TakeoffOrchestrator {
  private supabase: any

  constructor(supabase?: any) {
    this.supabase = supabase
  }

  /**
   * Create a new takeoff job
   */
  async createJob(config: TakeoffJobConfig): Promise<TakeoffJob> {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient()
    }

    // 1. Discover total pages
    const totalPages = await this.discoverPageCount(config.pdf_ref, config.pages)
    
    // 2. Calculate batches
    const batchSize = config.batch_config?.batch_size || 5
    const totalBatches = Math.ceil(totalPages / batchSize)
    
    // 3. Create job row
    const { data: job, error: jobError } = await this.supabase
      .from('takeoff_jobs')
      .insert({
        job_id: config.job_id,
        plan_id: config.plan_id,
        user_id: config.user_id,
        pdf_ref: config.pdf_ref,
        model_policy: config.model_policy || {
          primary: 'gpt-4o',
          fallbacks: ['claude-sonnet-4-20250514'],
          max_tokens: 4096,
          temperature: 0.2
        },
        batch_config: config.batch_config || {
          batch_size: 5,
          concurrency: 3,
          max_retries: 3,
          timeout_s: 120
        },
        mode: config.mode || 'both',
        status: 'queued',
        total_pages: totalPages,
        total_batches: totalBatches,
        completed_batches: 0,
        progress_percent: 0
      })
      .select()
      .single()

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`)
    }

    // 4. Create batch rows
    const batches = []
    const pageStart = config.pages?.start || 1
    const pageEnd = config.pages?.end || totalPages
    
    for (let i = 0; i < totalBatches; i++) {
      const batchPageStart = Math.max(pageStart, i * batchSize + 1)
      const batchPageEnd = Math.min(pageEnd, (i + 1) * batchSize)
      
      if (batchPageStart <= batchPageEnd) {
        batches.push({
          job_id: job.id,
          batch_index: i,
          page_start: batchPageStart,
          page_end: batchPageEnd,
          status: 'pending'
        })
      }
    }

    const { error: batchError } = await this.supabase
      .from('takeoff_batches')
      .insert(batches)

    if (batchError) {
      throw new Error(`Failed to create batches: ${batchError.message}`)
    }

    return job
  }

  /**
   * Discover total page count from PDF
   */
  private async discoverPageCount(pdfRef: string, pageRange?: { start?: number; end?: number }): Promise<number> {
    try {
      // If page range specified, use it
      if (pageRange?.end) {
        return pageRange.end
      }

      // Try to get from Supabase storage
      if (pdfRef.startsWith('job-plans/')) {
        // Download PDF buffer to get page count
        const { data, error } = await this.supabase.storage
          .from('job-plans')
          .download(pdfRef)

        if (!error && data) {
          const buffer = Buffer.from(await data.arrayBuffer())
          // Use PDF.co or pdf2json to get page count
          // For now, try to extract images and count
          const imageUrls = await extractImageUrlsOnly(buffer, 'plan.pdf')
          return imageUrls.length
        }
      }

      // Fallback: assume 100 pages if we can't determine
      console.warn('Could not determine page count, defaulting to 100')
      return 100
    } catch (error) {
      console.error('Error discovering page count:', error)
      return 100 // Default fallback
    }
  }

  /**
   * Process pending batches (up to concurrency limit)
   * Returns number of batches processed
   */
  async processBatches(
    jobId: string,
    maxBatches: number = 3,
    timeoutMs: number = 10000
  ): Promise<{ processed: number; remaining: number }> {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient()
    }

    // Get job config
    const { data: job, error: jobError } = await this.supabase
      .from('takeoff_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobId}`)
    }

    // Update job status to running
    if (job.status === 'queued') {
      await this.supabase
        .from('takeoff_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', jobId)
    }

    const startTime = Date.now()
    let processed = 0
    const concurrency = job.batch_config.concurrency || 3
    const actualMaxBatches = Math.min(maxBatches, concurrency)

    // Process batches in parallel (up to concurrency limit)
    const promises: Promise<void>[] = []

    for (let i = 0; i < actualMaxBatches; i++) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        break
      }

      const promise = this.processNextBatch(jobId, job)
        .then(() => {
          processed++
        })
        .catch((error) => {
          console.error(`Batch processing error:`, error)
        })

      promises.push(promise)
    }

    await Promise.all(promises)

    // Check remaining batches
    const { data: remainingBatches } = await this.supabase
      .from('takeoff_batches')
      .select('id')
      .eq('job_id', jobId)
      .eq('status', 'pending')

    const remaining = remainingBatches?.length || 0

    // Update progress
    await this.updateJobProgress(jobId)

    return { processed, remaining }
  }

  /**
   * Process next pending batch
   */
  private async processNextBatch(jobId: string, job: TakeoffJob): Promise<void> {
    try {
      // Atomically claim next batch
      const { data: batches, error } = await this.supabase.rpc('claim_next_batch', {
        p_job_id: jobId
      })

      if (error || !batches || batches.length === 0) {
        return // No batches available
      }

      const batch = batches[0]

      // Get full batch record
      const { data: fullBatch } = await this.supabase
        .from('takeoff_batches')
        .select('*')
        .eq('id', batch.id)
        .single()

      if (!fullBatch) {
        return
      }

      // Process with retries
      await this.processBatchWithRetries(job, fullBatch)
    } catch (error) {
      console.error('Error in processNextBatch:', error)
      // Don't throw - let other batches continue
    }
  }

  /**
   * Process a single batch with retry logic
   */
  private async processBatchWithRetries(job: TakeoffJob, batch: TakeoffBatch): Promise<void> {
    const maxRetries = job.batch_config.max_retries || 3
    let lastError: Error | null = null

    // Ensure batch is marked as processing
    try {
      await this.supabase
        .from('takeoff_batches')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', batch.id)
    } catch (updateError) {
      console.error('Error updating batch to processing:', updateError)
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Processing batch ${batch.batch_index} (attempt ${attempt + 1}/${maxRetries})`)
        
        // Check backpressure
        await this.checkBackpressure(job.model_policy.primary)

        // Load pages for this batch
        const pages = await this.loadPagesForBatch(job.pdf_ref, batch.page_start, batch.page_end)

        // Get job type for prompts
        const { data: planData } = await this.supabase
          .from('plans')
          .select('jobs!inner(project_type)')
          .eq('id', job.plan_id)
          .single()
        
        const jobType = (planData as any)?.jobs?.project_type === 'Commercial' 
          ? 'commercial' 
          : 'residential'

        // Call AI model
        const result = await this.callAIModel(pages, job.model_policy, job.mode, jobType)

        // Repair and validate JSON
        const repaired = extractAnalysisPayload(result.content)
        
        // Validate schema
        const validated = this.validateSchema(repaired, job.mode)

        // Save batch result
        await this.supabase
          .from('takeoff_batches')
          .update({
            status: 'completed',
            result_jsonb: validated,
            metrics: {
              tokens: result.tokensUsed || 0,
              cost: this.calculateCost(result.tokensUsed || 0, result.provider),
              latency_ms: result.processingTime || 0,
              provider: result.provider,
              attempt: attempt + 1
            },
            completed_at: new Date().toISOString()
          })
          .eq('id', batch.id)

        // Record success
        await this.recordProviderSuccess(result.provider)

        return // Success!

      } catch (error: any) {
        lastError = error

        // Handle rate limits
        if (error.statusCode === 429 || error.message?.includes('rate limit')) {
          await this.recordProviderRateLimit(job.model_policy.primary)
          
          // Exponential backoff with jitter
          const baseDelay = 60000 // 1 minute
          const multiplier = Math.pow(2, attempt)
          const jitter = Math.random() * 10000 // 0-10s jitter
          const backoffMs = Math.min(baseDelay * multiplier + jitter, 300000) // Max 5 min
          
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          
          // Try fallback provider
          if (job.model_policy.fallbacks && job.model_policy.fallbacks.length > 0) {
            try {
              // Reload pages for fallback (in case they're out of scope)
              const fallbackPages = await this.loadPagesForBatch(job.pdf_ref, batch.page_start, batch.page_end)
              
              // Get job type for prompts
              const { data: planData } = await this.supabase
                .from('plans')
                .select('jobs!inner(project_type)')
                .eq('id', job.plan_id)
                .single()
              
              const jobType = (planData as any)?.jobs?.project_type === 'Commercial' 
                ? 'commercial' 
                : 'residential'

              const fallbackResult = await this.callAIModelWithProvider(
                fallbackPages,
                job.model_policy.fallbacks[0],
                job.mode,
                jobType
              )
              
              // Repair and validate JSON
              const repaired = extractAnalysisPayload(fallbackResult.content)
              const validated = this.validateSchema(repaired, job.mode)

              // Save batch result with fallback provider
              await this.supabase
                .from('takeoff_batches')
                .update({
                  status: 'completed',
                  result_jsonb: validated,
                  metrics: {
                    tokens: fallbackResult.tokensUsed || 0,
                    cost: this.calculateCost(fallbackResult.tokensUsed || 0, fallbackResult.provider),
                    latency_ms: fallbackResult.processingTime || 0,
                    provider: fallbackResult.provider,
                    worker_id: 0,
                    attempt: attempt + 1,
                    used_fallback: true
                  },
                  completed_at: new Date().toISOString()
                })
                .eq('id', batch.id)

              // Record success
              await this.recordProviderSuccess(fallbackResult.provider)
              
              return // Success with fallback!
            } catch (fallbackError) {
              // Fallback also failed, continue retry loop
            }
          }
        }

        // Other errors - exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All retries exhausted
    await this.supabase
      .from('takeoff_batches')
      .update({
        status: 'failed',
        error_message: lastError?.message || 'Unknown error',
        retry_count: maxRetries
      })
      .eq('id', batch.id)

    throw lastError || new Error('Batch processing failed after all retries')
  }

  /**
   * Load pages for a batch (images + text)
   */
  private async loadPagesForBatch(
    pdfRef: string,
    pageStart: number,
    pageEnd: number
  ): Promise<Array<{ page: number; imageUrl?: string; text?: string }>> {
    try {
      // Get PDF from storage
      let pdfBuffer: Buffer
      
      if (pdfRef.startsWith('job-plans/')) {
        // Download from Supabase storage
        const { data, error } = await this.supabase.storage
          .from('job-plans')
          .download(pdfRef)

        if (error || !data) {
          throw new Error(`Failed to download PDF: ${error?.message}`)
        }

        pdfBuffer = Buffer.from(await data.arrayBuffer())
      } else if (pdfRef.startsWith('http')) {
        // Download from URL
        const response = await fetch(pdfRef)
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`)
        }
        pdfBuffer = Buffer.from(await response.arrayBuffer())
      } else {
        throw new Error(`Invalid pdf_ref format: ${pdfRef}`)
      }

      // Extract images for the page range
      const imageUrls = await extractImageUrlsOnly(pdfBuffer, 'plan.pdf')
      
      // Extract text for the page range
      const pageTexts = await extractTextPerPage(pdfBuffer)
      
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

  /**
   * Call AI model for a batch
   */
  private async callAIModel(
    pages: any[],
    modelPolicy: any,
    mode: string,
    jobType?: string
  ): Promise<any> {
    // Use enhanced AI provider with specialized models
    const taskType: TaskType = mode === 'quality_analysis' ? 'quality' : 'takeoff'
    
    // Build prompts using full prompts from analyze-enhanced
    const systemPrompt = buildTakeoffSystemPrompt(
      mode === 'quality_analysis' ? 'quality' : 'takeoff',
      jobType || 'residential'
    )
    
    // Extract text from pages if available
    const extractedText = pages
      .map(p => p.text || '')
      .filter(Boolean)
      .join('\n\n')
    
    const userPrompt = buildTakeoffUserPrompt(
      pages.length,
      pages[0]?.page,
      pages[pages.length - 1]?.page,
      extractedText || undefined
    )

    const options: EnhancedAnalysisOptions = {
      maxTokens: modelPolicy.max_tokens || 4096,
      temperature: modelPolicy.temperature || 0.2,
      systemPrompt,
      userPrompt,
      taskType
    }

    // Use analyzeWithSpecializedModels with just the primary model
    // This will return an array, we'll take the first result
    const imageUrls = pages.map(p => p.imageUrl || '').filter(Boolean)
    
    if (imageUrls.length === 0) {
      throw new Error('No images provided for batch')
    }

    const results = await enhancedAIProvider.analyzeWithSpecializedModels(imageUrls, options)
    
    if (results.length === 0) {
      throw new Error('All models failed to analyze batch')
    }

    // Return first successful result
    return results[0]
  }

  /**
   * Call AI model with specific provider
   */
  private async callAIModelWithProvider(
    pages: any[],
    provider: string,
    mode: string,
    jobType?: string
  ): Promise<any> {
    // Call with specific provider as primary
    return this.callAIModel(pages, { primary: provider, fallbacks: [] }, mode, jobType)
  }

  /**
   * Validate schema
   */
  private validateSchema(repaired: any, mode: string): any {
    // Ensure structure matches expected schema
    const result = {
      items: Array.isArray(repaired.items) ? repaired.items : [],
      quality_analysis: repaired.quality_analysis || {
        summary: '',
        risks: [],
        missing_info: [],
        assumptions: [],
        code_refs: [],
        confidence: 0
      }
    }

    // Validate items structure
    result.items = result.items.map((item: any) => ({
      name: item.name || '',
      description: item.description || '',
      quantity: typeof item.quantity === 'number' ? item.quantity : 0,
      unit: item.unit || 'EA',
      unit_cost: typeof item.unit_cost === 'number' ? item.unit_cost : 0,
      location: item.location || '',
      category: item.category || 'other',
      subcategory: item.subcategory || '',
      cost_code: item.cost_code || '',
      cost_code_description: item.cost_code_description || '',
      notes: item.notes || '',
      dimensions: item.dimensions || '',
      confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      bounding_box: item.bounding_box || { x: 0, y: 0, page: 0, width: 0, height: 0 }
    }))

    return result
  }

  /**
   * Check backpressure for provider
   */
  private async checkBackpressure(provider: string): Promise<void> {
    const { data: state } = await this.supabase
      .from('provider_rate_limits')
      .select('*')
      .eq('provider', provider)
      .single()

    if (state && state.backoff_until) {
      const backoffUntil = new Date(state.backoff_until)
      if (backoffUntil > new Date()) {
        const waitMs = backoffUntil.getTime() - Date.now()
        await new Promise(resolve => setTimeout(resolve, waitMs))
      }
    }
  }

  /**
   * Record provider success
   */
  private async recordProviderSuccess(provider: string): Promise<void> {
    await this.supabase
      .from('provider_rate_limits')
      .upsert({
        provider,
        consecutive_429s: 0,
        updated_at: new Date().toISOString()
      })
  }

  /**
   * Record provider rate limit
   */
  private async recordProviderRateLimit(provider: string): Promise<void> {
    const { data: state } = await this.supabase
      .from('provider_rate_limits')
      .select('*')
      .eq('provider', provider)
      .single()

    const consecutive429s = (state?.consecutive_429s || 0) + 1
    const baseDelay = 60000 // 1 minute
    const multiplier = Math.pow(2, consecutive429s - 1)
    const jitter = Math.random() * 10000
    const backoffMs = Math.min(baseDelay * multiplier + jitter, 300000)
    const backoffUntil = new Date(Date.now() + backoffMs)

    await this.supabase
      .from('provider_rate_limits')
      .upsert({
        provider,
        last_429_at: new Date().toISOString(),
        backoff_until: backoffUntil.toISOString(),
        consecutive_429s: consecutive429s,
        updated_at: new Date().toISOString()
      })
  }

  /**
   * Calculate cost (simplified)
   */
  private calculateCost(tokens: number, provider: string): number {
    // Simplified cost calculation
    const costs: Record<string, number> = {
      'openai': 0.00001, // $0.01 per 1k tokens (approximate)
      'claude': 0.000015,
      'gemini': 0.000005
    }
    const costPerToken = costs[provider] || 0.00001
    return tokens * costPerToken
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(jobId: string): Promise<void> {
    const { data: stats } = await this.supabase
      .from('takeoff_batches')
      .select('id, status')
      .eq('job_id', jobId)

    const completed = stats.filter((s: any) => s.status === 'completed').length
    const total = stats.length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0

    await this.supabase
      .from('takeoff_jobs')
      .update({
        completed_batches: completed,
        progress_percent: progress,
        status: progress < 100 ? (progress > 0 ? 'partial' : 'running') : 'complete'
      })
      .eq('id', jobId)
  }

  /**
   * Merge all batch results into final payload
   */
  async mergeJobResults(jobId: string): Promise<any> {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient()
    }

    // Load all completed batches
    const { data: batches } = await this.supabase
      .from('takeoff_batches')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'completed')
      .order('batch_index', { ascending: true })

    if (!batches || batches.length === 0) {
      throw new Error('No completed batches to merge')
    }

    // Merge items
    const allItems: any[] = []
    const seenItems = new Set<string>()
    const allRisks: any[] = []
    const allMissingInfo: string[] = []
    const allAssumptions: string[] = []
    const allCodeRefs: string[] = []

    for (const batch of batches) {
      const result = batch.result_jsonb

      // Merge items (with deduplication)
      if (result.items && Array.isArray(result.items)) {
        for (const item of result.items) {
          // Dedupe by (page, bbox_hash, name)
          const bbox = item.bounding_box || {}
          const bboxHash = `${bbox.x}-${bbox.y}-${bbox.width}-${bbox.height}`
          const key = `${bbox.page || 0}-${bboxHash}-${item.name || ''}`

          if (!seenItems.has(key)) {
            seenItems.add(key)
            allItems.push(item)
          }
        }
      }

      // Merge quality analysis
      if (result.quality_analysis) {
        const qa = result.quality_analysis
        if (qa.risks && Array.isArray(qa.risks)) {
          allRisks.push(...qa.risks)
        }
        if (qa.missing_info && Array.isArray(qa.missing_info)) {
          allMissingInfo.push(...qa.missing_info)
        }
        if (qa.assumptions && Array.isArray(qa.assumptions)) {
          allAssumptions.push(...qa.assumptions)
        }
        if (qa.code_refs && Array.isArray(qa.code_refs)) {
          allCodeRefs.push(...qa.code_refs)
        }
      }
    }

    // Sort items by page, then by y position
    allItems.sort((a, b) => {
      const pageA = a.bounding_box?.page || 0
      const pageB = b.bounding_box?.page || 0
      if (pageA !== pageB) {
        return pageA - pageB
      }
      const yA = a.bounding_box?.y || 0
      const yB = b.bounding_box?.y || 0
      return yA - yB
    })

    // Build final payload
    const finalResult = {
      items: allItems,
      quality_analysis: {
        summary: this.generateSummary(allRisks, allMissingInfo),
        risks: allRisks,
        missing_info: Array.from(new Set(allMissingInfo)), // Dedupe
        assumptions: Array.from(new Set(allAssumptions)),
        code_refs: Array.from(new Set(allCodeRefs)),
        confidence: this.calculateOverallConfidence(allItems)
      }
    }

    // Save final result
    await this.supabase
      .from('takeoff_jobs')
      .update({
        status: 'complete',
        final_result: finalResult,
        completed_at: new Date().toISOString(),
        progress_percent: 100
      })
      .eq('id', jobId)

    return finalResult
  }

  /**
   * Generate summary
   */
  private generateSummary(risks: any[], missingInfo: string[]): string {
    const riskCount = risks.length
    const missingCount = missingInfo.length
    
    if (riskCount === 0 && missingCount === 0) {
      return 'Analysis complete. No major issues or missing information detected.'
    }
    
    return `Analysis complete. Found ${riskCount} risk${riskCount !== 1 ? 's' : ''} and ${missingCount} missing information item${missingCount !== 1 ? 's' : ''}.`
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(items: any[]): number {
    if (items.length === 0) return 0
    
    const confidences = items
      .map(item => item.confidence || 0)
      .filter(c => c > 0)
    
    if (confidences.length === 0) return 0.5 // Default
    
    const sum = confidences.reduce((a, b) => a + b, 0)
    return sum / confidences.length
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<TakeoffJob | null> {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient()
    }

    const { data: job, error } = await this.supabase
      .from('takeoff_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return null
    }

    return job
  }

  /**
   * Get job result
   */
  async getJobResult(jobId: string): Promise<any | null> {
    const job = await this.getJobStatus(jobId)
    
    if (!job || job.status !== 'complete') {
      return null
    }

    return job.final_result
  }
}

// Export singleton instance
export const takeoffOrchestrator = new TakeoffOrchestrator()

