// Test database connection and table existence
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

console.log('Testing database connection and table existence...')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testDatabase() {
  try {
    // Test basic connection
    console.log('1. Testing basic connection...')
    const { data: user, error: userError } = await supabase.auth.getUser()
    console.log('User auth:', userError ? 'FAILED' : 'SUCCESS')
    
    // Test plans table
    console.log('2. Testing plans table...')
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('id')
      .limit(1)
    console.log('Plans table:', plansError ? `FAILED - ${plansError.message}` : 'SUCCESS')
    
    // Test plan_takeoff_analysis table
    console.log('3. Testing plan_takeoff_analysis table...')
    const { data: takeoff, error: takeoffError } = await supabase
      .from('plan_takeoff_analysis')
      .select('id')
      .limit(1)
    console.log('Takeoff analysis table:', takeoffError ? `FAILED - ${takeoffError.message}` : 'SUCCESS')
    
    // Test plan_quality_analysis table
    console.log('4. Testing plan_quality_analysis table...')
    const { data: quality, error: qualityError } = await supabase
      .from('plan_quality_analysis')
      .select('id')
      .limit(1)
    console.log('Quality analysis table:', qualityError ? `FAILED - ${qualityError.message}` : 'SUCCESS')
    
    // Test plan_drawings table
    console.log('5. Testing plan_drawings table...')
    const { data: drawings, error: drawingsError } = await supabase
      .from('plan_drawings')
      .select('id')
      .limit(1)
    console.log('Drawings table:', drawingsError ? `FAILED - ${drawingsError.message}` : 'SUCCESS')
    
    console.log('\nDatabase test complete!')
    
  } catch (error) {
    console.error('Database test failed:', error)
  }
}

testDatabase()
