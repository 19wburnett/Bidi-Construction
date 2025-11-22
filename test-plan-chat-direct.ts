/**
 * Direct database test for Plan Chat V3
 * Tests data retrieval without Next.js context
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const PLAN_ID = 'd783f3f6-474e-48e7-92de-697309012ded'

// Use environment variables for direct Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testPlanChat() {
  console.log('🔍 Testing Plan Chat V3 - Direct Database Query\n')
  console.log(`Plan ID: ${PLAN_ID}\n`)

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

  // Get user_id from job if available
  let userId: string | null = null
  if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('id', jobId)
      .single()
    
    if (job) {
      userId = job.user_id
      console.log(`   User ID from job: ${userId?.substring(0, 8)}...`)
    }
  }

  // Step 2: Check takeoff data (try both methods)
  console.log('2️⃣ Checking takeoff data...')
  
  // Try by job_id first
  let takeoffData: any = null
  let takeoffSource = ''

  if (jobId) {
    const { data: takeoffByJob, error: jobError } = await supabase
      .from('plan_takeoff_analysis')
      .select('id, items, summary, created_at, job_id, plan_id, user_id')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!jobError && takeoffByJob) {
      takeoffData = takeoffByJob
      takeoffSource = 'job_id'
      console.log(`   ✅ Found takeoff by job_id`)
      console.log(`      Takeoff ID: ${takeoffByJob.id}`)
      console.log(`      Plan ID in takeoff: ${takeoffByJob.plan_id}`)
      console.log(`      User ID in takeoff: ${takeoffByJob.user_id}`)
      console.log(`      Created: ${takeoffByJob.created_at}`)
      
      const items = Array.isArray(takeoffByJob.items) ? takeoffByJob.items : []
      console.log(`      Items count: ${items.length}`)
      
      if (items.length > 0) {
        console.log(`\n   Sample items:`)
        items.slice(0, 5).forEach((item: any, idx: number) => {
          const name = item.name || item.description || item.category || 'Unknown'
          const qty = item.quantity || item.qty || 'N/A'
          const unit = item.unit || ''
          console.log(`      ${idx + 1}. ${name} - ${qty} ${unit}`)
        })
      }
    } else if (jobError) {
      console.log(`   ⚠️  Error querying by job_id: ${jobError.message}`)
    }
  }

  // Try by plan_id + user_id if job_id didn't work
  if (!takeoffData && userId) {
    const { data: takeoffByPlan, error: planError } = await supabase
      .from('plan_takeoff_analysis')
      .select('id, items, summary, created_at, job_id, plan_id, user_id')
      .eq('plan_id', PLAN_ID)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!planError && takeoffByPlan) {
      takeoffData = takeoffByPlan
      takeoffSource = 'plan_id+user_id'
      console.log(`   ✅ Found takeoff by plan_id+user_id`)
      console.log(`      Takeoff ID: ${takeoffByPlan.id}`)
      console.log(`      Job ID in takeoff: ${takeoffByPlan.job_id}`)
      
      const items = Array.isArray(takeoffByPlan.items) ? takeoffByPlan.items : []
      console.log(`      Items count: ${items.length}`)
    } else if (planError) {
      console.log(`   ⚠️  Error querying by plan_id: ${planError.message}`)
    }
  }

  if (!takeoffData) {
    console.log('   ❌ No takeoff data found with either method')
    
    // Check what takeoff records exist for this plan
    const { data: allTakeoffs, error: allError } = await supabase
      .from('plan_takeoff_analysis')
      .select('id, plan_id, job_id, user_id, created_at')
      .eq('plan_id', PLAN_ID)
      .limit(10)

    if (!allError && allTakeoffs && allTakeoffs.length > 0) {
      console.log(`\n   Found ${allTakeoffs.length} takeoff record(s) for this plan:`)
      allTakeoffs.forEach((t: any, idx: number) => {
        console.log(`      ${idx + 1}. ID: ${t.id}`)
        console.log(`         Job ID: ${t.job_id || 'null'}`)
        console.log(`         User ID: ${t.user_id}`)
        console.log(`         Created: ${t.created_at}`)
      })
    } else if (!allError && (!allTakeoffs || allTakeoffs.length === 0)) {
      console.log('   ⚠️  No takeoff records found for this plan at all')
    }
  } else {
    console.log(`\n   ✅ Takeoff data found via: ${takeoffSource}`)
  }
  console.log('')

  // Step 3: Check blueprint chunks
  console.log('3️⃣ Checking blueprint chunks...')
  const { data: chunks, error: chunksError } = await supabase
    .from('plan_text_chunks')
    .select('id, page_number, snippet_text, metadata')
    .eq('plan_id', PLAN_ID)
    .limit(5)

  if (chunksError) {
    console.log(`   ❌ Error: ${chunksError.message}`)
  } else {
    const chunkCount = chunks?.length || 0
    console.log(`   ✅ Found ${chunkCount} blueprint chunks (showing first 5)`)
    
    if (chunks && chunks.length > 0) {
      chunks.forEach((chunk, idx) => {
        const page = chunk.page_number || '?'
        const text = chunk.snippet_text.substring(0, 80)
        console.log(`      ${idx + 1}. Page ${page}: ${text}...`)
      })
    } else {
      console.log('   ⚠️  No blueprint chunks found')
    }
  }
  console.log('')

  // Step 4: Test retrieval function directly
  console.log('4️⃣ Testing retrieval function...')
  try {
    const { findTakeoffItemsByTarget } = await import('./lib/plan-chat-v3/retrieval-engine')
    
    // Create a mock supabase client that works
    const result = await findTakeoffItemsByTarget(
      supabase as any,
      PLAN_ID,
      userId || '',
      ['roof', 'door', 'window'],
      jobId
    )

    console.log(`   ✅ Retrieval function returned ${result.length} items`)
    if (result.length > 0) {
      console.log(`\n   Sample retrieved items:`)
      result.slice(0, 5).forEach((item, idx) => {
        console.log(`      ${idx + 1}. ${item.name || item.description} - ${item.quantity || 'N/A'} ${item.unit || ''}`)
      })
    } else {
      console.log('   ⚠️  No items retrieved - this might be the problem!')
    }
  } catch (error: any) {
    console.error(`   ❌ Retrieval function failed: ${error.message}`)
    console.error(error.stack)
  }

  console.log('\n✅ Test complete!')
  console.log('\n📝 Summary:')
  console.log(`   - Plan exists: ✅`)
  console.log(`   - Takeoff data: ${takeoffData ? '✅ Found' : '❌ Not found'}`)
  console.log(`   - Blueprint chunks: ${chunks && chunks.length > 0 ? `✅ ${chunks.length} found` : '❌ Not found'}`)
}

testPlanChat()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })

