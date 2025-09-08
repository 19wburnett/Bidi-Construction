import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    console.log('Test endpoint called')
    
    const supabase = await createServerSupabaseClient()
    
    // Get the current user from the session
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    console.log('Auth user:', authUser?.id)
    console.log('Auth error:', authError)
    
    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required', details: authError?.message },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin, email')
      .eq('id', authUser.id)
      .single()

    console.log('User data:', user)
    console.log('User error:', userError)

    if (userError) {
      return NextResponse.json(
        { error: 'User not found', details: userError.message },
        { status: 404 }
      )
    }

    if (!user?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required', userEmail: user?.email },
        { status: 403 }
      )
    }

    return NextResponse.json({
      message: 'Test successful',
      userId: authUser.id,
      userEmail: user.email,
      isAdmin: user.is_admin
    })
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

