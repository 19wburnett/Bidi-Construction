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
 * GET /api/users/automation-settings
 * Fetch global automation settings for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get user's global automation settings
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email_automation_settings')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Error fetching user settings:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch automation settings', details: userError.message },
        { status: 500 }
      )
    }

    // Use defaults if settings don't exist
    const settings: AutomationSettings = userData?.email_automation_settings || {
      no_response_enabled: true,
      no_response_days: [3, 7, 14],
      deadline_reminder_enabled: true,
      deadline_reminder_days: [7, 3, 1]
    }

    return NextResponse.json({ settings })

  } catch (error: any) {
    console.error('Error fetching automation settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch automation settings', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users/automation-settings
 * Update global automation settings for the current user
 */
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
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

    // Get current settings to merge
    const { data: currentUserData } = await supabase
      .from('users')
      .select('email_automation_settings')
      .eq('id', user.id)
      .single()

    const currentSettings: AutomationSettings = currentUserData?.email_automation_settings || {
      no_response_enabled: true,
      no_response_days: [3, 7, 14],
      deadline_reminder_enabled: true,
      deadline_reminder_days: [7, 3, 1]
    }

    // Merge with new values
    const updatedSettings: AutomationSettings = {
      no_response_enabled: no_response_enabled !== undefined ? no_response_enabled : currentSettings.no_response_enabled,
      no_response_days: no_response_days !== undefined ? no_response_days : currentSettings.no_response_days,
      deadline_reminder_enabled: deadline_reminder_enabled !== undefined ? deadline_reminder_enabled : currentSettings.deadline_reminder_enabled,
      deadline_reminder_days: deadline_reminder_days !== undefined ? deadline_reminder_days : currentSettings.deadline_reminder_days
    }

    // Update user settings
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_automation_settings: updatedSettings })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating user automation settings:', updateError)
      return NextResponse.json(
        { error: 'Failed to update automation settings', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: updatedSettings
    })

  } catch (error: any) {
    console.error('Error updating automation settings:', error)
    return NextResponse.json(
      { error: 'Failed to update automation settings', details: error.message },
      { status: 500 }
    )
  }
}
