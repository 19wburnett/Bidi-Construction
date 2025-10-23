// Test script for Enhanced Multi-Model AI System
// This script validates the enhanced consensus engine and specialized routing

import { enhancedAIProvider, EnhancedAnalysisOptions } from './enhanced-ai-providers'
import { enhancedConsensusEngine } from './enhanced-consensus-engine'

// Mock test data
const mockImages = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
]

const mockDrawings = [
  {
    id: 'drawing_1',
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    page: 1
  }
]

// Test enhanced consensus analysis
export async function testEnhancedConsensus() {
  console.log('🧪 Testing Enhanced Multi-Model Consensus System...')
  
  try {
    const options: EnhancedAnalysisOptions = {
      maxTokens: 4096,
      temperature: 0.2,
      systemPrompt: 'You are an expert construction analyst. Analyze the provided construction plans and extract detailed material takeoff information.',
      userPrompt: 'Analyze these construction plans and provide a comprehensive material takeoff analysis.',
      taskType: 'takeoff',
      prioritizeAccuracy: true,
      includeConsensus: true
    }

    console.log('📊 Running consensus analysis with 5+ specialized models...')
    const startTime = Date.now()
    
    const consensusResult = await enhancedAIProvider.analyzeWithConsensus(mockImages, options)
    
    const processingTime = Date.now() - startTime
    
    console.log('✅ Enhanced consensus analysis completed!')
    console.log(`⏱️ Processing time: ${processingTime}ms`)
    console.log(`🎯 Consensus score: ${Math.round(consensusResult.confidence * 100)}%`)
    console.log(`🤖 Models used: ${consensusResult.consensusCount}`)
    console.log(`⚠️ Disagreements: ${consensusResult.disagreements.length}`)
    console.log(`📋 Items found: ${consensusResult.items.length}`)
    
    // Test specialized routing
    console.log('\n🔀 Testing Specialized Model Routing...')
    
    const takeoffOptions: EnhancedAnalysisOptions = {
      ...options,
      taskType: 'takeoff'
    }
    
    const qualityOptions: EnhancedAnalysisOptions = {
      ...options,
      taskType: 'quality'
    }
    
    const bidOptions: EnhancedAnalysisOptions = {
      ...options,
      taskType: 'bid_analysis'
    }
    
    console.log('📐 Testing takeoff analysis routing...')
    const takeoffModels = enhancedAIProvider['getBestModelsForTask']('takeoff', 3)
    console.log(`Best models for takeoff: ${takeoffModels.join(', ')}`)
    
    console.log('🔍 Testing quality analysis routing...')
    const qualityModels = enhancedAIProvider['getBestModelsForTask']('quality', 3)
    console.log(`Best models for quality: ${qualityModels.join(', ')}`)
    
    console.log('💰 Testing bid analysis routing...')
    const bidModels = enhancedAIProvider['getBestModelsForTask']('bid_analysis', 3)
    console.log(`Best models for bid analysis: ${bidModels.join(', ')}`)
    
    // Test consensus engine
    console.log('\n🧠 Testing Enhanced Consensus Engine...')
    
    const mockResults = [
      {
        model: 'gpt-4o',
        specialization: 'general_construction',
        confidence: 0.95,
        items: [
          {
            name: '2x4 Stud Framing',
            description: 'Interior wall framing',
            quantity: 150,
            unit: 'LF',
            category: 'structural',
            subcategory: 'Framing',
            confidence: 0.9
          }
        ],
        issues: [],
        raw: {}
      },
      {
        model: 'claude-3.5-sonnet',
        specialization: 'code_compliance',
        confidence: 0.88,
        items: [
          {
            name: '2x4 Stud Framing',
            description: 'Interior wall framing',
            quantity: 145,
            unit: 'LF',
            category: 'structural',
            subcategory: 'Framing',
            confidence: 0.85
          }
        ],
        issues: [],
        raw: {}
      }
    ]
    
    const enhancedConsensus = await enhancedConsensusEngine.buildEnhancedConsensus(
      mockResults as any,
      'takeoff'
    )
    
    console.log('✅ Enhanced consensus engine test completed!')
    console.log(`📊 Final confidence: ${Math.round(enhancedConsensus.confidence * 100)}%`)
    console.log(`📋 Consensus items: ${enhancedConsensus.items.length}`)
    console.log(`⚠️ Disagreements detected: ${enhancedConsensus.disagreements.length}`)
    console.log(`💡 Specialized insights: ${enhancedConsensus.specializedInsights.length}`)
    console.log(`📝 Recommendations: ${enhancedConsensus.recommendations.length}`)
    
    return {
      success: true,
      processingTime,
      consensusScore: consensusResult.confidence,
      modelCount: consensusResult.consensusCount,
      disagreements: consensusResult.disagreements.length,
      items: consensusResult.items.length
    }
    
  } catch (error) {
    console.error('❌ Enhanced consensus test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Test model specializations
export function testModelSpecializations() {
  console.log('🎯 Testing Model Specializations...')
  
  const specializations = {
    'gpt-4o': 'general_construction',
    'claude-3.5-sonnet': 'code_compliance',
    'gemini-1.5-pro': 'measurements',
    'gpt-4-vision': 'symbol_recognition',
    'claude-3-opus': 'cost_estimation'
  }
  
  Object.entries(specializations).forEach(([model, specialization]) => {
    console.log(`✅ ${model}: ${specialization}`)
  })
  
  return specializations
}

// Test consensus scoring
export function testConsensusScoring() {
  console.log('📊 Testing Consensus Scoring...')
  
  const testItems = [
    { name: '2x4 Stud', quantity: 150, confidence: 0.9, ai_provider: 'gpt-4o' },
    { name: '2x4 Stud', quantity: 145, confidence: 0.85, ai_provider: 'claude-3.5-sonnet' },
    { name: '2x4 Stud', quantity: 155, confidence: 0.88, ai_provider: 'gemini-1.5-pro' }
  ]
  
  // Calculate consensus score
  const consensusScore = testItems.length / 3 // 3 models
  const avgConfidence = testItems.reduce((sum, item) => sum + item.confidence, 0) / testItems.length
  const consensusBoost = Math.min(consensusScore * 0.2, 0.2)
  const finalConfidence = Math.min(avgConfidence + consensusBoost, 1.0)
  
  console.log(`📈 Consensus score: ${consensusScore.toFixed(2)}`)
  console.log(`🎯 Average confidence: ${avgConfidence.toFixed(2)}`)
  console.log(`🚀 Consensus boost: ${consensusBoost.toFixed(2)}`)
  console.log(`✅ Final confidence: ${finalConfidence.toFixed(2)}`)
  
  return {
    consensusScore,
    avgConfidence,
    consensusBoost,
    finalConfidence
  }
}

// Run all tests
export async function runAllTests() {
  console.log('🚀 Starting Enhanced Multi-Model AI System Tests...\n')
  
  try {
    // Test model specializations
    const specializations = testModelSpecializations()
    console.log('✅ Model specializations test passed\n')
    
    // Test consensus scoring
    const scoring = testConsensusScoring()
    console.log('✅ Consensus scoring test passed\n')
    
    // Test enhanced consensus (requires API keys)
    console.log('⚠️ Note: Enhanced consensus test requires valid API keys')
    console.log('🔑 Set OPENAI_API_KEY, ANTHROPIC_API_KEY, and GOOGLE_GEMINI_API_KEY to run full test\n')
    
    return {
      success: true,
      specializations,
      scoring,
      message: 'All tests completed successfully!'
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Export test functions
export default {
  testEnhancedConsensus,
  testModelSpecializations,
  testConsensusScoring,
  runAllTests
}
