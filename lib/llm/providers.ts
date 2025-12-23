/**
 * Single-Model LLM Provider with Probing & Fallback
 * 
 * Probes providers in order (Anthropic → OpenAI → xAI) until one works.
 * Handles rate limits, timeouts, and provider degradation gracefully.
 */

import { aiGateway } from '../ai-gateway-provider'

// Provider degradation tracking (in-memory, resets on server restart)
// Note: AI Gateway handles rate limiting, but we keep this for monitoring
const providerDegradation: Map<string, number> = new Map()
const DEGRADATION_TTL = 30 * 60 * 1000 // 30 minutes

export interface LLMCallOptions {
  maxTokens?: number
  timeoutMs?: number
  temperature?: number
}

export interface LLMResponse {
  provider: string
  model: string
  content: string
  finishReason: string
  tokensUsed?: number
}

// Check AI Gateway API key
const hasAIGatewayKey = !!process.env.AI_GATEWAY_API_KEY

/**
 * Check if a provider is currently degraded (recently failed)
 */
function isProviderDegraded(provider: string): boolean {
  const degradedUntil = providerDegradation.get(provider)
  if (!degradedUntil) return false
  
  if (Date.now() > degradedUntil) {
    providerDegradation.delete(provider)
    return false
  }
  
  return true
}

/**
 * Mark a provider as degraded
 */
function markProviderDegraded(provider: string) {
  providerDegradation.set(provider, Date.now() + DEGRADATION_TTL)
  console.log(`⚠️  Marked provider ${provider} as degraded for ${DEGRADATION_TTL / 1000 / 60} minutes`)
}

/**
 * Probe a provider with a tiny test call to check availability
 */
async function probeProvider(provider: string): Promise<boolean> {
  if (isProviderDegraded(provider)) {
    return false
  }

  try {
    const testPrompt = { role: 'user' as const, content: 'Say "ok"' }
    
    if (provider === 'anthropic') {
      // Using AI Gateway - probe by attempting a small call
      if (!hasAIGatewayKey) return false
      try {
        await Promise.race([
          aiGateway.generate({
            model: 'claude-3-haiku-20240307',
            prompt: 'Say "ok"',
            maxTokens: 5
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 3000)
          )
        ])
        return true
      } catch (error: any) {
        if (error?.message === 'timeout') return false
        // Other errors are fine for probe - we'll try again on real call
        return false
      }
    }
    
    if (provider === 'openai') {
      // Using AI Gateway - probe by attempting a small call
      if (!hasAIGatewayKey) return false
      try {
        await Promise.race([
          aiGateway.generate({
            model: 'gpt-4o-mini',
            prompt: 'Say "ok"',
            maxTokens: 5
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 3000)
          )
        ])
        return true
      } catch (error: any) {
        if (error?.message === 'timeout') return false
        return false
      }
    }
    
    if (provider === 'xai') {
      // Using AI Gateway - probe by attempting a small call
      if (!hasAIGatewayKey) return false
      try {
        await Promise.race([
          aiGateway.generate({
            model: 'grok-2-1212',
            prompt: 'Say "ok"',
            maxTokens: 5
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 3000)
          )
        ])
        return true
      } catch (error: any) {
        if (error?.message === 'timeout') return false
        return false
      }
    }
    
    return false
  } catch (error: any) {
    // Rate limit or timeout - mark as degraded
    if (error?.status === 429 || error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
      markProviderDegraded(provider)
    }
    return false
  }
}

/**
 * Call Anthropic Claude
 */
async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  images: string[],
  options: LLMCallOptions
): Promise<LLMResponse> {
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key not configured')
  }

  // Use sonnet-4 which works, fallback to haiku if needed
  const model = 'claude-sonnet-4-20250514' // Latest working Sonnet model

  try {
    const response = await aiGateway.generate({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      images: images,
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.2,
    })

    return {
      provider: 'anthropic',
      model,
      content: response.content,
      finishReason: response.finishReason || 'stop',
      tokensUsed: response.usage?.totalTokens
    }
  } catch (error: any) {
    
    if (error?.status === 429 || error?.name === 'AbortError') {
      markProviderDegraded('anthropic')
    }
    
    throw error
  }
}

/**
 * Call OpenAI GPT (via AI Gateway)
 */
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  images: string[],
  options: LLMCallOptions
): Promise<LLMResponse> {
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key not configured')
  }

  const model = 'gpt-4o' // Use GPT-4o for reliability

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 60000)

  try {
    const response = await aiGateway.generate({
      model: model,
      system: systemPrompt,
      prompt: userPrompt,
      images: images,
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.2
    })

    clearTimeout(timeout)

    return {
      provider: 'openai',
      model,
      content: response.content || '',
      finishReason: response.finishReason || 'stop',
      tokensUsed: response.usage?.totalTokens
    }
  } catch (error: any) {
    clearTimeout(timeout)
    
    if (error?.message?.includes('429') || error?.name === 'AbortError') {
      markProviderDegraded('openai')
    }
    
    throw error
  }
}

/**
 * Call xAI Grok (via AI Gateway)
 */
async function callXAI(
  systemPrompt: string,
  userPrompt: string,
  images: string[],
  options: LLMCallOptions
): Promise<LLMResponse> {
  if (!hasAIGatewayKey) {
    throw new Error('AI Gateway API key not configured')
  }

  // grok-beta was deprecated on 2025-09-15, use grok-2-1212
  const model = 'grok-2-1212'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 60000)

  try {
    const response = await aiGateway.generate({
      model: model,
      system: systemPrompt,
      prompt: userPrompt,
      images: images,
      maxTokens: Math.min(options.maxTokens || 4096, 4096), // XAI limit
      temperature: options.temperature ?? 0.2
    })

    clearTimeout(timeout)

    return {
      provider: 'xai',
      model,
      content: response.content || '',
      finishReason: response.finishReason || 'stop',
      tokensUsed: response.usage?.totalTokens
    }
  } catch (error: any) {
    clearTimeout(timeout)
    
    if (error?.message?.includes('429') || error?.name === 'AbortError') {
      markProviderDegraded('xai')
    }
    
    throw error
  }
}

/**
 * Main function: Call analysis LLM with provider fallback
 * 
 * Tries providers in order: Anthropic → OpenAI → xAI
 * Returns the first successful response
 */
export async function callAnalysisLLM(
  normalizedInput: {
    systemPrompt: string
    userPrompt: string
    images: string[]
  },
  opts: LLMCallOptions = {}
): Promise<LLMResponse> {
  const { systemPrompt, userPrompt, images } = normalizedInput
  
  // Provider priority order (can be configured via env if needed)
  const providers: Array<{ name: string; callFn: () => Promise<LLMResponse> }> = []
  
  // Add Anthropic if available and not degraded
  if (hasAIGatewayKey && !isProviderDegraded('anthropic')) {
    providers.push({
      name: 'anthropic',
      callFn: () => callAnthropic(systemPrompt, userPrompt, images, opts)
    })
  }
  
  // Add OpenAI if available and not degraded
  if (hasAIGatewayKey && !isProviderDegraded('openai')) {
    providers.push({
      name: 'openai',
      callFn: () => callOpenAI(systemPrompt, userPrompt, images, opts)
    })
  }
  
  // Add xAI if available and not degraded
  if (hasAIGatewayKey && !isProviderDegraded('xai')) {
    providers.push({
      name: 'xai',
      callFn: () => callXAI(systemPrompt, userPrompt, images, opts)
    })
  }

  if (providers.length === 0) {
    throw new Error('No LLM providers available. Please configure AI_GATEWAY_API_KEY in your environment variables.')
  }

  // Try each provider in order
  const errors: Error[] = []
  
  for (const provider of providers) {
    try {
      console.log(`🔄 Trying provider: ${provider.name}`)
      
      // Quick probe before full call
      const isAvailable = await probeProvider(provider.name)
      if (!isAvailable) {
        console.log(`⏭️  Skipping ${provider.name} (degraded or unavailable)`)
        continue
      }
      
      const response = await provider.callFn()
      console.log(`✅ Success with provider: ${provider.name}`)
      return response
    } catch (error: any) {
      const err = error instanceof Error ? error : new Error(String(error))
      errors.push(err)
      
      // If rate limited, mark as degraded and try next
      if (error?.status === 429 || error?.message?.includes('rate limit')) {
        markProviderDegraded(provider.name)
        console.log(`⚠️  Rate limited on ${provider.name}, trying next provider...`)
        continue
      }
      
      // If timeout, mark as degraded and try next
      if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
        markProviderDegraded(provider.name)
        console.log(`⏱️  Timeout on ${provider.name}, trying next provider...`)
        continue
      }
      
      // Other errors - log but continue to next provider
      console.error(`❌ Error with ${provider.name}:`, err.message)
      continue
    }
  }

  // All providers failed
  throw new Error(
    `All LLM providers failed. Errors: ${errors.map(e => e.message).join('; ')}`
  )
}

