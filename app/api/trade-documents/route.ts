import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

// GET - List trade documents (filter by job_id, plan_id, trade_category)
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('job_id')
    const planId = searchParams.get('plan_id')
    const tradeCategory = searchParams.get('trade_category')

    if (!jobId) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user has access to this job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Check if user owns the job or is a member
    const { data: jobMembership } = await supabase
      .from('job_members')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (job.user_id !== user.id && !jobMembership) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Build query
    let query = supabase
      .from('trade_documents')
      .select('*')
      .eq('job_id', jobId)

    if (planId) {
      query = query.eq('plan_id', planId)
    }

    if (tradeCategory) {
      query = query.eq('trade_category', tradeCategory)
    }

    const { data: documents, error: docsError } = await query
      .order('created_at', { ascending: false })

    if (docsError) {
      console.error('Error fetching trade documents:', docsError)
      return NextResponse.json(
        { error: 'Failed to fetch trade documents' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documents: documents || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/trade-documents:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Upload new trade document
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const jobId = formData.get('job_id') as string
    const planId = formData.get('plan_id') as string | null
    const tradeCategory = formData.get('trade_category') as string
    const documentType = formData.get('document_type') as string
    const description = formData.get('description') as string | null

    if (!file || !jobId || !tradeCategory || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields: file, job_id, trade_category, document_type' },
        { status: 400 }
      )
    }

    // Validate document type
    const validTypes = ['sow', 'specification', 'addendum', 'other']
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: `document_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user has access to this job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Check if user owns the job or is a member
    const { data: jobMembership } = await supabase
      .from('job_members')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (job.user_id !== user.id && !jobMembership) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // If planId is provided, verify it belongs to the job
    if (planId) {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id, job_id')
        .eq('id', planId)
        .eq('job_id', jobId)
        .single()

      if (planError || !plan) {
        return NextResponse.json(
          { error: 'Plan not found or does not belong to this job' },
          { status: 404 }
        )
      }
    }

    // Upload file to storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${jobId}/trade-documents/${tradeCategory}/${fileName}`

    // Use job-plans bucket (or create trade-documents bucket if needed)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('job-plans')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Create database record
    const { data: document, error: insertError } = await supabase
      .from('trade_documents')
      .insert({
        job_id: jobId,
        plan_id: planId || null,
        trade_category: tradeCategory,
        document_type: documentType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        description: description || null,
        uploaded_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating document record:', insertError)
      // Try to clean up uploaded file
      await supabase.storage
        .from('job-plans')
        .remove([filePath])
      
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      document
    })
  } catch (error: any) {
    console.error('Error in POST /api/trade-documents:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
