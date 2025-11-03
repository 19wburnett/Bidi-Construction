/**
 * Single-Model LLM Provider with Probing & Fallback
 * 
 * Probes providers in order (Anthropic → OpenAI → xAI) until one works.
 * Handles rate limits, timeouts, and provider degradation gracefully.
 */

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

// Provider degradation tracking (in-memory, resets on server restart)
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

// Initialize clients
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

// XAI/Grok uses OpenAI-compatible API
const xaiApiKey = process.env.XAI_API_KEY

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
      if (!anthropic) return false
      await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 5,
        messages: [testPrompt],
        timeout: 3000 // 3s timeout for probe
      })
      return true
    }
    
    if (provider === 'openai') {
      if (!openai) return false
      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [testPrompt],
        max_tokens: 5,
        timeout: 3000
      })
      return true
    }
    
    if (provider === 'xai') {
      if (!xaiApiKey) return false
      // Use direct fetch for probe (grok-beta deprecated, use grok-2-1212)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${xaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'grok-2-1212',
            messages: [testPrompt],
            max_completion_tokens: 5
          }),
          signal: controller.signal
        })
        clearTimeout(timeout)
        if (!response.ok) return false
        return true
      } catch (e) {
        clearTimeout(timeout)
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
  if (!anthropic) {
    throw new Error('Anthropic API key not configured')
  }

  // Use sonnet-4 which works, fallback to haiku if needed
  const model = 'claude-sonnet-4-20250514' // Latest working Sonnet model
  
  const messages: any[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        ...images.map(img => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/png' as const,
            data: img.replace(/^data:image\/\w+;base64,/, '')
          }
        }))
      ]
    }
  ]

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 60000)

  try {
    const response = await anthropic.messages.create(
      {
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.2,
        system: systemPrompt,
        messages,
        signal: controller.signal as any
      }
    )

    clearTimeout(timeout)

    return {
      provider: 'anthropic',
      model,
      content: response.content[0]?.type === 'text' ? response.content[0].text : '',
      finishReason: response.stop_reason || 'stop',
      tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
    }
  } catch (error: any) {
    clearTimeout(timeout)
    
    if (error?.status === 429 || error?.name === 'AbortError') {
      markProviderDegraded('anthropic')
    }
    
    throw error
  }
}

/**
 * Call OpenAI GPT
 */
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  images: string[],
  options: LLMCallOptions
): Promise<LLMResponse> {
  if (!openai) {
    throw new Error('OpenAI API key not configured')
  }

  const model = 'gpt-4o' // Use GPT-4o for reliability
  
  const messages: any[] = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        ...images.map(img => ({
          type: 'image_url' as const,
          image_url: { url: img, detail: 'high' }
        }))
      ]
    }
  ]

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 60000)

  try {
    const response = await openai.chat.completions.create(
      {
        model,
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.2,
        timeout: options.timeoutMs || 60000
      },
      { signal: controller.signal }
    )

    clearTimeout(timeout)

    return {
      provider: 'openai',
      model,
      content: response.choices[0]?.message?.content || '',
      finishReason: response.choices[0]?.finish_reason || 'stop',
      tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0)
    }
  } catch (error: any) {
    clearTimeout(timeout)
    
    if (error?.status === 429 || error?.name === 'AbortError') {
      markProviderDegraded('openai')
    }
    
    throw error
  }
}

/**
 * Call xAI Grok
 */
async function callXAI(
  systemPrompt: string,
  userPrompt: string,
  images: string[],
  options: LLMCallOptions
): Promise<LLMResponse> {
  if (!xaiApiKey) {
    throw new Error('xAI API key not configured')
  }

  // grok-beta was deprecated on 2025-09-15, use grok-2-1212
  const model = 'grok-2-1212'
  
  // XAI uses direct fetch API with different format
  const imageContent = images.map(img => {
    // Handle both data URLs and base64 strings
    const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
    return {
      type: 'image_url' as const,
      image_url: { url: url, detail: 'high' as const }
    }
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 60000)

  try {
    // XAI requires direct fetch with max_completion_tokens (not max_tokens)
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              ...imageContent
            ] 
          }
        ],
        max_completion_tokens: Math.min(options.maxTokens || 4096, 4096), // XAI limit
        temperature: options.temperature ?? 0.2
      }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`XAI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    return {
      provider: 'xai',
      model,
      content: data.choices[0]?.message?.content || '',
      finishReason: data.choices[0]?.finish_reason || 'stop',
      tokensUsed: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
    }
  } catch (error: any) {
    clearTimeout(timeout)
    
    if (error?.status === 429 || error?.name === 'AbortError') {
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
  if (anthropic && !isProviderDegraded('anthropic')) {
    providers.push({
      name: 'anthropic',
      callFn: () => callAnthropic(systemPrompt, userPrompt, images, opts)
    })
  }
  
  // Add OpenAI if available and not degraded
  if (openai && !isProviderDegraded('openai')) {
    providers.push({
      name: 'openai',
      callFn: () => callOpenAI(systemPrompt, userPrompt, images, opts)
    })
  }
  
  // Add xAI if available and not degraded
  if (xaiApiKey && !isProviderDegraded('xai')) {
    providers.push({
      name: 'xai',
      callFn: () => callXAI(systemPrompt, userPrompt, images, opts)
    })
  }

  if (providers.length === 0) {
    throw new Error('No LLM providers available. Please configure at least one API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, or XAI_API_KEY)')
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

