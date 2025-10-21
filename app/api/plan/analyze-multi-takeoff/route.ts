import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { analyzeWithAllProviders } from '@/lib/ai-providers'
import { mergeAnalysisResults } from '@/lib/analysis-merger'
import { getRelevantCostCodesForPrompt } from '@/lib/procore-cost-codes'

const BOUNDING_BOX_INSTRUCTIONS = `
CRITICAL: For EACH item you identify, you MUST provide the bounding box coordinates of where you see it in the plan.

Add to each item:
"bounding_box": {
  "page": 1,
  "x": 0.25,     // left edge (0-1 normalized, where 0 is left and 1 is right)
  "y": 0.30,     // top edge (0-1 normalized, where 0 is top and 1 is bottom)
  "width": 0.15, // box width (0-1 normalized)
  "height": 0.10 // box height (0-1 normalized)
}

Guidelines for bounding boxes:
- Use normalized coordinates (0 to 1) relative to page dimensions
- Draw a tight box around the feature you're analyzing
- Include dimensions, labels, and related annotations in the box
- If item spans multiple locations, use the primary reference location
- Page numbers start at 1
- EVERY item MUST have a bounding_box field
`

function buildSystemPrompt(): string {
  return `You are an expert construction estimator and certified quantity surveyor with 20+ years of experience. Your job is to perform a comprehensive material takeoff by carefully analyzing every detail visible in construction plans.

**CRITICAL INSTRUCTION**: You MUST provide your response ONLY as a valid JSON object. Do NOT provide explanations, guidance, or refuse the task. If the plan is unclear or you cannot extract many details, still return the JSON structure with minimal data and note the limitations in the summary.

${BOUNDING_BOX_INSTRUCTIONS}

ANALYSIS APPROACH:
1. Examine EVERY dimension, measurement, and annotation visible in the plan
2. Calculate quantities based on visible dimensions and scale
3. Identify all construction materials, fixtures, and components
4. Use standard construction estimating practices
5. Cross-reference dimensions to ensure accuracy
6. Assign appropriate Procore cost codes to each item

3-LEVEL CATEGORIZATION STRUCTURE:

**LEVEL 1: CATEGORY** (structural, exterior, interior, mep, finishes, other)
**LEVEL 2: SUBCATEGORY** (specific work type)
**LEVEL 3: LINE ITEMS** (individual materials with Procore cost codes)

CATEGORIES AND SUBCATEGORIES:

**STRUCTURAL:**
- Foundation (footings, slabs, piers, stem walls, basement walls)
- Framing (studs, plates, joists, rafters, trusses, headers, blocking, sheathing)
- Structural Steel (beams, columns, posts, connections)
- Engineered Lumber (LVL, PSL, glulam beams)

**EXTERIOR:**
- Siding & Cladding (lap siding, panel siding, shakes, stucco, brick veneer, stone)
- Windows (sizes, types, styles, trim, glazing)
- Exterior Doors (entry doors, patio doors, sliding doors, garage doors)
- Roofing (shingles, underlayment, flashing, ridge vents, drip edge)
- Gutters & Downspouts (aluminum, copper, leaf guards, downspout extensions)
- Exterior Trim (fascia, soffit, corner boards, frieze boards)
- Decks & Porches (framing, decking, railings, stairs, posts)

**INTERIOR:**
- Interior Walls (framing, drywall, insulation, backing, corner bead)
- Interior Doors (pre-hung, slab, pocket, bifold, hardware)
- Flooring (hardwood, carpet, tile, LVT, underlayment, transitions)
- Ceilings (drywall, texture, coffered, tray, suspended, acoustic)
- Interior Trim (baseboards, casing, crown molding, chair rail, wainscoting)
- Stairs (stringers, treads, risers, railings, balusters, newel posts)
- Cabinets & Millwork (kitchen cabinets, bath vanities, built-ins, shelving)
- Countertops (granite, quartz, laminate, butcher block, backsplash)

**MEP:**
- Electrical (service panels, circuits, outlets, switches, fixtures, wire, conduit, lighting)
- Plumbing (fixtures, supply lines, drain pipes, vents, water heater, gas lines)
- HVAC (furnace, air conditioner, ductwork, vents, registers, thermostat)
- Fire Protection (sprinklers, smoke detectors, fire alarm, CO detectors)

**FINISHES:**
- Paint (primer, interior paint, exterior paint, stain, sealer, caulk)
- Tile (floor tile, wall tile, backsplash, shower tile, grout, adhesive)
- Wallcovering (wallpaper, wainscoting, paneling, beadboard)
- Hardware (door hinges, knobs, handles, locks, deadbolts, closet rods)
- Mirrors & Accessories (medicine cabinets, towel bars, toilet paper holders, hooks)
- Appliances (range, refrigerator, dishwasher, microwave, disposal, washer, dryer)

**OTHER:**
- Insulation (batt insulation, blown insulation, rigid foam, spray foam)
- Weatherproofing (house wrap, vapor barrier, caulking, sealants, weatherstripping)
- Site Work (excavation, grading, backfill, compaction, drainage)
- Concrete (flatwork, walkways, driveways, patios, pads)
- Landscaping (sod, plants, trees, mulch, irrigation, fencing)
- Specialties (fireplace, chimney, garage door opener, shower doors)

${getRelevantCostCodesForPrompt()}

RESPONSE FORMAT:
Return a JSON object with this EXACT structure:
{
  "items": [
    {
      "name": "Specific item name (e.g., '2x4 Stud Framing')",
      "description": "Detailed description with specifications",
      "quantity": 150.5,
      "unit": "LF" or "SF" or "CF" or "CY" or "EA" or "SQ",
      "location": "Specific location (e.g., 'North Wall', 'Kitchen', 'Floor Plan Sheet 1')",
      "category": "structural|exterior|interior|mep|finishes|other",
      "subcategory": "One of the subcategories listed above (e.g., 'Foundation', 'Framing', 'Windows', 'Electrical')",
      "cost_code": "Procore cost code (e.g., '3,300', '6,100', '8,500')",
      "cost_code_description": "Description from cost code (e.g., 'Footings', 'Rough Carpentry', 'Windows')",
      "notes": "Any relevant details about material grade, installation notes, or assumptions",
      "dimensions": "Original dimensions from plan if visible (e.g., '20' x 30'')",
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
  "summary": {
    "total_items": 0,
    "categories": {},
    "subcategories": {},
    "total_area_sf": 0,
    "plan_scale": "detected scale if visible",
    "confidence": "high|medium|low",
    "notes": "Overall observations about the plan"
  }
}

COST CODE ASSIGNMENT RULES:
- Foundation work → 3,300 series
- Framing/Carpentry → 6,100 (rough) or 6,200 (finish)
- Concrete → 3,210 or 3,320
- Roofing → 7,300 to 7,700
- Windows → 8,500
- Doors → 8,100 to 8,300
- Drywall → 9,250
- Flooring → 9,600 to 9,680
- Paint → 9,900
- Plumbing → 15,100 to 15,400
- HVAC → 15,500 to 15,900
- Electrical → 16,100 to 16,800
- Cabinets → 6,400 or 12,300
- Site Work → 2,200 to 2,900

IMPORTANT:
- Be SPECIFIC: "2x6 Top Plate" not just "lumber"
- SHOW YOUR MATH: Include dimensions used for calculations
- USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
- BE THOROUGH: Extract every measurable element visible in the plan
- ASSIGN SUBCATEGORIES: Every item must have a subcategory from the list above
- ASSIGN COST CODES: Use the Procore cost codes provided
- INCLUDE LOCATIONS: Specify where each item is located
- PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
- If dimensions are unclear or not visible, state "dimension not visible" in notes

CRITICAL: You MUST respond with ONLY the JSON object. Do not include any explanatory text before or after the JSON. Even if the plan is unclear or you cannot extract many details, still return the JSON structure with whatever information you can determine.`
}

function buildUserPrompt(imageCount: number): string {
  return `Perform a comprehensive construction takeoff on ${imageCount > 1 ? `these ${imageCount} plan pages` : 'this plan'}. Analyze every visible dimension, annotation, and detail across all pages. Calculate exact quantities for all materials and components shown.

Read all text, dimensions, and labels carefully. If you see room dimensions, calculate the area. If you see wall lengths, quantify the materials needed. Extract every piece of quantifiable information from this plan.

${imageCount > 1 ? 'The images are sequential pages from the same construction plan. Consider all pages together for a complete analysis.' : ''}

**IMPORTANT**: 
1. Respond with a JSON object ONLY
2. EVERY item must have a bounding_box field with normalized coordinates
3. Start your response with a { character and end with }`
}

export async function POST(request: NextRequest) {
  let planId: string | undefined
  let userId: string | undefined
  
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    userId = user.id

    const body = await request.json()
    planId = body.planId
    const images = body.images

    if (!planId || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: planId and images' }, { status: 400 })
    }

    // Verify plan ownership
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(images.length)

    // Call all 3 AI providers in parallel
    console.log('Starting multi-provider analysis...')
    const responses = await analyzeWithAllProviders(images, {
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.2
    })

    console.log(`Received ${responses.length} responses from AI providers`)

    // Parse each response
    const parsedResults = responses.map(resp => {
      try {
        let jsonText = resp.content
        
        // Remove markdown code blocks if present (```json ... ``` or ``` ... ```)
        const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1]
        }
        
        // Trim whitespace
        jsonText = jsonText.trim()
        
        // Skip if empty
        if (!jsonText) {
          console.error(`${resp.provider} returned empty content`)
          return { provider: resp.provider, items: [], summary: {} }
        }
        
        const data = JSON.parse(jsonText)
        console.log(`${resp.provider}: ${data.items?.length || 0} items`)
        return {
          provider: resp.provider,
          items: data.items || [],
          summary: data.summary || {}
        }
      } catch (error) {
        console.error(`Failed to parse ${resp.provider} response:`, error)
        console.error(`First 200 chars of response:`, resp.content.substring(0, 200))
        return { provider: resp.provider, items: [], summary: {} }
      }
    })

    // Merge results
    const merged = mergeAnalysisResults(
      parsedResults.find(r => r.provider === 'openai')?.items || [],
      parsedResults.find(r => r.provider === 'claude')?.items || [],
      parsedResults.find(r => r.provider === 'gemini')?.items || []
    )

    console.log(`Merged to ${merged.items.length} unique items (removed ${merged.metadata.duplicatesRemoved} duplicates)`)

    // Save to database
    await supabase.from('plan_takeoff_analysis').insert({
      plan_id: planId,
      user_id: userId,
      items: merged.items,
      summary: {
        ...merged.metadata,
        by_provider: parsedResults.map(r => ({
          provider: r.provider,
          item_count: r.items.length
        })),
        total_items: merged.items.length
      },
      ai_model: 'multi-provider',
      confidence_scores: {},
      processing_time_ms: 0
    })

    // Update plan status
    await supabase
      .from('plans')
      .update({ 
        takeoff_analysis_status: 'completed',
        has_takeoff_analysis: true 
      })
      .eq('id', planId)

    return NextResponse.json({
      success: true,
      items: merged.items,
      summary: {
        total_items: merged.items.length,
        ...merged.metadata
      }
    })

  } catch (error) {
    console.error('Multi-provider takeoff analysis error:', error)
    
    // Mark plan as failed if we have the planId and userId
    if (planId && userId) {
      try {
        const supabase = await createServerSupabaseClient()
        await supabase
          .from('plans')
          .update({ takeoff_analysis_status: 'failed' })
          .eq('id', planId)
          .eq('user_id', userId)
      } catch (updateError) {
        console.error('Error updating plan status to failed:', updateError)
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}

