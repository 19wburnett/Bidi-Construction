/**
 * Test script for Model Orchestrator
 * This verifies that models can respond and work together
 */

require('dotenv').config()

async function testOrchestrator() {
  console.log('🧪 Testing Model Orchestrator & Adjudicator')
  console.log('='.repeat(60))
  
  // Check API keys
  console.log('\n🔑 Checking API Keys...')
  const apiKeys = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    GOOGLE_GEMINI_API_KEY: !!process.env.GOOGLE_GEMINI_API_KEY,
    XAI_API_KEY: !!process.env.XAI_API_KEY
  }
  
  Object.entries(apiKeys).forEach(([key, available]) => {
    console.log(`  ${available ? '✅' : '❌'} ${key}`)
  })
  
  const availableCount = Object.values(apiKeys).filter(Boolean).length
  console.log(`\n📊 ${availableCount}/4 API keys available`)
  
  if (availableCount < 2) {
    console.error('\n❌ ERROR: Need at least 2 API keys to test orchestrator!')
    process.exit(1)
  }
  
  // Test individual model responses
  console.log('\n🤖 Testing Individual Model Responses...')
  const testPrompt = {
    systemPrompt: 'You are a construction analyst. Return ONLY valid JSON with this structure: {"items": [], "issues": [], "quality_analysis": {"completeness": {"overall_score": 0.8, "missing_sheets": [], "missing_dimensions": [], "missing_details": [], "incomplete_sections": []}, "consistency": {"scale_mismatches": [], "unit_conflicts": [], "dimension_contradictions": [], "schedule_vs_elevation_conflicts": []}, "risk_flags": [], "audit_trail": {"pages_analyzed": [], "chunks_processed": 0, "coverage_percentage": 0, "assumptions_made": []}}}',
    userPrompt: 'Analyze a simple construction plan. Extract 3 example items: 2x4 stud framing (150 LF), drywall (500 SF), and concrete footing (10 CY). Return JSON only.',
    taskType: 'takeoff'
  }
  
  const modelsToTest = []
  if (apiKeys.OPENAI_API_KEY) modelsToTest.push({ name: 'gpt-4o', provider: 'openai' })
  if (apiKeys.ANTHROPIC_API_KEY) modelsToTest.push({ name: 'claude-3-haiku-20240307', provider: 'anthropic' })
  if (apiKeys.GOOGLE_GEMINI_API_KEY) modelsToTest.push({ name: 'gemini-1.5-flash', provider: 'google' })
  if (apiKeys.XAI_API_KEY) modelsToTest.push({ name: 'grok-4', provider: 'xai' })
  
  const testResults = []
  
  for (const model of modelsToTest) {
    console.log(`\n  Testing ${model.name}...`)
    try {
      const startTime = Date.now()
      
      // Import the enhanced AI provider
      const { enhancedAIProvider } = require('./lib/enhanced-ai-providers.ts')
      
      const result = await Promise.race([
        enhancedAIProvider.analyzeWithSpecializedModels(
          [], // No images for simple test
          {
            systemPrompt: testPrompt.systemPrompt,
            userPrompt: testPrompt.userPrompt,
            taskType: 'takeoff',
            maxTokens: 2048,
            temperature: 0.2,
            prioritizeAccuracy: true,
            includeConsensus: false
          }
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000)
        )
      ])
      
      const modelResult = result.find(r => r.model === model.name || r.model.includes(model.name.split('-')[0]))
      
      if (modelResult && modelResult.content) {
        try {
          const parsed = JSON.parse(modelResult.content)
          const itemsCount = parsed.items?.length || 0
          const hasQA = !!parsed.quality_analysis
          
          console.log(`    ✅ ${model.name}: ${itemsCount} items, ${modelResult.content.length} chars, ${Date.now() - startTime}ms`)
          console.log(`       Quality Analysis: ${hasQA ? '✅' : '❌'}`)
          
          testResults.push({
            model: model.name,
            success: true,
            itemsCount,
            hasQA,
            responseTime: Date.now() - startTime,
            contentLength: modelResult.content.length
          })
        } catch (parseError) {
          console.log(`    ⚠️  ${model.name}: Response received but not valid JSON`)
          console.log(`       Preview: ${modelResult.content.substring(0, 100)}...`)
          testResults.push({
            model: model.name,
            success: false,
            error: 'Invalid JSON',
            responseTime: Date.now() - startTime
          })
        }
      } else {
        console.log(`    ❌ ${model.name}: No response received`)
        testResults.push({
          model: model.name,
          success: false,
          error: 'No response'
        })
      }
    } catch (error) {
      console.log(`    ❌ ${model.name}: ${error.message || 'Unknown error'}`)
      testResults.push({
        model: model.name,
        success: false,
        error: error.message || 'Unknown error'
      })
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Summary')
  console.log('='.repeat(60))
  
  const successful = testResults.filter(r => r.success)
  const failed = testResults.filter(r => !r.success)
  
  console.log(`\n✅ Successful: ${successful.length}/${testResults.length}`)
  successful.forEach(r => {
    console.log(`   ${r.model}: ${r.itemsCount} items, ${r.responseTime}ms`)
  })
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${testResults.length}`)
    failed.forEach(r => {
      console.log(`   ${r.model}: ${r.error || 'Unknown error'}`)
    })
  }
  
  if (successful.length >= 2) {
    console.log('\n✅ Orchestrator can run with at least 2 models!')
    console.log('\n💡 Next Steps:')
    console.log('   1. Test with actual plan images/chunks')
    console.log('   2. Verify disagreement detection works')
    console.log('   3. Check adjudication logic')
    return 0
  } else {
    console.log('\n❌ Need at least 2 working models for orchestrator!')
    return 1
  }
}

// Run test
testOrchestrator()
  .then(exitCode => {
    process.exit(exitCode)
  })
  .catch(error => {
    console.error('\n💥 Test script crashed:', error)
    process.exit(1)
  })





