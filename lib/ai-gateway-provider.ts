/**
 * Unified AI Gateway Provider
 * 
 * Provides a unified interface for all AI providers through Vercel AI Gateway
 * using the AI SDK. Supports OpenAI, Anthropic, Google, and XAI models.
 */

import { generateText, streamText } from 'ai'
import { getGatewayModel } from './ai-gateway-models'

// AI Gateway base URL - Vercel AI Gateway endpoint
// AI SDK can auto-detect these from environment variables, but we read them here for explicit use
const AI_GATEWAY_BASE_URL = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1'
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY

if (!AI_GATEWAY_API_KEY) {
  console.warn('⚠️ AI_GATEWAY_API_KEY not set. AI Gateway calls will fail.')
  console.warn('   Get your API key from: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai&title=Go+to+AI+Gateway')
}

export interface GatewayCallOptions {
  model: string // Will be converted to provider/model format
  system?: string
  prompt?: string
  messages?: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }>
  }>
  images?: string[] // Base64 data URLs or URLs
  maxTokens?: number
  temperature?: number
  responseFormat?: { type: 'json_object' } | { type: 'text' }
  stream?: boolean
}

export interface GatewayResponse {
  content: string
  finishReason: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
}

/**
 * Generate text using AI Gateway
 */
export async function generateTextWithGateway(
  options: GatewayCallOptions
): Promise<GatewayResponse> {
  // Check for API key (AI SDK can also auto-detect from env, but we check here for better error messages)
  const apiKey = AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY is required. Please set it in your environment variables.')
  }

  const gatewayModel = getGatewayModel(options.model)
  
  // Build messages array
  const messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }>
  }> = []

  // Add system message if provided
  if (options.system) {
    messages.push({ role: 'system', content: options.system })
  }

  // Build user content
  const userContent: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }> = []
  
  // Add text prompt
  if (options.prompt) {
    userContent.push({ type: 'text', text: options.prompt })
  }

  // Add images
  if (options.images && options.images.length > 0) {
    options.images.forEach(img => {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: img.startsWith('http') ? img : img,
          detail: 'high'
        }
      })
    })
  }

  // If messages array provided, use it (for chat completions)
  if (options.messages && options.messages.length > 0) {
    messages.push(...options.messages)
  } else if (userContent.length > 0) {
    // Otherwise use the built user content
    messages.push({ role: 'user', content: userContent.length === 1 && userContent[0].type === 'text' ? userContent[0].text! : userContent })
  }

  try {
    // AI SDK auto-detects AI_GATEWAY_API_KEY and AI_GATEWAY_BASE_URL from env vars
    // Note: AI SDK v5 uses maxOutputTokens instead of maxTokens
    const result = await generateText({
      model: gatewayModel,
      messages: messages as any,
      ...(options.maxTokens && { maxOutputTokens: options.maxTokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.responseFormat && { responseFormat: options.responseFormat }),
    })

    return {
      content: result.text,
      finishReason: result.finishReason || 'stop',
      usage: result.usage ? {
        promptTokens: result.usage.inputTokens || 0,
        completionTokens: result.usage.outputTokens || 0,
        totalTokens: result.usage.totalTokens ?? (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
      } : undefined,
      model: gatewayModel,
    }
  } catch (error: any) {
    console.error(`AI Gateway error for model ${gatewayModel}:`, error)
    throw new Error(`AI Gateway call failed: ${error.message || String(error)}`)
  }
}

/**
 * Stream text using AI Gateway
 */
export async function streamTextWithGateway(
  options: GatewayCallOptions
): Promise<AsyncIterable<string>> {
  // Check for API key (AI SDK can also auto-detect from env, but we check here for better error messages)
  const apiKey = AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY is required. Please set it in your environment variables.')
  }

  const gatewayModel = getGatewayModel(options.model)
  
  // Build messages array (same logic as generateTextWithGateway)
  const messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }>
  }> = []

  if (options.system) {
    messages.push({ role: 'system', content: options.system })
  }

  const userContent: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }> = []
  
  if (options.prompt) {
    userContent.push({ type: 'text', text: options.prompt })
  }

  if (options.images && options.images.length > 0) {
    options.images.forEach(img => {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: img.startsWith('http') ? img : img,
          detail: 'high'
        }
      })
    })
  }

  if (options.messages && options.messages.length > 0) {
    messages.push(...options.messages)
  } else if (userContent.length > 0) {
    messages.push({ role: 'user', content: userContent.length === 1 && userContent[0].type === 'text' ? userContent[0].text! : userContent })
  }

  try {
    // AI SDK auto-detects AI_GATEWAY_API_KEY and AI_GATEWAY_BASE_URL from env vars
    // Note: AI SDK v5 uses maxOutputTokens instead of maxTokens
    const result = await streamText({
      model: gatewayModel,
      messages: messages as any,
      ...(options.maxTokens && { maxOutputTokens: options.maxTokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.responseFormat && { responseFormat: options.responseFormat }),
    })

    return result.textStream
  } catch (error: any) {
    console.error(`AI Gateway streaming error for model ${gatewayModel}:`, error)
    throw new Error(`AI Gateway streaming failed: ${error.message || String(error)}`)
  }
}

/**
 * Generate embeddings using AI Gateway
 * Note: Embeddings may need to use OpenAI SDK directly through AI Gateway base URL
 */
export async function generateEmbeddingsWithGateway(
  model: string,
  input: string | string[]
): Promise<Array<{ embedding: number[] }>> {
  // Check for API key
  const apiKey = AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY is required. Please set it in your environment variables.')
  }

  // For embeddings, we need to use the OpenAI-compatible embeddings endpoint
  // AI Gateway supports this through the /v1/embeddings endpoint
  const gatewayModel = getGatewayModel(model)
  
  try {
    const response = await fetch(`${AI_GATEWAY_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: gatewayModel,
        input: input,
        encoding_format: 'float',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI Gateway embeddings error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data.data || []
  } catch (error: any) {
    console.error(`AI Gateway embeddings error for model ${gatewayModel}:`, error)
    throw new Error(`AI Gateway embeddings failed: ${error.message || String(error)}`)
  }
}

/**
 * Main AI Gateway provider interface
 */
export const aiGateway = {
  generate: generateTextWithGateway,
  stream: streamTextWithGateway,
  embeddings: generateEmbeddingsWithGateway,
}





