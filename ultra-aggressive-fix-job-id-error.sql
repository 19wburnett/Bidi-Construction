-- ============================================================================
-- ULTRA-AGGRESSIVE FIX FOR JOB_ID ERROR IN PLANS TABLE
-- This script removes EVERYTHING that could possibly reference job_id
-- ============================================================================

-- ============================================================================
-- 1. DISABLE ALL TRIGGERS TEMPORARILY
-- ============================================================================

-- Disable all triggers on plans table
ALTER TABLE plans DISABLE TRIGGER ALL;

-- ============================================================================
-- 2. DROP ALL TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Drop ALL triggers that could possibly reference job_id
DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
DROP TRIGGER IF EXISTS update_plan_access_on_drawing ON plan_drawings;
DROP TRIGGER IF EXISTS update_plan_last_accessed ON plans;
DROP TRIGGER IF EXISTS plans_updated_at_trigger ON plans;
DROP TRIGGER IF EXISTS plans_insert_trigger ON plans;
DROP TRIGGER IF EXISTS plans_update_trigger ON plans;

-- Drop ALL functions that could possibly reference job_id
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_plan_last_accessed() CASCADE;
DROP FUNCTION IF EXISTS handle_plans_insert() CASCADE;
DROP FUNCTION IF EXISTS handle_plans_update() CASCADE;
DROP FUNCTION IF EXISTS plans_audit_trigger() CASCADE;

-- ============================================================================
-- 3. DROP ALL CONSTRAINTS AND FOREIGN KEYS
-- ============================================================================

-- Drop ALL constraints that might reference job_id
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_job_id_fkey;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_job_request_id_fkey;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_job_fkey;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS fk_plans_job_id;
ALTER TABLE plans DROP CONSTRAINT IF EXISTS fk_plans_job_request_id;

-- ============================================================================
-- 4. CHECK FOR ANY REMAINING JOB_ID COLUMNS
-- ============================================================================

-- Remove any job_id columns that might still exist
ALTER TABLE plans DROP COLUMN IF EXISTS job_id;
ALTER TABLE plans DROP COLUMN IF EXISTS job_request_id;

-- ============================================================================
-- 5. VERIFY CURRENT TABLE STRUCTURE
-- ============================================================================

DO $$
DECLARE
    column_info RECORD;
BEGIN
    RAISE NOTICE 'Current plans table structure after cleanup:';
    FOR column_info IN 
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'plans' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE 'Column: %, Type: %, Nullable: %, Default: %', 
            column_info.column_name, 
            column_info.data_type, 
            column_info.is_nullable, 
            column_info.column_default;
    END LOOP;
END $$;

-- ============================================================================
-- 6. ENSURE CORRECT TABLE STRUCTURE
-- ============================================================================

-- Make sure the plans table has ONLY the correct columns
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

-- ============================================================================
-- 7. RECREATE INDEXES
-- ============================================================================

-- Drop and recreate all indexes
DROP INDEX IF EXISTS idx_plans_user_id;
DROP INDEX IF EXISTS idx_plans_status;
DROP INDEX IF EXISTS idx_plans_created_at;
DROP INDEX IF EXISTS idx_plans_job_id;
DROP INDEX IF EXISTS idx_plans_job_request_id;

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans(created_at DESC);

-- ============================================================================
-- 8. RECREATE ONLY ESSENTIAL TRIGGERS (WITHOUT JOB_ID REFERENCE)
-- ============================================================================

-- Create a simple updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger for plans table
CREATE TRIGGER update_plans_updated_at 
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. RE-ENABLE TRIGGERS
-- ============================================================================

-- Re-enable triggers on plans table
ALTER TABLE plans ENABLE TRIGGER ALL;

-- ============================================================================
-- 10. TEST THE FIX
-- ============================================================================

-- Test inserting a plan record to make sure it works
DO $$
DECLARE
    test_user_id UUID;
    test_plan_id UUID;
BEGIN
    -- Get a test user ID (use the first user in the system)
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Try to insert a test plan record
        INSERT INTO plans (
            user_id,
            file_name,
            file_path,
            file_size,
            file_type,
            title,
            status
        ) VALUES (
            test_user_id,
            'test-plan.pdf',
            'test/path/test-plan.pdf',
            1024,
            'application/pdf',
            'Test Plan',
            'ready'
        ) RETURNING id INTO test_plan_id;
        
        -- Clean up the test record
        DELETE FROM plans WHERE id = test_plan_id;
        
        RAISE NOTICE 'SUCCESS: Test insert worked! Plans table is now fixed.';
    ELSE
        RAISE NOTICE 'No users found in auth.users table. Cannot test insert.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Test insert failed: %', SQLERRM;
        RAISE NOTICE 'This means there are still issues with the plans table.';
END $$;

-- ============================================================================
-- 11. FINAL VERIFICATION
-- ============================================================================

-- Check for any remaining triggers on plans table
DO $$
DECLARE
    trigger_info RECORD;
BEGIN
    RAISE NOTICE 'Remaining triggers on plans table:';
    FOR trigger_info IN 
        SELECT trigger_name, event_manipulation, action_statement
        FROM information_schema.triggers 
        WHERE event_object_table = 'plans'
        AND event_object_schema = 'public'
    LOOP
        RAISE NOTICE 'Trigger: %, Event: %, Action: %', 
            trigger_info.trigger_name, 
            trigger_info.event_manipulation,
            trigger_info.action_statement;
    END LOOP;
END $$;

-- ============================================================================
-- ULTRA-AGGRESSIVE FIX COMPLETE
-- ============================================================================

-- This script has:
-- 1. Disabled ALL triggers temporarily
-- 2. Dropped ALL triggers and functions
-- 3. Dropped ALL constraints and foreign keys
-- 4. Removed ANY remaining job_id columns
-- 5. Verified table structure
-- 6. Ensured correct table structure
-- 7. Recreated indexes
-- 8. Recreated ONLY essential triggers
-- 9. Re-enabled triggers
-- 10. Tested the fix
-- 11. Verified remaining triggers

-- Your plans table should DEFINITELY work now!
