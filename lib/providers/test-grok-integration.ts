/**
 * Grok Integration Test
 * 
 * Tests Grok adapter against GPT and Claude to verify parity
 * Compares responses on the same page batch to identify deltas
 */

// Load environment variables
import 'dotenv/config'

import { initGrok, grokHealthcheck, callGrok } from './grokAdapter'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

interface TestResult {
  provider: string
  model: string
  content: string
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cost_est?: number
  }
  finish_reason: string
  processing_time_ms: number
  error?: string
}

interface ComparisonResult {
  grok: TestResult
  gpt: TestResult
  claude: TestResult
  field_comparison: {
    grok_vs_gpt: number // Percentage of fields that match
    grok_vs_claude: number
    gpt_vs_claude: number
  }
  deltas: {
    grok_unique: string[]
    gpt_unique: string[]
    claude_unique: string[]
  }
}

/**
 * Sample page batch for testing
 * In production, this would come from actual plan PDFs
 */
function getSamplePageBatch(): Array<{ text: string; image_url?: string }> {
  // Return a minimal test case
  return [
    {
      text: 'Sample construction plan page with dimensions: 20ft x 30ft room, 2 windows, 1 door',
      // In real test, would include actual image URLs from PDF
    }
  ]
}

/**
 * Test Grok adapter
 */
async function testGrok(pages: Array<{ text: string; image_url?: string }>): Promise<TestResult> {
  const startTime = Date.now()
  
  try {
    // Initialize if not already done
    if (!process.env.XAI_API_KEY && !process.env.GROK_API_KEY) {
      throw new Error('XAI_API_KEY or GROK_API_KEY not set')
    }

    initGrok({
      apiKey: process.env.XAI_API_KEY || process.env.GROK_API_KEY!,
      baseUrl: process.env.GROK_BASE_URL
    })

    // Healthcheck
    const health = await grokHealthcheck()
    if (!health.ok) {
      throw new Error(`Grok healthcheck failed: ${health.error}`)
    }

    console.log(`✅ Grok healthcheck passed. Models: ${health.models.map(m => m.id).join(', ')}`)

    // Build prompt
    const systemPrompt = `You are a construction plan analysis expert. Analyze the provided plan pages and extract takeoff items in JSON format.`
    const userPrompt = `Analyze these plan pages and extract construction items:\n\n${pages.map((p, i) => `Page ${i + 1}: ${p.text}`).join('\n\n')}\n\nRespond with JSON: {"items": [{"name": "...", "quantity": 0, "unit": "...", "category": "..."}]}`

    // Call Grok
    const response = await callGrok({
      system: systemPrompt,
      user: userPrompt,
      max_tokens: 4096,
      temperature: 0.2,
      json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                category: { type: 'string' }
              }
            }
          }
        },
        required: ['items']
      }
    })

    return {
      provider: 'grok',
      model: response.model,
      content: response.content,
      usage: response.usage,
      finish_reason: response.finish_reason,
      processing_time_ms: Date.now() - startTime
    }
  } catch (error: any) {
    return {
      provider: 'grok',
      model: 'grok-2-1212',
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      finish_reason: 'error',
      processing_time_ms: Date.now() - startTime,
      error: error.message || String(error)
    }
  }
}

/**
 * Test GPT
 */
async function testGPT(pages: Array<{ text: string; image_url?: string }>): Promise<TestResult> {
  const startTime = Date.now()
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set')
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const systemPrompt = `You are a construction plan analysis expert. Analyze the provided plan pages and extract takeoff items in JSON format.`
    const userPrompt = `Analyze these plan pages and extract construction items:\n\n${pages.map((p, i) => `Page ${i + 1}: ${p.text}`).join('\n\n')}\n\nRespond with JSON: {"items": [{"name": "...", "quantity": 0, "unit": "...", "category": "..."}]}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 4096,
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })

    return {
      provider: 'openai',
      model: 'gpt-4o',
      content: response.choices[0].message.content || '',
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      },
      finish_reason: response.choices[0].finish_reason || 'stop',
      processing_time_ms: Date.now() - startTime
    }
  } catch (error: any) {
    return {
      provider: 'openai',
      model: 'gpt-4o',
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      finish_reason: 'error',
      processing_time_ms: Date.now() - startTime,
      error: error.message || String(error)
    }
  }
}

/**
 * Test Claude
 */
async function testClaude(pages: Array<{ text: string; image_url?: string }>): Promise<TestResult> {
  const startTime = Date.now()
  
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set')
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `You are a construction plan analysis expert. Analyze the provided plan pages and extract takeoff items in JSON format.`
    const userPrompt = `Analyze these plan pages and extract construction items:\n\n${pages.map((p, i) => `Page ${i + 1}: ${p.text}`).join('\n\n')}\n\nRespond with JSON: {"items": [{"name": "...", "quantity": 0, "unit": "...", "category": "..."}]}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    })

    const textContent = response.content.find(c => c.type === 'text')
    const content = (textContent as any)?.text || ''

    return {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      content,
      usage: {
        prompt_tokens: response.usage?.input_tokens || 0,
        completion_tokens: response.usage?.output_tokens || 0,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      finish_reason: response.stop_reason || 'stop',
      processing_time_ms: Date.now() - startTime
    }
  } catch (error: any) {
    return {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      finish_reason: 'error',
      processing_time_ms: Date.now() - startTime,
      error: error.message || String(error)
    }
  }
}

/**
 * Extract items from JSON response
 */
function extractItems(content: string): any[] {
  try {
    // Remove markdown code blocks if present
    let jsonText = content
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1]
    }

    const parsed = JSON.parse(jsonText)
    return parsed.items || []
  } catch {
    return []
  }
}

/**
 * Compare results from three providers
 */
function compareResults(grok: TestResult, gpt: TestResult, claude: TestResult): ComparisonResult {
  const grokItems = extractItems(grok.content)
  const gptItems = extractItems(gpt.content)
  const claudeItems = extractItems(claude.content)

  // Extract field names for comparison
  const grokFields = new Set(grokItems.map((item: any) => item.name?.toLowerCase()).filter(Boolean))
  const gptFields = new Set(gptItems.map((item: any) => item.name?.toLowerCase()).filter(Boolean))
  const claudeFields = new Set(claudeItems.map((item: any) => item.name?.toLowerCase()).filter(Boolean))

  // Calculate overlap (using Array.from to avoid downlevelIteration requirement)
  const grokGptIntersection = new Set(Array.from(grokFields).filter(x => gptFields.has(x)))
  const grokClaudeIntersection = new Set(Array.from(grokFields).filter(x => claudeFields.has(x)))
  const gptClaudeIntersection = new Set(Array.from(gptFields).filter(x => claudeFields.has(x)))

  const grokVsGpt = grokFields.size > 0 ? (grokGptIntersection.size / Math.max(grokFields.size, gptFields.size)) * 100 : 0
  const grokVsClaude = grokFields.size > 0 ? (grokClaudeIntersection.size / Math.max(grokFields.size, claudeFields.size)) * 100 : 0
  const gptVsClaude = gptFields.size > 0 ? (gptClaudeIntersection.size / Math.max(gptFields.size, claudeFields.size)) * 100 : 0

  // Find unique items (using Array.from to avoid downlevelIteration requirement)
  const grokUnique = Array.from(grokFields).filter(x => !gptFields.has(x) && !claudeFields.has(x))
  const gptUnique = Array.from(gptFields).filter(x => !grokFields.has(x) && !claudeFields.has(x))
  const claudeUnique = Array.from(claudeFields).filter(x => !grokFields.has(x) && !gptFields.has(x))

  return {
    grok,
    gpt,
    claude,
    field_comparison: {
      grok_vs_gpt: grokVsGpt,
      grok_vs_claude: grokVsClaude,
      gpt_vs_claude: gptVsClaude
    },
    deltas: {
      grok_unique: grokUnique,
      gpt_unique: gptUnique,
      claude_unique: claudeUnique
    }
  }
}

/**
 * Main test runner
 */
export async function runGrokIntegrationTest(): Promise<ComparisonResult> {
  console.log('\n' + '='.repeat(80))
  console.log('🔬 GROK INTEGRATION TEST')
  console.log('='.repeat(80) + '\n')

  const pages = getSamplePageBatch()
  console.log(`📄 Testing with ${pages.length} sample page(s)\n`)

  // Run all three providers in parallel
  console.log('🚀 Running providers in parallel...\n')
  const [grok, gpt, claude] = await Promise.all([
    testGrok(pages),
    testGPT(pages),
    testClaude(pages)
  ])

  // Print results
  console.log('\n' + '='.repeat(80))
  console.log('📊 RESULTS')
  console.log('='.repeat(80) + '\n')

  console.log('Grok:')
  if (grok.error) {
    console.log(`  ❌ Error: ${grok.error}`)
  } else {
    console.log(`  ✅ Model: ${grok.model}`)
    console.log(`  ✅ Tokens: ${grok.usage.total_tokens} (${grok.usage.prompt_tokens} prompt + ${grok.usage.completion_tokens} completion)`)
    console.log(`  ✅ Cost est: $${grok.usage.cost_est?.toFixed(6) || 'N/A'}`)
    console.log(`  ✅ Time: ${grok.processing_time_ms}ms`)
    console.log(`  ✅ Items extracted: ${extractItems(grok.content).length}`)
  }

  const gptItems = extractItems(gpt.content)
  const claudeItems = extractItems(claude.content)

  console.log('\nGPT:')
  if (gpt.error) {
    console.log(`  ❌ Error: ${gpt.error}`)
  } else {
    console.log(`  ✅ Model: ${gpt.model}`)
    console.log(`  ✅ Tokens: ${gpt.usage.total_tokens} (${gpt.usage.prompt_tokens} prompt + ${gpt.usage.completion_tokens} completion)`)
    console.log(`  ✅ Time: ${gpt.processing_time_ms}ms`)
    console.log(`  ✅ Items extracted: ${gptItems.length}`)
  }

  console.log('\nClaude:')
  if (claude.error) {
    console.log(`  ❌ Error: ${claude.error}`)
  } else {
    console.log(`  ✅ Model: ${claude.model}`)
    console.log(`  ✅ Tokens: ${claude.usage.total_tokens} (${claude.usage.prompt_tokens} prompt + ${claude.usage.completion_tokens} completion)`)
    console.log(`  ✅ Time: ${claude.processing_time_ms}ms`)
    console.log(`  ✅ Items extracted: ${claudeItems.length}`)
  }

  // Compare
  const comparison = compareResults(grok, gpt, claude)

  console.log('\n' + '='.repeat(80))
  console.log('📈 COMPARISON')
  console.log('='.repeat(80) + '\n')

  console.log(`Field Overlap:`)
  console.log(`  Grok vs GPT: ${comparison.field_comparison.grok_vs_gpt.toFixed(1)}%`)
  console.log(`  Grok vs Claude: ${comparison.field_comparison.grok_vs_claude.toFixed(1)}%`)
  console.log(`  GPT vs Claude: ${comparison.field_comparison.gpt_vs_claude.toFixed(1)}%`)

  console.log(`\nUnique Items:`)
  console.log(`  Grok only: ${comparison.deltas.grok_unique.length}`)
  console.log(`  GPT only: ${comparison.deltas.gpt_unique.length}`)
  console.log(`  Claude only: ${comparison.deltas.claude_unique.length}`)

  // Acceptance criteria: Grok should extract ≥90% of fields vs GPT baseline
  const grokVsGptScore = comparison.field_comparison.grok_vs_gpt
  if (grokVsGptScore >= 90) {
    console.log(`\n✅ ACCEPTANCE TEST PASSED: Grok extracts ${grokVsGptScore.toFixed(1)}% of GPT fields (target: ≥90%)`)
  } else {
    console.log(`\n⚠️  ACCEPTANCE TEST WARNING: Grok extracts ${grokVsGptScore.toFixed(1)}% of GPT fields (target: ≥90%)`)
  }

  console.log('\n' + '='.repeat(80) + '\n')

  return comparison
}

// Run if called directly
if (require.main === module) {
  runGrokIntegrationTest()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error)
      process.exit(1)
    })
}

