import { NextRequest, NextResponse } from 'next/server'
import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'
import { enhancedConsensusEngine, EnhancedConsensusResult } from '@/lib/enhanced-consensus-engine'

// Enhanced Multi-Model Analysis API
// This endpoint uses 5+ specialized models with consensus scoring and disagreement detection

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

    console.log(`Starting enhanced analysis for plan ${planId} with ${images.length} images`)

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

    // Run enhanced consensus analysis
    const startTime = Date.now()
    const consensusResult = await enhancedAIProvider.analyzeWithConsensus(images, analysisOptions)
    const processingTime = Date.now() - startTime

    console.log(`Enhanced analysis completed in ${processingTime}ms`)

    // Build response with enhanced metadata
    const response = {
      success: true,
      planId,
      taskType,
      processingTime,
      consensus: {
        confidence: consensusResult.confidence,
        consensusCount: consensusResult.consensusCount,
        disagreements: consensusResult.disagreements,
        modelAgreements: consensusResult.modelAgreements
      },
      results: taskType === 'takeoff' 
        ? {
            items: consensusResult.items,
            specializedInsights: consensusResult.specializedInsights,
            recommendations: consensusResult.recommendations
          }
        : {
            issues: consensusResult.issues,
            specializedInsights: consensusResult.specializedInsights,
            recommendations: consensusResult.recommendations
          },
      metadata: {
        totalModels: consensusResult.consensusCount,
        processingTimeMs: processingTime,
        imagesAnalyzed: images.length,
        consensusScore: consensusResult.confidence,
        disagreementsCount: consensusResult.disagreements.length,
        recommendationsCount: consensusResult.recommendations.length
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Enhanced analysis error:', error)
    return NextResponse.json(
      { 
        error: 'Enhanced analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
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
