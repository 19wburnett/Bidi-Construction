import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY })

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
  // Convert each image to OpenAI's format
  // IMPORTANT: Sending ALL images to OpenAI
  const imageContent = images.map(img => ({
    type: 'image_url' as const,
    image_url: { url: img, detail: 'high' as const }
  }))

  // Use gpt-4o for vision analysis (most reliable vision model)
  // GPT-5 may not support vision API yet, or may need different parameters
  const model = process.env.OPENAI_MODEL || 'gpt-4o' // Configurable via env
  
  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { 
        role: 'user', 
        content: [
          { type: 'text', text: options.userPrompt },
          ...imageContent
        ] 
      }
    ],
    max_completion_tokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.2,
    response_format: { type: 'json_object' }
  })

  return {
    provider: 'openai',
    content: response.choices[0].message.content || '',
    finishReason: response.choices[0].finish_reason,
    tokensUsed: response.usage?.total_tokens
  }
}

export async function analyzeWithClaude(
  images: string[], // ALL plan page images as base64 data URLs
  options: AnalysisOptions
): Promise<AIResponse> {
  // IMPORTANT: Sending ALL images to Claude
  const imageContent = images.map(img => {
    const base64Data = img.split(',')[1] || img
    const mediaType = img.includes('jpeg') ? 'image/jpeg' : 'image/png'
    
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: mediaType as 'image/jpeg' | 'image/png',
        data: base64Data
      }
    }
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5', // Claude 4.5 Sonnet - Latest model
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.2,
    system: options.systemPrompt,
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
    provider: 'claude',
    content: (textContent as any)?.text || '',
    finishReason: response.stop_reason || 'unknown',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens
  }
}

export async function analyzeWithGemini(
  images: string[], // ALL plan page images as base64 data URLs
  options: AnalysisOptions
): Promise<AIResponse> {
  // Use gemini-2.5-flash - Latest model with vision support
  // IMPORTANT: Sending ALL images to Gemini
  const parts: any[] = [
    { text: `${options.systemPrompt}\n\n${options.userPrompt}\n\nIMPORTANT: Respond with ONLY a JSON object, no other text.` }
  ]
  
  // Add all images as parts
  images.forEach(img => {
    parts.push({
      inlineData: {
        mimeType: img.includes('jpeg') ? 'image/jpeg' : 'image/png',
        data: img.split(',')[1] || img
      }
    })
  })

  const response = await gemini.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: parts,
    config: {
      maxOutputTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.2
    }
  })
  
  const text = response.text || ''
  
  // Ensure we got a response
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini returned empty response')
  }
  
  return {
    provider: 'gemini',
    content: text,
    finishReason: 'stop',
    tokensUsed: undefined
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

