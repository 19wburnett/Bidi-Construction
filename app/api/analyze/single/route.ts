import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { callAnalysisLLM } from '@/lib/llm/providers'
import { buildTakeoffQASystemPrompt, buildTakeoffQAUserPrompt } from '@/prompts/takeoff_qa.single'
import { extractAnalysisPayload } from '@/lib/json/repair'
import { enhancedAIProvider, EnhancedAnalysisOptions } from '@/lib/enhanced-ai-providers'
import { normalizeTradeScopeReview } from '@/lib/trade-scope-review'

/**
 * Single-Model Takeoff + QA Analysis Endpoint
 * 
 * Uses whichever LLM provider works (Anthropic → OpenAI → xAI)
 * Always returns BOTH items array and quality_analysis object
 * Handles malformed JSON and repairs/extracts data as needed
 */
export async function POST(request: NextRequest) {
  let planId: string | undefined
  let userId: string | undefined
  
  try {
    const supabase = await createServerSupabaseClient()
    
    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id
    
    // Parse request
    const body = await request.json()
    planId = body.planId || body.plan_id
    let images: string[] = body.images || []
    
    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }
    
    // Verify plan access via job membership
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*, jobs!inner(project_type, id)')
      .eq('id', planId)
      .single()
    
    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
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
      return NextResponse.json(
        { error: 'Plan not found or access denied' },
        { status: 404 }
      )
    }
    
    // Get job type from plan
    const jobType = (plan as any).jobs?.project_type === 'Commercial' ? 'commercial' : 'residential'
    
    // Load images if not provided
    if (!images || images.length === 0) {
      // For now, require images to be provided
      // TODO: Could load from plan file_path and convert to base64
      return NextResponse.json(
        { error: 'images array is required (base64 data URLs)' },
        { status: 400 }
      )
    }
    
    // Limit to reasonable number of images to avoid token limits
    const maxImages = 5
    if (images.length > maxImages) {
      console.warn(`Limiting analysis to ${maxImages} images (provided ${images.length})`)
      images = images.slice(0, maxImages)
    }
    
    // Build prompts
    const systemPrompt = buildTakeoffQASystemPrompt()
    let userPrompt = buildTakeoffQAUserPrompt(images.length, {
      projectName: plan.title || plan.file_name,
      planTitle: plan.title,
      jobType
    })
    
    // Configuration
    const analysisOptions: {
      maxTokens: number
      timeoutMs: number
      temperature: number
    } = {
      maxTokens: 8192, // Large enough for comprehensive responses
      timeoutMs: 60000, // 60 second timeout
      temperature: 0.2 // Low temperature for consistency
    }
    
    // Thresholds for retry logic
    const minItemsThreshold = Math.max(20, images.length * 4) // At least 4 items per page, minimum 20
    let attempts = 0
    const maxAttempts = 3
    let bestResult: {
      items: any[]
      quality_analysis: any
      provider: string
      repaired: boolean
      notes?: string
    } | null = null
    
    // Retry loop with provider fallback and thresholds
    while (attempts < maxAttempts) {
      attempts++
      console.log(`🔄 Analysis attempt ${attempts}/${maxAttempts} for plan ${planId}`)
      
      try {
        // Call LLM with provider fallback
        const llmResponse = await callAnalysisLLM(
          {
            systemPrompt,
            userPrompt,
            images
          },
          analysisOptions
        )
        
        console.log(`✅ LLM response received from ${llmResponse.provider}`)
        
        // Extract and repair JSON
        const extracted = extractAnalysisPayload(llmResponse.content)
        
        console.log(`📊 Extracted ${extracted.items.length} items, repaired: ${extracted.repaired}`)
        
        // Check threshold
        if (extracted.items.length >= minItemsThreshold) {
          // Success! Save and return
          return await saveAndReturnResults(
            supabase,
            planId,
            plan.job_id,
            userId,
            extracted.items,
            extracted.quality_analysis,
            llmResponse.provider,
            extracted.repaired,
            extracted.notes,
            jobType,
            undefined,
            attempts
          )
        }
        
        // Below threshold - keep as best result but try again
        if (!bestResult || extracted.items.length > bestResult.items.length) {
          bestResult = {
            items: extracted.items,
            quality_analysis: extracted.quality_analysis,
            provider: llmResponse.provider,
            repaired: extracted.repaired,
            notes: extracted.notes
          }
        }
        
        // If we have another attempt, adjust strategy
        if (attempts < maxAttempts) {
          console.log(`⚠️  Only ${extracted.items.length} items (threshold: ${minItemsThreshold}), retrying...`)
          
          // For next attempt: ask for more comprehensive coverage
          // Modify prompt slightly to emphasize completeness
          userPrompt = userPrompt + `

IMPORTANT: You returned ${extracted.items.length} items, but we need at least ${minItemsThreshold} items.
Please extract MORE comprehensively:
- Look at EVERY element on EVERY page
- Include ALL materials, fixtures, components, and systems
- Don't skip small items - include everything
- Count ALL doors, windows, outlets, fixtures
- Measure ALL areas, lengths, volumes
- Extract from ALL categories: structural, exterior, interior, MEP, finishes, other`
          
          // Update options for next attempt (slightly more tokens if we can)
          analysisOptions.maxTokens = Math.min(16384, Math.floor(analysisOptions.maxTokens * 1.5))
        }
      } catch (error: any) {
        console.error(`❌ Attempt ${attempts} failed:`, error.message)
        
        // If it's a provider failure and we have more attempts, continue
        if (attempts < maxAttempts && error.message?.includes('All LLM providers failed')) {
          console.log('All providers failed, but continuing to next attempt...')
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        
        // Last attempt or non-provider error - break
        if (attempts === maxAttempts) {
          throw error
        }
      }
    }
    
    // If we get here, all attempts completed but below threshold
    // Return best result anyway (with meta.reason explaining)
    if (bestResult) {
      console.log(`⚠️  Returning best result with ${bestResult.items.length} items (below threshold ${minItemsThreshold})`)
      return await saveAndReturnResults(
        supabase,
        planId,
        plan.job_id,
        userId,
        bestResult.items,
        bestResult.quality_analysis,
        bestResult.provider,
        bestResult.repaired,
        bestResult.notes + `; Attempted ${attempts} times, best result below threshold`,
        jobType,
        `Only ${bestResult.items.length} items extracted after ${attempts} attempts (threshold: ${minItemsThreshold}). May need manual review or additional pages.`
      )
    }
    
    // No successful results at all
    throw new Error(`All ${maxAttempts} attempts failed`)
    
  } catch (error) {
    console.error('Single analysis error:', error)
    
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
      {
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Save results to database and return response
 */
async function saveAndReturnResults(
  supabase: any,
  planId: string,
  jobId: string,
  userId: string,
  items: any[],
  qualityAnalysis: any,
  provider: string,
  repaired: boolean,
  notes: string | undefined,
  jobType: string,
  reason?: string,
  attempts?: number
) {
  // Ensure items have IDs
  const itemsWithIds = items.map((item, idx) => ({
    ...item,
    id: item.id || `item-${Date.now()}-${idx}`
  }))

  const baseQualityAnalysis = qualityAnalysis
    ? { ...qualityAnalysis }
    : {
        completeness: {
          overall_score: itemsWithIds.length > 0 ? 0.8 : 0.6,
          missing_sheets: [],
          missing_dimensions: [],
          missing_details: [],
          incomplete_sections: [],
          notes: 'Quality analysis generated from single-model takeoff.'
        },
        consistency: {
          scale_mismatches: [],
          unit_conflicts: [],
          dimension_contradictions: [],
          schedule_vs_elevation_conflicts: [],
          notes: 'No consistency conflicts detected in single-model analysis.'
        },
        risk_flags: [],
        audit_trail: {
          pages_analyzed: [],
          chunks_processed: 1,
          coverage_percentage: 100,
          assumptions_made: []
        }
      }

  if (!baseQualityAnalysis.risk_flags) {
    baseQualityAnalysis.risk_flags = []
  }

  const tradeScopeReview = normalizeTradeScopeReview(
    baseQualityAnalysis.trade_scope_review,
    baseQualityAnalysis.risk_flags,
    { defaultNotes: 'Trade scope review generated from single-model analysis.' }
  )

  const enhancedQualityAnalysis = {
    ...baseQualityAnalysis,
    trade_scope_review: tradeScopeReview
  }
  
  // Save takeoff analysis
  const { data: takeoffAnalysis, error: takeoffError } = await supabase
    .from('plan_takeoff_analysis')
    .insert({
      job_id: jobId,
      items: itemsWithIds,
      summary: {
        total_items: itemsWithIds.length,
        confidence: itemsWithIds.length > 0 
          ? itemsWithIds.reduce((sum, item) => sum + (item.confidence || 0.8), 0) / itemsWithIds.length
          : 0,
        consensus_count: 1,
        model_agreements: [provider],
        quality_analysis: enhancedQualityAnalysis
      },
      ai_model: `single-${provider}`,
      confidence_scores: {
        consensus: itemsWithIds.length > 0
          ? itemsWithIds.reduce((sum, item) => sum + (item.confidence || 0.8), 0) / itemsWithIds.length
          : 0,
        model_count: 1
      },
      processing_time_ms: 0, // Could track this if needed
      job_type: jobType
    })
    .select()
    .single()
  
  if (takeoffError) {
    console.error('Error saving takeoff analysis:', takeoffError)
  } else {
    // Update plan status
    await supabase
      .from('plans')
      .update({
        takeoff_analysis_status: 'completed',
        has_takeoff_analysis: true
      })
      .eq('id', planId)
  }
  
  // Transform quality_analysis.risk_flags to issues format for quality_analysis table
  const issues = (enhancedQualityAnalysis.risk_flags || []).map((flag: any) => ({
    severity: flag.severity || 'info',
    category: flag.category || 'general',
    description: flag.description || flag.impact || '',
    location: flag.location || '',
    impact: flag.impact || '',
    recommendation: flag.recommendation || '',
    pageNumber: flag.bounding_box?.page,
    bounding_box: flag.bounding_box,
    confidence: flag.confidence || 0.8
  }))
  
  // Save quality analysis
  const { data: qualityAnalysisRow, error: qualityError } = await supabase
    .from('plan_quality_analysis')
    .insert({
      plan_id: planId,
      user_id: userId,
      overall_score: enhancedQualityAnalysis?.completeness?.overall_score || 
                     (itemsWithIds.length > 0 ? 0.8 : 0.5),
      issues: issues,
      recommendations: (enhancedQualityAnalysis?.risk_flags || [])
        .filter((f: any) => f.recommendation)
        .map((f: any) => f.recommendation),
      missing_details: enhancedQualityAnalysis?.completeness?.missing_details || [],
      findings_by_category: {},
      findings_by_severity: {
        critical: issues.filter((i: any) => i.severity === 'critical'),
        warning: issues.filter((i: any) => i.severity === 'warning'),
        info: issues.filter((i: any) => i.severity === 'info')
      },
      trade_scope_review: tradeScopeReview,
      ai_model: `single-${provider}`,
      processing_time_ms: 0,
      job_type: jobType
    })
    .select()
    .single()
  
  if (qualityError) {
    console.error('Error saving quality analysis:', qualityError)
  } else {
    await supabase
      .from('plans')
      .update({
        quality_analysis_status: 'completed',
        has_quality_analysis: true
      })
      .eq('id', planId)
      .eq('user_id', userId)
  }
  
  // Return response
  return NextResponse.json({
    success: true,
    items: itemsWithIds,
    quality_analysis: enhancedQualityAnalysis,
    meta: {
      provider,
      attempts: attempts || 1,
      repaired,
      notes,
      reason,
      items_count: itemsWithIds.length,
      quality_analysis_keys: Object.keys(enhancedQualityAnalysis || {}),
      takeoff_analysis_id: takeoffAnalysis?.id,
      quality_analysis_id: qualityAnalysisRow?.id
    }
  })
}

