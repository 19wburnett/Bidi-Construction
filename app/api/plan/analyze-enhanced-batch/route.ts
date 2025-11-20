import { NextRequest, NextResponse } from 'next/server'
import { enhancedAIProvider, EnhancedAnalysisOptions, TaskType } from '@/lib/enhanced-ai-providers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

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
  } else if (admins && admins.length > 0) {
    adminEmails = admins.map((admin: any) => admin.email).filter(Boolean)
  }
  
  // Always include fallback email for safety
  const fallbackEmail = 'savewithbidi@gmail.com'
  if (!adminEmails.includes(fallbackEmail)) {
    adminEmails.push(fallbackEmail)
  }
  
  if (adminEmails.length === 0) {
    adminEmails = [fallbackEmail]
  }
  
  console.log(`Sending queue notification to ${adminEmails.length} email(s)`)

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
                A very large plan (100+ pages) has been queued for manual processing due to request size limits.
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
    } else {
      console.log(`Admin queue notification sent to ${adminEmails.length} admin(s)`)
    }
  } catch (error) {
    console.error('Error sending admin queue notification:', error)
  }
}

// Enhanced Multi-Model Analysis API with Batch Processing
// This endpoint processes large plans in batches of 5 pages each

export async function POST(request: NextRequest) {
  let planId: string | undefined
  let userId: string | undefined

  try {
    const { planId: requestPlanId, images, drawings, taskType = 'takeoff' } = await request.json()
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

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Images are required for analysis' },
        { status: 400 }
      )
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

    console.log(`Starting batch enhanced analysis for plan ${planId} with ${images.length} images`)

    // For VERY large plans, the request itself is too large for Vercel even with batching
    // Queue it instead of trying to process (request body would exceed 4.5MB limit)
    if (images.length > 100) {
      console.log(`Very large plan detected: ${images.length} pages. Request body too large for Vercel. Queueing instead.`)
      
      // Get user and plan info for queueing
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id, job_id, title, file_name')
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

      // Determine job type
      let finalJobType = null
      if (plan.job_id) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('project_type')
          .eq('id', plan.job_id)
          .single()
        
        if (jobData) {
          finalJobType = jobData.project_type === 'Commercial' ? 'commercial' : 'residential'
        }
      }

      // Insert into queue
      const { data: queueEntry, error: queueError } = await supabase
        .from('ai_takeoff_queue')
        .insert({
          plan_id: planId,
          user_id: userId,
          job_id: plan.job_id || null,
          task_type: taskType,
          job_type: finalJobType,
          images_count: images.length,
          request_data: {
            images_count: images.length,
            task_type: taskType,
            job_type: finalJobType,
            too_large_for_batch: true
          },
          status: 'pending',
          priority: 0
        })
        .select()
        .single()

      if (queueError) {
        console.error('Error queuing request:', queueError)
        return NextResponse.json(
          { error: 'Failed to queue request' },
          { status: 500 }
        )
      }

      // Send email notification to admins
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('email')
          .eq('id', userId)
          .single()

        await sendAdminQueueNotification(
          supabase,
          queueEntry.id,
          planId,
          userData?.email || 'unknown@example.com',
          plan.title || plan.file_name,
          taskType
        )
      } catch (emailError) {
        console.error('Error sending admin notification:', emailError)
      }

      // Update admin_notified_at
      await supabase
        .from('ai_takeoff_queue')
        .update({ admin_notified_at: new Date().toISOString() })
        .eq('id', queueEntry.id)

      return NextResponse.json({
        success: true,
        queued: true,
        queueId: queueEntry.id,
        message: 'Your AI takeoff request has been queued. You will be notified when it is complete.',
        estimatedTime: '2-3 hours'
      }, { status: 202 })
    }

    // Process images in batches of 5
    const batchSize = 5
    const batches = []
    for (let i = 0; i < images.length; i += batchSize) {
      batches.push(images.slice(i, i + batchSize))
    }

    console.log(`Processing ${batches.length} batches of images`)

    // Build specialized prompts based on task type
    const systemPrompt = buildSystemPrompt(taskType)
    const userPrompt = buildUserPrompt(images.length, drawings)

    // Configure analysis options
    const analysisOptions: EnhancedAnalysisOptions = {
      maxTokens: 8192,
      temperature: 0.2,
      systemPrompt,
      userPrompt,
      taskType: taskType as TaskType,
      prioritizeAccuracy: true,
      includeConsensus: true
    }

    // Process each batch
    const batchResults = []
    let totalProcessingTime = 0

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      const startTime = Date.now()
      
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} images`)
      
      try {
        const consensusResult = await enhancedAIProvider.analyzeWithConsensus(batch, analysisOptions)
        const processingTime = Date.now() - startTime
        totalProcessingTime += processingTime
        
        batchResults.push({
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          imagesProcessed: batch.length,
          processingTime,
          result: consensusResult
        })
        
        console.log(`Batch ${batchIndex + 1} completed in ${processingTime}ms`)
      } catch (error) {
        console.error(`Batch ${batchIndex + 1} failed:`, error)
        
        // If it's a "Need at least 2 models" error or enhanced analysis failed, try fallback to ChatGPT only
        if (error instanceof Error && (error.message.includes('Need at least 2 models') || error.message.includes('Enhanced analysis failed'))) {
          console.log(`Batch ${batchIndex + 1}: Falling back to ChatGPT-only analysis`)
          try {
            // Import ChatGPT provider as fallback
            const { analyzeWithOpenAI } = await import('@/lib/ai-providers')
            const chatgptResult = await analyzeWithOpenAI(batch, {
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
            const fallbackResult = {
              items: parsed.items || [],
              issues: parsed.issues || [],
              confidence: 0.8, // Single model confidence
              consensusCount: 1,
              disagreements: [],
              modelAgreements: ['chatgpt-fallback'],
              specializedInsights: parsed.specializedInsights || [],
              recommendations: parsed.recommendations || []
            }
            
            const processingTime = Date.now() - startTime
            totalProcessingTime += processingTime
            
            batchResults.push({
              batchIndex: batchIndex + 1,
              totalBatches: batches.length,
              imagesProcessed: batch.length,
              processingTime,
              result: fallbackResult
            })
            
            console.log(`Batch ${batchIndex + 1} completed with ChatGPT fallback in ${processingTime}ms`)
            continue
          } catch (fallbackError) {
            console.error(`Batch ${batchIndex + 1} ChatGPT fallback also failed:`, fallbackError)
            throw new Error(`Batch ${batchIndex + 1} processing failed: ${error.message}`)
          }
        }
        
        throw new Error(`Batch ${batchIndex + 1} processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Merge results from all batches
    const mergedResult = mergeBatchResults(batchResults, taskType)

    // Build response with batch processing metadata
    const response = {
      success: true,
      planId,
      taskType,
      processingTime: totalProcessingTime,
      batchProcessing: {
        totalBatches: batches.length,
        batchResults: batchResults.map(b => ({
          batchIndex: b.batchIndex,
          imagesProcessed: b.imagesProcessed,
          processingTime: b.processingTime
        }))
      },
      consensus: {
        confidence: mergedResult.confidence,
        consensusCount: mergedResult.consensusCount,
        disagreements: mergedResult.disagreements,
        modelAgreements: mergedResult.modelAgreements
      },
      results: taskType === 'takeoff' 
        ? {
            items: mergedResult.items,
            specializedInsights: mergedResult.specializedInsights,
            recommendations: mergedResult.recommendations
          }
        : {
            issues: mergedResult.issues,
            specializedInsights: mergedResult.specializedInsights,
            recommendations: mergedResult.recommendations
          },
      metadata: {
        totalModels: mergedResult.consensusCount,
        processingTimeMs: totalProcessingTime,
        imagesAnalyzed: images.length,
        batchesProcessed: batches.length,
        consensusScore: mergedResult.confidence,
        disagreementsCount: mergedResult.disagreements.length,
        recommendationsCount: mergedResult.recommendations.length
      }
    }

    // Save analysis results to database
    
    if (taskType === 'takeoff') {
      // Get plan's job_id
      const { data: planForJob, error: planJobError } = await supabase
        .from('plans')
        .select('job_id')
        .eq('id', planId)
        .single()
      
      if (planJobError || !planForJob) {
        console.error('Error getting plan job_id:', planJobError)
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        )
      }

      // Save takeoff analysis
      const { data: takeoffAnalysis, error: takeoffError } = await supabase
        .from('plan_takeoff_analysis')
        .insert({
          job_id: planForJob.job_id,
          items: mergedResult.items || [],
          summary: {
            total_items: mergedResult.items?.length || 0,
            confidence: mergedResult.confidence,
            consensus_count: mergedResult.consensusCount,
            model_agreements: mergedResult.modelAgreements,
            specialized_insights: mergedResult.specializedInsights,
            recommendations: mergedResult.recommendations,
            batches_processed: batches.length
          },
          ai_model: 'enhanced-consensus-batch',
          confidence_scores: {
            consensus: mergedResult.confidence,
            model_count: mergedResult.consensusCount
          },
          processing_time_ms: totalProcessingTime
        })
        .select()
        .single()

      if (takeoffError) {
        console.error('Error saving batch takeoff analysis:', takeoffError)
      }

      // Update plan status
      await supabase
        .from('plans')
        .update({ 
          takeoff_analysis_status: 'completed',
          has_takeoff_analysis: true
        })
        .eq('id', planId)

    } else if (taskType === 'quality') {
      // Save quality analysis
      const { data: qualityAnalysis, error: qualityError } = await supabase
        .from('plan_quality_analysis')
        .insert({
          plan_id: planId,
          user_id: userId,
          overall_score: mergedResult.confidence,
          issues: mergedResult.issues || [],
          recommendations: mergedResult.recommendations || [],
          findings_by_category: {},
          findings_by_severity: {
            critical: [],
            warning: mergedResult.issues || [],
            info: []
          },
          ai_model: 'enhanced-consensus-batch',
          processing_time_ms: totalProcessingTime
        })
        .select()
        .single()

      if (qualityError) {
        console.error('Error saving batch quality analysis:', qualityError)
      }

      // Update plan status
      await supabase
        .from('plans')
        .update({ 
          quality_analysis_status: 'completed',
          has_quality_analysis: true
        })
        .eq('id', planId)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Batch enhanced analysis error:', error)
    return NextResponse.json(
      { 
        error: 'Batch enhanced analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Merge results from multiple batches
function mergeBatchResults(batchResults: any[], taskType: string): any {
  const allItems = batchResults.flatMap(batch => batch.result.items || [])
  const allIssues = batchResults.flatMap(batch => batch.result.issues || [])
  const allDisagreements = batchResults.flatMap(batch => batch.result.disagreements || [])
  const allSpecializedInsights = batchResults.flatMap(batch => batch.result.specializedInsights || [])
  const allRecommendations = batchResults.flatMap(batch => batch.result.recommendations || [])

  // Calculate average confidence across all batches
  const avgConfidence = batchResults.reduce((sum, batch) => sum + (batch.result.confidence || 0), 0) / batchResults.length
  
  // Get total consensus count (sum of all models used across batches)
  const totalConsensusCount = batchResults.reduce((sum, batch) => sum + (batch.result.consensusCount || 0), 0)

  return {
    items: allItems,
    issues: allIssues,
    confidence: avgConfidence,
    consensusCount: totalConsensusCount,
    disagreements: allDisagreements,
    modelAgreements: batchResults[0]?.result.modelAgreements || [],
    specializedInsights: allSpecializedInsights,
    recommendations: Array.from(new Set(allRecommendations)) // Remove duplicates
  }
}

// Build specialized system prompt based on task type
function buildSystemPrompt(taskType: string): string {
  const basePrompt = `You are an expert construction analyst with specialized knowledge in construction plans, building codes, and material takeoffs. You are part of a multi-model consensus system that provides the most accurate analysis possible.

CRITICAL INSTRUCTIONS:
- Analyze ALL provided images thoroughly
- Provide detailed, accurate measurements and quantities
- Include specific locations and bounding boxes
- Assign appropriate Procore cost codes
- Identify potential issues and code violations
- Provide professional recommendations

RESPONSE FORMAT:
Return ONLY a valid JSON object with this structure:
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
}`

  // Add task-specific instructions
  switch (taskType) {
    case 'takeoff':
      return basePrompt + `

TAKEOFF ANALYSIS FOCUS:
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

BE THOROUGH: Extract every measurable element visible in the plan
BE SPECIFIC: "2x6 Top Plate" not just "lumber"
SHOW YOUR MATH: Include dimensions used for calculations
USE CORRECT UNITS: LF (linear feet), SF (square feet), CF (cubic feet), CY (cubic yards), EA (each), SQ (100 SF for roofing)
ASSIGN SUBCATEGORIES: Every item must have a subcategory
ASSIGN COST CODES: Use the Procore cost codes provided
INCLUDE LOCATIONS: Specify where each item is located
PROVIDE BOUNDING BOXES: Every item must have a bounding_box with coordinates
INCLUDE PRICING: Every item must have a realistic unit_cost`

    case 'quality':
      return basePrompt + `

QUALITY ANALYSIS FOCUS:
- Identify potential problems and code violations
- Check for safety concerns and compliance issues
- Assess construction quality and workmanship
- Identify missing information or unclear details
- Provide recommendations for improvements

SEVERITY LEVELS:
- CRITICAL: Safety hazards, code violations, structural issues
- WARNING: Quality concerns, potential problems, unclear details
- INFO: Recommendations, best practices, general observations

BE THOROUGH: Examine every detail for potential issues
BE SPECIFIC: Provide detailed descriptions of problems
INCLUDE IMPACT: Explain the impact of each issue
PROVIDE SOLUTIONS: Give specific recommendations for each issue
ASSIGN SEVERITY: Use appropriate severity levels
INCLUDE LOCATIONS: Specify where each issue is located
PROVIDE BOUNDING BOXES: Every issue must have a bounding_box with coordinates`

    case 'bid_analysis':
      return basePrompt + `

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
      return basePrompt
  }
}

// Build user prompt with image count and context
function buildUserPrompt(imageCount: number, drawings?: any[]): string {
  let prompt = `Analyze this construction plan with ${imageCount} page${imageCount > 1 ? 's' : ''} for comprehensive construction analysis.

IMAGES PROVIDED: ${imageCount} page${imageCount > 1 ? 's' : ''} of construction plans
ANALYSIS REQUIRED: Complete construction analysis with materials, quantities, and quality assessment

INSTRUCTIONS:
1. Examine EVERY dimension, measurement, and annotation visible in the plan
2. Calculate quantities based on visible dimensions and scale
3. Identify all construction materials, fixtures, and components
4. Use standard construction estimating practices
5. Cross-reference dimensions to ensure accuracy
6. Assign appropriate Procore cost codes to each item
7. Identify potential issues and code violations
8. Provide professional recommendations

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

CRITICAL: You MUST respond with ONLY the JSON object. Do not include any explanatory text before or after the JSON.`

  if (drawings && drawings.length > 0) {
    prompt += `\n\nUSER ANNOTATIONS: ${drawings.length} user annotation${drawings.length > 1 ? 's' : ''} included for reference`
  }

  return prompt
}
