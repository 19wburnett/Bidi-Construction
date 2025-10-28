import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/plan/share - Create a shareable link for a plan
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      planId, 
      expiresInDays,
      permissions = 'view_only'
    } = body

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 })
    }

    // Verify user owns this plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id, user_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Calculate expiration date
    let expiresAt = null
    if (expiresInDays && expiresInDays > 0) {
      const expireDate = new Date()
      expireDate.setDate(expireDate.getDate() + expiresInDays)
      expiresAt = expireDate.toISOString()
    }

    // Create share link
    const { data: share, error: shareError } = await supabase
      .from('plan_shares')
      .insert({
        plan_id: planId,
        created_by: user.id,
        permissions: permissions,
        expires_at: expiresAt
      })
      .select('share_token, created_at, expires_at, permissions')
      .single()

    if (shareError) {
      console.error('Error creating share:', shareError)
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
    }

    // Construct full share URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    const shareUrl = `${baseUrl}/share/${share.share_token}`

    return NextResponse.json({
      success: true,
      shareUrl,
      token: share.share_token,
      expiresAt: share.expires_at,
      permissions: share.permissions
    })

  } catch (error) {
    console.error('Error in share creation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/plan/share - Get all share links for user's plans
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all shares created by this user
    const { data: shares, error: sharesError } = await supabase
      .from('plan_shares')
      .select(`
        id,
        share_token,
        created_at,
        expires_at,
        permissions,
        accessed_count,
        last_accessed_at,
        plans (
          id,
          title,
          file_name
        )
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (sharesError) {
      console.error('Error fetching shares:', sharesError)
      return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 })
    }

    // Construct full URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    const sharesWithUrls = shares.map(share => ({
      ...share,
      shareUrl: `${baseUrl}/share/${share.share_token}`,
      isExpired: share.expires_at ? new Date(share.expires_at) < new Date() : false
    }))

    return NextResponse.json({
      success: true,
      shares: sharesWithUrls
    })

  } catch (error) {
    console.error('Error fetching shares:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/plan/share?token=xxx - Deactivate a share link
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('id')

    if (!shareId) {
      return NextResponse.json({ error: 'Share ID is required' }, { status: 400 })
    }

    // Delete the share (hard delete since we don't have is_active column)
    const { error: deleteError } = await supabase
      .from('plan_shares')
      .delete()
      .eq('id', shareId)
      .eq('created_by', user.id) // Ensure user owns this share

    if (deleteError) {
      console.error('Error deleting share:', deleteError)
      return NextResponse.json({ error: 'Failed to delete share' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Share link deleted'
    })

  } catch (error) {
    console.error('Error deactivating share:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

