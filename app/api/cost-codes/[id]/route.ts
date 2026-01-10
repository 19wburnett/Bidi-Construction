import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/cost-codes/[id]
 * Get a specific cost code set
 */
export async function GET(
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

    // Get cost code set
    const { data: costCodeSet, error } = await supabase
      .from('custom_cost_codes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !costCodeSet) {
      return NextResponse.json(
        { error: 'Cost code set not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      costCodeSet
    })
  } catch (error: any) {
    console.error('Error in GET /api/cost-codes/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/cost-codes/[id]
 * Update a cost code set (name, etc.)
 */
export async function PUT(
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

    const body = await request.json()
    const { name } = body

    // Verify ownership
    const { data: existing } = await supabase
      .from('custom_cost_codes')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Cost code set not found' },
        { status: 404 }
      )
    }

    // Update
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    if (name !== undefined) {
      updateData.name = name
    }

    const { data: updated, error } = await supabase
      .from('custom_cost_codes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update cost code set' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      costCodeSet: updated
    })
  } catch (error: any) {
    console.error('Error in PUT /api/cost-codes/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cost-codes/[id]
 * Delete a cost code set
 */
export async function DELETE(
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

    // Get cost code set to get file path
    const { data: costCodeSet } = await supabase
      .from('custom_cost_codes')
      .select('file_path, is_default')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!costCodeSet) {
      return NextResponse.json(
        { error: 'Cost code set not found' },
        { status: 404 }
      )
    }

    // If this was the default, unset use_custom_cost_codes for user
    if (costCodeSet.is_default) {
      await supabase
        .from('users')
        .update({ use_custom_cost_codes: false })
        .eq('id', user.id)
    }

    // Delete file from storage
    await supabase.storage
      .from('bid-documents')
      .remove([costCodeSet.file_path])

    // Delete database record
    const { error } = await supabase
      .from('custom_cost_codes')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete cost code set' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/cost-codes/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
