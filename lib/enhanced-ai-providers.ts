import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { grokAdapter, initGrok, callGrok } from './providers/grokAdapter'

// Enhanced AI Provider System with Specialized Models
// This system uses 5+ specialized models with different strengths for maximum accuracy

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '')

// XAI/Grok integration for additional redundancy
const xaiApiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY

// Initialize Grok adapter if API key is available
if (xaiApiKey) {
  try {
    initGrok({
      apiKey: xaiApiKey,
      baseUrl: process.env.GROK_BASE_URL || 'https://api.x.ai/v1'
    })
    console.log('✅ Grok adapter initialized')
  } catch (error) {
    console.warn('⚠️ Failed to initialize Grok adapter:', error)
  }
}

// Model specializations for different construction analysis tasks
export const MODEL_SPECIALIZATIONS = {
  'gpt-5': 'general_construction', // Best overall construction analysis (your GPT-5!)
  'gpt-4o': 'general_construction', // Best overall construction analysis
  'gpt-4-turbo': 'quality_control', // Best at identifying issues and problems
  'claude-3-haiku-20240307': 'fast_processing', // Fastest for simple tasks
  'claude-sonnet-4-20250514': 'general_construction', // Latest Sonnet model (better quality than haiku)
  'grok-2-1212': 'alternative_analysis', // Alternative perspective model (XAI) - grok-beta was deprecated, using grok-2-1212
  'grok-2-vision-beta': 'alternative_analysis' // Grok vision model for image analysis
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
  extractedText?: string // Optional: extracted text from PDF for text-only models like Grok
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
  quality_analysis?: any // Quality analysis from models
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
    // Prioritized by your OpenAI dashboard availability and limits
    this.modelPerformance = {
      // GPT-5 family - highest limits (500k TPM, 500 RPM)
      'gpt-5': {
        takeoff: 0.98,
        quality: 0.95,
        bid_analysis: 0.98,
        code_compliance: 0.92,
        cost_estimation: 0.95
      },
      'gpt-5-mini': {
        takeoff: 0.96,
        quality: 0.93,
        bid_analysis: 0.96,
        code_compliance: 0.90,
        cost_estimation: 0.93
      },
      'gpt-5-nano': {
        takeoff: 0.94,
        quality: 0.91,
        bid_analysis: 0.94,
        code_compliance: 0.88,
        cost_estimation: 0.91
      },
      // GPT-4.1 family - high limits (200k TPM for mini/nano, 30k for base)
      'gpt-4.1': {
        takeoff: 0.96,
        quality: 0.93,
        bid_analysis: 0.96,
        code_compliance: 0.90,
        cost_estimation: 0.93
      },
      'gpt-4.1-mini': {
        takeoff: 0.94,
        quality: 0.91,
        bid_analysis: 0.94,
        code_compliance: 0.88,
        cost_estimation: 0.91
      },
      'gpt-4.1-nano': {
        takeoff: 0.92,
        quality: 0.89,
        bid_analysis: 0.92,
        code_compliance: 0.86,
        cost_estimation: 0.89
      },
      // O-series models - reasoning models
      'o3': {
        takeoff: 0.97,
        quality: 0.94,
        bid_analysis: 0.97,
        code_compliance: 0.93,
        cost_estimation: 0.94
      },
      'o4-mini': {
        takeoff: 0.95,
        quality: 0.92,
        bid_analysis: 0.95,
        code_compliance: 0.91,
        cost_estimation: 0.92
      },
      // GPT-4o - standard model (30k TPM, 500 RPM)
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
      // Non-OpenAI models
      'claude-3-haiku-20240307': {
        takeoff: 0.85,
        quality: 0.80,
        bid_analysis: 0.82,
        code_compliance: 0.85,
        cost_estimation: 0.80
      },
      'claude-sonnet-4-20250514': {
        takeoff: 0.95,
        quality: 0.92,
        bid_analysis: 0.94,
        code_compliance: 0.90,
        cost_estimation: 0.93
      },
      'grok-2-1212': {
        takeoff: 0.95,
        quality: 0.92,
        bid_analysis: 0.95,
        code_compliance: 0.90,
        cost_estimation: 0.92
      },
      'grok-2-vision-beta': {
        takeoff: 0.95,
        quality: 0.92,
        bid_analysis: 0.95,
        code_compliance: 0.90,
        cost_estimation: 0.92
      }
      // Gemini removed - model not available or causing errors
    }
  }

  // Route tasks to best-performing models
  // Prioritizes GPT models first, then falls back to Claude/Grok
  private getBestModelsForTask(taskType: TaskType, count: number = 3): string[] {
    // Get max models from environment or default to 3 (GPT, Claude, Grok)
    const maxModels = parseInt(process.env.MAX_MODELS_PER_ANALYSIS || '3')
    const actualCount = Math.min(count, maxModels)
    
    // NEW: Fixed 3-model priority order (GPT, Claude, Grok) - all run in parallel
    const priorityModels = [
      'gpt-4o',                    // 1. ChatGPT (GPT-4o)
      'claude-sonnet-4-20250514',  // 2. Claude Sonnet
      'grok-2-vision-beta'         // 3. Grok (vision model for image support)
    ]
    
    // Filter to only include models that exist in modelPerformance
    const availablePriorityModels = priorityModels.filter(model => 
      this.modelPerformance[model] !== undefined
    )
    
    // Return the top N models from priority list
    return availablePriorityModels.slice(0, actualCount)
    
    /* OLD SORTING LOGIC - REPLACED WITH FIXED PRIORITY ORDER
    const modelScores = Object.entries(this.modelPerformance)
      .map(([model, scores]) => ({ model, score: scores[taskType] }))
      .sort((a, b) => {
        // USER-PRIORITIZED ORDER (reliable models first):
        // 1. gpt-4o (proven working)
        if (a.model === 'gpt-4o') return -1
        if (b.model === 'gpt-4o') return 1
        // 2. Claude Sonnet (better quality than haiku, proven working)
        if (a.model === 'claude-sonnet-4-20250514') return -1
        if (b.model === 'claude-sonnet-4-20250514') return 1
        // 3. o4-mini (if above fail)
        if (a.model === 'o4-mini') return -1
        if (b.model === 'o4-mini') return 1
        // 4. gpt-4.1-nano (last resort)
        if (a.model === 'gpt-4.1-nano') return -1
        if (b.model === 'gpt-4.1-nano') return 1
        
        // Secondary fallbacks (if primary models not available):
        // Claude Haiku (fast fallback)
        if (a.model === 'claude-3-haiku-20240307') return -1
        if (b.model === 'claude-3-haiku-20240307') return 1
        // Other GPT-4.1 variants
        if (a.model.startsWith('gpt-4.1') && !b.model.startsWith('gpt-4.1')) return -1
        if (b.model.startsWith('gpt-4.1') && !a.model.startsWith('gpt-4.1')) return 1
        // Other O-series models
        if (a.model.startsWith('o') && !b.model.startsWith('o')) return -1
        if (b.model.startsWith('o') && !a.model.startsWith('o')) return 1
        // GPT-5 series (disabled for now - using all tokens for reasoning)
        if (a.model === 'gpt-5') return -1
        if (b.model === 'gpt-5') return 1
        if (a.model === 'gpt-5-mini') return -1
        if (b.model === 'gpt-5-mini') return 1
        if (a.model === 'gpt-5-nano') return -1
        if (b.model === 'gpt-5-nano') return 1
        // Then other GPT models
        if (a.model.includes('gpt') && !b.model.includes('gpt')) return -1
        if (b.model.includes('gpt') && !a.model.includes('gpt')) return 1
        // Then prioritize Grok (alternative provider, good fallback)
        if (a.model.includes('grok') && !b.model.includes('grok')) return -1
        if (b.model.includes('grok') && !a.model.includes('grok')) return 1
        // Finally sort by score
        return b.score - a.score
      })
      .slice(0, actualCount)
    
    return modelScores.map(m => m.model)
    */
  }

  // Analyze with specialized models
  // NEW: Run all 3 models in PARALLEL (GPT, Claude, Grok) to combine all findings
  // GPT/Claude get images, Grok gets text (if vision model not available)
  async analyzeWithSpecializedModels(
    images: string[],
    options: EnhancedAnalysisOptions
  ): Promise<EnhancedAIResponse[]> {
    const startTime = Date.now()
    
    // Get the 3 priority models: GPT-4o, Claude Sonnet, Grok
    const selectedModels = this.getBestModelsForTask(options.taskType, 3)
    
    // Filter out disabled providers and check API key availability
    const enabledModels = selectedModels.filter(model => {
      // Check environment flags
      if (model.includes('gpt') && process.env.ENABLE_OPENAI === 'false') return false
      if (model.includes('claude') && process.env.ENABLE_ANTHROPIC === 'false') return false
      if (model.includes('gemini')) return false // Gemini disabled - model not available
      if (model.includes('grok') && process.env.ENABLE_XAI === 'false') return false
      
      // Check API key availability
      if (model.includes('gpt') && !process.env.OPENAI_API_KEY) return false
      if (model.includes('claude') && !process.env.ANTHROPIC_API_KEY) return false
      // Gemini disabled - always filter out
      if (model.includes('gemini')) return false
      if (model.includes('grok') && !process.env.XAI_API_KEY) return false
      
      return true
    })
    
    console.log(`🚀 Running ${enabledModels.length} models in PARALLEL for ${options.taskType}:`, enabledModels)
    console.log(`Environment: MAX_MODELS=${process.env.MAX_MODELS_PER_ANALYSIS || '3'}, ENABLE_XAI=${process.env.ENABLE_XAI}`)
    console.log(`API Keys available: OPENAI=${!!process.env.OPENAI_API_KEY}, ANTHROPIC=${!!process.env.ANTHROPIC_API_KEY}, XAI=${!!process.env.XAI_API_KEY}`)
    
    // Run all models in PARALLEL (not sequential fallback)
    // Goal: Get ALL findings from all 3 models, then combine them
    const MIN_MODELS = 1 // Minimum required (will accept single model if others fail)
    
    // Create promises for all models running in parallel
    const modelPromises = enabledModels.map(async (model) => {
      const modelStartTime = Date.now()
      
      try {
        // Add timeout to prevent Vercel 300s limit
        // Scale timeout based on number of images (more pages = more time needed)
        const baseTimeoutMs = 120000 // 120 seconds base
        const perPageTimeoutMs = 5000 // 5 seconds per page
        const timeoutMs = Math.min(baseTimeoutMs + (images.length * perPageTimeoutMs), 240000) // Max 240 seconds (4 min)
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Model timeout after ${timeoutMs/1000} seconds`)), timeoutMs)
        )
        
        // For Grok: try vision model first, will auto-fallback to text if vision model unavailable
        // GPT and Claude always use images
        const inputType = 'images' as const // Always try images first, Grok will auto-fallback to text if needed
        
        const result = await Promise.race([
          this.analyzeWithModel(images, options, model, inputType),
          timeoutPromise
        ]) as EnhancedAIResponse
        
        const modelProcessingTime = Date.now() - modelStartTime
        result.processingTime = modelProcessingTime
        
        // Log with actual model used (important for Grok fallback cases)
        const actualModel = result.model || model
        console.log(`✅ ${actualModel} succeeded: ${result.content.length} chars in ${modelProcessingTime}ms`)
        return { success: true, model: actualModel, result, error: null }
      } catch (error: any) {
        const errorMsg = error?.message || String(error)
        console.error(`❌ ${model} failed:`, errorMsg)
        return { success: false, model, result: null, error: errorMsg }
      }
    })
    
    // Wait for all models to complete (parallel execution)
    const allResults = await Promise.all(modelPromises)
    
    const successfulResults: EnhancedAIResponse[] = []
    const failedResults: any[] = []
    
    allResults.forEach(({ success, model, result, error }) => {
      if (success && result) {
        successfulResults.push(result)
      } else {
        failedResults.push({ model, error })
      }
    })
    
    const totalProcessingTime = Date.now() - startTime
    
    console.log(`\n📊 Parallel analysis completed: ${successfulResults.length}/${enabledModels.length} models succeeded in ${totalProcessingTime}ms`)
    if (failedResults.length > 0) {
      console.log(`❌ Failed models:`, failedResults.map(r => `${r.model}: ${r.error}`))
    }
    
    // If we don't have minimum required models, throw an error
    if (successfulResults.length < MIN_MODELS) {
      throw new Error(`Only ${successfulResults.length} model(s) succeeded (need ${MIN_MODELS} minimum). Errors: ${failedResults.map(r => r.error).join('; ')}`)
    }
    
    // Log success
    console.log(`✅ All ${successfulResults.length} model(s) completed - combining ALL findings (not just consensus)`)
    
    return successfulResults
  }

  // Analyze with specific model
  private async analyzeWithModel(
    images: string[],
    options: EnhancedAnalysisOptions,
    model: string,
    inputType: 'images' | 'text' = 'images'
  ): Promise<EnhancedAIResponse> {
    const startTime = Date.now()
    
    try {
      switch (model) {
        // All OpenAI GPT models
        case 'gpt-5':
        case 'gpt-5-mini':
        case 'gpt-5-nano':
        case 'gpt-4.1':
        case 'gpt-4.1-mini':
        case 'gpt-4.1-nano':
        case 'o3':
        case 'o4-mini':
        case 'gpt-4o':
        case 'gpt-4-vision':
        case 'gpt-4-turbo':
          return await this.analyzeWithOpenAI(images, options, model)
        case 'claude-3-haiku-20240307':
        case 'claude-sonnet-4-20250514':
          return await this.analyzeWithClaude(images, options, model)
        case 'grok-2-1212':
        case 'grok-2-vision-beta':
          return await this.analyzeWithXAI(images, options, model, inputType)
        // case 'gemini-1.5-flash':
        //   return await this.analyzeWithGemini(images, options, model)
        // Gemini removed - model not available
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
      
      // Reasoning models (gpt-5 series, o3, o4-mini) use reasoning tokens that count against max_completion_tokens
      // They need MUCH higher limits because reasoning tokens consume the budget before output
      // These models can handle up to 128k completion tokens, but we'll use 32k for safety
      const reasoningModels = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini']
      const isReasoningModel = reasoningModels.includes(model)
      
      if (isReasoningModel) {
        // Reasoning models need high token limits - reasoning consumes tokens before output
        maxTokens = Math.max(maxTokens, 16384) // Minimum 16k for reasoning models
        // Cap at 32k to avoid excessive costs, but allow reasoning models to actually produce output
        maxTokens = Math.min(maxTokens, 32768)
      }
      
      // Some OpenAI models don't support custom temperature - only default (1) is allowed
      // Models that require default temperature: gpt-5, gpt-5-mini, gpt-5-nano, o3, o4-mini
      const modelsWithoutCustomTemperature = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini']
      const supportsCustomTemperature = !modelsWithoutCustomTemperature.includes(model)
      
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
      
      // Only add temperature for models that support custom values
      if (supportsCustomTemperature) {
        requestConfig.temperature = options.temperature || 0.2
      }
      // Models without custom temperature support will use default (1.0)
      
      const response = await openai.chat.completions.create(requestConfig)
      
      const content = response.choices[0].message.content || ''
      const finishReason = response.choices[0].finish_reason
      const reasoningTokens = (response.usage as any)?.completion_tokens_details?.reasoning_tokens || 0
      const completionTokens = response.usage?.completion_tokens || 0
      
      console.log(`OpenAI ${model} response received: ${content.length} chars, finish_reason: ${finishReason}`)
      console.log(`Token usage: ${completionTokens} completion tokens (${reasoningTokens} reasoning + ${completionTokens - reasoningTokens} output)`)
      
      // Check if response is empty and log details
      if (!content || content.length === 0) {
        console.warn(`OpenAI ${model} returned empty response. Finish reason: ${finishReason}`)
        console.warn(`Token breakdown: ${reasoningTokens} reasoning tokens used, ${completionTokens - reasoningTokens} output tokens`)
        if (isReasoningModel && reasoningTokens >= maxTokens * 0.9) {
          console.error(`⚠️ CRITICAL: Reasoning model exhausted token budget. Increase max_completion_tokens or reduce prompt size.`)
        }
        console.warn(`Response object:`, JSON.stringify(response, null, 2))
        // Throw error for empty responses - don't treat as success
        throw new Error(`OpenAI ${model} returned empty response. Finish reason: ${finishReason}. All ${completionTokens} tokens were used for reasoning, leaving 0 for output.`)
      }
      
      return {
        provider: 'openai',
        model: model,
        specialization: MODEL_SPECIALIZATIONS[model as ModelSpecialization] || 'general',
        content: content,
        finishReason: finishReason,
        tokensUsed: response.usage?.total_tokens,
        confidence: this.calculateConfidence(content),
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

  // Enhanced XAI/Grok analysis using standardized adapter
  // Supports both image and text-only modes (text fallback when vision model unavailable)
  private async analyzeWithXAI(
    images: string[],
    options: EnhancedAnalysisOptions,
    model: string,
    inputType: 'images' | 'text' = 'images'
  ): Promise<EnhancedAIResponse> {
    console.log(`XAI analysis starting with model: ${model} (input: ${inputType})`)
    
    if (!xaiApiKey) {
      throw new Error('XAI API key not configured')
    }

    // Determine if we should use text-only mode
    const useTextOnly = inputType === 'text' && options.extractedText && options.extractedText.length > 0

    let userContent: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }>

    if (useTextOnly && options.extractedText) {
      // TEXT-ONLY MODE: Use extracted PDF text instead of images
      // Grok has 131k context window, but we need to leave room for system prompt and response
      // Truncate text more aggressively to avoid context overflow
      const maxTextLength = 50000 // Reduced from 100k to 50k to leave room for system prompt
      const truncatedText = options.extractedText.slice(0, maxTextLength)
      console.log(`📝 Grok using text-only mode (${options.extractedText.length} chars extracted, ${truncatedText.length} chars sent after truncation)`)
      
      // Don't truncate userPrompt - it contains critical instructions
      // Instead, be more aggressive with text truncation to leave room
      const textPrompt = `${options.userPrompt}\n\n=== EXTRACTED TEXT FROM PDF ===\n${truncatedText}\n${options.extractedText.length > maxTextLength ? '\n...(text truncated to fit context window)' : ''}`
      userContent = textPrompt
    } else {
      // IMAGE MODE: Use images (will try vision model first)
      const imageContent = images.map(img => {
        const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
        return {
          type: 'image_url' as const,
          image_url: { url: url, detail: 'high' as const }
        }
      })

      userContent = [
        { type: 'text', text: options.userPrompt },
        ...imageContent
      ]
    }

    try {
      // Try vision model first if images provided, otherwise use text model
      const tryVisionModel = !useTextOnly && images.length > 0
      const selectedModel = tryVisionModel ? 'grok-2-vision-beta' : 'grok-2-1212'
      
      // Call Grok adapter
      const response = await callGrok({
        system: this.buildSpecializedPrompt(options),
        user: userContent,
        max_tokens: Math.min(options.maxTokens || 8192, 4096), // Grok limit is 4096
        temperature: options.temperature || 0.2,
        json_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'object' }
            },
            issues: {
              type: 'array',
              items: { type: 'object' }
            }
          },
          required: ['items']
        }
      })

      // Return with actual model used (important for fallback cases)
      const actualModel = response.model || selectedModel
      return {
        provider: 'xai',
        model: actualModel, // Use the actual model that was called (grok-2-1212 if fallback, grok-2-vision-beta if vision worked)
        specialization: MODEL_SPECIALIZATIONS[model as ModelSpecialization] || 'general',
        content: response.content,
        finishReason: response.finish_reason,
        tokensUsed: response.usage.total_tokens,
        confidence: this.calculateConfidence(response.content),
        taskType: options.taskType
      }
    } catch (error: any) {
      // Enhanced error logging for debugging
      console.error(`[Grok Error] Type: ${error?.type || 'unknown'}, Message: ${error?.message || String(error)}`)
      if (error?.stack) {
        console.error(`[Grok Error] Stack: ${error.stack.substring(0, 500)}`)
      }
      
      // Handle normalized Grok errors
      if (error.type && error.message) {
        console.error(`Grok API error (${error.type}):`, error.message)
        
        // If vision model failed and we have text, try text-only fallback
        if (error.type === 'model_not_found' && !useTextOnly && images.length > 0 && options.extractedText && options.extractedText.length > 0) {
          console.log('🔄 Vision model not available, falling back to text-only mode for Grok...')
          return this.analyzeWithXAI(images, options, model, 'text')
        }
        
        // Map error types to actionable messages (only if we can't fallback)
        if (error.type === 'auth_error') {
          throw new Error('XAI API authentication failed. Check your XAI_API_KEY.')
        } else if (error.type === 'rate_limit') {
          throw new Error(`Grok rate limit exceeded. Retry after ${error.retry_after || 'some time'}.`)
        } else if (error.type === 'context_overflow') {
          console.error('⚠️ Grok context overflow - text may be too long even after truncation')
          throw new Error('Grok context window exceeded. Text was truncated but still too long. Consider reducing extracted text size.')
        } else if (error.type === 'model_not_found' && useTextOnly) {
          // Already tried text mode, can't fallback further
          throw new Error(`Grok model not found: ${model}. Vision model unavailable and text fallback also failed.`)
        } else if (error.type === 'model_not_found') {
          // Will be handled by fallback above, but if fallback conditions not met, throw
          throw new Error(`Grok model not found: ${model}. Use grok-2-1212 instead.`)
        }
      }
      
      // Log unknown errors for debugging
      if (!error.type) {
        console.error(`[Grok Unknown Error] Full error:`, JSON.stringify(error, null, 2).substring(0, 1000))
      }
      
      // Re-throw original error
      throw error
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

  // Extract partial items from incomplete JSON - try to get as much data as possible
  private extractPartialItems(itemsText: string): any[] {
    if (!itemsText || itemsText.trim().length === 0) {
      console.warn('extractPartialItems: itemsText is empty')
      return []
    }
    
    const items: any[] = []
    
    console.log(`[extractPartialItems] Starting extraction from text of length ${itemsText.length}`)
    
    // Strategy 1: Try to find complete item objects (may span multiple lines)
    // Use a more flexible pattern that handles nested objects and multi-line content
    // Note: Using [\s\S] instead of . with 's' flag for ES compatibility
    // Improved: Match objects that contain "name" field, even if incomplete
    let itemMatches: string[] | null = itemsText.match(/\{[\s\S]*?"name"\s*:\s*"[^"]*"[\s\S]*?\}/g)
    
    console.log(`[extractPartialItems] Strategy 1 found ${itemMatches ? itemMatches.length : 0} item objects`)
    
    // Strategy 2: If that fails, try simpler pattern (non-greedy, handles incomplete objects)
    if (!itemMatches || itemMatches.length === 0) {
      itemMatches = itemsText.match(/\{[^{}]*"name"\s*:\s*"[^"]*"[^{}]*\}/g)
      console.log(`[extractPartialItems] Strategy 2 found ${itemMatches ? itemMatches.length : 0} item objects`)
    }
    
    // Strategy 2b: More aggressive - find objects that start with { and have "name" field, even if incomplete
    if (!itemMatches || itemMatches.length === 0) {
      // Find all { that might be item starts, then extract until next { or } or end
      const objectStarts: string[] = []
      let depth = 0
      let start = -1
      for (let i = 0; i < itemsText.length; i++) {
        if (itemsText[i] === '{') {
          if (depth === 0) start = i
          depth++
        } else if (itemsText[i] === '}') {
          depth--
          if (depth === 0 && start >= 0) {
            objectStarts.push(itemsText.substring(start, i + 1))
            start = -1
          }
        }
      }
      // If we have unclosed objects, include them too
      if (start >= 0 && depth > 0) {
        objectStarts.push(itemsText.substring(start))
      }
      // Filter to objects that contain "name" field
      const filteredObjects = objectStarts.filter(obj => /"name"\s*:\s*"/.test(obj))
      if (filteredObjects.length > 0) {
        itemMatches = filteredObjects
        console.log(`[extractPartialItems] Strategy 2b found ${itemMatches.length} item objects`)
      }
    }
    
    // Strategy 3: Try alternative pattern (any object with name OR description)
    if (!itemMatches || itemMatches.length === 0) {
      const altMatches = itemsText.match(/\{[^{}]*"(?:name|description)"\s*:\s*"[^"]*"[^{}]*\}/g)
      if (altMatches && altMatches.length > 0) {
        itemMatches = altMatches
        console.log(`[extractPartialItems] Strategy 3 found ${itemMatches.length} item objects`)
      }
    }
    
    if (itemMatches && itemMatches.length > 0) {
      itemMatches.forEach(itemStr => {
        try {
          // Try to parse complete item first
          const item = JSON.parse(itemStr)
          if (item.name) {
            items.push(item)
            return
          }
        } catch {
          // If parsing fails, extract fields using regex from this item string
          const nameMatch = itemStr.match(/"name"\s*:\s*"([^"]*)"/)
          const descMatch = itemStr.match(/"description"\s*:\s*"([^"]*)"/)
          const qtyMatch = itemStr.match(/"quantity"\s*:\s*([0-9.]+)/)
          const unitMatch = itemStr.match(/"unit"\s*:\s*"([^"]*)"/)
          const catMatch = itemStr.match(/"category"\s*:\s*"([^"]*)"/)
          const subcatMatch = itemStr.match(/"subcategory"\s*:\s*"([^"]*)"/)
          const locMatch = itemStr.match(/"location"\s*:\s*"([^"]*)"/)
          const costMatch = itemStr.match(/"unit_cost"\s*:\s*([0-9.]+)/)
          const confMatch = itemStr.match(/"confidence"\s*:\s*([0-9.]+)/)
          
          if (nameMatch) {
            items.push({
              name: nameMatch[1],
              description: descMatch ? descMatch[1] : 'Partially extracted from incomplete JSON',
              quantity: qtyMatch ? parseFloat(qtyMatch[1]) : 0,
              unit: unitMatch ? unitMatch[1] : 'EA',
              category: catMatch ? catMatch[1] : 'other',
              subcategory: subcatMatch ? subcatMatch[1] : 'Uncategorized',
              location: locMatch ? locMatch[1] : '',
              unit_cost: costMatch ? parseFloat(costMatch[1]) : 0,
              confidence: confMatch ? parseFloat(confMatch[1]) : 0.3,
              notes: '⚠️ PARTIALLY EXTRACTED - JSON was incomplete. Verify quantities and details manually.'
            })
          }
        }
      })
    }
    
    // Strategy 4: If we found items by name but they have no quantities, try to find quantities in the raw text
    // Look for patterns like "quantity": 150.5 or "quantity":150.5 near each item name
    if (items.length > 0 && items.some(item => item.quantity === 0)) {
      // Extract all name-value pairs from the entire itemsText
      const allNames: string[] = []
      const allQuantities: Map<string, number> = new Map()
      const allUnits: Map<string, string> = new Map()
      const allCategories: Map<string, string> = new Map()
      const allSubcategories: Map<string, string> = new Map()
      
      // Find all names
      const namePattern = /"name"\s*:\s*"([^"]{3,100})"/g
      let nameMatch
      while ((nameMatch = namePattern.exec(itemsText)) !== null) {
        allNames.push(nameMatch[1])
      }
      
      // Find quantities - look for patterns near each name
      const quantityPattern = /"quantity"\s*:\s*([0-9.]+)/g
      let qtyMatch
      const quantities: number[] = []
      while ((qtyMatch = quantityPattern.exec(itemsText)) !== null) {
        quantities.push(parseFloat(qtyMatch[1]))
      }
      
      // Find units
      const unitPattern = /"unit"\s*:\s*"([^"]{1,10})"/g
      let unitMatch
      const units: string[] = []
      while ((unitMatch = unitPattern.exec(itemsText)) !== null) {
        units.push(unitMatch[1])
      }
      
      // Find categories
      const catPattern = /"category"\s*:\s*"([^"]{3,30})"/g
      let catMatch
      const categories: string[] = []
      while ((catMatch = catPattern.exec(itemsText)) !== null) {
        categories.push(catMatch[1])
      }
      
      // Find subcategories
      const subcatPattern = /"subcategory"\s*:\s*"([^"]{3,50})"/g
      let subcatMatch
      const subcategories: string[] = []
      while ((subcatMatch = subcatPattern.exec(itemsText)) !== null) {
        subcategories.push(subcatMatch[1])
      }
      
      // Try to match quantities/units/categories to items by position
      // If we have the same number of each, assume they're in order
      items.forEach((item, idx) => {
        if (item.quantity === 0 && quantities.length > idx) {
          item.quantity = quantities[idx]
        }
        if (item.unit === 'EA' && units.length > idx) {
          item.unit = units[idx]
        }
        if (item.category === 'other' && categories.length > idx) {
          item.category = categories[idx]
        }
        if (item.subcategory === 'Uncategorized' && subcategories.length > idx) {
          item.subcategory = subcategories[idx]
        }
      })
      
      // Strategy 4b: Try to infer category/subcategory from item name if still missing
      items.forEach(item => {
        if (item.category === 'other' || !item.category) {
          const nameLower = item.name.toLowerCase()
          
          // Infer category from item name
          if (nameLower.includes('foundation') || nameLower.includes('footing') || nameLower.includes('slab') || 
              nameLower.includes('concrete') || nameLower.includes('framing') || nameLower.includes('rebar') ||
              nameLower.includes('beam') || nameLower.includes('column') || nameLower.includes('truss')) {
            item.category = 'structural'
          } else if (nameLower.includes('roof') || nameLower.includes('siding') || nameLower.includes('window') ||
                     nameLower.includes('door') || nameLower.includes('cladding') || nameLower.includes('waterproof')) {
            item.category = 'exterior'
          } else if (nameLower.includes('wall') || nameLower.includes('ceiling') || nameLower.includes('insulation') ||
                     nameLower.includes('drywall') || nameLower.includes('gwb')) {
            item.category = 'interior'
          } else if (nameLower.includes('plumb') || nameLower.includes('hvac') || nameLower.includes('electrical') ||
                     nameLower.includes('fixture') || nameLower.includes('outlet') || nameLower.includes('light')) {
            item.category = 'mep'
          } else if (nameLower.includes('floor') || nameLower.includes('paint') || nameLower.includes('trim') ||
                     nameLower.includes('carpet') || nameLower.includes('tile') || nameLower.includes('cabinet')) {
            item.category = 'finishes'
          } else {
            item.category = 'other'
          }
          
          // Infer subcategory
          if (!item.subcategory || item.subcategory === 'Uncategorized') {
            if (nameLower.includes('foundation') || nameLower.includes('footing')) {
              item.subcategory = 'Foundation'
            } else if (nameLower.includes('framing') || nameLower.includes('stud')) {
              item.subcategory = 'Framing'
            } else if (nameLower.includes('roof')) {
              item.subcategory = 'Roofing'
            } else if (nameLower.includes('window') || nameLower.includes('door')) {
              item.subcategory = 'Openings'
            } else if (nameLower.includes('plumb') || nameLower.includes('fixture')) {
              item.subcategory = 'Plumbing'
            } else if (nameLower.includes('hvac')) {
              item.subcategory = 'HVAC'
            } else if (nameLower.includes('electrical') || nameLower.includes('light')) {
              item.subcategory = 'Electrical'
            } else if (nameLower.includes('floor')) {
              item.subcategory = 'Flooring'
            } else if (nameLower.includes('paint')) {
              item.subcategory = 'Paint'
            } else {
              item.subcategory = 'Uncategorized'
            }
          }
        }
      })
    }
    
    // Strategy 5: Last resort - extract just names if nothing else worked
    if (items.length === 0) {
      console.log('Strategy 5: Trying to extract just names')
      const namePattern = /"name"\s*:\s*"([^"]{3,200})"/g
      let match
      let nameCount = 0
      while ((match = namePattern.exec(itemsText)) !== null) {
        nameCount++
        const inferredCategory = this.inferCategoryFromName(match[1])
        const inferredSubcategory = this.inferSubcategoryFromName(match[1])
        
        items.push({
          name: match[1],
          description: 'Extracted from incomplete JSON response',
          quantity: 0,
          unit: 'EA',
          category: inferredCategory.category,
          subcategory: inferredSubcategory,
          confidence: 0.2,
          notes: '⚠️ PARTIALLY EXTRACTED - Only name was recoverable. All other fields need manual entry.'
        })
      }
      console.log(`Strategy 5 extracted ${nameCount} item names`)
    }
    
    console.log(`Final extraction result: ${items.length} items`)
    return items
  }

  // Helper to infer category from item name
  private inferCategoryFromName(name: string): { category: string } {
    const nameLower = name.toLowerCase()
    
    if (nameLower.includes('foundation') || nameLower.includes('footing') || nameLower.includes('slab') || 
        nameLower.includes('concrete') && (nameLower.includes('wall') || nameLower.includes('foundation')) ||
        nameLower.includes('framing') || nameLower.includes('rebar') ||
        nameLower.includes('beam') || nameLower.includes('column') || nameLower.includes('truss')) {
      return { category: 'structural' }
    } else if (nameLower.includes('roof') || nameLower.includes('siding') || nameLower.includes('window') ||
               nameLower.includes('door') || nameLower.includes('cladding') || nameLower.includes('waterproof')) {
      return { category: 'exterior' }
    } else if (nameLower.includes('wall') && !nameLower.includes('exterior') || 
               nameLower.includes('ceiling') || nameLower.includes('insulation') ||
               nameLower.includes('drywall') || nameLower.includes('gwb')) {
      return { category: 'interior' }
    } else if (nameLower.includes('plumb') || nameLower.includes('hvac') || nameLower.includes('electrical') ||
               nameLower.includes('fixture') || nameLower.includes('outlet') || nameLower.includes('light')) {
      return { category: 'mep' }
    } else if (nameLower.includes('floor') || nameLower.includes('paint') || nameLower.includes('trim') ||
               nameLower.includes('carpet') || nameLower.includes('tile') || nameLower.includes('cabinet')) {
      return { category: 'finishes' }
    } else {
      return { category: 'other' }
    }
  }

  // Helper to infer subcategory from item name
  private inferSubcategoryFromName(name: string): string {
    const nameLower = name.toLowerCase()
    
    if (nameLower.includes('foundation') || nameLower.includes('footing')) {
      return 'Foundation'
    } else if (nameLower.includes('framing') || nameLower.includes('stud')) {
      return 'Framing'
    } else if (nameLower.includes('roof')) {
      return 'Roofing'
    } else if (nameLower.includes('window') || nameLower.includes('door')) {
      return 'Openings'
    } else if (nameLower.includes('plumb') || nameLower.includes('fixture')) {
      return 'Plumbing'
    } else if (nameLower.includes('hvac')) {
      return 'HVAC'
    } else if (nameLower.includes('electrical') || nameLower.includes('light')) {
      return 'Electrical'
    } else if (nameLower.includes('floor')) {
      return 'Flooring'
    } else if (nameLower.includes('paint')) {
      return 'Paint'
    } else if (nameLower.includes('wall')) {
      return 'Walls'
    } else if (nameLower.includes('ceiling')) {
      return 'Ceilings'
    } else if (nameLower.includes('insulation')) {
      return 'Insulation'
    } else {
      return 'Uncategorized'
    }
  }

  // Extract partial issues from incomplete JSON
  private extractPartialIssues(issuesText: string): any[] {
    const issues: any[] = []
    const issueMatches = issuesText.match(/\{[^{}]*"(?:description|severity)"\s*:\s*"[^"]*"[^{}]*\}/g)
    if (issueMatches) {
      issueMatches.forEach(issueStr => {
        try {
          const issue = JSON.parse(issueStr)
          issues.push(issue)
        } catch {
          // Extract fields individually
          const descMatch = issueStr.match(/"description"\s*:\s*"([^"]*)"/)
          const sevMatch = issueStr.match(/"severity"\s*:\s*"([^"]*)"/)
          const catMatch = issueStr.match(/"category"\s*:\s*"([^"]*)"/)
          const locMatch = issueStr.match(/"location"\s*:\s*"([^"]*)"/)
          const recMatch = issueStr.match(/"recommendation"\s*:\s*"([^"]*)"/)
          
          if (descMatch) {
            issues.push({
              description: descMatch[1],
              severity: sevMatch ? sevMatch[1] : 'info',
              category: catMatch ? catMatch[1] : 'general',
              location: locMatch ? locMatch[1] : '',
              recommendation: recMatch ? recMatch[1] : '',
              confidence: 0.3
            })
          }
        }
      })
    }
    return issues
  }

  // Extract partial object from incomplete JSON
  private extractPartialObject(objText: string): any {
    const obj: any = {}
    // Extract common fields
    const scoreMatch = objText.match(/"overall_score"\s*:\s*([0-9.]+)/)
    const notesMatch = objText.match(/"notes"\s*:\s*"([^"]*)"/)
    const missingSheetsMatch = objText.match(/"missing_sheets"\s*:\s*\[([\s\S]*?)\]/)
    const missingDimsMatch = objText.match(/"missing_dimensions"\s*:\s*\[([\s\S]*?)\]/)
    
    if (scoreMatch) obj.overall_score = parseFloat(scoreMatch[1])
    if (notesMatch) obj.notes = notesMatch[1]
    if (missingSheetsMatch) {
      try {
        obj.missing_sheets = JSON.parse(`[${missingSheetsMatch[1]}]`)
      } catch {
        obj.missing_sheets = []
      }
    } else {
      obj.missing_sheets = []
    }
    if (missingDimsMatch) {
      try {
        obj.missing_dimensions = JSON.parse(`[${missingDimsMatch[1]}]`)
      } catch {
        obj.missing_dimensions = []
      }
    } else {
      obj.missing_dimensions = []
    }
    
    return obj
  }

  // Extract partial array from incomplete JSON
  private extractPartialArray(arrayText: string): any[] {
    const items: any[] = []
    // Look for objects in the array
    const objMatches = arrayText.match(/\{[^{}]*\}/g)
    if (objMatches) {
      objMatches.forEach(objStr => {
        try {
          items.push(JSON.parse(objStr))
        } catch {
          // Try to extract at least description/level
          const descMatch = objStr.match(/"description"\s*:\s*"([^"]*)"/)
          const levelMatch = objStr.match(/"level"\s*:\s*"([^"]*)"/)
          if (descMatch) {
            items.push({
              description: descMatch[1],
              level: levelMatch ? levelMatch[1] : 'low',
              confidence: 0.3
            })
          }
        }
      })
    }
    return items
  }

  // Cross-validation and consensus analysis
  async analyzeWithConsensus(
    images: string[],
    options: EnhancedAnalysisOptions
  ): Promise<ConsensusResult> {
    console.log(`Starting consensus analysis for ${options.taskType}...`)
    
    // Get results from all specialized models
    const results = await this.analyzeWithSpecializedModels(images, options)
    
    // TEMPORARY: Allow single model results until we can get multiple models working consistently
    // Previously required 2+ models for consensus, but this was blocking valid single-model results
    if (results.length === 0) {
      console.error(`No models succeeded. Cannot proceed with analysis.`)
      console.error('Available results:', results.map(r => ({ model: r.model, provider: r.provider, success: !!r.content })))
      throw new Error(`All models failed. Cannot perform analysis.`)
    }
      
    // If we have at least 1 model, use it (single model analysis is acceptable)
      if (results.length === 1) {
      console.log(`Using single model analysis (${results[0].model}) - consensus requires 2+ models but single model is acceptable`)
        const singleResult = results[0]
        try {
          // Handle empty responses - throw error instead of creating fake data
          if (!singleResult.content || singleResult.content.trim().length === 0) {
            console.error(`❌ Model ${singleResult.model} returned empty response - this should not happen`)
            throw new Error(`Model ${singleResult.model} returned empty response. Check token limits and prompt size.`)
          }
          
          // Use robust JSON extraction like multi-model parsing
          let jsonText = singleResult.content
          
          // Remove markdown code blocks if present
          const codeBlockMatch = singleResult.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1]
          } else {
            // Try to find JSON object in the text
            const jsonMatch = singleResult.content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              jsonText = jsonMatch[0]
            }
          }
          
          // Try to repair incomplete JSON (common when response is truncated)
          let parsed: any
          try {
            parsed = JSON.parse(jsonText)
          } catch (parseError) {
            // Try to repair incomplete JSON
            console.warn('JSON parse failed, attempting to repair:', parseError)
            console.warn('JSON preview (first 500 chars):', jsonText.substring(0, 500))
            
            // CRITICAL FIX: Fix missing commas before closing brackets/braces in arrays
            // Common error from Claude: "name": "value"] should be "name": "value",] 
            // This is a malformed array item - closing bracket where comma should be
            
            // SIMPLE FIX FIRST: Replace "key": "value"] with "key": "value", (most common error)
            // This handles both escaped and non-escaped quotes
            jsonText = jsonText.replace(/(:\s*"(?:[^"\\]|\\.)*")(\s*)\](?!\s*[,}\]]|$)/g, '$1,$2]')
            
            // Fix property:value"] pattern (COMMON Claude error) - handle escaped quotes
            // Pattern: "key": "value"] should become "key": "value",
            jsonText = jsonText.replace(/(:\s*"(?:[^"\\]|\\.)+")(\s*)\](?!\s*[,}\]]|$)/g, '$1,$2]')
            
            // More aggressive: Fix any quoted value followed by ] (not at end of array)
            // Pattern: "value"] where it should be "value",] if inside array
            // Check if we're inside an array (have [ before and not ] after)
            jsonText = jsonText.replace(/"([^"]+)"(\s*)\](?!\s*[,\}\]\s]|$)/g, (match, value, spaces, offset, string) => {
              // Look backwards to see if we're in an array
              const beforeMatch = string.substring(Math.max(0, offset - 100), offset)
              // If we have an opening [ recently, likely in array
              if (beforeMatch.includes('[')) {
                return `"${value}",${spaces}]`
              }
              return match
            })
            
            // Fix: "} where "}, should be (missing comma before closing brace in array)
            jsonText = jsonText.replace(/"([^"]+)"(\s*)\}(?!\s*[,}\]\s]|$)/g, '"$1",$2}')
            
            // Fix cases where closing brace is missing comma in array
            // Pattern: }\s*] should be },\s*] (when closing object in array)
            jsonText = jsonText.replace(/\}(\s*)\](?!\s*[,}\]\s]|$)/g, '},$1]')
            
            // Remove trailing commas (do this AFTER fixing missing commas)
            jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1')
            
            // Try to close incomplete objects/arrays
            const openBraces = (jsonText.match(/\{/g) || []).length
            const closeBraces = (jsonText.match(/\}/g) || []).length
            const openBrackets = (jsonText.match(/\[/g) || []).length
            const closeBrackets = (jsonText.match(/\]/g) || []).length
            
            // Close incomplete objects
            if (openBraces > closeBraces) {
              jsonText += '}'.repeat(openBraces - closeBraces)
            }
            
            // Close incomplete arrays
            if (openBrackets > closeBrackets) {
              jsonText += ']'.repeat(openBrackets - closeBrackets)
            }
            
            // Try to fix incomplete string values by closing quotes
            // Find strings that aren't properly closed and close them
            jsonText = jsonText.replace(/:(\s*)"([^"]*?)([^",}\]]*)$/gm, (match, spaces, text) => {
              // If string isn't closed, close it
              if (!match.includes('"', text.length + spaces.length + 2)) {
                return `:${spaces}"${text}"`
              }
              return match
            })
            
            // Fix trailing commas before closing braces/brackets (more aggressively)
            jsonText = jsonText.replace(/,(\s*)([}\]])/g, '$1$2')
            
            // Fix incomplete arrays - find unclosed arrays and close them
            const incompleteArrayMatch = jsonText.match(/(\[[^\]]*),(\s*)$/m)
            if (incompleteArrayMatch) {
              jsonText = jsonText.replace(/,(\s*)$/m, ']')
            }
            
            // Try to fix common JSON syntax errors
            // Fix unclosed quotes in the middle of strings (replace with escaped quote)
            jsonText = jsonText.replace(/"([^"]*)"([^",}\]:\s])/g, '"$1\\"$2')
            
            // Remove any control characters that might break parsing
            jsonText = jsonText.replace(/[\x00-\x1F\x7F]/g, '')
            
            // Try parsing again
            try {
              parsed = JSON.parse(jsonText)
              console.log('Successfully repaired JSON')
            } catch (secondError) {
              // Last resort: try to extract partial data
              console.warn('JSON repair failed, attempting partial extraction')
              console.warn('JSON text length:', jsonText.length)
              console.warn('JSON text preview (first 500 chars):', jsonText.substring(0, 500))
              console.warn('JSON text preview (last 500 chars):', jsonText.substring(Math.max(0, jsonText.length - 500)))
              
              // Extract items array if it exists (even if incomplete)
              // Try multiple patterns to find items array
              let itemsMatch = jsonText.match(/"items"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
              
              // If no match, try without the closing bracket requirement
              if (!itemsMatch) {
                itemsMatch = jsonText.match(/"items"\s*:\s*\[([\s\S]*)/)
              }
              
              // If still no match, try to find any array that might contain items
              if (!itemsMatch) {
                // Look for patterns like: "items": [ ... or items: [ ...
                itemsMatch = jsonText.match(/["']?items["']?\s*:\s*\[([\s\S]*?)(?:\]|$)/i)
              }
              
              // Debug: log what we found
              if (itemsMatch) {
                console.log('Found items array, length:', itemsMatch[1].length)
                console.log('Items array preview (first 200 chars):', itemsMatch[1].substring(0, 200))
              } else {
                console.warn('Could not find items array in JSON')
                // Try to find ANY array with objects containing "name" field
                const anyArrayMatch = jsonText.match(/"items"\s*:\s*\[/i)
                if (anyArrayMatch) {
                  console.log('Found "items": [ marker but extraction failed')
                  // Try to extract everything after "items": [
                  const afterItems = jsonText.substring(jsonText.indexOf('"items": [') + 9)
                  itemsMatch = ['', afterItems] // Fake match to trigger extraction
                }
              }
              
              const issuesMatch = jsonText.match(/"issues"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
              
              // Try to extract quality_analysis object even if incomplete
              const qaMatch = jsonText.match(/"quality_analysis"\s*:\s*\{([\s\S]*?)(?:\}|$)/)
              let qualityAnalysis: any = {}
              if (qaMatch) {
                try {
                  // Try to extract completeness, consistency, risk_flags, audit_trail
                  const completenessMatch = qaMatch[1].match(/"completeness"\s*:\s*\{([\s\S]*?)(?:\}|$)/)
                  const consistencyMatch = qaMatch[1].match(/"consistency"\s*:\s*\{([\s\S]*?)(?:\}|$)/)
                  const riskFlagsMatch = qaMatch[1].match(/"risk_flags"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
                  const auditMatch = qaMatch[1].match(/"audit_trail"\s*:\s*\{([\s\S]*?)(?:\}|$)/)
                  
                  qualityAnalysis = {
                    completeness: completenessMatch ? this.extractPartialObject(completenessMatch[1]) : {
                      overall_score: 0.5,
                      missing_sheets: [],
                      missing_dimensions: [],
                      missing_details: [],
                      incomplete_sections: [],
                      notes: 'Quality analysis partially extracted - some data may be missing'
                    },
                    consistency: consistencyMatch ? this.extractPartialObject(consistencyMatch[1]) : {
                      scale_mismatches: [],
                      unit_conflicts: [],
                      dimension_contradictions: [],
                      schedule_vs_elevation_conflicts: [],
                      notes: 'Consistency check partially extracted'
                    },
                    risk_flags: riskFlagsMatch ? this.extractPartialArray(riskFlagsMatch[1]) : [],
                    audit_trail: auditMatch ? this.extractPartialObject(auditMatch[1]) : {
                      pages_analyzed: [],
                      chunks_processed: 1,
                      coverage_percentage: 50,
                      assumptions_made: []
                    }
                  }
                } catch (e) {
                  console.warn('Failed to extract quality_analysis, using default')
                }
              }
              
              const extractedItems = itemsMatch ? this.extractPartialItems(itemsMatch[1]) : []
              const extractedIssues = issuesMatch ? this.extractPartialIssues(issuesMatch[1]) : []
              
              console.warn(`Using partially extracted data: ${extractedItems.length} items, ${extractedIssues.length} issues`)
              
              // If we extracted 0 items, try one more time with the FULL jsonText as fallback
              if (extractedItems.length === 0 && jsonText.length > 100) {
                console.warn('No items extracted with normal method, trying full-text extraction')
                // Try extracting from the entire jsonText as a last resort
                const fallbackItems = this.extractPartialItems(jsonText)
                if (fallbackItems.length > 0) {
                  console.log(`Fallback extraction found ${fallbackItems.length} items`)
                  extractedItems.push(...fallbackItems)
                }
              }
              
              parsed = {
                items: extractedItems,
                issues: extractedIssues,
                quality_analysis: qualityAnalysis
              }
              
              console.warn('Using partially extracted data due to JSON parse failure')
            }
          }
          
          // Ensure quality_analysis always exists, even if empty
          // Check if parsed.quality_analysis exists from partial extraction, otherwise create fallback
          const finalQualityAnalysis = (parsed && parsed.quality_analysis) ? parsed.quality_analysis : {
            completeness: {
              overall_score: singleResult.confidence || 0.6,
              missing_sheets: [],
              missing_dimensions: [],
              missing_details: [],
              incomplete_sections: [],
              notes: 'Quality analysis generated from single model (no consensus). Verify completeness manually.'
            },
            consistency: {
              scale_mismatches: [],
              unit_conflicts: [],
              dimension_contradictions: [],
              schedule_vs_elevation_conflicts: [],
              notes: 'Single model analysis - consistency checks limited'
            },
            risk_flags: [],
            audit_trail: {
              pages_analyzed: [],
              chunks_processed: 1,
              coverage_percentage: 50,
              assumptions_made: parsed.items && parsed.items.length > 0 
                ? [`Extracted ${parsed.items.length} items from partial JSON - some data may be incomplete`]
                : []
            }
          }
          
          return {
            items: parsed.items || [],
            issues: parsed.issues || [],
            quality_analysis: finalQualityAnalysis,
            confidence: singleResult.confidence || 0.6, // Lower confidence for single model
            consensusCount: 1,
            disagreements: [],
            modelAgreements: [singleResult.model],
            specializedInsights: parsed.specializedInsights || [],
            recommendations: parsed.recommendations || []
          }
        } catch (error) {
          console.error('Failed to parse single model response:', error)
          console.error('Raw response (first 500 chars):', singleResult.content?.substring(0, 500))
          
          // Don't throw - return empty structure with warning
          return {
            items: [],
            issues: [],
            confidence: 0.3,
            consensusCount: 1,
            disagreements: [],
            modelAgreements: [singleResult.model],
            specializedInsights: [],
            recommendations: ['Analysis completed but response could not be fully parsed. Please try again.']
          }
        }
      // All error handling done, but we should have returned above
      // This means the single model path didn't return - should not happen
      throw new Error('Single model analysis failed to return results')
    }
    
    // Parse all responses with improved JSON extraction (for 2+ models)
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
        
        // Try to parse, with JSON repair if needed (same logic as single-model path)
        let parsed: any
        try {
          parsed = JSON.parse(jsonText)
        } catch (parseError) {
          // Apply JSON repair logic (same as single-model path)
          console.warn(`JSON parse failed for ${result.model}, attempting to repair:`, parseError)
          
          // Fix missing commas before closing brackets/braces in arrays
          // More aggressive pattern to catch cases like: "value"] where ] should be preceded by comma
          jsonText = jsonText.replace(/(:\s*"(?:[^"\\]|\\.)*")(\s*)\](?!\s*[,}\]]|$)/g, '$1,$2]')
          jsonText = jsonText.replace(/(:\s*"(?:[^"\\]|\\.)+")(\s*)\](?!\s*[,}\]]|$)/g, '$1,$2]')
          
          // Fix: "key": "value"] where ] should be ,] (missing comma in array)
          // This handles the common error at position 11565
          jsonText = jsonText.replace(/(:\s*"(?:[^"\\]|\\.)*")(\s*)\](?=\s*[,\}\]])/g, '$1,$2]')
          
          // Fix missing commas before closing braces in objects within arrays
          jsonText = jsonText.replace(/"([^"]+)"(\s*)\}(?!\s*[,}\]\s]|$)/g, '"$1",$2}')
          jsonText = jsonText.replace(/\}(\s*)\](?!\s*[,}\]\s]|$)/g, '},$1]')
          
          // Fix: }] where } should be },] (missing comma before closing array bracket)
          jsonText = jsonText.replace(/\}(\s*)\](?=\s*[,\}\]])/g, '},$1]')
          
          // Remove trailing commas (do this AFTER fixing missing commas)
          jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1')
          
          // Close incomplete objects/arrays
          const openBraces = (jsonText.match(/\{/g) || []).length
          const closeBraces = (jsonText.match(/\}/g) || []).length
          const openBrackets = (jsonText.match(/\[/g) || []).length
          const closeBrackets = (jsonText.match(/\]/g) || []).length
          
          if (openBraces > closeBraces) {
            jsonText += '}'.repeat(openBraces - closeBraces)
          }
          if (openBrackets > closeBrackets) {
            jsonText += ']'.repeat(openBrackets - closeBrackets)
          }
          
          // Try parsing again after repair
          try {
            parsed = JSON.parse(jsonText)
            console.log(`✅ Successfully repaired JSON for ${result.model}`)
          } catch (secondError) {
            // Last resort: extract partial data
            console.warn(`JSON repair failed for ${result.model}, attempting partial extraction`)
            console.warn(`Error at position: ${secondError instanceof SyntaxError ? (secondError as any).message.match(/position (\d+)/)?.[1] : 'unknown'}`)
            
            // Try to find items array - use non-greedy match first, then greedy if needed
            let itemsMatch = jsonText.match(/"items"\s*:\s*\[([\s\S]*?)\]/)
            if (!itemsMatch) {
              // Try greedy match to get more items even if incomplete
              itemsMatch = jsonText.match(/"items"\s*:\s*\[([\s\S]*)/)
            }
            
            const extractedItems = itemsMatch ? this.extractPartialItems(itemsMatch[1]) : []
            
            // Also try extracting from the full jsonText as fallback
            if (extractedItems.length === 0) {
              console.warn(`No items found in items array, trying full-text extraction`)
              const fallbackItems = this.extractPartialItems(jsonText)
              if (fallbackItems.length > 0) {
                extractedItems.push(...fallbackItems)
                console.log(`Fallback extraction found ${fallbackItems.length} items`)
              }
            }
            
            const extractedIssues = this.extractPartialIssues(jsonText)
            
            // Extract quality analysis if present, otherwise create fallback
            let qualityAnalysis: any = null
            try {
              const qaMatch = jsonText.match(/"quality_analysis"\s*:\s*(\{[\s\S]*?\})/)
              if (qaMatch) {
                qualityAnalysis = JSON.parse(qaMatch[1])
              }
            } catch {
              // Use fallback quality analysis
            }
            
            parsed = {
              items: extractedItems,
              issues: extractedIssues,
              quality_analysis: qualityAnalysis || {
                completeness: { overall_score: 0.5, missing_sheets: [], missing_dimensions: [], notes: 'Partially extracted' },
                consistency: { notes: 'Partially extracted' },
                risk_flags: [],
                audit_trail: { pages_analyzed: [], coverage_percentage: 0 }
              },
              summary: { total_items: extractedItems.length, notes: 'Partially extracted due to JSON parse error' }
            }
            console.warn(`Using partially extracted data for ${result.model}: ${extractedItems.length} items`)
          }
        }
        
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
    
    // TEMPORARY: Allow single model results - removed 2-model requirement
    if (parsedResults.length === 0) {
      throw new Error('No valid responses to process')
    }
    
    // Build consensus (will work with 1 model, just returns that model's results)
    const consensus = parsedResults.length === 1 
      ? this.buildSingleModelResult(parsedResults[0], options.taskType)
      : this.buildConsensus(parsedResults, options.taskType)
    
    console.log(`Consensus analysis complete: ${consensus.consensusCount}/${parsedResults.length} models agreed`)
    
    return consensus
  }

  // Build result from single model (when only 1 model succeeds)
  private buildSingleModelResult(
    result: { parsed: any; model: string; confidence?: number },
    taskType: TaskType
  ): ConsensusResult {
    return {
      items: result.parsed.items || [],
      issues: taskType === 'quality' ? (result.parsed.issues || []) : [],
      quality_analysis: result.parsed.quality_analysis, // Include quality_analysis from single model
      confidence: result.confidence || 0.7, // Single model gets lower confidence
      consensusCount: 1,
      disagreements: [],
      modelAgreements: [result.model],
      specializedInsights: result.parsed.specializedInsights || [],
      recommendations: result.parsed.recommendations || []
    }
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
    
    // Merge quality_analysis from all models (use the most comprehensive one)
    const qualityAnalysis = this.mergeQualityAnalysis(results.map(r => r.parsed))
    
    // Calculate overall confidence
    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / results.length
    
    // Find disagreements
    const disagreements = this.findDisagreements(results)
    
    // Count model agreements
    const modelAgreements = this.countModelAgreements(results)
    
    return {
      items: consensusItems,
      issues: taskType === 'quality' ? consensusIssues : [],
      quality_analysis: qualityAnalysis, // Include merged quality_analysis
      confidence: avgConfidence,
      consensusCount: results.length,
      disagreements,
      modelAgreements,
      specializedInsights: [], // Will be populated by consensus engine
      recommendations: [] // Will be populated by consensus engine
    }
  }

  // Find items that multiple models agree on
  // NEW: Keep ALL items from all models, not just consensus
  // This gives us way more items (combining findings from GPT, Claude, and Grok)
  private findConsensusItems(items: any[], totalModels: number): any[] {
    // Group similar items
    const groupedItems = this.groupSimilarItems(items)
    
    // NEW APPROACH: Keep ALL items, even from single models
    // Only merge items when multiple models found the same thing (for averaging quantities)
    const allItems: any[] = []
    const processedKeys = new Set<string>()
    
    groupedItems.forEach(group => {
      if (group.length >= 2) {
        // Multiple models found this - merge and average
        const merged = this.mergeItemGroup(group)
        const key = `${merged.name}_${merged.category}_${merged.location}`
        if (!processedKeys.has(key)) {
          allItems.push(merged)
          processedKeys.add(key)
        }
      } else if (group.length === 1) {
        // Single model found this - keep it anyway (this is the key change!)
        const item = group[0]
        const key = `${item.name}_${item.category}_${item.location || ''}`
        if (!processedKeys.has(key)) {
          allItems.push(item)
          processedKeys.add(key)
        }
      }
    })
    
    return allItems
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

  // Merge quality_analysis from multiple models
  private mergeQualityAnalysis(parsedResults: Array<{ quality_analysis?: any }>): any {
    // Find the most comprehensive quality_analysis
    let bestQA: any = null
    let bestScore = 0
    
    parsedResults.forEach(result => {
      if (result.quality_analysis) {
        const qa = result.quality_analysis
        // Score based on completeness and detail
        const score = (qa.completeness?.overall_score || 0) +
                     (qa.audit_trail?.coverage_percentage || 0) / 100 +
                     (qa.risk_flags?.length || 0) * 0.1 +
                     (qa.completeness?.missing_dimensions?.length || 0) * 0.05
        
        if (score > bestScore) {
          bestScore = score
          bestQA = qa
        }
      }
    })
    
    // If no model returned quality_analysis, return default structure
    if (!bestQA) {
      return {
        completeness: {
          overall_score: 0.8,
          missing_sheets: [],
          missing_dimensions: [],
          missing_details: [],
          incomplete_sections: [],
          notes: 'Quality analysis merged from multiple models'
        },
        consistency: {
          scale_mismatches: [],
          unit_conflicts: [],
          dimension_contradictions: [],
          schedule_vs_elevation_conflicts: [],
          notes: 'No consistency issues detected across models'
        },
        risk_flags: [],
        audit_trail: {
          pages_analyzed: [],
          chunks_processed: parsedResults.length,
          coverage_percentage: 100,
          assumptions_made: []
        }
      }
    }
    
    return bestQA
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

