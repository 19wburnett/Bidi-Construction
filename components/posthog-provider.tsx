'use client'

import { useEffect, Suspense, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { safePostHogCapture } from '@/lib/posthog-utils'

function PostHogTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastTrackedUrl = useRef<string | null>(null)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  const trackPageview = useCallback((url: string) => {
    // Prevent duplicate tracking of the same URL
    if (lastTrackedUrl.current === url) {
      return
    }

    // Clear any existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    // Debounce pageview tracking to prevent rate limiting
    debounceTimeout.current = setTimeout(() => {
      safePostHogCapture('$pageview', {
        $current_url: url,
      })
      lastTrackedUrl.current = url
    }, 300) // 300ms debounce
  }, [])

  useEffect(() => {
    // Track pageviews with debouncing
    if (pathname) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      trackPageview(url)
    }

    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [pathname, searchParams, trackPageview])

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
