#!/usr/bin/env tsx
/**
 * Debug script to test Claude and Grok APIs directly
 * This will show us EXACTLY what errors we're getting
 */

import * as dotenv from 'dotenv'
import { config } from 'dotenv'
import { resolve } from 'path'
import { aiGateway } from './lib/ai-gateway-provider'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function testClaude() {
  console.log('\n🔍 Testing Claude/Anthropic via AI Gateway...\n')
  
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.log('❌ AI_GATEWAY_API_KEY not set')
    return
  }
  
  console.log(`✅ AI Gateway API Key found: ${process.env.AI_GATEWAY_API_KEY.substring(0, 10)}...`)
  
  // Test with different model names
  const models = [
    'claude-sonnet-4-20250514',
    'claude-3-haiku-20240307',
    'claude-3.5-sonnet'
  ]
  
  for (const model of models) {
    try {
      console.log(`\n📡 Trying model: ${model}`)
      const response = await aiGateway.generate({
        model: model,
        prompt: 'Say "ok"',
        maxTokens: 10
      })
      
      console.log(`✅ SUCCESS with ${model}`)
      console.log(`   Response: ${response.content}`)
      return model // Return first working model
    } catch (error: any) {
      console.log(`❌ FAILED with ${model}`)
      console.log(`   Error: ${error.message}`)
      if (error.status) {
        console.log(`   Status: ${error.status}`)
      }
    }
  }
  
  return null
}

async function testGrok() {
  console.log('\n🔍 Testing Grok/xAI via AI Gateway...\n')
  
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.log('❌ AI_GATEWAY_API_KEY not set')
    return
  }
  
  console.log(`✅ AI Gateway API Key found: ${process.env.AI_GATEWAY_API_KEY.substring(0, 10)}...`)
  
  // Test with different Grok models
  const models = [
    'grok-2-1212',
    'grok-2-vision-beta'
  ]
  
  for (const model of models) {
    try {
      console.log(`\n📡 Trying model: ${model}`)
      const response = await aiGateway.generate({
        model: model,
        prompt: 'Say "ok"',
        maxTokens: 10
      })
      
      console.log(`✅ SUCCESS with ${model}`)
      console.log(`   Response: ${response.content}`)
      return model
    } catch (error: any) {
      console.log(`❌ FAILED with ${model}`)
      console.log(`   Error: ${error.message}`)
    }
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

