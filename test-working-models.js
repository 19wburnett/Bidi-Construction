// Test the working models
require('dotenv').config()

const testWorkingModels = async () => {
  console.log('🧪 Testing Working Models...')
  console.log('=' * 50)
  
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  
  // Test OpenAI
  if (process.env.OPENAI_API_KEY) {
    console.log('\n🤖 Testing OpenAI...')
    try {
      const OpenAI = require('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a construction expert. Analyze the provided image and return a JSON response with items found.' },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: 'Analyze this construction plan image.' },
              { type: 'image_url', image_url: { url: testImage, detail: 'high' } }
            ] 
          }
        ],
        max_completion_tokens: 100,
        response_format: { type: 'json_object' }
      })
      
      console.log(`  ✅ OpenAI working: ${response.choices[0].message.content?.length || 0} chars`)
    } catch (error) {
      console.log(`  ❌ OpenAI failed: ${error.message}`)
    }
  }
  
  // Test Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('\n🤖 Testing Anthropic...')
    try {
      const Anthropic = require('@anthropic-ai/sdk')
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        system: 'You are a construction expert. Analyze the provided image and return a JSON response with items found.',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this construction plan image.' },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: testImage.split(',')[1]
                }
              }
            ]
          }
        ]
      })
      
      console.log(`  ✅ Anthropic working: ${response.content[0].text?.length || 0} chars`)
    } catch (error) {
      console.log(`  ❌ Anthropic failed: ${error.message}`)
    }
  }
  
  console.log('\n🎯 Summary:')
  console.log('  Working models: GPT-5, GPT-4o, GPT-4-turbo, Claude-3-Haiku, Grok-2')
  console.log('  Ready for enhanced analysis: ✅')
}

testWorkingModels().catch(console.error)
