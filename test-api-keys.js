// Load environment variables
require('dotenv').config()

// Test API keys and model availability
const testAPIKeys = async () => {
  console.log('🔑 Testing API Keys...')
  console.log('=' * 50)
  
  // Check environment variables
  const apiKeys = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    GOOGLE_GEMINI_API_KEY: !!process.env.GOOGLE_GEMINI_API_KEY,
    XAI_API_KEY: !!process.env.XAI_API_KEY,
    PDF_CO_API_KEY: !!process.env.PDF_CO_API_KEY
  }
  
  console.log('API Keys Status:')
  Object.entries(apiKeys).forEach(([key, hasKey]) => {
    console.log(`  ${hasKey ? '✅' : '❌'} ${key}`)
  })
  
  console.log('\n🤖 Model Configuration:')
  console.log(`  OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`)
  console.log(`  Anthropic Model: ${process.env.ANTHROPIC_MODEL || 'claude-3.5-sonnet'}`)
  console.log(`  Gemini Model: ${process.env.GEMINI_MODEL || 'gemini-1.5-pro'}`)
  console.log(`  XAI Model: ${process.env.XAI_MODEL || 'grok-2'}`)
  
  console.log('\n⚙️ System Configuration:')
  console.log(`  Consensus Threshold: ${process.env.CONSENSUS_THRESHOLD || '0.6'}`)
  console.log(`  Max Models: ${process.env.MAX_MODELS_PER_ANALYSIS || '5'}`)
  console.log(`  Enable XAI: ${process.env.ENABLE_XAI || 'true'}`)
  
  // Test OpenAI API
  if (apiKeys.OPENAI_API_KEY) {
    console.log('\n🧪 Testing OpenAI API...')
    try {
      const OpenAI = require('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      
      // Test with a simple completion
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello, this is a test.' }],
        max_completion_tokens: 10
      })
      
      console.log(`  ✅ OpenAI API working: ${response.choices[0].message.content}`)
    } catch (error) {
      console.log(`  ❌ OpenAI API failed: ${error.message}`)
    }
  }
  
  // Test Anthropic API
  if (apiKeys.ANTHROPIC_API_KEY) {
    console.log('\n🧪 Testing Anthropic API...')
    try {
      const Anthropic = require('@anthropic-ai/sdk')
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello, this is a test.' }]
      })
      
      console.log(`  ✅ Anthropic API working: ${response.content[0].text}`)
    } catch (error) {
      console.log(`  ❌ Anthropic API failed: ${error.message}`)
    }
  }
  
  // Test Google Gemini API
  if (apiKeys.GOOGLE_GEMINI_API_KEY) {
    console.log('\n🧪 Testing Google Gemini API...')
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
      
      const model = gemini.getGenerativeModel({ 
        model: 'gemini-1.5-pro-latest'
      })
      
      const response = await model.generateContent('Hello, this is a test.')
      console.log(`  ✅ Google Gemini API working: ${response.response.text()}`)
    } catch (error) {
      console.log(`  ❌ Google Gemini API failed: ${error.message}`)
    }
  }
  
  console.log('\n🎯 Summary:')
  const workingAPIs = Object.values(apiKeys).filter(Boolean).length
  console.log(`  Working APIs: ${workingAPIs}/5`)
  console.log(`  Ready for enhanced analysis: ${workingAPIs >= 2 ? '✅' : '❌'}`)
  
  return {
    success: workingAPIs >= 2,
    workingAPIs,
    totalAPIs: 5
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
