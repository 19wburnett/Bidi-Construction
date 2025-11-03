import { NextRequest, NextResponse } from 'next/server'
import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { enhancedConsensusEngine, EnhancedConsensusResult } from '@/lib/enhanced-consensus-engine'
// import { modelOrchestrator } from '@/lib/model-orchestrator' // TODO: Re-enable when orchestrator is ready
import PDFParser from 'pdf2json'
import type { ProjectMeta, Chunk, SheetIndex } from '@/types/ingestion'
import { generateTemplateInstructions } from '@/lib/takeoff-template'

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

    // Orchestrator temporarily disabled - using standard enhanced analysis
    // TODO: Re-enable orchestrator when model-orchestrator is fully ready

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
    // Always save BOTH takeoff and quality analysis regardless of taskType
    
    // Extract quality_analysis from consensusResult if it exists, or construct from issues
    // The consensus engine now extracts and merges quality_analysis from all models
    // This will be reused in the response, so construct once here
    // Add confidence warning if overall confidence is low
    const overallConfidence = consensusResult.confidence || 0.8
    const confidenceWarning = overallConfidence < 0.6 
      ? `⚠️ LOW CONFIDENCE ANALYSIS (${(overallConfidence * 100).toFixed(0)}%) - Some items may need manual verification.`
      : ''
    
    const qualityAnalysisData = consensusResult.quality_analysis || {
      completeness: {
        overall_score: overallConfidence,
        missing_sheets: [],
        missing_dimensions: [],
        missing_details: [],
        incomplete_sections: [],
        notes: confidenceWarning || 'Quality analysis included with takeoff'
      },
      consistency: {
        scale_mismatches: [],
        unit_conflicts: [],
        dimension_contradictions: [],
        schedule_vs_elevation_conflicts: [],
        notes: 'No consistency issues detected'
      },
      risk_flags: consensusResult.issues?.map((issue: any) => ({
        level: issue.severity === 'critical' ? 'high' : issue.severity === 'warning' ? 'medium' : 'low',
        category: issue.category || 'general',
        description: issue.description || issue.detail || issue.message || '',
        location: issue.location || '',
        recommendation: issue.recommendation || ''
      })) || [],
      audit_trail: {
        pages_analyzed: Array.from({ length: images.length }, (_, i) => i + 1),
        chunks_processed: 1,
        coverage_percentage: 100,
        assumptions_made: []
      }
    }

    // Save takeoff analysis (always, if items exist or if taskType is takeoff)
    if (taskType === 'takeoff' || (consensusResult.items && consensusResult.items.length > 0)) {
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
            recommendations: consensusResult.recommendations,
            quality_analysis: qualityAnalysisData // Include quality analysis in takeoff summary
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
      } else {
        // Update plan status
        await supabase
          .from('plans')
          .update({ 
            takeoff_analysis_status: 'completed',
            has_takeoff_analysis: true
          })
          .eq('id', planId)
          .eq('user_id', userId)
      }
    }

    // Save quality analysis (ALWAYS - both takeoff and quality analysis should be saved)
    // Even if there are no issues, we save the completeness/consistency/audit data
    const shouldSaveQuality = taskType === 'quality' || 
        taskType === 'takeoff' || // ALWAYS save quality analysis when doing takeoff
        (consensusResult.issues && consensusResult.issues.length > 0) || 
        qualityAnalysisData
    
    if (shouldSaveQuality) {
      
      // Organize issues by severity
      const issues = consensusResult.issues || []
      const criticalIssues = issues.filter((i: any) => i.severity === 'critical')
      const warningIssues = issues.filter((i: any) => i.severity === 'warning')
      const infoIssues = issues.filter((i: any) => i.severity === 'info')

      const { data: qualityAnalysis, error: qualityError } = await supabase
        .from('plan_quality_analysis')
        .insert({
          plan_id: planId,
          user_id: userId,
          overall_score: qualityAnalysisData.completeness?.overall_score || consensusResult.confidence || 0.8,
          issues: issues,
          recommendations: consensusResult.recommendations || [],
          missing_details: qualityAnalysisData.completeness?.missing_details || [],
          findings_by_category: {}, // Can be populated from issues by category
          findings_by_severity: {
            critical: criticalIssues,
            warning: warningIssues,
            info: infoIssues
          },
          ai_model: 'enhanced-consensus',
          processing_time_ms: processingTime,
          job_type: finalJobType
        })
        .select()
        .single()

      if (qualityError) {
        console.error('Error saving quality analysis:', qualityError)
      } else {
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
    }

    // Build response with enhanced metadata - ALWAYS include both takeoff and quality
    // qualityAnalysisData is already defined above and reused here
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
      results: {
        // Always include takeoff items (even if empty)
        items: consensusResult.items || [],
        // Always include quality analysis issues
        issues: consensusResult.issues || [],
        // Always include quality_analysis object
        quality_analysis: qualityAnalysisData,
        // Additional metadata
        specializedInsights: consensusResult.specializedInsights || [],
        recommendations: consensusResult.recommendations || []
      },
      metadata: {
        totalModels: consensusResult.consensusCount,
        processingTimeMs: processingTime,
        imagesAnalyzed: images.length,
        consensusScore: consensusResult.confidence,
        disagreementsCount: consensusResult.disagreements?.length || 0,
        recommendationsCount: consensusResult.recommendations?.length || 0,
        itemsCount: consensusResult.items?.length || 0,
        issuesCount: consensusResult.issues?.length || 0
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
- ALWAYS return BOTH takeoff data AND quality analysis, even if one section has limited data

RESPONSE FORMAT - YOU MUST RETURN BOTH SECTIONS:
Return ONLY a valid JSON object with this EXACT structure. Both "items" and "quality_analysis" are REQUIRED:
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
      "pageNumber": 1,
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
  "quality_analysis": {
    "completeness": {
      "overall_score": 0.85,
      "missing_sheets": [],
      "missing_dimensions": [],
      "missing_details": [],
      "incomplete_sections": [],
      "notes": "Assessment of plan completeness"
    },
    "consistency": {
      "scale_mismatches": [],
      "unit_conflicts": [],
      "dimension_contradictions": [],
      "schedule_vs_elevation_conflicts": [],
      "notes": "Assessment of consistency across sheets"
    },
    "risk_flags": [
      {
        "level": "high|medium|low",
        "category": "Risk category",
        "description": "Risk description",
        "location": "Where this risk appears",
        "recommendation": "How to mitigate"
      }
    ],
    "audit_trail": {
      "pages_analyzed": [1, 2, 3],
      "chunks_processed": 1,
      "coverage_percentage": 100,
      "assumptions_made": [
        {
          "item": "Item or measurement",
          "assumption": "What was assumed",
          "reason": "Why assumption was needed"
        }
      ]
    }
  },
  "summary": {
    "total_items": 0,
    "categories": {},
    "subcategories": {},
    "total_area_sf": 0,
    "plan_scale": "detected scale",
    "confidence": "high|medium|low",
    "notes": "Overall observations"
  }
}

MANDATORY REQUIREMENTS:
1. "items" array: MUST contain all measurable quantities, even if empty array with note in summary
2. "quality_analysis" object: MUST be fully populated with all sub-objects (completeness, consistency, risk_flags, audit_trail)
3. If information is missing, explicitly mark it in the appropriate quality_analysis field (e.g., missing_sheets, missing_dimensions)
4. Never return partial structures - always include all top-level fields`

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
      return basePrompt + jobTypePrompt + generateTemplateInstructions() + `

TAKEOFF ANALYSIS FOCUS (REQUIRED SECTION):
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

BE THOROUGH: Extract every measurable element visible in the plan - you MUST extract MULTIPLE items per page
EXPECTED COVERAGE: For a 19-page plan, expect 5-15 items per page minimum
BE SPECIFIC: "2x6 Top Plate" not just "lumber"
SHOW YOUR MATH: Include dimensions used for calculations
USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
ASSIGN SUBCATEGORIES: Every item must have a subcategory
ASSIGN COST CODES: Use the Procore cost codes provided
INCLUDE LOCATIONS: Specify where each item is located
PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
INCLUDE PRICING: Every item must have a realistic unit_cost

EXTRACT COMPREHENSIVELY:
- Count ALL doors, windows, fixtures, outlets, switches visible
- Measure ALL walls, floors, roofs, foundations
- Quantify ALL materials: lumber, concrete, drywall, insulation, roofing, siding
- Include ALL mechanical: HVAC equipment, plumbing fixtures, electrical components
- List ALL finishes: paint, flooring, cabinets, countertops, appliances
- Calculate areas, volumes, lengths for EVERY measurable element

DO NOT SKIP: Even if an item appears simple or small, include it. Better to over-extract than under-extract.

QUALITY ANALYSIS FOCUS (REQUIRED SECTION):
You MUST also provide a complete quality_analysis object with:
1. COMPLETENESS: Assess what's missing, incomplete, or unclear
   - missing_sheets: List any sheet numbers not found or referenced but missing
   - missing_dimensions: List items that need dimensions but don't have them
   - missing_details: List any details that should be present but aren't
   - incomplete_sections: Identify partial or incomplete drawings
   
2. CONSISTENCY: Check for conflicts and contradictions
   - scale_mismatches: Different scales used inconsistently
   - unit_conflicts: Mixed units (feet vs meters) causing confusion
   - dimension_contradictions: Same element has different dimensions in different views
   - schedule_vs_elevation_conflicts: Door/window schedules don't match elevations
   
3. RISK_FLAGS: Identify potential problems
   - Safety hazards, code violations, structural concerns
   - Budget risks (overly complex details)
   - Timeline risks (missing information that will cause delays)
   - Quality risks (unclear specifications)
   
4. AUDIT_TRAIL: Document what was analyzed
   - pages_analyzed: Array of page numbers you examined
   - chunks_processed: Number of distinct sections analyzed
   - coverage_percentage: What % of the plan set you believe you've covered
   - assumptions_made: List every assumption you made, with reason

CRITICAL: Even if the plan is unclear or incomplete, you MUST still populate all quality_analysis fields. Use them to document what's missing or unclear.`

    case 'quality':
      return basePrompt + jobTypePrompt + `

QUALITY ANALYSIS FOCUS (BE AGGRESSIVE - FIND ISSUES):
You MUST find and report issues. Even if the plan looks good, there are ALWAYS things to check:
- Missing dimensions or unclear measurements
- Code compliance concerns (egress, accessibility, structural requirements)
- Inconsistencies between sheets or details
- Potential construction challenges
- Safety or quality concerns
- Missing or incomplete details

MANDATORY CHECKS - You MUST verify:
1. ALL dimensions are provided and consistent across sheets
2. Door/window schedules match elevations
3. Code compliance (egress, guardrails, stairs, accessibility)
4. Structural details are complete and clear
5. MEP systems are properly detailed
6. No contradictions between plans
7. All referenced details exist
8. Scale is consistent across sheets
9. Material specifications are clear
10. Finish schedules are complete

IF YOU FIND 0 ISSUES, that means you didn't look hard enough. Every plan has:
- At least some missing dimensions
- Some unclear details
- Potential code compliance questions
- Areas that need clarification

SEVERITY LEVELS:
- CRITICAL: Safety hazards, code violations, structural issues that could cause injury or failure
- WARNING: Quality concerns, potential problems, unclear details that could cause delays/cost overruns
- INFO: Recommendations, best practices, minor observations that improve quality

BE AGGRESSIVE: Look for problems. Question everything. If something is unclear, it's an issue.
BE THOROUGH: Examine every detail for potential issues - dimension checks, code compliance, consistency
BE SPECIFIC: Provide detailed descriptions of problems with exact locations
INCLUDE IMPACT: Explain the impact of each issue (cost, timeline, safety, quality)
PROVIDE SOLUTIONS: Give specific recommendations for each issue
ASSIGN SEVERITY: Use appropriate severity levels - when in doubt, mark as WARNING
INCLUDE LOCATIONS: Specify exactly where each issue is located (sheet number, detail reference)
PROVIDE BOUNDING BOXES: Every issue must have a bounding_box with coordinates

EXPECTED ISSUE COUNT:
- For a 5-page plan: 5-15 issues minimum
- For a 19-page plan: 15-40 issues minimum
- If you find fewer, you're not looking hard enough

Common issues to look for:
- Missing dimensions on plans
- Door/window schedules don't match elevations
- Stair dimensions don't meet code
- Guardrail heights missing or unclear
- Egress routes unclear or non-compliant
- Scale inconsistencies
- Structural details incomplete
- MEP systems lack detail
- Material specifications vague
- Finish schedules incomplete
- Details referenced but not shown`

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
  let prompt = `Analyze this construction plan with ${imageCount} page${imageCount > 1 ? 's' : ''} for COMPREHENSIVE construction analysis.

IMAGES PROVIDED: ${imageCount} page${imageCount > 1 ? 's' : ''} of construction plans
ANALYSIS REQUIRED: BOTH complete takeoff (all quantities) AND complete quality analysis

${extractedText && extractedText.length > 0 ? `=== EXTRACTED TEXT FROM PDF (truncated) ===
${extractedText.slice(0, 8000)}${extractedText.length > 8000 ? '\n\n...(additional text truncated)' : ''}

=== VISUAL ANALYSIS INSTRUCTIONS ===` : ''}

MANDATORY INSTRUCTIONS - YOU MUST PROVIDE BOTH:

TEMPLATE-BASED ANALYSIS:
You have been provided with a COMPREHENSIVE TAKEOFF TEMPLATE in the system prompt. You MUST:
1. Go through EVERY category in the template (structural, exterior, interior, mep, finishes, other)
2. For each subcategory, check if items exist in the plan
3. Extract ALL items you find - don't skip any category
4. If a category doesn't apply, document why in quality_analysis.completeness
5. If you're uncertain about an item, include it with low confidence (<0.6) but still include it

MULTI-MODEL STRATEGY:
- Your job is to find items OTHER models might miss
- Extract comprehensively - better to over-extract than under-extract
- Each model should find DIFFERENT items - we'll aggregate all findings
- Cross-validate against template to ensure nothing is missed

TAKEOFF REQUIREMENTS:
1. Examine EVERY dimension, measurement, and annotation visible in the plan
2. Calculate quantities based on visible dimensions and scale
3. Identify all construction materials, fixtures, and components
4. Use standard construction estimating practices
5. Cross-reference dimensions to ensure accuracy
6. Assign appropriate Procore cost codes to each item
7. Include realistic unit_cost pricing for every item

CRITICAL: You must extract MULTIPLE items per page. A single page typically contains:
- Multiple wall sections (exterior, interior, different materials)
- Multiple door/window openings
- Multiple electrical outlets/switches/fixtures
- Flooring areas by room/section
- Multiple material layers (foundation, framing, insulation, finishes)
- Multiple plumbing fixtures
- Multiple HVAC components

For 5 pages of a 19-page plan, you should extract AT LEAST 20-50 total items, not just 2-3.

QUALITY ANALYSIS REQUIREMENTS:
8. Assess completeness - what's missing or incomplete?
9. Check consistency - any conflicts or contradictions?
10. Identify risk flags - safety, code, quality concerns
11. Document audit trail - what was analyzed, what assumptions were made

IMPORTANT:
- Be SPECIFIC: "2x6 Top Plate" not just "lumber"
- SHOW YOUR MATH: Include dimensions used for calculations
- USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
- BE THOROUGH: Extract every measurable element visible in the plan
- ASSIGN SUBCATEGORIES: Every item must have a subcategory
- ASSIGN COST CODES: Use the Procore cost codes provided
- INCLUDE LOCATIONS: Specify where each item is located
- PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
- If dimensions are unclear or not visible, state "dimension not visible" in notes AND add to quality_analysis.completeness.missing_dimensions

QUALITY ANALYSIS REQUIREMENTS - POPULATE ALL FIELDS:
- completeness: Assess what's missing (sheets, dimensions, details, sections)
- consistency: Check for conflicts (scales, units, dimensions, schedules)
- risk_flags: Identify potential problems (safety, code, budget, timeline, quality)
- audit_trail: Document coverage (pages analyzed, chunks, coverage %, assumptions)

CRITICAL RESPONSE REQUIREMENTS:
1. You MUST respond with ONLY the JSON object - no explanatory text
2. The JSON MUST include both "items" array AND "quality_analysis" object
3. If you cannot find certain information, document it in quality_analysis.completeness
4. If there are contradictions, document them in quality_analysis.consistency
5. Every assumption you make MUST be listed in quality_analysis.audit_trail.assumptions_made
6. Even if the plan is unclear, return the full structure with empty arrays/objects where appropriate, but always populate quality_analysis fields to explain what's missing

DO NOT:
- Return partial results
- Skip the quality_analysis section
- Omit fields because they're empty (use empty arrays/objects)
- Include any text outside the JSON object`

  if (drawings && drawings.length > 0) {
    prompt += `\n\nUSER ANNOTATIONS: ${drawings.length} user annotation${drawings.length > 1 ? 's' : ''} included for reference - pay special attention to these marked areas`
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

/**
 * Run orchestrator-based analysis using chunks if available
 * TEMPORARILY DISABLED - returns null to fall back to standard analysis
 */
async function runOrchestratorAnalysis(
  supabase: any,
  planId: string,
  userId: string,
  jobType: string,
  taskType: TaskType
): Promise<any | null> {
  // Orchestrator temporarily disabled - will re-enable when model-orchestrator is ready
  return null
  
  /* ORCHESTRATOR CODE (DISABLED - TO BE RE-ENABLED LATER)
  
    // Load plan metadata
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .single()

    if (planError || !plan) {
      console.warn('Plan not found for orchestrator')
      return null
    }

    // Load chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('plan_chunks')
      .select('*')
      .eq('plan_id', planId)
      .order('chunk_index', { ascending: true })

    if (chunksError || !chunks || chunks.length === 0) {
      console.warn('No chunks found for orchestrator, falling back to standard analysis')
      return null
    }

    // Load sheet index
    const { data: sheetIndex, error: sheetError } = await supabase
      .from('plan_sheet_index')
      .select('*')
      .eq('plan_id', planId)
      .order('page_no', { ascending: true })

    if (sheetError) {
      console.warn('Sheet index load failed:', sheetError)
    }

    // Build normalized inputs
    const projectMeta: ProjectMeta = {
      plan_id: planId,
      project_name: plan.project_name,
      project_location: plan.project_location,
      plan_title: plan.title,
      job_id: plan.job_id || null,
      plan_file_name: plan.file_name,
      total_pages: plan.num_pages || chunks.length,
      plan_upload_date: plan.created_at,
      detected_projects: [],
      detected_addresses: []
    }

    const normalizedInput = {
      project_meta: projectMeta,
      sheet_index: (sheetIndex || []) as SheetIndex[],
      chunks: chunks.map((c: any) => ({
        chunk_id: c.chunk_id,
        plan_id: c.plan_id,
        chunk_index: c.chunk_index,
        page_range: c.page_range,
        sheet_index_subset: c.sheet_index_subset || [],
        content: {
          text: c.content?.text || '',
          text_token_count: c.content?.text_token_count || 0,
          image_urls: c.content?.image_urls || [],
          image_count: c.content?.image_count || 0
        },
        metadata: c.metadata || {},
        safeguards: c.safeguards || {}
      })) as Chunk[]
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(taskType, jobType)

    // Run orchestrator (disabled - uncomment when model-orchestrator is ready)
    // console.log(`🚀 Running orchestrator with ${normalizedInput.chunks.length} chunks`)
    // const result = await modelOrchestrator.orchestrate(
    //   normalizedInput,
    //   systemPrompt,
    //   taskType
    // )
    throw new Error('Orchestrator is temporarily disabled - use standard analysis instead')

    // Convert to response format compatible with existing API
    const processingTime = result.final_json.metadata.processing_time_ms

    // Save results
    const takeoffAnalysisData = {
      plan_id: planId,
      user_id: userId,
      items: result.final_json.items,
      summary: {
        total_items: result.final_json.items.length,
        confidence: result.final_json.metadata.confidence_overall,
        consensus_count: result.final_json.metadata.models_used.length,
        model_agreements: result.final_json.metadata.models_used,
        disagreements: result.consensus_report.disagreements_count,
        engine_recommendation: result.engine_recommendation,
        quality_analysis: result.final_json.quality_analysis
      },
      ai_model: 'orchestrator-consensus',
      confidence_scores: {
        consensus: result.final_json.metadata.confidence_overall,
        model_count: result.final_json.metadata.models_used.length,
        disagreements: result.final_json.metadata.total_disagreements,
        resolved: result.final_json.metadata.resolved_disagreements
      },
      processing_time_ms: processingTime,
      job_type: jobType
    }

    const { data: takeoffAnalysis, error: takeoffError } = await supabase
      .from('plan_takeoff_analysis')
      .insert(takeoffAnalysisData)
      .select()
      .single()

    if (takeoffError) {
      console.error('Error saving orchestrator takeoff analysis:', takeoffError)
    } else {
      await supabase
        .from('plans')
        .update({
          takeoff_analysis_status: 'completed',
          has_takeoff_analysis: true
        })
        .eq('id', planId)
        .eq('user_id', userId)
    }

    // Save quality analysis
    const qualityAnalysisData = {
      plan_id: planId,
      user_id: userId,
      overall_score: result.final_json.quality_analysis.completeness.overall_score,
      issues: result.final_json.quality_analysis.risk_flags.map(flag => ({
        severity: flag.level === 'high' ? 'critical' : flag.level === 'medium' ? 'warning' : 'info',
        category: flag.category,
        description: flag.description,
        location: flag.location,
        recommendation: flag.recommendation
      })),
      recommendations: result.engine_recommendation.recommendation_details.split('. ').filter(r => r.trim()),
      missing_details: result.final_json.quality_analysis.completeness.missing_details,
      findings_by_category: {},
      findings_by_severity: {
        critical: result.final_json.quality_analysis.risk_flags.filter(f => f.level === 'high'),
        warning: result.final_json.quality_analysis.risk_flags.filter(f => f.level === 'medium'),
        info: result.final_json.quality_analysis.risk_flags.filter(f => f.level === 'low')
      },
      ai_model: 'orchestrator-consensus',
      processing_time_ms: processingTime,
      job_type: jobType
    }

    const { data: qualityAnalysis, error: qualityError } = await supabase
      .from('plan_quality_analysis')
      .insert(qualityAnalysisData)
      .select()
      .single()

    if (qualityError) {
      console.error('Error saving orchestrator quality analysis:', qualityError)
    } else {
      await supabase
        .from('plans')
        .update({
          quality_analysis_status: 'completed',
          has_quality_analysis: true
        })
        .eq('id', planId)
        .eq('user_id', userId)
    }

    // Build response with detailed orchestrator info
    return {
      success: true,
      planId,
      taskType,
      processingTime,
      orchestrator: true,
      orchestrator_enabled: 'auto-detected', // Show that it was auto-enabled
      consensus: {
        confidence: result.final_json.metadata.confidence_overall,
        consensusCount: result.final_json.metadata.models_used.length,
        disagreements: result.final_json.metadata.total_disagreements,
        resolved: result.final_json.metadata.resolved_disagreements,
        modelAgreements: result.final_json.metadata.models_used
      },
      consensus_report: result.consensus_report,
      engine_recommendation: {
        recommended_model: result.engine_recommendation.recommended_model,
        reasoning: result.engine_recommendation.reasoning,
        confidence: result.engine_recommendation.confidence,
        performance_metrics: result.engine_recommendation.performance_metrics
      },
      results: taskType === 'takeoff'
        ? {
            items: result.final_json.items,
            specializedInsights: [],
            recommendations: result.engine_recommendation.recommendation_details.split('. ').filter(r => r.trim())
          }
        : {
            issues: qualityAnalysisData.issues,
            specializedInsights: [],
            recommendations: qualityAnalysisData.recommendations
          },
      metadata: {
        totalModels: result.final_json.metadata.models_used.length,
        processingTimeMs: processingTime,
        imagesAnalyzed: 0, // Chunks don't use images in the same way
        consensusScore: result.final_json.metadata.confidence_overall,
        disagreementsCount: result.final_json.metadata.total_disagreements,
        recommendationsCount: result.engine_recommendation.recommendation_details.split('. ').length,
        chunksProcessed: normalizedInput.chunks.length,
        analysisType: 'orchestrator_multi_model'
      },
      conflicts: {
        unresolved: result.final_json.conflicts.unresolved,
        resolved: result.final_json.conflicts.resolved.length
      },
      // Add summary for easy viewing in UI
      orchestrator_summary: {
        models_tested: result.final_json.metadata.models_used.length,
        successful_models: result.consensus_report.model_performance ? Object.keys(result.consensus_report.model_performance).length : 0,
        total_items: result.final_json.items.length,
        disagreements: result.final_json.metadata.total_disagreements,
        resolved_disagreements: result.final_json.metadata.resolved_disagreements,
        confidence: result.final_json.metadata.confidence_overall,
        engine_recommendation: result.engine_recommendation.recommended_model || 'hybrid',
        chunks_used: normalizedInput.chunks.length
      }
    }
  } catch (error) {
    console.error('Orchestrator analysis error:', error)
    throw error
  }
  */
}
