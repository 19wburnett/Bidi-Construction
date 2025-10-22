import { NextRequest, NextResponse } from 'next/server'
import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'

// Enhanced Multi-Model Analysis API with Batch Processing
// This endpoint processes large plans in batches of 5 pages each

export async function POST(request: NextRequest) {
  try {
    const { planId, images, drawings, taskType = 'takeoff' } = await request.json()

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Images are required for analysis' },
        { status: 400 }
      )
    }

    // Check environment variables for enhanced AI providers
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_GEMINI_API_KEY',
      'XAI_API_KEY'
    ]
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      console.error('Missing environment variables for enhanced AI:', missingVars)
      return NextResponse.json(
        { 
          error: 'Enhanced AI system not configured',
          details: `Missing environment variables: ${missingVars.join(', ')}. Please configure all required API keys for the enhanced multi-model system.`,
          fallback: 'Please use the standard AI analysis instead'
        },
        { status: 503 }
      )
    }

    console.log(`Starting batch enhanced analysis for plan ${planId} with ${images.length} images`)

    // Process images in batches of 5
    const batchSize = 5
    const batches = []
    for (let i = 0; i < images.length; i += batchSize) {
      batches.push(images.slice(i, i + batchSize))
    }

    console.log(`Processing ${batches.length} batches of images`)

    // Build specialized prompts based on task type
    const systemPrompt = buildSystemPrompt(taskType)
    const userPrompt = buildUserPrompt(images.length, drawings)

    // Configure analysis options
    const analysisOptions: EnhancedAnalysisOptions = {
      maxTokens: 4096,
      temperature: 0.2,
      systemPrompt,
      userPrompt,
      taskType: taskType as TaskType,
      prioritizeAccuracy: true,
      includeConsensus: true
    }

    // Process each batch
    const batchResults = []
    let totalProcessingTime = 0

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const startTime = Date.now()
      
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} images`)
      
      try {
        const consensusResult = await enhancedAIProvider.analyzeWithConsensus(batch, analysisOptions)
        const processingTime = Date.now() - startTime
        totalProcessingTime += processingTime
        
        batchResults.push({
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          imagesProcessed: batch.length,
          processingTime,
          result: consensusResult
        })
        
        console.log(`Batch ${batchIndex + 1} completed in ${processingTime}ms`)
      } catch (error) {
        console.error(`Batch ${batchIndex + 1} failed:`, error)
        throw new Error(`Batch ${batchIndex + 1} processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Merge results from all batches
    const mergedResult = mergeBatchResults(batchResults, taskType)

    // Build response with batch processing metadata
    const response = {
      success: true,
      planId,
      taskType,
      processingTime: totalProcessingTime,
      batchProcessing: {
        totalBatches: batches.length,
        batchResults: batchResults.map(b => ({
          batchIndex: b.batchIndex,
          imagesProcessed: b.imagesProcessed,
          processingTime: b.processingTime
        }))
      },
      consensus: {
        confidence: mergedResult.confidence,
        consensusCount: mergedResult.consensusCount,
        disagreements: mergedResult.disagreements,
        modelAgreements: mergedResult.modelAgreements
      },
      results: taskType === 'takeoff' 
        ? {
            items: mergedResult.items,
            specializedInsights: mergedResult.specializedInsights,
            recommendations: mergedResult.recommendations
          }
        : {
            issues: mergedResult.issues,
            specializedInsights: mergedResult.specializedInsights,
            recommendations: mergedResult.recommendations
          },
      metadata: {
        totalModels: mergedResult.consensusCount,
        processingTimeMs: totalProcessingTime,
        imagesAnalyzed: images.length,
        batchesProcessed: batches.length,
        consensusScore: mergedResult.confidence,
        disagreementsCount: mergedResult.disagreements.length,
        recommendationsCount: mergedResult.recommendations.length
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Batch enhanced analysis error:', error)
    return NextResponse.json(
      { 
        error: 'Batch enhanced analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Merge results from multiple batches
function mergeBatchResults(batchResults: any[], taskType: string): any {
  const allItems = batchResults.flatMap(batch => batch.result.items || [])
  const allIssues = batchResults.flatMap(batch => batch.result.issues || [])
  const allDisagreements = batchResults.flatMap(batch => batch.result.disagreements || [])
  const allSpecializedInsights = batchResults.flatMap(batch => batch.result.specializedInsights || [])
  const allRecommendations = batchResults.flatMap(batch => batch.result.recommendations || [])

  // Calculate average confidence across all batches
  const avgConfidence = batchResults.reduce((sum, batch) => sum + (batch.result.confidence || 0), 0) / batchResults.length
  
  // Get total consensus count (sum of all models used across batches)
  const totalConsensusCount = batchResults.reduce((sum, batch) => sum + (batch.result.consensusCount || 0), 0)

  return {
    items: allItems,
    issues: allIssues,
    confidence: avgConfidence,
    consensusCount: totalConsensusCount,
    disagreements: allDisagreements,
    modelAgreements: batchResults[0]?.result.modelAgreements || [],
    specializedInsights: allSpecializedInsights,
    recommendations: [...new Set(allRecommendations)] // Remove duplicates
  }
}

// Build specialized system prompt based on task type
function buildSystemPrompt(taskType: string): string {
  const basePrompt = `You are an expert construction analyst with specialized knowledge in construction plans, building codes, and material takeoffs. You are part of a multi-model consensus system that provides the most accurate analysis possible.

CRITICAL INSTRUCTIONS:
- Analyze ALL provided images thoroughly
- Provide detailed, accurate measurements and quantities
- Include specific locations and bounding boxes
- Assign appropriate Procore cost codes
- Identify potential issues and code violations
- Provide professional recommendations

RESPONSE FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "items": [
    {
      "name": "Specific item name",
      "description": "Detailed description",
      "quantity": 150.5,
      "unit": "LF|SF|CF|CY|EA|SQ",
      "location": "Specific location",
      "category": "structural|exterior|interior|mep|finishes|other",
      "subcategory": "Specific subcategory",
      "cost_code": "Procore cost code",
      "cost_code_description": "Cost code description",
      "notes": "Additional notes",
      "dimensions": "Original dimensions from plan",
      "bounding_box": {
        "page": 1,
        "x": 0.25,
        "y": 0.30,
        "width": 0.15,
        "height": 0.10
      },
      "confidence": 0.95
    }
  ],
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "Issue category",
      "description": "Issue description",
      "location": "Issue location",
      "impact": "Impact description",
      "recommendation": "Recommended solution",
      "bounding_box": {
        "page": 1,
        "x": 0.25,
        "y": 0.30,
        "width": 0.15,
        "height": 0.10
      },
      "confidence": 0.90
    }
  ],
  "summary": {
    "total_items": 0,
    "categories": {},
    "subcategories": {},
    "total_area_sf": 0,
    "plan_scale": "detected scale",
    "confidence": "high|medium|low",
    "notes": "Overall observations"
  }
}`

  // Add task-specific instructions
  switch (taskType) {
    case 'takeoff':
      return basePrompt + `

TAKEOFF ANALYSIS FOCUS:
- Extract ALL material quantities and measurements
- Calculate accurate quantities based on visible dimensions
- Identify all construction materials, fixtures, and components
- Use standard construction estimating practices
- Cross-reference dimensions to ensure accuracy
- Assign appropriate Procore cost codes to each item

3-LEVEL CATEGORIZATION:
LEVEL 1: CATEGORY (structural, exterior, interior, mep, finishes, other)
LEVEL 2: SUBCATEGORY (specific work type)
LEVEL 3: LINE ITEMS (individual materials with Procore cost codes)

BE THOROUGH: Extract every measurable element visible in the plan
BE SPECIFIC: "2x6 Top Plate" not just "lumber"
SHOW YOUR MATH: Include dimensions used for calculations
USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
ASSIGN SUBCATEGORIES: Every item must have a subcategory
ASSIGN COST CODES: Use the Procore cost codes provided
INCLUDE LOCATIONS: Specify where each item is located
PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates`

    case 'quality':
      return basePrompt + `

QUALITY ANALYSIS FOCUS:
- Identify potential problems and code violations
- Check for safety concerns and compliance issues
- Assess construction quality and workmanship
- Identify missing information or unclear details
- Provide recommendations for improvements

SEVERITY LEVELS:
- CRITICAL: Safety hazards, code violations, structural issues
- WARNING: Quality concerns, potential problems, unclear details
- INFO: Recommendations, best practices, general observations

BE THOROUGH: Examine every detail for potential issues
BE SPECIFIC: Provide detailed descriptions of problems
INCLUDE IMPACT: Explain the impact of each issue
PROVIDE SOLUTIONS: Give specific recommendations for each issue
ASSIGN SEVERITY: Use appropriate severity levels
INCLUDE LOCATIONS: Specify where each issue is located
PROVIDE BOUNDING BOXES: Every issue must have a bounding_box with coordinates`

    case 'bid_analysis':
      return basePrompt + `

BID ANALYSIS FOCUS:
- Provide realistic cost estimates and timelines
- Identify material requirements and labor needs
- Assess project complexity and requirements
- Identify potential challenges and risks
- Provide professional recommendations

COST ESTIMATION:
- Use current market rates and material costs
- Consider regional pricing variations
- Include labor costs and overhead
- Factor in project complexity
- Provide realistic timelines

BE REALISTIC: Provide accurate, market-based estimates
BE DETAILED: Break down costs by category and item
INCLUDE TIMELINE: Provide realistic project timelines
IDENTIFY RISKS: Highlight potential challenges and risks
PROVIDE RECOMMENDATIONS: Give professional advice and suggestions`

    default:
      return basePrompt
  }
}

// Build user prompt with image count and context
function buildUserPrompt(imageCount: number, drawings?: any[]): string {
  let prompt = `Analyze this construction plan with ${imageCount} page${imageCount > 1 ? 's' : ''} for comprehensive construction analysis.

IMAGES PROVIDED: ${imageCount} page${imageCount > 1 ? 's' : ''} of construction plans
ANALYSIS REQUIRED: Complete construction analysis with materials, quantities, and quality assessment

INSTRUCTIONS:
1. Examine EVERY dimension, measurement, and annotation visible in the plan
2. Calculate quantities based on visible dimensions and scale
3. Identify all construction materials, fixtures, and components
4. Use standard construction estimating practices
5. Cross-reference dimensions to ensure accuracy
6. Assign appropriate Procore cost codes to each item
7. Identify potential issues and code violations
8. Provide professional recommendations

IMPORTANT:
- Be SPECIFIC: "2x6 Top Plate" not just "lumber"
- SHOW YOUR MATH: Include dimensions used for calculations
- USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
- BE THOROUGH: Extract every measurable element visible in the plan
- ASSIGN SUBCATEGORIES: Every item must have a subcategory
- ASSIGN COST CODES: Use the Procore cost codes provided
- INCLUDE LOCATIONS: Specify where each item is located
- PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
- If dimensions are unclear or not visible, state "dimension not visible" in notes

CRITICAL: You MUST respond with ONLY the JSON object. Do not include any explanatory text before or after the JSON.`

  if (drawings && drawings.length > 0) {
    prompt += `\n\nUSER ANNOTATIONS: ${drawings.length} user annotation${drawings.length > 1 ? 's' : ''} included for reference`
  }

  return prompt
}
