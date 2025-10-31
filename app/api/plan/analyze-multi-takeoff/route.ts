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
      "unit_cost": 2.50,
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

PRICING REQUIREMENTS:
- For each item, you MUST provide a realistic "unit_cost" based on:
  * Material type and grade
  * Typical market rates (as of 2024)
  * Unit of measurement (price per LF, SF, CF, CY, EA, or SQ)
  * Geographic location adjustments (use standard US national average if location not specified)
  * Include both material and labor costs where applicable
- Use realistic industry-standard pricing:
  * Framing lumber (2x4, 2x6): $1.50-$3.00 per LF
  * Concrete: $100-$150 per CY
  * Drywall: $0.50-$1.50 per SF
  * Electrical work: $50-$150 per fixture/outlet
  * Plumbing fixtures: $200-$800 per fixture
  * Windows: $300-$1500 per window depending on size/type
  * Doors: $200-$2000 per door depending on type
  * Flooring: $2-$15 per SF depending on material
  * Paint: $1-$3 per SF
  * Roofing: $300-$600 per SQ (100 SF)
- Research appropriate pricing for each material type and provide accurate unit costs

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
  // DEPRECATED: This endpoint is deprecated. Use /api/plan/analyze-enhanced instead.
  // This endpoint will be removed in a future version.
  
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

    // Redirect to enhanced endpoint
    console.warn('DEPRECATED: /api/plan/analyze-multi-takeoff is deprecated. Use /api/plan/analyze-enhanced instead.')
    
    // Forward the request to the enhanced endpoint
    const enhancedResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plan/analyze-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        images,
        taskType: 'takeoff',
        jobType: 'residential' // Default to residential for backward compatibility
      })
    })

    if (!enhancedResponse.ok) {
      const errorData = await enhancedResponse.json()
      return NextResponse.json({ error: errorData.error || 'Analysis failed' }, { status: enhancedResponse.status })
    }

    const enhancedData = await enhancedResponse.json()
    
    // Transform response to match old format for backward compatibility
    return NextResponse.json({
      success: true,
      items: enhancedData.results?.items || [],
      summary: {
        total_items: enhancedData.results?.items?.length || 0,
        ...enhancedData.results?.summary
      }
    })

  } catch (error) {
    console.error('Multi-provider takeoff analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}

