import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// POST /api/plan/share/guest-session - Create or validate guest user session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    const { guestName, email, sessionToken } = body

    // If sessionToken provided, validate existing session
    if (sessionToken) {
      const { data: guestUser, error } = await supabase
        .from('guest_users')
        .select('*')
        .eq('session_token', sessionToken)
        .single()

      if (!error && guestUser) {
        // Update last_seen_at
        await supabase
          .from('guest_users')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', guestUser.id)

        return NextResponse.json({
          success: true,
          guestUser: {
            id: guestUser.id,
            name: guestUser.guest_name,
            email: guestUser.email,
            sessionToken: guestUser.session_token
          }
        })
      }
    }

    // Create new guest user session
    if (!guestName || guestName.trim().length === 0) {
      return NextResponse.json({ error: 'Guest name is required' }, { status: 400 })
    }

    // Generate unique session token
    const newSessionToken = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

    const { data: newGuestUser, error: createError } = await supabase
      .from('guest_users')
      .insert({
        session_token: newSessionToken,
        guest_name: guestName.trim(),
        email: email?.trim() || null
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating guest user:', createError)
      return NextResponse.json({ error: 'Failed to create guest session' }, { status: 500 })
    }

    // Set cookie for guest session (7 days expiration)
    const cookieStore = await cookies()
    cookieStore.set('guest_session_token', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    cookieStore.set('guest_name', guestName.trim(), {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return NextResponse.json({
      success: true,
      guestUser: {
        id: newGuestUser.id,
        name: newGuestUser.guest_name,
        email: newGuestUser.email,
        sessionToken: newGuestUser.session_token
      }
    })

  } catch (error) {
    console.error('Error in guest session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/plan/share/guest-session - Get current guest session from cookie
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('guest_session_token')?.value
    const guestName = cookieStore.get('guest_name')?.value

    if (!sessionToken || !guestName) {
      return NextResponse.json({
        success: true,
        guestUser: null
      })
    }

    const supabase = await createServerSupabaseClient()
    const { data: guestUser, error } = await supabase
      .from('guest_users')
      .select('*')
      .eq('session_token', sessionToken)
      .single()

    if (error || !guestUser) {
      // Clear invalid cookies
      await cookieStore.delete('guest_session_token')
      await cookieStore.delete('guest_name')
      
      return NextResponse.json({
        success: true,
        guestUser: null
      })
    }

    // Update last_seen_at
    await supabase
      .from('guest_users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', guestUser.id)

    return NextResponse.json({
      success: true,
      guestUser: {
        id: guestUser.id,
        name: guestUser.guest_name,
        email: guestUser.email,
        sessionToken: guestUser.session_token
      }
    })

  } catch (error) {
    console.error('Error getting guest session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

