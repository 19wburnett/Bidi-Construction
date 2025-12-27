import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

/**
 * PATCH - Update photo (caption, display_order, is_primary)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params

    if (!id || !photoId) {
      return NextResponse.json(
        { error: 'Subcontractor ID and Photo ID are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', authUser.id)
      .single()

    if (userError || !user?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const updates: {
      caption?: string | null
      display_order?: number
      is_primary?: boolean
    } = {}

    if (body.caption !== undefined) {
      updates.caption = body.caption
    }
    if (body.display_order !== undefined) {
      updates.display_order = parseInt(body.display_order)
    }
    if (body.is_primary !== undefined) {
      updates.is_primary = body.is_primary === true
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const supabaseAdmin = createAdminSupabaseClient()

    // Update photo
    const { data: photo, error: updateError } = await supabaseAdmin
      .from('subcontractor_portfolio_photos')
      .update(updates)
      .eq('id', photoId)
      .eq('subcontractor_id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating photo:', updateError)
      return NextResponse.json(
        { error: 'Failed to update photo', details: updateError.message },
        { status: 500 }
      )
    }

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    return NextResponse.json({ photo })
  } catch (error) {
    console.error('Error in PATCH /api/subcontractors/[id]/photos/[photoId]:', error)
    return NextResponse.json(
      {
        error: 'Failed to update photo',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete specific photo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params

    if (!id || !photoId) {
      return NextResponse.json(
        { error: 'Subcontractor ID and Photo ID are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Check authentication
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', authUser.id)
      .single()

    if (userError || !user?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const supabaseAdmin = createAdminSupabaseClient()

    // Fetch photo to get storage path
    const { data: photo, error: fetchError } = await supabaseAdmin
      .from('subcontractor_portfolio_photos')
      .select('storage_path')
      .eq('id', photoId)
      .eq('subcontractor_id', id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { error: 'Photo not found', details: fetchError.message },
        { status: 404 }
      )
    }

    // Delete from storage
    if (photo?.storage_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('subcontractor-assets')
        .remove([photo.storage_path])

      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseAdmin
      .from('subcontractor_portfolio_photos')
      .delete()
      .eq('id', photoId)
      .eq('subcontractor_id', id)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete photo', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/subcontractors/[id]/photos/[photoId]:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete photo',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

