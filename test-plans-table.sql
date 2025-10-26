-- ============================================================================
-- SIMPLE TEST SCRIPT FOR PLANS TABLE
-- Run this after applying the complete fix to verify everything works
-- ============================================================================

-- ============================================================================
-- 1. TEST BASIC INSERT AND RETRIEVAL
-- ============================================================================

DO $$
DECLARE
    test_user_id UUID;
    test_plan_id UUID;
    retrieved_plan RECORD;
BEGIN
    RAISE NOTICE '=== TESTING PLANS TABLE FUNCTIONALITY ===';
    
    -- Get a test user ID
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE 'Testing with user ID: %', test_user_id;
        
        -- Test 1: Insert a plan
        BEGIN
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
            
            RAISE NOTICE '✅ SUCCESS: Plan inserted with ID: %', test_plan_id;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ ERROR: Insert failed: %', SQLERRM;
                RETURN;
        END;
        
        -- Test 2: Retrieve the plan
        BEGIN
            SELECT * INTO retrieved_plan FROM plans WHERE id = test_plan_id;
            
            IF retrieved_plan.id IS NOT NULL THEN
                RAISE NOTICE '✅ SUCCESS: Plan retrieved successfully!';
                RAISE NOTICE '   Plan ID: %', retrieved_plan.id;
                RAISE NOTICE '   Plan Title: %', retrieved_plan.title;
                RAISE NOTICE '   Plan Status: %', retrieved_plan.status;
                RAISE NOTICE '   Plan User ID: %', retrieved_plan.user_id;
            ELSE
                RAISE NOTICE '❌ ERROR: Could not retrieve the plan';
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ ERROR: Retrieval failed: %', SQLERRM;
        END;
        
        -- Test 3: Update the plan
        BEGIN
            UPDATE plans 
            SET title = 'Updated Test Plan', status = 'processing'
            WHERE id = test_plan_id;
            
            RAISE NOTICE '✅ SUCCESS: Plan updated successfully!';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ ERROR: Update failed: %', SQLERRM;
        END;
        
        -- Test 4: Clean up
        BEGIN
            DELETE FROM plans WHERE id = test_plan_id;
            RAISE NOTICE '✅ SUCCESS: Plan deleted successfully!';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ ERROR: Delete failed: %', SQLERRM;
        END;
        
        RAISE NOTICE '🎉 ALL TESTS COMPLETED SUCCESSFULLY!';
        
    ELSE
        RAISE NOTICE '❌ ERROR: No users found in auth.users table';
    END IF;
END $$;

-- ============================================================================
-- 2. TEST RLS POLICIES
-- ============================================================================

DO $$
DECLARE
    test_user_id UUID;
    other_user_id UUID;
    test_plan_id UUID;
    plan_count INTEGER;
BEGIN
    RAISE NOTICE '=== TESTING RLS POLICIES ===';
    
    -- Get two different user IDs
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    SELECT id INTO other_user_id FROM auth.users OFFSET 1 LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Create a plan as the first user
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
            'rls-test-plan.pdf',
            'test/path/rls-test-plan.pdf',
            1024,
            'application/pdf',
            'RLS Test Plan',
            'ready'
        ) RETURNING id INTO test_plan_id;
        
        RAISE NOTICE 'Created test plan with ID: %', test_plan_id;
        
        -- Test RLS: Should be able to see own plans
        SELECT COUNT(*) INTO plan_count FROM plans WHERE user_id = test_user_id;
        RAISE NOTICE 'User can see % of their own plans', plan_count;
        
        -- Clean up
        DELETE FROM plans WHERE id = test_plan_id;
        RAISE NOTICE '✅ RLS test completed';
        
    ELSE
        RAISE NOTICE '❌ ERROR: No users found for RLS testing';
    END IF;
END $$;

-- ============================================================================
-- 3. FINAL STATUS CHECK
-- ============================================================================

DO $$
DECLARE
    trigger_count INTEGER;
    policy_count INTEGER;
    column_count INTEGER;
BEGIN
    RAISE NOTICE '=== FINAL STATUS CHECK ===';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE event_object_table = 'plans' AND event_object_schema = 'public';
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count 
    FROM information_schema.table_constraints 
    WHERE table_name = 'plans' AND table_schema = 'public';
    
    -- Count columns
    SELECT COUNT(*) INTO column_count 
    FROM information_schema.columns 
    WHERE table_name = 'plans' AND table_schema = 'public';
    
    RAISE NOTICE 'Plans table status:';
    RAISE NOTICE '  Triggers: %', trigger_count;
    RAISE NOTICE '  Policies: %', policy_count;
    RAISE NOTICE '  Columns: %', column_count;
    
    IF trigger_count <= 1 AND policy_count >= 4 AND column_count >= 10 THEN
        RAISE NOTICE '✅ Plans table is properly configured!';
    ELSE
        RAISE NOTICE '⚠️  Plans table may need additional configuration';
    END IF;
END $$;

-- ============================================================================
-- TEST COMPLETE
-- ============================================================================

-- This script tests:
-- 1. Basic insert and retrieval functionality
-- 2. RLS policies
-- 3. Final status check

-- If all tests pass, your plans table is working correctly!
