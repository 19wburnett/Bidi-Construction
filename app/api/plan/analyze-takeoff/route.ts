import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { aiGateway } from '@/lib/ai-gateway-provider'
import { buildTakeoffSystemPrompt, buildTakeoffUserPrompt } from '@/lib/takeoff-prompts'
import { CostCodeStandard } from '@/lib/cost-code-helpers'

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
      .select('user_id, project_type')
      .eq('id', plan.job_id)
      .single()
    
    if (!jobMember && job?.user_id !== userId) {
      return NextResponse.json({ error: 'Plan not found or access denied' }, { status: 404 })
    }

    // Get user's cost code preference
    const { data: userData } = await supabase
      .from('users')
      .select('preferred_cost_code_standard')
      .eq('id', userId)
      .single()
    
    const costCodeStandard: CostCodeStandard = (userData?.preferred_cost_code_standard as CostCodeStandard) || 'csi-16'

    // Build content array with all images
    const imageContent: any[] = images.map((imageData: string) => ({
      type: 'image_url',
      image_url: {
        url: imageData, // Base64 data URL
        detail: 'high'
      }
    }))

    // Use AI Gateway to analyze the plan for takeoff
    const response = await aiGateway.generate({
      model: 'gpt-4o',
      system: buildTakeoffSystemPrompt('takeoff', job?.project_type?.toLowerCase() || 'residential', costCodeStandard),
      prompt: buildTakeoffUserPrompt(images.length, undefined, undefined, undefined, drawings, costCodeStandard),
      images: images,
      maxTokens: 4096,
      temperature: 0.2, // Very low temperature for precise, consistent analysis
      responseFormat: { type: "json_object" } // Force JSON output
    })

    const aiContent = response.content
    if (!aiContent) {
      throw new Error('No response from AI Gateway')
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
        plan_id: planId,
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
