/**
 * Model Name Mapping for AI Gateway
 * 
 * Maps existing model names to AI Gateway format (provider/model)
 */

export type GatewayModelName = 
  | `openai/${string}`
  | `anthropic/${string}`
  | `google/${string}`
  | `xai/${string}`

/**
 * Map legacy model names to AI Gateway format
 */
export function toGatewayModel(model: string): GatewayModelName {
  // OpenAI models
  if (model.startsWith('gpt-') || model.startsWith('o')) {
    return `openai/${model}` as GatewayModelName
  }
  
  // Anthropic/Claude models
  if (model.startsWith('claude-') || model.includes('claude')) {
    return `anthropic/${model}` as GatewayModelName
  }
  
  // Google/Gemini models
  if (model.startsWith('gemini-') || model.includes('gemini')) {
    return `google/${model}` as GatewayModelName
  }
  
  // XAI/Grok models
  if (model.startsWith('grok-') || model.includes('grok')) {
    return `xai/${model}` as GatewayModelName
  }
  
  // Default: assume OpenAI if no prefix
  return `openai/${model}` as GatewayModelName
}

/**
 * Get provider from model name
 */
export function getProviderFromModel(model: string): 'openai' | 'anthropic' | 'google' | 'xai' {
  if (model.startsWith('openai/')) return 'openai'
  if (model.startsWith('anthropic/')) return 'anthropic'
  if (model.startsWith('google/')) return 'google'
  if (model.startsWith('xai/')) return 'xai'
  
  // Legacy model names
  if (model.startsWith('gpt-') || model.startsWith('o')) return 'openai'
  if (model.startsWith('claude-') || model.includes('claude')) return 'anthropic'
  if (model.startsWith('gemini-') || model.includes('gemini')) return 'google'
  if (model.startsWith('grok-') || model.includes('grok')) return 'xai'
  
  return 'openai' // default
}

/**
 * Remove provider prefix from model name
 */
export function removeProviderPrefix(model: string): string {
  return model.replace(/^(openai|anthropic|google|xai)\//, '')
}

/**
 * Common model mappings
 */
export const MODEL_MAPPINGS: Record<string, GatewayModelName> = {
  // OpenAI
  'gpt-5': 'openai/gpt-5',
  'gpt-5-mini': 'openai/gpt-5-mini',
  'gpt-5-nano': 'openai/gpt-5-nano',
  'gpt-4.1': 'openai/gpt-4.1',
  'gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'gpt-4.1-nano': 'openai/gpt-4.1-nano',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4-turbo': 'openai/gpt-4-turbo',
  'gpt-4-vision': 'openai/gpt-4-vision',
  'o3': 'openai/o3',
  'o4-mini': 'openai/o4-mini',
  
  // Anthropic
  'claude-sonnet-4-20250514': 'anthropic/claude-sonnet-4-20250514',
  'claude-3-haiku-20240307': 'anthropic/claude-3-haiku-20240307',
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  
  // Google
  'gemini-2.5-flash': 'google/gemini-2.5-flash',
  'gemini-1.5-pro': 'google/gemini-1.5-pro',
  'gemini-1.5-flash': 'google/gemini-1.5-flash',
  
  // XAI
  'grok-2-1212': 'xai/grok-2-1212',
  'grok-2-vision-beta': 'xai/grok-2-vision-beta',
}

/**
 * Get mapped model name or convert using toGatewayModel
 */
export function getGatewayModel(model: string): GatewayModelName {
  return MODEL_MAPPINGS[model] || toGatewayModel(model)
}




