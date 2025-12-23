/**
 * E2E Test for Single-Model Analysis
 * 
 * Run with: tsx tests/analyze.single.e2e.ts
 * 
 * This test calls the live /api/analyze/single endpoint with a test plan.
 * It verifies:
 * - Items array has minimum threshold count
 * - Items have required repo fields
 * - quality_analysis exists with required keys
 * - No uncaught exceptions
 */

import * as dotenv from 'dotenv'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load env vars
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Test configuration
const TEST_PLAN_ID = process.env.TEST_PLAN_ID // Set in .env for actual testing
const MIN_ITEMS_THRESHOLD = 20 // Adjust based on your test fixture
const REQUIRED_ITEM_FIELDS = [
  'name',
  'unit',
  'category',
  'location',
  'quantity',
  'cost_code',
  'unit_cost',
  'confidence',
  'description',
  'subcategory',
  'bounding_box'
]

const REQUIRED_QA_KEYS = [
  'completeness',
  'consistency',
  'risk_flags',
  'audit_trail'
]

/**
 * Check if API keys are available
 */
function checkApiKeys(): boolean {
  const hasAIGateway = !!process.env.AI_GATEWAY_API_KEY
  
  return hasAIGateway
}

/**
 * Create a minimal test image (1x1 pixel PNG base64)
 */
function createTestImage(): string {
  // Minimal 1x1 PNG in base64
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
}

/**
 * Main test function
 */
async function runE2ETest() {
  console.log('🧪 E2E Test: Single-Model Analysis\n')
  
  // Check API keys
  if (!checkApiKeys()) {
    console.log('⏭️  Skipping test - AI Gateway API key not configured')
    console.log('   Set AI_GATEWAY_API_KEY in your environment variables')
    return { skipped: true, reason: 'No AI Gateway API key' }
  }
  
  if (!TEST_PLAN_ID) {
    console.log('⏭️  Skipping test - TEST_PLAN_ID not set')
    console.log('   Set TEST_PLAN_ID in .env to run full test')
    console.log('   Note: You\'ll also need to provide actual plan images (base64)')
    return { skipped: true, reason: 'No test plan ID' }
  }
  
  console.log(`📋 Test Plan ID: ${TEST_PLAN_ID}`)
  console.log(`📊 Minimum Items Threshold: ${MIN_ITEMS_THRESHOLD}\n`)
  
  try {
    // For a real test, you'd load images from the plan file
    // For now, we'll use a placeholder to show the structure
    const testImages = [
      createTestImage(), // Placeholder - replace with real plan page images
      createTestImage()
    ]
    
    console.log('📤 Calling /api/analyze/single...\n')
    
    // Note: In a real test, you'd need to authenticate first
    // This would require setting up a test user session
    // For now, we'll show what the test structure looks like
    
    const response = await fetch(`${BASE_URL}/api/analyze/single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // In real test, add: 'Cookie': sessionCookie
      },
      body: JSON.stringify({
        planId: TEST_PLAN_ID,
        images: testImages
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(`API returned ${response.status}: ${JSON.stringify(error)}`)
    }
    
    const result = await response.json()
    
    console.log('✅ API call successful\n')
    console.log('📊 Results:')
    console.log(`   - Provider: ${result.meta?.provider || 'unknown'}`)
    console.log(`   - Items Count: ${result.items?.length || 0}`)
    console.log(`   - Repaired: ${result.meta?.repaired ? 'Yes' : 'No'}`)
    console.log(`   - Quality Analysis Keys: ${Object.keys(result.quality_analysis || {}).join(', ')}`)
    
    // Assertions
    const errors: string[] = []
    
    // Check items count
    if (!result.items || result.items.length < MIN_ITEMS_THRESHOLD) {
      errors.push(`Items count (${result.items?.length || 0}) below threshold (${MIN_ITEMS_THRESHOLD})`)
    }
    
    // Check items have required fields
    if (result.items && result.items.length > 0) {
      const firstItem = result.items[0]
      for (const field of REQUIRED_ITEM_FIELDS) {
        if (!(field in firstItem)) {
          errors.push(`Missing required item field: ${field}`)
        }
      }
      
      // Check bounding_box structure
      if (firstItem.bounding_box) {
        const requiredBboxFields = ['x', 'y', 'page', 'width', 'height']
        for (const field of requiredBboxFields) {
          if (!(field in firstItem.bounding_box)) {
            errors.push(`Missing bounding_box field: ${field}`)
          }
        }
      } else {
        errors.push('Missing bounding_box on item')
      }
    }
    
    // Check quality_analysis exists
    if (!result.quality_analysis) {
      errors.push('Missing quality_analysis object')
    } else {
      // Check required QA keys
      for (const key of REQUIRED_QA_KEYS) {
        if (!(key in result.quality_analysis)) {
          errors.push(`Missing quality_analysis key: ${key}`)
        }
      }
      
      // Check completeness structure
      if (result.quality_analysis.completeness) {
        const requiredCompletenessFields = ['missing_disciplines', 'missing_sheets', 'notes']
        for (const field of requiredCompletenessFields) {
          if (!(field in result.quality_analysis.completeness)) {
            errors.push(`Missing completeness field: ${field}`)
          }
        }
      }
    }
    
    // Report results
    if (errors.length > 0) {
      console.log('\n❌ Test FAILED with errors:')
      errors.forEach(err => console.log(`   - ${err}`))
      return { passed: false, errors }
    }
    
    console.log('\n✅ All assertions passed!')
    console.log(`\n📝 Sample Item (first of ${result.items.length}):`)
    if (result.items && result.items.length > 0) {
      console.log(JSON.stringify(result.items[0], null, 2))
    }
    
    console.log(`\n📝 Quality Analysis Summary:`)
    console.log(`   - Completeness Notes: ${result.quality_analysis?.completeness?.notes || 'N/A'}`)
    console.log(`   - Risk Flags: ${result.quality_analysis?.risk_flags?.length || 0}`)
    console.log(`   - Audit Trail Method: ${result.quality_analysis?.audit_trail?.method || 'N/A'}`)
    
    return { passed: true, result }
    
  } catch (error) {
    console.error('\n❌ Test FAILED with exception:')
    console.error(error instanceof Error ? error.message : error)
    return { passed: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Run if called directly
if (require.main === module) {
  runE2ETest()
    .then(result => {
      if (result.skipped) {
        process.exit(0)
      }
      process.exit(result.passed ? 0 : 1)
    })
    .catch(error => {
      console.error('Unhandled error:', error)
      process.exit(1)
    })
}

export { runE2ETest }

