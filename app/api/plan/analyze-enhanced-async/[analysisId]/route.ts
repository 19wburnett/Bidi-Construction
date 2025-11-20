import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Async Analysis Status Polling API
// This endpoint returns the current status and results of an async analysis

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  let userId: string | undefined

  try {
    const { analysisId } = await params

    if (!analysisId) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
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

    // Try to find the analysis in both tables
    const [takeoffResult, qualityResult] = await Promise.all([
      supabase
        .from('plan_takeoff_analysis')
        .select('*')
        .eq('id', analysisId)
        .single(),
      supabase
        .from('plan_quality_analysis')
        .select('*')
        .eq('id', analysisId)
        .eq('user_id', userId)
        .single()
    ])

    const analysis = takeoffResult.data || qualityResult.data
    const analysisError = takeoffResult.error || qualityResult.error

    if (analysisError || !analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      )
    }

    // Determine task type based on which table the analysis was found in
    const taskType = takeoffResult.data ? 'takeoff' : 'quality'

    // Calculate processing time
    const startedAt = analysis.started_at ? new Date(analysis.started_at) : null
    const completedAt = analysis.completed_at ? new Date(analysis.completed_at) : null
    const processingTime = startedAt && completedAt ? 
      completedAt.getTime() - startedAt.getTime() : 
      startedAt ? Date.now() - startedAt.getTime() : 0

    // Build response based on status
    const response: any = {
      analysisId,
      taskType,
      status: analysis.status,
      jobType: analysis.job_type,
      createdAt: analysis.created_at,
      startedAt: analysis.started_at,
      completedAt: analysis.completed_at,
      processingTimeMs: Math.round(processingTime)
    }

    if (analysis.status === 'completed') {
      // Include results for completed analysis
      if (taskType === 'takeoff') {
        response.results = {
          items: analysis.items || [],
          summary: analysis.summary || {},
          confidence: analysis.confidence_scores?.consensus || 0,
          consensusCount: analysis.confidence_scores?.model_count || 0
        }
      } else {
        response.results = {
          overallScore: analysis.overall_score || 0,
          issues: analysis.issues || [],
          recommendations: analysis.recommendations || [],
          findingsByCategory: analysis.findings_by_category || {},
          findingsBySeverity: analysis.findings_by_severity || {}
        }
      }
    } else if (analysis.status === 'failed') {
      response.error = analysis.error_message || 'Analysis failed'
    } else if (analysis.status === 'processing') {
      // Calculate estimated progress based on time elapsed
      const elapsed = startedAt ? Date.now() - startedAt.getTime() : 0
      const estimatedTotal = 30000 // 30 seconds estimated total time
      response.progress = Math.min(Math.round((elapsed / estimatedTotal) * 100), 95)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Async analysis status error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get analysis status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
