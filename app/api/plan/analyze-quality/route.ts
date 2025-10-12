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

    const { planId, images } = await request.json()

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

    // Use OpenAI Vision API to analyze plan quality
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert construction plan reviewer and architect. Analyze construction plans for completeness, clarity, and quality to identify issues that could lead to bid uncertainties or construction problems.

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

For each issue found, categorize by:
- **Severity**: critical, warning, or info
- **Category**: structural, electrical, plumbing, HVAC, general, dimensions, specifications
- **Description**: Clear explanation of the issue
- **Location**: Where on the plan (if visible)
- **Impact**: How this affects bidding or construction
- **Recommendation**: Specific action to resolve

Provide an overall quality score (0-1) and structured findings in JSON format.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Please perform a comprehensive quality analysis on ${images.length > 1 ? `these ${images.length} plan pages` : 'this construction plan'}. Identify any missing details, unclear specifications, or issues that could lead to construction problems or bid uncertainties.

${images.length > 1 ? 'The images are sequential pages from the same construction plan. Analyze all pages together for a complete quality assessment.' : ''}`
            },
            ...imageContent
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0.3
    })

    const aiContent = response.choices[0]?.message?.content
    if (!aiContent) {
      throw new Error('No response from AI')
    }

    // Parse the AI response
    let qualityData: any
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        qualityData = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: structure the text response
        qualityData = {
          overall_score: 0.7,
          issues: [],
          missing_details: [],
          recommendations: [],
          raw_response: aiContent
        }
      }
    } catch (parseError) {
      // If parsing fails, create a structured response from the text
      const lines = aiContent.split('\n').filter(l => l.trim())
      qualityData = {
        overall_score: 0.7,
        issues: lines.slice(0, 10).map((line, i) => ({
          id: `issue-${i}`,
          severity: 'warning',
          category: 'general',
          description: line,
          recommendation: 'Review and clarify this aspect of the plan'
        })),
        raw_response: aiContent
      }
    }

    // Ensure overall_score is between 0 and 1
    if (!qualityData.overall_score || qualityData.overall_score > 1) {
      qualityData.overall_score = 0.7
    }

    // Categorize findings
    const findingsByCategory: Record<string, any[]> = {}
    const findingsBySeverity: Record<string, any[]> = {
      critical: [],
      warning: [],
      info: []
    }

    if (qualityData.issues) {
      qualityData.issues.forEach((issue: any) => {
        const category = issue.category || 'general'
        const severity = issue.severity || 'warning'
        
        if (!findingsByCategory[category]) {
          findingsByCategory[category] = []
        }
        findingsByCategory[category].push(issue)
        findingsBySeverity[severity].push(issue)
      })
    }

    // Save the analysis to the database
    const { data: analysis, error: analysisError } = await supabase
      .from('plan_quality_analysis')
      .insert({
        plan_id: planId,
        user_id: user.id,
        overall_score: qualityData.overall_score,
        issues: qualityData.issues || [],
        missing_details: qualityData.missing_details || [],
        recommendations: qualityData.recommendations || [],
        findings_by_category: findingsByCategory,
        findings_by_severity: findingsBySeverity,
        ai_model: 'gpt-4o',
        processing_time_ms: 0
      })
      .select()
      .single()

    if (analysisError) {
      console.error('Error saving analysis:', analysisError)
    }

    return NextResponse.json({
      success: true,
      overall_score: qualityData.overall_score,
      issues: qualityData.issues || [],
      missing_details: qualityData.missing_details || [],
      recommendations: qualityData.recommendations || [],
      findings_by_category: findingsByCategory,
      findings_by_severity: findingsBySeverity,
      analysisId: analysis?.id
    })

  } catch (error) {
    console.error('Quality analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}

