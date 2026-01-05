/**
 * Available AI models for Plan Chat
 * These models are available via AI Gateway
 */

export interface ChatModel {
  id: string
  name: string
  provider: 'OpenAI' | 'Anthropic' | 'Google' | 'XAI'
  description: string
  speed: 'fast' | 'medium' | 'slow'
  quality: 'high' | 'medium'
}

export const AVAILABLE_CHAT_MODELS: ChatModel[] = [
  // OpenAI Models
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'OpenAI',
    description: 'Latest OpenAI model, premium quality',
    speed: 'slow',
    quality: 'high',
  },
  // Anthropic Models
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    description: 'Latest Claude model, high quality',
    speed: 'medium',
    quality: 'high',
  },
  // Google Models
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    description: 'Latest fast model',
    speed: 'fast',
    quality: 'high',
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    description: 'Latest high quality model',
    speed: 'slow',
    quality: 'high',
  },
  // XAI Models
  {
    id: 'grok-4',
    name: 'Grok 4',
    provider: 'XAI',
    description: 'Latest Grok model',
    speed: 'fast',
    quality: 'high',
  },
]

export const DEFAULT_CHAT_MODEL = 'gpt-5.2'

export function getModelById(id: string): ChatModel | undefined {
  return AVAILABLE_CHAT_MODELS.find((model) => model.id === id)
}

export function getModelDisplayName(id: string): string {
  const model = getModelById(id)
  return model ? model.name : id
}

