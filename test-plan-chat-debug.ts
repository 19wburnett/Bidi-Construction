/**
 * Debug test for Plan Chat V3
 * Tests with a specific plan ID to see what's happening
 */

import { createServerSupabaseClient } from './lib/supabase-server'

const PLAN_ID = 'd783f3f6-474e-48e7-92de-697309012ded'

async function testPlanChat() {
  console.log('🔍 Testing Plan Chat V3 Debug\n')
  console.log(`Plan ID: ${PLAN_ID}\n`)

  const supabase = await createServerSupabaseClient()
  
  // Get authenticated user
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user) {
    console.error('❌ Not authenticated. Please run this in a context with auth.')
    process.exit(1)
  }

  const userId = authData.user.id
  console.log(`✅ Authenticated as user: ${userId.substring(0, 8)}...\n`)

  // Step 1: Get plan info
  console.log('1️⃣ Loading plan info...')
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id, job_id, title, file_name')
    .eq('id', PLAN_ID)
    .single()

  if (planError || !plan) {
    console.error('❌ Plan not found:', planError?.message)
    process.exit(1)
  }

  console.log(`   ✅ Plan found: ${plan.title || plan.file_name}`)
  console.log(`   Job ID: ${plan.job_id || 'null'}\n`)

  const jobId = plan.job_id

  // Step 2: Check takeoff data
  console.log('2️⃣ Checking takeoff data...')
  let takeoffData: any = null

  if (jobId) {
    const { data: takeoffByJob, error: jobError } = await supabase
      .from('plan_takeoff_analysis')
      .select('id, items, summary, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!jobError && takeoffByJob) {
      takeoffData = takeoffByJob
      console.log(`   ✅ Found takeoff by job_id: ${takeoffByJob.id}`)
      console.log(`   Items count: ${Array.isArray(takeoffByJob.items) ? takeoffByJob.items.length : 'N/A'}`)
    }
  }

  if (!takeoffData) {
    const { data: takeoffByPlan, error: planError } = await supabase
      .from('plan_takeoff_analysis')
      .select('id, items, summary, created_at')
      .eq('plan_id', PLAN_ID)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!planError && takeoffByPlan) {
      takeoffData = takeoffByPlan
      console.log(`   ✅ Found takeoff by plan_id: ${takeoffByPlan.id}`)
      console.log(`   Items count: ${Array.isArray(takeoffByPlan.items) ? takeoffByPlan.items.length : 'N/A'}`)
    }
  }

  if (!takeoffData) {
    console.log('   ⚠️  No takeoff data found')
  }
  console.log('')

  // Step 3: Check blueprint chunks
  console.log('3️⃣ Checking blueprint chunks...')
  const { data: chunks, error: chunksError } = await supabase
    .from('plan_text_chunks')
    .select('id, page_number, snippet_text')
    .eq('plan_id', PLAN_ID)
    .limit(5)

  if (chunksError) {
    console.log(`   ⚠️  Error: ${chunksError.message}`)
  } else {
    console.log(`   ✅ Found ${chunks?.length || 0} blueprint chunks`)
    if (chunks && chunks.length > 0) {
      console.log(`   Sample chunk: ${chunks[0].snippet_text.substring(0, 100)}...`)
    }
  }
  console.log('')

  // Step 4: Test Plan Chat V3 retrieval
  console.log('4️⃣ Testing Plan Chat V3 retrieval...')
  try {
    const { retrieveContext } = await import('./lib/plan-chat-v3/retrieval-engine')
    
    const retrievalResult = await retrieveContext(
      supabase,
      PLAN_ID,
      userId,
      jobId,
      'What items are in the takeoff?',
      ['roof', 'door', 'window'],
      undefined
    )

    console.log(`   ✅ Retrieval completed:`)
    console.log(`      - Semantic chunks: ${retrievalResult.semantic_chunks.length}`)
    console.log(`      - Takeoff items: ${retrievalResult.takeoff_items.length}`)
    console.log(`      - Related sheets: ${retrievalResult.related_sheets.length}`)
    console.log(`      - Project metadata: ${retrievalResult.project_metadata ? 'Yes' : 'No'}`)

    if (retrievalResult.takeoff_items.length > 0) {
      console.log(`\n   Sample takeoff items:`)
      retrievalResult.takeoff_items.slice(0, 3).forEach((item, idx) => {
        console.log(`      ${idx + 1}. ${item.name || item.description} - ${item.quantity || 'N/A'} ${item.unit || ''}`)
      })
    }
  } catch (error: any) {
    console.error(`   ❌ Retrieval failed: ${error.message}`)
    console.error(error)
  }
  console.log('')

  // Step 5: Test full Plan Chat V3 answer generation
  console.log('5️⃣ Testing full Plan Chat V3 answer generation...')
  try {
    const { generateAnswer } = await import('./lib/plan-chat-v3/answer-engine')
    
    const result = await generateAnswer(
      supabase,
      PLAN_ID,
      userId,
      jobId,
      'What items are in the takeoff?'
    )

    console.log(`   ✅ Answer generated:`)
    console.log(`      Mode: ${result.mode}`)
    console.log(`      Answer length: ${result.answer.length} chars`)
    console.log(`      Answer preview: ${result.answer.substring(0, 200)}...`)
    console.log(`\n   Full answer:\n${result.answer}\n`)
  } catch (error: any) {
    console.error(`   ❌ Answer generation failed: ${error.message}`)
    console.error(error.stack)
  }

  console.log('\n✅ Test complete!')
}

testPlanChat()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })

