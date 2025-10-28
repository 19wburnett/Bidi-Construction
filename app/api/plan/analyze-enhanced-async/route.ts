import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Async Analysis Trigger API
// This endpoint creates a pending analysis record and triggers background processing

export async function POST(request: NextRequest) {
  let planId: string | undefined
  let userId: string | undefined

  try {
    const { planId: requestPlanId, taskType = 'takeoff', jobType } = await request.json()
    planId = requestPlanId

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      )
    }

    if (!['takeoff', 'quality'].includes(taskType)) {
      return NextResponse.json(
        { error: 'Task type must be either "takeoff" or "quality"' },
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

    // Create pending analysis record
    const analysisData = {
      plan_id: planId,
      user_id: userId,
      status: 'pending',
      job_type: finalJobType,
      started_at: new Date().toISOString()
    }

    let analysisId: string
    if (taskType === 'takeoff') {
      const { data: analysis, error: analysisError } = await supabase
        .from('plan_takeoff_analysis')
        .insert({
          ...analysisData,
          items: [],
          summary: { total_items: 0, notes: 'Analysis pending' },
          ai_model: 'enhanced-consensus-async',
          confidence_scores: {},
          processing_time_ms: 0
        })
        .select('id')
        .single()

      if (analysisError) {
        throw analysisError
      }
      analysisId = analysis.id
    } else {
      const { data: analysis, error: analysisError } = await supabase
        .from('plan_quality_analysis')
        .insert({
          ...analysisData,
          overall_score: 0,
          issues: [],
          missing_details: [],
          recommendations: [],
          findings_by_category: {},
          findings_by_severity: { critical: [], warning: [], info: [] },
          ai_model: 'enhanced-consensus-async',
          processing_time_ms: 0
        })
        .select('id')
        .single()

      if (analysisError) {
        throw analysisError
      }
      analysisId = analysis.id
    }

    // Trigger background processing (in a real implementation, this would be a queue job)
    // For now, we'll simulate async processing by calling the enhanced endpoint
    // In production, this should be handled by a background job processor
    processAnalysisAsync(planId, analysisId, taskType, finalJobType, userId)

    return NextResponse.json({
      success: true,
      analysisId,
      status: 'pending',
      message: 'Analysis started in background'
    })

  } catch (error) {
    console.error('Async analysis trigger error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to start async analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Background processing function (simulated async)
async function processAnalysisAsync(
  planId: string, 
  analysisId: string, 
  taskType: string, 
  jobType: string, 
  userId: string
) {
  try {
    // Update status to processing
    const supabase = await createServerSupabaseClient()
    
    const updateData = {
      status: 'processing',
      started_at: new Date().toISOString()
    }

    if (taskType === 'takeoff') {
      await supabase
        .from('plan_takeoff_analysis')
        .update(updateData)
        .eq('id', analysisId)
    } else {
      await supabase
        .from('plan_quality_analysis')
        .update(updateData)
        .eq('id', analysisId)
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Call the enhanced analysis endpoint
    const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plan/analyze-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        taskType,
        jobType,
        // Note: In a real implementation, you'd need to pass images here
        // This is a simplified version for demonstration
        images: [], // This would need to be populated from the plan
        drawings: []
      })
    })

    if (!analysisResponse.ok) {
      throw new Error('Analysis failed')
    }

    const analysisData = await analysisResponse.json()

    // Update with results
    const completedData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(taskType === 'takeoff' ? {
        items: analysisData.results?.items || [],
        summary: analysisData.results?.summary || {},
        confidence_scores: analysisData.consensus || {}
      } : {
        overall_score: analysisData.results?.overall_score || 0,
        issues: analysisData.results?.issues || [],
        recommendations: analysisData.results?.recommendations || [],
        findings_by_category: analysisData.results?.findings_by_category || {},
        findings_by_severity: analysisData.results?.findings_by_severity || { critical: [], warning: [], info: [] }
      }),
      processing_time_ms: analysisData.processingTime || 0
    }

    if (taskType === 'takeoff') {
      await supabase
        .from('plan_takeoff_analysis')
        .update(completedData)
        .eq('id', analysisId)
    } else {
      await supabase
        .from('plan_quality_analysis')
        .update(completedData)
        .eq('id', analysisId)
    }

    // Update plan status
    await supabase
      .from('plans')
      .update({ 
        [`${taskType}_analysis_status`]: 'completed',
        [`has_${taskType}_analysis`]: true
      })
      .eq('id', planId)
      .eq('user_id', userId)

  } catch (error) {
    console.error('Background analysis processing error:', error)
    
    // Update status to failed
    try {
      const supabase = await createServerSupabaseClient()
      const failedData = {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error'
      }

      if (taskType === 'takeoff') {
        await supabase
          .from('plan_takeoff_analysis')
          .update(failedData)
          .eq('id', analysisId)
      } else {
        await supabase
          .from('plan_quality_analysis')
          .update(failedData)
          .eq('id', analysisId)
      }

      // Update plan status
      await supabase
        .from('plans')
        .update({ [`${taskType}_analysis_status`]: 'failed' })
        .eq('id', planId)
        .eq('user_id', userId)
    } catch (updateError) {
      console.error('Error updating failed status:', updateError)
    }
  }
}
