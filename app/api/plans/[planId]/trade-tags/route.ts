import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase-server'

// GET - Get trade tags for a plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { planId } = await params
    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user has access to this plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, job_id, jobs!inner(id, user_id)')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Check if user owns the job or is a member
    const job = plan.jobs as any
    const { data: jobMembership } = await supabase
      .from('job_members')
      .select('id')
      .eq('job_id', plan.job_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (job.user_id !== user.id && !jobMembership) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get trade tags for this plan
    const { data: tradeTags, error: tagsError } = await supabase
      .from('plan_trade_tags')
      .select('*')
      .eq('plan_id', planId)
      .order('trade_category', { ascending: true })

    if (tagsError) {
      console.error('Error fetching trade tags:', tagsError)
      return NextResponse.json(
        { error: 'Failed to fetch trade tags' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tradeTags: tradeTags || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/plans/[planId]/trade-tags:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add trade tags to a plan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { planId } = await params
    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { tradeCategories } = body

    if (!tradeCategories || !Array.isArray(tradeCategories)) {
      return NextResponse.json(
        { error: 'tradeCategories array is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify user has access to this plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, job_id, jobs!inner(id, user_id)')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Check if user owns the job or is a member
    const job = plan.jobs as any
    const { data: jobMembership } = await supabase
      .from('job_members')
      .select('id')
      .eq('job_id', plan.job_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (job.user_id !== user.id && !jobMembership) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Insert trade tags (using upsert to handle duplicates)
    const tagsToInsert = tradeCategories.map((tradeCategory: string) => ({
      plan_id: planId,
      trade_category: tradeCategory.trim()
    })).filter((tag: any) => tag.trade_category.length > 0)

    if (tagsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'No valid trade categories provided' },
        { status: 400 }
      )
    }

    const { data: insertedTags, error: insertError } = await supabase
      .from('plan_trade_tags')
      .upsert(tagsToInsert, {
        onConflict: 'plan_id,trade_category',
        ignoreDuplicates: false
      })
      .select()

    if (insertError) {
      console.error('Error inserting trade tags:', insertError)
      return NextResponse.json(
        { error: 'Failed to add trade tags' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tradeTags: insertedTags || []
    })
  } catch (error: any) {
    console.error('Error in POST /api/plans/[planId]/trade-tags:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove trade tags from a plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { planId } = await params
    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const tradeCategory = searchParams.get('trade_category')

    const supabase = await createServerSupabaseClient()

    // Verify user has access to this plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, job_id, jobs!inner(id, user_id)')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      )
    }

    // Check if user owns the job or is a member
    const job = plan.jobs as any
    const { data: jobMembership } = await supabase
      .from('job_members')
      .select('id')
      .eq('job_id', plan.job_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (job.user_id !== user.id && !jobMembership) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Build delete query
    let deleteQuery = supabase
      .from('plan_trade_tags')
      .delete()
      .eq('plan_id', planId)

    // If trade_category is provided, delete only that tag
    if (tradeCategory) {
      deleteQuery = deleteQuery.eq('trade_category', tradeCategory)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Error deleting trade tags:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete trade tags' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: tradeCategory 
        ? `Trade tag "${tradeCategory}" removed` 
        : 'All trade tags removed'
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/plans/[planId]/trade-tags:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
