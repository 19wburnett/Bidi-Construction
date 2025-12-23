import { aiGateway } from './ai-gateway-provider'

export interface AnalysisOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt: string
  userPrompt: string
}

export interface AIResponse {
  provider: 'openai' | 'claude' | 'gemini'
  content: string
  finishReason: string
  tokensUsed?: number
}

// CRITICAL: Each function receives ALL plan images (all pages)
// and sends them to the respective AI provider

export async function analyzeWithOpenAI(
  images: string[], // ALL plan page images as base64 data URLs
  options: AnalysisOptions
): Promise<AIResponse> {
  // Use gpt-4o for vision analysis (most reliable vision model)
  // GPT-5 may not support vision API yet, or may need different parameters
  const model = process.env.OPENAI_MODEL || 'gpt-4o' // Configurable via env
  
  const response = await aiGateway.generate({
    model: model,
    system: options.systemPrompt,
    prompt: options.userPrompt,
    images: images,
    maxTokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.2,
    responseFormat: { type: 'json_object' }
  })

  return {
    provider: 'openai',
    content: response.content || '',
    finishReason: response.finishReason,
    tokensUsed: response.usage?.totalTokens
  }
}

export async function analyzeWithClaude(
  images: string[], // ALL plan page images as base64 data URLs
  options: AnalysisOptions
): Promise<AIResponse> {
  const response = await aiGateway.generate({
    model: 'claude-sonnet-4-20250514', // Claude Sonnet 4 - Latest model
    system: options.systemPrompt,
    prompt: options.userPrompt,
    images: images,
    maxTokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.2,
    responseFormat: { type: 'json_object' }
  })

  return {
    provider: 'claude',
    content: response.content || '',
    finishReason: response.finishReason || 'unknown',
    tokensUsed: response.usage?.totalTokens
  }
}

export async function analyzeWithGemini(
  images: string[], // ALL plan page images as base64 data URLs
  options: AnalysisOptions
): Promise<AIResponse> {
  const prompt = `${options.systemPrompt}\n\n${options.userPrompt}\n\nIMPORTANT: Respond with ONLY a JSON object, no other text.`
  
  const response = await aiGateway.generate({
    model: 'gemini-2.5-flash', // Latest model with vision support
    prompt: prompt,
    images: images,
    maxTokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.2,
    responseFormat: { type: 'json_object' }
  })
  
  // Ensure we got a response
  if (!response.content || response.content.trim().length === 0) {
    throw new Error('Gemini returned empty response')
  }
  
  return {
    provider: 'gemini',
    content: response.content,
    finishReason: response.finishReason || 'stop',
    tokensUsed: response.usage?.totalTokens
  }
}

export async function analyzeWithAllProviders(
  images: string[],
  options: AnalysisOptions
): Promise<AIResponse[]> {
  const results = await Promise.allSettled([
    analyzeWithOpenAI(images, options),
    analyzeWithClaude(images, options),
    analyzeWithGemini(images, options)
  ])

  // Log failures for debugging
  results.forEach((result, index) => {
    const providers = ['OpenAI', 'Claude', 'Gemini']
    if (result.status === 'rejected') {
      console.error(`${providers[index]} analysis failed:`, result.reason)
    } else {
      console.log(`${providers[index]} analysis succeeded: ${result.value.content.length} chars`)
    }
  })

  const successfulResults = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<AIResponse>).value)
  
  console.log(`Successfully completed ${successfulResults.length}/3 provider analyses`)
  
  return successfulResults
}

