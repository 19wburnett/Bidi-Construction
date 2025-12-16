import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getJobForUser } from '@/lib/job-access'

export async function POST(
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
      .select('job_id, is_active')
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

    // Get all bids in this scenario
    const { data: scenarioBids, error: scenarioBidsError } = await supabase
      .from('budget_scenario_bids')
      .select('bid_id')
      .eq('scenario_id', scenarioId)

    if (scenarioBidsError) {
      return NextResponse.json(
        { error: 'Failed to fetch scenario bids', details: scenarioBidsError.message },
        { status: 500 }
      )
    }

    const scenarioBidIds = (scenarioBids || []).map((sb: any) => sb.bid_id)

    // Get all bids for this job that are currently accepted
    const { data: acceptedBids, error: acceptedBidsError } = await supabase
      .from('bids')
      .select('id')
      .eq('job_id', scenario.job_id)
      .eq('status', 'accepted')

    if (acceptedBidsError) {
      return NextResponse.json(
        { error: 'Failed to fetch accepted bids', details: acceptedBidsError.message },
        { status: 500 }
      )
    }

    const acceptedBidIds = (acceptedBids || []).map((b: any) => b.id)
    
    // Find bids that need to be declined (accepted but not in scenario)
    const bidsToDecline = acceptedBidIds.filter((bidId: string) => !scenarioBidIds.includes(bidId))

    // Start transaction-like operations
    // 1. Set all other scenarios for this job to inactive
    const { error: deactivateError } = await supabase
      .from('budget_scenarios')
      .update({ is_active: false })
      .eq('job_id', scenario.job_id)
      .neq('id', scenarioId)

    if (deactivateError) {
      return NextResponse.json(
        { error: 'Failed to deactivate other scenarios', details: deactivateError.message },
        { status: 500 }
      )
    }

    // 2. Set this scenario as active
    const { error: activateError } = await supabase
      .from('budget_scenarios')
      .update({ is_active: true })
      .eq('id', scenarioId)

    if (activateError) {
      return NextResponse.json(
        { error: 'Failed to activate scenario', details: activateError.message },
        { status: 500 }
      )
    }

    // 3. Accept all bids in the scenario
    if (scenarioBidIds.length > 0) {
      const now = new Date().toISOString()
      const { error: acceptError } = await supabase
        .from('bids')
        .update({
          status: 'accepted',
          accepted_at: now,
          declined_at: null,
          decline_reason: null
        })
        .in('id', scenarioBidIds)

      if (acceptError) {
        return NextResponse.json(
          { error: 'Failed to accept bids', details: acceptError.message },
          { status: 500 }
        )
      }
    }

    // 4. Decline bids not in the scenario that were previously accepted
    if (bidsToDecline.length > 0) {
      const now = new Date().toISOString()
      const { error: declineError } = await supabase
        .from('bids')
        .update({
          status: 'declined',
          declined_at: now,
          decline_reason: 'Replaced by scenario'
        })
        .in('id', bidsToDecline)

      if (declineError) {
        return NextResponse.json(
          { error: 'Failed to decline bids', details: declineError.message },
          { status: 500 }
        )
      }
    }

    // Fetch updated scenario with bids
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

    // Calculate totals
    const totalBudget = bids.reduce((sum: number, bid: any) => {
      return sum + (bid.bid_amount || 0)
    }, 0)

    return NextResponse.json({
      success: true,
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
      },
      stats: {
        bids_accepted: scenarioBidIds.length,
        bids_declined: bidsToDecline.length,
        total_budget: totalBudget
      }
    })
  } catch (error) {
    console.error('Error in POST /api/budget-scenarios/[scenarioId]/apply:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

