import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// DEPRECATED: This endpoint is deprecated. Use /api/plan/analyze-enhanced instead.
// This endpoint will be removed in a future version.

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

    // Redirect to enhanced endpoint
    console.warn('DEPRECATED: /api/plan/analyze-multi-quality is deprecated. Use /api/plan/analyze-enhanced instead.')
    
    // Forward the request to the enhanced endpoint
    const enhancedResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plan/analyze-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        images,
        taskType: 'quality',
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
      overall_score: enhancedData.results?.overall_score || 0,
      issues: enhancedData.results?.issues || [],
      missing_details: enhancedData.results?.missing_details || [],
      recommendations: enhancedData.results?.recommendations || [],
      findings_by_category: enhancedData.results?.findings_by_category || {},
      findings_by_severity: enhancedData.results?.findings_by_severity || {}
    })

  } catch (error) {
    console.error('Multi-provider quality analysis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}