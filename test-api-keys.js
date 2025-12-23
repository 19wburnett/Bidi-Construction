// Load environment variables
require('dotenv').config()

// Test API keys and model availability
const testAPIKeys = async () => {
  console.log('🔑 Testing API Keys...')
  console.log('='.repeat(50))
  
  // Check environment variables
  const apiKeys = {
    AI_GATEWAY_API_KEY: !!process.env.AI_GATEWAY_API_KEY,
    PDF_CO_API_KEY: !!process.env.PDF_CO_API_KEY
  }
  
  // Legacy keys (for AI Gateway configuration only)
  const legacyKeys = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    GOOGLE_GEMINI_API_KEY: !!process.env.GOOGLE_GEMINI_API_KEY,
    XAI_API_KEY: !!process.env.XAI_API_KEY,
  }
  
  console.log('AI Gateway API Key Status:')
  console.log(`  ${apiKeys.AI_GATEWAY_API_KEY ? '✅' : '❌'} AI_GATEWAY_API_KEY (Required)`)
  
  console.log('\nProvider API Keys (for BYOK mode only - optional):')
  Object.entries(legacyKeys).forEach(([key, hasKey]) => {
    console.log(`  ${hasKey ? '✅' : '⚠️'} ${key} (optional - only needed for BYOK mode)`)
  })
  console.log('  📝 Note: AI Gateway works automatically without these! Only configure if using BYOK mode.')
  
  console.log('\n🤖 Model Configuration:')
  console.log(`  OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`)
  console.log(`  Anthropic Model: ${process.env.ANTHROPIC_MODEL || 'claude-3.5-sonnet'}`)
  console.log(`  Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-1.5-pro'}`)
  console.log(`  XAI Model: ${process.env.XAI_MODEL || 'grok-2'}`)
  
  console.log('\n⚙️ System Configuration:')
  console.log(`  Consensus Threshold: ${process.env.CONSENSUS_THRESHOLD || '0.6'}`)
  console.log(`  Max Models: ${process.env.MAX_MODELS_PER_ANALYSIS || '5'}`)
  console.log(`  Enable XAI: ${process.env.ENABLE_XAI || 'true'}`)
  
  // Test AI Gateway
  if (apiKeys.AI_GATEWAY_API_KEY) {
    console.log('\n🧪 Testing AI Gateway...')
    try {
      const { aiGateway } = require('./lib/ai-gateway-provider')
      
      // Test with a simple completion
      const response = await aiGateway.generate({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        prompt: 'Hello, this is a test.',
        maxTokens: 10
      })
      
      console.log(`  ✅ AI Gateway working: ${response.content}`)
    } catch (error) {
      console.log(`  ❌ AI Gateway failed: ${error.message}`)
    }
  } else {
    console.log('\n⚠️  AI_GATEWAY_API_KEY not set. Cannot test AI Gateway.')
  }
  
  // Test Anthropic via AI Gateway (if configured)
  if (apiKeys.AI_GATEWAY_API_KEY) {
    console.log('\n🧪 Testing Anthropic via AI Gateway...')
    try {
      const { aiGateway } = require('./lib/ai-gateway-provider')
      
      const response = await aiGateway.generate({
        model: 'claude-sonnet-4-20250514',
        prompt: 'Hello, this is a test.',
        maxTokens: 10
      })
      
      console.log(`  ✅ Anthropic via AI Gateway working: ${response.content}`)
    } catch (error) {
      console.log(`  ❌ Anthropic via AI Gateway failed: ${error.message}`)
    }
  }
  
  // Test Google Gemini via AI Gateway (if configured)
  if (apiKeys.AI_GATEWAY_API_KEY) {
    console.log('\n🧪 Testing Google Gemini via AI Gateway...')
    try {
      const { aiGateway } = require('./lib/ai-gateway-provider')
      
      const response = await aiGateway.generate({
        model: 'gemini-2.5-flash',
        prompt: 'Hello, this is a test.',
        maxTokens: 10
      })
      
      console.log(`  ✅ Google Gemini via AI Gateway working: ${response.content}`)
    } catch (error) {
      console.log(`  ❌ Google Gemini via AI Gateway failed: ${error.message}`)
    }
  }
  
  console.log('\n🎯 Summary:')
  const hasGateway = apiKeys.AI_GATEWAY_API_KEY
  console.log(`  AI Gateway: ${hasGateway ? '✅ Configured' : '❌ Not configured'}`)
  console.log(`  Ready for enhanced analysis: ${hasGateway ? '✅' : '❌'}`)
  console.log('\n📝 Note: AI Gateway works automatically with just AI_GATEWAY_API_KEY! Provider keys are only needed for BYOK mode (optional).')
  
  return {
    success: hasGateway,
    hasGateway,
    legacyKeysConfigured: Object.values(legacyKeys).filter(Boolean).length
  }
}

// Run the test
if (typeof window === 'undefined') {
  testAPIKeys().then(result => {
    console.log('\n📋 Test Results:', result)
    process.exit(result.success ? 0 : 1)
  })
} else {
  console.log('Run this in Node.js to test API keys')
}

module.exports = { testAPIKeys }
