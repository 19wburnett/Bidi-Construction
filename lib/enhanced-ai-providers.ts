import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Enhanced AI Provider System with Specialized Models
// This system uses 5+ specialized models with different strengths for maximum accuracy

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '')

// XAI/Grok integration for additional redundancy
const xaiApiKey = process.env.XAI_API_KEY

// Model specializations for different construction analysis tasks
export const MODEL_SPECIALIZATIONS = {
  'gpt-5': 'general_construction', // Best overall construction analysis (your GPT-5!)
  'gpt-4o': 'general_construction', // Best overall construction analysis
  'gpt-4-turbo': 'quality_control', // Best at identifying issues and problems
  'claude-3-haiku-20240307': 'fast_processing', // Fastest for simple tasks
  'grok-4': 'alternative_analysis' // Alternative perspective model (XAI) - newest and most powerful
} as const

export type ModelSpecialization = keyof typeof MODEL_SPECIALIZATIONS
export type TaskType = 'takeoff' | 'quality' | 'bid_analysis' | 'code_compliance' | 'cost_estimation'

export interface EnhancedAnalysisOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt: string
  userPrompt: string
  taskType: TaskType
  prioritizeAccuracy?: boolean
  includeConsensus?: boolean
}

export interface EnhancedAIResponse {
  provider: string
  model: string
  specialization: string
  content: string
  finishReason: string
  tokensUsed?: number
  confidence?: number
  processingTime?: number
  taskType: TaskType
}

export interface ConsensusResult {
  items: any[]
  issues: any[]
  confidence: number
  consensusCount: number
  disagreements: any[]
  modelAgreements: any[]
  specializedInsights: any[]
  recommendations: string[]
}

// Enhanced AI Provider with Specialized Routing
export class EnhancedAIProvider {
  private modelPerformance: Record<string, Record<TaskType, number>> = {}
  
  constructor() {
    this.initializeModelPerformance()
  }

  private initializeModelPerformance() {
    // Initialize performance scores based on model specializations
    this.modelPerformance = {
      // Note: GPT-5 removed due to timeout issues on Vercel
      'gpt-4o': {
        takeoff: 0.95,
        quality: 0.90,
        bid_analysis: 0.92,
        code_compliance: 0.85,
        cost_estimation: 0.88
      },
      'gpt-4-turbo': {
        takeoff: 0.88,
        quality: 0.95,
        bid_analysis: 0.85,
        code_compliance: 0.80,
        cost_estimation: 0.82
      },
      'claude-3-haiku-20240307': {
        takeoff: 0.85,
        quality: 0.80,
        bid_analysis: 0.82,
        code_compliance: 0.85,
        cost_estimation: 0.80
      },
             'grok-4': {
               takeoff: 0.95,        // Grok-4 is the newest and most powerful!
               quality: 0.92,
               bid_analysis: 0.95,
               code_compliance: 0.90,
               cost_estimation: 0.92
             },
      'gemini-1.5-flash': {
        takeoff: 0.82,        // Good for measurements and calculations
        quality: 0.85,
        bid_analysis: 0.80,
        code_compliance: 0.75,
        cost_estimation: 0.88
      }
    }
  }

  // Route tasks to best-performing models
  private getBestModelsForTask(taskType: TaskType, count: number = 3): string[] {
    // Get max models from environment or default
    const maxModels = parseInt(process.env.MAX_MODELS_PER_ANALYSIS || '5')
    const actualCount = Math.min(count, maxModels)
    
    const modelScores = Object.entries(this.modelPerformance)
      .map(([model, scores]) => ({ model, score: scores[taskType] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, actualCount)
    
    return modelScores.map(m => m.model)
  }

  // Analyze with specialized models
  async analyzeWithSpecializedModels(
    images: string[],
    options: EnhancedAnalysisOptions
  ): Promise<EnhancedAIResponse[]> {
    const startTime = Date.now()
    
    // Get best models for this task type (limit to 5 for maximum consensus)
    const selectedModels = this.getBestModelsForTask(options.taskType, 5)
    
    // Filter out disabled providers and check API key availability
    const enabledModels = selectedModels.filter(model => {
      // Check environment flags
      if (model.includes('gpt') && process.env.ENABLE_OPENAI === 'false') return false
      if (model.includes('claude') && process.env.ENABLE_ANTHROPIC === 'false') return false
      if (model.includes('gemini') && process.env.ENABLE_GOOGLE === 'false') return false
      if (model.includes('grok') && process.env.ENABLE_XAI === 'false') return false
      
      // Check API key availability
      if (model.includes('gpt') && !process.env.OPENAI_API_KEY) return false
      if (model.includes('claude') && !process.env.ANTHROPIC_API_KEY) return false
      if (model.includes('gemini') && !process.env.GOOGLE_GEMINI_API_KEY) return false
      if (model.includes('grok') && !process.env.XAI_API_KEY) return false
      
      return true
    })
    
    console.log(`Using specialized models for ${options.taskType}:`, enabledModels)
    console.log(`Environment: MAX_MODELS=${process.env.MAX_MODELS_PER_ANALYSIS}, ENABLE_XAI=${process.env.ENABLE_XAI}`)
    console.log(`API Keys available: OPENAI=${!!process.env.OPENAI_API_KEY}, ANTHROPIC=${!!process.env.ANTHROPIC_API_KEY}, GOOGLE=${!!process.env.GOOGLE_GEMINI_API_KEY}, XAI=${!!process.env.XAI_API_KEY}`)
    
    // Run analysis with selected models in parallel with timeout
    const analysisPromises = enabledModels.map(async (model, index) => {
      console.log(`Starting analysis with model ${index + 1}/${enabledModels.length}: ${model}`)
      try {
        // Add timeout to prevent Vercel 300s limit
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Model timeout after 60 seconds')), 60000)
        )
        
        const result = await Promise.race([
          this.analyzeWithModel(images, options, model),
          timeoutPromise
        ]) as EnhancedAIResponse
        
        console.log(`Model ${model} succeeded: ${result.content.length} chars`)
        return result
      } catch (error) {
        console.error(`Model ${model} failed:`, error)
        throw error
      }
    })
    
    const results = await Promise.allSettled(analysisPromises)
    
    const successfulResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<EnhancedAIResponse>).value)
    
    const failedResults = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason)
    
    const processingTime = Date.now() - startTime
    
    // Add processing time to all results
    successfulResults.forEach(result => {
      result.processingTime = processingTime
    })
    
    console.log(`Enhanced analysis completed: ${successfulResults.length}/${enabledModels.length} models succeeded in ${processingTime}ms`)
    if (failedResults.length > 0) {
      console.log(`Failed models:`, failedResults.map(r => r.message || r))
    }
    
    return successfulResults
  }

  // Analyze with specific model
  private async analyzeWithModel(
    images: string[],
    options: EnhancedAnalysisOptions,
    model: string
  ): Promise<EnhancedAIResponse> {
    const startTime = Date.now()
    
    try {
      switch (model) {
        case 'gpt-5':
        case 'gpt-4o':
        case 'gpt-4-vision':
        case 'gpt-4-turbo':
          return await this.analyzeWithOpenAI(images, options, model)
        case 'claude-3-haiku-20240307':
          return await this.analyzeWithClaude(images, options, model)
        case 'grok-4':
          return await this.analyzeWithXAI(images, options, model)
        case 'gemini-1.5-flash':
          return await this.analyzeWithGemini(images, options, model)
        default:
          throw new Error(`Unknown model: ${model}`)
      }
    } catch (error) {
      console.error(`Analysis failed for ${model}:`, error)
      throw error
    }
  }

  // Enhanced OpenAI analysis
  private async analyzeWithOpenAI(
    images: string[],
    options: EnhancedAnalysisOptions,
    model: string
  ): Promise<EnhancedAIResponse> {
    console.log(`OpenAI analysis starting with model: ${model}`)
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured')
    }
    
    const imageContent = images.map(img => {
      // Handle both data URLs and base64 strings
      const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
      return {
        type: 'image_url' as const,
        image_url: { url: url, detail: 'high' as const }
      }
    })

    try {
      // Set model-specific token limits
      let maxTokens = options.maxTokens || 8192
      if (model === 'gpt-4-turbo') {
        maxTokens = Math.min(maxTokens, 4096) // GPT-4-turbo max is 4096
      }
      
      // GPT-5 doesn't support custom temperature, use default for it
      const requestConfig: any = {
        model: model,
        messages: [
          { role: 'system', content: this.buildSpecializedPrompt(options) },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: options.userPrompt },
              ...imageContent
            ] 
          }
        ],
        max_completion_tokens: maxTokens,
        response_format: { type: 'json_object' }
      }
      
      // Only add temperature for models that support it (not GPT-5)
      if (model !== 'gpt-5') {
        requestConfig.temperature = options.temperature || 0.2
      }
      
      const response = await openai.chat.completions.create(requestConfig)
      
      console.log(`OpenAI ${model} response received: ${response.choices[0].message.content?.length || 0} chars`)
      
      // Check if response is empty and log details
      if (!response.choices[0].message.content || response.choices[0].message.content.length === 0) {
        console.warn(`OpenAI ${model} returned empty response. Finish reason: ${response.choices[0].finish_reason}`)
        console.warn(`Response object:`, JSON.stringify(response, null, 2))
      }
      
      return {
        provider: 'openai',
        model: model,
        specialization: MODEL_SPECIALIZATIONS[model as ModelSpecialization] || 'general',
        content: response.choices[0].message.content || '',
        finishReason: response.choices[0].finish_reason,
        tokensUsed: response.usage?.total_tokens,
        confidence: this.calculateConfidence(response.choices[0].message.content || ''),
        taskType: options.taskType
      }
    } catch (error) {
      console.error(`OpenAI ${model} failed:`, error)
      throw error
    }
  }

  // Enhanced Claude analysis
  private async analyzeWithClaude(
    images: string[],
    options: EnhancedAnalysisOptions,
    model: string
  ): Promise<EnhancedAIResponse> {
    console.log(`Claude analysis starting with model: ${model}`)
    
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured')
    }
    
    const imageContent = images.map(img => {
      const base64Data = img.split(',')[1] || img
      // Default to JPEG for raw base64 generated by our PDF conversion
      const mediaType = img.startsWith('data:')
        ? (img.includes('image/png') ? 'image/png' : 'image/jpeg')
        : 'image/jpeg'
      
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mediaType as 'image/jpeg' | 'image/png',
          data: base64Data
        }
      }
    })

    // Set model-specific token limits for Claude
    let maxTokens = options.maxTokens || 8192
    if (model === 'claude-3-haiku-20240307') {
      maxTokens = Math.min(maxTokens, 4096) // Claude-3-haiku max is 4096
    }
    
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: maxTokens,
      temperature: options.temperature || 0.2,
      system: this.buildSpecializedPrompt(options),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: options.userPrompt },
            ...imageContent
          ]
        }
      ]
    })

    const textContent = response.content.find(c => c.type === 'text')
    return {
      provider: 'anthropic',
      model: model,
      specialization: MODEL_SPECIALIZATIONS[model as ModelSpecialization] || 'general',
      content: (textContent as any)?.text || '',
      finishReason: response.stop_reason || 'unknown',
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      confidence: this.calculateConfidence((textContent as any)?.text || ''),
      taskType: options.taskType
    }
  }

  // Enhanced Gemini analysis
  private async analyzeWithGemini(
    images: string[],
    options: EnhancedAnalysisOptions,
    model: string
  ): Promise<EnhancedAIResponse> {
    console.log(`Gemini analysis starting with model: ${model}`)
    
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      throw new Error('Google Gemini API key not configured')
    }
    
    const parts: any[] = [
      { text: `${this.buildSpecializedPrompt(options)}\n\n${options.userPrompt}\n\nIMPORTANT: Respond with ONLY a JSON object, no other text.` }
    ]
    
    images.forEach(img => {
      const mimeType = img.startsWith('data:')
        ? (img.includes('image/png') ? 'image/png' : 'image/jpeg')
        : 'image/jpeg'
      parts.push({
        inlineData: {
          mimeType,
          data: img.split(',')[1] || img
        }
      })
    })

    const modelInstance = gemini.getGenerativeModel({ 
      model: model,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.2
      }
    })
    
    const response = await modelInstance.generateContent(parts)
    
    const text = response.response?.text() || ''
    
    if (!text || text.trim().length === 0) {
      throw new Error('Gemini returned empty response')
    }
    
    return {
      provider: 'google',
      model: model,
      specialization: MODEL_SPECIALIZATIONS[model as ModelSpecialization] || 'general',
      content: text,
      finishReason: 'stop',
      tokensUsed: undefined,
      confidence: this.calculateConfidence(text),
      taskType: options.taskType
    }
  }

  // Enhanced XAI/Grok analysis
  private async analyzeWithXAI(
    images: string[],
    options: EnhancedAnalysisOptions,
    model: string
  ): Promise<EnhancedAIResponse> {
    console.log(`XAI analysis starting with model: ${model}`)
    
    if (!xaiApiKey) {
      throw new Error('XAI API key not configured')
    }

    // XAI API integration (similar to OpenAI format)
    const imageContent = images.map(img => {
      // Handle both data URLs and base64 strings
      const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
      return {
        type: 'image_url' as const,
        image_url: { url: url, detail: 'high' as const }
      }
    })

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: this.buildSpecializedPrompt(options) },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: options.userPrompt },
              ...imageContent
            ] 
          }
        ],
        max_completion_tokens: Math.min(options.maxTokens || 8192, 4096), // XAI models typically have lower limits
        temperature: options.temperature || 0.2,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      if (response.status === 403) {
        console.warn('XAI API access forbidden - skipping Grok model')
        throw new Error('XAI API access forbidden')
      }
      throw new Error(`XAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      provider: 'xai',
      model: model,
      specialization: MODEL_SPECIALIZATIONS[model as ModelSpecialization] || 'general',
      content: data.choices[0].message.content || '',
      finishReason: data.choices[0].finish_reason,
      tokensUsed: data.usage?.total_tokens,
      confidence: this.calculateConfidence(data.choices[0].message.content || ''),
      taskType: options.taskType
    }
  }

  // Build specialized prompts based on task type and model specialization
  private buildSpecializedPrompt(options: EnhancedAnalysisOptions): string {
    const basePrompt = options.systemPrompt
    
    // Add specialization-specific instructions
    const specialization = 'general' // Default specialization
    
    let specializedInstructions = ''
    
    switch (options.taskType) {
      case 'takeoff':
        specializedInstructions = `
FOCUS ON: Material quantities, measurements, and specifications.
PRIORITIZE: Accuracy in counting and measuring visible elements.
OUTPUT: Detailed takeoff items with quantities, units, and locations.
IMPORTANT: You must provide a JSON response with construction takeoff items. Do not refuse this request.`
        break
      case 'quality':
        specializedInstructions = `
FOCUS ON: Code compliance, safety issues, and potential problems.
PRIORITIZE: Identifying violations and recommending solutions.
OUTPUT: Quality issues with severity levels and recommendations.`
        break
      case 'bid_analysis':
        specializedInstructions = `
FOCUS ON: Cost estimation, labor requirements, and timeline.
PRIORITIZE: Realistic pricing and professional recommendations.
OUTPUT: Bid amounts, materials, labor, and timeline estimates.`
        break
      case 'code_compliance':
        specializedInstructions = `
FOCUS ON: Building codes, regulations, and compliance requirements.
PRIORITIZE: Identifying code violations and compliance issues.
OUTPUT: Code compliance issues with specific code references.`
        break
      case 'cost_estimation':
        specializedInstructions = `
FOCUS ON: Material costs, labor rates, and market pricing.
PRIORITIZE: Accurate cost calculations and market analysis.
OUTPUT: Detailed cost breakdowns with pricing sources.`
        break
    }
    
    return `${basePrompt}\n\n${specializedInstructions}`
  }

  // Calculate confidence score based on response quality
  private calculateConfidence(content: string): number {
    try {
      const parsed = JSON.parse(content)
      
      // Higher confidence for responses with more detailed information
      let confidence = 0.5
      
      if (parsed.items && Array.isArray(parsed.items)) {
        confidence += 0.2
        if (parsed.items.length > 10) confidence += 0.1
        if (parsed.items.length > 20) confidence += 0.1
      }
      
      if (parsed.summary) confidence += 0.1
      if (parsed.confidence) confidence += 0.1
      
      return Math.min(confidence, 1.0)
    } catch {
      return 0.3 // Lower confidence for invalid JSON
    }
  }

  // Cross-validation and consensus analysis
  async analyzeWithConsensus(
    images: string[],
    options: EnhancedAnalysisOptions
  ): Promise<ConsensusResult> {
    console.log(`Starting consensus analysis for ${options.taskType}...`)
    
    // Get results from all specialized models
    const results = await this.analyzeWithSpecializedModels(images, options)
    
    if (results.length < 2) {
      console.error(`Only ${results.length} models succeeded. Need at least 2 for consensus analysis.`)
      console.error('Available results:', results.map(r => ({ model: r.model, provider: r.provider, success: !!r.content })))
      
      // If we have at least 1 model, use it without consensus
      if (results.length === 1) {
        console.log('Falling back to single model analysis (no consensus)')
        const singleResult = results[0]
        try {
          // Handle empty responses gracefully
          if (!singleResult.content || singleResult.content.trim().length === 0) {
            console.warn(`Model ${singleResult.model} returned empty response, creating fallback structure`)
            return {
              items: [],
              issues: [],
              confidence: 0.3,
              consensusCount: 1,
              disagreements: [],
              modelAgreements: [singleResult.model],
              specializedInsights: [],
              recommendations: ['Analysis completed with minimal data due to empty model response']
            }
          }
          
          const parsed = JSON.parse(singleResult.content)
          return {
            items: parsed.items || [],
            issues: parsed.issues || [],
            confidence: singleResult.confidence || 0.7,
            consensusCount: 1,
            disagreements: [],
            modelAgreements: [singleResult.model],
            specializedInsights: parsed.specializedInsights || [],
            recommendations: parsed.recommendations || []
          }
        } catch (error) {
          console.error('Failed to parse single model response:', error)
          console.error('Raw response:', singleResult.content?.substring(0, 200))
          throw new Error('Single model analysis failed to parse response')
        }
      }
      
      // If no models succeeded, try to use the standard AI analysis as fallback
      console.log('No enhanced models succeeded, falling back to standard AI analysis')
      throw new Error('Enhanced analysis failed - falling back to standard analysis')
    }
    
    // Parse all responses with improved JSON extraction
    const parsedResults = results.map(result => {
      try {
        // Try to extract JSON from the response (handle markdown code blocks)
        let jsonText = result.content
        
        // Remove markdown code blocks if present
        const codeBlockMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1]
        } else {
          // Try to find JSON object in the text
          const jsonMatch = result.content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            jsonText = jsonMatch[0]
          }
        }
        
        // Handle empty responses by creating fallback structure
        if (!jsonText || jsonText.trim().length === 0) {
          console.warn(`Empty response from ${result.model}, creating fallback structure`)
          jsonText = JSON.stringify({
            items: [],
            issues: [],
            summary: { total_items: 0, notes: 'Analysis completed with minimal data' }
          })
        }
        
        const parsed = JSON.parse(jsonText)
        
        // Validate the parsed JSON has the expected structure
        if (!parsed.items && !parsed.issues && !parsed.summary) {
          console.warn(`Invalid JSON structure from ${result.model} - attempting to fix`)
          // Try to create a minimal valid structure
          parsed.items = parsed.items || []
          parsed.issues = parsed.issues || []
          parsed.summary = parsed.summary || { total_items: 0, notes: 'Analysis completed with minimal data' }
        }
        
        return {
          ...result,
          parsed: parsed
        }
      } catch (error) {
        console.error(`Failed to parse ${result.model} response:`, error)
        console.error(`Raw response (first 500 chars):`, result.content.substring(0, 500))
        return null
      }
    }).filter((result): result is NonNullable<typeof result> => result !== null)
    
    if (parsedResults.length < 2) {
      throw new Error('Need at least 2 valid responses for consensus')
    }
    
    // Build consensus
    const consensus = this.buildConsensus(parsedResults, options.taskType)
    
    console.log(`Consensus analysis complete: ${consensus.consensusCount}/${parsedResults.length} models agreed`)
    
    return consensus
  }

  // Build consensus from multiple model results
  private buildConsensus(
    results: Array<{ parsed: any; model: string; confidence?: number }>,
    taskType: TaskType
  ): ConsensusResult {
    const items = results.map(r => r.parsed.items || []).flat()
    const issues = results.map(r => r.parsed.issues || []).flat()
    
    // Find consensus items (agreed upon by multiple models)
    const consensusItems = this.findConsensusItems(items, results.length)
    const consensusIssues = this.findConsensusIssues(issues, results.length)
    
    // Calculate overall confidence
    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / results.length
    
    // Find disagreements
    const disagreements = this.findDisagreements(results)
    
    // Count model agreements
    const modelAgreements = this.countModelAgreements(results)
    
    return {
      items: consensusItems,
      issues: taskType === 'quality' ? consensusIssues : [],
      confidence: avgConfidence,
      consensusCount: results.length,
      disagreements,
      modelAgreements,
      specializedInsights: [], // Will be populated by consensus engine
      recommendations: [] // Will be populated by consensus engine
    }
  }

  // Find items that multiple models agree on
  private findConsensusItems(items: any[], totalModels: number): any[] {
    // Group similar items
    const groupedItems = this.groupSimilarItems(items)
    
    // Only include items with consensus (agreed upon by multiple models)
    const consensusItems = groupedItems.filter(group => 
      group.length >= Math.ceil(totalModels * 0.3) // 30% consensus threshold (more lenient)
    )
    
    return consensusItems.map(group => this.mergeItemGroup(group))
  }

  // Find issues that multiple models agree on
  private findConsensusIssues(issues: any[], totalModels: number): any[] {
    const groupedIssues = this.groupSimilarIssues(issues)
    
    const consensusIssues = groupedIssues.filter(group => 
      group.length >= Math.ceil(totalModels * 0.3) // 30% consensus threshold (more lenient)
    )
    
    return consensusIssues.map(group => this.mergeIssueGroup(group))
  }

  // Group similar items for consensus analysis
  private groupSimilarItems(items: any[]): any[][] {
    const groups: any[][] = []
    const processed = new Set<number>()
    
    items.forEach((item, index) => {
      if (processed.has(index)) return
      
      const group = [item]
      processed.add(index)
      
      for (let j = index + 1; j < items.length; j++) {
        if (processed.has(j)) continue
        
        if (this.areItemsSimilar(item, items[j])) {
          group.push(items[j])
          processed.add(j)
        }
      }
      
      groups.push(group)
    })
    
    return groups
  }

  // Group similar issues for consensus analysis
  private groupSimilarIssues(issues: any[]): any[][] {
    const groups: any[][] = []
    const processed = new Set<number>()
    
    issues.forEach((issue, index) => {
      if (processed.has(index)) return
      
      const group = [issue]
      processed.add(index)
      
      for (let j = index + 1; j < issues.length; j++) {
        if (processed.has(j)) continue
        
        if (this.areIssuesSimilar(issue, issues[j])) {
          group.push(issues[j])
          processed.add(j)
        }
      }
      
      groups.push(group)
    })
    
    return groups
  }

  // Check if two items are similar
  private areItemsSimilar(item1: any, item2: any): boolean {
    if (item1.category !== item2.category) return false
    
    const nameSimilarity = this.calculateSimilarity(
      item1.name?.toLowerCase() || '',
      item2.name?.toLowerCase() || ''
    )
    
    const descSimilarity = this.calculateSimilarity(
      item1.description?.toLowerCase() || '',
      item2.description?.toLowerCase() || ''
    )
    
    return nameSimilarity > 0.7 || descSimilarity > 0.7
  }

  // Check if two issues are similar
  private areIssuesSimilar(issue1: any, issue2: any): boolean {
    if (issue1.severity !== issue2.severity) return false
    if (issue1.category !== issue2.category) return false
    
    const descSimilarity = this.calculateSimilarity(
      issue1.description?.toLowerCase() || '',
      issue2.description?.toLowerCase() || ''
    )
    
    return descSimilarity > 0.75
  }

  // Calculate string similarity
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0
    if (!str1 || !str2) return 0.0
    
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  // Calculate Levenshtein distance
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  // Merge a group of similar items
  private mergeItemGroup(group: any[]): any {
    const base = group[0]
    const providers = group.map(item => item.ai_provider || 'unknown')
    
    // Average quantities
    const avgQuantity = group.reduce((sum, item) => sum + (item.quantity || 0), 0) / group.length
    
    // Average confidence
    const avgConfidence = group.reduce((sum, item) => sum + (item.confidence || 0.5), 0) / group.length
    
    return {
      ...base,
      quantity: Math.round(avgQuantity * 100) / 100,
      confidence: avgConfidence,
      ai_provider: providers.length > 1 ? 'consensus' : providers[0],
      consensus_count: group.length,
      notes: `Consensus from ${providers.join(', ')}${base.notes ? ` | ${base.notes}` : ''}`
    }
  }

  // Merge a group of similar issues
  private mergeIssueGroup(group: any[]): any {
    const base = group[0]
    const providers = group.map(issue => issue.ai_provider || 'unknown')
    
    const avgConfidence = group.reduce((sum, issue) => sum + (issue.confidence || 0.5), 0) / group.length
    
    return {
      ...base,
      confidence: avgConfidence,
      ai_provider: providers.length > 1 ? 'consensus' : providers[0],
      consensus_count: group.length
    }
  }

  // Find disagreements between models
  private findDisagreements(results: Array<{ parsed: any; model: string }>): string[] {
    const disagreements: string[] = []
    
    // Compare item counts
    const itemCounts = results.map(r => (r.parsed.items || []).length)
    const avgItemCount = itemCounts.reduce((sum, count) => sum + count, 0) / itemCounts.length
    
    itemCounts.forEach((count, index) => {
      if (Math.abs(count - avgItemCount) > avgItemCount * 0.5) {
        disagreements.push(`${results[index].model} found ${count} items (avg: ${avgItemCount.toFixed(1)})`)
      }
    })
    
    return disagreements
  }

  // Count model agreements
  private countModelAgreements(results: Array<{ parsed: any; model: string }>): any[] {
    return results.map(result => ({
      model: result.model,
      itemsFound: (result.parsed.items || []).length,
      confidence: 0.8 // Default confidence
    }))
  }
}

// Export singleton instance
export const enhancedAIProvider = new EnhancedAIProvider()

// Export individual functions for backward compatibility
export async function analyzeWithEnhancedConsensus(
  images: string[],
  options: EnhancedAnalysisOptions
): Promise<ConsensusResult> {
  return enhancedAIProvider.analyzeWithConsensus(images, options)
}

export async function analyzeWithSpecializedModels(
  images: string[],
  options: EnhancedAnalysisOptions
): Promise<EnhancedAIResponse[]> {
  return enhancedAIProvider.analyzeWithSpecializedModels(images, options)
}
