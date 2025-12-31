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
      pendingJobs.map(async (job) => {
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

            if (!response.ok) {
              let errorDetails: any = { error: `HTTP ${response.status}` }
              try {
                const errorBody = await response.json()
                errorDetails = errorBody
              } catch (e) {
                const text = await response.text().catch(() => '')
                errorDetails = { error: `HTTP ${response.status}`, details: text || 'No error body' }
              }
              
              console.error(`❌ Job ${job.id} HTTP error:`, errorDetails)
              throw new Error(errorDetails.error || errorDetails.details || `HTTP ${response.status}`)
            }

            const result = await response.json()
            console.log(`✅ Job ${job.id} completed: ${result.chunkCount || 0} chunks created`)
            
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
          
          // Try to update the job status in the database
          try {
            await supabase
              .from('plan_vectorization_queue')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : String(error),
                completed_at: new Date().toISOString(),
              })
              .eq('id', job.id)
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
