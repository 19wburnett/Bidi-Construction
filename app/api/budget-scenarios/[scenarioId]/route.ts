import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  try {
    const { scenarioId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch scenario with job_id
    const { data: scenario, error: scenarioError } = await supabase
      .from('budget_scenarios')
      .select('*, job_id')
      .eq('id', scenarioId)
      .single()

    if (scenarioError || !scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this job
    const membership = await getJobForUser(supabase, scenario.job_id, user.id)
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch scenario with full bid details
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
      .eq('id', scenarioId)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch scenario', details: fetchError.message },
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
    })
  } catch (error) {
    console.error('Error in GET /api/budget-scenarios/[scenarioId]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  try {
    const { scenarioId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch scenario to get job_id
    const { data: scenario, error: scenarioError } = await supabase
      .from('budget_scenarios')
      .select('job_id')
      .eq('id', scenarioId)
      .single()

    if (scenarioError || !scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this job
    const membership = await getJobForUser(supabase, scenario.job_id, user.id)
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, bid_ids } = body

    // Build update object
    const updateData: any = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Scenario name cannot be empty' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    // Update scenario metadata if provided
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('budget_scenarios')
        .update(updateData)
        .eq('id', scenarioId)

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update scenario', details: updateError.message },
          { status: 500 }
        )
      }
    }

    // Update bids if provided
    if (bid_ids !== undefined && Array.isArray(bid_ids)) {
      // Verify all bid_ids belong to this job
      if (bid_ids.length > 0) {
        const { data: bids, error: bidsError } = await supabase
          .from('bids')
          .select('id, job_id')
          .in('id', bid_ids)
          .eq('job_id', scenario.job_id)

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

      // Delete existing bids
      const { error: deleteError } = await supabase
        .from('budget_scenario_bids')
        .delete()
        .eq('scenario_id', scenarioId)

      if (deleteError) {
        return NextResponse.json(
          { error: 'Failed to update scenario bids', details: deleteError.message },
          { status: 500 }
        )
      }

      // Insert new bids
      if (bid_ids.length > 0) {
        const scenarioBids = bid_ids.map((bidId: string) => ({
          scenario_id: scenarioId,
          bid_id: bidId
        }))

        const { error: insertError } = await supabase
          .from('budget_scenario_bids')
          .insert(scenarioBids)

        if (insertError) {
          return NextResponse.json(
            { error: 'Failed to update scenario bids', details: insertError.message },
            { status: 500 }
          )
        }
      }
    }

    // Fetch updated scenario
    const { data: updatedScenario, error: fetchError } = await supabase
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
      .eq('id', scenarioId)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch updated scenario', details: fetchError.message },
        { status: 500 }
      )
    }

    // Transform the data
    const bids = (updatedScenario.budget_scenario_bids || [])
      .map((sb: any) => sb.bids)
      .filter((bid: any) => bid !== null)

    return NextResponse.json({
      scenario: {
        id: updatedScenario.id,
        job_id: updatedScenario.job_id,
        name: updatedScenario.name,
        description: updatedScenario.description,
        is_active: updatedScenario.is_active,
        created_at: updatedScenario.created_at,
        updated_at: updatedScenario.updated_at,
        created_by: updatedScenario.created_by,
        bids: bids
      }
    })
  } catch (error) {
    console.error('Error in PATCH /api/budget-scenarios/[scenarioId]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  try {
    const { scenarioId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch scenario to get job_id
    const { data: scenario, error: scenarioError } = await supabase
      .from('budget_scenarios')
      .select('job_id')
      .eq('id', scenarioId)
      .single()

    if (scenarioError || !scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this job
    const membership = await getJobForUser(supabase, scenario.job_id, user.id)
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Delete scenario (cascade will delete budget_scenario_bids)
    const { error: deleteError } = await supabase
      .from('budget_scenarios')
      .delete()
      .eq('id', scenarioId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete scenario', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Scenario deleted successfully'
    })
  } catch (error) {
    console.error('Error in DELETE /api/budget-scenarios/[scenarioId]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

