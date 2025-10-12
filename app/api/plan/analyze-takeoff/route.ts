import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId, images, drawings } = await request.json()

    if (!planId || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: planId and images' }, { status: 400 })
    }

    // Verify plan ownership
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
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

WHAT TO EXTRACT AND QUANTIFY:

**STRUCTURAL:**
- Foundation (concrete footings, slabs - calculate cubic yards)
- Framing lumber (studs, plates, joists, rafters - count and measure linear feet)
- Structural steel or beams (sizes and linear feet)
- Columns and posts

**EXTERIOR:**
- Wall area (square feet for siding/cladding)
- Windows (count, sizes, types)
- Doors (count, sizes, types)
- Roofing area (square feet or squares)
- Gutters and downspouts (linear feet)

**INTERIOR:**
- Room dimensions and square footage
- Interior walls (linear feet for framing, square feet for drywall)
- Flooring by room (square feet, by type)
- Ceiling area (square feet)
- Interior doors (count and sizes)
- Trim and molding (linear feet)

**MEP (if visible):**
- Electrical outlets and switches (count by room)
- Light fixtures (count and types)
- Plumbing fixtures (count: sinks, toilets, tubs, etc.)
- HVAC vents and registers (count)

**OTHER:**
- Cabinets (linear feet or count)
- Countertops (linear feet or square feet)
- Tile areas (square feet)
- Paint coverage (square feet by surface type)
- Hardware and accessories

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
      "notes": "Any relevant details about material grade, installation notes, or assumptions",
      "dimensions": "Original dimensions from plan if visible (e.g., '20\' x 30\'')"
    }
  ],
  "summary": {
    "total_items": 0,
    "categories": {},
    "total_area_sf": 0,
    "plan_scale": "detected scale if visible",
    "confidence": "high|medium|low",
    "notes": "Overall observations about the plan"
  }
}

IMPORTANT:
- Be SPECIFIC: "2x6 Top Plate" not just "lumber"
- SHOW YOUR MATH: Include dimensions used for calculations
- USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
- BE THOROUGH: Extract every measurable element visible in the plan
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
        plan_id: planId,
        user_id: user.id,
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

    return NextResponse.json({
      success: true,
      items: takeoffData.items || [],
      summary: takeoffData.summary || takeoffData,
      analysisId: analysis?.id
    })

  } catch (error) {
    console.error('Takeoff analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}

