import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET - List subcontractors with filters (trade, location, search)
 * Query params: trade, location, search, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trade = searchParams.get('trade')
    const location = searchParams.get('location')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100) // Max 100 per page
    const offset = (page - 1) * limit

    const supabase = await createServerSupabaseClient()

    // Build query
    let query = supabase
      .from('subcontractors')
      .select('*', { count: 'exact' })

    // Apply filters
    if (trade) {
      query = query.eq('trade_category', trade)
    }

    if (location) {
      query = query.ilike('location', `%${location}%`)
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,trade_category.ilike.%${search}%,location.ilike.%${search}%`
      )
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    // Order by created_at descending (newest first)
    query = query.order('created_at', { ascending: false })

    const { data: subcontractors, error, count } = await query

    if (error) {
      console.error('Error fetching subcontractors:', error)
      return NextResponse.json(
        { error: 'Failed to fetch subcontractors', details: error.message },
        { status: 500 }
      )
    }

    // Fetch primary photos for each subcontractor
    const subcontractorIds = (subcontractors || []).map(s => s.id)
    let photosMap: Record<string, any> = {}

    if (subcontractorIds.length > 0) {
      const { data: photos } = await supabase
        .from('subcontractor_portfolio_photos')
        .select('subcontractor_id, image_url, is_primary')
        .in('subcontractor_id', subcontractorIds)
        .eq('is_primary', true)

      if (photos) {
        photosMap = photos.reduce((acc: Record<string, any>, photo: any) => {
          if (!acc[photo.subcontractor_id]) {
            acc[photo.subcontractor_id] = photo.image_url
          }
          return acc
        }, {})
      }
    }

    // Attach primary photo URLs to subcontractors
    const subcontractorsWithPhotos = (subcontractors || []).map(sub => ({
      ...sub,
      primary_photo_url: photosMap[sub.id] || sub.profile_picture_url || null,
    }))

    return NextResponse.json({
      subcontractors: subcontractorsWithPhotos,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in GET /api/subcontractors/browse:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch subcontractors',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

