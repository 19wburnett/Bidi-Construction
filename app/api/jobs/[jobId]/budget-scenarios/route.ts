import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this job
    const membership = await getJobForUser(supabase, jobId, user.id)
    if (!membership) {
      return NextResponse.json(
        { error: 'Job not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch all scenarios for this job with their bids
    const { data: scenarios, error: scenariosError } = await supabase
      .from('budget_scenarios')
      .select(`
        *,
        budget_scenario_bids (
          bid_id,
          bids (
            id,
            bid_amount,
            status,
            accepted_at,
            declined_at,
            subcontractors (
              id,
              name,
              email,
              trade_category
            ),
            gc_contacts (
              id,
              name,
              email,
              trade_category,
              location,
              company,
              phone
            ),
            bid_packages (
              id,
              trade_category
            ),
            bid_line_items (
              id,
              item_number,
              description,
              category,
              quantity,
              unit,
              unit_price,
              amount,
              notes
            )
          )
        )
      `)
      .eq('job_id', jobId)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })

    if (scenariosError) {
      console.error('Error fetching scenarios:', scenariosError)
      return NextResponse.json(
        { error: 'Failed to fetch scenarios', details: scenariosError.message },
        { status: 500 }
      )
    }

    // Transform the data to flatten bids
    const transformedScenarios = (scenarios || []).map(scenario => {
      const bids = (scenario.budget_scenario_bids || [])
        .map((sb: any) => sb.bids)
        .filter((bid: any) => bid !== null)
      
      return {
        id: scenario.id,
        job_id: scenario.job_id,
        name: scenario.name,
        description: scenario.description,
        is_active: scenario.is_active,
        created_at: scenario.created_at,
        updated_at: scenario.updated_at,
        created_by: scenario.created_by,
        bids: bids
      }
    })

    return NextResponse.json({
      scenarios: transformedScenarios
    })
  } catch (error) {
    console.error('Error in GET /api/jobs/[jobId]/budget-scenarios:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this job
    const membership = await getJobForUser(supabase, jobId, user.id)
    if (!membership) {
      return NextResponse.json(
        { error: 'Job not found or access denied' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, description, bid_ids } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Scenario name is required' },
        { status: 400 }
      )
    }

    // Verify all bid_ids belong to this job
    if (bid_ids && Array.isArray(bid_ids) && bid_ids.length > 0) {
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('id, job_id')
        .in('id', bid_ids)
        .eq('job_id', jobId)

      if (bidsError) {
        return NextResponse.json(
          { error: 'Failed to verify bids', details: bidsError.message },
          { status: 500 }
        )
      }

      if (!bids || bids.length !== bid_ids.length) {
        return NextResponse.json(
          { error: 'One or more bids do not belong to this job' },
          { status: 400 }
        )
      }
    }

    // Create the scenario
    const { data: scenario, error: scenarioError } = await supabase
      .from('budget_scenarios')
      .insert({
        job_id: jobId,
        name: name.trim(),
        description: description?.trim() || null,
        is_active: false,
        created_by: user.id
      })
      .select()
      .single()

    if (scenarioError) {
      console.error('Error creating scenario:', scenarioError)
      return NextResponse.json(
        { error: 'Failed to create scenario', details: scenarioError.message },
        { status: 500 }
      )
    }

    // Add bids to scenario if provided
    if (bid_ids && Array.isArray(bid_ids) && bid_ids.length > 0) {
      const scenarioBids = bid_ids.map((bidId: string) => ({
        scenario_id: scenario.id,
        bid_id: bidId
      }))

      const { error: junctionError } = await supabase
        .from('budget_scenario_bids')
        .insert(scenarioBids)

      if (junctionError) {
        // Rollback scenario creation
        await supabase.from('budget_scenarios').delete().eq('id', scenario.id)
        return NextResponse.json(
          { error: 'Failed to add bids to scenario', details: junctionError.message },
          { status: 500 }
        )
      }
    }

    // Fetch the complete scenario with bids
    const { data: completeScenario, error: fetchError } = await supabase
      .from('budget_scenarios')
      .select(`
        *,
        budget_scenario_bids (
          bid_id,
          bids (
            id,
            bid_amount,
            status,
            subcontractors (
              id,
              name,
              email,
              trade_category
            ),
            gc_contacts (
              id,
              name,
              email,
              trade_category
            ),
            bid_packages (
              id,
              trade_category
            )
          )
        )
      `)
      .eq('id', scenario.id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch created scenario', details: fetchError.message },
        { status: 500 }
      )
    }

    // Transform the data
    const bids = (completeScenario.budget_scenario_bids || [])
      .map((sb: any) => sb.bids)
      .filter((bid: any) => bid !== null)

    return NextResponse.json({
      scenario: {
        id: completeScenario.id,
        job_id: completeScenario.job_id,
        name: completeScenario.name,
        description: completeScenario.description,
        is_active: completeScenario.is_active,
        created_at: completeScenario.created_at,
        updated_at: completeScenario.updated_at,
        created_by: completeScenario.created_by,
        bids: bids
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/jobs/[jobId]/budget-scenarios:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

