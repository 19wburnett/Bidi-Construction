import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/plan/share/[token] - Validate share token and get plan info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Query the plan_shares table directly to validate token and get plan info
    const { data, error } = await supabase
      .from('plan_shares')
      .select(`
        id,
        plan_id,
        allow_comments,
        allow_drawings,
        expires_at,
        is_active,
        created_at,
        access_count,
        plans(
          id,
          title,
          file_name,
          file_path
        )
      `)
      .eq('share_token', token)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('Error validating share token:', error)
      return NextResponse.json({ error: 'Failed to validate share token' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ 
        error: 'Invalid or expired share link',
        valid: false 
      }, { status: 404 })
    }

    // Check if link is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ 
        error: 'Share link has expired',
        valid: false 
      }, { status: 404 })
    }

    // Update access count and last accessed time
    await supabase
      .from('plan_shares')
      .update({ 
        access_count: (data.access_count || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', data.id)

    const plan = data.plans

    return NextResponse.json({
      success: true,
      valid: true,
      plan: {
        id: plan.id,
        title: plan.title,
        fileName: plan.file_name,
        fileUrl: plan.file_path
      },
      permissions: {
        allowComments: data.allow_comments,
        allowDrawings: data.allow_drawings
      },
      ownerName: 'Plan Owner' // We'll get this from a separate query if needed
    })

  } catch (error) {
    console.error('Error validating share token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

