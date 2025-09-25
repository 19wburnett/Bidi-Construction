import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // If there's a session error or no session, try to refresh
    if (sessionError || !session) {
      console.log('No valid session, attempting refresh...')
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError || !refreshedSession) {
        // If refresh fails, user needs to login again
        const publicPaths = ['/', '/pricing', '/subcontractors', '/demo']
        const isPublicPath = publicPaths.includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/auth')
        
        if (!isPublicPath) {
          const url = request.nextUrl.clone()
          url.pathname = '/auth/login'
          return NextResponse.redirect(url)
        }
      }
    }

    // Get user after potential refresh
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    // If user is not signed in and the current path is protected, redirect to login
    const publicPaths = ['/', '/pricing', '/subcontractors', '/demo']
    const isPublicPath = publicPaths.includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/auth')
    
    if (!user && !isPublicPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    // If user is signed in and trying to access auth pages, redirect to dashboard
    if (user && request.nextUrl.pathname.startsWith('/auth')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return response
  } catch (error) {
    console.error('Middleware auth error:', error)
    
    // On error, allow access to public paths, redirect others to login
    const publicPaths = ['/', '/pricing', '/subcontractors', '/demo']
    const isPublicPath = publicPaths.includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/auth')
    
    if (!isPublicPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }
    
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

