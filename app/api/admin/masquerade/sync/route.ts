import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// This endpoint syncs the session from client-side localStorage to server-side cookies
// It's called after the callback sets the session in localStorage
export async function POST(request: NextRequest) {
  try {
    // The middleware will have already processed the request and synced cookies
    // if there's a session in localStorage, so we just need to verify it
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'No authenticated user found', details: error?.message },
        { status: 401 }
      )
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      }
    })
  } catch (error) {
    console.error('Error syncing session:', error)
    return NextResponse.json(
      { error: 'Failed to sync session' },
      { status: 500 }
    )
  }
}

