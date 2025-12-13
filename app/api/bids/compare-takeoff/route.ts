import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { matchTakeoffToBid, type TakeoffItem } from '@/lib/bid-comparison/takeoff-matcher'
import { generateTakeoffAnalysis, type Bid } from '@/lib/bid-comparison/takeoff-analyzer'
import type { BidLineItem } from '@/lib/bid-comparison/ai-matcher'
import { hashTakeoffItems } from '@/lib/bid-comparison/cache-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bidId, jobId, takeoffItems, forceRefresh } = body

    if (!bidId || !jobId || !Array.isArray(takeoffItems)) {
      return NextResponse.json(
        { error: 'Missing required fields: bidId, jobId, takeoffItems' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Generate hash of takeoff items for caching
    const takeoffItemsHash = hashTakeoffItems(takeoffItems as TakeoffItem[])

    // Check for cached analysis
    if (!forceRefresh) {
      const { data: cachedAnalysis, error: cacheError } = await supabase
        .from('bid_comparison_analyses')
        .select('matches, analysis, updated_at')
        .eq('comparison_type', 'takeoff')
        .eq('selected_bid_id', bidId)
        .eq('takeoff_items_hash', takeoffItemsHash)
        .single()

      if (!cacheError && cachedAnalysis) {
        return NextResponse.json({
          matches: cachedAnalysis.matches,
          analysis: cachedAnalysis.analysis,
          cached: true,
          cachedAt: cachedAnalysis.updated_at,
        })
      }
    }

    // Load bid with line items
    const { data: bidData, error: bidError } = await supabase
      .from('bids')
      .select(`
        *,
        subcontractors (
          id,
          name,
          email,
          trade_category
        ),
        gc_contacts (
          id,
          name,
          email,
          trade_category
        )
      `)
      .eq('id', bidId)
      .single()

    if (bidError || !bidData) {
      return NextResponse.json(
        { error: 'Failed to load bid' },
        { status: 404 }
      )
    }

    const { data: bidLineItems, error: itemsError } = await supabase
      .from('bid_line_items')
      .select('*')
      .eq('bid_id', bidId)
      .order('item_number', { ascending: true })

    if (itemsError) {
      return NextResponse.json(
        { error: 'Failed to load bid line items' },
        { status: 500 }
      )
    }

    // Perform AI matching
    const matches = await matchTakeoffToBid(
      takeoffItems as TakeoffItem[],
      (bidLineItems || []) as BidLineItem[]
    )

    // Prepare bid object for analysis
    const selectedBid: Bid = {
      id: bidData.id,
      bid_amount: bidData.bid_amount,
      timeline: bidData.timeline,
      notes: bidData.notes,
      subcontractors: bidData.subcontractors,
      gc_contacts: bidData.gc_contacts,
    }

    // Generate comprehensive AI analysis
    const analysis = await generateTakeoffAnalysis(
      selectedBid,
      takeoffItems as TakeoffItem[],
      (bidLineItems || []) as BidLineItem[],
      matches
    )

    // Save to cache using RPC function
    const { error: saveError } = await supabase.rpc('upsert_bid_comparison_analysis', {
      p_comparison_type: 'takeoff',
      p_selected_bid_id: bidId,
      p_comparison_bid_ids: [],
      p_takeoff_items_hash: takeoffItemsHash,
      p_matches: matches,
      p_analysis: analysis,
    })

    if (saveError) {
      console.error('Error saving takeoff comparison analysis:', saveError)
      // Continue anyway - don't fail the request
    }

    if (saveError) {
      console.error('Error saving takeoff comparison analysis:', saveError)
      // Continue anyway - don't fail the request
    }

    return NextResponse.json({
      matches,
      analysis,
      cached: false,
    })
  } catch (error: any) {
    console.error('Error in takeoff comparison:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to compare takeoff with bid' },
      { status: 500 }
    )
  }
}

