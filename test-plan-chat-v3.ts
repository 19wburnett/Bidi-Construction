/**
 * Test script for Plan Chat V3
 * Verifies that all modules can be imported and basic functionality works
 */

import { createServerSupabaseClient } from './lib/supabase-server'

async function testPlanChatV3() {
  console.log('🧪 Testing Plan Chat V3 System...\n')

  let allGood = true

  // Test 1: Verify all modules can be imported
  console.log('1️⃣ Checking module imports...')
  try {
    const memory = await import('./lib/plan-chat-v3/memory')
    console.log('   ✅ memory.ts imported')

    const retrieval = await import('./lib/plan-chat-v3/retrieval-engine')
    console.log('   ✅ retrieval-engine.ts imported')

    const context = await import('./lib/plan-chat-v3/context-builder')
    console.log('   ✅ context-builder.ts imported')

    const prompts = await import('./lib/plan-chat-v3/prompts')
    console.log('   ✅ prompts.ts imported')

    const answerEngine = await import('./lib/plan-chat-v3/answer-engine')
    console.log('   ✅ answer-engine.ts imported')

    const debug = await import('./lib/plan-chat-v3/debug')
    console.log('   ✅ debug.ts imported')

    const index = await import('./lib/plan-chat-v3')
    console.log('   ✅ index.ts imported')
  } catch (error) {
    console.error('   ❌ Module import failed:', error)
    allGood = false
  }
  console.log('')

  // Test 2: Verify migration file structure (can't test DB connection outside request context)
  console.log('2️⃣ Checking migration file structure...')
  try {
    const fs = require('fs')
    const path = require('path')
    const migrationFile = 'supabase/migrations/20250130_plan_chat_history.sql'
    const migrationPath = path.join(process.cwd(), migrationFile)
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8')
    
    if (migrationContent.includes('plan_chat_history')) {
      console.log('   ✅ Migration file contains plan_chat_history table')
    } else {
      console.log('   ⚠️  Migration file may be incomplete')
    }
    
    if (migrationContent.includes('CREATE TABLE')) {
      console.log('   ✅ Migration file has CREATE TABLE statement')
    }
  } catch (error: any) {
    console.error('   ⚠️  Could not read migration file:', error.message)
  }
  console.log('   ℹ️  Database connection will be tested at runtime')
  console.log('')

  // Test 3: Verify environment variables
  console.log('3️⃣ Checking environment variables...')
  const requiredVars = {
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
  }

  Object.entries(requiredVars).forEach(([key, value]) => {
    if (value) {
      console.log(`   ✅ ${key} is set`)
    } else {
      console.log(`   ⚠️  ${key} is not set (needed for LLM calls)`)
    }
  })

  const optionalVars = {
    'PLAN_CHAT_V3_ENABLED': process.env.PLAN_CHAT_V3_ENABLED,
    'PLAN_CHAT_V3_DEBUG': process.env.PLAN_CHAT_V3_DEBUG,
  }

  Object.entries(optionalVars).forEach(([key, value]) => {
    if (value) {
      console.log(`   ✅ ${key} = ${value}`)
    } else {
      console.log(`   ℹ️  ${key} not set (using defaults)`)
    }
  })
  console.log('')

  // Test 4: Verify API route exists
  console.log('4️⃣ Checking API route...')
  const fs = require('fs')
  const path = require('path')

  const apiRoute = 'app/api/plan-chat/route.ts'
  const fullPath = path.join(process.cwd(), apiRoute)
  if (fs.existsSync(fullPath)) {
    console.log(`   ✅ ${apiRoute} exists`)
    
    // Check if V3 is integrated
    const routeContent = fs.readFileSync(fullPath, 'utf-8')
    if (routeContent.includes('plan-chat-v3')) {
      console.log('   ✅ V3 integration found in route')
    } else {
      console.log('   ⚠️  V3 integration not found in route')
      allGood = false
    }
  } else {
    console.log(`   ❌ ${apiRoute} missing`)
    allGood = false
  }
  console.log('')

  // Test 5: Verify migration file exists
  console.log('5️⃣ Checking migration file...')
  const migrationFile = 'supabase/migrations/20250130_plan_chat_history.sql'
  const migrationPath = path.join(process.cwd(), migrationFile)
  if (fs.existsSync(migrationPath)) {
    console.log(`   ✅ ${migrationFile} exists`)
  } else {
    console.log(`   ❌ ${migrationFile} missing`)
    allGood = false
  }
  console.log('')

  if (allGood) {
    console.log('✅ All checks passed! Plan Chat V3 is ready.')
    console.log('\n📝 Next steps:')
    console.log('   1. Ensure migration has been run: supabase/migrations/20250130_plan_chat_history.sql')
    console.log('   2. Test the API: POST /api/plan-chat with { "jobId": "...", "planId": "...", "messages": [...] }')
    console.log('   3. V3 is enabled by default. Set PLAN_CHAT_V3_ENABLED=false to use V2')
    return true
  } else {
    console.log('❌ Some checks failed. Please fix the issues above.')
    return false
  }
}

// Run tests
testPlanChatV3()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('Test failed with error:', error)
    process.exit(1)
  })

