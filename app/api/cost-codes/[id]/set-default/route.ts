import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/cost-codes/[id]/set-default
 * Set a cost code set as the user's default
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify ownership and that extraction is completed
    const { data: costCodeSet, error: fetchError } = await supabase
      .from('custom_cost_codes')
      .select('id, extraction_status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !costCodeSet) {
      return NextResponse.json(
        { error: 'Cost code set not found' },
        { status: 404 }
      )
    }

    if (costCodeSet.extraction_status !== 'completed') {
      return NextResponse.json(
        { error: 'Cost code extraction must be completed before setting as default' },
        { status: 400 }
      )
    }

    // Unset other defaults for this user
    const { error: unsetError } = await supabase
      .from('custom_cost_codes')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .neq('id', id)

    if (unsetError) {
      console.error('[Set Default] Error unsetting other defaults:', unsetError)
      return NextResponse.json(
        { error: `Failed to unset other defaults: ${unsetError.message}` },
        { status: 500 }
      )
    }

    // Set this one as default
    const { data: updated, error: updateError } = await supabase
      .from('custom_cost_codes')
      .update({ 
        is_default: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Set Default] Error setting default:', updateError)
      return NextResponse.json(
        { error: `Failed to set as default: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Update user's use_custom_cost_codes flag
    // Use admin client to bypass RLS if needed
    const supabaseAdmin = createAdminSupabaseClient()
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({ use_custom_cost_codes: true })
      .eq('id', user.id)

    if (userUpdateError) {
      console.error('[Set Default] Error updating user flag:', userUpdateError)
      // Don't fail the request if this fails, but log it
    } else {
      console.log('[Set Default] Successfully updated user flag for:', user.id)
    }

    return NextResponse.json({
      success: true,
      costCodeSet: updated
    })
  } catch (error: any) {
    console.error('Error in POST /api/cost-codes/[id]/set-default:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
