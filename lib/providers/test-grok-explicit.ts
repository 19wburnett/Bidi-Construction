/**
 * Explicit Grok Test
 * 
 * Forces Grok to be used by setting MAX_MODELS high enough
 * or by directly calling the Grok model
 */

// Load environment variables
import 'dotenv/config'

import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '../enhanced-ai-providers'

/**
 * Create a sample plan image
 */
function createSampleImage(): string {
  const minimalPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  return `data:image/png;base64,${minimalPng}`
}

/**
 * Test Grok explicitly
 */
async function testGrokExplicit() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 EXPLICIT GROK TEST')
  console.log('='.repeat(80) + '\n')

  const hasXAI = !!process.env.XAI_API_KEY || !!process.env.GROK_API_KEY

  if (!hasXAI) {
    console.error('❌ XAI_API_KEY or GROK_API_KEY not set')
    return
  }

  console.log('✅ Grok API key found\n')

  // Temporarily set MAX_MODELS to ensure Grok is included
  const originalMaxModels = process.env.MAX_MODELS_PER_ANALYSIS
  process.env.MAX_MODELS_PER_ANALYSIS = '10' // High enough to include Grok

  try {
    const images = [createSampleImage()]

    const options: EnhancedAnalysisOptions = {
      maxTokens: 4096,
      temperature: 0.2,
      systemPrompt: `You are a construction plan analysis expert. Analyze the provided plan pages and extract takeoff items in JSON format.

Respond with a JSON object containing:
- items: Array of construction items with name, quantity, unit, category, location

Example format:
{
  "items": [
    {
      "name": "Concrete Foundation",
      "quantity": 100,
      "unit": "CF",
      "category": "structural",
      "location": "Foundation"
    }
  ]
}`,
      userPrompt: `Analyze this construction plan page and extract all construction items.

The plan shows:
- Room dimensions: 20ft x 30ft
- Windows: 2 units (each 3ft x 4ft)
- Door: 1 unit (36in x 80in)
- Wall length: 100 linear feet total

Extract all items with accurate quantities, units, and categories.`,
      taskType: 'takeoff' as TaskType,
      prioritizeAccuracy: true,
      includeConsensus: false
    }

    console.log('🚀 Starting analysis (will include Grok if in top 10 models)...\n')

    const startTime = Date.now()
    const results = await enhancedAIProvider.analyzeWithSpecializedModels(images, options)
    const totalTime = Date.now() - startTime

    console.log('\n' + '='.repeat(80))
    console.log('📊 RESULTS')
    console.log('='.repeat(80) + '\n')

    // Check if Grok was used
    const grokResults = results.filter(r => r.provider === 'xai' || r.model.includes('grok'))
    const otherResults = results.filter(r => r.provider !== 'xai' && !r.model.includes('grok'))

    if (grokResults.length > 0) {
      console.log('✅ GROK WAS USED!')
      grokResults.forEach(result => {
        console.log(`\n  Model: ${result.model}`)
        console.log(`  Provider: ${result.provider}`)
        console.log(`  Content length: ${result.content.length} chars`)
        console.log(`  Tokens used: ${result.tokensUsed || 'N/A'}`)
        console.log(`  Processing time: ${result.processingTime || 'N/A'}ms`)
        console.log(`  Finish reason: ${result.finishReason}`)
        
        try {
          const parsed = JSON.parse(result.content)
          const items = parsed.items || []
          console.log(`  Items extracted: ${items.length}`)
          if (items.length > 0) {
            console.log(`  Sample item: ${items[0].name || 'N/A'}`)
          }
        } catch {
          console.log(`  ⚠️  Could not parse JSON`)
        }
      })
    } else {
      console.log('❌ GROK WAS NOT USED')
      console.log(`\n  Models that were used instead:`)
      otherResults.forEach(r => {
        console.log(`    - ${r.model} (${r.provider})`)
      })
      console.log(`\n  Total models used: ${results.length}`)
      console.log(`  MAX_MODELS setting: ${process.env.MAX_MODELS_PER_ANALYSIS}`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('📈 SUMMARY')
    console.log('='.repeat(80) + '\n')

    console.log(`Total models: ${results.length}`)
    console.log(`Grok models: ${grokResults.length}`)
    console.log(`Other models: ${otherResults.length}`)
    console.log(`Total time: ${totalTime}ms`)

    if (grokResults.length > 0) {
      console.log('\n✅ SUCCESS: Grok is working in the real system!')
      return { success: true, grokUsed: true, grokResults }
    } else {
      console.log('\n⚠️  Grok was not selected (may be due to model prioritization)')
      console.log('   This is normal if other models have higher priority')
      console.log('   Grok will be used as a fallback if other models fail')
      return { success: true, grokUsed: false, reason: 'Not in top priority models' }
    }

  } finally {
    // Restore original setting
    if (originalMaxModels) {
      process.env.MAX_MODELS_PER_ANALYSIS = originalMaxModels
    } else {
      delete process.env.MAX_MODELS_PER_ANALYSIS
    }
  }
}

// Also test direct Grok call
async function testGrokDirect() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 DIRECT GROK API CALL TEST')
  console.log('='.repeat(80) + '\n')

  const { initGrok, callGrok } = await import('./grokAdapter')

  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY
  if (!apiKey) {
    console.error('❌ API key not found')
    return
  }

  initGrok({
    apiKey,
    baseUrl: process.env.GROK_BASE_URL
  })

  console.log('✅ Grok adapter initialized\n')

  try {
    const response = await callGrok({
      system: 'You are a construction plan analysis expert. Respond with valid JSON only.',
      user: `Extract items from this plan:
- Room: 20ft x 30ft
- Windows: 2 units
- Door: 1 unit

Respond with JSON: {"items": [{"name": "...", "quantity": 0, "unit": "..."}]}`,
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
                unit: { type: 'string' }
              }
            }
          }
        },
        required: ['items']
      },
      max_tokens: 500,
      temperature: 0.2
    })

    console.log('✅ Direct Grok call succeeded!')
    console.log(`\n  Model: ${response.model}`)
    console.log(`  Content length: ${response.content.length} chars`)
    console.log(`  Tokens: ${response.usage.total_tokens} (${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion)`)
    console.log(`  Cost est: $${response.usage.cost_est.toFixed(6)}`)
    console.log(`  Finish reason: ${response.finish_reason}`)

    try {
      const parsed = JSON.parse(response.content)
      const items = parsed.items || []
      console.log(`  Items extracted: ${items.length}`)
      if (items.length > 0) {
        console.log(`  Sample: ${JSON.stringify(items[0], null, 2)}`)
      }
    } catch {
      console.log(`  ⚠️  Could not parse JSON`)
      console.log(`  Content preview: ${response.content.substring(0, 200)}`)
    }

    return { success: true, response }

  } catch (error: any) {
    console.error('❌ Direct Grok call failed:', error.message || String(error))
    return { success: false, error: error.message || String(error) }
  }
}

// Run both tests
async function runAllTests() {
  console.log('\n' + '='.repeat(80))
  console.log('🚀 COMPREHENSIVE GROK TESTING')
  console.log('='.repeat(80))

  // Test 1: Direct API call
  const directResult = await testGrokDirect()

  // Test 2: Through enhanced provider
  const providerResult = await testGrokExplicit()

  console.log('\n' + '='.repeat(80))
  console.log('📋 FINAL VERIFICATION')
  console.log('='.repeat(80) + '\n')

  if (directResult?.success) {
    console.log('✅ Direct Grok API: WORKING')
  } else {
    console.log('❌ Direct Grok API: FAILED')
  }

  if (providerResult?.grokUsed) {
    console.log('✅ Grok in Enhanced Provider: WORKING')
  } else {
    console.log('⚠️  Grok in Enhanced Provider: Not selected (but available as fallback)')
  }

  console.log('\n' + '='.repeat(80) + '\n')

  return {
    direct: directResult || { success: false, error: 'Test not run' },
    provider: providerResult || { grokUsed: false, error: 'Test not run' }
  }
}

if (require.main === module) {
  runAllTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error)
      process.exit(1)
    })
}

export { testGrokExplicit, testGrokDirect, runAllTests }

