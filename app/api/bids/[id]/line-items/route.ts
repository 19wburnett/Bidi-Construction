import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * POST /api/bids/[id]/line-items
 * Add a new line item to a bid
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!bidId) {
      return NextResponse.json(
        { error: 'Bid ID required' },
        { status: 400 }
      )
    }

    // Verify user has access to this bid's job
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select(`
        id,
        job_id,
        bid_package_id,
        jobs!inner(user_id)
      `)
      .eq('id', bidId)
      .single()

    if (bidError || !bid) {
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      )
    }

    // Get job_id
    let jobId = bid.job_id
    if (!jobId && bid.bid_package_id) {
      const { data: bidPackage } = await supabase
        .from('bid_packages')
        .select('job_id')
        .eq('id', bid.bid_package_id)
        .single()
      jobId = bidPackage?.job_id
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Bid is not associated with a job' },
        { status: 400 }
      )
    }

    // Verify user has access
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('role')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    const jobUserId = bid.jobs && (Array.isArray(bid.jobs) ? bid.jobs[0]?.user_id : (bid.jobs as any).user_id)

    if (!jobMember && jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - You do not have access to this job' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      item_number,
      description,
      category,
      quantity,
      unit,
      unit_price,
      amount,
      notes,
      is_optional,
      option_group,
      edit_notes
    } = body

    // Validate required fields
    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Amount is required' },
        { status: 400 }
      )
    }

    // Get current max item_number to determine next if not provided
    let finalItemNumber = item_number
    if (!finalItemNumber) {
      const { data: existingItems } = await supabase
        .from('bid_line_items')
        .select('item_number')
        .eq('bid_id', bidId)
        .order('item_number', { ascending: false })
        .limit(1)
      
      finalItemNumber = existingItems && existingItems.length > 0
        ? existingItems[0].item_number + 1
        : 1
    }

    // Insert the line item
    const lineItemData: any = {
      bid_id: bidId,
      item_number: finalItemNumber,
      description: description.trim(),
      category: category || null,
      quantity: quantity ? parseFloat(quantity) : null,
      unit: unit || null,
      unit_price: unit_price ? parseFloat(unit_price) : null,
      amount: parseFloat(amount),
      notes: notes || null,
      is_optional: is_optional === true,
      option_group: option_group || null
    }

    const { data: newLineItem, error: insertError } = await supabase
      .from('bid_line_items')
      .insert(lineItemData)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting line item:', insertError)
      return NextResponse.json(
        { error: 'Failed to add line item', details: insertError.message },
        { status: 500 }
      )
    }

    // Mark bid as manually edited
    await supabase
      .from('bids')
      .update({
        is_manually_edited: true,
        edited_by: user.id,
        edited_at: new Date().toISOString()
      })
      .eq('id', bidId)

    // Create audit trail entry
    await supabase
      .from('bid_edit_history')
      .insert({
        bid_id: bidId,
        edited_by: user.id,
        field_name: 'line_item',
        old_value: null,
        new_value: newLineItem,
        change_type: 'line_item_add',
        notes: edit_notes || null
      })

    return NextResponse.json({
      message: 'Line item added successfully',
      line_item: newLineItem
    })

  } catch (error: any) {
    console.error('Error adding line item:', error)
    return NextResponse.json(
      { error: 'Failed to add line item', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/bids/[id]/line-items
 * Update an existing line item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!bidId) {
      return NextResponse.json(
        { error: 'Bid ID required' },
        { status: 400 }
      )
    }

    // Verify user has access to this bid's job
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select(`
        id,
        job_id,
        bid_package_id,
        jobs!inner(user_id)
      `)
      .eq('id', bidId)
      .single()

    if (bidError || !bid) {
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      )
    }

    // Get job_id
    let jobId = bid.job_id
    if (!jobId && bid.bid_package_id) {
      const { data: bidPackage } = await supabase
        .from('bid_packages')
        .select('job_id')
        .eq('id', bid.bid_package_id)
        .single()
      jobId = bidPackage?.job_id
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Bid is not associated with a job' },
        { status: 400 }
      )
    }

    // Verify user has access
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('role')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    const jobUserId = bid.jobs && (Array.isArray(bid.jobs) ? bid.jobs[0]?.user_id : (bid.jobs as any).user_id)

    if (!jobMember && jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - You do not have access to this job' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { item_id, edit_notes, ...updateFields } = body

    if (!item_id) {
      return NextResponse.json(
        { error: 'Line item ID is required' },
        { status: 400 }
      )
    }

    // Get the existing line item
    const { data: oldLineItem, error: fetchError } = await supabase
      .from('bid_line_items')
      .select('*')
      .eq('id', item_id)
      .eq('bid_id', bidId)
      .single()

    if (fetchError || !oldLineItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (updateFields.description !== undefined) updateData.description = updateFields.description.trim()
    if (updateFields.category !== undefined) updateData.category = updateFields.category || null
    if (updateFields.quantity !== undefined) updateData.quantity = updateFields.quantity ? parseFloat(updateFields.quantity) : null
    if (updateFields.unit !== undefined) updateData.unit = updateFields.unit || null
    if (updateFields.unit_price !== undefined) updateData.unit_price = updateFields.unit_price ? parseFloat(updateFields.unit_price) : null
    if (updateFields.amount !== undefined) updateData.amount = parseFloat(updateFields.amount)
    if (updateFields.notes !== undefined) updateData.notes = updateFields.notes || null
    if (updateFields.item_number !== undefined) updateData.item_number = parseInt(updateFields.item_number)
    if (updateFields.is_optional !== undefined) updateData.is_optional = updateFields.is_optional === true
    if (updateFields.option_group !== undefined) updateData.option_group = updateFields.option_group || null

    // Update the line item
    const { data: updatedLineItem, error: updateError } = await supabase
      .from('bid_line_items')
      .update(updateData)
      .eq('id', item_id)
      .eq('bid_id', bidId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating line item:', updateError)
      return NextResponse.json(
        { error: 'Failed to update line item', details: updateError.message },
        { status: 500 }
      )
    }

    // Mark bid as manually edited
    await supabase
      .from('bids')
      .update({
        is_manually_edited: true,
        edited_by: user.id,
        edited_at: new Date().toISOString()
      })
      .eq('id', bidId)

    // Create audit trail entry
    await supabase
      .from('bid_edit_history')
      .insert({
        bid_id: bidId,
        edited_by: user.id,
        field_name: 'line_item',
        old_value: oldLineItem,
        new_value: updatedLineItem,
        change_type: 'line_item_update',
        notes: edit_notes || null
      })

    return NextResponse.json({
      message: 'Line item updated successfully',
      line_item: updatedLineItem
    })

  } catch (error: any) {
    console.error('Error updating line item:', error)
    return NextResponse.json(
      { error: 'Failed to update line item', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bids/[id]/line-items
 * Delete a line item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bidId } = await params
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!bidId) {
      return NextResponse.json(
        { error: 'Bid ID required' },
        { status: 400 }
      )
    }

    // Get item_id from query params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('item_id')

    if (!itemId) {
      return NextResponse.json(
        { error: 'Line item ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this bid's job
    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select(`
        id,
        job_id,
        bid_package_id,
        jobs!inner(user_id)
      `)
      .eq('id', bidId)
      .single()

    if (bidError || !bid) {
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      )
    }

    // Get job_id
    let jobId = bid.job_id
    if (!jobId && bid.bid_package_id) {
      const { data: bidPackage } = await supabase
        .from('bid_packages')
        .select('job_id')
        .eq('id', bid.bid_package_id)
        .single()
      jobId = bidPackage?.job_id
    }

    if (!jobId) {
      return NextResponse.json(
        { error: 'Bid is not associated with a job' },
        { status: 400 }
      )
    }

    // Verify user has access
    const { data: jobMember } = await supabase
      .from('job_members')
      .select('role')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    const jobUserId = bid.jobs && (Array.isArray(bid.jobs) ? bid.jobs[0]?.user_id : (bid.jobs as any).user_id)

    if (!jobMember && jobUserId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - You do not have access to this job' },
        { status: 403 }
      )
    }

    // Get the existing line item before deletion
    const { data: oldLineItem } = await supabase
      .from('bid_line_items')
      .select('*')
      .eq('id', itemId)
      .eq('bid_id', bidId)
      .single()

    // Delete the line item
    const { error: deleteError } = await supabase
      .from('bid_line_items')
      .delete()
      .eq('id', itemId)
      .eq('bid_id', bidId)

    if (deleteError) {
      console.error('Error deleting line item:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete line item', details: deleteError.message },
        { status: 500 }
      )
    }

    // Mark bid as manually edited
    await supabase
      .from('bids')
      .update({
        is_manually_edited: true,
        edited_by: user.id,
        edited_at: new Date().toISOString()
      })
      .eq('id', bidId)

    // Create audit trail entry
    if (oldLineItem) {
      await supabase
        .from('bid_edit_history')
        .insert({
          bid_id: bidId,
          edited_by: user.id,
          field_name: 'line_item',
          old_value: oldLineItem,
          new_value: null,
          change_type: 'line_item_delete',
          notes: null
        })
    }

    return NextResponse.json({
      message: 'Line item deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting line item:', error)
    return NextResponse.json(
      { error: 'Failed to delete line item', details: error.message },
      { status: 500 }
    )
  }
}
