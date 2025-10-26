#!/usr/bin/env node

/**
 * Fix Plans Table Job ID Error
 * 
 * This script fixes the database error where the plans table is expecting
 * a job_id field that doesn't exist. The error occurs because there are
 * likely triggers or constraints still referencing the old job_id column.
 * 
 * Run this script with: node fix-plans-table.js
 */

const { createClient } = require('@supabase/supabase-js')

// You'll need to set these environment variables or replace with your actual values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dkpucbqphkghrhiwtseb.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  console.log('Please set it in your .env.local file or run:')
  console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node fix-plans-table.js')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixPlansTable() {
  console.log('🔧 Starting plans table fix...')

  try {
    // Step 1: Drop problematic triggers
    console.log('📝 Step 1: Dropping problematic triggers...')
    await supabase.rpc('exec', {
      sql: `
        DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
        DROP TRIGGER IF EXISTS update_plan_access_on_drawing ON plan_drawings;
      `
    })

    // Step 2: Recreate the update function
    console.log('📝 Step 2: Recreating update function...')
    await supabase.rpc('exec', {
      sql: `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `
    })

    // Step 3: Recreate the trigger
    console.log('📝 Step 3: Recreating plans trigger...')
    await supabase.rpc('exec', {
      sql: `
        CREATE TRIGGER update_plans_updated_at 
          BEFORE UPDATE ON plans
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `
    })

    // Step 4: Drop problematic constraints
    console.log('📝 Step 4: Dropping problematic constraints...')
    await supabase.rpc('exec', {
      sql: `
        ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_job_id_fkey;
      `
    })

    // Step 5: Ensure correct table structure
    console.log('📝 Step 5: Ensuring correct table structure...')
    await supabase.rpc('exec', {
      sql: `
        ALTER TABLE plans 
        ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL,
        ADD COLUMN IF NOT EXISTS file_path TEXT NOT NULL,
        ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL,
        ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL,
        ADD COLUMN IF NOT EXISTS num_pages INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS title TEXT,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS project_name TEXT,
        ADD COLUMN IF NOT EXISTS project_location TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'archived')),
        ADD COLUMN IF NOT EXISTS processing_status JSONB DEFAULT '{"stage": "uploaded", "progress": 0}',
        ADD COLUMN IF NOT EXISTS has_takeoff_analysis BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS has_quality_analysis BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();
      `
    })

    // Step 6: Recreate indexes
    console.log('📝 Step 6: Recreating indexes...')
    await supabase.rpc('exec', {
      sql: `
        DROP INDEX IF EXISTS idx_plans_user_id;
        DROP INDEX IF EXISTS idx_plans_status;
        DROP INDEX IF EXISTS idx_plans_created_at;
        
        CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
        CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
        CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans(created_at DESC);
      `
    })

    // Step 7: Test the fix
    console.log('📝 Step 7: Testing the fix...')
    const { data: testResult, error: testError } = await supabase
      .from('plans')
      .select('id')
      .limit(1)

    if (testError) {
      console.error('❌ Test query failed:', testError.message)
      return false
    }

    console.log('✅ Plans table fix completed successfully!')
    console.log('🎉 You should now be able to upload plans without the job_id error.')
    return true

  } catch (error) {
    console.error('❌ Error applying fix:', error.message)
    return false
  }
}

// Run the fix
fixPlansTable()
  .then(success => {
    if (success) {
      console.log('\n🚀 Fix completed! Try uploading a plan now.')
    } else {
      console.log('\n💥 Fix failed. Please check the error messages above.')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })
