import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Cron endpoint for processing pending vectorization jobs
 * 
 * This endpoint is designed to run periodically via Vercel Cron.
 * It processes pending vectorization jobs from the queue, allowing
 * vectorization to continue even if users close the app.
 * 
 * Security: Validates CRON_SECRET header to prevent unauthorized access
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (Vercel sets this automatically for cron jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // In production, require CRON_SECRET
    if (process.env.NODE_ENV === 'production' && cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('🚫 Unauthorized cron request')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    console.log('🔄 Starting vectorization queue processor...')
    const supabase = await createServerSupabaseClient()
    
    // Get pending jobs, ordered by priority and queued_at
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('plan_vectorization_queue')
      .select('id, plan_id, priority, queued_at')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('queued_at', { ascending: true })
      .limit(5) // Process up to 5 jobs per cron run

    if (jobsError) {
      console.error('Error fetching pending jobs:', jobsError)
      return NextResponse.json(
        { error: 'Failed to fetch pending jobs', details: jobsError.message },
        { status: 500 }
      )
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('✅ No pending vectorization jobs')
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending jobs',
      })
    }

    console.log(`📋 Found ${pendingJobs.length} pending job(s)`)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'

    // Process each job
    const results = await Promise.allSettled(
      pendingJobs.map(async (job) => {
        try {
          console.log(`🚀 Processing vectorization job ${job.id} for plan ${job.plan_id}`)
          
          // Call the process endpoint
          const response = await fetch(`${baseUrl}/api/plan-vectorization/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queueJobId: job.id }),
          })

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(error.error || `HTTP ${response.status}`)
          }

          const result = await response.json()
          console.log(`✅ Job ${job.id} completed: ${result.chunkCount || 0} chunks created`)
          
          return {
            jobId: job.id,
            planId: job.plan_id,
            success: true,
            chunkCount: result.chunkCount,
          }
        } catch (error) {
          console.error(`❌ Job ${job.id} failed:`, error)
          return {
            jobId: job.id,
            planId: job.plan_id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })
    )

    const processed = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length

    console.log(`✅ Processed ${processed} job(s), ${failed} failed`)

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: pendingJobs.length,
      jobs: results.map((r) => r.status === 'fulfilled' ? r.value : { error: 'Failed to process' }),
    })
  } catch (error) {
    console.error('❌ Vectorization queue processor error:', error)
    return NextResponse.json(
      {
        error: 'Queue processor failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
