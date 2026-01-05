import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { aiGateway } from '@/lib/ai-gateway-provider'
import { buildTakeoffSystemPrompt, buildTakeoffUserPrompt } from '@/lib/takeoff-prompts'
import { CostCodeStandard } from '@/lib/cost-code-helpers'
import { TakeoffReviewOrchestrator, ReviewOrchestratorResult } from '@/lib/takeoff-review-orchestrator'
import { MissingInformationAnalyzer, MissingInformationAnalysis } from '@/lib/missing-information-analyzer'
import { EstimateEnhancementEngine, EstimateEnhancementResult } from '@/lib/estimate-enhancement'
import { checkPlanVectorizationStatus } from '@/lib/plan-vectorization-status'
import { retrievePlanTextChunks, fetchPlanTextChunksSample } from '@/lib/plan-text-chunks'

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
    const images = body.images // Optional - only used for visual context if provided
    const drawings = body.drawings

    if (!planId) {
      return NextResponse.json({ error: 'Missing required field: planId' }, { status: 400 })
    }

    // Verify plan access via job membership (needed before checking vectorization)
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

    // Get trade tags for this plan
    const { data: tradeTags } = await supabase
      .from('plan_trade_tags')
      .select('trade_category')
      .eq('plan_id', planId)

    const planTradeCategories = tradeTags?.map(tag => tag.trade_category) || []

    // Get trade documents for context (SOW, specifications, etc.)
    const { data: tradeDocuments } = await supabase
      .from('trade_documents')
      .select('trade_category, document_type, description, file_name')
      .eq('job_id', plan.job_id)
      .or(planTradeCategories.length > 0 
        ? planTradeCategories.map(trade => `trade_category.eq.${trade}`).join(',')
        : 'trade_category.eq.none'
      )
      .in('document_type', ['sow', 'specification'])

    // Check if plan is vectorized (REQUIRED for takeoff analysis)
    const vectorizationStatus = await checkPlanVectorizationStatus(supabase, planId)
    
    if (!vectorizationStatus.isVectorized) {
      // Check if vectorization is already in progress
      const { data: existingVectorizationJob } = await supabase
        .from('plan_vectorization_queue')
        .select('id, status, progress')
        .eq('plan_id', planId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingVectorizationJob) {
        return NextResponse.json({
          error: 'PLAN_NOT_VECTORIZED',
          message: 'This plan is being vectorized in the background. Please wait for vectorization to complete before running takeoff analysis.',
          vectorizationStatus: {
            ...vectorizationStatus,
            jobId: existingVectorizationJob.id,
            jobStatus: existingVectorizationJob.status,
            jobProgress: existingVectorizationJob.progress
          }
        }, { status: 202 }) // 202 Accepted - processing in background
      }

      // Try to queue vectorization automatically
      try {
        // Check if there's already a pending or processing job
        const { data: existingJob } = await supabase
          .from('plan_vectorization_queue')
          .select('id, status, progress')
          .eq('plan_id', planId)
          .in('status', ['pending', 'processing'])
          .maybeSingle()

        if (existingJob) {
          return NextResponse.json({
            error: 'PLAN_NOT_VECTORIZED',
            message: 'This plan is being vectorized in the background. Please wait for vectorization to complete before running takeoff analysis.',
            vectorizationStatus: {
              ...vectorizationStatus,
              jobId: existingJob.id,
              jobStatus: existingJob.status,
              jobProgress: existingJob.progress
            }
          }, { status: 202 })
        }

        // Create new vectorization job
        const { data: vectorizationJob, error: vectorizationError } = await supabase
          .from('plan_vectorization_queue')
          .insert({
            plan_id: planId,
            user_id: userId,
            job_id: plan.job_id,
            status: 'pending',
            priority: 10, // Higher priority for takeoff-triggered vectorization
            total_pages: plan.num_pages || null,
            progress: 0,
            current_step: 'Queued for processing'
          })
          .select('id, status')
          .single()

        if (!vectorizationError && vectorizationJob) {
          console.log(`✅ Successfully queued vectorization for plan ${planId}, job ${vectorizationJob.id}`)
          
          // Try to trigger processing immediately (don't wait)
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
              ? `https://${process.env.VERCEL_URL}` 
              : 'http://localhost:3000'
            
            fetch(`${baseUrl}/api/plan-vectorization/process`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ queueJobId: vectorizationJob.id }),
            }).catch((error) => {
              console.error('[AnalyzeTakeoff] Failed to trigger vectorization processing:', error)
              // Cron job will pick it up if this fails
            })
          } catch (triggerError) {
            console.error('[AnalyzeTakeoff] Error triggering vectorization:', triggerError)
            // Cron job will pick it up
          }
          
          return NextResponse.json({
            error: 'PLAN_NOT_VECTORIZED',
            message: 'This plan needs to be vectorized before running takeoff analysis. Vectorization has been queued automatically. Please wait a few minutes and try again.',
            vectorizationStatus: {
              ...vectorizationStatus,
              jobId: vectorizationJob.id,
              jobStatus: vectorizationJob.status,
              autoQueued: true
            }
          }, { status: 202 })
        } else {
          console.error('Failed to create vectorization job:', vectorizationError)
        }
      } catch (vectorizationError) {
        console.error('Failed to queue vectorization:', vectorizationError)
      }

      // If we can't queue automatically, return error with instructions
      return NextResponse.json({
        error: 'PLAN_NOT_VECTORIZED',
        message: vectorizationStatus.message || 'This plan needs to be vectorized before running takeoff analysis. Vectorization extracts text from the plans which helps the AI provide more accurate takeoff results.',
        vectorizationStatus,
        instructions: 'Please wait for the plan to be vectorized, or contact support if vectorization is not starting automatically.'
      }, { status: 400 })
    }

    // Retrieve vectorized text chunks from the database (this is the primary data source)
    console.log(`Retrieving vectorized text chunks for plan ${planId}...`)
    
    // Get comprehensive text chunks for takeoff analysis
    // Use a broad query to get relevant chunks across the entire plan
    const textChunks = await retrievePlanTextChunks(
      supabase,
      planId,
      'construction takeoff quantities materials labor cost codes specifications measurements dimensions',
      50 // Get up to 50 chunks for comprehensive analysis
    )
    
    // If semantic search didn't return enough, get a sample of chunks
    if (textChunks.length < 20) {
      console.log(`Only ${textChunks.length} chunks from semantic search, fetching sample chunks...`)
      const sampleChunks = await fetchPlanTextChunksSample(supabase, planId, 30)
      // Merge, avoiding duplicates
      const existingIds = new Set(textChunks.map(c => c.id))
      for (const chunk of sampleChunks) {
        if (!existingIds.has(chunk.id)) {
          textChunks.push(chunk)
        }
      }
    }
    
    console.log(`Retrieved ${textChunks.length} text chunks for takeoff analysis`)
    
    if (textChunks.length === 0) {
      return NextResponse.json({
        error: 'NO_TEXT_CHUNKS',
        message: 'No vectorized text chunks found for this plan. Please ensure the plan has been vectorized first.',
        vectorizationStatus
      }, { status: 400 })
    }
    
    // Build text context from chunks
    const textContext = textChunks
      .map((chunk, idx) => {
        const pageInfo = chunk.page_number ? ` (Page ${chunk.page_number})` : ''
        return `[Chunk ${idx + 1}${pageInfo}]:\n${chunk.snippet_text}`
      })
      .join('\n\n')
    
    // Use images only if provided and small (for visual context on key pages)
    // Limit to first 5-10 pages to avoid request size issues
    const visualImages = images && Array.isArray(images) && images.length > 0
      ? images.slice(0, Math.min(10, images.length))
      : []
    
    // With vectorized text chunks, we can process all plans in a single request
    // Text chunks are lightweight compared to images, so no batching needed
    console.log(`Processing takeoff analysis using ${textChunks.length} vectorized text chunks`)

    // Build prompt with vectorized text chunks (primary data source)
        // Build trade context string for prompt
    let tradeContext = ''
    if (planTradeCategories.length > 0) {
      tradeContext = `\n\nTRADE CONTEXT:\nThis plan is tagged with the following trade categories: ${planTradeCategories.join(', ')}. `
      tradeContext += 'Please focus your analysis on items relevant to these trades. '
      
      if (tradeDocuments && tradeDocuments.length > 0) {
        const documentsByTrade: Record<string, any[]> = {}
        tradeDocuments.forEach(doc => {
          if (!documentsByTrade[doc.trade_category]) {
            documentsByTrade[doc.trade_category] = []
          }
          documentsByTrade[doc.trade_category].push(doc)
        })
        
        tradeContext += '\n\nTRADE-SPECIFIC DOCUMENTS AVAILABLE:\n'
        Object.entries(documentsByTrade).forEach(([trade, docs]) => {
          tradeContext += `- ${trade}: `
          const sowDocs = docs.filter(d => d.document_type === 'sow')
          const specDocs = docs.filter(d => d.document_type === 'specification')
          if (sowDocs.length > 0) {
            tradeContext += `SOW (${sowDocs.map(d => d.file_name).join(', ')})`
          }
          if (specDocs.length > 0) {
            if (sowDocs.length > 0) tradeContext += ', '
            tradeContext += `Specifications (${specDocs.map(d => d.file_name).join(', ')})`
          }
          tradeContext += '\n'
        })
        tradeContext += '\nUse information from these documents to inform your analysis, especially for specifications, requirements, and scope definitions.'
      }
    }

const textBasedPrompt = `Analyze the following vectorized text extracted from construction plans to perform a comprehensive takeoff analysis.

PLAN TEXT CONTENT (${textChunks.length} chunks from ${new Set(textChunks.map(c => c.page_number).filter(Boolean)).size} pages):
${textContext}

${drawings ? `\nDRAWINGS/ANNOTATIONS:\n${JSON.stringify(drawings, null, 2)}` : ''}

${visualImages.length > 0 ? `\nNote: ${visualImages.length} sample page images are also provided for visual reference.` : ''}

${buildTakeoffUserPrompt(
      plan.num_pages || textChunks.length,
      undefined,
      undefined,
      undefined,
      drawings,
      costCodeStandard
    )}${tradeContext}`

    // Use AI Gateway to analyze using vectorized text (with optional visual images for context)
    const response = await aiGateway.generate({
      model: 'gpt-4o',
      system: buildTakeoffSystemPrompt('takeoff', job?.project_type?.toLowerCase() || 'residential', costCodeStandard),
      prompt: textBasedPrompt,
      images: visualImages.length > 0 ? visualImages : undefined, // Only include images if provided and small
      maxTokens: 8192, // Increased for text-based analysis
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
      
      // SCOPE-FIRST ENFORCEMENT: Ensure all quantities are 0 and items have required fields
      // This allows users to measure quantities themselves using the Chat tab
      takeoffData.items = takeoffData.items.map((item: any) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        quantity: 0, // Always 0 - user will measure
        needs_measurement: true, // Flag for UI to show measurement is needed
        // Ensure assumptions array exists (AI should provide, but fallback if not)
        assumptions: item.assumptions || [
          {
            type: 'pricing',
            assumption: item.unit_cost ? `Unit cost of $${item.unit_cost} per ${item.unit || 'unit'}` : 'Unit cost to be determined',
            basis: 'Based on typical market rates'
          }
        ],
        // Ensure measurement instructions exist
        measurement_instructions: item.measurement_instructions || 
          `Measure the ${item.unit || 'quantity'} of ${item.name} from the plans. Check ${item.location || 'relevant sheets'} for dimensions.`
      }))
      
      // ITEM EXPANSION: If AI returned too few items, expand by breaking out materials/labor
      if (takeoffData.items.length < 30) {
        console.log(`⚠️ Only ${takeoffData.items.length} items extracted. Expanding with materials/labor breakdown...`)
        
        const expandedItems: any[] = []
        takeoffData.items.forEach((item: any) => {
          // If item doesn't already have a cost_type, create both materials and labor versions
          if (!item.cost_type || item.cost_type === 'other') {
            // Materials item
            expandedItems.push({
              ...item,
              id: crypto.randomUUID(),
              name: `${item.name} - Materials`,
              cost_type: 'materials',
              unit_cost: item.unit_cost || 50,
              subcontractor: item.subcontractor || 'General',
            })
            // Labor item
            expandedItems.push({
              ...item,
              id: crypto.randomUUID(),
              name: `${item.name} - Labor`,
              cost_type: 'labor',
              unit_cost: Math.round((item.unit_cost || 50) * 0.6), // Labor typically 60% of material cost
              subcontractor: item.subcontractor || 'General',
            })
          } else {
            // Item already has cost_type, keep as-is
            expandedItems.push(item)
          }
        })
        
        // Add common missing items if project appears to be residential
        const existingCategories = new Set(takeoffData.items.map((i: any) => i.category?.toLowerCase()))
        const commonResidentialItems = [
          { name: 'Windows', category: 'exterior', code: '8,500', subcontractor: 'Glazing' },
          { name: 'Exterior Doors', category: 'exterior', code: '8,100', subcontractor: 'Doors' },
          { name: 'Interior Doors', category: 'interior', code: '8,200', subcontractor: 'Doors' },
          { name: 'Plumbing Fixtures', category: 'mep', code: '15,400', subcontractor: 'Plumbing' },
          { name: 'Electrical Outlets', category: 'mep', code: '16,200', subcontractor: 'Electrical' },
          { name: 'HVAC System', category: 'mep', code: '15,700', subcontractor: 'HVAC' },
          { name: 'Flooring', category: 'finishes', code: '9,600', subcontractor: 'Flooring' },
          { name: 'Interior Paint', category: 'finishes', code: '9,900', subcontractor: 'Painting' },
          { name: 'Cabinets', category: 'interior', code: '12,350', subcontractor: 'Cabinets' },
          { name: 'Countertops', category: 'interior', code: '12,360', subcontractor: 'Countertops' },
          { name: 'Insulation', category: 'exterior', code: '7,200', subcontractor: 'Insulation' },
          { name: 'Siding/Cladding', category: 'exterior', code: '7,400', subcontractor: 'Siding' },
          { name: 'Gutters', category: 'exterior', code: '7,700', subcontractor: 'Roofing' },
          { name: 'Landscaping', category: 'other', code: '2,900', subcontractor: 'Landscaping' },
        ]
        
        const existingNames = new Set(expandedItems.map((i: any) => i.name.toLowerCase().replace(/ - (materials|labor)/i, '')))
        
        commonResidentialItems.forEach(common => {
          if (!existingNames.has(common.name.toLowerCase())) {
            // Add materials item
            expandedItems.push({
              id: crypto.randomUUID(),
              name: `${common.code} - ${common.name} - Materials`,
              description: `${common.name} materials`,
              quantity: 0,
              needs_measurement: true,
              unit: 'EA',
              unit_cost: 100,
              cost_type: 'materials',
              category: common.category,
              subcategory: common.name,
              subcontractor: common.subcontractor,
              cost_code: common.code,
              cost_code_description: common.name,
              location: 'See plans',
              assumptions: [{ type: 'material', assumption: 'Standard specification assumed', basis: 'Common residential item' }],
              measurement_instructions: `Count or measure ${common.name} from the plans`,
              confidence: 0.6,
              bounding_box: { page: 1, x: 0.5, y: 0.5, width: 0.1, height: 0.1 }
            })
            // Add labor item
            expandedItems.push({
              id: crypto.randomUUID(),
              name: `${common.code} - ${common.name} - Labor`,
              description: `${common.name} installation labor`,
              quantity: 0,
              needs_measurement: true,
              unit: 'EA',
              unit_cost: 75,
              cost_type: 'labor',
              category: common.category,
              subcategory: common.name,
              subcontractor: common.subcontractor,
              cost_code: common.code,
              cost_code_description: common.name,
              location: 'See plans',
              assumptions: [{ type: 'labor', assumption: 'Standard installation labor', basis: 'Typical installation time' }],
              measurement_instructions: `Count or measure ${common.name} from the plans - labor based on material quantity`,
              confidence: 0.6,
              bounding_box: { page: 1, x: 0.5, y: 0.5, width: 0.1, height: 0.1 }
            })
          }
        })
        
        console.log(`✅ Expanded from ${takeoffData.items.length} to ${expandedItems.length} items`)
        takeoffData.items = expandedItems
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
          const itemName = itemMatch[1].trim()
          const unit = itemMatch[3]
          items.push({
            name: itemName,
            quantity: 0, // SCOPE-FIRST: Always 0
            needs_measurement: true,
            unit: unit,
            category: 'other',
            assumptions: [
              {
                type: 'material',
                assumption: `Standard ${itemName} specification`,
                basis: 'Extracted from plan text'
              }
            ],
            measurement_instructions: `Measure the ${unit} of ${itemName} from the plans.`
          })
        }
      })
      
      takeoffData = {
        items: items,
        summary: {
          total_items: items.length,
          notes: items.length > 0 ? 'Extracted from text analysis - scope defined, quantities need measurement' : 'Unable to parse structured data',
          confidence: 'low'
        },
        raw_response: aiContent
      }
    }

    // Save the primary analysis to the database (upsert - update if exists, insert if not)
    // First check if an analysis already exists for this plan
    const { data: existingAnalysis } = await supabase
      .from('plan_takeoff_analysis')
      .select('id')
      .eq('plan_id', planId)
      .maybeSingle()

    let analysis: { id: string } | null = null
    let analysisError: any = null

    if (existingAnalysis) {
      // Update existing analysis
      console.log('📝 Updating existing takeoff analysis...')
      
      // First, delete all related records to start fresh
      console.log('🗑️ Clearing old takeoff data...')
      
      // Delete item embeddings (by plan_id)
      await supabase.from('takeoff_item_embeddings').delete().eq('plan_id', planId)
      
      // Delete old reviews (by plan_id to catch all)
      await supabase.from('takeoff_reviews').delete().eq('plan_id', planId)
      
      // Delete old missing info (by plan_id to catch all)
      await supabase.from('takeoff_missing_information').delete().eq('plan_id', planId)
      
      // Now update the analysis
      const { data, error } = await supabase
        .from('plan_takeoff_analysis')
        .update({
          items: takeoffData.items || [],
          summary: takeoffData.summary || takeoffData,
          ai_model: 'gpt-4o',
          confidence_scores: takeoffData.confidence_scores || {},
          processing_time_ms: 0,
          review_results: null, // Clear old review results
          missing_information: null, // Clear old missing info
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAnalysis.id)
        .select()
        .single()
      
      analysis = data
      analysisError = error
    } else {
      // Insert new analysis
      console.log('📝 Creating new takeoff analysis...')
      const { data, error } = await supabase
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
      
      analysis = data
      analysisError = error
    }

    if (analysisError) {
      console.error('Error saving analysis:', analysisError)
    }

    // Stage 2: Multi-AI Review
    console.log('🔍 Starting multi-AI review stage...')
    let reviewResults: ReviewOrchestratorResult | null = null
    let missingInfoAnalysis: MissingInformationAnalysis | null = null
    let estimateEnhancement: EstimateEnhancementResult | null = null

    try {
      const reviewOrchestrator = new TakeoffReviewOrchestrator()
      reviewResults = await reviewOrchestrator.runReview(
        takeoffData,
        images,
        costCodeStandard
      )

      // Save review results to database
      if (reviewResults && analysis?.id) {
        // Save Reviewer 1 results
        await supabase.from('takeoff_reviews').insert({
          takeoff_analysis_id: analysis.id,
          plan_id: planId,
          reviewer_model: 'gpt-4o',
          review_type: 'takeoff_review',
          findings: reviewResults.reviewResult
        })

        // Save Reviewer 2 results
        await supabase.from('takeoff_reviews').insert({
          takeoff_analysis_id: analysis.id,
          plan_id: planId,
          reviewer_model: 'claude-sonnet-4-20250514',
          review_type: 'reanalysis',
          findings: reviewResults.reanalysisResult
        })

        // Save Reviewer 3 results
        await supabase.from('takeoff_reviews').insert({
          takeoff_analysis_id: analysis.id,
          plan_id: planId,
          reviewer_model: 'gpt-4o',
          review_type: 'validation',
          findings: reviewResults.validationResult
        })

        // Save missing information
        if (reviewResults.allMissingInformation && reviewResults.allMissingInformation.length > 0) {
          const missingInfoRecords = reviewResults.allMissingInformation.map(mi => ({
            takeoff_analysis_id: analysis.id,
            plan_id: planId,
            item_id: mi.item_id,
            item_name: mi.item_name,
            category: mi.category,
            missing_data: mi.missing_data,
            why_needed: mi.why_needed,
            where_to_find: mi.where_to_find,
            impact: mi.impact,
            suggested_action: mi.suggested_action,
            location: mi.location
          }))

          await supabase.from('takeoff_missing_information').insert(missingInfoRecords)
        }

        // Update plan_takeoff_analysis with review results summary
        await supabase
          .from('plan_takeoff_analysis')
          .update({
            review_results: {
              reviewResult: reviewResults.reviewResult,
              reanalysisResult: reviewResults.reanalysisResult,
              validationResult: reviewResults.validationResult,
              allMissingInformation: reviewResults.allMissingInformation
            }
          })
          .eq('id', analysis.id)
      }
      // 🚨 CRITICAL: Convert missing items from review into actual line items
      // This ensures ALL identified items go into the spreadsheet with quantity=0
      if (reviewResults?.mergedMissingItems && reviewResults.mergedMissingItems.length > 0) {
        console.log(`📊 Converting ${reviewResults.mergedMissingItems.length} missing items to line items...`)
        
        // Map categories to likely cost codes based on user's selected standard
        const categoryToCostCode: Record<string, { code: string, description: string, subcontractor: string }> = {
          'structural': { code: '3,300', description: 'Footings/Concrete', subcontractor: 'Concrete' },
          'exterior': { code: '7,300', description: 'Roofing/Siding', subcontractor: 'Roofing' },
          'interior': { code: '9,250', description: 'Gypsum Board', subcontractor: 'Drywall' },
          'mep': { code: '16,100', description: 'Electrical', subcontractor: 'Electrical' },
          'finishes': { code: '9,600', description: 'Flooring', subcontractor: 'Flooring' },
          'other': { code: '1,0', description: 'General Requirements', subcontractor: 'General' }
        }
        
        const existingItemNames = new Set(
          (takeoffData.items || []).map((item: any) => item.name?.toLowerCase().trim())
        )
        
        const newItems = reviewResults.mergedMissingItems
          .filter((mi: any) => !existingItemNames.has(mi.item?.toLowerCase().trim()))
          .flatMap((mi: any) => {
            const category = mi.category || 'other'
            const costCodeInfo = categoryToCostCode[category] || categoryToCostCode['other']
            
            // Create both materials and labor line items for each missing item
            const baseItem = {
              id: crypto.randomUUID(),
              description: mi.description || mi.item || 'Item identified during review',
              quantity: 0,
              needs_measurement: true,
              measurement_instructions: mi.location ? `Check ${mi.location} and measure/count as needed` : 'Measure from plan drawings',
              category: category,
              subcategory: costCodeInfo.description,
              subcontractor: costCodeInfo.subcontractor,
              cost_code: costCodeInfo.code,
              cost_code_description: costCodeInfo.description,
              location: mi.location || 'See plans',
              notes: `⚠️ Identified during review: ${mi.item || mi.description}. ${mi.impact ? `Impact: ${mi.impact}` : ''}`,
              confidence: 0.7,
              assumptions: [
                {
                  type: 'material',
                  assumption: 'Standard specification assumed - verify with plans',
                  basis: 'Item identified during review, specifications may vary'
                }
              ],
              bounding_box: { page: 1, x: 0.5, y: 0.5, width: 0.1, height: 0.1 }
            }
            
            // Create materials item with cost code in name
            const materialsItem = {
              ...baseItem,
              id: crypto.randomUUID(),
              name: `${costCodeInfo.code} - ${mi.item || 'Item'} - Materials`,
              cost_type: 'materials' as const,
              unit: 'EA',
              unit_cost: 50.00, // Placeholder - user should update
              total_cost: 0
            }
            
            // Create labor item with cost code in name
            const laborItem = {
              ...baseItem,
              id: crypto.randomUUID(),
              name: `${costCodeInfo.code} - ${mi.item || 'Item'} - Labor`,
              cost_type: 'labor' as const,
              unit: 'EA',
              unit_cost: 75.00, // Placeholder labor rate
              total_cost: 0
            }
            
            return [materialsItem, laborItem]
          })
        
        if (newItems.length > 0) {
          console.log(`✅ Added ${newItems.length} new line items from review findings`)
          takeoffData.items = [...(takeoffData.items || []), ...newItems]
        }
      }
    } catch (reviewError) {
      console.error('Error in review stage:', reviewError)
      // Continue even if review fails
    }

    // Stage 3: Missing Information Analysis
    console.log('📋 Analyzing missing information...')
    try {
      const missingInfoAnalyzer = new MissingInformationAnalyzer()
      missingInfoAnalysis = missingInfoAnalyzer.analyze(
        takeoffData.items || [],
        reviewResults ? {
          reviewed_items: reviewResults.reviewResult.reviewed_items
        } : undefined
      )
      
      // Merge missing information from review results
      if (reviewResults && reviewResults.allMissingInformation && missingInfoAnalysis) {
        const reviewMissingInfo = reviewResults.allMissingInformation.map(mi => ({
          item_id: mi.item_id,
          item_name: mi.item_name,
          category: mi.category,
          missing_data: mi.missing_data,
          why_needed: mi.why_needed,
          where_to_find: mi.where_to_find,
          impact: mi.impact,
          suggested_action: mi.suggested_action,
          location: mi.location
        }))
        
        // Combine with analyzer results, avoiding duplicates
        const analysis = missingInfoAnalysis // Store in local variable for type narrowing
        const existingIds = new Set(analysis.missingInformation.map(m => 
          `${m.item_id || ''}_${m.item_name}_${m.missing_data}`
        ))
        
        reviewMissingInfo.forEach(mi => {
          const id = `${mi.item_id || ''}_${mi.item_name}_${mi.missing_data}`
          if (!existingIds.has(id)) {
            analysis.missingInformation.push(mi)
            existingIds.add(id)
          }
        })
      }

      // Save missing information to database
      if (missingInfoAnalysis && analysis?.id && missingInfoAnalysis.missingInformation.length > 0) {
        const missingInfoRecords = missingInfoAnalysis.missingInformation.map(mi => ({
          takeoff_analysis_id: analysis.id,
          plan_id: planId,
          item_id: mi.item_id,
          item_name: mi.item_name,
          category: mi.category,
          missing_data: mi.missing_data,
          why_needed: mi.why_needed,
          where_to_find: mi.where_to_find,
          impact: mi.impact,
          suggested_action: mi.suggested_action,
          location: mi.location
        }))

        await supabase.from('takeoff_missing_information').insert(missingInfoRecords)

        // Update plan_takeoff_analysis with missing information
        await supabase
          .from('plan_takeoff_analysis')
          .update({
            missing_information: missingInfoAnalysis.missingInformation
          })
          .eq('id', analysis.id)
      }
    } catch (missingInfoError) {
      console.error('Error in missing information analysis:', missingInfoError)
    }

    // Stage 4: Estimate Enhancement
    console.log('🔧 Enhancing with estimate information...')
    try {
      const estimateEngine = new EstimateEnhancementEngine()
      estimateEnhancement = await estimateEngine.enhance(
        takeoffData.items || [],
        images,
        costCodeStandard
      )

      // Merge estimate data into items
      if (estimateEnhancement && estimateEnhancement.enhanced_items) {
        const enhancement = estimateEnhancement // Store in local variable for type narrowing
        takeoffData.items = takeoffData.items.map((item: any, idx: number) => {
          const enhanced = enhancement.enhanced_items[idx]
          if (enhanced) {
            return {
              ...item,
              material_specs: enhanced.material_specs,
              labor: enhanced.labor,
              waste_factor: enhanced.waste_factor,
              equipment_needs: enhanced.equipment_needs,
              site_conditions: enhanced.site_conditions,
              subcontractor_required: enhanced.subcontractor_required
            }
          }
          return item
        })
      }
    } catch (estimateError) {
      console.error('Error in estimate enhancement:', estimateError)
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
      scope_first: true, // Indicates this is a scope-first takeoff with quantities at 0
      items: takeoffData.items || [],
      summary: {
        ...(takeoffData.summary || takeoffData),
        scope_first_message: 'Scope defined successfully. All quantities are set to 0 and ready for your measurements.'
      },
      measurement_guidance: {
        message: 'Your takeoff scope is complete with all items identified and priced. Quantities are set to 0.',
        next_step: 'Go to the Chat tab to get AI-guided assistance measuring and counting items from your plans.',
        items_needing_measurement: (takeoffData.items || []).length
      },
      analysisId: analysis?.id,
      review: reviewResults ? {
        reviewed_items: reviewResults.reviewResult.reviewed_items,
        missing_items: reviewResults.mergedMissingItems,
        summary: reviewResults.reviewResult.summary
      } : null,
      missing_information: missingInfoAnalysis ? {
        missingInformation: missingInfoAnalysis.missingInformation,
        summary: missingInfoAnalysis.summary
      } : null,
      estimate_enhancement: estimateEnhancement?.summary || null
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
