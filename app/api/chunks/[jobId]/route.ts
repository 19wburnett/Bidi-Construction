import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAuthenticatedUser } from '@/lib/supabase-server'

/**
 * GET /api/chunks/[jobId]
 * 
 * Retrieve chunks for a specific job with optional filtering.
 * 
 * Query parameters:
 * - planId?: string - Filter by specific plan
 * - page?: number - Pagination page (default: 1)
 * - limit?: number - Chunks per page (default: 50, max: 100)
 * - discipline?: string - Filter by discipline
 * - sheet_type?: string - Filter by sheet type
 * - include_images?: boolean - Include image URLs (default: true)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Authentication
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { jobId } = await params
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('planId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const discipline = searchParams.get('discipline')
    const sheetType = searchParams.get('sheet_type')
    const includeImages = searchParams.get('include_images') !== 'false'

    const supabase = await createServerSupabaseClient()

    // First verify job ownership
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or access denied' },
        { status: 404 }
      )
    }

    // Build query for chunks
    let query = supabase
      .from('plan_chunks')
      .select(`
        *,
        plans!inner(
          id,
          job_id,
          user_id
        )
      `, { count: 'exact' })
      .eq('plans.job_id', jobId)
      .eq('plans.user_id', user.id)

    if (planId) {
      query = query.eq('plan_id', planId)
    }

    if (discipline) {
      query = query.eq('metadata->>discipline', discipline)
    }

    if (sheetType) {
      // Filter chunks that contain sheets with this type
      query = query.contains('sheet_index_subset', [{ sheet_type: sheetType }])
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to).order('chunk_index', { ascending: true })

    const { data: chunks, error, count } = await query

    if (error) {
      console.error('Error fetching chunks:', error)
      throw error
    }

    // Process chunks - remove image URLs if not requested
    const processedChunks = includeImages 
      ? chunks 
      : chunks?.map((chunk: any) => ({
          ...chunk,
          content: {
            ...chunk.content,
            image_urls: [],
            image_count: chunk.content?.image_count || 0
          }
        }))

    // Get discipline breakdown for stats
    const disciplineBreakdown: Record<string, number> = {}
    if (chunks) {
      chunks.forEach((chunk: any) => {
        const disc = chunk.metadata?.discipline || 'unknown'
        disciplineBreakdown[disc] = (disciplineBreakdown[disc] || 0) + 1
      })
    }

    // Get total pages from plans
    let totalPages = 0
    if (planId) {
      const { data: plan } = await supabase
        .from('plans')
        .select('num_pages')
        .eq('id', planId)
        .single()
      totalPages = plan?.num_pages || 0
    } else {
      // Sum pages from all plans in job
      const { data: plans } = await supabase
        .from('plans')
        .select('num_pages')
        .eq('job_id', jobId)
        .eq('user_id', user.id)
      totalPages = plans?.reduce((sum, p) => sum + (p.num_pages || 0), 0) || 0
    }

    return NextResponse.json({
      success: true,
      chunks: processedChunks || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      stats: {
        totalChunks: count || 0,
        totalPages,
        disciplineBreakdown
      }
    })

  } catch (error) {
    console.error('Chunk retrieval error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retrieve chunks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

