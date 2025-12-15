import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'
import { callAnalysisLLM } from '@/lib/llm/providers'

/**
 * POST /api/jobs/[jobId]/timeline/generate
 * 
 * Uses AI to analyze takeoff data for all plans in a job and generate timeline items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this job
    const membership = await getJobForUser(supabase, jobId, user.id, 'id')
    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, name, location, project_type, created_at')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Get all plans for this job
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('id, title, file_name')
      .eq('job_id', jobId)

    if (plansError) {
      return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 })
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json({ 
        error: 'No plans found for this job. Please add plans and run takeoff analysis first.' 
      }, { status: 400 })
    }

    // Get takeoff data for all plans
    const planIds = plans.map(p => p.id)
    const { data: takeoffAnalyses, error: takeoffError } = await supabase
      .from('plan_takeoff_analysis')
      .select('plan_id, items, summary, updated_at')
      .in('plan_id', planIds)
      .order('updated_at', { ascending: false })

    if (takeoffError) {
      return NextResponse.json({ error: 'Failed to load takeoff data' }, { status: 500 })
    }

    if (!takeoffAnalyses || takeoffAnalyses.length === 0) {
      return NextResponse.json({ 
        error: 'No takeoff analysis found. Please run takeoff analysis on your plans first.' 
      }, { status: 400 })
    }

    // Aggregate takeoff items from all plans
    const allTakeoffItems: any[] = []
    const takeoffByPlan: Record<string, any> = {}

    for (const analysis of takeoffAnalyses) {
      const items = Array.isArray(analysis.items) ? analysis.items : []
      allTakeoffItems.push(...items)
      
      if (!takeoffByPlan[analysis.plan_id]) {
        takeoffByPlan[analysis.plan_id] = {
          plan: plans.find(p => p.id === analysis.plan_id),
          items: []
        }
      }
      takeoffByPlan[analysis.plan_id].items.push(...items)
    }

    if (allTakeoffItems.length === 0) {
      return NextResponse.json({ 
        error: 'Takeoff data is empty. Please ensure your takeoff analysis contains items.' 
      }, { status: 400 })
    }

    // Group items by trade/category
    const itemsByTrade: Record<string, any[]> = {}
    for (const item of allTakeoffItems) {
      const trade = item.subcontractor || item.category || item.trade_category || 'General'
      if (!itemsByTrade[trade]) {
        itemsByTrade[trade] = []
      }
      itemsByTrade[trade].push(item)
    }

    // Build summary for AI
    const tradeSummary = Object.entries(itemsByTrade).map(([trade, items]) => {
      const totalQuantity = items.reduce((sum, item) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0
        return sum + qty
      }, 0)
      const unit = items[0]?.unit || 'EA'
      return `${trade}: ${totalQuantity} ${unit}`
    }).join('\n')

    // Prepare AI prompt
    const systemPrompt = `You are an expert construction project scheduler. Your task is to analyze takeoff data from construction plans and generate a realistic project timeline.

Based on the takeoff data provided, create a timeline that:
1. Groups work by trade/category
2. Sequences trades logically (e.g., excavation before concrete, framing before electrical)
3. Estimates realistic durations based on quantities
4. Accounts for dependencies between trades
5. Provides reasonable start and end dates

Return a JSON array of timeline items with this structure:
[
  {
    "trade_category": "Trade name (e.g., Excavation, Concrete, Electrical)",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "description": "Brief description of work scope",
    "status": "scheduled"
  }
]

Important:
- Start dates should be sequential based on dependencies
- Duration should be proportional to quantity/complexity
- Use realistic construction timelines (small jobs: days, medium: weeks, large: months)
- Assume project starts soon (within next few days)
- End dates must be after start dates
- Include all major trades identified in the takeoff`

    const userPrompt = `JOB INFORMATION:
- Job Name: ${job.name}
- Location: ${job.location || 'Not specified'}
- Project Type: ${job.project_type || 'Not specified'}
- Number of Plans: ${plans.length}
- Plans: ${plans.map(p => p.title || p.file_name).join(', ')}

TAKEOFF SUMMARY BY TRADE:
${tradeSummary}

DETAILED TAKEOFF ITEMS:
${JSON.stringify(allTakeoffItems.slice(0, 100), null, 2)}${allTakeoffItems.length > 100 ? '\n... (showing first 100 items)' : ''}

Generate a realistic construction timeline based on this takeoff data. Consider:
- Typical construction sequencing
- Dependencies between trades
- Quantity/complexity affecting duration
- Realistic start dates (project can start soon)

Return ONLY a valid JSON array of timeline items.`

    // Call AI to generate timeline
    let aiResponse
    try {
      aiResponse = await callAnalysisLLM(
        {
          systemPrompt,
          userPrompt,
          images: [] // No images needed for this task
        },
        {
          temperature: 0.3,
          maxTokens: 2000,
          timeoutMs: 60000
        }
      )
    } catch (error: any) {
      console.error('AI generation error:', error)
      return NextResponse.json({ 
        error: 'Failed to generate timeline with AI', 
        details: error.message 
      }, { status: 500 })
    }

    // Parse AI response
    let timelineItems: any[]
    try {
      const content = aiResponse.content.trim()
      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        timelineItems = JSON.parse(jsonMatch[0])
      } else {
        // Try parsing entire content
        timelineItems = JSON.parse(content)
      }

      // Ensure it's an array
      if (!Array.isArray(timelineItems)) {
        timelineItems = [timelineItems]
      }
    } catch (parseError: any) {
      console.error('Failed to parse AI response:', parseError)
      console.error('AI response content:', aiResponse.content)
      return NextResponse.json({ 
        error: 'AI returned invalid response format', 
        details: parseError.message,
        rawResponse: aiResponse.content.substring(0, 500)
      }, { status: 500 })
    }

    // Validate and create timeline items with sequential dates
    const createdItems = []
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Normalize to start of day
    
    // Define construction order and dependencies
    // Trades with the same order number can run in parallel
    // Sequential trades must wait for previous phase to complete
    const constructionOrder: Record<string, number> = {
      'Excavation': 1,
      'Concrete': 2,
      'Masonry': 3,
      'Structural': 4,
      'Structural Steel': 4, // Can overlap with Structural
      'Framing': 5,
      'Roofing': 6,
      'Windows & Doors': 7,
      'Siding': 8,
      'Electrical': 9, // Can overlap with Plumbing and HVAC
      'Plumbing': 9, // Can overlap with Electrical and HVAC
      'HVAC': 9, // Can overlap with Electrical and Plumbing
      'Insulation': 10,
      'Drywall': 11,
      'Flooring': 12,
      'Painting': 13,
      'Millwork & Casework': 14
    }

    // Trades that can run in parallel (same order number)
    const parallelTrades: Record<number, string[]> = {}
    for (const [trade, order] of Object.entries(constructionOrder)) {
      if (!parallelTrades[order]) {
        parallelTrades[order] = []
      }
      parallelTrades[order].push(trade)
    }

    // Sort timeline items by construction order
    const sortedTimelineItems = [...timelineItems].sort((a, b) => {
      const orderA = constructionOrder[a.trade_category] || 99
      const orderB = constructionOrder[b.trade_category] || 99
      if (orderA === orderB) {
        // If same order, maintain AI's suggested order
        return 0
      }
      return orderA - orderB
    })

    // Track end dates by construction phase
    const phaseEndDates: Record<number, Date> = {}
    let projectStartDate = new Date(today)
    projectStartDate.setDate(projectStartDate.getDate() + 1) // Start tomorrow
    let displayOrder = 0

    for (const item of sortedTimelineItems) {
      // Validate required fields
      if (!item.trade_category || !item.start_date || !item.end_date) {
        console.warn('Skipping invalid timeline item:', item)
        continue
      }

      // Parse dates - handle various formats
      let startDate: Date
      let endDate: Date

      try {
        // Try parsing as ISO date string
        startDate = new Date(item.start_date)
        endDate = new Date(item.end_date)

        // If parsing failed, try other formats
        if (isNaN(startDate.getTime())) {
          // Try MM/DD/YYYY format
          const parts = item.start_date.split('/')
          if (parts.length === 3) {
            startDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]))
          } else {
            console.warn('Skipping item with invalid start date format:', item.start_date)
            continue
          }
        }

        if (isNaN(endDate.getTime())) {
          const parts = item.end_date.split('/')
          if (parts.length === 3) {
            endDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]))
          } else {
            console.warn('Skipping item with invalid end date format:', item.end_date)
            continue
          }
        }

        // Normalize dates to start of day
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(0, 0, 0, 0)

        // Calculate duration from AI response (use this, not the dates)
        const durationDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
        
        // Get trade order
        const tradeOrder = constructionOrder[item.trade_category] || 99
        
        // Determine start date based on dependencies
        if (tradeOrder === 1) {
          // First phase: start at project start
          startDate = new Date(projectStartDate)
        } else {
          // Check if previous phase has completed
          const prevPhaseEnd = phaseEndDates[tradeOrder - 1]
          if (prevPhaseEnd) {
            // Previous phase exists: start after it ends (add 1 day buffer)
            startDate = new Date(prevPhaseEnd)
            startDate.setDate(startDate.getDate() + 1)
          } else {
            // No previous phase: check if there's a current phase end date
            const currentPhaseEnd = phaseEndDates[tradeOrder]
            if (currentPhaseEnd) {
              // Same phase (parallel trade): can start at same time or slightly after
              startDate = new Date(currentPhaseEnd)
              // Allow trades in same phase to start together or with small stagger
              const parallelTradesInPhase = sortedTimelineItems
                .filter(i => constructionOrder[i.trade_category] === tradeOrder)
                .indexOf(item)
              if (parallelTradesInPhase > 0) {
                // Stagger parallel trades by 1 day
                startDate.setDate(startDate.getDate() + parallelTradesInPhase)
              }
            } else {
              // Fallback: use project start + estimated offset
              startDate = new Date(projectStartDate)
              startDate.setDate(startDate.getDate() + (tradeOrder - 1) * 7) // Rough estimate
            }
          }
        }

        // Ensure start date is not in the past
        if (startDate < today) {
          startDate = new Date(today)
          startDate.setDate(startDate.getDate() + 1)
        }

        // Calculate end date based on duration
        endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + durationDays)

        // Update phase end date (use the latest end date for this phase)
        if (!phaseEndDates[tradeOrder] || endDate > phaseEndDates[tradeOrder]) {
          phaseEndDates[tradeOrder] = new Date(endDate)
        }

      } catch (error: any) {
        console.warn('Error parsing dates for item:', item, error)
        continue
      }

      // Final validation
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
        console.warn('Skipping item with invalid date range:', item)
        continue
      }

      // Create timeline item
      const { data: timelineItem, error: insertError } = await supabase
        .from('job_timeline_items')
        .insert({
          job_id: jobId,
          trade_category: item.trade_category,
          subcontractor_name: item.subcontractor_name || null,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          description: item.description || null,
          status: item.status || 'scheduled',
          display_order: displayOrder++,
          created_by: user.id
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating timeline item:', insertError)
        continue
      }

      createdItems.push(timelineItem)
    }

    if (createdItems.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to create any timeline items. AI may have returned invalid data.',
        aiResponse: aiResponse.content.substring(0, 500)
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      timelineItems: createdItems,
      count: createdItems.length,
      message: `Successfully generated ${createdItems.length} timeline items`
    })

  } catch (error: any) {
    console.error('Error generating timeline:', error)
    return NextResponse.json(
      { error: 'Failed to generate timeline', details: error.message },
      { status: 500 }
    )
  }
}

