#!/usr/bin/env tsx
/**
 * CLI Helper for Single-Model Analysis
 * 
 * Usage:
 *   tsx scripts/run-analyze.ts --plan <planId>
 *   tsx scripts/run-analyze.ts --plan <planId> --images <base64url1,base64url2,...>
 */

import * as dotenv from 'dotenv'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load env vars
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const args = process.argv.slice(2)
const planIdIndex = args.indexOf('--plan')
const planId = planIdIndex >= 0 ? args[planIdIndex + 1] : null

if (!planId) {
  console.error('Usage: tsx scripts/run-analyze.ts --plan <planId>')
  console.error('  --plan <planId>  : Required - Plan ID to analyze')
  process.exit(1)
}

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  console.log(`🔍 Running single-model analysis for plan: ${planId}`)
  console.log(`📡 Endpoint: ${baseUrl}/api/analyze/single`)
  
  // Check for API keys
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasXAI = !!process.env.XAI_API_KEY
  
  console.log(`\n🔑 Available providers:`)
  console.log(`   - Anthropic: ${hasAnthropic ? '✅' : '❌'}`)
  console.log(`   - OpenAI: ${hasOpenAI ? '✅' : '❌'}`)
  console.log(`   - xAI: ${hasXAI ? '✅' : '❌'}`)
  
  if (!hasAnthropic && !hasOpenAI && !hasXAI) {
    console.error('\n❌ No LLM providers configured. Please set at least one API key:')
    console.error('   - ANTHROPIC_API_KEY')
    console.error('   - OPENAI_API_KEY')
    console.error('   - XAI_API_KEY')
    process.exit(1)
  }
  
  try {
    // For now, we need images to be provided or we'd need to load from plan
    // In a real scenario, you'd load the plan file and convert pages to base64
    console.log('\n⚠️  Note: This endpoint requires images to be provided.')
    console.log('   For a full test, use the frontend or provide images via API.')
    
    // If you want to test without images, you could load from plan here
    // For now, we'll just show the endpoint structure
    const requestBody = {
      planId,
      images: [] // Would need to be populated from plan file
    }
    
    console.log('\n📤 Request body structure:')
    console.log(JSON.stringify({
      planId,
      images: '[base64 data URLs - would be loaded from plan]'
    }, null, 2))
    
    console.log('\n💡 To test this endpoint:')
    console.log('   1. Load a plan in the frontend')
    console.log('   2. The frontend will call /api/analyze/single with images')
    console.log('   3. Or use curl/Postman with base64 image data URLs')
    
    console.log('\n✅ CLI helper ready. Use the frontend or API directly for full testing.')
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()

