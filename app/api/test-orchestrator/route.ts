import { NextRequest, NextResponse } from 'next/server'
import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'

/**
 * Test endpoint to verify orchestrator models work
 * GET /api/test-orchestrator
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Model Orchestrator Models...')
    
    // Check API keys
    const apiKeys = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      GOOGLE_GEMINI_API_KEY: !!process.env.GOOGLE_GEMINI_API_KEY,
      XAI_API_KEY: !!process.env.XAI_API_KEY
    }
    
    const availableCount = Object.values(apiKeys).filter(Boolean).length
    
    if (availableCount < 2) {
      return NextResponse.json({
        success: false,
        error: `Need at least 2 API keys. Only ${availableCount} available.`,
        apiKeys
      }, { status: 400 })
    }
    
    // Test prompt - simple JSON response
    const testPrompt: EnhancedAnalysisOptions = {
      systemPrompt: `You are a construction analyst. Return ONLY valid JSON with this EXACT structure (no markdown, no explanations):
{
  "items": [
    {
      "name": "2x4 Stud Framing",
      "description": "Wall framing",
      "quantity": 150,
      "unit": "LF",
      "unit_cost": 2.50,
      "location": "Test Location",
      "category": "structural",
      "subcategory": "Framing",
      "cost_code": "6,100",
      "cost_code_description": "Rough Carpentry",
      "notes": "Test item",
      "confidence": 0.9
    }
  ],
  "issues": [],
  "quality_analysis": {
    "completeness": {
      "overall_score": 0.8,
      "missing_sheets": [],
      "missing_dimensions": [],
      "missing_details": [],
      "incomplete_sections": [],
      "notes": "Test analysis"
    },
    "consistency": {
      "scale_mismatches": [],
      "unit_conflicts": [],
      "dimension_contradictions": [],
      "schedule_vs_elevation_conflicts": [],
      "notes": "No issues"
    },
    "risk_flags": [],
    "audit_trail": {
      "pages_analyzed": [1],
      "chunks_processed": 1,
      "coverage_percentage": 100,
      "assumptions_made": []
    }
  }
}`,
      userPrompt: 'Analyze this test construction plan. Extract exactly 3 items: 2x4 stud framing (150 LF), drywall (500 SF), and concrete footing (10 CY). Return ONLY the JSON object, no other text.',
      taskType: 'takeoff',
      maxTokens: 2048,
      temperature: 0.2,
      prioritizeAccuracy: true,
      includeConsensus: false
    }
    
    console.log('📡 Dispatching to all models...')
    const startTime = Date.now()
    
    // Run all models in parallel
    const allResults = await enhancedAIProvider.analyzeWithSpecializedModels(
      [], // No images for simple test
      testPrompt
    )
    
    const processingTime = Date.now() - startTime
    
    console.log(`✅ Received ${allResults.length} responses in ${processingTime}ms`)
    
    // Analyze results
    const testResults = allResults.map(result => {
      let parsed: any = null
      let parseError: string | null = null
      let isValid = false
      let itemsCount = 0
      let hasQualityAnalysis = false
      
      try {
        // Try to extract JSON
        let jsonText = result.content
        const codeBlockMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1]
        } else {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            jsonText = jsonMatch[0]
          }
        }
        
        parsed = JSON.parse(jsonText)
        
        // Validate structure
        isValid = !!(
          parsed.items &&
          Array.isArray(parsed.items) &&
          parsed.quality_analysis &&
          parsed.quality_analysis.completeness
        )
        
        itemsCount = parsed.items?.length || 0
        hasQualityAnalysis = !!parsed.quality_analysis
      } catch (error) {
        parseError = error instanceof Error ? error.message : 'Unknown parse error'
        isValid = false
      }
      
      return {
        model: result.model,
        provider: result.provider,
        success: isValid && !parseError,
        itemsCount,
        hasQualityAnalysis,
        contentLength: result.content.length,
        confidence: result.confidence,
        parseError,
        processingTime: result.processingTime || processingTime,
        responsePreview: result.content.substring(0, 150)
      }
    })
    
    const successful = testResults.filter(r => r.success)
    const failed = testResults.filter(r => !r.success)
    
    console.log(`✅ ${successful.length}/${allResults.length} models succeeded`)
    if (failed.length > 0) {
      console.log(`❌ ${failed.length} models failed:`, failed.map(f => `${f.model}: ${f.parseError || 'Unknown'}`))
    }
    
    return NextResponse.json({
      success: successful.length >= 2,
      summary: {
        totalModels: allResults.length,
        successful: successful.length,
        failed: failed.length,
        processingTimeMs: processingTime,
        canRunOrchestrator: successful.length >= 2
      },
      apiKeys,
      results: testResults,
      recommendations: successful.length >= 2
        ? {
            message: '✅ Orchestrator can run! All systems operational.',
            nextSteps: [
              'Test with actual plan images/chunks',
              'Verify disagreement detection',
              'Check adjudication logic'
            ]
          }
        : {
            message: '❌ Need at least 2 working models',
            issues: failed.map(f => `${f.model}: ${f.parseError || 'Unknown error'}`)
          }
    })
    
  } catch (error) {
    console.error('Test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

