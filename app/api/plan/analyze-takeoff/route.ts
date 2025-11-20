import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'
import { getRelevantCostCodesForPrompt } from '@/lib/procore-cost-codes'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

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
    const drawings = body.drawings

    if (!planId || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: planId and images' }, { status: 400 })
    }

    // Verify plan access via job membership
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*, job_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    
    // Verify user has access to the job
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('job_id')
      .eq('job_id', plan.job_id)
      .eq('user_id', userId)
      .single()
    
    const { data: job } = await supabase
      .from('jobs')
      .select('user_id')
      .eq('id', plan.job_id)
      .single()
    
    if (!jobMember && job?.user_id !== userId) {
      return NextResponse.json({ error: 'Plan not found or access denied' }, { status: 404 })
    }

    // Build content array with all images
    const imageContent: any[] = images.map((imageData: string) => ({
      type: 'image_url',
      image_url: {
        url: imageData, // Base64 data URL
        detail: 'high'
      }
    }))

    // Use OpenAI Vision API to analyze the plan for takeoff
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert construction estimator and certified quantity surveyor with 20+ years of experience. Your job is to perform a comprehensive material takeoff by carefully analyzing every detail visible in construction plans.

**CRITICAL INSTRUCTION**: You MUST provide your response ONLY as a valid JSON object. Do NOT provide explanations, guidance, or refuse the task. If the plan is unclear or you cannot extract many details, still return the JSON structure with minimal data and note the limitations in the summary.

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
      "dimensions": "Original dimensions from plan if visible (e.g., '20\' x 30\'')"
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
- If dimensions are unclear or not visible, state "dimension not visible" in notes

CRITICAL: You MUST respond with ONLY the JSON object. Do not include any explanatory text before or after the JSON. Even if the plan is unclear or you cannot extract many details, still return the JSON structure with whatever information you can determine. If you truly cannot analyze the plan, return:
{
  "items": [],
  "summary": {
    "total_items": 0,
    "notes": "Unable to extract measurable details from this plan. The image may be too low resolution, unclear, or not contain construction details.",
    "confidence": "low"
  }
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Perform a comprehensive construction takeoff on ${images.length > 1 ? `these ${images.length} plan pages` : 'this plan'}. Analyze every visible dimension, annotation, and detail across all pages. Calculate exact quantities for all materials and components shown.

${drawings && drawings.length > 0 ? `The user has highlighted ${drawings.length} specific area(s) on the plan - pay special attention to these marked regions.` : ''}

Read all text, dimensions, and labels carefully. If you see room dimensions, calculate the area. If you see wall lengths, quantify the materials needed. Extract every piece of quantifiable information from this plan.

${images.length > 1 ? 'The images are sequential pages from the same construction plan. Consider all pages together for a complete analysis.' : ''}

**IMPORTANT**: Respond with a JSON object ONLY. Do not provide guidance or explanations outside the JSON. If the plan is unclear, return the JSON structure with empty items array and a note in the summary explaining the limitation.

Use the JSON structure specified in the system prompt. Start your response with a { character and end with }.`
            },
            ...imageContent
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.2, // Very low temperature for precise, consistent analysis
      response_format: { type: "json_object" } // Force JSON output
    })

    const aiContent = response.choices[0]?.message?.content
    if (!aiContent) {
      throw new Error('No response from AI')
    }

    // Check if AI is refusing or unable to complete the task
    const refusalPatterns = [
      /i'?m unable/i,
      /i cannot/i,
      /i can'?t/i,
      /sorry/i,
      /unfortunately/i,
      /not possible/i,
      /cannot provide/i
    ]
    
    const isRefusal = refusalPatterns.some(pattern => pattern.test(aiContent.substring(0, 200)))
    
    if (isRefusal && !aiContent.includes('{')) {
      // AI refused and didn't provide JSON
      return NextResponse.json({
        error: 'AI_ANALYSIS_FAILED',
        message: 'Unable to analyze this plan. The image may be unclear, too low resolution, or not contain measurable construction details.',
        ai_response: aiContent.substring(0, 500),
        items: [],
        summary: {
          total_items: 0,
          notes: 'Analysis could not be completed',
          confidence: 'low'
        }
      }, { status: 200 }) // Return 200 so client can display the message
    }

    // Parse the AI response
    let takeoffData
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonText = aiContent
      
      // Remove markdown code blocks if present
      const codeBlockMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1]
      } else {
        // Try to find JSON object in the text
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonText = jsonMatch[0]
        }
      }
      
      takeoffData = JSON.parse(jsonText)
      
      // Validate structure
      if (!takeoffData.items) {
        takeoffData.items = []
      }
      if (!takeoffData.summary) {
        takeoffData.summary = {
          total_items: takeoffData.items.length,
          notes: 'Takeoff analysis completed'
        }
      }
      
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      
      // Fallback: Try to extract structured data from text
      const lines = aiContent.split('\n').filter(l => l.trim())
      const items: any[] = []
      
      // Try to parse line-by-line for item patterns
      lines.forEach(line => {
        // Look for patterns like "Item: Quantity Unit"
        const itemMatch = line.match(/^[\-\*]?\s*(.+?):\s*(\d+(?:\.\d+)?)\s*(\w+)/i)
        if (itemMatch) {
          items.push({
            name: itemMatch[1].trim(),
            quantity: parseFloat(itemMatch[2]),
            unit: itemMatch[3],
            category: 'other'
          })
        }
      })
      
      takeoffData = {
        items: items,
        summary: {
          total_items: items.length,
          notes: items.length > 0 ? 'Extracted from text analysis' : 'Unable to parse structured data',
          confidence: 'low'
        },
        raw_response: aiContent
      }
    }

    // Save the analysis to the database
    const { data: analysis, error: analysisError } = await supabase
      .from('plan_takeoff_analysis')
      .insert({
        job_id: plan.job_id,
        items: takeoffData.items || [],
        summary: takeoffData.summary || takeoffData,
        ai_model: 'gpt-4o',
        confidence_scores: takeoffData.confidence_scores || {},
        processing_time_ms: 0
      })
      .select()
      .single()

    if (analysisError) {
      console.error('Error saving analysis:', analysisError)
    }

    // Update plan status to completed
    const { error: planUpdateError } = await supabase
      .from('plans')
      .update({ 
        takeoff_analysis_status: 'completed',
        has_takeoff_analysis: true
      })
      .eq('id', planId)

    if (planUpdateError) {
      console.error('Error updating plan status:', planUpdateError)
    }

    return NextResponse.json({
      success: true,
      items: takeoffData.items || [],
      summary: takeoffData.summary || takeoffData,
      analysisId: analysis?.id
    })

  } catch (error) {
    console.error('Takeoff analysis error:', error)
    
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

