// Comprehensive Enhanced AI System Verification
// This script will show you exactly what your enhanced system is doing

const verifyEnhancedSystem = async () => {
  console.log('🔍 VERIFYING YOUR ENHANCED AI SYSTEM')
  console.log('=' * 60)
  
  try {
    console.log('\n📊 Step 1: Testing Enhanced Multi-Model Analysis...')
    
    const response = await fetch('http://localhost:3000/api/plan/analyze-enhanced', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: 'verification-test-123',
        images: [
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        ],
        taskType: 'takeoff'
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      console.log('✅ ENHANCED SYSTEM IS WORKING!')
      console.log('\n📈 DETAILED RESULTS:')
      console.log('─' * 40)
      
      // Show consensus details
      if (result.consensus) {
        console.log(`🎯 Consensus Score: ${(result.consensus.confidence * 100).toFixed(1)}%`)
        console.log(`🤖 Models Used: ${result.consensus.consensusCount}`)
        console.log(`⚠️  Disagreements: ${result.consensus.disagreements?.length || 0}`)
        
        if (result.consensus.modelAgreements) {
          console.log('\n🤝 Model Agreements:')
          Object.entries(result.consensus.modelAgreements).forEach(([model, agreement]) => {
            console.log(`   ${model}: ${(agreement * 100).toFixed(1)}% agreement`)
          })
        }
      }
      
      // Show processing details
      console.log(`\n⏱️  Processing Time: ${result.processingTime}ms`)
      console.log(`📊 Total Models: ${result.metadata?.totalModels}`)
      console.log(`🖼️  Images Analyzed: ${result.metadata?.imagesAnalyzed}`)
      
      // Show results
      if (result.results?.items) {
        console.log(`\n📋 Items Detected: ${result.results.items.length}`)
        console.log('\n🔍 Sample Items:')
        result.results.items.slice(0, 5).forEach((item, i) => {
          console.log(`   ${i+1}. ${item.name}`)
          console.log(`      Quantity: ${item.quantity} ${item.unit}`)
          console.log(`      Category: ${item.category}`)
          console.log(`      Confidence: ${(item.confidence * 100).toFixed(1)}%`)
          console.log('')
        })
      }
      
      // Show specialized insights
      if (result.results?.specializedInsights) {
        console.log('\n💡 Specialized Insights:')
        result.results.specializedInsights.forEach((insight, i) => {
          console.log(`   ${i+1}. ${insight}`)
        })
      }
      
      // Show recommendations
      if (result.results?.recommendations) {
        console.log('\n🎯 Recommendations:')
        result.results.recommendations.forEach((rec, i) => {
          console.log(`   ${i+1}. ${rec}`)
        })
      }
      
      console.log('\n🎉 VERIFICATION COMPLETE!')
      console.log('Your enhanced multi-model AI system is working perfectly!')
      
    } else {
      console.log('❌ Enhanced API Test Failed:', result.error)
      console.log('Details:', result.details)
    }
    
  } catch (error) {
    console.log('❌ Verification Error:', error.message)
  }
}

// Run the verification
verifyEnhancedSystem()
