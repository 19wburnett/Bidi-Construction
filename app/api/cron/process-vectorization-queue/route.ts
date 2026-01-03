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
      .limit(10) // Fetch more to filter out orphaned jobs

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

    // Filter out jobs for plans that no longer exist (orphaned jobs)
    const planIds = [...new Set(pendingJobs.map(job => job.plan_id))]
    const { data: existingPlans } = await supabase
      .from('plans')
      .select('id')
      .in('id', planIds)

    const existingPlanIds = new Set(existingPlans?.map(p => p.id) || [])
    const validJobs = pendingJobs.filter(job => existingPlanIds.has(job.plan_id))
    const orphanedJobs = pendingJobs.filter(job => !existingPlanIds.has(job.plan_id))

    // Mark orphaned jobs as failed
    if (orphanedJobs.length > 0) {
      console.warn(`⚠️ Found ${orphanedJobs.length} orphaned job(s) for deleted plans`)
      const orphanedJobIds = orphanedJobs.map(job => job.id)
      await supabase
        .from('plan_vectorization_queue')
        .update({
          status: 'failed',
          error_message: 'Plan not found. The plan may have been deleted.',
          completed_at: new Date().toISOString(),
          current_step: 'Plan not found',
        })
        .in('id', orphanedJobIds)
    }

    if (validJobs.length === 0) {
      console.log('✅ No valid pending vectorization jobs (all were orphaned)')
      return NextResponse.json({
        success: true,
        processed: 0,
        orphaned: orphanedJobs.length,
        message: 'No valid pending jobs',
      })
    }

    // Limit to 5 jobs for processing
    const jobsToProcess = validJobs.slice(0, 5)

    console.log(`📋 Found ${validJobs.length} valid pending job(s) (${orphanedJobs.length} orphaned), processing ${jobsToProcess.length}`)

    // Determine the base URL for internal API calls
    // In Vercel, we can use the request URL or environment variables
    const vercelUrl = process.env.VERCEL_URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    
    let baseUrl: string
    if (appUrl) {
      // Remove trailing slash if present
      baseUrl = appUrl.replace(/\/$/, '')
    } else if (vercelUrl) {
      baseUrl = `https://${vercelUrl}`
    } else {
      // Fallback: try to construct from request
      const url = new URL(request.url)
      baseUrl = `${url.protocol}//${url.host}`
    }
    
    console.log(`🌐 Using base URL: ${baseUrl}`)

    // Process each job
    const results = await Promise.allSettled(
      jobsToProcess.map(async (job) => {
        try {
          console.log(`🚀 Processing vectorization job ${job.id} for plan ${job.plan_id}`)
          
          const processUrl = `${baseUrl}/api/plan-vectorization/process`
          console.log(`📡 Calling process endpoint: ${processUrl}`)
          
          // Call the process endpoint with timeout
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 minute timeout
          
          try {
            const response = await fetch(processUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ queueJobId: job.id }),
              signal: controller.signal,
            })
            
            clearTimeout(timeoutId)

            // Parse response body first to get error details
            let result: any
            try {
              result = await response.json()
            } catch (e) {
              const text = await response.text().catch(() => '')
              result = { error: `HTTP ${response.status}`, details: text || 'No response body' }
            }

            // Check for HTTP errors (4xx, 5xx)
            if (!response.ok) {
              const errorMessage = result.error || result.message || result.details || `HTTP ${response.status}`
              console.error(`❌ Job ${job.id} HTTP error (${response.status}):`, errorMessage)
              // Don't throw here - let it fall through to check if job was already marked as failed
              // The process endpoint may have already updated the job status
              throw new Error(errorMessage)
            }

            // Check if the result indicates failure (even if HTTP status was 200)
            if (result.success === false || result.error) {
              const errorMessage = result.error || result.message || 'Vectorization failed'
              console.error(`❌ Job ${job.id} failed (success=false in response): ${errorMessage}`)
              throw new Error(errorMessage)
            }
            
            // Only log success if we actually got a successful result
            // Must explicitly have success: true, not just chunkCount
            if (result.success === true) {
              console.log(`✅ Job ${job.id} completed: ${result.chunkCount || 0} chunks created`)
            } else {
              // This shouldn't happen if error handling above works, but log it just in case
              console.warn(`⚠️ Job ${job.id} returned response without explicit success:`, result)
              throw new Error(result.error || result.message || 'Unexpected response format')
            }
            
            return {
              jobId: job.id,
              planId: job.plan_id,
              success: true,
              chunkCount: result.chunkCount,
            }
          } catch (fetchError) {
            clearTimeout(timeoutId)
            
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              throw new Error('Request timeout after 10 minutes')
            }
            throw fetchError
          }
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`
            : String(error)
          
          console.error(`❌ Job ${job.id} failed:`, errorMessage)
          
          // Check if job was already updated by the process endpoint (e.g., plan not found)
          // Only update if the job is still in pending/processing status
          try {
            const { data: currentJob } = await supabase
              .from('plan_vectorization_queue')
              .select('status, error_message')
              .eq('id', job.id)
              .single()
            
            // Only update if job hasn't been marked as failed already
            if (currentJob && currentJob.status !== 'failed') {
              await supabase
                .from('plan_vectorization_queue')
                .update({
                  status: 'failed',
                  error_message: error instanceof Error ? error.message : String(error),
                  completed_at: new Date().toISOString(),
                })
                .eq('id', job.id)
            } else if (currentJob?.status === 'failed') {
              console.log(`ℹ️ Job ${job.id} was already marked as failed by process endpoint`)
            }
          } catch (updateError) {
            console.error(`❌ Failed to update job ${job.id} status:`, updateError)
          }
          
          return {
            jobId: job.id,
            planId: job.plan_id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            errorDetails: error instanceof Error ? error.stack : undefined,
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
      total: jobsToProcess.length,
      orphaned: orphanedJobs.length,
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
