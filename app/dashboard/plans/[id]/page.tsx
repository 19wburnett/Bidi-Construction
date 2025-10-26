'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/app/providers'
import { Loader2 } from 'lucide-react'

export default function LegacyPlanViewer() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    async function redirectToNewStructure() {
      if (!user || !params.id) return

      try {
        // Try to find the plan and get its job_id
        const { data: plan, error } = await supabase
          .from('plans')
          .select('job_id')
          .eq('id', params.id)
          .eq('user_id', user.id)
          .single()

        if (error || !plan) {
          // Plan not found or no job_id, redirect to jobs list
          router.push('/dashboard/jobs')
          return
        }

        if (plan.job_id) {
          // Redirect to new job-centric plan viewer
          router.push(`/dashboard/jobs/${plan.job_id}/plans/${params.id}`)
        } else {
          // Plan exists but no job_id, redirect to jobs list
          router.push('/dashboard/jobs')
        }
      } catch (error) {
        console.error('Error redirecting plan:', error)
        router.push('/dashboard/jobs')
      }
    }

    redirectToNewStructure()
  }, [user, params.id, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Redirecting...</h2>
        <p className="text-gray-600">Taking you to the new plan viewer</p>
      </div>
    </div>
  )
}