import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

interface AutomationSettings {
  no_response_enabled: boolean
  no_response_days: number[]
  deadline_reminder_enabled: boolean
  deadline_reminder_days: number[]
}

/**
 * GET /api/bid-packages/[id]/automations
 * Fetch automation settings for a bid package
 * Returns merged settings (package-specific overrides + global defaults)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidPackageId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!bidPackageId) {
      return NextResponse.json(
        { error: 'Bid package ID required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this bid package
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select('jobs!inner(user_id)')
      .eq('id', bidPackageId)
      .single()

    const jobUserId = bidPackage?.jobs && (Array.isArray(bidPackage.jobs) ? bidPackage.jobs[0]?.user_id : (bidPackage.jobs as any).user_id)

    if (packageError || !bidPackage || jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Bid package not found or unauthorized' },
        { status: 404 }
      )
    }

    // Get global user defaults
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email_automation_settings')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Error fetching user settings:', userError)
    }

    const globalDefaults: AutomationSettings = userData?.email_automation_settings || {
      no_response_enabled: true,
      no_response_days: [3, 7, 14],
      deadline_reminder_enabled: true,
      deadline_reminder_days: [7, 3, 1]
    }

    // Get package-specific overrides
    const { data: packageAutomation, error: automationError } = await supabase
      .from('bid_package_automations')
      .select('*')
      .eq('bid_package_id', bidPackageId)
      .maybeSingle()

    if (automationError && automationError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching package automation:', automationError)
    }

    // Merge: package-specific overrides take precedence, fall back to global defaults
    const settings: AutomationSettings = {
      no_response_enabled: packageAutomation?.no_response_enabled ?? globalDefaults.no_response_enabled,
      no_response_days: packageAutomation?.no_response_days ?? globalDefaults.no_response_days,
      deadline_reminder_enabled: packageAutomation?.deadline_reminder_enabled ?? globalDefaults.deadline_reminder_enabled,
      deadline_reminder_days: packageAutomation?.deadline_reminder_days ?? globalDefaults.deadline_reminder_days
    }

    return NextResponse.json({
      settings,
      hasCustomSettings: !!packageAutomation,
      globalDefaults
    })

  } catch (error: any) {
    console.error('Error fetching automation settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch automation settings', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/bid-packages/[id]/automations
 * Update automation settings for a bid package
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidPackageId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!bidPackageId) {
      return NextResponse.json(
        { error: 'Bid package ID required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { 
      no_response_enabled,
      no_response_days,
      deadline_reminder_enabled,
      deadline_reminder_days
    } = body

    // Validate input
    if (no_response_enabled !== undefined && typeof no_response_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'no_response_enabled must be a boolean' },
        { status: 400 }
      )
    }

    if (deadline_reminder_enabled !== undefined && typeof deadline_reminder_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'deadline_reminder_enabled must be a boolean' },
        { status: 400 }
      )
    }

    if (no_response_days !== undefined) {
      if (!Array.isArray(no_response_days) || !no_response_days.every(d => typeof d === 'number' && d > 0)) {
        return NextResponse.json(
          { error: 'no_response_days must be an array of positive integers' },
          { status: 400 }
        )
      }
    }

    if (deadline_reminder_days !== undefined) {
      if (!Array.isArray(deadline_reminder_days) || !deadline_reminder_days.every(d => typeof d === 'number' && d > 0)) {
        return NextResponse.json(
          { error: 'deadline_reminder_days must be an array of positive integers' },
          { status: 400 }
        )
      }
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this bid package
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select('jobs!inner(user_id)')
      .eq('id', bidPackageId)
      .single()

    const jobUserId = bidPackage?.jobs && (Array.isArray(bidPackage.jobs) ? bidPackage.jobs[0]?.user_id : (bidPackage.jobs as any).user_id)

    if (packageError || !bidPackage || jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Bid package not found or unauthorized' },
        { status: 404 }
      )
    }

    // Build update object (only include fields that were provided)
    const updateData: any = {}
    if (no_response_enabled !== undefined) updateData.no_response_enabled = no_response_enabled
    if (no_response_days !== undefined) updateData.no_response_days = no_response_days
    if (deadline_reminder_enabled !== undefined) updateData.deadline_reminder_enabled = deadline_reminder_enabled
    if (deadline_reminder_days !== undefined) updateData.deadline_reminder_days = deadline_reminder_days

    // Upsert automation settings
    const { data: automation, error: upsertError } = await supabase
      .from('bid_package_automations')
      .upsert({
        bid_package_id: bidPackageId,
        ...updateData
      }, {
        onConflict: 'bid_package_id'
      })
      .select()
      .single()

    if (upsertError) {
      console.error('Error upserting automation settings:', upsertError)
      return NextResponse.json(
        { error: 'Failed to update automation settings', details: upsertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      automation
    })

  } catch (error: any) {
    console.error('Error updating automation settings:', error)
    return NextResponse.json(
      { error: 'Failed to update automation settings', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bid-packages/[id]/automations
 * Remove package-specific automation settings (revert to global defaults)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidPackageId } = await params
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!bidPackageId) {
      return NextResponse.json(
        { error: 'Bid package ID required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user owns this bid package
    const { data: bidPackage, error: packageError } = await supabase
      .from('bid_packages')
      .select('jobs!inner(user_id)')
      .eq('id', bidPackageId)
      .single()

    const jobUserId = bidPackage?.jobs && (Array.isArray(bidPackage.jobs) ? bidPackage.jobs[0]?.user_id : (bidPackage.jobs as any).user_id)

    if (packageError || !bidPackage || jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Bid package not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete package-specific automation settings
    const { error: deleteError } = await supabase
      .from('bid_package_automations')
      .delete()
      .eq('bid_package_id', bidPackageId)

    if (deleteError) {
      console.error('Error deleting automation settings:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete automation settings', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Automation settings deleted, will use global defaults'
    })

  } catch (error: any) {
    console.error('Error deleting automation settings:', error)
    return NextResponse.json(
      { error: 'Failed to delete automation settings', details: error.message },
      { status: 500 }
    )
  }
}
