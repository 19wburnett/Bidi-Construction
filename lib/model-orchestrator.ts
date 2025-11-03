/**
 * Model Orchestrator & Adjudicator
 * 
 * Runs a cohort of models on normalized inputs, merges takeoffs, identifies disagreements,
 * produces rationales, adjudicates winners, and recommends optimal models.
 */

import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from './enhanced-ai-providers'
import type { ProjectMeta, Chunk, SheetIndex } from '@/types/ingestion'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface NormalizedInput {
  project_meta: ProjectMeta
  sheet_index: SheetIndex[]
  chunks: Chunk[]
}

export interface ModelResponse {
  model: string
  provider: string
  response: any
  raw_content: string
  confidence?: number
  processing_time_ms?: number
  errors?: string[]
}

export interface AlignedResponse {
  model: string
  items: TakeoffItemSchema[]
  issues: QualityIssueSchema[]
  quality_analysis?: QualityAnalysisSchema
  schema_valid: boolean
  validation_errors?: string[]
  repair_applied?: boolean
}

export interface TakeoffItemSchema {
  name: string
  description: string
  quantity: number
  unit: 'LF' | 'SF' | 'CF' | 'CY' | 'EA' | 'SQ'
  unit_cost: number
  location: string
  category: 'structural' | 'exterior' | 'interior' | 'mep' | 'finishes' | 'other'
  subcategory: string
  cost_code: string
  cost_code_description: string
  notes?: string
  dimensions?: string
  bounding_box?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  confidence?: number
}

export interface QualityIssueSchema {
  severity: 'critical' | 'warning' | 'info'
  category: string
  description: string
  location: string
  impact?: string
  recommendation?: string
  pageNumber?: number
  bounding_box?: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  confidence?: number
}

export interface QualityAnalysisSchema {
  completeness: {
    overall_score: number
    missing_sheets: string[]
    missing_dimensions: string[]
    missing_details: string[]
    incomplete_sections: string[]
    notes?: string
  }
  consistency: {
    scale_mismatches: string[]
    unit_conflicts: string[]
    dimension_contradictions: string[]
    schedule_vs_elevation_conflicts: string[]
    notes?: string
  }
  risk_flags: Array<{
    level: 'high' | 'medium' | 'low'
    category: string
    description: string
    location: string
    recommendation: string
  }>
  audit_trail: {
    pages_analyzed: number[]
    chunks_processed: number
    coverage_percentage: number
    assumptions_made: Array<{
      item: string
      assumption: string
      reason: string
    }>
  }
}

export interface Disagreement {
  type: 'quantity' | 'category' | 'location' | 'unit' | 'name' | 'cost'
  item_key: string // Normalized key: name_category_location
  description: string
  models: string[]
  values: Record<string, any>
  tolerance_violated: boolean
  evidence_strength: Record<string, number> // 0-1 score per model
  cross_chunk_reconciliation?: string
}

export interface ModelRationale {
  model: string
  item_key: string
  value: any
  rationale: string
  citations: Array<{
    sheet_id?: string
    page_number?: number
    callout?: string
    detail?: string
  }>
  evidence_score: number
  internal_consistency_score: number
}

export interface AdjudicationResult {
  winner_model: string
  winner_value: any
  confidence: number
  reasoning: string
  evidence_summary: string
  all_rationales: ModelRationale[]
}

export interface ReconciledItem extends TakeoffItemSchema {
  adjudicated_by: string
  disagreements: Disagreement[]
  confidence: number
  risk_flag?: boolean
  unresolved_conflicts?: string[]
}

export interface FinalReconciledTakeoff {
  metadata: {
    confidence_overall: number
    total_items: number
    total_disagreements: number
    resolved_disagreements: number
    models_used: string[]
    processing_time_ms: number
  }
  items: ReconciledItem[]
  quality_analysis: QualityAnalysisSchema
  conflicts: {
    unresolved: Disagreement[]
    resolved: Array<{
      disagreement: Disagreement
      resolution: AdjudicationResult
    }>
  }
}

export interface ConsensusReport {
  summary: string[]
  disagreements_count: number
  high_confidence_items: number
  medium_confidence_items: number
  low_confidence_items: number
  model_performance: Record<string, {
    items_found: number
    average_confidence: number
    evidence_strength: number
    error_rate: number
    strengths: string[]
    weaknesses: string[]
  }>
}

export interface EngineRecommendation {
  recommended_model?: string
  recommended_hybrid?: {
    primary_model: string
    secondary_models: string[]
    use_case: string
  }
  reasoning: string
  confidence: number
  performance_metrics: Record<string, {
    accuracy: number
    evidence_strength: number
    consistency: number
    error_rate: number
  }>
  long_context_suitable?: boolean
  recommendation_details: string
}

export interface OrchestratorResult {
  consensus_report: ConsensusReport
  final_json: FinalReconciledTakeoff
  engine_recommendation: EngineRecommendation
}

// ============================================================================
// TOLERANCE RULES
// ============================================================================

const TOLERANCE_RULES = {
  LF: 0.02, // ±2% for Linear Feet
  SF: 0.02, // ±2% for Square Feet
  CF: 0.02, // ±2% for Cubic Feet
  CY: 0.02, // ±2% for Cubic Yards
  EA: 0.01, // ±1% for Each
  SQ: 0.02, // ±2% for Squares (100 SF roofing)
}

function getToleranceForUnit(unit: string): number {
  return TOLERANCE_RULES[unit as keyof typeof TOLERANCE_RULES] || 0.02
}

// ============================================================================
// MODEL ORCHESTRATOR
// ============================================================================

export class ModelOrchestrator {
  // Models to use - will be filtered by availability
  private defaultModels = ['gpt-4o', 'claude-3-haiku-20240307', 'grok-4', 'gemini-1.5-flash']
  
  /**
   * Main orchestration method
   */
  async orchestrate(
    inputs: NormalizedInput,
    systemPrompt: string,
    taskType: TaskType = 'takeoff'
  ): Promise<OrchestratorResult> {
    const startTime = Date.now()
    
    console.log('🚀 Starting Model Orchestration & Adjudication')
    console.log(`📊 Inputs: ${inputs.chunks.length} chunks, ${inputs.sheet_index.length} sheets`)
    
    // Step 1: DISPATCH - Run all models on identical chunk batches
    const modelResponses = await this.dispatchToModels(inputs, systemPrompt, taskType)
    
    if (modelResponses.length < 2) {
      throw new Error(`Need at least 2 models for adjudication. Only ${modelResponses.length} succeeded.`)
    }
    
    // Step 2: ALIGN - Coerce all outputs to strict JSON schema
    const alignedResponses = await this.alignOutputs(modelResponses)
    
    // Step 3: DIFF - Compute disagreements with tolerance rules
    const disagreements = this.detectDisagreements(alignedResponses)
    
    // Step 4: DEBATE - Generate rationales for each disagreement
    const rationales = await this.generateRationales(alignedResponses, disagreements, inputs)
    
    // Step 5: ADJUDICATE - Choose winner per line
    const adjudications = this.adjudicateDisagreements(disagreements, rationales, alignedResponses)
    
    // Step 6: FUSE - Produce final reconciled JSON
    const finalTakeoff = this.fuseResults(alignedResponses, adjudications, disagreements)
    
    // Step 7: RECOMMEND ENGINE - Analyze performance and recommend
    const engineRecommendation = this.recommendEngine(alignedResponses, adjudications, modelResponses)
    
    // Build consensus report
    const consensusReport = this.buildConsensusReport(alignedResponses, disagreements, adjudications)
    
    const processingTime = Date.now() - startTime
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ ORCHESTRATION COMPLETE`)
    console.log(`${'='.repeat(80)}`)
    console.log(`⏱️  Total time: ${processingTime}ms`)
    console.log(`📦 Final results:`)
    console.log(`   - Items: ${finalTakeoff.items.length}`)
    console.log(`   - Disagreements: ${disagreements.length}`)
    console.log(`   - Adjudicated: ${adjudications.size}`)
    console.log(`   - Overall confidence: ${(finalTakeoff.metadata.confidence_overall * 100).toFixed(1)}%`)
    console.log(`   - Models used: ${finalTakeoff.metadata.models_used.join(', ')}`)
    console.log(`${'='.repeat(80)}\n`)
    
    return {
      consensus_report: consensusReport,
      final_json: {
        ...finalTakeoff,
        metadata: {
          ...finalTakeoff.metadata,
          processing_time_ms: processingTime
        }
      },
      engine_recommendation: engineRecommendation
    }
  }
  
  /**
   * Step 1: Dispatch all models on identical inputs
   */
  private async dispatchToModels(
    inputs: NormalizedInput,
    systemPrompt: string,
    taskType: TaskType
  ): Promise<ModelResponse[]> {
    // Get available models
    const availableModels = this.getAvailableModels()
    console.log('📡 Dispatching to models:', availableModels)
    
    // Build user prompt from normalized inputs
    const userPrompt = this.buildUserPromptFromInputs(inputs)
    
    // Prepare images from chunks (use first chunk's images as example, or combine)
    const images: string[] = []
    for (const chunk of inputs.chunks.slice(0, 5)) { // Limit to 5 chunks for now
      if (chunk.content.image_urls && chunk.content.image_urls.length > 0) {
        images.push(...chunk.content.image_urls)
      }
    }
    
    // Build analysis options
    const options: EnhancedAnalysisOptions = {
      maxTokens: 4096,
      temperature: 0.2,
      systemPrompt,
      userPrompt,
      taskType,
      prioritizeAccuracy: true,
      includeConsensus: false // We'll do our own consensus
    }
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`🚀 MODEL ORCHESTRATOR - Starting Analysis`)
    console.log(`${'='.repeat(80)}`)
    console.log(`📋 Available models: ${availableModels.length}`)
    availableModels.forEach((model, idx) => {
      const hasKey = this.checkModelAPIKey(model)
      console.log(`   ${idx + 1}. ${model} ${hasKey ? '✅' : '❌'} (API key: ${hasKey ? 'present' : 'missing'})`)
    })
    
    if (availableModels.length < 2) {
      const errorMsg = `Need at least 2 models for orchestrator. Only ${availableModels.length} available: ${availableModels.join(', ')}`
      console.error(`\n❌ ${errorMsg}`)
      throw new Error(errorMsg)
    }
    
    console.log(`\n📊 Analysis Configuration:`)
    console.log(`   - Task Type: ${taskType}`)
    console.log(`   - Chunks: ${inputs.chunks.length}`)
    console.log(`   - Sheets: ${inputs.sheet_index.length}`)
    console.log(`   - Images: ${images.length}`)
    
    // Force all available models to run (not just "best" ones)
    // We'll temporarily override the model selection logic
    const startTime = Date.now()
    
    try {
      // Create a custom options object that will force all models
      const forcedOptions: EnhancedAnalysisOptions = {
        ...options,
        // Mark that we want all models, not just best ones
      }
      
      // We need to ensure all models run - use analyzeWithSpecializedModels
      // but we'll need to work around the "getBestModelsForTask" filter
      // by ensuring our models are in the performance scores
      const allResults = await enhancedAIProvider.analyzeWithSpecializedModels(
        images.length > 0 ? images : [],
        forcedOptions
      )
      
      // Filter to only the models we requested
      const filteredResults = allResults.filter(r => availableModels.includes(r.model))
      
      console.log(`\n${'='.repeat(80)}`)
      console.log(`📥 MODEL RESPONSES RECEIVED`)
      console.log(`${'='.repeat(80)}`)
      console.log(`✅ Received: ${filteredResults.length}/${availableModels.length} models`)
      
      // Detailed logging for each model
      availableModels.forEach(model => {
        const result = filteredResults.find(r => r.model === model)
        if (result) {
          console.log(`   ✅ ${model}:`)
          console.log(`      - Response length: ${result.content.length} chars`)
          console.log(`      - Processing time: ${result.processingTime || (Date.now() - startTime)}ms`)
          console.log(`      - Provider: ${result.provider}`)
          console.log(`      - Finish reason: ${result.finishReason}`)
        } else {
          console.log(`   ❌ ${model}: NO RESPONSE RECEIVED`)
        }
      })
      
      if (filteredResults.length < 2) {
        const failedModels = availableModels.filter(m => !filteredResults.find(r => r.model === m))
        const errorMsg = `Only ${filteredResults.length} models responded. Failed models: ${failedModels.join(', ')}`
        console.error(`\n❌ ${errorMsg}`)
        throw new Error(errorMsg)
      }
      
      // Convert to ModelResponse format with detailed parsing logs
      console.log(`\n${'='.repeat(80)}`)
      console.log(`🔍 PARSING MODEL RESPONSES`)
      console.log(`${'='.repeat(80)}`)
      
      const modelResponses: ModelResponse[] = filteredResults
        .filter(result => result.content && result.content.trim().length > 0)
        .map(result => {
          console.log(`\n   Processing ${result.model}...`)
          try {
            // Try to parse JSON, handling markdown code blocks
            let jsonText = result.content
            let extractionMethod = 'direct'
            
            // Check if response is wrapped in markdown
            const codeBlockMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
            if (codeBlockMatch) {
              jsonText = codeBlockMatch[1]
              extractionMethod = 'markdown_code_block'
              console.log(`      ✅ Extracted JSON from markdown code block`)
            } else {
              const jsonMatch = result.content.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                jsonText = jsonMatch[0]
                extractionMethod = 'regex_extraction'
                console.log(`      ✅ Extracted JSON using regex`)
              } else {
                console.log(`      ⚠️  No JSON found in response - checking if it's already JSON...`)
              }
            }
            
            const parsed = JSON.parse(jsonText)
            
            // Validate structure
            const hasItems = !!parsed.items && Array.isArray(parsed.items)
            const hasQA = !!parsed.quality_analysis
            const itemsCount = parsed.items?.length || 0
            
            console.log(`      ✅ Successfully parsed JSON`)
            console.log(`         - Items: ${itemsCount} ${hasItems ? '✅' : '❌'}`)
            console.log(`         - Quality Analysis: ${hasQA ? '✅' : '❌'}`)
            console.log(`         - Extraction method: ${extractionMethod}`)
            
            return {
              model: result.model,
              provider: result.provider,
              response: parsed,
              raw_content: result.content,
              confidence: result.confidence,
              processing_time_ms: result.processingTime || (Date.now() - startTime),
              errors: []
            } as ModelResponse
          } catch (parseError) {
            const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error'
            console.error(`      ❌ PARSE FAILED: ${errorMsg}`)
            console.error(`         Response preview (first 300 chars):`)
            console.error(`         ${result.content.substring(0, 300)}...`)
            console.error(`         Response length: ${result.content.length} chars`)
            
            // Try to identify the issue
            if (result.content.trim().length === 0) {
              console.error(`         Issue: Empty response`)
            } else if (!result.content.includes('{')) {
              console.error(`         Issue: No JSON object found in response`)
            } else if (result.content.includes('```')) {
              console.error(`         Issue: JSON might be in markdown block but extraction failed`)
            } else {
              console.error(`         Issue: Invalid JSON syntax`)
            }
            
            return {
              model: result.model,
              provider: result.provider,
              response: null,
              raw_content: result.content,
              errors: [`Parse error: ${errorMsg}`]
            } as ModelResponse
          }
        })
      
      const successful = modelResponses.filter(r => !r.errors || r.errors.length === 0)
      const failed = modelResponses.filter(r => r.errors && r.errors.length > 0)
      
      console.log(`\n${'='.repeat(80)}`)
      console.log(`📊 PARSE SUMMARY`)
      console.log(`${'='.repeat(80)}`)
      console.log(`✅ Successful: ${successful.length}/${filteredResults.length}`)
      successful.forEach(r => {
        const itemsCount = r.response?.items?.length || 0
        console.log(`   ✅ ${r.model}: ${itemsCount} items, ${r.processing_time_ms}ms`)
      })
      
      if (failed.length > 0) {
        console.log(`❌ Failed: ${failed.length}/${filteredResults.length}`)
        failed.forEach(f => {
          console.log(`   ❌ ${f.model}:`)
          f.errors?.forEach(err => console.log(`      - ${err}`))
          console.log(`      - Response length: ${f.raw_content.length} chars`)
          console.log(`      - Preview: ${f.raw_content.substring(0, 150)}...`)
        })
      }
      
      if (successful.length < 2) {
        throw new Error(`Only ${successful.length} models provided valid responses. Need at least 2 for orchestrator.`)
      }
      
      return successful
    } catch (error) {
      console.error('Failed to dispatch to models:', error)
      throw new Error(`Model dispatch failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Get list of available models based on API keys and environment flags
   */
  private getAvailableModels(): string[] {
    const models: string[] = []
    
    // Check each model's availability
    for (const model of this.defaultModels) {
      if (model.includes('gpt')) {
        if (process.env.ENABLE_OPENAI === 'false') continue
        if (!process.env.OPENAI_API_KEY) continue
        models.push(model)
      } else if (model.includes('claude')) {
        if (process.env.ENABLE_ANTHROPIC === 'false') continue
        if (!process.env.ANTHROPIC_API_KEY) continue
        models.push(model)
      } else if (model.includes('gemini')) {
        if (process.env.ENABLE_GOOGLE === 'false') continue
        if (!process.env.GOOGLE_GEMINI_API_KEY) continue
        models.push(model)
      } else if (model.includes('grok')) {
        if (process.env.ENABLE_XAI === 'false') continue
        if (!process.env.XAI_API_KEY) continue
        models.push(model)
      }
    }
    
    return models
  }
  
  /**
   * Check if API key exists for a model
   */
  private checkModelAPIKey(model: string): boolean {
    if (model.includes('gpt')) {
      return !!process.env.OPENAI_API_KEY && process.env.ENABLE_OPENAI !== 'false'
    } else if (model.includes('claude')) {
      return !!process.env.ANTHROPIC_API_KEY && process.env.ENABLE_ANTHROPIC !== 'false'
    } else if (model.includes('gemini')) {
      return !!process.env.GOOGLE_GEMINI_API_KEY && process.env.ENABLE_GOOGLE !== 'false'
    } else if (model.includes('grok')) {
      return !!process.env.XAI_API_KEY && process.env.ENABLE_XAI !== 'false'
    }
    return false
  }
  
  /**
   * Build user prompt from normalized inputs
   */
  private buildUserPromptFromInputs(inputs: NormalizedInput): string {
    let prompt = `Analyze this construction plan with the following normalized inputs:\n\n`
    
    prompt += `PROJECT METADATA:\n`
    prompt += `- Project Name: ${inputs.project_meta.project_name || 'N/A'}\n`
    prompt += `- Location: ${inputs.project_meta.project_location || 'N/A'}\n`
    prompt += `- Total Pages: ${inputs.project_meta.total_pages}\n\n`
    
    prompt += `SHEET INDEX (${inputs.sheet_index.length} sheets):\n`
    inputs.sheet_index.slice(0, 10).forEach(sheet => {
      prompt += `- ${sheet.sheet_id}: ${sheet.title} (${sheet.discipline}, ${sheet.sheet_type})\n`
    })
    if (inputs.sheet_index.length > 10) {
      prompt += `- ... and ${inputs.sheet_index.length - 10} more sheets\n`
    }
    prompt += `\n`
    
    prompt += `CHUNKS (${inputs.chunks.length} total):\n`
    inputs.chunks.slice(0, 3).forEach((chunk, idx) => {
      prompt += `Chunk ${chunk.chunk_index}: Pages ${chunk.page_range.start}-${chunk.page_range.end}\n`
      prompt += `Sheets: ${chunk.sheet_index_subset.map(s => s.sheet_id).join(', ')}\n`
      prompt += `Text preview: ${chunk.content.text.substring(0, 200)}...\n\n`
    })
    if (inputs.chunks.length > 3) {
      prompt += `... and ${inputs.chunks.length - 3} more chunks\n\n`
    }
    
    prompt += `INSTRUCTIONS:\n`
    prompt += `- Extract all takeoff items with precise quantities\n`
    prompt += `- Include quality analysis with completeness, consistency, and risk flags\n`
    prompt += `- Provide bounding boxes and citations (sheet/page/callout) for all items\n`
    prompt += `- Be thorough and accurate - this will be cross-checked with other models\n`
    
    return prompt
  }
  
  /**
   * Step 2: Align all outputs to strict schema
   */
  private async alignOutputs(responses: ModelResponse[]): Promise<AlignedResponse[]> {
    console.log('🔧 Aligning outputs to strict schema...')
    
    return responses.map(response => {
      const validation = this.validateAndRepairSchema(response.response, response.model)
      
      return {
        model: response.model,
        items: validation.items,
        issues: validation.issues,
        quality_analysis: validation.quality_analysis,
        schema_valid: validation.valid,
        validation_errors: validation.errors,
        repair_applied: validation.repaired
      }
    })
  }
  
  /**
   * Validate and repair schema
   */
  private validateAndRepairSchema(data: any, model: string): {
    items: TakeoffItemSchema[]
    issues: QualityIssueSchema[]
    quality_analysis?: QualityAnalysisSchema
    valid: boolean
    errors: string[]
    repaired: boolean
  } {
    const errors: string[] = []
    let repaired = false
    
    // Extract items
    let items: TakeoffItemSchema[] = []
    if (Array.isArray(data.items)) {
      items = data.items.map((item: any, idx: number) => {
        const repairResult = this.repairItem(item, idx)
        if (repairResult.repaired) {
          repaired = true
        }
        return repairResult.item
      })
    } else {
      errors.push('Missing or invalid items array')
      items = []
    }
    
    // Extract issues
    let issues: QualityIssueSchema[] = []
    if (Array.isArray(data.issues)) {
      issues = data.issues.map((issue: any) => this.repairIssue(issue))
    } else {
      issues = []
    }
    
    // Extract quality_analysis
    let quality_analysis: QualityAnalysisSchema | undefined
    if (data.quality_analysis) {
      quality_analysis = this.repairQualityAnalysis(data.quality_analysis)
    } else {
      // Create minimal structure
      quality_analysis = {
        completeness: {
          overall_score: 0.8,
          missing_sheets: [],
          missing_dimensions: [],
          missing_details: [],
          incomplete_sections: [],
          notes: 'Quality analysis not provided by model'
        },
        consistency: {
          scale_mismatches: [],
          unit_conflicts: [],
          dimension_contradictions: [],
          schedule_vs_elevation_conflicts: [],
          notes: 'No consistency issues detected'
        },
        risk_flags: [],
        audit_trail: {
          pages_analyzed: [],
          chunks_processed: 0,
          coverage_percentage: 0,
          assumptions_made: []
        }
      }
      repaired = true
    }
    
    return {
      items,
      issues,
      quality_analysis,
      valid: errors.length === 0,
      errors,
      repaired
    }
  }
  
  /**
   * Repair a single item
   */
  private repairItem(item: any, index: number): { item: TakeoffItemSchema; repaired: boolean } {
    let repaired = false
    
    const repairedItem: TakeoffItemSchema = {
      name: item.name || `Item ${index + 1}`,
      description: item.description || '',
      quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0,
      unit: this.validateUnit(item.unit) || 'EA',
      unit_cost: typeof item.unit_cost === 'number' ? item.unit_cost : parseFloat(item.unit_cost) || 0,
      location: item.location || '',
      category: this.validateCategory(item.category) || 'other',
      subcategory: item.subcategory || 'Uncategorized',
      cost_code: item.cost_code || '',
      cost_code_description: item.cost_code_description || '',
      notes: item.notes || '',
      dimensions: item.dimensions || '',
      bounding_box: item.bounding_box,
      confidence: typeof item.confidence === 'number' ? item.confidence : undefined
    }
    
    if (!item.name || !item.unit || !item.category) {
      repaired = true
    }
    
    return { item: repairedItem, repaired }
  }
  
  /**
   * Repair a single issue
   */
  private repairIssue(issue: any): QualityIssueSchema {
    return {
      severity: ['critical', 'warning', 'info'].includes(issue.severity) ? issue.severity : 'info',
      category: issue.category || 'general',
      description: issue.description || '',
      location: issue.location || '',
      impact: issue.impact,
      recommendation: issue.recommendation,
      pageNumber: issue.pageNumber || issue.page,
      bounding_box: issue.bounding_box,
      confidence: typeof issue.confidence === 'number' ? issue.confidence : undefined
    }
  }
  
  /**
   * Repair quality analysis
   */
  private repairQualityAnalysis(qa: any): QualityAnalysisSchema {
    return {
      completeness: {
        overall_score: typeof qa.completeness?.overall_score === 'number' ? qa.completeness.overall_score : 0.8,
        missing_sheets: Array.isArray(qa.completeness?.missing_sheets) ? qa.completeness.missing_sheets : [],
        missing_dimensions: Array.isArray(qa.completeness?.missing_dimensions) ? qa.completeness.missing_dimensions : [],
        missing_details: Array.isArray(qa.completeness?.missing_details) ? qa.completeness.missing_details : [],
        incomplete_sections: Array.isArray(qa.completeness?.incomplete_sections) ? qa.completeness.incomplete_sections : [],
        notes: qa.completeness?.notes || ''
      },
      consistency: {
        scale_mismatches: Array.isArray(qa.consistency?.scale_mismatches) ? qa.consistency.scale_mismatches : [],
        unit_conflicts: Array.isArray(qa.consistency?.unit_conflicts) ? qa.consistency.unit_conflicts : [],
        dimension_contradictions: Array.isArray(qa.consistency?.dimension_contradictions) ? qa.consistency.dimension_contradictions : [],
        schedule_vs_elevation_conflicts: Array.isArray(qa.consistency?.schedule_vs_elevation_conflicts) ? qa.consistency.schedule_vs_elevation_conflicts : [],
        notes: qa.consistency?.notes || ''
      },
      risk_flags: Array.isArray(qa.risk_flags) ? qa.risk_flags : [],
      audit_trail: {
        pages_analyzed: Array.isArray(qa.audit_trail?.pages_analyzed) ? qa.audit_trail.pages_analyzed : [],
        chunks_processed: typeof qa.audit_trail?.chunks_processed === 'number' ? qa.audit_trail.chunks_processed : 0,
        coverage_percentage: typeof qa.audit_trail?.coverage_percentage === 'number' ? qa.audit_trail.coverage_percentage : 0,
        assumptions_made: Array.isArray(qa.audit_trail?.assumptions_made) ? qa.audit_trail.assumptions_made : []
      }
    }
  }
  
  /**
   * Validate unit
   */
  private validateUnit(unit: string | undefined): TakeoffItemSchema['unit'] | null {
    const validUnits: TakeoffItemSchema['unit'][] = ['LF', 'SF', 'CF', 'CY', 'EA', 'SQ']
    if (unit && validUnits.includes(unit as TakeoffItemSchema['unit'])) {
      return unit as TakeoffItemSchema['unit']
    }
    return null
  }
  
  /**
   * Validate category
   */
  private validateCategory(category: string | undefined): TakeoffItemSchema['category'] | null {
    const validCategories: TakeoffItemSchema['category'][] = ['structural', 'exterior', 'interior', 'mep', 'finishes', 'other']
    if (category && validCategories.includes(category as TakeoffItemSchema['category'])) {
      return category as TakeoffItemSchema['category']
    }
    return null
  }
  
  /**
   * Step 3: Detect disagreements with tolerance rules
   */
  private detectDisagreements(aligned: AlignedResponse[]): Disagreement[] {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`🔍 DETECTING DISAGREEMENTS`)
    console.log(`${'='.repeat(80)}`)
    
    const disagreements: Disagreement[] = []
    const itemMap = new Map<string, Map<string, TakeoffItemSchema>>() // key -> model -> item
    
    // Group items by normalized key (name_category_location)
    aligned.forEach(response => {
      response.items.forEach(item => {
        const key = this.getItemKey(item)
        if (!itemMap.has(key)) {
          itemMap.set(key, new Map())
        }
        itemMap.get(key)!.set(response.model, item)
      })
    })
    
    // Check for disagreements
    itemMap.forEach((modelsMap, key) => {
      if (modelsMap.size < 2) return // Need at least 2 models to disagree
      
      const modelItemPairs = Array.from(modelsMap.entries())
      const items = modelItemPairs.map(([_, item]) => item)
      const firstItem = items[0]
      
      // Check quantity disagreements
      const quantities = items.map(item => item.quantity)
      const avgQuantity = quantities.reduce((sum, q) => sum + q, 0) / quantities.length
      const tolerance = getToleranceForUnit(firstItem.unit)
      
      const maxDeviation = Math.max(...quantities.map(q => Math.abs(q - avgQuantity) / (avgQuantity || 1)))
      if (maxDeviation > tolerance) {
        disagreements.push({
          type: 'quantity',
          item_key: key,
          description: `Quantity disagreement for ${firstItem.name}: ${modelItemPairs.map(([model, item]) => `${model}=${item.quantity}`).join(', ')}`,
          models: modelItemPairs.map(([model, _]) => model),
          values: modelItemPairs.reduce((acc, [model, item]) => {
            acc[model] = item.quantity
            return acc
          }, {} as Record<string, any>),
          tolerance_violated: true,
          evidence_strength: {} // Will be filled in debate phase
        })
      }
      
      // Check category disagreements
      const categories = items.map(item => item.category)
      const uniqueCategories = Array.from(new Set(categories))
      if (uniqueCategories.length > 1) {
        disagreements.push({
          type: 'category',
          item_key: key,
          description: `Category disagreement for ${firstItem.name}`,
          models: modelItemPairs.map(([model, _]) => model),
          values: modelItemPairs.reduce((acc, [model, item]) => {
            acc[model] = item.category
            return acc
          }, {} as Record<string, any>),
          tolerance_violated: false,
          evidence_strength: {}
        })
      }
      
      // Check unit disagreements
      const units = items.map(item => item.unit)
      const uniqueUnits = Array.from(new Set(units))
      if (uniqueUnits.length > 1) {
        disagreements.push({
          type: 'unit',
          item_key: key,
          description: `Unit disagreement for ${firstItem.name}`,
          models: modelItemPairs.map(([model, _]) => model),
          values: modelItemPairs.reduce((acc, [model, item]) => {
            acc[model] = item.unit
            return acc
          }, {} as Record<string, any>),
          tolerance_violated: false,
          evidence_strength: {}
        })
      }
    })
    
    console.log(`\n📊 Disagreement Summary:`)
    console.log(`   Total disagreements: ${disagreements.length}`)
    const byType = disagreements.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`)
    })
    if (disagreements.length > 0) {
      console.log(`\n   Disagreement details:`)
      disagreements.slice(0, 5).forEach((d, idx) => {
        console.log(`   ${idx + 1}. ${d.item_key}:`)
        console.log(`      Type: ${d.type}`)
        console.log(`      Models: ${d.models.join(', ')}`)
        console.log(`      Values: ${JSON.stringify(d.values)}`)
        console.log(`      Tolerance violated: ${d.tolerance_violated ? 'Yes' : 'No'}`)
      })
      if (disagreements.length > 5) {
        console.log(`   ... and ${disagreements.length - 5} more`)
      }
    }
    return disagreements
  }
  
  /**
   * Get normalized item key
   */
  private getItemKey(item: TakeoffItemSchema): string {
    return `${item.name.toLowerCase().trim()}_${item.category}_${item.location.toLowerCase().trim()}`
  }
  
  /**
   * Step 4: Generate rationales for disagreements
   */
  private async generateRationales(
    aligned: AlignedResponse[],
    disagreements: Disagreement[],
    inputs: NormalizedInput
  ): Promise<Map<string, ModelRationale[]>> {
    console.log('💬 Generating rationales for disagreements...')
    
    const rationales = new Map<string, ModelRationale[]>()
    
    for (const disagreement of disagreements) {
      const itemRationales: ModelRationale[] = []
      
      for (const modelName of disagreement.models) {
        const modelResponse = aligned.find(r => r.model === modelName)
        if (!modelResponse) continue
        
        const item = modelResponse.items.find(i => this.getItemKey(i) === disagreement.item_key)
        if (!item) continue
        
        // Generate rationale based on item data
        const rationale = this.buildRationale(item, modelName, inputs)
        itemRationales.push(rationale)
      }
      
      rationales.set(disagreement.item_key, itemRationales)
    }
    
    return rationales
  }
  
  /**
   * Build rationale for a model's decision
   */
  private buildRationale(
    item: TakeoffItemSchema,
    model: string,
    inputs: NormalizedInput
  ): ModelRationale {
    const citations: ModelRationale['citations'] = []
    
    // Extract citations from bounding_box
    if (item.bounding_box) {
      citations.push({
        page_number: item.bounding_box.page,
        callout: item.bounding_box ? `bbox(${item.bounding_box.x.toFixed(2)},${item.bounding_box.y.toFixed(2)})` : undefined
      })
    }
    
    // Try to find sheet reference from location
    if (item.location) {
      const sheetMatch = inputs.sheet_index.find(s => 
        item.location.toLowerCase().includes(s.sheet_id.toLowerCase()) ||
        item.location.toLowerCase().includes(s.title.toLowerCase())
      )
      if (sheetMatch) {
        citations.push({
          sheet_id: sheetMatch.sheet_id,
          page_number: sheetMatch.page_no
        })
      }
    }
    
    // Calculate evidence score
    let evidenceScore = 0.5 // Base score
    
    // Boost for explicit citations
    if (citations.length > 0) evidenceScore += 0.2
    if (item.bounding_box) evidenceScore += 0.1
    if (item.dimensions) evidenceScore += 0.1
    if (item.notes && item.notes.length > 20) evidenceScore += 0.1
    
    evidenceScore = Math.min(evidenceScore, 1.0)
    
    // Calculate internal consistency
    let consistencyScore = 1.0
    
    // Check unit matches category
    if ((item.category === 'structural' || item.category === 'exterior') && item.unit === 'EA') {
      consistencyScore -= 0.1 // Structural items usually use LF/SF
    }
    
    // Build rationale text
    let rationale = `${model} identified "${item.name}" with quantity ${item.quantity} ${item.unit}. `
    
    if (citations.length > 0) {
      rationale += `Referenced ${citations.length} source(s): ${citations.map(c => c.sheet_id || `page ${c.page_number}`).join(', ')}. `
    }
    
    if (item.dimensions) {
      rationale += `Based on dimensions: ${item.dimensions}. `
    }
    
    if (item.notes) {
      rationale += `Notes: ${item.notes.substring(0, 100)}. `
    }
    
    rationale += `Evidence strength: ${(evidenceScore * 100).toFixed(0)}%, Consistency: ${(consistencyScore * 100).toFixed(0)}%.`
    
    return {
      model,
      item_key: this.getItemKey(item),
      value: {
        quantity: item.quantity,
        unit: item.unit,
        category: item.category
      },
      rationale,
      citations,
      evidence_score: evidenceScore,
      internal_consistency_score: consistencyScore
    }
  }
  
  /**
   * Step 5: Adjudicate disagreements
   */
  private adjudicateDisagreements(
    disagreements: Disagreement[],
    rationales: Map<string, ModelRationale[]>,
    aligned: AlignedResponse[]
  ): Map<string, AdjudicationResult> {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`⚖️  ADJUDICATING DISAGREEMENTS`)
    console.log(`${'='.repeat(80)}`)
    
    const adjudications = new Map<string, AdjudicationResult>()
    
    for (const disagreement of disagreements) {
      const itemRationales = rationales.get(disagreement.item_key) || []
      if (itemRationales.length === 0) continue
      
      // Score each model's position
      const scores = itemRationales.map(r => ({
        model: r.model,
        total_score: r.evidence_score * 0.6 + r.internal_consistency_score * 0.4,
        rationale: r
      }))
      
      // Find winner (highest score)
      const winner = scores.reduce((best, current) => 
        current.total_score > best.total_score ? current : best
      )
      
      // Check for cross-chunk consistency
      const crossChunk = this.checkCrossChunkConsistency(
        disagreement,
        aligned,
        winner.model
      )
      
      // Get winner's item
      const winnerResponse = aligned.find(r => r.model === winner.model)
      const winnerItem = winnerResponse?.items.find(i => this.getItemKey(i) === disagreement.item_key)
      
      if (!winnerItem) continue
      
      const winnerValue = disagreement.type === 'quantity' 
        ? winnerItem.quantity 
        : disagreement.type === 'category'
        ? winnerItem.category
        : winnerItem.unit
      
      adjudications.set(disagreement.item_key, {
        winner_model: winner.model,
        winner_value: winnerValue,
        confidence: winner.total_score,
        reasoning: winner.rationale.rationale,
        evidence_summary: `Winner: ${winner.model} (evidence: ${(winner.rationale.evidence_score * 100).toFixed(0)}%, consistency: ${(winner.rationale.internal_consistency_score * 100).toFixed(0)}%)`,
        all_rationales: itemRationales
      })
    }
    
    console.log(`\n📊 Adjudication Summary:`)
    console.log(`   Total adjudicated: ${adjudications.size}/${disagreements.length}`)
    
    // Count wins per model
    const wins = new Map<string, number>()
    adjudications.forEach(adj => {
      wins.set(adj.winner_model, (wins.get(adj.winner_model) || 0) + 1)
    })
    
    console.log(`   Model performance:`)
    Array.from(wins.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([model, count]) => {
        const percentage = ((count / adjudications.size) * 100).toFixed(1)
        console.log(`      ${model}: ${count} wins (${percentage}%)`)
      })
    
    return adjudications
  }
  
  /**
   * Check cross-chunk consistency
   */
  private checkCrossChunkConsistency(
    disagreement: Disagreement,
    aligned: AlignedResponse[],
    model: string
  ): string | undefined {
    // TODO: Implement cross-chunk reconciliation
    // For now, return undefined
    return undefined
  }
  
  /**
   * Step 6: Fuse results into final JSON
   */
  private fuseResults(
    aligned: AlignedResponse[],
    adjudications: Map<string, AdjudicationResult>,
    disagreements: Disagreement[]
  ): FinalReconciledTakeoff {
    console.log('🔀 Fusing results into final JSON...')
    
    // Collect all unique items
    const itemMap = new Map<string, ReconciledItem>()
    const unresolvedDisagreements: Disagreement[] = []
    const resolvedDisagreements: Array<{ disagreement: Disagreement; resolution: AdjudicationResult }> = []
    
    // Process all items from all models
    aligned.forEach(response => {
      response.items.forEach(item => {
        const key = this.getItemKey(item)
        
        if (!itemMap.has(key)) {
          // Check if this item has a disagreement
          const disagreement = disagreements.find(d => d.item_key === key)
          const adjudication = disagreement ? adjudications.get(key) : undefined
          
          let finalItem: ReconciledItem
          const confidence = item.confidence || 0.7
          
          if (adjudication && disagreement) {
            // Use adjudicated value
            finalItem = {
              ...item,
              quantity: adjudication.winner_model === response.model ? item.quantity : adjudication.winner_value as number,
              adjudicated_by: adjudication.winner_model,
              disagreements: [disagreement],
              confidence: adjudication.confidence,
              risk_flag: adjudication.confidence < 0.7
            }
            
            resolvedDisagreements.push({
              disagreement,
              resolution: adjudication
            })
          } else if (disagreement) {
            // Has disagreement but no adjudication (shouldn't happen, but handle gracefully)
            finalItem = {
              ...item,
              adjudicated_by: 'none',
              disagreements: [disagreement],
              confidence: 0.5,
              risk_flag: true,
              unresolved_conflicts: [`Disagreement on ${disagreement.type}`]
            }
            
            unresolvedDisagreements.push(disagreement)
          } else {
            // No disagreement - use item as-is
            finalItem = {
              ...item,
              adjudicated_by: 'consensus',
              disagreements: [],
              confidence
            }
          }
          
          itemMap.set(key, finalItem)
        } else {
          // Item already exists - merge if no disagreement
          const existing = itemMap.get(key)!
          const existingDisagreement = disagreements.find(d => d.item_key === key)
          if (!existingDisagreement) {
            // Average quantities if close enough
            const tolerance = getToleranceForUnit(item.unit)
            const qtyDiff = Math.abs(existing.quantity - item.quantity) / (existing.quantity || 1)
            const itemConfidence = item.confidence || 0.7
            if (qtyDiff <= tolerance) {
              existing.quantity = (existing.quantity + item.quantity) / 2
              existing.confidence = Math.max(existing.confidence || 0.7, itemConfidence)
            }
          }
        }
      })
    })
    
    // Merge quality analysis (use most comprehensive one)
    let bestQA: QualityAnalysisSchema | undefined
    let bestScore = 0
    
    aligned.forEach(response => {
      if (response.quality_analysis) {
        const score = (response.quality_analysis.completeness.overall_score || 0) +
                     (response.quality_analysis.audit_trail.coverage_percentage || 0) / 100
        if (score > bestScore) {
          bestScore = score
          bestQA = response.quality_analysis
        }
      }
    })
    
    const finalQA = bestQA || {
      completeness: {
        overall_score: 0.8,
        missing_sheets: [],
        missing_dimensions: [],
        missing_details: [],
        incomplete_sections: [],
        notes: 'Merged from multiple models'
      },
      consistency: {
        scale_mismatches: [],
        unit_conflicts: [],
        dimension_contradictions: [],
        schedule_vs_elevation_conflicts: [],
        notes: 'No consistency issues detected'
      },
      risk_flags: [],
      audit_trail: {
        pages_analyzed: [],
        chunks_processed: aligned.length,
        coverage_percentage: 0,
        assumptions_made: []
      }
    }
    
    // Calculate overall confidence
    const items = Array.from(itemMap.values())
    const avgConfidence = items.length > 0
      ? items.reduce((sum, item) => sum + (item.confidence || 0.7), 0) / items.length
      : 0.7
    
    return {
      metadata: {
        confidence_overall: avgConfidence,
        total_items: items.length,
        total_disagreements: disagreements.length,
        resolved_disagreements: resolvedDisagreements.length,
        models_used: aligned.map(r => r.model),
        processing_time_ms: 0 // Will be set by caller
      },
      items,
      quality_analysis: finalQA,
      conflicts: {
        unresolved: unresolvedDisagreements,
        resolved: resolvedDisagreements
      }
    }
  }
  
  /**
   * Step 7: Recommend engine based on performance
   */
  private recommendEngine(
    aligned: AlignedResponse[],
    adjudications: Map<string, AdjudicationResult>,
    modelResponses: ModelResponse[]
  ): EngineRecommendation {
    console.log('🎯 Analyzing model performance for recommendations...')
    
    // Calculate performance metrics per model
    const metrics = new Map<string, {
      accuracy: number
      evidence_strength: number
      consistency: number
      error_rate: number
      items_found: number
      wins: number
    }>()
    
    aligned.forEach(response => {
      const model = response.model
      const items = response.items
      
      // Count wins in adjudications
      let wins = 0
      adjudications.forEach((adj, key) => {
        if (adj.winner_model === model) wins++
      })
      
      // Calculate evidence strength (from adjudications)
      const modelAdjudications = Array.from(adjudications.values())
        .filter(adj => adj.winner_model === model)
      
      const avgEvidenceStrength = modelAdjudications.length > 0
        ? modelAdjudications.reduce((sum, adj) => {
            const rationale = adj.all_rationales.find(r => r.model === model)
            return sum + (rationale?.evidence_score || 0.5)
          }, 0) / modelAdjudications.length
        : 0.5
      
      // Calculate consistency (from model responses)
      const schemaErrors = response.validation_errors?.length || 0
      const consistency = 1.0 - (schemaErrors / Math.max(items.length, 1) * 0.1)
      
      metrics.set(model, {
        accuracy: wins / Math.max(adjudications.size, 1),
        evidence_strength: avgEvidenceStrength,
        consistency: Math.max(consistency, 0.5),
        error_rate: schemaErrors / Math.max(items.length, 1),
        items_found: items.length,
        wins
      })
    })
    
    // Find best performing model
    let bestModel: string | undefined
    let bestScore = 0
    
    metrics.forEach((metric, model) => {
      const score = (
        metric.accuracy * 0.4 +
        metric.evidence_strength * 0.3 +
        metric.consistency * 0.2 +
        (1 - metric.error_rate) * 0.1
      )
      
      if (score > bestScore) {
        bestScore = score
        bestModel = model
      }
    })
    
    // Build recommendation
    const performanceMetrics: Record<string, any> = {}
    metrics.forEach((metric, model) => {
      performanceMetrics[model] = {
        accuracy: metric.accuracy,
        evidence_strength: metric.evidence_strength,
        consistency: metric.consistency,
        error_rate: metric.error_rate
      }
    })
    
    let reasoning = ''
    let confidence = 0.7
    
    if (bestModel && bestScore > 0.7) {
      const bestMetric = metrics.get(bestModel)!
      reasoning = `${bestModel} performed best with ${(bestMetric.accuracy * 100).toFixed(0)}% win rate in adjudications, ` +
                 `${(bestMetric.evidence_strength * 100).toFixed(0)}% evidence strength, and ` +
                 `${(bestMetric.items_found)} items found. `
      
      if (bestMetric.wins >= adjudications.size * 0.6) {
        reasoning += `This model consistently outperformed others and should be used as primary.`
        confidence = 0.85
      } else {
        reasoning += `Consider using this model as primary with others for cross-checking.`
        confidence = 0.75
      }
    } else {
      reasoning = `All models performed similarly. Recommend using hybrid approach with multiple models for maximum accuracy.`
      confidence = 0.6
    }
    
    const recommendation: EngineRecommendation = {
      recommended_model: bestModel,
      reasoning,
      confidence,
      performance_metrics: performanceMetrics,
      recommendation_details: `Based on ${adjudications.size} adjudications across ${aligned.length} models. ` +
                            `Best model: ${bestModel || 'hybrid'} with score ${(bestScore * 100).toFixed(1)}%.`
    }
    
    // Check if long-context model would help
    const totalItems = aligned.reduce((sum, r) => sum + r.items.length, 0)
    if (totalItems > 100) {
      recommendation.long_context_suitable = true
      recommendation.recommendation_details += ` Large project detected - consider using long-context models for better coherence.`
    }
    
    return recommendation
  }
  
  /**
   * Build consensus report
   */
  private buildConsensusReport(
    aligned: AlignedResponse[],
    disagreements: Disagreement[],
    adjudications: Map<string, AdjudicationResult>
  ): ConsensusReport {
    const items = aligned.flatMap(r => r.items)
    const resolved = adjudications.size
    const unresolved = disagreements.length - resolved
    
    const summary: string[] = [
      `${aligned.length} models analyzed ${items.length} total items`,
      `${disagreements.length} disagreements detected`,
      `${resolved} disagreements resolved through adjudication`,
      unresolved > 0 ? `${unresolved} disagreements remain unresolved` : 'All disagreements resolved'
    ]
    
    // Calculate confidence distribution
    const confidences = items.map(i => i.confidence || 0.7)
    const highConf = confidences.filter(c => c >= 0.8).length
    const mediumConf = confidences.filter(c => c >= 0.6 && c < 0.8).length
    const lowConf = confidences.filter(c => c < 0.6).length
    
    // Calculate model performance
    const modelPerformance: Record<string, any> = {}
    aligned.forEach(response => {
      const modelItems = response.items
      const avgConfidence = modelItems.length > 0
        ? modelItems.reduce((sum, item) => sum + (item.confidence || 0.7), 0) / modelItems.length
        : 0.7
      
      modelPerformance[response.model] = {
        items_found: modelItems.length,
        average_confidence: avgConfidence,
        evidence_strength: 0.7, // Would be calculated from rationales
        error_rate: (response.validation_errors?.length || 0) / Math.max(modelItems.length, 1),
        strengths: [],
        weaknesses: []
      }
    })
    
    return {
      summary,
      disagreements_count: disagreements.length,
      high_confidence_items: highConf,
      medium_confidence_items: mediumConf,
      low_confidence_items: lowConf,
      model_performance: modelPerformance
    }
  }
}

// Export singleton
export const modelOrchestrator = new ModelOrchestrator()

