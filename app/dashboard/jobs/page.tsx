'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect /dashboard/jobs to /dashboard
 * Jobs are now displayed on the main dashboard page
 */
export default function JobsRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return null
}
