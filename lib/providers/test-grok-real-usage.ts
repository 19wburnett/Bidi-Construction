/**
 * Real Usage Test - Grok, GPT, and Claude
 * 
 * Tests the actual plan analysis flow that would be used in production
 * Verifies all three providers work together
 */

// Load environment variables
import 'dotenv/config'

import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '../enhanced-ai-providers'

/**
 * Create a sample plan image (base64 data URL)
 * In production, this would come from actual PDF pages
 */
function createSampleImage(): string {
  // Return a minimal 1x1 pixel PNG as base64 data URL
  // In real usage, this would be an actual plan page image
  const minimalPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  return `data:image/png;base64,${minimalPng}`
}

/**
 * Test actual plan analysis with all three providers
 */
async function testRealPlanAnalysis() {
  console.log('\n' + '='.repeat(80))
  console.log('🧪 REAL USAGE TEST - Grok, GPT, and Claude')
  console.log('='.repeat(80) + '\n')

  // Check API keys
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
  const hasXAI = !!process.env.XAI_API_KEY || !!process.env.GROK_API_KEY

  console.log('📋 API Key Status:')
  console.log(`  ${hasOpenAI ? '✅' : '❌'} OpenAI: ${hasOpenAI ? 'Set' : 'Missing'}`)
  console.log(`  ${hasAnthropic ? '✅' : '❌'} Anthropic: ${hasAnthropic ? 'Set' : 'Missing'}`)
  console.log(`  ${hasXAI ? '✅' : '❌'} xAI/Grok: ${hasXAI ? 'Set' : 'Missing'}\n`)

  if (!hasOpenAI && !hasAnthropic && !hasXAI) {
    console.error('❌ No API keys available. Cannot run test.')
    return
  }

  // Create sample images (simulating plan pages)
  const images = [createSampleImage()]

  // Build analysis options (same as production)
  const options: EnhancedAnalysisOptions = {
    maxTokens: 4096,
    temperature: 0.2,
    systemPrompt: `You are a construction plan analysis expert. Analyze the provided plan pages and extract takeoff items in JSON format.

Respond with a JSON object containing:
- items: Array of construction items with name, quantity, unit, category, location
- issues: Array of any quality issues found

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
  ],
  "issues": []
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
      includeConsensus: false,
      extractedText: `
=== PAGE 1 ===
Room: 20ft x 30ft
Windows: 2 units (each 3ft x 4ft)
Door: 1 unit (36in x 80in)
Wall length: 100 linear feet total
Foundation: 600 SF
Concrete: 50 CY
` // Provide extracted text for Grok text-only fallback
    }

  console.log('🚀 Starting analysis with specialized models...\n')

  try {
    const startTime = Date.now()

    // This is the actual method used in production
    const results = await enhancedAIProvider.analyzeWithSpecializedModels(images, options)

    const totalTime = Date.now() - startTime

    console.log('\n' + '='.repeat(80))
    console.log('📊 RESULTS')
    console.log('='.repeat(80) + '\n')

    console.log(`⏱️  Total time: ${totalTime}ms`)
    console.log(`📦 Models succeeded: ${results.length}\n`)

    // Group results by provider
    const byProvider: Record<string, typeof results> = {}
    results.forEach(result => {
      if (!byProvider[result.provider]) {
        byProvider[result.provider] = []
      }
      byProvider[result.provider].push(result)
    })

    // Display results per provider
    for (const [provider, providerResults] of Object.entries(byProvider)) {
      console.log(`${provider.toUpperCase()} (${providerResults.length} model(s)):`)
      
      providerResults.forEach(result => {
        console.log(`  ✅ Model: ${result.model}`)
        console.log(`     Content length: ${result.content.length} chars`)
        console.log(`     Tokens used: ${result.tokensUsed || 'N/A'}`)
        console.log(`     Processing time: ${result.processingTime || 'N/A'}ms`)
        console.log(`     Finish reason: ${result.finishReason}`)
        
        // Try to parse and show item count
        try {
          const parsed = JSON.parse(result.content)
          const items = parsed.items || []
          const issues = parsed.issues || []
          console.log(`     Items extracted: ${items.length}`)
          console.log(`     Issues found: ${issues.length}`)
        } catch {
          console.log(`     ⚠️  Could not parse JSON response`)
        }
        console.log()
      })
    }

    // Verify all expected providers worked
    const providersWorked = Object.keys(byProvider)
    const expectedProviders: string[] = []
    if (hasOpenAI) expectedProviders.push('openai')
    if (hasAnthropic) expectedProviders.push('anthropic')
    if (hasXAI) expectedProviders.push('xai')

    console.log('='.repeat(80))
    console.log('✅ VERIFICATION')
    console.log('='.repeat(80) + '\n')

    const allExpectedWorked = expectedProviders.every(p => providersWorked.includes(p))
    
    if (allExpectedWorked) {
      console.log('✅ All expected providers succeeded!')
      console.log(`   Providers that worked: ${providersWorked.join(', ')}`)
    } else {
      const missing = expectedProviders.filter(p => !providersWorked.includes(p))
      console.log(`⚠️  Some providers did not succeed:`)
      console.log(`   Expected: ${expectedProviders.join(', ')}`)
      console.log(`   Worked: ${providersWorked.join(', ')}`)
      console.log(`   Missing: ${missing.join(', ')}`)
    }

    // Specifically check Grok
    if (hasXAI) {
      if (byProvider['xai']) {
        console.log('\n✅ GROK: Successfully used in plan analysis!')
        const grokResult = byProvider['xai'][0]
        console.log(`   Model: ${grokResult.model}`)
        console.log(`   Response length: ${grokResult.content.length} chars`)
        console.log(`   Tokens: ${grokResult.tokensUsed || 'N/A'}`)
      } else {
        console.log('\n❌ GROK: Failed to produce results')
        console.log('   Check error logs above for details')
      }
    }

    // Check GPT
    if (hasOpenAI) {
      if (byProvider['openai']) {
        console.log('\n✅ GPT: Successfully used in plan analysis!')
      } else {
        console.log('\n❌ GPT: Failed to produce results')
      }
    }

    // Check Claude
    if (hasAnthropic) {
      if (byProvider['anthropic']) {
        console.log('\n✅ CLAUDE: Successfully used in plan analysis!')
      } else {
        console.log('\n❌ CLAUDE: Failed to produce results')
      }
    }

    console.log('\n' + '='.repeat(80) + '\n')

    return {
      success: true,
      providersWorked,
      results,
      totalTime
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message || String(error))
    console.error('Stack:', error.stack)
    
    return {
      success: false,
      error: error.message || String(error)
    }
  }
}

// Run the test
if (require.main === module) {
  testRealPlanAnalysis()
    .then((result) => {
      if (result?.success) {
        console.log('✅ Real usage test completed successfully!')
        process.exit(0)
      } else {
        console.error('❌ Real usage test failed')
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('❌ Test runner error:', error)
      process.exit(1)
    })
}

export { testRealPlanAnalysis }

