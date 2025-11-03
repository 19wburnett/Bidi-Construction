/**
 * Test script for ingestion system
 * Run with: npx tsx test-ingestion.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testIngestionSystem() {
  console.log('🧪 Testing Ingestion System...\n')

  // Test 1: Check database tables exist
  console.log('1️⃣ Checking database tables...')
  try {
    const { data: sheetIndex, error: sheetError } = await supabase
      .from('plan_sheet_index')
      .select('id')
      .limit(1)

    if (sheetError && sheetError.code !== 'PGRST116') { // PGRST116 = table not found
      throw sheetError
    }

    const { data: chunks, error: chunkError } = await supabase
      .from('plan_chunks')
      .select('chunk_id')
      .limit(1)

    if (chunkError && chunkError.code !== 'PGRST116') {
      throw chunkError
    }

    console.log('   ✅ Tables exist (plan_sheet_index, plan_chunks)\n')
  } catch (error) {
    console.error('   ❌ Table check failed:', error)
    return false
  }

  // Test 2: Check if we have any plans to test with
  console.log('2️⃣ Checking for existing plans...')
  try {
    const { data: plans, error } = await supabase
      .from('plans')
      .select('id, file_name, status')
      .limit(5)

    if (error) throw error

    if (!plans || plans.length === 0) {
      console.log('   ⚠️  No plans found. Upload a plan first to test ingestion.\n')
    } else {
      console.log(`   ✅ Found ${plans.length} plan(s):`)
      plans.forEach(plan => {
        console.log(`      - ${plan.file_name} (${plan.id.substring(0, 8)}...) - Status: ${plan.status}`)
      })
      console.log('')
    }
  } catch (error) {
    console.error('   ❌ Failed to check plans:', error)
    return false
  }

  // Test 3: Verify environment variables
  console.log('3️⃣ Checking environment variables...')
  const requiredVars = {
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  const optionalVars = {
    'PDF_CO_API_KEY': process.env.PDF_CO_API_KEY,
  }

  let allGood = true
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (value) {
      console.log(`   ✅ ${key} is set`)
    } else {
      console.log(`   ❌ ${key} is missing`)
      allGood = false
    }
  })

  Object.entries(optionalVars).forEach(([key, value]) => {
    if (value) {
      console.log(`   ✅ ${key} is set (optional - for image extraction)`)
    } else {
      console.log(`   ⚠️  ${key} is not set (image extraction will be disabled)`)
    }
  })
  console.log('')

  // Test 4: Verify API routes exist (file check)
  console.log('4️⃣ Checking API routes...')
  const fs = require('fs')
  const path = require('path')

  const apiRoutes = [
    'app/api/ingest/route.ts',
    'app/api/chunks/[jobId]/route.ts'
  ]

  apiRoutes.forEach(route => {
    const fullPath = path.join(process.cwd(), route)
    if (fs.existsSync(fullPath)) {
      console.log(`   ✅ ${route} exists`)
    } else {
      console.log(`   ❌ ${route} missing`)
      allGood = false
    }
  })
  console.log('')

  // Test 5: Verify ingestion modules exist
  console.log('5️⃣ Checking ingestion modules...')
  const modules = [
    'lib/ingestion/pdf-text-extractor.ts',
    'lib/ingestion/pdf-image-extractor.ts',
    'lib/ingestion/sheet-index-builder.ts',
    'lib/ingestion/chunking-engine.ts',
    'lib/ingestion-engine.ts',
    'types/ingestion.ts'
  ]

  modules.forEach(module => {
    const fullPath = path.join(process.cwd(), module)
    if (fs.existsSync(fullPath)) {
      console.log(`   ✅ ${module} exists`)
    } else {
      console.log(`   ❌ ${module} missing`)
      allGood = false
    }
  })
  console.log('')

  if (allGood) {
    console.log('✅ All checks passed! Ingestion system is ready.')
    console.log('\n📝 Next steps:')
    console.log('   1. Make sure you have at least one plan uploaded')
    console.log('   2. Test the ingestion API: POST /api/ingest with { "planId": "your-plan-id" }')
    console.log('   3. Check results: GET /api/chunks/[jobId]')
    return true
  } else {
    console.log('❌ Some checks failed. Please fix the issues above.')
    return false
  }
}

// Run tests
testIngestionSystem()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('Test failed:', error)
    process.exit(1)
  })

