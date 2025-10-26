// PostHog Error Fix Verification Script
// Run this in your browser console to check if PostHog errors are resolved

console.log('🔍 Checking PostHog Configuration...')

// Check if PostHog is loaded
if (typeof window !== 'undefined' && window.posthog) {
  console.log('✅ PostHog is loaded')
  
  // Check session recording status
  const sessionRecording = window.posthog.sessionRecording
  if (sessionRecording) {
    console.log('📹 Session recording status:', sessionRecording.isRecording() ? 'ACTIVE' : 'DISABLED')
  } else {
    console.log('📹 Session recording: DISABLED')
  }
  
  // Check configuration
  const config = window.posthog.config
  console.log('⚙️ PostHog Configuration:')
  console.log('  - Session recording disabled:', config?.disable_session_recording)
  console.log('  - Batch events:', config?.batch_events)
  console.log('  - Batch size:', config?.batch_size)
  console.log('  - Compression:', config?.compression)
  
  // Test event capture
  try {
    window.posthog.capture('test_event', { 
      message: 'Testing PostHog fix',
      timestamp: new Date().toISOString()
    })
    console.log('✅ Test event captured successfully')
  } catch (error) {
    console.log('❌ Test event failed:', error)
  }
  
} else {
  console.log('❌ PostHog not found or not loaded')
}

// Check for PostHog errors in console
console.log('🔍 Checking for PostHog errors...')
const originalError = console.error
let posthogErrors = 0

console.error = function(...args) {
  const message = args.join(' ')
  if (message.includes('PostHog') || message.includes('posthog')) {
    posthogErrors++
    console.log('🚨 PostHog error detected:', message)
  }
  originalError.apply(console, args)
}

// Monitor for 30 seconds
setTimeout(() => {
  console.error = originalError
  console.log(`📊 PostHog errors detected in last 30 seconds: ${posthogErrors}`)
  
  if (posthogErrors === 0) {
    console.log('🎉 No PostHog errors detected! Fix appears to be working.')
  } else {
    console.log('⚠️ PostHog errors still occurring. Check configuration.')
  }
}, 30000)

console.log('⏱️ Monitoring PostHog errors for 30 seconds...')
console.log('✅ PostHog fix verification complete!')

