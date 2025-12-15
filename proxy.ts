import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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
    // Simple check - just get the user
    const { data: { user } } = await supabase.auth.getUser()

    // Define public paths
    const publicPaths = ['/', '/pricing', '/subcontractors', '/demo', '/card']
    const isPublicPath = publicPaths.includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/auth')
    const isApiRoute = request.nextUrl.pathname.startsWith('/api')
    
    // For API routes, only refresh cookies/session and pass through without redirects
    if (!isApiRoute) {
      // If user is signed in and hits the home page, send them to dashboard
      if (user && request.nextUrl.pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }

      // If no user and trying to access protected path, redirect to login
      if (!user && !isPublicPath) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
      }

      // If user is signed in and trying to access auth pages, redirect to dashboard
      // Exception: allow /auth/reset-password for password reset flow
      if (user && request.nextUrl.pathname.startsWith('/auth') && request.nextUrl.pathname !== '/auth/reset-password') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    return response
  } catch (error) {
    // On error, allow access to public paths, redirect others to login
    const publicPaths = ['/', '/pricing', '/subcontractors', '/demo', '/card']
    const isPublicPath = publicPaths.includes(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/auth')
    const isApiRoute = request.nextUrl.pathname.startsWith('/api')
    
    if (!isApiRoute && !isPublicPath) {
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
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}













