import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/cost-codes
 * Get all cost code sets for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get all cost code sets for user
    const { data: costCodeSets, error } = await supabase
      .from('custom_cost_codes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch cost code sets' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      costCodeSets: costCodeSets || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/cost-codes:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
