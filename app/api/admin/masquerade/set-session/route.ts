import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// This endpoint sets the session cookies directly from tokens
// It's called from the callback with the access and refresh tokens
export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json()
    
    if (!access_token || !refresh_token) {
      return NextResponse.json(
        { error: 'Missing tokens' },
        { status: 400 }
      )
    }

    // Create a server client that will set cookies
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options || {})
            })
          },
        },
      }
    )

    // Set the session using the tokens
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error || !data.session) {
      return NextResponse.json(
        { error: 'Failed to set session', details: error?.message },
        { status: 500 }
      )
    }

    // Create response with cookies set
    const response = NextResponse.json({
      success: true,
      user: {
        id: data.session.user.id,
        email: data.session.user.email
      }
    })

    // Ensure cookies are included in the response
    // The setAll above should have set them, but we'll make sure
    return response
  } catch (error) {
    console.error('Error setting session:', error)
    return NextResponse.json(
      { error: 'Failed to set session' },
      { status: 500 }
    )
  }
}

