import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { analyzeWithAllProviders } from '@/lib/ai-providers'
import { mergeQualityResults } from '@/lib/analysis-merger'

const BOUNDING_BOX_INSTRUCTIONS = `
CRITICAL: For EACH issue you identify, you MUST provide the bounding box coordinates of where you see the problem in the plan.

Add to each issue:
"bounding_box": {
  "page": 1,
  "x": 0.25,     // left edge (0-1 normalized, where 0 is left and 1 is right)
  "y": 0.30,     // top edge (0-1 normalized, where 0 is top and 1 is bottom)
  "width": 0.15, // box width (0-1 normalized)
  "height": 0.10 // box height (0-1 normalized)
}

Guidelines for bounding boxes:
- Use normalized coordinates (0 to 1) relative to page dimensions
- Draw a box around the specific area that has the issue
- Include the problematic detail, missing specification, or unclear notation
- If issue affects multiple areas, use the most critical location
- Page numbers start at 1
- EVERY issue MUST have a bounding_box field
`

function buildSystemPrompt(): string {
  return `You are an expert construction plan reviewer and architect. Analyze construction plans for completeness, clarity, and quality to identify issues that could lead to bid uncertainties or construction problems.

${BOUNDING_BOX_INSTRUCTIONS}

Evaluate the plan across these dimensions:

1. **Clarity & Readability** (0-1 score)
   - Are dimensions clearly marked and legible?
   - Is the scale appropriate and indicated?
   - Are symbols and annotations standard and clear?
   - Is text readable and properly sized?

2. **Completeness** (0-1 score)
   - Are all necessary views included (floor plans, elevations, sections)?
   - Are structural details specified?
   - Are material specifications provided?
   - Are fixture/equipment schedules included?
   - Are electrical/plumbing/HVAC layouts shown?

3. **Detail Level** (0-1 score)
   - Are construction details adequate?
   - Are connection details shown?
   - Are finish specifications provided?
   - Are dimensions comprehensive?

4. **Standards Compliance** (0-1 score)
   - Does the plan follow industry standards?
   - Are building code requirements addressed?
   - Are accessibility requirements noted?
   - Are structural calculations referenced?

For each issue found, provide:

RESPONSE FORMAT (JSON only):
{
  "issues": [
    {
      "id": "unique-id",
      "severity": "critical|warning|info",
      "category": "structural|electrical|plumbing|HVAC|general|dimensions|specifications",
      "description": "Clear explanation of the issue",
      "location": "Where on the plan (e.g., 'Sheet 2, North elevation', 'Foundation plan')",
      "impact": "How this affects bidding or construction",
      "recommendation": "Specific action to resolve",
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
  "overall_score": 0.75,
  "missing_details": [
    "List of things that should be in the plan but are missing"
  ],
  "recommendations": [
    "High-level recommendations for improving the plan"
  ]
}

Severity Definitions:
- **critical**: Will prevent accurate bidding or cause construction delays/errors
- **warning**: May cause confusion or require clarification
- **info**: Good to have but not essential

IMPORTANT:
- Be thorough and specific in identifying issues
- EVERY issue must have a bounding_box field with normalized coordinates
- Provide actionable recommendations
- Consider what subcontractors need to accurately bid
- Flag missing or unclear specifications
- Note any conflicts between different plan sheets
- Respond with ONLY the JSON object, no other text`
}

function buildUserPrompt(imageCount: number): string {
  return `Please perform a comprehensive quality analysis on ${imageCount > 1 ? `these ${imageCount} plan pages` : 'this construction plan'}. Identify any missing details, unclear specifications, or issues that could lead to construction problems or bid uncertainties.

${imageCount > 1 ? 'The images are sequential pages from the same construction plan. Analyze all pages together for a complete quality assessment.' : ''}

**IMPORTANT**:
1. Respond with a JSON object ONLY
2. EVERY issue must have a bounding_box field with normalized coordinates pointing to the problem area
3. Be specific about what's wrong and how to fix it
4. Start your response with a { character and end with }`
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
    console.log('Starting multi-provider quality analysis...')
    const responses = await analyzeWithAllProviders(images, {
      systemPrompt,
      userPrompt,
      maxTokens: 4096,
      temperature: 0.3
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
          return { 
            provider: resp.provider, 
            issues: [], 
            overall_score: 0.7,
            missing_details: [],
            recommendations: []
          }
        }
        
        const data = JSON.parse(jsonText)
        console.log(`${resp.provider}: ${data.issues?.length || 0} issues`)
        return {
          provider: resp.provider,
          issues: data.issues || [],
          overall_score: data.overall_score || 0.7,
          missing_details: data.missing_details || [],
          recommendations: data.recommendations || []
        }
      } catch (error) {
        console.error(`Failed to parse ${resp.provider} response:`, error)
        console.error(`First 200 chars of response:`, resp.content.substring(0, 200))
        return { 
          provider: resp.provider, 
          issues: [], 
          overall_score: 0.7,
          missing_details: [],
          recommendations: []
        }
      }
    })

    // Merge results
    const merged = mergeQualityResults(
      parsedResults.find(r => r.provider === 'openai')?.issues || [],
      parsedResults.find(r => r.provider === 'claude')?.issues || [],
      parsedResults.find(r => r.provider === 'gemini')?.issues || []
    )

    console.log(`Merged to ${merged.issues.length} unique issues (removed ${merged.metadata.duplicatesRemoved} duplicates)`)

    // Combine missing details and recommendations from all providers
    const allMissingDetails = Array.from(new Set(parsedResults.flatMap(r => r.missing_details)))
    const allRecommendations = Array.from(new Set(parsedResults.flatMap(r => r.recommendations)))

    // Calculate overall score as average
    const avgScore = parsedResults.reduce((sum, r) => sum + r.overall_score, 0) / parsedResults.length

    // Categorize findings
    const findingsByCategory: Record<string, any[]> = {}
    const findingsBySeverity: Record<string, any[]> = {
      critical: [],
      warning: [],
      info: []
    }

    merged.issues.forEach((issue) => {
      const category = issue.category || 'general'
      const severity = issue.severity || 'warning'
      
      if (!findingsByCategory[category]) {
        findingsByCategory[category] = []
      }
      findingsByCategory[category].push(issue)
      findingsBySeverity[severity].push(issue)
    })

    // Save to database
    await supabase.from('plan_quality_analysis').insert({
      plan_id: planId,
      user_id: userId,
      overall_score: Math.round(avgScore * 100) / 100,
      issues: merged.issues,
      missing_details: allMissingDetails,
      recommendations: allRecommendations,
      findings_by_category: findingsByCategory,
      findings_by_severity: findingsBySeverity,
      ai_model: 'multi-provider',
      processing_time_ms: 0
    })

    // Update plan status
    await supabase
      .from('plans')
      .update({ 
        quality_analysis_status: 'completed',
        has_quality_analysis: true 
      })
      .eq('id', planId)

    return NextResponse.json({
      success: true,
      overall_score: avgScore,
      issues: merged.issues,
      missing_details: allMissingDetails,
      recommendations: allRecommendations,
      findings_by_category: findingsByCategory,
      findings_by_severity: findingsBySeverity,
      metadata: merged.metadata
    })

  } catch (error) {
    console.error('Multi-provider quality analysis error:', error)
    
    // Mark plan as failed if we have the planId and userId
    if (planId && userId) {
      try {
        const supabase = await createServerSupabaseClient()
        await supabase
          .from('plans')
          .update({ quality_analysis_status: 'failed' })
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

