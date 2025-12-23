// Check available models via AI Gateway
require('dotenv').config()

const checkAvailableModels = async () => {
  console.log('🔍 Checking Available Models via AI Gateway...')
  console.log('='.repeat(50))
  
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.log('❌ AI_GATEWAY_API_KEY not set. Please configure it in your environment variables.')
    console.log('📝 Note: Individual provider API keys are configured in the AI Gateway dashboard.')
    return
  }
  
  const { aiGateway } = require('./lib/ai-gateway-provider')
  
  // Check Anthropic models via AI Gateway
  console.log('\n🤖 Anthropic Models (via AI Gateway):')
  const claudeModels = [
    'claude-sonnet-4-20250514',
    'claude-3-haiku-20240307',
    'claude-3.5-sonnet'
  ]
  
  for (const model of claudeModels) {
    try {
      const response = await aiGateway.generate({
        model: model,
        prompt: 'Hi',
        maxTokens: 5
      })
      console.log(`  ✅ ${model}: Working`)
    } catch (error) {
      console.log(`  ❌ ${model}: ${error.message.split('\n')[0]}`)
    }
  }
  
  // Check Google Gemini models via AI Gateway
  console.log('\n🤖 Google Gemini Models (via AI Gateway):')
  const geminiModels = [
    'gemini-2.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ]
  
  for (const model of geminiModels) {
    try {
      const response = await aiGateway.generate({
        model: model,
        prompt: 'Hi',
        maxTokens: 5
      })
      console.log(`  ✅ ${model}: Working`)
    } catch (error) {
      console.log(`  ❌ ${model}: ${error.message.split('\n')[0]}`)
    }
  }
  
  // Check OpenAI models via AI Gateway
  console.log('\n🤖 OpenAI Models (via AI Gateway):')
  const openaiModels = [
    'gpt-5',
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4-vision'
  ]
  
  for (const model of openaiModels) {
    try {
      const response = await aiGateway.generate({
        model: model,
        prompt: 'Hi',
        maxTokens: 5
      })
      console.log(`  ✅ ${model}: Working`)
    } catch (error) {
      console.log(`  ❌ ${model}: ${error.message.split('\n')[0]}`)
    }
  }
  
  // Check XAI models via AI Gateway
  console.log('\n🤖 XAI/Grok Models (via AI Gateway):')
  const xaiModels = [
    'grok-2-1212',
    'grok-2-vision-beta'
  ]
  
  for (const model of xaiModels) {
    try {
      const response = await aiGateway.generate({
        model: model,
        prompt: 'Hi',
        maxTokens: 5
      })
      console.log(`  ✅ ${model}: Working`)
    } catch (error) {
      console.log(`  ❌ ${model}: ${error.message.split('\n')[0]}`)
    }
  }
  
  console.log('\n🎯 Recommended Model Names (AI Gateway format):')
  console.log('  OpenAI: openai/gpt-4o (or openai/gpt-5 if available)')
  console.log('  Anthropic: anthropic/claude-sonnet-4-20250514')
  console.log('  Google: google/gemini-2.5-flash')
  console.log('  XAI: xai/grok-2-1212')
}

checkAvailableModels().catch(console.error)
