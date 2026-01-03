import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

// GET - Get specific trade document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { error: 'Document id is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get document with job info
    const { data: document, error: docError } = await supabase
      .from('trade_documents')
      .select('*, jobs!inner(id, user_id)')
      .eq('id', id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if user owns the job or is a member
    const job = document.jobs as any
    const { data: jobMembership } = await supabase
      .from('job_members')
      .select('id')
      .eq('job_id', document.job_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (job.user_id !== user.id && !jobMembership) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Remove jobs object from response
    const { jobs, ...documentData } = document

    return NextResponse.json({
      success: true,
      document: documentData
    })
  } catch (error: any) {
    console.error('Error in GET /api/trade-documents/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update document metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { error: 'Document id is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { description, trade_category, document_type } = body

    const supabase = await createServerSupabaseClient()

    // Get document and verify access
    const { data: document, error: docError } = await supabase
      .from('trade_documents')
      .select('*, jobs!inner(id, user_id)')
      .eq('id', id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if user owns the job or is a member
    const job = document.jobs as any
    const { data: jobMembership } = await supabase
      .from('job_members')
      .select('id')
      .eq('job_id', document.job_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (job.user_id !== user.id && !jobMembership) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (description !== undefined) updateData.description = description
    if (trade_category !== undefined) updateData.trade_category = trade_category
    if (document_type !== undefined) {
      const validTypes = ['sow', 'specification', 'addendum', 'other']
      if (!validTypes.includes(document_type)) {
        return NextResponse.json(
          { error: `document_type must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.document_type = document_type
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data: updatedDocument, error: updateError } = await supabase
      .from('trade_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating document:', updateError)
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document: updatedDocument
    })
  } catch (error: any) {
    console.error('Error in PATCH /api/trade-documents/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { error: 'Document id is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get document and verify access
    const { data: document, error: docError } = await supabase
      .from('trade_documents')
      .select('*, jobs!inner(id, user_id)')
      .eq('id', id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if user owns the job or is a member
    const job = document.jobs as any
    const { data: jobMembership } = await supabase
      .from('job_members')
      .select('id')
      .eq('job_id', document.job_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (job.user_id !== user.id && !jobMembership) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('job-plans')
      .remove([document.file_path])

    if (storageError) {
      console.error('Error deleting file from storage:', storageError)
      // Continue with database delete even if storage delete fails
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('trade_documents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting document:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/trade-documents/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
