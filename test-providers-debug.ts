#!/usr/bin/env tsx
/**
 * Debug script to test Claude and Grok APIs directly
 * This will show us EXACTLY what errors we're getting
 */

import * as dotenv from 'dotenv'
import { config } from 'dotenv'
import { resolve } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function testClaude() {
  console.log('\n🔍 Testing Claude/Anthropic API...\n')
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('❌ ANTHROPIC_API_KEY not set')
    return
  }
  
  console.log(`✅ API Key found: ${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...`)
  
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  
  // Test with different model names
  const models = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ]
  
  for (const model of models) {
    try {
      console.log(`\n📡 Trying model: ${model}`)
      const response = await anthropic.messages.create({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }]
      })
      
      console.log(`✅ SUCCESS with ${model}`)
      console.log(`   Response: ${response.content[0]?.type === 'text' ? response.content[0].text : 'non-text'}`)
      return model // Return first working model
    } catch (error: any) {
      console.log(`❌ FAILED with ${model}`)
      console.log(`   Error: ${error.message}`)
      console.log(`   Status: ${error.status}`)
      console.log(`   Type: ${error.type}`)
      if (error.error) {
        console.log(`   API Error:`, JSON.stringify(error.error, null, 2))
      }
    }
  }
  
  return null
}

async function testGrok() {
  console.log('\n🔍 Testing Grok/xAI API...\n')
  
  if (!process.env.XAI_API_KEY) {
    console.log('❌ XAI_API_KEY not set')
    return
  }
  
  console.log(`✅ API Key found: ${process.env.XAI_API_KEY.substring(0, 10)}...`)
  
  // Test with OpenAI SDK approach
  try {
    console.log('\n📡 Trying OpenAI SDK approach (grok-beta)...')
    const xaiClient = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1'
    })
    
    const response = await xaiClient.chat.completions.create({
      model: 'grok-beta',
      messages: [{ role: 'user', content: 'Say "ok"' }],
      max_tokens: 10
    })
    
    console.log('✅ SUCCESS with OpenAI SDK (grok-beta)')
    console.log(`   Response: ${response.choices[0]?.message?.content || 'empty'}`)
    return 'grok-beta'
  } catch (error: any) {
    console.log('❌ FAILED with OpenAI SDK (grok-beta)')
    console.log(`   Error: ${error.message}`)
    console.log(`   Status: ${error.status}`)
    if (error.response) {
      console.log(`   Response:`, await error.response.text().catch(() => 'unreadable'))
    }
  }
  
  // Test with direct fetch approach
  try {
    console.log('\n📡 Trying direct fetch approach...')
    const models = ['grok-beta', 'grok-2-vision-beta', 'grok-2-1212', 'grok-vision-beta']
    
    for (const model of models) {
      try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say "ok"' }],
            max_completion_tokens: 10
          })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.log(`❌ Model ${model} failed: ${response.status} ${response.statusText}`)
          console.log(`   Error: ${errorText}`)
          continue
        }
        
        const data = await response.json()
        console.log(`✅ SUCCESS with direct fetch (${model})`)
        console.log(`   Response: ${data.choices[0]?.message?.content || 'empty'}`)
        return model
      } catch (error: any) {
        console.log(`❌ Model ${model} exception: ${error.message}`)
      }
    }
  } catch (error: any) {
    console.log('❌ Direct fetch approach failed')
    console.log(`   Error: ${error.message}`)
  }
  
  return null
}

async function main() {
  console.log('🚀 Testing LLM Providers...\n')
  console.log('=' .repeat(60))
  
  const claudeModel = await testClaude()
  const grokModel = await testGrok()
  
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 SUMMARY:')
  console.log(`   Claude: ${claudeModel ? `✅ ${claudeModel}` : '❌ No working model'}`)
  console.log(`   Grok: ${grokModel ? `✅ ${grokModel}` : '❌ No working model'}`)
  
  if (claudeModel || grokModel) {
    console.log('\n💡 Recommended fixes:')
    if (claudeModel) {
      console.log(`   - Use Claude model: ${claudeModel}`)
    }
    if (grokModel) {
      console.log(`   - Use Grok model: ${grokModel}`)
      if (grokModel !== 'grok-beta') {
        console.log(`   - Note: Working model is ${grokModel}, not grok-beta`)
      }
    }
  }
}

main().catch(console.error)

