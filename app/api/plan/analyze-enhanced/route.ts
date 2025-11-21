import { NextRequest, NextResponse } from 'next/server'
import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { enhancedConsensusEngine, EnhancedConsensusResult } from '@/lib/enhanced-consensus-engine'
// import { modelOrchestrator } from '@/lib/model-orchestrator' // TODO: Re-enable when orchestrator is ready
import PDFParser from 'pdf2json'
import type { ProjectMeta, Chunk, SheetIndex } from '@/types/ingestion'
import { Resend } from 'resend'
import { normalizeTradeScopeReview } from '@/lib/trade-scope-review'
import { buildTakeoffSystemPrompt, buildTakeoffUserPrompt } from '@/lib/takeoff-prompts'
import { CostCodeStandard } from '@/lib/cost-code-helpers'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Send email notification to admin users about a new AI takeoff request in the queue
 */
async function sendAdminQueueNotification(
  supabase: any,
  queueId: string,
  planId: string,
  userEmail: string,
  planTitle: string,
  taskType: string
) {
  // Get all admin email addresses - check both role = 'admin' OR is_admin = true
  const { data: admins, error: adminError } = await supabase
    .from('users')
    .select('email')
    .or('role.eq.admin,is_admin.eq.true')

  let adminEmails: string[] = []
  
  if (adminError) {
    console.error('Error querying admin users:', adminError)
    // Continue to fallback email
  } else if (admins && admins.length > 0) {
    adminEmails = admins.map((admin: any) => admin.email).filter(Boolean)
  }
  
  // Always include fallback email for safety
  const fallbackEmail = 'savewithbidi@gmail.com'
  if (!adminEmails.includes(fallbackEmail)) {
    adminEmails.push(fallbackEmail)
  }
  
  if (adminEmails.length === 0) {
    console.warn('No admin emails found, using fallback only')
    adminEmails = [fallbackEmail]
  }
  
  console.log(`Sending queue notification to ${adminEmails.length} email(s):`, adminEmails)

  const taskTypeDisplay = taskType === 'takeoff' ? 'AI Takeoff' : taskType === 'quality' ? 'Quality Analysis' : 'Bid Analysis'

  try {
    const { data, error } = await resend.emails.send({
      from: 'Bidi <noreply@savewithbidi.com>',
      to: adminEmails,
      subject: `🔔 New AI ${taskTypeDisplay} Request Queued`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Bidi</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Construction Marketplace</p>
          </div>
          
          <div style="padding: 30px; background-color: #f8fafc;">
            <h2 style="color: #1e293b; margin-bottom: 20px;">🔔 New AI ${taskTypeDisplay} Request</h2>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
              <h3 style="color: #3b82f6; margin-top: 0;">Request Details</h3>
              <p><strong>Queue ID:</strong> ${queueId}</p>
              <p><strong>Plan ID:</strong> ${planId}</p>
              <p><strong>Plan Title:</strong> ${planTitle}</p>
              <p><strong>Task Type:</strong> ${taskTypeDisplay}</p>
              <p><strong>Requested by:</strong> ${userEmail}</p>
              <p><strong>Queued at:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="color: #f59e0b; margin-top: 0;">⚠️ Action Required</h4>
              <p style="margin: 10px 0; line-height: 1.6;">
                A non-admin user has requested an AI ${taskTypeDisplay.toLowerCase()}. 
                This request has been queued and requires manual processing.
              </p>
            </div>

            <div style="background-color: #dcfce7; border: 1px solid #16a34a; padding: 20px; border-radius: 8px;">
              <h4 style="color: #16a34a; margin-top: 0;">📋 Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                <li>Review the queued request in the admin dashboard</li>
                <li>Process the AI ${taskTypeDisplay.toLowerCase()} manually</li>
                <li>The user will be automatically notified when complete</li>
                <li>Estimated processing time: 2-3 hours</li>
              </ul>
            </div>

            <div style="margin-top: 20px; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.bidicontracting.com'}/admin/analyze-plans" 
                 style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Queue in Admin Dashboard
              </a>
            </div>
          </div>
          
          <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">
              © 2024 Bidi. All rights reserved.
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
              This is an automated notification from the Bidi platform.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send admin queue notification:', error)
      throw error
    }

    console.log(`Admin queue notification sent to ${adminEmails.length} admin(s)`)
    return data
  } catch (error) {
    console.error('Error sending admin queue notification:', error)
    throw error
  }
}

// Enhanced Multi-Model Analysis API
// This endpoint uses 5+ specialized models with consensus scoring and disagreement detection

export async function POST(request: NextRequest) {
  let planId: string | undefined
  let userId: string | undefined

  try {
    const { planId: requestPlanId, images, drawings, taskType = 'takeoff', jobType } = await request.json()
    planId = requestPlanId

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
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

    // Check if user is admin - if not, queue the request instead of processing immediately
    // Check both role = 'admin' OR is_admin = true
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin, role, email, preferred_cost_code_standard')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // User is admin if role = 'admin' OR is_admin = true
    const isAdmin = userData.role === 'admin' || userData.is_admin === true
    
    const costCodeStandard: CostCodeStandard = (userData.preferred_cost_code_standard as CostCodeStandard) || 'csi-16'

    // Determine job type first (needed for both admin and non-admin paths)
    let finalJobType = jobType
    if (!finalJobType) {
      const { data: planForJobType, error: planError } = await supabase
        .from('plans')
        .select(`
          job_id,
          jobs!inner(project_type)
        `)
        .eq('id', planId)
        .single()

      if (!planError && planForJobType) {
        // Verify access for non-admins
        if (!isAdmin) {
          const { data: jobMember } = await supabase
            .from('job_members')
            .select('job_id')
            .eq('job_id', planForJobType.job_id)
            .eq('user_id', userId)
            .single()
          
          const { data: job } = await supabase
            .from('jobs')
            .select('user_id')
            .eq('id', planForJobType.job_id)
            .single()
          
          if (!jobMember && job?.user_id !== userId) {
            return NextResponse.json(
              { error: 'Plan not found or access denied' },
              { status: 404 }
            )
          }
        }
        
        const projectType = (planForJobType as any).jobs?.project_type
        finalJobType = projectType === 'Commercial' ? 'commercial' : 'residential'
      }
    }

    // If not admin, queue the request and send email to admins
    if (!isAdmin) {
      // Get plan and job info for queue entry
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id, job_id, title, file_name')
        .eq('id', planId)
        .single()
      
      // Verify access
      if (plan) {
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
      }

      if (planError || !plan) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        )
      }

      // Insert into queue
      const { data: queueEntry, error: queueError } = await supabase
        .from('ai_takeoff_queue')
        .insert({
          plan_id: planId,
          user_id: userId,
          job_id: plan.job_id || null,
          task_type: taskType,
          job_type: finalJobType || null,
          images_count: images?.length || 0,
          request_data: {
            images_count: images?.length || 0,
            task_type: taskType,
            job_type: finalJobType
          },
          status: 'pending',
          priority: 0
        })
        .select()
        .single()

      if (queueError) {
        console.error('Error queuing takeoff request:', queueError)
        return NextResponse.json(
          { error: 'Failed to queue request' },
          { status: 500 }
        )
      }

      // Send email notification to admins
      try {
        await sendAdminQueueNotification(supabase, queueEntry.id, planId, userData.email, plan.title || plan.file_name, taskType)
      } catch (emailError) {
        console.error('Error sending admin notification email:', emailError)
        // Don't fail the request if email fails
      }

      // Update admin_notified_at
      await supabase
        .from('ai_takeoff_queue')
        .update({ admin_notified_at: new Date().toISOString() })
        .eq('id', queueEntry.id)

      // Return queued response
      return NextResponse.json({
        success: true,
        queued: true,
        queueId: queueEntry.id,
        message: 'Your AI takeoff request has been queued. You will be notified when it is complete.',
        estimatedTime: '2-3 hours'
      }, { status: 202 }) // 202 Accepted
    }

    // Admin path continues - finalJobType is already determined above

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Images are required for analysis' },
        { status: 400 }
      )
    }

    // For large plans, redirect to batch processing to prevent 413 Request Entity Too Large
    // Conservative limit: 30 pages at 0.3 JPEG quality = ~120KB/page = 3.6MB total (under 4.5MB Vercel limit)
    if (images.length > 30) {
      console.log(`Large plan detected: ${images.length} pages. Redirecting to batch processing.`)
      return NextResponse.json(
        { 
          error: 'Request too large',
          message: `This plan has ${images.length} pages and is too large for single-batch processing. Please use the batch endpoint or process in smaller chunks.`,
          suggestBatch: true,
          totalPages: images.length,
          maxRecommendedPages: 30
        },
        { status: 413 }
      )
    }

    // Warn if many images but still allow
    if (images.length > 20) {
      console.warn(`Large plan detected: ${images.length} pages. This may take longer and consume more tokens.`)
    }

    // Check environment variables for enhanced AI providers
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_GEMINI_API_KEY',
      'XAI_API_KEY'
    ]
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      console.error('Missing environment variables for enhanced AI:', missingVars)
      return NextResponse.json(
        { 
          error: 'Enhanced AI system not configured',
          details: `Missing environment variables: ${missingVars.join(', ')}. Please configure all required API keys for the enhanced multi-model system.`,
          fallback: 'Please use the standard AI analysis instead'
        },
        { status: 503 }
      )
    }

    console.log(`Starting enhanced analysis for plan ${planId} with ${images.length} images (job type: ${finalJobType})`)

    // Orchestrator temporarily disabled - using standard enhanced analysis
    // TODO: Re-enable orchestrator when model-orchestrator is fully ready

    // Attempt to fetch plan file and extract text for hybrid analysis
    let extractedText = ''
    try {
      let planRow: any = null
      const { data: planData, error: planLoadError } = await supabase
        .from('plans')
        .select('*, job_id')
        .eq('id', planId)
        .single()
      
      // Verify access for non-admins
      if (!isAdmin && planData) {
        const { data: jobMember } = await supabase
          .from('job_members')
          .select('job_id')
          .eq('job_id', planData.job_id)
          .eq('user_id', userId)
          .single()
        
        const { data: job } = await supabase
          .from('jobs')
          .select('user_id')
          .eq('id', planData.job_id)
          .single()
        
        if (jobMember || job?.user_id === userId) {
          planRow = planData
        }
        // If access denied, planRow stays null and we skip text extraction
      } else if (isAdmin) {
        planRow = planData
      }

      if (!planLoadError && planRow && planRow.file_path) {
        let fileUrl: string = planRow.file_path

        // If not an absolute URL, try to create a signed URL from storage (job-plans bucket)
        if (!fileUrl.startsWith('http')) {
          try {
            const { data: urlData } = await supabase.storage
              .from('job-plans')
              .createSignedUrl(fileUrl, 300)
            if (urlData?.signedUrl) {
              fileUrl = urlData.signedUrl
            }
          } catch {}
        }

        // Fetch the PDF and extract text
        try {
          const pdfRes = await fetch(fileUrl)
          const ab = await pdfRes.arrayBuffer()
          const buffer = Buffer.from(ab)
          extractedText = await extractTextFromPDF(buffer)
        } catch (e) {
          console.warn('Hybrid text extraction failed; proceeding with images only')
        }
      }
    } catch (e) {
      console.warn('Plan fetch for text extraction failed; proceeding with images only')
    }

    // Build specialized prompts based on task type and job type, injecting extracted text when available
    const systemPrompt = buildTakeoffSystemPrompt(taskType, finalJobType, costCodeStandard)
    const userPrompt = buildTakeoffUserPrompt(images.length, undefined, undefined, extractedText, drawings, costCodeStandard)

    // Configure analysis options
    const analysisOptions: EnhancedAnalysisOptions = {
      maxTokens: 4096,
      temperature: 0.2,
      systemPrompt,
      userPrompt,
      taskType: taskType as TaskType,
      prioritizeAccuracy: true,
      includeConsensus: true,
      extractedText: extractedText || undefined // Pass extracted text for Grok text-only fallback
    }

    // Run enhanced consensus analysis
    const startTime = Date.now()
    console.log('Starting enhanced analysis with options:', analysisOptions)
    console.log('Images count:', images.length)
    
    let consensusResult: any
    let processingTime: number
    
    try {
      consensusResult = await enhancedAIProvider.analyzeWithConsensus(images, analysisOptions)
      processingTime = Date.now() - startTime
      console.log(`Enhanced analysis completed in ${processingTime}ms`)
      console.log('Consensus result:', {
        itemsCount: consensusResult.items.length,
        confidence: consensusResult.confidence,
        consensusCount: consensusResult.consensusCount
      })
    } catch (error) {
      console.error('Enhanced analysis failed:', error)
      
      // If it's a "Need at least 2 models" error or enhanced analysis failed, try fallback to ChatGPT only
      if (error instanceof Error && (error.message.includes('Need at least 2 models') || error.message.includes('Enhanced analysis failed') || error.message.includes('Single model analysis failed'))) {
        console.log('Falling back to ChatGPT-only analysis')
        try {
          // Import ChatGPT provider as fallback
          const { analyzeWithOpenAI } = await import('@/lib/ai-providers')
          const chatgptResult = await analyzeWithOpenAI(images, {
            systemPrompt,
            userPrompt,
            maxTokens: 8192,
            temperature: 0.2
          })
          
          // Parse ChatGPT response with improved JSON extraction
          let jsonText = chatgptResult.content
          
          // Remove markdown code blocks if present
          const codeBlockMatch = chatgptResult.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1]
          } else {
            // Try to find JSON object in the text
            const jsonMatch = chatgptResult.content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              jsonText = jsonMatch[0]
            }
          }
          
          const parsed = JSON.parse(jsonText)
          
          // Convert ChatGPT result to enhanced format
          consensusResult = {
            items: parsed.items || [],
            issues: parsed.issues || [],
            confidence: 0.8, // Single model confidence
            consensusCount: 1,
            disagreements: [],
            modelAgreements: ['chatgpt-fallback'],
            specializedInsights: parsed.specializedInsights || [],
            recommendations: parsed.recommendations || []
          }
          
          processingTime = Date.now() - startTime
          console.log(`ChatGPT fallback analysis completed in ${processingTime}ms`)
        } catch (fallbackError) {
          console.error('ChatGPT fallback analysis also failed:', fallbackError)
          throw error // Re-throw original error
        }
      } else {
        throw error // Re-throw if it's not a "Need at least 2 models" error
      }
    }

    // Save analysis results to database
    // Always save BOTH takeoff and quality analysis regardless of taskType
    
    // Extract quality_analysis from consensusResult if it exists, or construct from issues
    // The consensus engine now extracts and merges quality_analysis from all models
    // This will be reused in the response, so construct once here
    const overallConfidence = consensusResult.confidence || 0.8
    const confidenceWarning = overallConfidence < 0.6 
      ? `⚠️ LOW CONFIDENCE ANALYSIS (${(overallConfidence * 100).toFixed(0)}%) - Some items may need manual verification.`
      : ''

    const tradeScopeReview = normalizeTradeScopeReview(
      consensusResult.quality_analysis?.trade_scope_review ?? consensusResult.trade_scope_review,
      consensusResult.issues || [],
      { defaultNotes: confidenceWarning || 'Trade scope review generated from consensus analysis' }
    )

    let qualityAnalysisData = consensusResult.quality_analysis
      ? {
          ...consensusResult.quality_analysis,
          trade_scope_review: tradeScopeReview
        }
      : {
          completeness: {
            overall_score: overallConfidence,
            missing_sheets: [],
            missing_dimensions: [],
            missing_details: [],
            incomplete_sections: [],
            notes: confidenceWarning || 'Quality analysis included with takeoff'
          },
          consistency: {
            scale_mismatches: [],
            unit_conflicts: [],
            dimension_contradictions: [],
            schedule_vs_elevation_conflicts: [],
            notes: 'No consistency issues detected'
          },
          risk_flags: [],
          audit_trail: {
            pages_analyzed: Array.from({ length: images.length }, (_, i) => i + 1),
            chunks_processed: 1,
            coverage_percentage: 100,
            assumptions_made: []
          },
          trade_scope_review: tradeScopeReview
        }

    if ((!qualityAnalysisData.risk_flags || qualityAnalysisData.risk_flags.length === 0) && (consensusResult.issues && consensusResult.issues.length > 0)) {
      qualityAnalysisData = {
        ...qualityAnalysisData,
        risk_flags: consensusResult.issues.map((issue: any) => ({
          level: issue.severity === 'critical' ? 'high' : issue.severity === 'warning' ? 'medium' : 'low',
          category: issue.category || 'general',
          description: issue.description || issue.detail || issue.message || '',
          location: issue.location || '',
          recommendation: issue.recommendation || ''
        }))
      }
    }

    if (!qualityAnalysisData.trade_scope_review) {
      qualityAnalysisData = {
        ...qualityAnalysisData,
        trade_scope_review: tradeScopeReview
      }
    }

    // Save takeoff analysis (always, if items exist or if taskType is takeoff)
    if (taskType === 'takeoff' || (consensusResult.items && consensusResult.items.length > 0)) {
      // Get plan's job_id and file_name
      const { data: planForJob, error: planJobError } = await supabase
        .from('plans')
        .select('job_id, file_name')
        .eq('id', planId)
        .single()
      
      if (planJobError || !planForJob) {
        console.error('Error getting plan job_id:', planJobError)
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        )
      }

      // 1. Fetch existing takeoff analysis for this job
      const { data: existingTakeoff } = await supabase
        .from('plan_takeoff_analysis')
        .select('*')
        .eq('job_id', planForJob.job_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // 2. Prepare new items with plan_id tag
      const newItems = (consensusResult.items || []).map((item: any) => ({
        ...item,
        plan_id: planId,
        plan_file_name: planForJob.file_name
      }))

      // 3. Merge with existing items if found
      let mergedItems = newItems
      let mergedSummary = {
        total_items: newItems.length,
        confidence: consensusResult.confidence,
        consensus_count: consensusResult.consensusCount,
        model_agreements: consensusResult.modelAgreements,
        specialized_insights: consensusResult.specializedInsights,
        recommendations: consensusResult.recommendations,
        quality_analysis: qualityAnalysisData
      }

      if (existingTakeoff) {
        // Parse existing items
        let existingItemsArray: any[] = []
        if (typeof existingTakeoff.items === 'string') {
          try {
            existingItemsArray = JSON.parse(existingTakeoff.items)
          } catch (e) { existingItemsArray = [] }
        } else if (Array.isArray(existingTakeoff.items)) {
          existingItemsArray = existingTakeoff.items
        }

        // Append new items
        mergedItems = [...existingItemsArray, ...newItems]
        
        // Merge summary (simple override for now, or recalc totals)
        mergedSummary = {
          ...existingTakeoff.summary,
          ...mergedSummary,
          total_items: mergedItems.length,
          // Keep specific fields from new analysis but don't lose old ones if needed
          quality_analysis: { 
            ...existingTakeoff.summary?.quality_analysis,
            ...qualityAnalysisData // For now, latest quality analysis overrides or we need deep merge logic
          }
        }
      }

      // 4. Upsert (Update or Insert)
      const takeoffPayload = {
        job_id: planForJob.job_id,
        items: mergedItems,
        summary: mergedSummary,
        ai_model: 'enhanced-consensus',
        confidence_scores: {
          consensus: consensusResult.confidence,
          model_count: consensusResult.consensusCount
        },
        processing_time_ms: processingTime,
        job_type: finalJobType
      }

      let takeoffAnalysis;
      let takeoffError;

      if (existingTakeoff) {
        // Update existing record
        const { data, error } = await supabase
          .from('plan_takeoff_analysis')
          .update(takeoffPayload)
          .eq('id', existingTakeoff.id)
          .select()
          .single()
        takeoffAnalysis = data
        takeoffError = error
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('plan_takeoff_analysis')
          .insert(takeoffPayload)
          .select()
          .single()
        takeoffAnalysis = data
        takeoffError = error
      }

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
    }

    // Save quality analysis (ALWAYS - both takeoff and quality analysis should be saved)
    // Even if there are no issues, we save the completeness/consistency/audit data
    const shouldSaveQuality = taskType === 'quality' || 
        taskType === 'takeoff' || // ALWAYS save quality analysis when doing takeoff
        (consensusResult.issues && consensusResult.issues.length > 0) || 
        qualityAnalysisData
    
    if (shouldSaveQuality) {
      
      // Organize issues by severity
      const issues = consensusResult.issues || []
      
      // Get plan details for job_id if we don't have them (e.g. if we skipped takeoff save)
      let job_id = null
      let plan_file_name = ''
      
      try {
        const { data: planInfo } = await supabase
          .from('plans')
          .select('job_id, file_name')
          .eq('id', planId)
          .single()
        if (planInfo) {
          job_id = planInfo.job_id
          plan_file_name = planInfo.file_name
        }
      } catch (e) {}

      if (job_id) {
        // 1. Fetch existing quality analysis for this job
        const { data: existingQuality } = await supabase
          .from('plan_quality_analysis')
          .select('*')
          .eq('job_id', job_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // 2. Prepare new issues with plan_id tag
        const newIssues = issues.map((issue: any) => ({
          ...issue,
          plan_id: planId,
          plan_file_name: plan_file_name
        }))

        // 3. Merge with existing issues
        let mergedIssues = newIssues
        let mergedTradeScopeReview = qualityAnalysisData.trade_scope_review
        
        // Initial values for other fields from current analysis
        let mergedOverallScore = qualityAnalysisData.completeness?.overall_score || consensusResult.confidence || 0.8
        let mergedMissingDetails = qualityAnalysisData.completeness?.missing_details || []
        let mergedRecommendations = consensusResult.recommendations || []

        if (existingQuality) {
          // Parse existing issues
          let existingIssuesArray: any[] = []
          try {
            if (typeof existingQuality.issues === 'string') {
              existingIssuesArray = JSON.parse(existingQuality.issues)
            } else if (Array.isArray(existingQuality.issues)) {
              existingIssuesArray = existingQuality.issues
            }
          } catch (e) { existingIssuesArray = [] }

          // Append new issues
          mergedIssues = [...existingIssuesArray, ...newIssues]
          
          // Merge Trade Scope Review (normalize and combine counts)
          // This is complex, for now we will take the new one but ideally we should merge counts.
          // Let's attempt a simple merge of the lists if available
          if (existingQuality.trade_scope_review?.items && mergedTradeScopeReview?.items) {
             // For now, we will append new trade items to the list if they are different, or just keep both lists
             // A deeper merge would require deduplication by trade name.
             // Simpler strategy: Concat lists
             const existingTradeItems = existingQuality.trade_scope_review.items || []
             const newTradeItems = mergedTradeScopeReview.items || []
             
             // Tag new trade items with plan
             const taggedNewTradeItems = newTradeItems.map((item: any) => ({
               ...item,
               source_plan: plan_file_name
             }))
             
             const combinedItems = [...existingTradeItems, ...taggedNewTradeItems]
             
             mergedTradeScopeReview = {
               ...mergedTradeScopeReview,
               items: combinedItems,
               summary: {
                 complete: (existingQuality.trade_scope_review.summary?.complete || 0) + (mergedTradeScopeReview.summary?.complete || 0),
                 partial: (existingQuality.trade_scope_review.summary?.partial || 0) + (mergedTradeScopeReview.summary?.partial || 0),
                 missing: (existingQuality.trade_scope_review.summary?.missing || 0) + (mergedTradeScopeReview.summary?.missing || 0),
                 notes: 'Aggregated from multiple plans'
               }
             }
          }
        }

        // Re-bucket by severity
        const criticalIssues = mergedIssues.filter((i: any) => i.severity === 'critical')
        const warningIssues = mergedIssues.filter((i: any) => i.severity === 'warning')
        const infoIssues = mergedIssues.filter((i: any) => i.severity === 'info')

        // 4. Upsert Quality Analysis
        const qualityPayload = {
          job_id: job_id,
          plan_id: planId, // Keep explicit link to latest plan, or make null? The table has plan_id. We should probably leave it as the "latest" source or null if schema allows.
          user_id: userId,
          overall_score: mergedOverallScore,
          issues: mergedIssues,
          recommendations: mergedRecommendations,
          missing_details: mergedMissingDetails,
          findings_by_category: {}, 
          findings_by_severity: {
            critical: criticalIssues,
            warning: warningIssues,
            info: infoIssues
          },
          trade_scope_review: mergedTradeScopeReview,
          ai_model: 'enhanced-consensus',
          processing_time_ms: processingTime,
          job_type: finalJobType
        }

        let qualityAnalysis;
        let qualityError;

        if (existingQuality) {
           const { data, error } = await supabase
            .from('plan_quality_analysis')
            .update(qualityPayload)
            .eq('id', existingQuality.id)
            .select()
            .single()
           qualityAnalysis = data
           qualityError = error
        } else {
           const { data, error } = await supabase
            .from('plan_quality_analysis')
            .insert(qualityPayload)
            .select()
            .single()
           qualityAnalysis = data
           qualityError = error
        }

        if (qualityError) {
          console.error('Error saving quality analysis:', qualityError)
        } else {
          // Update plan status
          await supabase
            .from('plans')
            .update({ 
              quality_analysis_status: 'completed',
            has_quality_analysis: true
          })
          .eq('id', planId)
        }
      }
    }

    // Build response with enhanced metadata - ALWAYS include both takeoff and quality
    // qualityAnalysisData is already defined above and reused here
    const response = {
      success: true,
      planId,
      taskType,
      processingTime,
      consensus: {
        confidence: consensusResult.confidence,
        consensusCount: consensusResult.consensusCount,
        disagreements: consensusResult.disagreements,
        modelAgreements: consensusResult.modelAgreements
      },
      results: {
        // Always include takeoff items (even if empty)
        items: consensusResult.items || [],
        // Always include quality analysis issues
        issues: consensusResult.issues || [],
        // Always include quality_analysis object
        quality_analysis: qualityAnalysisData,
        // Additional metadata
        specializedInsights: consensusResult.specializedInsights || [],
        recommendations: consensusResult.recommendations || []
      },
      metadata: {
        totalModels: consensusResult.consensusCount,
        processingTimeMs: processingTime,
        imagesAnalyzed: images.length,
        consensusScore: consensusResult.confidence,
        disagreementsCount: consensusResult.disagreements?.length || 0,
        recommendationsCount: consensusResult.recommendations?.length || 0,
        itemsCount: consensusResult.items?.length || 0,
        issuesCount: consensusResult.issues?.length || 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Enhanced analysis error:', error)
    return NextResponse.json(
      { 
        error: 'Enhanced analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Extracts text from a PDF Buffer using pdf2json, returning a single concatenated string.
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('Error parsing PDF:', errData.parserError)
      reject(new Error('Failed to parse PDF'))
    })

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let text = ''
        if (pdfData.Pages) {
          pdfData.Pages.forEach((page: any, pageIndex: number) => {
            text += `\n=== PAGE ${pageIndex + 1} ===\n`
            if (page.Texts) {
              const sortedTexts = page.Texts.sort((a: any, b: any) => {
                const yDiff = a.y - b.y
                if (Math.abs(yDiff) > 0.5) return yDiff
                return a.x - b.x
              })
              sortedTexts.forEach((textItem: any) => {
                if (textItem.R) {
                  textItem.R.forEach((r: any) => {
                    if (r.T) {
                      text += decodeURIComponent(r.T) + ' '
                    }
                  })
                }
              })
              text += '\n'
            }
          })
        }
        resolve(text.trim())
      } catch (error) {
        console.error('Error extracting text:', error)
        resolve('')
      }
    })

    pdfParser.parseBuffer(buffer)
  })
}

/**
 * Run orchestrator-based analysis using chunks if available
 * TEMPORARILY DISABLED - returns null to fall back to standard analysis
 */
async function runOrchestratorAnalysis(
  supabase: any,
  planId: string,
  userId: string,
  jobType: string,
  taskType: TaskType
): Promise<any | null> {
  // Orchestrator temporarily disabled - will re-enable when model-orchestrator is fully ready
  return null
}
