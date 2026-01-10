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

  const taskTypeDisplay = taskType === 'takeoff' ? 'AI Takeoff' : 'Bid Analysis'

  try {
    const { data, error } = await resend.emails.send({
      from: 'BIDI <noreply@savewithbidi.com>',
      to: adminEmails,
      subject: `🔔 New AI ${taskTypeDisplay} Request Queued`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">BIDI</h1>
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
              © 2024 BIDI. All rights reserved.
            </p>
            <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.7;">
              This is an automated notification from the BIDI platform.
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
    
    // Check if user has custom cost codes set as default
    let costCodeStandard: CostCodeStandard = (userData.preferred_cost_code_standard as CostCodeStandard) || 'csi-16'
    const { data: userSettings } = await supabase
      .from('users')
      .select('use_custom_cost_codes')
      .eq('id', userId)
      .single()
    
    if (userSettings?.use_custom_cost_codes) {
      const { data: customCodes } = await supabase
        .from('custom_cost_codes')
        .select('id, extraction_status')
        .eq('user_id', userId)
        .eq('is_default', true)
        .eq('extraction_status', 'completed')
        .single()
      
      if (customCodes) {
        costCodeStandard = 'custom'
      }
    }

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
    const systemPrompt = await buildTakeoffSystemPrompt(taskType, finalJobType, costCodeStandard, userId)
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
        .maybeSingle()

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
          total_items: mergedItems.length
        }
      }

      // 4. Upsert (Update or Insert)
      const takeoffPayload = {
        job_id: planForJob.job_id,
        plan_id: planId,
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
        
        // Vectorize takeoff items for semantic search (async, don't wait)
        if (takeoffAnalysis && planId) {
          const currentPlanId = planId // Capture for type narrowing
          import('@/lib/takeoff-item-embeddings').then(({ ingestTakeoffItemEmbeddings }) => {
            import('@/lib/plan-chat-v3/retrieval-engine').then(({ normalizeTakeoffItems }) => {
              const normalizedItems = normalizeTakeoffItems(mergedItems)
              ingestTakeoffItemEmbeddings(supabase, currentPlanId, normalizedItems).catch((error) => {
                console.error('[TakeoffVectorize] Failed to auto-vectorize takeoff items:', error)
              })
            })
          })
        }
      }
    }

    // Build response with enhanced metadata
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

// Build specialized system prompt based on task type and job type
// NOTE: This function is deprecated and not used - prompts are now built using
// buildTakeoffSystemPrompt from lib/takeoff-prompts.ts
// Keeping this for reference but it should not be called
/*
function buildSystemPrompt(taskType: string, jobType: string = 'residential'): string {
  const basePrompt = `You are an expert construction analyst with specialized knowledge in construction plans, building codes, and material takeoffs. You are part of a multi-model consensus system that provides the most accurate analysis possible.

CRITICAL INSTRUCTIONS:
- Analyze ALL provided images thoroughly
- Provide detailed, accurate measurements and quantities
- Include specific locations and bounding boxes
- Assign appropriate Procore cost codes
- Identify potential issues and code violations
- Provide professional recommendations
RESPONSE FORMAT:
Return ONLY a valid JSON object with this EXACT structure:
{
  "items": [
    {
      "name": "Specific item name",
      "description": "Detailed description",
      "quantity": 150.5,
      "unit": "LF|SF|CF|CY|EA|SQ",
      "unit_cost": 2.50,
      "location": "Specific location",
      "category": "structural|exterior|interior|mep|finishes|other",
      "subcategory": "Specific subcategory",
      "cost_code": "Procore cost code",
      "cost_code_description": "Cost code description",
      "notes": "Additional notes",
      "dimensions": "Original dimensions from plan",
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
  "issues": [
    {
      "severity": "critical|warning|info",
      "category": "Issue category",
      "description": "Issue description",
      "location": "Issue location",
      "impact": "Impact description",
      "recommendation": "Recommended solution",
      "pageNumber": 1,
      "bounding_box": {
        "page": 1,
        "x": 0.25,
        "y": 0.30,
        "width": 0.15,
        "height": 0.10
      },
      "confidence": 0.90
    }
  ],
  "summary": {
    "total_items": 0,
    "categories": {},
    "subcategories": {},
    "total_area_sf": 0,
    "plan_scale": "detected scale",
    "confidence": "high|medium|low",
    "notes": "Overall observations"
  }
}

MANDATORY REQUIREMENTS:
1. "items" array: MUST contain all measurable quantities, even if empty array with note in summary
2. Never return partial structures - always include all top-level fields`

  // Add job type specific instructions
  const jobTypePrompt = jobType === 'commercial' ? `

COMMERCIAL PROJECT FOCUS:
- Building codes & ADA compliance requirements
- Fire protection systems (sprinklers, alarms, exits)
- Commercial-grade MEP systems (3-phase electrical, commercial HVAC)
- Accessibility features (ramps, elevators, ADA-compliant fixtures)
- Life safety systems and emergency egress
- Commercial finishes and durability requirements
- Parking lot striping, signage, and ADA spaces
- Commercial-grade windows, doors, and hardware
- Tenant improvement allowances
- Base building vs tenant scope distinctions
- Commercial roofing systems (EPDM, TPO, built-up)
- High-rise considerations (elevator shafts, mechanical floors)
- Commercial lighting (LED, fluorescent, emergency lighting)
- Commercial flooring (VCT, carpet tile, polished concrete)
- Commercial restroom fixtures and accessibility
- Commercial kitchen equipment and ventilation
- Data/telecom infrastructure and cable management
- Security systems and access control
- Energy efficiency and LEED compliance
- Commercial landscaping and site amenities` : `

RESIDENTIAL PROJECT FOCUS:
- Residential building codes and energy efficiency
- Single-family or multi-family dwelling details
- Residential appliances and fixtures
- Custom finishes and millwork details
- Landscaping and outdoor living spaces
- Residential-grade HVAC, electrical (120/240V), plumbing
- Insulation values and energy code compliance
- Residential roofing details (composition, architectural)
- Interior comfort features (fireplaces, built-ins)
- Finish schedules for paint, flooring, countertops
- Residential lighting (recessed, pendant, chandelier)
- Residential flooring (hardwood, carpet, tile, LVT)
- Residential cabinetry and countertops
- Residential appliances (kitchen, laundry, HVAC)
- Residential outdoor features (decks, patios, landscaping)
- Residential security and smart home features
- Energy efficient windows and doors
- Residential insulation and air sealing
- Residential plumbing fixtures and finishes
- Custom millwork and built-in features`

  // Add task-specific instructions
  switch (taskType) {
    case 'takeoff':
      // NOTE: generateTemplateInstructions() is imported from lib/takeoff-template
      // This entire function is deprecated and commented out
      return basePrompt + jobTypePrompt + '' + `

TAKEOFF ANALYSIS FOCUS (REQUIRED SECTION):
- Extract ALL material quantities and measurements
- Calculate accurate quantities based on visible dimensions
- Identify all construction materials, fixtures, and components
- Use standard construction estimating practices
- Cross-reference dimensions to ensure accuracy
- Assign appropriate Procore cost codes to each item
- Provide realistic unit_cost pricing for each item

3-LEVEL CATEGORIZATION:
LEVEL 1: CATEGORY (structural, exterior, interior, mep, finishes, other)
LEVEL 2: SUBCATEGORY (specific work type)
LEVEL 3: LINE ITEMS (individual materials with Procore cost codes)

PRICING REQUIREMENTS:
- For each item, you MUST provide a realistic "unit_cost" based on material type, grade, and typical market rates (as of 2024)
- Include both material and labor costs where applicable
- Use industry-standard pricing ranges appropriate for the material and unit type
- Price per LF, SF, CF, CY, EA, or SQ depending on the unit

BE THOROUGH: Extract every measurable element visible in the plan - you MUST extract MULTIPLE items per page
EXPECTED COVERAGE: For a 19-page plan, expect 5-15 items per page minimum
BE SPECIFIC: "2x6 Top Plate" not just "lumber"
SHOW YOUR MATH: Include dimensions used for calculations
USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
ASSIGN SUBCATEGORIES: Every item must have a subcategory
ASSIGN COST CODES: Use the Procore cost codes provided
INCLUDE LOCATIONS: Specify where each item is located
PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
INCLUDE PRICING: Every item must have a realistic unit_cost

EXTRACT COMPREHENSIVELY:
- Count ALL doors, windows, fixtures, outlets, switches visible
- Measure ALL walls, floors, roofs, foundations
- Quantify ALL materials: lumber, concrete, drywall, insulation, roofing, siding
- Include ALL mechanical: HVAC equipment, plumbing fixtures, electrical components
- List ALL finishes: paint, flooring, cabinets, countertops, appliances
- Calculate areas, volumes, lengths for EVERY measurable element

DO NOT SKIP: Even if an item appears simple or small, include it. Better to over-extract than under-extract.`


    case 'bid_analysis':
      return basePrompt + jobTypePrompt + `

BID ANALYSIS FOCUS:
- Provide realistic cost estimates and timelines
- Identify material requirements and labor needs
- Assess project complexity and requirements
- Identify potential challenges and risks
- Provide professional recommendations

COST ESTIMATION:
- Use current market rates and material costs
- Consider regional pricing variations
- Include labor costs and overhead
- Factor in project complexity
- Provide realistic timelines

BE REALISTIC: Provide accurate, market-based estimates
BE DETAILED: Break down costs by category and item
INCLUDE TIMELINE: Provide realistic project timelines
IDENTIFY RISKS: Highlight potential challenges and risks
PROVIDE RECOMMENDATIONS: Give professional advice and suggestions`

    default:
      return basePrompt + jobTypePrompt
  }
}

// Build user prompt with image count and context; optionally include extracted PDF text
function buildUserPrompt(imageCount: number, drawings?: any[], extractedText?: string): string {
  let prompt = `Analyze this construction plan with ${imageCount} page${imageCount > 1 ? 's' : ''} for COMPREHENSIVE construction analysis.

IMAGES PROVIDED: ${imageCount} page${imageCount > 1 ? 's' : ''} of construction plans
ANALYSIS REQUIRED: Complete takeoff (all quantities)

${extractedText && extractedText.length > 0 ? `=== EXTRACTED TEXT FROM PDF (truncated) ===
${extractedText.slice(0, 8000)}${extractedText.length > 8000 ? '\n\n...(additional text truncated)' : ''}

=== VISUAL ANALYSIS INSTRUCTIONS ===` : ''}

MANDATORY INSTRUCTIONS:

TEMPLATE-BASED ANALYSIS:
You have been provided with a COMPREHENSIVE TAKEOFF TEMPLATE in the system prompt. You MUST:
1. Go through EVERY category in the template (structural, exterior, interior, mep, finishes, other)
2. For each subcategory, check if items exist in the plan
3. Extract ALL items you find - don't skip any category
4. If you're uncertain about an item, include it with low confidence (<0.6) but still include it

MULTI-MODEL STRATEGY:
- Your job is to find items OTHER models might miss
- Extract comprehensively - better to over-extract than under-extract
- Each model should find DIFFERENT items - we'll aggregate all findings
- Cross-validate against template to ensure nothing is missed

TAKEOFF REQUIREMENTS:
1. Examine EVERY dimension, measurement, and annotation visible in the plan
2. Calculate quantities based on visible dimensions and scale
3. Identify all construction materials, fixtures, and components
4. Use standard construction estimating practices
5. Cross-reference dimensions to ensure accuracy
6. Assign appropriate Procore cost codes to each item
7. Include realistic unit_cost pricing for every item

CRITICAL: You must extract MULTIPLE items per page. A single page typically contains:
- Multiple wall sections (exterior, interior, different materials)
- Multiple door/window openings
- Multiple electrical outlets/switches/fixtures
- Flooring areas by room/section
- Multiple material layers (foundation, framing, insulation, finishes)
- Multiple plumbing fixtures
- Multiple HVAC components

For 5 pages of a 19-page plan, you should extract AT LEAST 20-50 total items, not just 2-3.

IMPORTANT:
- Be SPECIFIC: "2x6 Top Plate" not just "lumber"
- SHOW YOUR MATH: Include dimensions used for calculations
- USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
- BE THOROUGH: Extract every measurable element visible in the plan
- ASSIGN SUBCATEGORIES: Every item must have a subcategory
- ASSIGN COST CODES: Use the Procore cost codes provided
- INCLUDE LOCATIONS: Specify where each item is located
- PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
- If dimensions are unclear or not visible, state "dimension not visible" in notes

CRITICAL RESPONSE REQUIREMENTS:
1. You MUST respond with ONLY the JSON object - no explanatory text
2. The JSON MUST include the "items" array
3. Even if the plan is unclear, return the full structure with empty arrays/objects where appropriate

DO NOT:
- Return partial results
- Omit fields because they're empty (use empty arrays/objects)
- Include any text outside the JSON object`

  if (drawings && drawings.length > 0) {
    prompt += `\n\nUSER ANNOTATIONS: ${drawings.length} user annotation${drawings.length > 1 ? 's' : ''} included for reference - pay special attention to these marked areas`
  }

  return prompt
}
*/

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
  
  /* ORCHESTRATOR CODE (DISABLED - TO BE RE-ENABLED LATER)
  
    // Load plan metadata
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single()
    
    // Verify access for non-admins
    if (!isAdmin && plan) {
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
        return null
      }
    }

    if (planError || !plan) {
      console.warn('Plan not found for orchestrator')
      return null
    }

    // Load chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('plan_chunks')
      .select('*')
      .eq('plan_id', planId)
      .order('chunk_index', { ascending: true })

    if (chunksError || !chunks || chunks.length === 0) {
      console.warn('No chunks found for orchestrator, falling back to standard analysis')
      return null
    }

    // Load sheet index
    const { data: sheetIndex, error: sheetError } = await supabase
      .from('plan_sheet_index')
      .select('*')
      .eq('plan_id', planId)
      .order('page_no', { ascending: true })

    if (sheetError) {
      console.warn('Sheet index load failed:', sheetError)
    }

    // Build normalized inputs
    const projectMeta: ProjectMeta = {
      plan_id: planId,
      project_name: plan.project_name,
      project_location: plan.project_location,
      plan_title: plan.title,
      job_id: plan.job_id || null,
      plan_file_name: plan.file_name,
      total_pages: plan.num_pages || chunks.length,
      plan_upload_date: plan.created_at,
      detected_projects: [],
      detected_addresses: []
    }

    const normalizedInput = {
      project_meta: projectMeta,
      sheet_index: (sheetIndex || []) as SheetIndex[],
      chunks: chunks.map((c: any) => ({
        chunk_id: c.chunk_id,
        plan_id: c.plan_id,
        chunk_index: c.chunk_index,
        page_range: c.page_range,
        sheet_index_subset: c.sheet_index_subset || [],
        content: {
          text: c.content?.text || '',
          text_token_count: c.content?.text_token_count || 0,
          image_urls: c.content?.image_urls || [],
          image_count: c.content?.image_count || 0
        },
        metadata: c.metadata || {},
        safeguards: c.safeguards || {}
      })) as Chunk[]
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(taskType, jobType)

    // Run orchestrator (disabled - uncomment when model-orchestrator is ready)
    // console.log(`🚀 Running orchestrator with ${normalizedInput.chunks.length} chunks`)
    // const result = await modelOrchestrator.orchestrate(
    //   normalizedInput,
    //   systemPrompt,
    //   taskType
    // )
    throw new Error('Orchestrator is temporarily disabled - use standard analysis instead')

    // Convert to response format compatible with existing API
    const processingTime = result.final_json.metadata.processing_time_ms

    // Save results
    const takeoffAnalysisData = {
      job_id: plan.job_id,
      items: result.final_json.items,
      summary: {
        total_items: result.final_json.items.length,
        confidence: result.final_json.metadata.confidence_overall,
        consensus_count: result.final_json.metadata.models_used.length,
        model_agreements: result.final_json.metadata.models_used,
        disagreements: result.consensus_report.disagreements_count,
        engine_recommendation: result.engine_recommendation,
      },
      ai_model: 'orchestrator-consensus',
      confidence_scores: {
        consensus: result.final_json.metadata.confidence_overall,
        model_count: result.final_json.metadata.models_used.length,
        disagreements: result.final_json.metadata.total_disagreements,
        resolved: result.final_json.metadata.resolved_disagreements
      },
      processing_time_ms: processingTime,
      job_type: jobType
    }

    const { data: takeoffAnalysis, error: takeoffError } = await supabase
      .from('plan_takeoff_analysis')
      .insert(takeoffAnalysisData)
      .select()
      .single()

    if (takeoffError) {
      console.error('Error saving orchestrator takeoff analysis:', takeoffError)
    } else {
      await supabase
        .from('plans')
        .update({
          takeoff_analysis_status: 'completed',
          has_takeoff_analysis: true
        })
        .eq('id', planId)
    }


    // Build response with detailed orchestrator info
    return {
      success: true,
      planId,
      taskType,
      processingTime,
      orchestrator: true,
      orchestrator_enabled: 'auto-detected', // Show that it was auto-enabled
      consensus: {
        confidence: result.final_json.metadata.confidence_overall,
        consensusCount: result.final_json.metadata.models_used.length,
        disagreements: result.final_json.metadata.total_disagreements,
        resolved: result.final_json.metadata.resolved_disagreements,
        modelAgreements: result.final_json.metadata.models_used
      },
      consensus_report: result.consensus_report,
      engine_recommendation: {
        recommended_model: result.engine_recommendation.recommended_model,
        reasoning: result.engine_recommendation.reasoning,
        confidence: result.engine_recommendation.confidence,
        performance_metrics: result.engine_recommendation.performance_metrics
      },
      results: taskType === 'takeoff'
        ? {
            items: result.final_json.items,
            specializedInsights: [],
            recommendations: result.engine_recommendation.recommendation_details.split('. ').filter(r => r.trim())
          }
        : {
            issues: qualityAnalysisData.issues,
            specializedInsights: [],
            recommendations: qualityAnalysisData.recommendations
          },
      metadata: {
        totalModels: result.final_json.metadata.models_used.length,
        processingTimeMs: processingTime,
        imagesAnalyzed: 0, // Chunks don't use images in the same way
        consensusScore: result.final_json.metadata.confidence_overall,
        disagreementsCount: result.final_json.metadata.total_disagreements,
        recommendationsCount: result.engine_recommendation.recommendation_details.split('. ').length,
        chunksProcessed: normalizedInput.chunks.length,
        analysisType: 'orchestrator_multi_model'
      },
      conflicts: {
        unresolved: result.final_json.conflicts.unresolved,
        resolved: result.final_json.conflicts.resolved.length
      },
      // Add summary for easy viewing in UI
      orchestrator_summary: {
        models_tested: result.final_json.metadata.models_used.length,
        successful_models: result.consensus_report.model_performance ? Object.keys(result.consensus_report.model_performance).length : 0,
        total_items: result.final_json.items.length,
        disagreements: result.final_json.metadata.total_disagreements,
        resolved_disagreements: result.final_json.metadata.resolved_disagreements,
        confidence: result.final_json.metadata.confidence_overall,
        engine_recommendation: result.engine_recommendation.recommended_model || 'hybrid',
        chunks_used: normalizedInput.chunks.length
      }
    }
  } catch (error) {
    console.error('Orchestrator analysis error:', error)
    throw error
  }
  */
}
