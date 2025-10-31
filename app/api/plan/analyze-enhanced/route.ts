import { NextRequest, NextResponse } from 'next/server'
import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { enhancedConsensusEngine, EnhancedConsensusResult } from '@/lib/enhanced-consensus-engine'
import PDFParser from 'pdf2json'

// Enhanced Multi-Model Analysis API
// This endpoint uses 5+ specialized models with consensus scoring and disagreement detection

export async function POST(request: NextRequest) {
  let planId: string | undefined
  let userId: string | undefined

  try {
    const { planId: requestPlanId, images, drawings, taskType = 'takeoff', jobType } = await request.json()
    planId = requestPlanId

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    // Get user authentication from Supabase session
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    userId = user.id

    // Determine job type - fetch from plan -> job relationship if not provided
    let finalJobType = jobType
    if (!finalJobType) {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select(`
          job_id,
          jobs!inner(project_type)
        `)
        .eq('id', planId)
        .eq('user_id', userId)
        .single()

      if (planError || !plan) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        )
      }

      // Map project_type to job type: Commercial -> commercial, all others -> residential
      const projectType = (plan as any).jobs?.project_type
      finalJobType = projectType === 'Commercial' ? 'commercial' : 'residential'
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Images are required for analysis' },
        { status: 400 }
      )
    }

    // Check request size limits - limit to 5 images max to avoid 413 errors
    if (images.length > 5) {
      return NextResponse.json(
        { 
          error: 'Too many images for enhanced analysis',
          details: `Enhanced analysis is limited to 5 pages maximum. You provided ${images.length} pages. Please select the most important pages or use the standard AI analysis for larger plans.`,
          maxImages: 5,
          providedImages: images.length
        },
        { status: 413 }
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

    console.log(`Starting enhanced analysis for plan ${planId} with ${images.length} images (job type: ${finalJobType})`)

    // Attempt to fetch plan file and extract text for hybrid analysis
    let extractedText = ''
    try {
      const { data: planRow, error: planLoadError } = await supabase
        .from('plans')
        .select('*')
        .eq('id', planId)
        .eq('user_id', userId)
        .single()

      if (!planLoadError && planRow && planRow.file_path) {
        let fileUrl: string = planRow.file_path

        // If not an absolute URL, try to create a signed URL from storage (job-plans bucket)
        if (!fileUrl.startsWith('http')) {
          try {
            const { data: urlData } = await supabase.storage
              .from('job-plans')
              .createSignedUrl(fileUrl, 300)
            if (urlData?.signedUrl) {
              fileUrl = urlData.signedUrl
            }
          } catch {}
        }

        // Fetch the PDF and extract text
        try {
          const pdfRes = await fetch(fileUrl)
          const ab = await pdfRes.arrayBuffer()
          const buffer = Buffer.from(ab)
          extractedText = await extractTextFromPDF(buffer)
        } catch (e) {
          console.warn('Hybrid text extraction failed; proceeding with images only')
        }
      }
    } catch (e) {
      console.warn('Plan fetch for text extraction failed; proceeding with images only')
    }

    // Build specialized prompts based on task type and job type, injecting extracted text when available
    const systemPrompt = buildSystemPrompt(taskType, finalJobType)
    const userPrompt = buildUserPrompt(images.length, drawings, extractedText)

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
    console.log('Starting enhanced analysis with options:', analysisOptions)
    console.log('Images count:', images.length)
    
    let consensusResult: any
    let processingTime: number
    
    try {
      consensusResult = await enhancedAIProvider.analyzeWithConsensus(images, analysisOptions)
      processingTime = Date.now() - startTime
      console.log(`Enhanced analysis completed in ${processingTime}ms`)
      console.log('Consensus result:', {
        itemsCount: consensusResult.items.length,
        confidence: consensusResult.confidence,
        consensusCount: consensusResult.consensusCount
      })
    } catch (error) {
      console.error('Enhanced analysis failed:', error)
      
      // If it's a "Need at least 2 models" error or enhanced analysis failed, try fallback to ChatGPT only
      if (error instanceof Error && (error.message.includes('Need at least 2 models') || error.message.includes('Enhanced analysis failed') || error.message.includes('Single model analysis failed'))) {
        console.log('Falling back to ChatGPT-only analysis')
        try {
          // Import ChatGPT provider as fallback
          const { analyzeWithOpenAI } = await import('@/lib/ai-providers')
          const chatgptResult = await analyzeWithOpenAI(images, {
            systemPrompt,
            userPrompt,
            maxTokens: 8192,
            temperature: 0.2
          })
          
          // Parse ChatGPT response with improved JSON extraction
          let jsonText = chatgptResult.content
          
          // Remove markdown code blocks if present
          const codeBlockMatch = chatgptResult.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1]
          } else {
            // Try to find JSON object in the text
            const jsonMatch = chatgptResult.content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              jsonText = jsonMatch[0]
            }
          }
          
          const parsed = JSON.parse(jsonText)
          
          // Convert ChatGPT result to enhanced format
          consensusResult = {
            items: parsed.items || [],
            issues: parsed.issues || [],
            confidence: 0.8, // Single model confidence
            consensusCount: 1,
            disagreements: [],
            modelAgreements: ['chatgpt-fallback'],
            specializedInsights: parsed.specializedInsights || [],
            recommendations: parsed.recommendations || []
          }
          
          processingTime = Date.now() - startTime
          console.log(`ChatGPT fallback analysis completed in ${processingTime}ms`)
        } catch (fallbackError) {
          console.error('ChatGPT fallback analysis also failed:', fallbackError)
          throw error // Re-throw original error
        }
      } else {
        throw error // Re-throw if it's not a "Need at least 2 models" error
      }
    }

    // Save analysis results to database
    
    if (taskType === 'takeoff') {
      // Save takeoff analysis
      const { data: takeoffAnalysis, error: takeoffError } = await supabase
        .from('plan_takeoff_analysis')
        .insert({
          plan_id: planId,
          user_id: userId,
          items: consensusResult.items || [],
          summary: {
            total_items: consensusResult.items?.length || 0,
            confidence: consensusResult.confidence,
            consensus_count: consensusResult.consensusCount,
            model_agreements: consensusResult.modelAgreements,
            specialized_insights: consensusResult.specializedInsights,
            recommendations: consensusResult.recommendations
          },
          ai_model: 'enhanced-consensus',
          confidence_scores: {
            consensus: consensusResult.confidence,
            model_count: consensusResult.consensusCount
          },
          processing_time_ms: processingTime,
          job_type: finalJobType
        })
        .select()
        .single()

      if (takeoffError) {
        console.error('Error saving takeoff analysis:', takeoffError)
      }

      // Update plan status
      await supabase
        .from('plans')
        .update({ 
          takeoff_analysis_status: 'completed',
          has_takeoff_analysis: true
        })
        .eq('id', planId)
        .eq('user_id', userId)

    } else if (taskType === 'quality') {
      // Save quality analysis
      const { data: qualityAnalysis, error: qualityError } = await supabase
        .from('plan_quality_analysis')
        .insert({
          plan_id: planId,
          user_id: userId,
          overall_score: consensusResult.confidence,
          issues: consensusResult.issues || [],
          recommendations: consensusResult.recommendations || [],
          findings_by_category: {},
          findings_by_severity: {
            critical: [],
            warning: consensusResult.issues || [],
            info: []
          },
          ai_model: 'enhanced-consensus',
          processing_time_ms: processingTime,
          job_type: finalJobType
        })
        .select()
        .single()

      if (qualityError) {
        console.error('Error saving quality analysis:', qualityError)
      }

      // Update plan status
      await supabase
        .from('plans')
        .update({ 
          quality_analysis_status: 'completed',
          has_quality_analysis: true
        })
        .eq('id', planId)
        .eq('user_id', userId)
    }

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

// Build specialized system prompt based on task type and job type
function buildSystemPrompt(taskType: string, jobType: string = 'residential'): string {
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
      "unit_cost": 2.50,
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

  // Add job type specific instructions
  const jobTypePrompt = jobType === 'commercial' ? `

COMMERCIAL PROJECT FOCUS:
- Building codes & ADA compliance requirements
- Fire protection systems (sprinklers, alarms, exits)
- Commercial-grade MEP systems (3-phase electrical, commercial HVAC)
- Accessibility features (ramps, elevators, ADA-compliant fixtures)
- Life safety systems and emergency egress
- Commercial finishes and durability requirements
- Parking lot striping, signage, and ADA spaces
- Commercial-grade windows, doors, and hardware
- Tenant improvement allowances
- Base building vs tenant scope distinctions
- Commercial roofing systems (EPDM, TPO, built-up)
- High-rise considerations (elevator shafts, mechanical floors)
- Commercial lighting (LED, fluorescent, emergency lighting)
- Commercial flooring (VCT, carpet tile, polished concrete)
- Commercial restroom fixtures and accessibility
- Commercial kitchen equipment and ventilation
- Data/telecom infrastructure and cable management
- Security systems and access control
- Energy efficiency and LEED compliance
- Commercial landscaping and site amenities` : `

RESIDENTIAL PROJECT FOCUS:
- Residential building codes and energy efficiency
- Single-family or multi-family dwelling details
- Residential appliances and fixtures
- Custom finishes and millwork details
- Landscaping and outdoor living spaces
- Residential-grade HVAC, electrical (120/240V), plumbing
- Insulation values and energy code compliance
- Residential roofing details (composition, architectural)
- Interior comfort features (fireplaces, built-ins)
- Finish schedules for paint, flooring, countertops
- Residential lighting (recessed, pendant, chandelier)
- Residential flooring (hardwood, carpet, tile, LVT)
- Residential cabinetry and countertops
- Residential appliances (kitchen, laundry, HVAC)
- Residential outdoor features (decks, patios, landscaping)
- Residential security and smart home features
- Energy efficient windows and doors
- Residential insulation and air sealing
- Residential plumbing fixtures and finishes
- Custom millwork and built-in features`

  // Add task-specific instructions
  switch (taskType) {
    case 'takeoff':
      return basePrompt + jobTypePrompt + `

TAKEOFF ANALYSIS FOCUS:
- Extract ALL material quantities and measurements
- Calculate accurate quantities based on visible dimensions
- Identify all construction materials, fixtures, and components
- Use standard construction estimating practices
- Cross-reference dimensions to ensure accuracy
- Assign appropriate Procore cost codes to each item
- Provide realistic unit_cost pricing for each item

3-LEVEL CATEGORIZATION:
LEVEL 1: CATEGORY (structural, exterior, interior, mep, finishes, other)
LEVEL 2: SUBCATEGORY (specific work type)
LEVEL 3: LINE ITEMS (individual materials with Procore cost codes)

PRICING REQUIREMENTS:
- For each item, you MUST provide a realistic "unit_cost" based on material type, grade, and typical market rates (as of 2024)
- Include both material and labor costs where applicable
- Use industry-standard pricing ranges appropriate for the material and unit type
- Price per LF, SF, CF, CY, EA, or SQ depending on the unit

BE THOROUGH: Extract every measurable element visible in the plan
BE SPECIFIC: "2x6 Top Plate" not just "lumber"
SHOW YOUR MATH: Include dimensions used for calculations
USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
ASSIGN SUBCATEGORIES: Every item must have a subcategory
ASSIGN COST CODES: Use the Procore cost codes provided
INCLUDE LOCATIONS: Specify where each item is located
PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
INCLUDE PRICING: Every item must have a realistic unit_cost`

    case 'quality':
      return basePrompt + jobTypePrompt + `

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
      return basePrompt + jobTypePrompt + `

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
      return basePrompt + jobTypePrompt
  }
}

// Build user prompt with image count and context; optionally include extracted PDF text
function buildUserPrompt(imageCount: number, drawings?: any[], extractedText?: string): string {
  let prompt = `Analyze this construction plan with ${imageCount} page${imageCount > 1 ? 's' : ''} for comprehensive construction analysis.

IMAGES PROVIDED: ${imageCount} page${imageCount > 1 ? 's' : ''} of construction plans
ANALYSIS REQUIRED: Complete construction analysis with materials, quantities, and quality assessment

${extractedText && extractedText.length > 0 ? `=== EXTRACTED TEXT FROM PDF (truncated) ===
${extractedText.slice(0, 8000)}${extractedText.length > 8000 ? '\n\n...(additional text truncated)' : ''}

=== VISUAL ANALYSIS INSTRUCTIONS ===` : ''}

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

// Extracts text from a PDF Buffer using pdf2json, returning a single concatenated string.
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('Error parsing PDF:', errData.parserError)
      reject(new Error('Failed to parse PDF'))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let text = ''
        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            text += `\n=== PAGE ${pageIndex + 1} ===\n`
            if (page.Texts) {
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                const yDiff = a.y - b.y
                if (Math.abs(yDiff) > 0.5) return yDiff
                return a.x - b.x
              })
              sortedTexts.forEach((textItem: any) => {
                if (textItem.R) {
                  textItem.R.forEach((r: any) => {
                    if (r.T) {
                      text += decodeURIComponent(r.T) + ' '
                    }
                  })
                }
              })
              text += '\n'
            }
          })
        }
        resolve(text.trim())
      } catch (error) {
        console.error('Error extracting text:', error)
        resolve('')
      }
    })

    pdfParser.parseBuffer(buffer)
  })
}
