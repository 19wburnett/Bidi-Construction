'use client'

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

// Extend Window interface to include posthog
declare global {
  interface Window {
    posthog?: any
  }
}

function PostHogTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Only track if PostHog is available and not blocked
    if (pathname && typeof window !== 'undefined' && window.posthog) {
      try {
        let url = window.origin + pathname
        if (searchParams.toString()) {
          url = url + `?${searchParams.toString()}`
        }
        posthog.capture('$pageview', {
          $current_url: url,
        })
      } catch (error) {
        console.warn('PostHog tracking failed:', error)
      }
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogTracker />
      </Suspense>
      {children}
    </>
  )
}
