// Test script to verify the efficient canvas system is working
// Run this in your browser console on a plan viewer page

console.log('Testing Efficient Canvas System...')

// Check if the new efficient canvas system is being used
const planCanvas = document.querySelector('[data-testid="plan-canvas"]') || 
                   document.querySelector('canvas') ||
                   document.querySelector('.plan-canvas-container')

if (planCanvas) {
  console.log('✅ Plan canvas found:', planCanvas)
  
  // Check for SVG elements (should be none in efficient mode)
  const svgElements = document.querySelectorAll('svg')
  console.log('📊 SVG elements found:', svgElements.length)
  
  // Check for canvas elements (should be multiple in efficient mode)
  const canvasElements = document.querySelectorAll('canvas')
  console.log('📊 Canvas elements found:', canvasElements.length)
  
  // Check memory usage
  if (performance.memory) {
    console.log('💾 Memory usage:', {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
    })
  }
  
  // Check for blob URLs (should be none in efficient mode)
  const blobUrls = Array.from(document.querySelectorAll('*')).filter(el => 
    el.src && el.src.startsWith('blob:')
  )
  console.log('📊 Blob URLs found:', blobUrls.length)
  
  if (svgElements.length === 0 && canvasElements.length > 0 && blobUrls.length === 0) {
    console.log('🎉 Efficient Canvas System is ACTIVE!')
    console.log('✅ No SVG elements')
    console.log('✅ Canvas elements present')
    console.log('✅ No blob URLs')
  } else {
    console.log('⚠️  Legacy SVG System detected')
    console.log('SVG elements:', svgElements.length)
    console.log('Canvas elements:', canvasElements.length)
    console.log('Blob URLs:', blobUrls.length)
  }
} else {
  console.log('❌ Plan canvas not found')
}

// Performance test
console.log('🚀 Performance Test:')
const startTime = performance.now()
// Simulate some operations
for (let i = 0; i < 1000; i++) {
  document.querySelector('canvas')
}
const endTime = performance.now()
console.log(`Canvas query time: ${(endTime - startTime).toFixed(2)}ms`)

console.log('Test complete!')

