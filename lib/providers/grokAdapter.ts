/**
 * Grok (xAI) Provider Adapter
 * 
 * Standardized adapter for Grok/xAI API with:
 * - Healthcheck and model enumeration
 * - JSON mode support
 * - Large-context handling
 * - Function/tool-calling shim
 * - Normalized usage and cost estimation
 * - Error normalization
 */

export interface GrokAuth {
  apiKey: string
  baseUrl?: string
  orgId?: string
}

export interface GrokCallOptions {
  system?: string
  user: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string; detail?: 'low' | 'high' | 'auto' } }>
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description?: string
      parameters?: Record<string, any>
    }
  }>
  json_schema?: Record<string, any>
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
}

export interface GrokUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_est: number // Estimated cost in USD
}

export interface GrokResponse {
  content: string
  finish_reason: string
  usage: GrokUsage
  model: string
}

export interface GrokError {
  type: 'rate_limit' | 'auth_error' | 'model_not_found' | 'context_overflow' | 'unknown'
  message: string
  statusCode?: number
  retry_after?: number
}

export interface GrokModel {
  id: string
  name: string
  context_window: number
  supports_json?: boolean
  supports_vision?: boolean
  supports_streaming?: boolean
}

class GrokAdapter {
  private apiKey: string
  private baseUrl: string
  private orgId?: string
  private initialized: boolean = false

  /**
   * Initialize the adapter with authentication
   */
  init(auth: GrokAuth): void {
    if (!auth.apiKey) {
      throw new Error('Grok API key is required')
    }

    this.apiKey = auth.apiKey
    this.baseUrl = auth.baseUrl || 'https://api.x.ai/v1'
    this.orgId = auth.orgId
    this.initialized = true

    console.log(`✅ Grok adapter initialized (baseUrl: ${this.baseUrl})`)
  }

  /**
   * Healthcheck - verify API availability and enumerate supported models
   */
  async healthcheck(): Promise<{ ok: boolean; models: GrokModel[]; error?: string }> {
    if (!this.initialized) {
      throw new Error('Grok adapter not initialized. Call init() first.')
    }

    try {
      // Try a minimal probe request to verify API access
      const probeResponse = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'X-Organization-Id': this.orgId })
        },
        body: JSON.stringify({
          model: 'grok-2-1212',
          messages: [{ role: 'user', content: 'ping' }],
          max_completion_tokens: 5
        })
      })

      if (!probeResponse.ok) {
        const errorText = await probeResponse.text()
        return {
          ok: false,
          models: [],
          error: `Healthcheck failed: ${probeResponse.status} ${probeResponse.statusText} - ${errorText.substring(0, 200)}`
        }
      }

      // Enumerate known Grok models
      // Note: xAI doesn't have a public models endpoint, so we maintain a list
      const models: GrokModel[] = [
        {
          id: 'grok-2-1212',
          name: 'Grok-2-1212',
          context_window: 131072, // 128k tokens
          supports_json: true,
          supports_vision: true,
          supports_streaming: true
        },
        {
          id: 'grok-2-vision-beta',
          name: 'Grok-2 Vision Beta',
          context_window: 131072,
          supports_json: true,
          supports_vision: true,
          supports_streaming: true
        },
        {
          id: 'grok-beta',
          name: 'Grok Beta (deprecated)',
          context_window: 131072,
          supports_json: true,
          supports_vision: false,
          supports_streaming: true
        }
      ]

      return {
        ok: true,
        models
      }
    } catch (error: any) {
      return {
        ok: false,
        models: [],
        error: `Healthcheck error: ${error.message || String(error)}`
      }
    }
  }

  /**
   * Call Grok API with normalized interface
   */
  async call(options: GrokCallOptions): Promise<GrokResponse> {
    if (!this.initialized) {
      throw new Error('Grok adapter not initialized. Call init() first.')
    }

    const {
      system,
      user,
      tools,
      json_schema,
      max_tokens = 4096,
      temperature = 0.2,
      top_p,
      stream = false
    } = options

    // Build messages array
    const messages: any[] = []
    
    if (system) {
      messages.push({
        role: 'system',
        content: system
      })
    }

    // Handle user message - can be string or array (for images)
    if (typeof user === 'string') {
      messages.push({
        role: 'user',
        content: user
      })
    } else if (Array.isArray(user)) {
      // User provided content array (e.g., text + images)
      messages.push({
        role: 'user',
        content: user
      })
    } else {
      throw new Error('User content must be string or array')
    }

    // Determine model: use vision model if user content contains images
    const hasImages = Array.isArray(user) && user.some((item: any) => item.type === 'image_url')
    const selectedModel = hasImages ? 'grok-2-vision-beta' : 'grok-2-1212'
    
    // Build request body
    const requestBody: any = {
      model: selectedModel,
      messages,
      max_completion_tokens: Math.min(max_tokens, 4096), // xAI limit is 4096
      temperature
    }

    // Add top_p if provided
    if (top_p !== undefined) {
      requestBody.top_p = top_p
    }

    // Handle JSON schema (if Grok supports structured output)
    // Note: Grok may not support response_format like OpenAI, so we use prompt engineering
    if (json_schema) {
      // Inject JSON schema into system prompt as instruction
      const jsonInstruction = `\n\nIMPORTANT: Respond with ONLY valid JSON matching this schema: ${JSON.stringify(json_schema)}. Do not include any markdown, code blocks, or explanatory text.`
      if (messages[0]?.role === 'system') {
        messages[0].content += jsonInstruction
      } else {
        messages.unshift({
          role: 'system',
          content: `You must respond with valid JSON only.${jsonInstruction}`
        })
      }
    } else {
      // Default: request JSON object format
      const jsonPrompt = '\n\nIMPORTANT: Respond with ONLY a valid JSON object. Do not include markdown code blocks or any other text.'
      if (messages[0]?.role === 'system') {
        messages[0].content += jsonPrompt
      } else {
        messages.unshift({
          role: 'system',
          content: `You must respond with valid JSON only.${jsonPrompt}`
        })
      }
    }

    // Handle tools/function calling
    // Grok doesn't have native function calling, so we use a shim approach
    if (tools && tools.length > 0) {
      // Convert tools to JSON schema instructions
      const toolsInstruction = `\n\nYou have access to these functions: ${JSON.stringify(tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      })))}. When you need to call a function, respond with a JSON object like: {"function_name": "func_name", "arguments": {...}}.`
      
      if (messages[0]?.role === 'system') {
        messages[0].content += toolsInstruction
      } else {
        messages.unshift({
          role: 'system',
          content: `Function calling mode.${toolsInstruction}`
        })
      }
    }

    // Streaming not yet implemented in adapter (can be added later)
    if (stream) {
      console.warn('Streaming mode not yet fully implemented in Grok adapter')
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.orgId && { 'X-Organization-Id': this.orgId })
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await this.normalizeError(response)
        throw error
      }

      const data = await response.json()

      // Extract content
      const content = data.choices?.[0]?.message?.content || ''
      const finishReason = data.choices?.[0]?.finish_reason || 'stop'
      const model = data.model || 'grok-2-1212'

      // Normalize usage
      const usage = this.normalizeUsage(data.usage || {})

      return {
        content,
        finish_reason: finishReason,
        usage,
        model
      }
    } catch (error: any) {
      // If it's already a normalized GrokError, rethrow
      if (error.type && error.message) {
        throw error
      }

      // Otherwise, wrap it
      throw {
        type: 'unknown' as const,
        message: error.message || String(error),
        statusCode: error.status || error.statusCode
      } as GrokError
    }
  }

  /**
   * Normalize usage statistics and estimate cost
   */
  private normalizeUsage(rawUsage: any): GrokUsage {
    const promptTokens = rawUsage.prompt_tokens || 0
    const completionTokens = rawUsage.completion_tokens || 0
    const totalTokens = promptTokens + completionTokens

    // Grok pricing (as of 2025 - verify with xAI docs):
    // Input: $0.10 per 1M tokens
    // Output: $0.40 per 1M tokens
    // These are estimates - actual pricing may vary
    const inputCostPerMillion = 0.10
    const outputCostPerMillion = 0.40

    const costEst = 
      (promptTokens / 1_000_000) * inputCostPerMillion +
      (completionTokens / 1_000_000) * outputCostPerMillion

    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_est: costEst
    }
  }

  /**
   * Normalize errors into actionable GrokError format
   */
  private async normalizeError(response: Response): Promise<GrokError> {
    const status = response.status
    let errorText = ''
    
    try {
      errorText = await response.text()
    } catch {
      errorText = response.statusText
    }

    let errorJson: any = {}
    try {
      errorJson = JSON.parse(errorText)
    } catch {
      // Not JSON, use text as message
    }

    const message = errorJson.error?.message || errorText || response.statusText

    // Determine error type
    if (status === 401 || status === 403) {
      return {
        type: 'auth_error',
        message: `Authentication failed: ${message}. Check your XAI_API_KEY.`,
        statusCode: status
      }
    }

    if (status === 404) {
      // Could be model not found or endpoint not found
      if (message.includes('model') || message.includes('grok')) {
        return {
          type: 'model_not_found',
          message: `Model not found: ${message}. Available models: grok-2-1212, grok-2-vision-beta`,
          statusCode: status
        }
      }
      return {
        type: 'unknown',
        message: `Not found: ${message}`,
        statusCode: status
      }
    }

    if (status === 429) {
      // Rate limit
      const retryAfter = response.headers.get('Retry-After')
      return {
        type: 'rate_limit',
        message: `Rate limit exceeded: ${message}. Retry after ${retryAfter || 'some time'}.`,
        statusCode: status,
        retry_after: retryAfter ? parseInt(retryAfter) : undefined
      }
    }

    if (status === 413 || status === 400) {
      // Check for model not found in 400 errors (xAI returns 400 for model not found)
      if (message.includes('model') && (message.includes('does not exist') || message.includes('not have access'))) {
        return {
          type: 'model_not_found',
          message: `Model not found: ${message}. Available models: grok-2-1212, grok-2-vision-beta`,
          statusCode: status
        }
      }
      // Could be context overflow (413) or invalid request (400)
      if (message.includes('context') || message.includes('token') || message.includes('length')) {
        return {
          type: 'context_overflow',
          message: `Context window exceeded: ${message}. Reduce prompt size or use fewer images.`,
          statusCode: status
        }
      }
      // Check for image input not supported
      if (message.includes('Image inputs are not supported')) {
        return {
          type: 'model_not_found',
          message: `Model does not support images: ${message}. Use text-only mode or grok-2-vision-beta.`,
          statusCode: status
        }
      }
    }

    // Generic error
    return {
      type: 'unknown',
      message: `Grok API error (${status}): ${message}`,
      statusCode: status
    }
  }
}

// Export singleton instance
export const grokAdapter = new GrokAdapter()

// Export convenience functions
export async function initGrok(auth: GrokAuth): Promise<void> {
  grokAdapter.init(auth)
}

export async function grokHealthcheck(): Promise<{ ok: boolean; models: GrokModel[]; error?: string }> {
  return grokAdapter.healthcheck()
}

export async function callGrok(options: GrokCallOptions): Promise<GrokResponse> {
  return grokAdapter.call(options)
}

