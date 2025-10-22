// Check available models for each API
require('dotenv').config()

const checkAvailableModels = async () => {
  console.log('🔍 Checking Available Models...')
  console.log('=' * 50)
  
  // Check Anthropic models
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('\n🤖 Anthropic Models:')
    try {
      const Anthropic = require('@anthropic-ai/sdk')
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      
      // Try different Claude model names
      const claudeModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-5-sonnet',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307'
      ]
      
      for (const model of claudeModels) {
        try {
          const response = await anthropic.messages.create({
            model: model,
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Hi' }]
          })
          console.log(`  ✅ ${model}: Working`)
        } catch (error) {
          console.log(`  ❌ ${model}: ${error.message.split('\n')[0]}`)
        }
      }
    } catch (error) {
      console.log(`  ❌ Anthropic API error: ${error.message}`)
    }
  }
  
  // Check Google Gemini models
  if (process.env.GOOGLE_GEMINI_API_KEY) {
    console.log('\n🤖 Google Gemini Models:')
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai')
      const gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
      
      // Try different Gemini model names
      const geminiModels = [
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash'
      ]
      
      for (const model of geminiModels) {
        try {
          const modelInstance = gemini.getGenerativeModel({ model: model })
          const response = await modelInstance.generateContent('Hi')
          console.log(`  ✅ ${model}: Working`)
        } catch (error) {
          console.log(`  ❌ ${model}: ${error.message.split('\n')[0]}`)
        }
      }
    } catch (error) {
      console.log(`  ❌ Google Gemini API error: ${error.message}`)
    }
  }
  
  // Check OpenAI models
  if (process.env.OPENAI_API_KEY) {
    console.log('\n🤖 OpenAI Models:')
    try {
      const OpenAI = require('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      
      // Try different OpenAI model names
      const openaiModels = [
        'gpt-5',
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-4-vision-preview'
      ]
      
      for (const model of openaiModels) {
        try {
          const response = await openai.chat.completions.create({
            model: model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_completion_tokens: 5
          })
          console.log(`  ✅ ${model}: Working`)
        } catch (error) {
          console.log(`  ❌ ${model}: ${error.message.split('\n')[0]}`)
        }
      }
    } catch (error) {
      console.log(`  ❌ OpenAI API error: ${error.message}`)
    }
  }
  
  console.log('\n🎯 Recommended Model Names:')
  console.log('  OpenAI: gpt-4o (gpt-5 if available)')
  console.log('  Anthropic: claude-3-5-sonnet-20240620')
  console.log('  Google: gemini-1.5-flash')
}

checkAvailableModels().catch(console.error)
